const { createHash, randomUUID } = require("node:crypto");
const { HttpError } = require("../../utils/httpError");
const { JOB_TYPES } = require("../jobs/jobs.service");
const { createPaymentsGateway } = require("./gateways");

function createProviderReference(provider) {
  const compact = Date.now().toString(36);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  return `${provider}_${compact}_${suffix}`;
}

function toPaymentTransaction(transaction) {
  return {
    id: transaction.id,
    investmentId: transaction.investment_id,
    investorUserId: transaction.investor_user_id,
    provider: transaction.provider,
    providerReference: transaction.provider_reference,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    status: transaction.status,
    metadata: transaction.metadata ?? {},
    initiatedBy: transaction.initiated_by,
    providerCheckoutUrl: transaction.provider_checkout_url,
    idempotencyKey: transaction.idempotency_key,
    paidAt: transaction.paid_at,
    createdAt: transaction.created_at,
    updatedAt: transaction.updated_at,
  };
}

function investmentStatusFromPaymentStatus(paymentStatus) {
  if (paymentStatus === "succeeded") {
    return "active";
  }
  if (paymentStatus === "failed") {
    return "cancelled";
  }
  return "withdrawn";
}

function createPaymentsService({
  env,
  paymentsRepository,
  investmentsRepository,
  notificationsService,
  paymentsGateway = createPaymentsGateway({ env }),
  enqueueJob,
  auditService,
  cacheManager,
}) {
  function invalidateProjectCaches(projectId) {
    cacheManager?.invalidateByPrefix("projects:list:");
    if (projectId) {
      cacheManager?.delete(`projects:detail:${projectId}`);
      cacheManager?.invalidateByPrefix(`projects:updates:${projectId}:`);
    }
  }

  async function initializePayment({ actor, input }) {
    const investment = await investmentsRepository.findInvestmentById(input.investmentId);
    if (!investment) {
      throw new HttpError(404, "Investment not found.");
    }

    const isOwner = investment.investor_user_id === actor.id;
    const isAdmin = actor.role === "admin";
    if (!isOwner && !isAdmin) {
      throw new HttpError(403, "You do not have access to this investment.");
    }

    if (!["pending", "active"].includes(investment.status)) {
      throw new HttpError(
        400,
        `Cannot initialize payment for investment in "${investment.status}" state.`,
      );
    }

    const providerReference = createProviderReference(input.provider);
    const initialized = await paymentsGateway.initialize(input.provider, {
      amount: Number(investment.amount),
      currency: investment.currency,
      customerEmail: investment.investor_email,
      providerReference,
      metadata: {
        investmentId: investment.id,
        projectId: investment.project_id,
      },
    });

    const transaction = await paymentsRepository.createTransaction({
      investmentId: investment.id,
      provider: input.provider,
      providerReference,
      amount: Number(investment.amount),
      currency: investment.currency,
      metadata: {
        source: "phase2-provider-initialize",
        provider: input.provider,
        externalReference: initialized.externalReference,
        ...initialized.metadata,
      },
      initiatedBy: actor.id,
      providerCheckoutUrl: initialized.checkoutUrl,
      idempotencyKey: randomUUID(),
    });

    if (notificationsService) {
      await notificationsService.createSystemNotification({
        recipientUserId: investment.investor_user_id,
        channel: "email",
        title: "Payment session initialized",
        body: `Your ${input.provider} payment session for "${investment.project_title}" is ready.`,
        metadata: {
          investmentId: investment.id,
          transactionId: transaction.id,
          provider: input.provider,
        },
      });
    }

    if (auditService) {
      await auditService.logEvent({
        actorUserId: actor.id,
        entityType: "payment_transaction",
        entityId: transaction.id,
        action: "payment.initialize",
        level: "info",
        metadata: {
          provider: input.provider,
          investmentId: investment.id,
          providerReference,
        },
      });
    }

    return toPaymentTransaction({
      ...transaction,
      investor_user_id: investment.investor_user_id,
    });
  }

  async function getTransactionByIdForActor({ actor, transactionId }) {
    const transaction = await paymentsRepository.findTransactionById(transactionId);
    if (!transaction) {
      throw new HttpError(404, "Payment transaction not found.");
    }

    const isOwner = transaction.investor_user_id === actor.id;
    const isAdmin = actor.role === "admin";
    if (!isOwner && !isAdmin) {
      throw new HttpError(403, "You do not have access to this payment transaction.");
    }

    return toPaymentTransaction(transaction);
  }

  function normalizeRawPayload(rawPayload) {
    if (Buffer.isBuffer(rawPayload)) {
      return rawPayload;
    }
    if (typeof rawPayload === "string") {
      return Buffer.from(rawPayload, "utf-8");
    }
    return Buffer.from(JSON.stringify(rawPayload ?? {}), "utf-8");
  }

  function createWebhookEventKey(provider, parsedWebhook, payloadHash) {
    if (parsedWebhook.eventKey) {
      return parsedWebhook.eventKey;
    }
    return `${provider}:${parsedWebhook.providerReference}:${parsedWebhook.status}:${payloadHash.slice(0, 20)}`;
  }

  async function applyWebhookEvent({
    webhookEventId,
    provider,
    parsedWebhook,
    requestId,
  }) {
    const webhookEvent =
      (webhookEventId && (await paymentsRepository.findWebhookEventById(webhookEventId))) ||
      null;
    const effectiveProvider = provider ?? webhookEvent?.provider;
    const effectivePayload = parsedWebhook ?? webhookEvent?.payload;

    if (!effectiveProvider || !effectivePayload) {
      throw new HttpError(
        400,
        "Webhook processing payload is missing provider or parsed webhook data.",
      );
    }

    const transaction = await paymentsRepository.findByProviderReference(
      effectivePayload.providerReference,
    );
    if (!transaction) {
      if (webhookEvent?.id) {
        await paymentsRepository.markWebhookEventFailed({
          eventId: webhookEvent.id,
          errorMessage: "Payment transaction not found for provider reference.",
        });
      }
      throw new HttpError(404, "Payment transaction not found.");
    }

    if (transaction.provider !== effectiveProvider) {
      if (webhookEvent?.id) {
        await paymentsRepository.markWebhookEventFailed({
          eventId: webhookEvent.id,
          errorMessage: "Provider mismatch for provider reference.",
        });
      }
      throw new HttpError(400, "Provider mismatch for provider reference.");
    }

    let finalTransaction;
    let projectId = transaction.project_id ?? null;
    if (!projectId) {
      const investment = await investmentsRepository.findInvestmentById(
        transaction.investment_id,
      );
      projectId = investment?.project_id ?? null;
    }

    if (transaction.status === effectivePayload.status) {
      finalTransaction = await paymentsRepository.appendTransactionMetadata({
        transactionId: transaction.id,
        metadata: {
          ...effectivePayload.metadata,
          webhookProvider: effectiveProvider,
          webhookProcessedAt: new Date().toISOString(),
          webhookDuplicateStatus: true,
        },
      });
    } else {
      finalTransaction = await paymentsRepository.updateTransactionStatus({
        transactionId: transaction.id,
        status: effectivePayload.status,
        metadata: {
          ...effectivePayload.metadata,
          webhookProvider: effectiveProvider,
        },
        paidAt:
          effectivePayload.status === "succeeded"
            ? effectivePayload.paidAt ?? new Date().toISOString()
            : null,
      });

      const nextInvestmentStatus = investmentStatusFromPaymentStatus(
        effectivePayload.status,
      );
      await investmentsRepository.updateInvestmentStatus({
        investmentId: transaction.investment_id,
        status: nextInvestmentStatus,
      });

      invalidateProjectCaches(projectId);
    }

    if (webhookEvent?.id) {
      await paymentsRepository.markWebhookEventProcessed(webhookEvent.id);
    }

    if (notificationsService) {
      await notificationsService.createSystemNotification({
        recipientUserId: transaction.investor_user_id,
        channel: "email",
        title: "Payment status updated",
        body: `Your payment is now "${effectivePayload.status}".`,
        metadata: {
          transactionId: transaction.id,
          providerReference: transaction.provider_reference,
          status: effectivePayload.status,
        },
      });
    }

    if (auditService) {
      await auditService.logEvent({
        entityType: "payment_webhook_event",
        entityId: webhookEvent?.id ?? null,
        action: "payment.webhook.applied",
        level: "info",
        requestId,
        metadata: {
          provider: effectiveProvider,
          providerReference: effectivePayload.providerReference,
          status: effectivePayload.status,
          transactionId: transaction.id,
        },
      });
    }

    return toPaymentTransaction({
      ...finalTransaction,
      investor_user_id: transaction.investor_user_id,
    });
  }

  async function handleWebhook({ provider, rawPayload, headers = {}, requestId }) {
    const normalizedRaw = normalizeRawPayload(rawPayload);
    const parsedWebhook = paymentsGateway.parseWebhook(provider, {
      rawBody: normalizedRaw,
      headers,
    });

    if (!parsedWebhook) {
      return {
        ignored: true,
        reason: "Event not mapped to a payment transaction state change.",
      };
    }

    const payloadHash = createHash("sha256").update(normalizedRaw).digest("hex");
    const eventKey = createWebhookEventKey(provider, parsedWebhook, payloadHash);
    const webhookEvent = await paymentsRepository.createOrGetWebhookEvent({
      provider,
      eventKey,
      eventType: parsedWebhook.eventType ?? null,
      providerReference: parsedWebhook.providerReference,
      payloadHash,
      payload: parsedWebhook,
    });

    if (!webhookEvent.event) {
      throw new HttpError(500, "Could not persist webhook event.");
    }

    if (!webhookEvent.isNew && webhookEvent.event.status === "processed") {
      return {
        ignored: true,
        duplicate: true,
        webhookEventId: webhookEvent.event.id,
        reason: "Webhook event already processed.",
      };
    }

    if (!enqueueJob) {
      const transaction = await applyWebhookEvent({
        webhookEventId: webhookEvent.event.id,
        provider,
        parsedWebhook,
        requestId,
      });
      return {
        accepted: true,
        processedInline: true,
        transaction,
      };
    }

    const enqueued = await enqueueJob({
      type: JOB_TYPES.PAYMENT_WEBHOOK_APPLY,
      payload: {
        webhookEventId: webhookEvent.event.id,
        provider,
        parsedWebhook,
      },
      dedupeKey: `webhook:${provider}:${eventKey}`,
      maxAttempts: 8,
    });

    if (auditService) {
      await auditService.logEvent({
        entityType: "payment_webhook_event",
        entityId: webhookEvent.event.id,
        action: "payment.webhook.accepted",
        level: "info",
        requestId,
        metadata: {
          provider,
          providerReference: parsedWebhook.providerReference,
          status: parsedWebhook.status,
          enqueued: enqueued.enqueued,
          jobId: enqueued.job.id,
        },
      });
    }

    return {
      accepted: true,
      processedInline: false,
      webhookEventId: webhookEvent.event.id,
      job: enqueued.job,
      enqueued: enqueued.enqueued,
    };
  }

  async function reconcilePendingTransactions({
    olderThanMinutes = 60,
    limit = 100,
    requestId,
  } = {}) {
    const pending = await paymentsRepository.listPendingTransactionsOlderThan({
      olderThanMinutes,
      limit,
    });

    const reconciled = [];
    for (const transaction of pending) {
      const updated = await paymentsRepository.appendTransactionMetadata({
        transactionId: transaction.id,
        metadata: {
          reconciliation: {
            checkedAt: new Date().toISOString(),
            reason: "pending-time-threshold",
            olderThanMinutes,
          },
        },
      });

      reconciled.push(updated.id);
      invalidateProjectCaches(transaction.project_id ?? null);

      if (notificationsService) {
        await notificationsService.createSystemNotification({
          recipientUserId: transaction.investor_user_id,
          channel: "email",
          title: "Payment still pending",
          body: "Your investment payment is still pending. Please confirm payment status in your bank/provider app.",
          metadata: {
            transactionId: transaction.id,
            providerReference: transaction.provider_reference,
            source: "reconciliation",
          },
        });
      }
    }

    if (auditService) {
      await auditService.logEvent({
        entityType: "payment_reconciliation",
        action: "payment.reconcile.pending",
        level: "info",
        requestId,
        metadata: {
          reconciledCount: reconciled.length,
          olderThanMinutes,
          limit,
        },
      });
    }

    return {
      reconciledCount: reconciled.length,
      reconciledTransactionIds: reconciled,
    };
  }

  async function processWebhookJob(job) {
    return applyWebhookEvent({
      webhookEventId: job.payload?.webhookEventId,
      provider: job.payload?.provider,
      parsedWebhook: job.payload?.parsedWebhook,
    });
  }

  async function processReconciliationJob(job) {
    return reconcilePendingTransactions({
      olderThanMinutes: job.payload?.olderThanMinutes ?? 60,
      limit: job.payload?.limit ?? 100,
    });
  }

  async function findTransactionByProviderReference(
    providerReference,
  ) {
    const transaction = await paymentsRepository.findByProviderReference(
      providerReference,
    );
    return transaction
      ? toPaymentTransaction(transaction)
      : null;
  }

  return {
    initializePayment,
    getTransactionByIdForActor,
    handleWebhook,
    processWebhookJob,
    reconcilePendingTransactions,
    processReconciliationJob,
    findTransactionByProviderReference,
  };
}

module.exports = {
  createPaymentsService,
};
