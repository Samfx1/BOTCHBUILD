const { randomUUID } = require("node:crypto");
const { HttpError } = require("../../utils/httpError");

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
    const checkoutUrl = `${env.FRONTEND_URL}/payments/checkout/${providerReference}`;
    const transaction = await paymentsRepository.createTransaction({
      investmentId: investment.id,
      provider: input.provider,
      providerReference,
      amount: Number(investment.amount),
      currency: investment.currency,
      metadata: {
        source: "phase2-initialize",
        provider: input.provider,
      },
      initiatedBy: actor.id,
      providerCheckoutUrl: checkoutUrl,
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

  async function handleWebhook({ provider, webhookSecret, input }) {
    if (webhookSecret !== env.PAYMENT_WEBHOOK_SECRET) {
      throw new HttpError(401, "Invalid webhook secret.");
    }

    const transaction = await paymentsRepository.findByProviderReference(
      input.providerReference,
    );
    if (!transaction) {
      throw new HttpError(404, "Payment transaction not found.");
    }

    if (transaction.provider !== provider) {
      throw new HttpError(400, "Provider mismatch for provider reference.");
    }

    const updatedTransaction = await paymentsRepository.updateTransactionStatus({
      transactionId: transaction.id,
      status: input.status,
      metadata: {
        ...input.metadata,
        webhookProvider: provider,
      },
      paidAt: input.status === "succeeded" ? input.paidAt ?? new Date().toISOString() : null,
    });

    const nextInvestmentStatus = investmentStatusFromPaymentStatus(input.status);
    await investmentsRepository.updateInvestmentStatus({
      investmentId: transaction.investment_id,
      status: nextInvestmentStatus,
    });

    if (notificationsService) {
      await notificationsService.createSystemNotification({
        recipientUserId: transaction.investor_user_id,
        channel: "email",
        title: "Payment status updated",
        body: `Your payment is now "${input.status}".`,
        metadata: {
          transactionId: transaction.id,
          providerReference: transaction.provider_reference,
          status: input.status,
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
