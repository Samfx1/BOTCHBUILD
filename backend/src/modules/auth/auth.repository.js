class PostgresAuthRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async createUser({ fullName, email, passwordHash, role = "investor" }) {
    const query = `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, role, is_two_factor_enabled, created_at, updated_at;
    `;
    const values = [fullName, email, passwordHash, role];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findUserByEmail(email) {
    const query = `
      SELECT id, full_name, email, role, password_hash, is_two_factor_enabled, created_at, updated_at
      FROM users
      WHERE email = $1;
    `;
    const result = await this.pool.query(query, [email]);
    return result.rows[0] ?? null;
  }

  async findUserById(userId) {
    const query = `
      SELECT id, full_name, email, role, password_hash, is_two_factor_enabled, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows[0] ?? null;
  }

  async upsertTwoFactorSecret({ userId, secret }) {
    const query = `
      INSERT INTO two_factor_secrets (user_id, secret, is_verified)
      VALUES ($1, $2, FALSE)
      ON CONFLICT (user_id) DO UPDATE
      SET secret = EXCLUDED.secret, is_verified = FALSE, updated_at = NOW()
      RETURNING id, user_id, secret, is_verified;
    `;
    const result = await this.pool.query(query, [userId, secret]);
    return result.rows[0];
  }

  async getTwoFactorSecretByUserId(userId) {
    const query = `
      SELECT id, user_id, secret, is_verified
      FROM two_factor_secrets
      WHERE user_id = $1;
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows[0] ?? null;
  }

  async markTwoFactorVerified(userId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          UPDATE two_factor_secrets
          SET is_verified = TRUE, updated_at = NOW()
          WHERE user_id = $1;
        `,
        [userId],
      );
      await client.query(
        `
          UPDATE users
          SET is_two_factor_enabled = TRUE, updated_at = NOW()
          WHERE id = $1;
        `,
        [userId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = {
  PostgresAuthRepository,
};
