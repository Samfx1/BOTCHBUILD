const { Router } = require("express");
const { authenticateRequest } = require("../../middleware/authenticate");
const { authorizeRoles } = require("../../middleware/authorize");
const { asyncHandler } = require("../../utils/asyncHandler");
const { createMediaController } = require("./media.controller");

function createMediaRouter({ mediaService }) {
  const router = Router();
  const controller = createMediaController({ mediaService });

  router.post(
    "/upload-target",
    authenticateRequest,
    authorizeRoles(["developer", "admin"]),
    asyncHandler(controller.createUploadTarget),
  );

  return router;
}

module.exports = {
  createMediaRouter,
};
