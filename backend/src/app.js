const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const { pool } = require("./db");
const { errorHandler } = require("./middleware/errorHandler");
const { PostgresAuthRepository } = require("./modules/auth/auth.repository");
const { createAuthRouter } = require("./modules/auth/auth.routes");
const { createAuthService } = require("./modules/auth/auth.service");
const { createHealthRouter } = require("./modules/health/health.routes");
const { createUserRouter } = require("./modules/user/user.routes");

function createApp(options = {}) {
  const repository =
    options.authRepository ?? new PostgresAuthRepository({ pool });
  const authService = createAuthService({ authRepository: repository });

  const app = express();

  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/", (_req, res) => {
    res.json({
      service: "botchbuild-api",
      status: "ok",
      phase: "phase-1-foundation",
    });
  });

  app.use("/api/v1/health", createHealthRouter());
  app.use("/api/v1/auth", createAuthRouter({ authService }));
  app.use("/api/v1/users", createUserRouter({ authRepository: repository }));

  app.use((_req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: "Requested route does not exist.",
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
