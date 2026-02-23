const { randomUUID } = require("node:crypto");

function attachRequestContext(req, res, next) {
  const headerRequestId = req.headers["x-request-id"];
  const requestId =
    typeof headerRequestId === "string" && headerRequestId.trim()
      ? headerRequestId
      : randomUUID();

  req.context = {
    requestId,
    startedAt: Date.now(),
  };

  res.setHeader("x-request-id", requestId);
  next();
}

module.exports = {
  attachRequestContext,
};
