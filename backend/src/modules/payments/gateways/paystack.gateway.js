const { createHmac } = require("node:crypto");
const { HttpError } = require("../../../utils/httpError");

function hasPaystackApiKey(secretKey) {
  return Boolean(secretKey) && !secretKey.includes("dev_secret");
}

function toMinorUnits(amount) {
  const converted = Math.round(Number(amount) * 100);
  if (!Number.isFinite(converted) || converted <= 0) {
    throw new HttpError(400, "Invalid amount for Paystack checkout.");
  }
  return converted;
}

function createPaystackGateway({ env }) {
  async function initializeCheckout({
    amount,
    currency,
    customerEmail,
    providerReference,
    metadata = {},
  }) {
    if (!hasPaystackApiKey(env.PAYSTACK_SECRET_KEY)) {
      return {
        checkoutUrl: `${env.FRONTEND_URL}/payments/checkout/${providerReference}`,
        externalReference: providerReference,
        metadata: {
          providerMode: "mock",
          reason: "Paystack API key not configured.",
        },
      };
    }

    if (!customerEmail) {
      throw new HttpError(
        400,
        "Investor email is required to initialize a Paystack transaction.",
      );
    }

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: customerEmail,
          amount: toMinorUnits(amount),
          currency,
          reference: providerReference,
          callback_url: `${env.FRONTEND_URL}/payments/checkout/${providerReference}`,
          metadata,
        }),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.status !== true) {
      throw new HttpError(
        502,
        payload.message ?? "Paystack transaction initialization failed.",
      );
    }

    return {
      checkoutUrl: payload.data.authorization_url,
      externalReference: payload.data.reference,
      metadata: {
        providerMode: "live",
        paystackAccessCode: payload.data.access_code,
      },
    };
  }

  function parseWebhookEvent({ rawBody, headers }) {
    const signature = headers["x-paystack-signature"];
    if (!signature) {
      throw new HttpError(401, "Missing Paystack webhook signature.");
    }

    const expectedSignature = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      throw new HttpError(401, "Invalid Paystack webhook signature.");
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf-8"));
    } catch (_error) {
      throw new HttpError(400, "Invalid Paystack webhook JSON payload.");
    }

    const providerReference = event?.data?.reference ?? null;
    if (!providerReference) {
      return null;
    }

    let status;
    if (event.event === "charge.success") {
      status = "succeeded";
    } else if (event.event === "charge.failed") {
      status = "failed";
    } else if (event.event === "refund.processed") {
      status = "refunded";
    } else {
      return null;
    }

    return {
      eventKey:
        event?.id ??
        `${event.event}:${providerReference}:${event?.data?.status ?? "unknown"}`,
      eventType: event.event,
      providerReference,
      status,
      paidAt: status === "succeeded" ? event?.data?.paid_at ?? new Date().toISOString() : null,
      metadata: {
        paystackEvent: event.event,
        paystackDataStatus: event?.data?.status ?? null,
      },
    };
  }

  return {
    initializeCheckout,
    parseWebhookEvent,
  };
}

module.exports = {
  createPaystackGateway,
};
