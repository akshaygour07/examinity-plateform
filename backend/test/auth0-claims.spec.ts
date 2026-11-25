import assert from "node:assert/strict";
import { auth0Claim, auth0EmailVerified } from "../src/auth/auth0-claims";

test("reads Auth0 namespaced claims used by the API Action", () => {
  const priorNamespace = process.env.AUTH0_CLAIM_NAMESPACE;
  process.env.AUTH0_CLAIM_NAMESPACE = "https://examinity.in";
  try {
    const claims = {
      "https://examinity.in/email": "student@example.com",
      "https://examinity.in/email_verified": true,
    };
    assert.equal(auth0Claim(claims, "email"), "student@example.com");
    assert.equal(auth0EmailVerified(claims), true);
  } finally {
    if (priorNamespace === undefined) delete process.env.AUTH0_CLAIM_NAMESPACE;
    else process.env.AUTH0_CLAIM_NAMESPACE = priorNamespace;
  }
});

test("does not treat a missing or false email verification claim as verified", () => {
  assert.equal(auth0EmailVerified({ email_verified: false }), false);
  assert.equal(auth0EmailVerified({}), false);
});
