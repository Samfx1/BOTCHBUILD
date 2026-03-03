const { ZodError } = require("zod");
const { log, serializeError } = require("../utils/logger");

function errorHandler(error, _req, res, _next) {
  const req = _req;
  const requestId = req?.context?.requestId ?? null;

  if (error instanceof ZodError) {
    log("warn", "request.validation.failed", {
      requestId,
      path: req?.originalUrl ?? req?.url ?? null,
      method: req?.method ?? null,
      details: error.flatten(),
    });
    return res.status(400).json({
      error: "ValidationError",
      message: "Request validation failed.",
      details: error.flatten(),
      requestId,
    });
  }

  const statusCode = error.statusCode || 500;
  const level = statusCode >= 500 ? "error" : "warn";
  log(level, "request.failed", {
    requestId,
    statusCode,
    path: req?.originalUrl ?? req?.url ?? null,
    method: req?.method ?? null,
    error: serializeError(error),
  });

  return res.status(statusCode).json({
    error: error.name || "InternalServerError",
    message: error.message || "An unexpected error occurred.",
    ...(error.details ? { details: error.details } : {}),
    requestId,
  });
}

module.exports = {
  errorHandler,
};
