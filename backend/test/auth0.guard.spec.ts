import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";

import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Auth0Guard, type AuthenticatedRequest } from "../src/auth/auth0.guard";

let server: Server;
let issuer: string;
let publicJwk: Awaited<ReturnType<typeof exportJWK>>;
let privateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", use: "sig", alg: "RS256" };
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/.well-known/openid-configuration") {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("JWKS test server has no address");
      const localIssuer = `http://127.0.0.1:${address.port}/`;
      res.end(JSON.stringify({ issuer: localIssuer, jwks_uri: `${localIssuer}.well-known/jwks.json` }));
    } else {
      res.end(JSON.stringify({ keys: [publicJwk] }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start JWKS test server");
  issuer = `http://127.0.0.1:${address.port}/`;
  process.env.AUTH0_ISSUER_BASE_URL = issuer;
  process.env.API_AUDIENCE = "https://api.examinity.local";
  delete process.env.NODE_ENV;
});

afterAll(() => {
  server?.close();
});

function context(token?: string) {
  const request = { headers: token ? { authorization: token } : {} } as unknown as AuthenticatedRequest;
  return { request, context: { switchToHttp: () => ({ getRequest: () => request }) } };
}

async function token(
  options: {
    issuer?: string;
    audience?: string;
    expiresAt?: number;
    algorithm?: "RS256" | "HS256";
    nonce?: string;
    noExpiry?: boolean;
  } = {},
) {
  const algorithm = options.algorithm ?? "RS256";
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ scope: "openid", ...(options.nonce ? { nonce: options.nonce } : {}) })
    .setProtectedHeader({ alg: algorithm, kid: "test-key", typ: "JWT" })
    .setIssuer(options.issuer ?? issuer)
    .setAudience(options.audience ?? "https://api.examinity.local")
    .setSubject("auth0|member-123")
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 120)
    .sign(algorithm === "HS256" ? new TextEncoder().encode("test-only-not-a-real-secret") : privateKey);
}

test("accepts a correctly signed API access token and exposes only validated claims", async () => {
  const signed = await token();
  const { request, context: executionContext } = context(`Bearer ${signed}`);
  assert.equal(await new Auth0Guard().canActivate(executionContext as never), true);
  assert.equal(request.auth0.sub, "auth0|member-123");
});

for (const [name, options] of [
  ["expired", { expiresAt: Math.floor(Date.now() / 1000) - 100 }],
  ["wrong issuer", { issuer: "http://attacker.example/" }],
  ["wrong audience", { audience: "https://other-api.example" }],
  ["unsupported algorithm", { algorithm: "HS256" as const }],
] as const) {
  test(`rejects ${name} token`, async () => {
    const signed = await token(options);
    const { context: executionContext } = context(`Bearer ${signed}`);
    await assert.rejects(() => new Auth0Guard().canActivate(executionContext as never));
  });
}

test("rejects absent and malformed bearer credentials", async () => {
  for (const authorization of [undefined, "Basic abc", "Bearer invalid"]) {
    const { context: executionContext } = context(authorization);
    await assert.rejects(() => new Auth0Guard().canActivate(executionContext as never));
  }
});

test("rejects an OIDC ID-token-shaped JWT carrying a nonce", async () => {
  const signed = await token({ nonce: "browser-oidc-nonce" });
  const { context: executionContext } = context(`Bearer ${signed}`);
  await assert.rejects(() => new Auth0Guard().canActivate(executionContext as never));
});
