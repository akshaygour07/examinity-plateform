import "dotenv/config";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { PrismaPg } from "@prisma/adapter-pg";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Set DATABASE_URL to an isolated test database before running this smoke test.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "flow-test-key", use: "sig", alg: "RS256" };
  let issuer = "";
  const jwksServer: Server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "public, max-age=60");
    if (request.url === "/.well-known/openid-configuration")
      response.end(JSON.stringify({ issuer, jwks_uri: `${issuer}.well-known/jwks.json` }));
    else response.end(JSON.stringify({ keys: [jwk] }));
  });
  let api: ChildProcess | undefined;
  let testUserId: string | undefined;
  try {
    console.info("Connecting to the isolated PostgreSQL test database...");
    await prisma.$connect();
    console.info("Starting the local test issuer...");
    jwksServer.listen(0, "127.0.0.1");
    await once(jwksServer, "listening");
    const jwksAddress = jwksServer.address();
    if (!jwksAddress || typeof jwksAddress === "string") throw new Error("Could not start test JWKS server");
    issuer = `http://127.0.0.1:${jwksAddress.port}/`;

    const portProbe = createServer();
    portProbe.listen(0, "127.0.0.1");
    await once(portProbe, "listening");
    const probeAddress = portProbe.address();
    if (!probeAddress || typeof probeAddress === "string") throw new Error("Could not reserve an API port");
    const port = probeAddress.port;
    await new Promise<void>((resolve, reject) => portProbe.close((error) => (error ? reject(error) : resolve())));

    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      AUTH0_ISSUER_BASE_URL: issuer,
      API_AUDIENCE: "https://api.examinity.local",
      AUTH0_CLAIM_NAMESPACE: "https://examinity.in/",
      API_PORT: String(port),
      NODE_ENV: "test",
    };
    console.info("Starting the compiled NestJS API...");
    api = spawn(process.execPath, ["dist/src/main.js"], { cwd: process.cwd(), env, stdio: "ignore" });
    const apiUrl = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const response = await fetch(`${apiUrl}/health/ready`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* the child is still starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, "compiled API did not become ready");

    const memberSubject = `auth0|smoke-${crypto.randomUUID()}`;
    const unknownSubject = `auth0|unknown-${crypto.randomUUID()}`;
    const unverifiedSubject = `auth0|unverified-${crypto.randomUUID()}`;
    const smokeEmail = `identity-smoke-${crypto.randomUUID()}@example.invalid`;

    const makeToken = (sub: string, email = smokeEmail, emailVerified = true) =>
      new SignJWT({
        scope: "openid profile email",
        "https://examinity.in/email": email,
        "https://examinity.in/email_verified": emailVerified,
        "https://examinity.in/name": "Identity Smoke Test",
        "https://examinity.in/given_name": "Identity",
        "https://examinity.in/family_name": "Smoke",
      })
        .setProtectedHeader({ alg: "RS256", kid: "flow-test-key", typ: "JWT" })
        .setIssuer(issuer)
        .setAudience("https://api.examinity.local")
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime("2m")
        .sign(privateKey);
    const headers = async (sub: string, email = smokeEmail, emailVerified = true) => ({
      authorization: `Bearer ${await makeToken(sub, email, emailVerified)}`,
    });

    const firstSyncs = await Promise.all([
      fetch(`${apiUrl}/api/v1/auth/sync`, { method: "POST", headers: await headers(memberSubject) }),
      fetch(`${apiUrl}/api/v1/auth/sync`, { method: "POST", headers: await headers(memberSubject) }),
    ]);
    const firstSyncBodies = (await Promise.all(firstSyncs.map((response) => response.json()))) as Array<{
      data?: { user: { id: string; status: string; email_verified: boolean }; roles: string[]; permissions: string[] };
      meta?: { request_id: string };
    }>;
    assert.equal(firstSyncs[0].status, 200, JSON.stringify(firstSyncBodies[0]));
    assert.equal(firstSyncs[1].status, 200, JSON.stringify(firstSyncBodies[1]));
    const syncBody = firstSyncBodies[0];
    assert.equal(syncBody.data?.user.status, "ACTIVE");
    assert.equal(syncBody.data?.user.email_verified, true);
    assert.deepEqual(syncBody.data?.roles, ["AUTHENTICATED_USER"]);
    assert.deepEqual(syncBody.data?.permissions, []);
    assert.ok(syncBody.meta?.request_id);
    testUserId = syncBody.data!.user.id;
    assert.equal(firstSyncBodies[1].data?.user.id, testUserId);

    const repeatedSync = await fetch(`${apiUrl}/api/v1/auth/sync`, { method: "POST", headers: await headers(memberSubject) });
    const repeatedBody = (await repeatedSync.json()) as { data?: { user: { id: string } } };
    assert.equal(repeatedSync.status, 200);
    assert.equal(repeatedBody.data?.user.id, testUserId);

    const currentUser = await fetch(`${apiUrl}/api/v1/auth/me`, { headers: await headers(memberSubject) });
    const currentBody = (await currentUser.json()) as {
      data?: { user: { id: string; status: string }; roles: string[]; permissions: string[] };
      meta?: { request_id: string };
    };
    assert.equal(currentUser.status, 200, JSON.stringify(currentBody));
    assert.equal(currentBody.data?.user.id, testUserId);
    assert.equal(currentBody.data?.user.status, "ACTIVE");
    assert.deepEqual(currentBody.data?.roles, ["AUTHENTICATED_USER"]);
    assert.ok(currentBody.meta?.request_id);

    const insufficient = await fetch(`${apiUrl}/api/v1/users?page=1&page_size=20`, { headers: await headers(memberSubject) });
    assert.equal(insufficient.status, 403);
    const forbidden = (await insufficient.json()) as { error: { code: string; request_id: string } };
    assert.equal(forbidden.error.code, "insufficient_permission");
    assert.ok(forbidden.error.request_id);

    const unverified = await fetch(`${apiUrl}/api/v1/auth/sync`, {
      method: "POST",
      headers: await headers(unverifiedSubject, `unverified-${crypto.randomUUID()}@example.invalid`, false),
    });
    assert.equal(unverified.status, 403);
    const verificationError = (await unverified.json()) as { error: { code: string } };
    assert.equal(verificationError.error.code, "identity_verification_required");
    assert.equal(await prisma.user.count({ where: { auth0Subject: unverifiedSubject } }), 0);

    const unknown = await fetch(`${apiUrl}/api/v1/auth/me`, { headers: await headers(unknownSubject) });
    assert.equal(unknown.status, 403);
    const unresolved = (await unknown.json()) as { error: { code: string } };
    assert.equal(unresolved.error.code, "identity_not_provisioned");

    await prisma.user.update({ where: { id: testUserId }, data: { status: "DISABLED" } });
    const disabled = await fetch(`${apiUrl}/api/v1/auth/me`, { headers: await headers(memberSubject) });
    assert.equal(disabled.status, 403);
    const inactive = (await disabled.json()) as { error: { code: string } };
    assert.equal(inactive.error.code, "account_not_active");
    console.info(
      "Identity API smoke passed: compiled Nest API, Auth0-style JWT/JWKS, first-login sync, baseline role, repeat sync, email verification, RBAC denial, and disabled-account enforcement.",
    );
  } finally {
    if (api?.pid) {
      api.kill();
      await once(api, "exit").catch(() => undefined);
    }
    // Smoke requests create append-only audit rows that reference their actors. Run this only
    // against a disposable, isolated database; its random fixtures and audit evidence are retained.
    await prisma.$disconnect();
    if (jwksServer.listening) await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
