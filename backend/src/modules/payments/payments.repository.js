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
        i.project_id,
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
        i.project_id,
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

  async appendTransactionMetadata({ transactionId, metadata }) {
    const query = `
      UPDATE payment_transactions
      SET
        metadata = payment_transactions.metadata || $2::jsonb,
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
      JSON.stringify(metadata ?? {}),
    ]);
    return result.rows[0] ?? null;
  }

  async createOrGetWebhookEvent({
    provider,
    eventKey,
    eventType,
    providerReference,
    payloadHash,
    payload,
  }) {
    const insertQuery = `
      INSERT INTO payment_webhook_events (
        provider,
        event_key,
        event_type,
        provider_reference,
        payload_hash,
        payload,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'received')
      ON CONFLICT (provider, event_key) DO NOTHING
      RETURNING
        id,
        provider,
        event_key,
        event_type,
        provider_reference,
        payload_hash,
        payload,
        status,
        error_count,
        last_error,
        processed_at,
        created_at,
        updated_at;
    `;

    const inserted = await this.pool.query(insertQuery, [
      provider,
      eventKey,
      eventType ?? null,
      providerReference ?? null,
      payloadHash,
      JSON.stringify(payload ?? {}),
    ]);

    if (inserted.rows[0]) {
      return {
        event: inserted.rows[0],
        isNew: true,
      };
    }

    const existing = await this.pool.query(
      `
        SELECT
          id,
          provider,
          event_key,
          event_type,
          provider_reference,
          payload_hash,
          payload,
          status,
          error_count,
          last_error,
          processed_at,
          created_at,
          updated_at
        FROM payment_webhook_events
        WHERE provider = $1
          AND event_key = $2
        LIMIT 1;
      `,
      [provider, eventKey],
    );

    return {
      event: existing.rows[0] ?? null,
      isNew: false,
    };
  }

  async findWebhookEventById(eventId) {
    const query = `
      SELECT
        id,
        provider,
        event_key,
        event_type,
        provider_reference,
        payload_hash,
        payload,
        status,
        error_count,
        last_error,
        processed_at,
        created_at,
        updated_at
      FROM payment_webhook_events
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await this.pool.query(query, [eventId]);
    return result.rows[0] ?? null;
  }

  async markWebhookEventProcessed(eventId) {
    const query = `
      UPDATE payment_webhook_events
      SET
        status = 'processed',
        processed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        provider,
        event_key,
        event_type,
        provider_reference,
        payload_hash,
        payload,
        status,
        error_count,
        last_error,
        processed_at,
        created_at,
        updated_at;
    `;
    const result = await this.pool.query(query, [eventId]);
    return result.rows[0] ?? null;
  }

  async markWebhookEventFailed({ eventId, errorMessage }) {
    const query = `
      UPDATE payment_webhook_events
      SET
        status = 'failed',
        error_count = error_count + 1,
        last_error = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        provider,
        event_key,
        event_type,
        provider_reference,
        payload_hash,
        payload,
        status,
        error_count,
        last_error,
        processed_at,
        created_at,
        updated_at;
    `;
    const result = await this.pool.query(query, [eventId, errorMessage]);
    return result.rows[0] ?? null;
  }

  async listPendingTransactionsOlderThan({ olderThanMinutes, limit }) {
    const query = `
      SELECT
        pt.id,
        pt.investment_id,
        i.project_id,
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
      WHERE pt.status = 'pending'
        AND pt.created_at <= NOW() - (($1::text || ' minutes')::interval)
      ORDER BY pt.created_at ASC
      LIMIT $2;
    `;
    const result = await this.pool.query(query, [olderThanMinutes, limit]);
    return result.rows;
  }
}

module.exports = {
  PostgresPaymentsRepository,
};
