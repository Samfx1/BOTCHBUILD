const { Router } = require("express");
const { authenticateRequest } = require("../../middleware/authenticate");
const { authSensitiveLimiter } = require("../../middleware/rateLimiters");
const { asyncHandler } = require("../../utils/asyncHandler");
const { createAuthController } = require("./auth.controller");

function createAuthRouter({ authService }) {
  const router = Router();
  const controller = createAuthController({ authService });

  router.post("/register", authSensitiveLimiter, asyncHandler(controller.register));
  router.post("/login", authSensitiveLimiter, asyncHandler(controller.login));
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
    authSensitiveLimiter,
    asyncHandler(controller.verifyTwoFactorLogin),
  );

  return router;
}

module.exports = {
  createAuthRouter,
};
