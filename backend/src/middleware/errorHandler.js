const { ZodError } = require("zod");

function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "ValidationError",
      message: "Request validation failed.",
      details: error.flatten(),
    });
  }

  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    error: error.name || "InternalServerError",
    message: error.message || "An unexpected error occurred.",
    ...(error.details ? { details: error.details } : {}),
  });
}

module.exports = {
  errorHandler,
};
