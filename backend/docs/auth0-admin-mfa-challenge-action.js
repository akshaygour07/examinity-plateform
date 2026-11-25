// Auth0 Post-Login Action 1: attach to the shared tenant's Login flow.
// Configure ADMIN_CLIENT_ID as an Action secret containing the separate admin SPA client ID.
exports.onExecutePostLogin = async (event, api) => {
  if (event.client.client_id !== event.secrets.ADMIN_CLIENT_ID) return;

  const enrolled = event.user.enrolledFactors || [];
  if (enrolled.length > 0) {
    api.authentication.challengeWithAny();
  } else {
    api.authentication.enrollWithAny([{ type: "otp" }, { type: "webauthn-platform" }]);
  }
};
