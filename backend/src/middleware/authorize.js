const { HttpError } = require("../utils/httpError");

function authorizeRoles(allowedRoles) {
  return (req, _res, next) => {
    if (!req.auth?.role) {
      return next(new HttpError(401, "Authentication context is missing."));
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return next(
        new HttpError(
          403,
          `Access denied. Required role: ${allowedRoles.join(" or ")}.`,
        ),
      );
    }

    return next();
  };
}

module.exports = {
  authorizeRoles,
};
