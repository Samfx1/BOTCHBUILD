class PostgresJobsRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async enqueueJob({
    type,
    payload = {},
    dedupeKey = null,
    maxAttempts = 5,
    runAt = null,
  }) {
    const query = `
      INSERT INTO operation_jobs (
        type,
        status,
        payload,
        dedupe_key,
        max_attempts,
        run_at
      )
      VALUES ($1, 'queued', $2::jsonb, $3, $4, COALESCE($5, NOW()))
      RETURNING
        id,
        type,
        status,
        payload,
        dedupe_key,
        attempts,
        max_attempts,
        run_at,
        locked_at,
        locked_by,
        completed_at,
        last_error,
        created_at,
        updated_at;
    `;

    try {
      const result = await this.pool.query(query, [
        type,
        JSON.stringify(payload ?? {}),
        dedupeKey,
        maxAttempts,
        runAt,
      ]);

      return {
        job: result.rows[0],
        enqueued: true,
      };
    } catch (error) {
      if (error.code !== "23505" || !dedupeKey) {
        throw error;
      }

      const existing = await this.findActiveByDedupeKey(dedupeKey);
      if (existing) {
        return {
          job: existing,
          enqueued: false,
        };
      }

      throw error;
    }
  }

  async findActiveByDedupeKey(dedupeKey) {
    const query = `
      SELECT
        id,
        type,
        status,
        payload,
        dedupe_key,
        attempts,
        max_attempts,
        run_at,
        locked_at,
        locked_by,
        completed_at,
        last_error,
        created_at,
        updated_at
      FROM operation_jobs
      WHERE dedupe_key = $1
        AND status IN ('queued', 'running')
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const result = await this.pool.query(query, [dedupeKey]);
    return result.rows[0] ?? null;
  }

  async claimDueJobs({ workerId, limit }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const query = `
        WITH picked AS (
          SELECT id
          FROM operation_jobs
          WHERE status = 'queued'
            AND run_at <= NOW()
          ORDER BY run_at ASC, created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE operation_jobs j
        SET
          status = 'running',
          locked_at = NOW(),
          locked_by = $2,
          attempts = attempts + 1,
          updated_at = NOW()
        FROM picked
        WHERE j.id = picked.id
        RETURNING
          j.id,
          j.type,
          j.status,
          j.payload,
          j.dedupe_key,
          j.attempts,
          j.max_attempts,
          j.run_at,
          j.locked_at,
          j.locked_by,
          j.completed_at,
          j.last_error,
          j.created_at,
          j.updated_at;
      `;
      const result = await client.query(query, [limit, workerId]);
      await client.query("COMMIT");
      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async markCompleted(jobId) {
    const query = `
      UPDATE operation_jobs
      SET
        status = 'completed',
        completed_at = NOW(),
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        type,
        status,
        payload,
        dedupe_key,
        attempts,
        max_attempts,
        run_at,
        locked_at,
        locked_by,
        completed_at,
        last_error,
        created_at,
        updated_at;
    `;
    const result = await this.pool.query(query, [jobId]);
    return result.rows[0] ?? null;
  }

  async markFailed({ jobId, errorMessage, retryRunAt, dead }) {
    const nextStatus = dead ? "dead" : "queued";
    const query = `
      UPDATE operation_jobs
      SET
        status = $2,
        run_at = COALESCE($3, run_at),
        last_error = $4,
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        type,
        status,
        payload,
        dedupe_key,
        attempts,
        max_attempts,
        run_at,
        locked_at,
        locked_by,
        completed_at,
        last_error,
        created_at,
        updated_at;
    `;

    const result = await this.pool.query(query, [
      jobId,
      nextStatus,
      retryRunAt,
      errorMessage,
    ]);
    return result.rows[0] ?? null;
  }

  async listJobs({ status, limit, offset }) {
    const values = [];
    const filters = [];

    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT
        id,
        type,
        status,
        payload,
        dedupe_key,
        attempts,
        max_attempts,
        run_at,
        locked_at,
        locked_by,
        completed_at,
        last_error,
        created_at,
        updated_at
      FROM operation_jobs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }
}

module.exports = {
  PostgresJobsRepository,
};
