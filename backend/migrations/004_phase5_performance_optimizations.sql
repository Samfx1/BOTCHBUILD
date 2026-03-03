CREATE INDEX IF NOT EXISTS idx_project_media_updates_project_created_desc
  ON project_media_updates (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_desc
  ON notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_investments_investor_status_created_desc
  ON investments (investor_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operation_jobs_queue_hot_path
  ON operation_jobs (status, run_at, created_at)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_status_created
  ON payment_webhook_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_created
  ON payment_transactions (status, created_at DESC);
