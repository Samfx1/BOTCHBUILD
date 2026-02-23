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
        // eslint-disable-next-line no-console
        console.log(
          `[ops-worker] processed=${result.processedCount} claimed=${result.claimedCount}`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[ops-worker] processing error:", error);
    } finally {
      running = false;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[ops-worker] started workerId=${workerId} pollMs=${env.OPS_WORKER_POLL_MS} batchSize=${env.OPS_WORKER_BATCH_SIZE}`,
  );

  const timer = setInterval(processTick, env.OPS_WORKER_POLL_MS);
  processTick();

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    clearInterval(timer);
    // eslint-disable-next-line no-console
    console.log(`[ops-worker] received ${signal}, shutting down...`);
    await pool.end();
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startWorker().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("[ops-worker] fatal startup error:", error);
  await pool.end();
  process.exit(1);
});
