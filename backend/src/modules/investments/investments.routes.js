const { Router } = require("express");
const { authorizeRoles } = require("../../middleware/authorize");
const { authenticateRequest } = require("../../middleware/authenticate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { createInvestmentsController } = require("./investments.controller");

function createInvestmentsRouter({ investmentsService }) {
  const router = Router();
  const controller = createInvestmentsController({ investmentsService });

  router.post(
    "/",
    authenticateRequest,
    authorizeRoles(["investor", "admin"]),
    asyncHandler(controller.createInvestment),
  );
  router.get("/me", authenticateRequest, asyncHandler(controller.listMyInvestments));
  router.get(
    "/:investmentId",
    authenticateRequest,
    asyncHandler(controller.getInvestmentById),
  );

  return router;
}

module.exports = {
  createInvestmentsRouter,
};
