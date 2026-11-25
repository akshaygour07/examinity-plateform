import "dotenv/config";
import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

if (process.env.NODE_ENV === "production") {
  throw new Error("The local mock token issuer is disabled in production.");
}

const port = Number(process.env.DEV_MOCK_AUTH_PORT ?? 4011);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("DEV_MOCK_AUTH_PORT must be a valid TCP port.");
const issuer = `http://127.0.0.1:${port}/`;
const audience = process.env.API_AUDIENCE ?? "";
const namespace = process.env.AUTH0_CLAIM_NAMESPACE ?? "https://examinity.in/";
type MockAccount = {
  profile: string;
  sub: string;
  email?: string;
  phoneNumber?: string;
  name: string;
  givenName: string;
  familyName: string;
  adminClient?: boolean;
  mfa?: boolean;
};
const localAccounts: MockAccount[] = [
  {
    profile: "admin",
    sub: "auth0|local-demo-user",
    email: "demo@example.test",
    name: "Demo Admin",
    givenName: "Demo",
    familyName: "Admin",
    adminClient: true,
    mfa: true,
  },
  {
    profile: "admin-no-mfa",
    sub: "auth0|local-demo-user",
    email: "demo@example.test",
    name: "Demo Admin",
    givenName: "Demo",
    familyName: "Admin",
    adminClient: true,
    mfa: false,
  },
  {
    profile: "admin-wrong-client",
    sub: "auth0|local-demo-user",
    email: "demo@example.test",
    name: "Demo Admin",
    givenName: "Demo",
    familyName: "Admin",
    adminClient: false,
    mfa: true,
  },
  {
    profile: "user",
    sub: "auth0|local-demo-user-basic",
    email: "basic-user@example.test",
    name: "Basic Demo User",
    givenName: "Basic",
    familyName: "User",
  },
  {
    profile: "email",
    sub: "auth0|local-email-otp-user",
    email: "email.demo@example.test",
    name: "Email OTP Demo",
    givenName: "Email OTP",
    familyName: "Demo",
  },
  {
    profile: "phone",
    sub: "auth0|local-phone-otp-user",
    phoneNumber: "+15555550123",
    name: "Phone OTP Demo",
    givenName: "Phone OTP",
    familyName: "Demo",
  },
];

if (!audience) throw new Error("Set API_AUDIENCE in .env before starting the local mock issuer.");
if (!namespace.startsWith("https://")) throw new Error("AUTH0_CLAIM_NAMESPACE must be an HTTPS URI.");

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { modulusLength: 2048 });
  const keyId = "examinity-local-dev-key";
  const jwk = { ...(await exportJWK(publicKey)), kid: keyId, use: "sig", alg: "RS256" };
  const challenges = new Map<string, { code: string; expiresAt: number }>();

  function json(response: ServerResponse, status: number, body: unknown) {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify(body));
  }

  async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 8_192) throw new Error("Request body too large");
      chunks.push(buffer);
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
    return value as Record<string, unknown>;
  }

  async function issueAccessToken(account: MockAccount) {
    const claims: Record<string, unknown> = {
      [`${namespace}name`]: account.name,
      [`${namespace}given_name`]: account.givenName,
      [`${namespace}family_name`]: account.familyName,
      [`${namespace}admin_client_id`]: account.adminClient
        ? (process.env.AUTH0_ADMIN_CLIENT_ID ?? "local-admin-client-id")
        : "local-public-client-id",
      [`${namespace}mfa`]: account.mfa === true,
      azp: account.adminClient ? (process.env.AUTH0_ADMIN_CLIENT_ID ?? "local-admin-client-id") : "local-public-client-id",
      amr: account.mfa ? ["pwd", "mfa"] : ["pwd"],
    };
    if (account.email) {
      claims[`${namespace}email`] = account.email;
      claims[`${namespace}email_verified`] = true;
    }
    if (account.phoneNumber) {
      claims[`${namespace}phone_number`] = account.phoneNumber;
      claims[`${namespace}phone_number_verified`] = true;
    }
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: keyId, typ: "JWT" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(account.sub)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);
  }

  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", issuer).pathname;
    if (request.method === "GET" && path === "/.well-known/openid-configuration") {
      return json(response, 200, {
        issuer,
        jwks_uri: `${issuer}.well-known/jwks.json`,
        token_endpoint: `${issuer}oauth/token`,
        response_types_supported: ["token"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
      });
    }
    if (request.method === "GET" && path === "/.well-known/jwks.json") {
      return json(response, 200, { keys: [jwk] });
    }
    if (request.method === "POST" && path === "/mock/passwordless/start") {
      try {
        const body = await readJson(request);
        const account =
          body.connection === "email"
            ? localAccounts.find((candidate) => candidate.profile === "email" && body.email === candidate.email)
            : body.connection === "sms"
              ? localAccounts.find((candidate) => candidate.profile === "phone" && body.phone_number === candidate.phoneNumber)
              : undefined;
        if (!account)
          return json(response, 400, {
            error: "invalid_request",
            error_description: "Use the configured local email or phone demo identity.",
          });
        const challengeKey = `${account.profile}:${account.sub}`;
        const code = String(randomInt(100_000, 1_000_000));
        challenges.set(challengeKey, { code, expiresAt: Date.now() + 5 * 60_000 });
        return json(response, 200, {
          delivery: "mock_only",
          message: "No email or SMS was sent. Use mock_code to continue this local walkthrough.",
          mock_code: code,
          expires_in: 300,
        });
      } catch {
        return json(response, 400, { error: "invalid_request", error_description: "Send a small JSON object." });
      }
    }
    if (request.method === "POST" && path === "/mock/passwordless/verify") {
      try {
        const body = await readJson(request);
        const account =
          body.connection === "email"
            ? localAccounts.find((candidate) => candidate.profile === "email" && body.email === candidate.email)
            : body.connection === "sms"
              ? localAccounts.find((candidate) => candidate.profile === "phone" && body.phone_number === candidate.phoneNumber)
              : undefined;
        if (!account || typeof body.code !== "string")
          return json(response, 400, {
            error: "invalid_request",
            error_description: "Choose a supported mock channel and provide its code.",
          });
        const challengeKey = `${account.profile}:${account.sub}`;
        const challenge = challenges.get(challengeKey);
        if (!challenge || challenge.expiresAt <= Date.now()) {
          challenges.delete(challengeKey);
          return json(response, 401, { error: "invalid_grant", error_description: "The mock code is missing or expired. Start again." });
        }
        const supplied = Buffer.from(body.code);
        const expected = Buffer.from(challenge.code);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
          return json(response, 401, { error: "invalid_grant", error_description: "The mock code is incorrect." });
        challenges.delete(challengeKey);
        return json(response, 200, {
          token_type: "Bearer",
          expires_in: 900,
          access_token: await issueAccessToken(account),
        });
      } catch {
        return json(response, 400, { error: "invalid_request", error_description: "Send a small JSON object." });
      }
    }
    if (request.method === "POST" && path === "/oauth/token") {
      try {
        const body = await readJson(request);
        // Passwordless local fixture used only for the loopback Postman demo.
        // The mock profile selector is not available outside this development issuer.
        const account = localAccounts.find(
          (candidate) =>
            ["admin", "user", "admin-no-mfa", "admin-wrong-client"].includes(String(body.profile)) && body.profile === candidate.profile,
        );
        if (!account) {
          return json(response, 400, { error: "invalid_request", error_description: "Choose a supported local mock profile." });
        }
        const accessToken = await issueAccessToken(account);
        return json(response, 200, { token_type: "Bearer", expires_in: 900, access_token: accessToken });
      } catch {
        return json(response, 400, { error: "invalid_request", error_description: "Send a small JSON object." });
      }
    }
    return json(response, 404, { error: "not_found" });
  });

  server.listen(port, "127.0.0.1", () => {
    console.info(`Local mock issuer listening at http://127.0.0.1:${port}/ (loopback only)`);
    console.info("Local demo profiles: admin, user, admin-no-mfa, admin-wrong-client, email OTP, and phone OTP (mock-only)");
    console.info("It issues 15-minute API access tokens. OTP codes are local fixtures; it does not simulate Auth0 or deliver messages.");
  });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Could not start the local mock issuer.");
  process.exitCode = 1;
});
