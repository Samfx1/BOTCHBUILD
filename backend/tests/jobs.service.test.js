const { createJobsService } = require("../src/modules/jobs/jobs.service");

class InMemoryJobsRepository {
  constructor() {
    this.jobs = new Map();
    this.sequence = 0;
  }

  makeJob(input) {
    this.sequence += 1;
    return {
      id: `job-${this.sequence}`,
      type: input.type,
      status: "queued",
      payload: input.payload ?? {},
      dedupe_key: input.dedupeKey ?? null,
      attempts: 0,
      max_attempts: input.maxAttempts ?? 5,
      run_at: input.runAt ?? new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      completed_at: null,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async enqueueJob(input) {
    const job = this.makeJob(input);
    this.jobs.set(job.id, job);
    return { job, enqueued: true };
  }

  async claimDueJobs({ workerId, limit }) {
    const now = Date.now();
    return Array.from(this.jobs.values())
      .filter((job) => job.status === "queued")
      .filter((job) => new Date(job.run_at).getTime() <= now)
      .slice(0, limit)
      .map((job) => {
        job.status = "running";
        job.locked_by = workerId;
        job.locked_at = new Date().toISOString();
        job.attempts += 1;
        return job;
      });
  }

  async markCompleted(jobId) {
    const job = this.jobs.get(jobId);
    job.status = "completed";
    job.completed_at = new Date().toISOString();
    return job;
  }

  async markFailed({ jobId, errorMessage, retryRunAt, dead }) {
    const job = this.jobs.get(jobId);
    job.status = dead ? "dead" : "queued";
    job.last_error = errorMessage;
    job.run_at = retryRunAt ?? job.run_at;
    job.locked_by = null;
    job.locked_at = null;
    return job;
  }

  async listJobs() {
    return Array.from(this.jobs.values());
  }
}

describe("jobs service", () => {
  test("processes a queued job successfully", async () => {
    const repository = new InMemoryJobsRepository();
    const service = createJobsService({
      jobsRepository: repository,
    });

    let called = 0;
    service.registerHandler("demo.success", async () => {
      called += 1;
    });

    await service.enqueue({
      type: "demo.success",
      payload: { hello: "world" },
      maxAttempts: 2,
    });

    const result = await service.processDueJobs({
      workerId: "test-worker",
      limit: 10,
    });

    expect(result.processedCount).toBe(1);
    expect(called).toBe(1);
    expect(result.results[0].outcome).toBe("completed");
  });

  test("retries and dead-letters failed jobs", async () => {
    const repository = new InMemoryJobsRepository();
    const service = createJobsService({
      jobsRepository: repository,
    });

    service.registerHandler("demo.fail", async () => {
      throw new Error("always failing");
    });

    await service.enqueue({
      type: "demo.fail",
      payload: {},
      maxAttempts: 2,
    });

    const first = await service.processDueJobs({
      workerId: "test-worker",
      limit: 10,
    });
    expect(first.results[0].outcome).toBe("retry_scheduled");

    // Move retry window to now for deterministic second attempt.
    const listed = await repository.listJobs();
    listed[0].run_at = new Date(Date.now() - 1000).toISOString();

    const second = await service.processDueJobs({
      workerId: "test-worker",
      limit: 10,
    });
    expect(second.results[0].outcome).toBe("dead");
  });
});
