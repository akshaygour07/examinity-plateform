/**
 * Auth0 Dashboard > Actions > Library > Create Post Login Action.
 * Add this Action to the Login flow for the Examinity development tenant.
 * Keep the namespace identical to AUTH0_CLAIM_NAMESPACE in the Nest API.
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = "https://examinity.in/";
  const source = event.user;
  const claims = {
    email: source.email,
    email_verified: source.email_verified,
    name: source.name,
    given_name: source.given_name,
    family_name: source.family_name,
    phone_number: source.phone_number,
    phone_number_verified: source.phone_number_verified,
  };

  for (const [key, value] of Object.entries(claims)) {
    if (value !== undefined) api.accessToken.setCustomClaim(`${namespace}${key}`, value);
  }
};
