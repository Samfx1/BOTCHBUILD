const Stripe = require("stripe");
const { HttpError } = require("../../../utils/httpError");

function hasStripeApiKey(secretKey) {
  return /^sk_(test|live)_/.test(secretKey);
}

function toStripeMetadata(input) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, String(value)]),
  );
}

function createStripeGateway({ env }) {
  const stripeClient = hasStripeApiKey(env.STRIPE_SECRET_KEY)
    ? new Stripe(env.STRIPE_SECRET_KEY)
    : null;

  async function initializeCheckout({
    amount,
    currency,
    customerEmail,
    providerReference,
    metadata = {},
  }) {
    if (!stripeClient) {
      return {
        checkoutUrl: `${env.FRONTEND_URL}/payments/checkout/${providerReference}`,
        externalReference: providerReference,
        metadata: {
          providerMode: "mock",
          reason: "Stripe API key not configured.",
        },
      };
    }

    const unitAmount = Math.round(Number(amount) * 100);
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      throw new HttpError(400, "Invalid amount for Stripe checkout.");
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      client_reference_id: providerReference,
      success_url: `${env.FRONTEND_URL}/payments/checkout/${providerReference}?status=success`,
      cancel_url: `${env.FRONTEND_URL}/payments/checkout/${providerReference}?status=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
              name: "Botch Build real-estate investment",
            },
          },
        },
      ],
      metadata: toStripeMetadata({
        providerReference,
        ...metadata,
      }),
    });

    return {
      checkoutUrl: session.url,
      externalReference: session.id,
      metadata: {
        providerMode: "live",
        stripeSessionId: session.id,
        stripePaymentStatus: session.payment_status,
      },
    };
  }

  function parseWebhookEvent({ rawBody, headers }) {
    if (!stripeClient) {
      throw new HttpError(
        500,
        "Stripe webhook verification requires STRIPE_SECRET_KEY configuration.",
      );
    }
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new HttpError(
        500,
        "Stripe webhook verification requires STRIPE_WEBHOOK_SECRET.",
      );
    }

    const signature = headers["stripe-signature"];
    if (!signature) {
      throw new HttpError(401, "Missing Stripe webhook signature.");
    }

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (_error) {
      throw new HttpError(401, "Invalid Stripe webhook signature.");
    }

    const session = event.data?.object ?? {};
    const providerReference =
      session.client_reference_id ?? session.metadata?.providerReference ?? null;

    if (!providerReference) {
      return null;
    }

    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded" &&
      event.type !== "checkout.session.async_payment_failed" &&
      event.type !== "checkout.session.expired"
    ) {
      return null;
    }

    const status =
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
        ? "succeeded"
        : "failed";

    return {
      providerReference,
      status,
      paidAt: status === "succeeded" ? new Date().toISOString() : null,
      metadata: {
        stripeEventId: event.id,
        stripeEventType: event.type,
        stripeSessionId: session.id ?? null,
        stripePaymentStatus: session.payment_status ?? null,
      },
    };
  }

  return {
    initializeCheckout,
    parseWebhookEvent,
  };
}

module.exports = {
  createStripeGateway,
};
