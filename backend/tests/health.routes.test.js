const express = require("express");
const request = require("supertest");
const { createHealthRouter } = require("../src/modules/health/health.routes");

describe("health routes", () => {
  test("liveness endpoint returns 200", async () => {
    const healthService = {
      checkLiveness: async () => ({
        status: "ok",
        uptimeSeconds: 10,
        timestamp: new Date().toISOString(),
      }),
      checkReadiness: async () => ({
        status: "ready",
        ready: true,
        timestamp: new Date().toISOString(),
        checks: {},
      }),
    };

    const app = express();
    app.use("/api/v1/health", createHealthRouter({ healthService }));

    const response = await request(app).get("/api/v1/health/liveness");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  test("readiness endpoint returns 503 when not ready", async () => {
    const healthService = {
      checkLiveness: async () => ({
        status: "ok",
        uptimeSeconds: 10,
        timestamp: new Date().toISOString(),
      }),
      checkReadiness: async () => ({
        status: "not_ready",
        ready: false,
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            ready: false,
          },
        },
      }),
    };

    const app = express();
    app.use("/api/v1/health", createHealthRouter({ healthService }));

    const response = await request(app).get("/api/v1/health/readiness");
    expect(response.status).toBe(503);
    expect(response.body.ready).toBe(false);
  });
});
