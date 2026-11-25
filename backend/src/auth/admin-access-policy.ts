import type { JWTPayload } from "jose";

/** Auth0's authenticated-party claim must identify the dedicated admin application. */
export function isAdminApplicationToken(claims: JWTPayload, expectedClientId: string): boolean {
  const namespace = process.env.AUTH0_CLAIM_NAMESPACE?.replace(/\/?$/, "/");
  const namespacedClientId = namespace ? claims[`${namespace}admin_client_id`] : undefined;
  return claims.azp === expectedClientId || namespacedClientId === expectedClientId;
}

/** Accept only Auth0's explicit MFA authentication method marker for admin APIs. */
export function hasCompletedMfa(claims: JWTPayload): boolean {
  const namespace = process.env.AUTH0_CLAIM_NAMESPACE?.replace(/\/?$/, "/");
  const namespacedMfa = namespace ? claims[`${namespace}mfa`] : undefined;
  return namespacedMfa === true || (Array.isArray(claims.amr) && claims.amr.some((method) => method === "mfa"));
}
