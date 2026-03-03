const os = require("node:os");
const env = require("../config/env");
const { pool } = require("../db");
const { PostgresAuditRepository } = require("../modules/audit/audit.repository");
const { createAuditService } = require("../modules/audit/audit.service");
const { PostgresInvestmentsRepository } = require("../modules/investments/investments.repository");
const { PostgresJobsRepository } = require("../modules/jobs/jobs.repository");
const { createJobsService, JOB_TYPES } = require("../modules/jobs/jobs.service");
const { PostgresNotificationsRepository } = require("../modules/notifications/notifications.repository");
const { createNotificationsService } = require("../modules/notifications/notifications.service");
const { PostgresPaymentsRepository } = require("../modules/payments/payments.repository");
const { createPaymentsService } = require("../modules/payments/payments.service");
const { log, serializeError } = require("../utils/logger");

async function startWorker() {
  const auditRepository = new PostgresAuditRepository({ pool });
  const jobsRepository = new PostgresJobsRepository({ pool });
  const notificationsRepository = new PostgresNotificationsRepository({ pool });
  const paymentsRepository = new PostgresPaymentsRepository({ pool });
  const investmentsRepository = new PostgresInvestmentsRepository({ pool });

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
    enqueueJob: (input) => jobsService.enqueue(input),
    auditService,
  });

  const paymentsService = createPaymentsService({
    env,
    paymentsRepository,
    investmentsRepository,
    notificationsService,
    enqueueJob: (input) => jobsService.enqueue(input),
    auditService,
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

  const workerId = `ops-${os.hostname()}-${process.pid}`;
  let shuttingDown = false;
  let running = false;

  async function processTick() {
    if (running || shuttingDown) {
      return;
    }
    running = true;
    try {
      const result = await jobsService.processDueJobs({
        workerId,
        limit: env.OPS_WORKER_BATCH_SIZE,
      });
      if (result.processedCount > 0) {
        log("info", "ops_worker.tick.processed", {
          workerId,
          processedCount: result.processedCount,
          claimedCount: result.claimedCount,
        });
      }
    } catch (error) {
      log("error", "ops_worker.tick.failed", {
        workerId,
        error: serializeError(error),
      });
    } finally {
      running = false;
    }
  }

  log("info", "ops_worker.started", {
    workerId,
    pollMs: env.OPS_WORKER_POLL_MS,
    batchSize: env.OPS_WORKER_BATCH_SIZE,
  });

  const timer = setInterval(processTick, env.OPS_WORKER_POLL_MS);
  processTick();

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    clearInterval(timer);
    log("info", "ops_worker.shutdown.requested", {
      workerId,
      signal,
    });
    await pool.end();
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startWorker().catch(async (error) => {
  log("error", "ops_worker.startup.failed", {
    error: serializeError(error),
  });
  await pool.end();
  process.exit(1);
});
