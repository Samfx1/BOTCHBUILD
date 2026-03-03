const { Router } = require("express");
const { authenticateRequest } = require("../../middleware/authenticate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { HttpError } = require("../../utils/httpError");

function createUserRouter({ authRepository }) {
  const router = Router();

  router.get(
    "/me",
    authenticateRequest,
    asyncHandler(async (req, res) => {
      const user = await authRepository.findUserById(req.auth.sub);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }

      return res.status(200).json({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        isTwoFactorEnabled: user.is_two_factor_enabled,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      });
    }),
  );

  return router;
}

module.exports = {
  createUserRouter,
};
