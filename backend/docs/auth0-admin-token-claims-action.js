// Auth0 Post-Login Action 2: place immediately after the MFA challenge Action.
// Add CLAIM_NAMESPACE and ADMIN_CLIENT_ID as Action secrets.
exports.onExecutePostLogin = async (event, api) => {
  if (event.client.client_id !== event.secrets.ADMIN_CLIENT_ID) return;

  const namespace = (event.secrets.CLAIM_NAMESPACE || "https://examinity.in/").replace(/\/?$/, "/");
  const methods = event.authentication?.methods || [];
  const completedMfa = methods.some((method) => method.name === "mfa");
  api.accessToken.setCustomClaim(`${namespace}admin_client_id`, event.client.client_id);
  if (completedMfa) api.accessToken.setCustomClaim(`${namespace}mfa`, true);
};
