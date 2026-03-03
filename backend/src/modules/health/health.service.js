const os = require("node:os");

function createHealthService({ pool, jobsRepository, env }) {
  async function checkLiveness() {
    return {
      status: "ok",
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      hostname: os.hostname(),
    };
  }

  async function checkReadiness() {
    const checks = {
      database: {
        ready: false,
        latencyMs: null,
        error: null,
      },
      queue: {
        ready: true,
        stats: {
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          dead: 0,
        },
        error: null,
      },
    };

    const dbStart = Date.now();
    try {
      await pool.query("SELECT 1");
      checks.database.ready = true;
      checks.database.latencyMs = Date.now() - dbStart;
    } catch (error) {
      checks.database.ready = false;
      checks.database.error = error.message;
    }

    try {
      const stats = await jobsRepository.getQueueStats();
      checks.queue.stats = stats;
      checks.queue.ready = stats.dead <= env.OPS_DEAD_JOB_THRESHOLD;
      if (!checks.queue.ready) {
        checks.queue.error = `Dead jobs threshold exceeded: ${stats.dead} > ${env.OPS_DEAD_JOB_THRESHOLD}`;
      }
    } catch (error) {
      checks.queue.ready = false;
      checks.queue.error = error.message;
    }

    const ready = checks.database.ready && checks.queue.ready;
    return {
      status: ready ? "ready" : "not_ready",
      ready,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  return {
    checkLiveness,
    checkReadiness,
  };
}

module.exports = {
  createHealthService,
};
