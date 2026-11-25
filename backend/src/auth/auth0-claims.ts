import type { JWTPayload } from "jose";

/** Read a standard OIDC claim or its configured Auth0 custom-claim equivalent. */
export function auth0Claim(claims: JWTPayload, key: string): unknown {
  const namespace = process.env.AUTH0_CLAIM_NAMESPACE;
  const namespaced = namespace ? claims[`${namespace.replace(/\/?$/, "/")}${key}`] : undefined;
  return claims[key] ?? namespaced;
}

export function auth0EmailVerified(claims: JWTPayload): boolean {
  return auth0Claim(claims, "email_verified") === true;
}

/** Auth0's trusted phone_number_verified claim marks a phone suitable for local account sync. */
export function auth0PhoneVerified(claims: JWTPayload): boolean {
  return auth0Claim(claims, "phone_number_verified") === true;
}
