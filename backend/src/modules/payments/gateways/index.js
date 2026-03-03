const { HttpError } = require("../../../utils/httpError");
const { createPaystackGateway } = require("./paystack.gateway");
const { createStripeGateway } = require("./stripe.gateway");

function createPaymentsGateway({ env }) {
  const stripe = createStripeGateway({ env });
  const paystack = createPaystackGateway({ env });

  function getProviderGateway(provider) {
    if (provider === "stripe") {
      return stripe;
    }
    if (provider === "paystack") {
      return paystack;
    }
    throw new HttpError(400, `Unsupported payment provider: ${provider}`);
  }

  async function initialize(provider, input) {
    const gateway = getProviderGateway(provider);
    return gateway.initializeCheckout(input);
  }

  function parseWebhook(provider, input) {
    const gateway = getProviderGateway(provider);
    return gateway.parseWebhookEvent(input);
  }

  return {
    initialize,
    parseWebhook,
  };
}

module.exports = {
  createPaymentsGateway,
};
