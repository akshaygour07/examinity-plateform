import assert from "node:assert/strict";
import { PlatformService } from "./platform.service";

test("returns registered configuration values and rejects unregistered keys", async () => {
  const row = {
    configKey: "default_locale",
    settingName: "Default Language",
    category: "Platform",
    valueJson: "en-IN",
    valueType: "STRING",
    description: null,
    isSensitive: false,
    isEditable: true,
    status: "ACTIVE",
    version: 1,
    updatedAt: new Date(),
  };
  const service = new PlatformService({ configuration: { findUnique: async () => row } } as never, {} as never);
  await assert.rejects(service.getConfiguration("unknown"));
  const result = await service.getConfiguration("default_locale");
  assert.equal(result.data.value, "en-IN");
});

test("reads registered settings and rejects absent database records", async () => {
  const service = new PlatformService({ configuration: { findUnique: async () => null } } as never, {} as never);
  await assert.rejects(service.getConfiguration("default_locale"));
});

test("reports missing feature flags", async () => {
  const service = new PlatformService({ featureFlag: { findUnique: async () => null } } as never, {} as never);
  await assert.rejects(service.getFlag("unknown"));
});
