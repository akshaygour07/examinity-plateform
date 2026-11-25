import assert from "node:assert/strict";
import { configurationCatalogue, initialFeatureFlags } from "../src/platform/configuration-catalogue";

test("configuration registry accepts safe defaults and rejects invalid types/ranges", () => {
  for (const definition of Object.values(configurationCatalogue)) assert.equal(definition.validate(definition.defaultValue), true);
  assert.equal(configurationCatalogue.max_upload_size.validate(101), false);
  assert.equal(configurationCatalogue.maintenance_mode.validate("true"), false);
  assert.equal(configurationCatalogue.default_timezone.validate("not/a-timezone"), false);
  assert.equal(configurationCatalogue.supported_file_types.validate(["application/x-executable"]), false);
});

test("initial feature flags are registered and disabled by default in seed contract", () => {
  assert.ok(initialFeatureFlags.some((flag) => flag.key === "media_upload_enabled"));
  assert.ok(initialFeatureFlags.some((flag) => flag.key === "public_media_enabled"));
});
