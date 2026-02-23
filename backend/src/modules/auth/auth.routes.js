const { Router } = require("express");
const { authenticateRequest } = require("../../middleware/authenticate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { createAuthController } = require("./auth.controller");

function createAuthRouter({ authService }) {
  const router = Router();
  const controller = createAuthController({ authService });

  router.post("/register", asyncHandler(controller.register));
  router.post("/login", asyncHandler(controller.login));
  router.post(
    "/2fa/setup",
    authenticateRequest,
    asyncHandler(controller.setupTwoFactor),
  );
  router.post(
    "/2fa/verify-setup",
    authenticateRequest,
    asyncHandler(controller.verifyTwoFactorSetup),
  );
  router.post(
    "/2fa/verify-login",
    asyncHandler(controller.verifyTwoFactorLogin),
  );

  return router;
}

module.exports = {
  createAuthRouter,
};
