const {
  initializePaymentSchema,
  paymentTransactionParamSchema,
  paymentWebhookSchema,
} = require("./payments.validation");

function createPaymentsController({ paymentsService }) {
  async function initializePayment(req, res) {
    const input = initializePaymentSchema.parse(req.body);
    const transaction = await paymentsService.initializePayment({
      actor: {
        id: req.auth.sub,
        role: req.auth.role,
      },
      input,
    });
    return res.status(201).json(transaction);
  }

  async function getTransactionById(req, res) {
    const params = paymentTransactionParamSchema.parse(req.params);
    const transaction = await paymentsService.getTransactionByIdForActor({
      actor: {
        id: req.auth.sub,
        role: req.auth.role,
      },
      transactionId: params.transactionId,
    });
    return res.status(200).json(transaction);
  }

  async function handleWebhook(req, res) {
    const input = paymentWebhookSchema.parse(req.body);
    const transaction = await paymentsService.handleWebhook({
      provider: req.params.provider,
      webhookSecret: req.headers["x-webhook-secret"],
      input,
    });
    return res.status(200).json({
      ok: true,
      transaction,
    });
  }

  return {
    initializePayment,
    getTransactionById,
    handleWebhook,
  };
}

module.exports = {
  createPaymentsController,
};
