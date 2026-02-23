const { Router } = require("express");
const { authenticateRequest } = require("../../middleware/authenticate");
const { authorizeRoles } = require("../../middleware/authorize");
const { asyncHandler } = require("../../utils/asyncHandler");
const { createOpsController } = require("./ops.controller");

function createOpsRouter({ jobsService, auditService }) {
  const router = Router();
  const controller = createOpsController({
    jobsService,
    auditService,
  });

  router.use(authenticateRequest, authorizeRoles(["admin"]));

  router.get("/jobs", asyncHandler(controller.listJobs));
  router.post("/jobs/process", asyncHandler(controller.processJobs));
  router.get("/audit", asyncHandler(controller.listAuditEvents));
  router.post(
    "/reconciliation/payments",
    asyncHandler(controller.enqueueReconciliation),
  );

  return router;
}

module.exports = {
  createOpsRouter,
};
