const {
  initializePaymentSchema,
  paymentTransactionParamSchema,
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
    const result = await paymentsService.handleWebhook({
      provider: req.params.provider,
      rawPayload: req.body,
      headers: req.headers,
    });
    return res.status(200).json({
      ok: true,
      result,
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
