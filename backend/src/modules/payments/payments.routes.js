const { Router } = require("express");
const { z } = require("zod");
const { authenticateRequest } = require("../../middleware/authenticate");
const {
  webhookLimiter,
  writeActionLimiter,
} = require("../../middleware/rateLimiters");
const { asyncHandler } = require("../../utils/asyncHandler");
const { createPaymentsController } = require("./payments.controller");

const providerParamSchema = z.object({
  provider: z.enum(["stripe", "paystack"]),
});

function validateProviderParam(req, _res, next) {
  try {
    providerParamSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
}

function createPaymentsRouter({ paymentsService }) {
  const router = Router();
  const controller = createPaymentsController({ paymentsService });

  router.post(
    "/initialize",
    writeActionLimiter,
    authenticateRequest,
    asyncHandler(controller.initializePayment),
  );
  router.get(
    "/:transactionId",
    authenticateRequest,
    asyncHandler(controller.getTransactionById),
  );
  router.post(
    "/webhook/:provider",
    webhookLimiter,
    validateProviderParam,
    asyncHandler(controller.handleWebhook),
  );

  return router;
}

module.exports = {
  createPaymentsRouter,
};
