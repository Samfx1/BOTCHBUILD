const { randomUUID } = require("node:crypto");
const { HttpError } = require("../../utils/httpError");
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
}) {
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

  async function handleWebhook({ provider, rawPayload, headers = {} }) {
    const parsedWebhook = paymentsGateway.parseWebhook(provider, {
      rawBody: normalizeRawPayload(rawPayload),
      headers,
    });

    if (!parsedWebhook) {
      return {
        ignored: true,
        reason: "Event not mapped to a payment transaction state change.",
      };
    }

    const transaction = await paymentsRepository.findByProviderReference(
      parsedWebhook.providerReference,
    );
    if (!transaction) {
      throw new HttpError(404, "Payment transaction not found.");
    }

    if (transaction.provider !== provider) {
      throw new HttpError(400, "Provider mismatch for provider reference.");
    }

    const updatedTransaction = await paymentsRepository.updateTransactionStatus({
      transactionId: transaction.id,
      status: parsedWebhook.status,
      metadata: {
        ...parsedWebhook.metadata,
        webhookProvider: provider,
      },
      paidAt:
        parsedWebhook.status === "succeeded"
          ? parsedWebhook.paidAt ?? new Date().toISOString()
          : null,
    });

    const nextInvestmentStatus = investmentStatusFromPaymentStatus(
      parsedWebhook.status,
    );
    await investmentsRepository.updateInvestmentStatus({
      investmentId: transaction.investment_id,
      status: nextInvestmentStatus,
    });

    if (notificationsService) {
      await notificationsService.createSystemNotification({
        recipientUserId: transaction.investor_user_id,
        channel: "email",
        title: "Payment status updated",
        body: `Your payment is now "${parsedWebhook.status}".`,
        metadata: {
          transactionId: transaction.id,
          providerReference: transaction.provider_reference,
          status: parsedWebhook.status,
        },
      });
    }

    return toPaymentTransaction({
      ...updatedTransaction,
      investor_user_id: transaction.investor_user_id,
    });
  }

  return {
    initializePayment,
    getTransactionByIdForActor,
    handleWebhook,
  };
}

module.exports = {
  createPaymentsService,
};
