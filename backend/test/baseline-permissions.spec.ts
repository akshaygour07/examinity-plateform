import assert from "node:assert/strict";
import { baselineAdminPermissionCodes, platformRoleCodes, withheldAdminPermissionCodes } from "../src/roles/baseline-permissions";

test("seed catalogue includes the approved non-admin authenticated-user baseline role", () => {
  assert.deepEqual(platformRoleCodes, ["SUPER_ADMIN", "ADMIN", "AUTHENTICATED_USER"]);
});

test("baseline ADMIN does not receive legacy role-assignment permissions", () => {
  const baseline = new Set<string>(baselineAdminPermissionCodes);
  for (const permission of withheldAdminPermissionCodes) {
    assert.equal(baseline.has(permission), false);
  }
  assert.equal(baseline.has("role.manage"), false);
  assert.equal(baseline.has("user.roles.manage"), false);
});
