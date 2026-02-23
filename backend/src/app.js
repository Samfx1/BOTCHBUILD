const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");
const helmet = require("helmet");

const env = require("./config/env");
const { pool } = require("./db");
const { accessLogger } = require("./middleware/accessLogger");
const { attachRequestContext } = require("./middleware/requestContext");
const { globalLimiter } = require("./middleware/rateLimiters");
const { errorHandler } = require("./middleware/errorHandler");
const { PostgresAuditRepository } = require("./modules/audit/audit.repository");
const { PostgresAuthRepository } = require("./modules/auth/auth.repository");
const { createAuthRouter } = require("./modules/auth/auth.routes");
const { createAuthService } = require("./modules/auth/auth.service");
const { createHealthRouter } = require("./modules/health/health.routes");
const { createHealthService } = require("./modules/health/health.service");
const { PostgresInvestmentsRepository } = require("./modules/investments/investments.repository");
const { createInvestmentsRouter } = require("./modules/investments/investments.routes");
const { createInvestmentsService } = require("./modules/investments/investments.service");
const { PostgresJobsRepository } = require("./modules/jobs/jobs.repository");
const { createJobsService, JOB_TYPES } = require("./modules/jobs/jobs.service");
const { createMediaRouter } = require("./modules/media/media.routes");
const { createMediaService } = require("./modules/media/media.service");
const { PostgresNotificationsRepository } = require("./modules/notifications/notifications.repository");
const { createNotificationsRouter } = require("./modules/notifications/notifications.routes");
const { createNotificationsService } = require("./modules/notifications/notifications.service");
const { createOpsRouter } = require("./modules/ops/ops.routes");
const { PostgresPaymentsRepository } = require("./modules/payments/payments.repository");
const { createPaymentsRouter } = require("./modules/payments/payments.routes");
const { createPaymentsService } = require("./modules/payments/payments.service");
const { PostgresProjectsRepository } = require("./modules/projects/projects.repository");
const { createProjectsRouter } = require("./modules/projects/projects.routes");
const { createProjectsService } = require("./modules/projects/projects.service");
const { createUserRouter } = require("./modules/user/user.routes");
const { createAuditService } = require("./modules/audit/audit.service");

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
  const jobsRepository = options.jobsRepository ?? new PostgresJobsRepository({ pool });
  const auditRepository =
    options.auditRepository ?? new PostgresAuditRepository({ pool });

  const authService = createAuthService({ authRepository });
  const auditService = createAuditService({
    auditRepository,
  });
  const jobsService = createJobsService({
    jobsRepository,
    auditService,
  });
  const notificationsService = createNotificationsService({
    notificationsRepository,
    env,
    notificationDispatcher: options.notificationDispatcher,
    enqueueJob: (input) => jobsService.enqueue(input),
    auditService,
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
    enqueueJob: (input) => jobsService.enqueue(input),
    auditService,
  });
  const healthService =
    options.healthService ??
    createHealthService({
      pool,
      jobsRepository,
      env,
    });

  jobsService.registerHandler(JOB_TYPES.NOTIFICATION_DISPATCH, (job) =>
    notificationsService.processDispatchJob(job),
  );
  jobsService.registerHandler(JOB_TYPES.PAYMENT_WEBHOOK_APPLY, (job) =>
    paymentsService.processWebhookJob(job),
  );
  jobsService.registerHandler(JOB_TYPES.PAYMENT_RECONCILE_PENDING, (job) =>
    paymentsService.processReconciliationJob(job),
  );

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.CORS_ALLOWED_ORIGINS_LIST.includes(origin)) {
          callback(null, true);
          return;
        }
        const error = new Error("Origin is not allowed by CORS policy.");
        error.name = "CorsError";
        error.statusCode = 403;
        callback(error);
      },
      credentials: true,
    }),
  );
  app.use(attachRequestContext);
  app.use(accessLogger);
  app.use(globalLimiter);
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
      phase: "phase-3-operations-hardening",
    });
  });

  app.use("/api/v1/health", createHealthRouter({ healthService }));
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
  app.use(
    "/api/v1/ops",
    createOpsRouter({
      jobsService,
      auditService,
    }),
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
