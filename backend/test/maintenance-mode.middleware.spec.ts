import assert from "node:assert/strict";
import { MaintenanceModeMiddleware } from "../src/platform/maintenance-mode.middleware";

function setup(enabled: boolean) {
  let reads = 0;
  let nextCalls = 0;
  const responseState: { status?: number; body?: unknown } = {};
  const middleware = new MaintenanceModeMiddleware({
    configuration: {
      findUnique: async () => {
        reads++;
        return { status: "ACTIVE", valueJson: enabled };
      },
    },
  } as never);
  const req = { method: "GET", path: "/api/v1/auth/me", headers: {}, id: "request-1" } as never;
  const res = {
    status(code: number) {
      responseState.status = code;
      return this;
    },
    json(body: unknown) {
      responseState.body = body;
      return this;
    },
  } as never;
  const next = () => {
    nextCalls++;
  };
  return { middleware, req, res, next, nextCalls: () => nextCalls, reads: () => reads, responseState };
}

test("maintenance mode blocks application routes with the standard safe error envelope", async () => {
  const state = setup(true);
  state.middleware.use(state.req, state.res, state.next as never);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(state.responseState.status, 503);
  assert.deepEqual(state.responseState.body, {
    error: {
      code: "maintenance_mode",
      message: "The application is temporarily unavailable for maintenance.",
      details: {},
      request_id: "request-1",
    },
  });
  assert.equal(state.nextCalls(), 0);
});

test("maintenance mode allows health and the authenticated config route that can disable it", () => {
  const state = setup(true);
  const res = state.res as { status: () => never };
  state.middleware.use({ method: "GET", path: "/health/live", headers: {} } as never, res as never, state.next as never);
  state.middleware.use(
    { method: "PUT", path: "/api/v1/configurations/maintenance_mode", headers: {} } as never,
    res as never,
    state.next as never,
  );
  assert.equal(state.nextCalls(), 2);
  assert.equal(state.reads(), 0);
});

test("Swagger UI and its JSON spec are available without reading database configuration", () => {
  const state = setup(true);
  const res = state.res as { status: () => never };
  for (const path of ["/api/docs", "/api/docs/", "/api/docs/swagger-ui-init.js", "/api/docs-json"]) {
    state.middleware.use({ method: "GET", path, headers: {} } as never, res as never, state.next as never);
  }
  assert.equal(state.nextCalls(), 4);
  assert.equal(state.reads(), 0);
});

test("normal application requests pass while maintenance mode is disabled", async () => {
  const state = setup(false);
  state.middleware.use(state.req, state.res, state.next as never);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(state.nextCalls(), 1);
  assert.equal(state.responseState.status, undefined);
});
