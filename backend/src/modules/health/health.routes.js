const { Router } = require("express");

function createHealthRouter({ healthService }) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const result = await healthService.checkLiveness();
    res.status(200).json(result);
  });

  router.get("/liveness", async (_req, res) => {
    const result = await healthService.checkLiveness();
    res.status(200).json(result);
  });

  router.get("/readiness", async (_req, res) => {
    const readiness = await healthService.checkReadiness();
    const statusCode = readiness.ready ? 200 : 503;
    res.status(statusCode).json(readiness);
  });

  return router;
}

module.exports = {
  createHealthRouter,
};
