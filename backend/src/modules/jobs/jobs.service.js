const { randomUUID } = require("node:crypto");

const JOB_TYPES = {
  NOTIFICATION_DISPATCH: "notification.dispatch",
  PAYMENT_WEBHOOK_APPLY: "payment.webhook.apply",
  PAYMENT_RECONCILE_PENDING: "payment.reconcile.pending",
};

function toJob(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    payload: row.payload ?? {},
    dedupeKey: row.dedupe_key,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAt: row.run_at,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    completedAt: row.completed_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function backoffSeconds(attemptNumber) {
  // 30s, 60s, 120s ... capped at 1 hour.
  return Math.min(30 * 2 ** Math.max(0, attemptNumber - 1), 3600);
}

function createJobsService({ jobsRepository, auditService }) {
  const handlers = new Map();

  function registerHandler(jobType, handler) {
    handlers.set(jobType, handler);
  }

  async function enqueue({ type, payload, dedupeKey, maxAttempts, runAt }) {
    const { job, enqueued } = await jobsRepository.enqueueJob({
      type,
      payload,
      dedupeKey,
      maxAttempts,
      runAt,
    });
    return {
      job: toJob(job),
      enqueued,
    };
  }

  async function processDueJobs({
    workerId = `worker-${randomUUID().slice(0, 8)}`,
    limit = 20,
    requestId = null,
  } = {}) {
    const claimedRows = await jobsRepository.claimDueJobs({
      workerId,
      limit,
    });
    const claimed = claimedRows.map(toJob);

    const results = [];
    for (const job of claimed) {
      const handler = handlers.get(job.type);
      if (!handler) {
        const failed = await jobsRepository.markFailed({
          jobId: job.id,
          errorMessage: `No job handler registered for type "${job.type}".`,
          retryRunAt: null,
          dead: true,
        });
        results.push({
          job: toJob(failed),
          outcome: "dead",
        });
        continue;
      }

      try {
        await handler(job);
        const completed = await jobsRepository.markCompleted(job.id);
        results.push({
          job: toJob(completed),
          outcome: "completed",
        });

        if (auditService) {
          await auditService.logEvent({
            entityType: "operation_job",
            entityId: job.id,
            action: "job.completed",
            level: "info",
            requestId,
            metadata: {
              workerId,
              jobType: job.type,
              attempts: job.attempts,
            },
          });
        }
      } catch (error) {
        const dead = job.attempts >= job.maxAttempts;
        const retryAt = dead
          ? null
          : new Date(Date.now() + backoffSeconds(job.attempts) * 1000).toISOString();
        const failed = await jobsRepository.markFailed({
          jobId: job.id,
          errorMessage: error.message ?? "Job processing failed.",
          retryRunAt: retryAt,
          dead,
        });
        results.push({
          job: toJob(failed),
          outcome: dead ? "dead" : "retry_scheduled",
        });

        if (auditService) {
          await auditService.logEvent({
            entityType: "operation_job",
            entityId: job.id,
            action: dead ? "job.dead" : "job.retry",
            level: dead ? "error" : "warn",
            requestId,
            metadata: {
              workerId,
              jobType: job.type,
              attempts: job.attempts,
              maxAttempts: job.maxAttempts,
              error: error.message ?? "Unknown error",
              retryAt,
            },
          });
        }
      }
    }

    return {
      workerId,
      claimedCount: claimed.length,
      processedCount: results.length,
      results,
    };
  }

  async function listJobs(query) {
    const rows = await jobsRepository.listJobs(query);
    return rows.map(toJob);
  }

  return {
    registerHandler,
    enqueue,
    processDueJobs,
    listJobs,
  };
}

module.exports = {
  createJobsService,
  JOB_TYPES,
};
