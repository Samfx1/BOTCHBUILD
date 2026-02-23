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
const { PostgresInvestmentsRepository } = require("./modules/investments/investments.repository");
const { createInvestmentsRouter } = require("./modules/investments/investments.routes");
const { createInvestmentsService } = require("./modules/investments/investments.service");
const { createMediaRouter } = require("./modules/media/media.routes");
const { createMediaService } = require("./modules/media/media.service");
const { PostgresNotificationsRepository } = require("./modules/notifications/notifications.repository");
const { createNotificationsRouter } = require("./modules/notifications/notifications.routes");
const { createNotificationsService } = require("./modules/notifications/notifications.service");
const { PostgresPaymentsRepository } = require("./modules/payments/payments.repository");
const { createPaymentsRouter } = require("./modules/payments/payments.routes");
const { createPaymentsService } = require("./modules/payments/payments.service");
const { PostgresProjectsRepository } = require("./modules/projects/projects.repository");
const { createProjectsRouter } = require("./modules/projects/projects.routes");
const { createProjectsService } = require("./modules/projects/projects.service");
const { createUserRouter } = require("./modules/user/user.routes");

function createApp(options = {}) {
  const authRepository =
    options.authRepository ?? new PostgresAuthRepository({ pool });
  const projectsRepository =
    options.projectsRepository ?? new PostgresProjectsRepository({ pool });
  const investmentsRepository =
    options.investmentsRepository ?? new PostgresInvestmentsRepository({ pool });
  const paymentsRepository =
    options.paymentsRepository ?? new PostgresPaymentsRepository({ pool });
  const notificationsRepository =
    options.notificationsRepository ?? new PostgresNotificationsRepository({ pool });

  const authService = createAuthService({ authRepository });
  const notificationsService = createNotificationsService({
    notificationsRepository,
    env,
    notificationDispatcher: options.notificationDispatcher,
  });
  const projectsService = createProjectsService({
    projectsRepository,
    investmentsRepository,
    notificationsService,
  });
  const mediaService = createMediaService({
    env,
    mediaStorageAdapter: options.mediaStorageAdapter,
  });
  const investmentsService = createInvestmentsService({
    investmentsRepository,
    projectsRepository,
    notificationsService,
  });
  const paymentsService = createPaymentsService({
    env,
    paymentsRepository,
    investmentsRepository,
    notificationsService,
    paymentsGateway: options.paymentsGateway,
  });

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
  app.use(
    "/api/v1/payments/webhook",
    express.raw({
      type: "application/json",
      limit: "2mb",
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/", (_req, res) => {
    res.json({
      service: "botchbuild-api",
      status: "ok",
      phase: "phase-2-integrations",
    });
  });

  app.use("/api/v1/health", createHealthRouter());
  app.use("/api/v1/auth", createAuthRouter({ authService }));
  app.use("/api/v1/users", createUserRouter({ authRepository }));
  app.use("/api/v1/projects", createProjectsRouter({ projectsService }));
  app.use("/api/v1/media", createMediaRouter({ mediaService }));
  app.use(
    "/api/v1/investments",
    createInvestmentsRouter({ investmentsService }),
  );
  app.use("/api/v1/payments", createPaymentsRouter({ paymentsService }));
  app.use(
    "/api/v1/notifications",
    createNotificationsRouter({ notificationsService }),
  );

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
