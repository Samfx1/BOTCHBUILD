const { JOB_TYPES } = require("../jobs/jobs.service");
const {
  enqueueReconcileSchema,
  listAuditQuerySchema,
  listJobsQuerySchema,
  processJobsBodySchema,
} = require("./ops.validation");

function createOpsController({ jobsService, auditService }) {
  async function listJobs(req, res) {
    const query = listJobsQuerySchema.parse(req.query);
    const jobs = await jobsService.listJobs(query);
    return res.status(200).json({ jobs });
  }

  async function processJobs(req, res) {
    const input = processJobsBodySchema.parse(req.body ?? {});
    const result = await jobsService.processDueJobs({
      limit: input.limit,
      workerId: `api-admin-${req.auth.sub.slice(0, 8)}`,
      requestId: req.context?.requestId ?? null,
    });
    return res.status(200).json(result);
  }

  async function listAuditEvents(req, res) {
    const query = listAuditQuerySchema.parse(req.query);
    const events = await auditService.listEvents(query);
    return res.status(200).json({ events });
  }

  async function enqueueReconciliation(req, res) {
    const input = enqueueReconcileSchema.parse(req.body ?? {});
    const enqueued = await jobsService.enqueue({
      type: JOB_TYPES.PAYMENT_RECONCILE_PENDING,
      payload: {
        olderThanMinutes: input.olderThanMinutes,
        limit: input.limit,
      },
      dedupeKey: `reconcile:pending:${input.olderThanMinutes}:${input.limit}`,
      maxAttempts: 3,
    });
    return res.status(202).json({
      enqueued: enqueued.enqueued,
      job: enqueued.job,
    });
  }

  return {
    listJobs,
    processJobs,
    listAuditEvents,
    enqueueReconciliation,
  };
}

module.exports = {
  createOpsController,
};
