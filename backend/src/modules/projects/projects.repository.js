class PostgresProjectsRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async listProjects({ status, limit, offset }) {
    const values = [];
    const conditions = [];

    if (status) {
      values.push(status);
      conditions.push(`p.status = $${values.length}`);
    }

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      SELECT
        p.id,
        p.owner_user_id,
        p.title,
        p.description,
        p.location,
        p.total_budget,
        p.target_completion_date,
        p.status,
        p.created_at,
        p.updated_at,
        u.full_name AS owner_name,
        COALESCE(
          SUM(i.amount) FILTER (WHERE i.status IN ('pending', 'active')),
          0
        ) AS funded_amount
      FROM projects p
      INNER JOIN users u ON u.id = p.owner_user_id
      LEFT JOIN investments i ON i.project_id = p.id
      ${whereClause}
      GROUP BY p.id, u.full_name
      ORDER BY p.created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async findProjectById(projectId) {
    const query = `
      SELECT
        p.id,
        p.owner_user_id,
        p.title,
        p.description,
        p.location,
        p.total_budget,
        p.target_completion_date,
        p.status,
        p.created_at,
        p.updated_at,
        u.full_name AS owner_name,
        COALESCE(
          SUM(i.amount) FILTER (WHERE i.status IN ('pending', 'active')),
          0
        ) AS funded_amount
      FROM projects p
      INNER JOIN users u ON u.id = p.owner_user_id
      LEFT JOIN investments i ON i.project_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, u.full_name;
    `;
    const result = await this.pool.query(query, [projectId]);
    return result.rows[0] ?? null;
  }

  async createProject({
    ownerUserId,
    title,
    description,
    location,
    totalBudget,
    targetCompletionDate,
    status,
  }) {
    const query = `
      INSERT INTO projects (
        owner_user_id,
        title,
        description,
        location,
        total_budget,
        target_completion_date,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        owner_user_id,
        title,
        description,
        location,
        total_budget,
        target_completion_date,
        status,
        created_at,
        updated_at;
    `;
    const values = [
      ownerUserId,
      title,
      description,
      location,
      totalBudget,
      targetCompletionDate ?? null,
      status,
    ];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async createProjectUpdate({
    projectId,
    uploadedBy,
    mediaType,
    mediaUrl,
    caption,
    capturedAt,
  }) {
    const query = `
      INSERT INTO project_media_updates (
        project_id,
        uploaded_by,
        media_type,
        media_url,
        caption,
        captured_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        project_id,
        uploaded_by,
        media_type,
        media_url,
        caption,
        captured_at,
        created_at;
    `;
    const values = [
      projectId,
      uploadedBy,
      mediaType,
      mediaUrl,
      caption ?? null,
      capturedAt ?? null,
    ];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async listProjectUpdates(projectId, { limit }) {
    const query = `
      SELECT
        pmu.id,
        pmu.project_id,
        pmu.uploaded_by,
        pmu.media_type,
        pmu.media_url,
        pmu.caption,
        pmu.captured_at,
        pmu.created_at,
        u.full_name AS uploaded_by_name
      FROM project_media_updates pmu
      INNER JOIN users u ON u.id = pmu.uploaded_by
      WHERE pmu.project_id = $1
      ORDER BY pmu.created_at DESC
      LIMIT $2;
    `;

    const result = await this.pool.query(query, [projectId, limit]);
    return result.rows;
  }
}

module.exports = {
  PostgresProjectsRepository,
};
