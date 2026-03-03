const { Router } = require("express");
const { authorizeRoles } = require("../../middleware/authorize");
const { authenticateRequest } = require("../../middleware/authenticate");
const { writeActionLimiter } = require("../../middleware/rateLimiters");
const { asyncHandler } = require("../../utils/asyncHandler");
const { createProjectsController } = require("./projects.controller");

function createProjectsRouter({ projectsService }) {
  const router = Router();
  const controller = createProjectsController({ projectsService });

  router.get("/", asyncHandler(controller.listProjects));
  router.get("/:projectId", asyncHandler(controller.getProjectById));
  router.get("/:projectId/updates", asyncHandler(controller.listProjectUpdates));

  router.post(
    "/",
    writeActionLimiter,
    authenticateRequest,
    authorizeRoles(["developer", "admin"]),
    asyncHandler(controller.createProject),
  );
  router.post(
    "/:projectId/updates",
    writeActionLimiter,
    authenticateRequest,
    asyncHandler(controller.createProjectUpdate),
  );

  return router;
}

module.exports = {
  createProjectsRouter,
};
