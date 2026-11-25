import { spawn } from "node:child_process";
import { Client } from "pg";
import { setTimeout as delay } from "node:timers/promises";

const adminUrl = "postgresql://postgres:root@localhost:5432/postgres";
const demoUrl = "postgresql://postgres:root@localhost:5432/examinity?schema=public";
const env = {
  ...process.env,
  DATABASE_URL: demoUrl,
  AUTH0_ISSUER_BASE_URL: "http://127.0.0.1:4011/",
  API_AUDIENCE: "https://examinity-backend-api",
  AUTH0_CLAIM_NAMESPACE: process.env.AUTH0_CLAIM_NAMESPACE || "https://examinity.in/",
  AUTH0_ADMIN_CLIENT_ID: process.env.AUTH0_ADMIN_CLIENT_ID || "local-admin-client-id",
  STORAGE_ENDPOINT: "local",
  TERMS_VERSION: "v1",
  NODE_ENV: "development",
  API_PORT: "4000",
  CORS_ORIGINS: "http://localhost:3000",
};
const issuerUrl = "http://127.0.0.1:4011";
const apiUrl = "http://localhost:4000";
const children = [];
const pnpm = (...args) => ["pnpm", "--config.verify-deps-before-run=false", ...args];

async function ensureDatabase() {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", ["examinity"]);
  if (found.rowCount === 0) await client.query("CREATE DATABASE examinity");
  await client.end();
  console.log("PostgreSQL database examinity is ready (career_guidance was not changed).");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", shell: true, cwd: process.cwd() });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}

function start(command, args) {
  const child = spawn(command, args, { env, stdio: "inherit", shell: true, cwd: process.cwd() });
  children.push(child);
  return child;
}

async function waitFor(url, label, { postBody } = {}) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(
        url,
        postBody
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(postBody),
            }
          : {},
      );
      if (response.ok) {
        console.log(`${label} is ready`);
        return await response.json().catch(() => ({}));
      }
    } catch {
      /* retry */
    }
    await delay(1000);
  }
  throw new Error(`${label} did not become ready`);
}

async function json(method, url, token, body, headers = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  console.log(`${method} ${url} -> ${response.status}`);
  if (response.status >= 400) console.log(JSON.stringify(parsed, null, 2));
  return { status: response.status, body: parsed };
}

async function main() {
  await ensureDatabase();
  await run("corepack", pnpm("db:generate"));
  await run("corepack", pnpm("db:deploy"));
  await run("corepack", pnpm("db:seed"));
  await run("corepack", pnpm("exec", "tsx", "scripts/seed-client-demo-role.ts"));

  try {
    await waitFor(`${issuerUrl}/.well-known/openid-configuration`, "Existing mock issuer");
  } catch {
    start("corepack", pnpm("dev:mock-auth"));
    await waitFor(`${issuerUrl}/.well-known/openid-configuration`, "Mock issuer");
  }
  const passwordlessProbe = await fetch(`${issuerUrl}/mock/passwordless/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection: "email", email: "email.demo@example.test" }),
  });
  const passwordlessProbeBody = await passwordlessProbe.json().catch(() => ({}));
  if (!passwordlessProbe.ok || passwordlessProbeBody.delivery !== "mock_only")
    throw new Error(
      "The issuer on port 4011 is an older mock. Stop that issuer and restart `corepack pnpm client:demo` from this checkout to enable local email/phone OTP demos.",
    );
  await run("corepack", pnpm("build"));
  try {
    await waitFor(`${apiUrl}/health/ready`, "Existing API");
  } catch {
    start("corepack", pnpm("start"));
    await waitFor(`${apiUrl}/health/live`, "API liveness");
    await waitFor(`${apiUrl}/health/ready`, "API readiness");
  }

  const tokenResponse = await json("POST", `${issuerUrl}/oauth/token`, null, { profile: "admin" });
  const token = tokenResponse.body.access_token;
  if (!token)
    throw new Error(
      "The issuer on port 4011 does not support the passwordless admin profile. Restart the local mock issuer from this checkout.",
    );

  const sync = await json("POST", `${apiUrl}/api/v1/auth/sync`, token, {
    terms_accepted: true,
    terms_version: "v1",
    registration_source: "SOCIAL",
  });
  if (sync.status >= 400) throw new Error("Could not sync the local mock admin; see API response above.");

  const adminSubject = "auth0|local-demo-user";
  const database = new Client({ connectionString: demoUrl });
  await database.connect();
  const existingAdmin = await database.query(`
    SELECT 1
    FROM identity.user_role_assignments a
    JOIN identity.roles r ON r.id = a.role_id
    JOIN identity.users u ON u.id = a.user_id
    WHERE a.status = 'ACTIVE' AND r.code = 'SUPER_ADMIN' AND r.active AND u.status = 'ACTIVE'
      AND (a.starts_at IS NULL OR a.starts_at <= NOW())
      AND (a.ends_at IS NULL OR a.ends_at > NOW())
    LIMIT 1
  `);
  await database.end();
  const activeAdmin = existingAdmin.rowCount > 0;
  if (!activeAdmin) {
    env.BOOTSTRAP_AUTH0_SUB = adminSubject;
    await run("corepack", pnpm("bootstrap:super-admin"));
  }

  const me = await json("GET", `${apiUrl}/api/v1/auth/me`, token);
  if (!me.body?.data?.roles?.includes("SUPER_ADMIN")) throw new Error("Local mock identity is not SUPER_ADMIN after bootstrap.");
  const userId = me.body?.data?.user?.id;
  console.log("Client demo is running.");
  console.log("Swagger: http://localhost:4000/api/docs");
  console.log("Health:  http://localhost:4000/health/ready");
  console.log(`Current user: ${userId}`);
  console.log("Postman: postman/Examinity-Module-1-Frozen-API.postman_collection.json");
  console.log(
    "Postman run order: issue admin token → issue user token → sync admin → sync user → run admin APIs → run regular-user denial checks.",
  );
  console.log("Keep this window open. Mock issuer :4011 and API :4000 stay running.");

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  for (const child of children) child.kill();
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const child of children) child.kill();
    process.exit(0);
  });
