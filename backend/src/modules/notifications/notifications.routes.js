const { Router } = require("express");
const { authenticateRequest } = require("../../middleware/authenticate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { createNotificationsController } = require("./notifications.controller");

function createNotificationsRouter({ notificationsService }) {
  const router = Router();
  const controller = createNotificationsController({ notificationsService });

  router.get("/me", authenticateRequest, asyncHandler(controller.listMine));
  router.get(
    "/preferences",
    authenticateRequest,
    asyncHandler(controller.getPreferences),
  );
  router.put(
    "/preferences",
    authenticateRequest,
    asyncHandler(controller.updatePreferences),
  );
  router.post(
    "/test",
    authenticateRequest,
    asyncHandler(controller.createTestNotification),
  );

  return router;
}

module.exports = {
  createNotificationsRouter,
};
