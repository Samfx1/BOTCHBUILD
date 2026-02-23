class PostgresPaymentsRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async createTransaction({
    investmentId,
    provider,
    providerReference,
    amount,
    currency,
    metadata,
    initiatedBy,
    providerCheckoutUrl,
    idempotencyKey,
  }) {
    const query = `
      INSERT INTO payment_transactions (
        investment_id,
        provider,
        provider_reference,
        amount,
        currency,
        status,
        metadata,
        initiated_by,
        provider_checkout_url,
        idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6::jsonb, $7, $8, $9)
      RETURNING
        id,
        investment_id,
        provider,
        provider_reference,
        amount,
        currency,
        status,
        metadata,
        initiated_by,
        provider_checkout_url,
        idempotency_key,
        paid_at,
        created_at,
        updated_at;
    `;
    const result = await this.pool.query(query, [
      investmentId,
      provider,
      providerReference,
      amount,
      currency,
      JSON.stringify(metadata ?? {}),
      initiatedBy,
      providerCheckoutUrl,
      idempotencyKey,
    ]);
    return result.rows[0];
  }

  async findTransactionById(transactionId) {
    const query = `
      SELECT
        pt.id,
        pt.investment_id,
        pt.provider,
        pt.provider_reference,
        pt.amount,
        pt.currency,
        pt.status,
        pt.metadata,
        pt.initiated_by,
        pt.provider_checkout_url,
        pt.idempotency_key,
        pt.paid_at,
        pt.created_at,
        pt.updated_at,
        i.investor_user_id
      FROM payment_transactions pt
      INNER JOIN investments i ON i.id = pt.investment_id
      WHERE pt.id = $1;
    `;
    const result = await this.pool.query(query, [transactionId]);
    return result.rows[0] ?? null;
  }

  async findByProviderReference(providerReference) {
    const query = `
      SELECT
        pt.id,
        pt.investment_id,
        pt.provider,
        pt.provider_reference,
        pt.amount,
        pt.currency,
        pt.status,
        pt.metadata,
        pt.initiated_by,
        pt.provider_checkout_url,
        pt.idempotency_key,
        pt.paid_at,
        pt.created_at,
        pt.updated_at,
        i.investor_user_id
      FROM payment_transactions pt
      INNER JOIN investments i ON i.id = pt.investment_id
      WHERE pt.provider_reference = $1;
    `;
    const result = await this.pool.query(query, [providerReference]);
    return result.rows[0] ?? null;
  }

  async updateTransactionStatus({ transactionId, status, metadata, paidAt }) {
    const query = `
      UPDATE payment_transactions
      SET
        status = $2,
        metadata = payment_transactions.metadata || $3::jsonb,
        paid_at = COALESCE($4, payment_transactions.paid_at),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        investment_id,
        provider,
        provider_reference,
        amount,
        currency,
        status,
        metadata,
        initiated_by,
        provider_checkout_url,
        idempotency_key,
        paid_at,
        created_at,
        updated_at;
    `;
    const result = await this.pool.query(query, [
      transactionId,
      status,
      JSON.stringify(metadata ?? {}),
      paidAt ?? null,
    ]);
    return result.rows[0] ?? null;
  }
}

module.exports = {
  PostgresPaymentsRepository,
};
