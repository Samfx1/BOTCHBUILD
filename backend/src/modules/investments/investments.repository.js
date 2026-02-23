class PostgresInvestmentsRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async createInvestment({ projectId, investorUserId, amount, currency }) {
    const query = `
      INSERT INTO investments (
        project_id,
        investor_user_id,
        amount,
        currency,
        status
      )
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING
        id,
        project_id,
        investor_user_id,
        amount,
        currency,
        status,
        created_at,
        updated_at;
    `;
    const result = await this.pool.query(query, [
      projectId,
      investorUserId,
      amount,
      currency,
    ]);
    return result.rows[0];
  }

  async listInvestmentsForUser(userId, { status, limit, offset }) {
    const values = [userId];
    const filters = ["i.investor_user_id = $1"];

    if (status) {
      values.push(status);
      filters.push(`i.status = $${values.length}`);
    }

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const query = `
      SELECT
        i.id,
        i.project_id,
        i.investor_user_id,
        i.amount,
        i.currency,
        i.status,
        i.created_at,
        i.updated_at,
        p.title AS project_title,
        p.status AS project_status
      FROM investments i
      INNER JOIN projects p ON p.id = i.project_id
      WHERE ${filters.join(" AND ")}
      ORDER BY i.created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async findInvestmentById(investmentId) {
    const query = `
      SELECT
        i.id,
        i.project_id,
        i.investor_user_id,
        i.amount,
        i.currency,
        i.status,
        i.created_at,
        i.updated_at,
        p.title AS project_title,
        p.owner_user_id AS project_owner_user_id,
        p.status AS project_status
      FROM investments i
      INNER JOIN projects p ON p.id = i.project_id
      WHERE i.id = $1;
    `;
    const result = await this.pool.query(query, [investmentId]);
    return result.rows[0] ?? null;
  }

  async updateInvestmentStatus({ investmentId, status }) {
    const query = `
      UPDATE investments
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        project_id,
        investor_user_id,
        amount,
        currency,
        status,
        created_at,
        updated_at;
    `;
    const result = await this.pool.query(query, [investmentId, status]);
    return result.rows[0] ?? null;
  }

  async listInvestorIdsByProject(projectId) {
    const query = `
      SELECT DISTINCT investor_user_id
      FROM investments
      WHERE project_id = $1;
    `;
    const result = await this.pool.query(query, [projectId]);
    return result.rows.map((row) => row.investor_user_id);
  }
}

module.exports = {
  PostgresInvestmentsRepository,
};
