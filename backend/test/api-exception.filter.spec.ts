import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";

function capture(exception: unknown) {
  let status = 0;
  let body: unknown;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: "request-safe", headers: {} }),
      getResponse: () => ({
        status(code: number) {
          status = code;
          return this;
        },
        json(value: unknown) {
          body = value;
          return this;
        },
      }),
    }),
  };
  new ApiExceptionFilter().catch(exception, host as never);
  return { status, body };
}

test("unexpected errors do not expose database or credential details", () => {
  const result = capture(new Error("password=private database host=internal"));
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    error: {
      code: "internal_server_error",
      message: "An unexpected error occurred.",
      details: {},
      request_id: "request-safe",
    },
  });
});

test("validation errors return a stable safe envelope with request ID", () => {
  const result = capture(new BadRequestException({ message: ["field must be a string"], error: "Bad Request" }));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: {
      code: "validation_error",
      message: "The request contains invalid fields.",
      details: { fields: ["field must be a string"] },
      request_id: "request-safe",
    },
  });
});
