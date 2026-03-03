const { verifyAccessToken } = require("../utils/jwt");
const { HttpError } = require("../utils/httpError");

function authenticateRequest(req, _res, next) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing bearer token."));
  }

  const token = header.replace("Bearer ", "").trim();

  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    return next();
  } catch (_error) {
    return next(new HttpError(401, "Invalid or expired access token."));
  }
}

module.exports = {
  authenticateRequest,
};
