const express = require("express");
const request = require("supertest");
const { responseBudget } = require("../src/middleware/responseBudget");

describe("responseBudget middleware", () => {
  test("adds response budget headers", async () => {
    const app = express();
    app.use(responseBudget);
    app.get("/payload", (_req, res) => {
      res.json({
        ok: true,
        value: "sample",
      });
    });

    const response = await request(app).get("/payload");
    expect(response.status).toBe(200);
    expect(response.headers["x-response-bytes"]).toBeDefined();
    expect(response.headers["x-response-budget"]).toBeDefined();
    expect(response.headers["x-response-budget-exceeded"]).toBeDefined();
  });
});
