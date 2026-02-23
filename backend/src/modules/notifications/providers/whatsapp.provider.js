function withWhatsAppPrefix(phoneNumber) {
  if (!phoneNumber) {
    return "";
  }
  return phoneNumber.startsWith("whatsapp:")
    ? phoneNumber
    : `whatsapp:${phoneNumber}`;
}

function createWhatsAppProvider({ env }) {
  const hasTwilioConfig =
    Boolean(env.TWILIO_ACCOUNT_SID) &&
    Boolean(env.TWILIO_AUTH_TOKEN) &&
    Boolean(env.TWILIO_WHATSAPP_FROM);

  async function send({ recipient, body, metadata = {} }) {
    if (!recipient?.phoneNumber) {
      return {
        status: "failed",
        provider: "whatsapp",
        error: "Recipient phone number is missing.",
      };
    }

    if (!hasTwilioConfig) {
      return {
        status: "sent",
        provider: "whatsapp",
        providerMessageId: `mock-whatsapp-${Date.now()}`,
        metadata: {
          dryRun: true,
          reason: "Twilio WhatsApp configuration missing.",
          ...metadata,
        },
      };
    }

    const form = new URLSearchParams({
      To: withWhatsAppPrefix(recipient.phoneNumber),
      From: withWhatsAppPrefix(env.TWILIO_WHATSAPP_FROM),
      Body: body,
    });

    const credentials = Buffer.from(
      `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
    ).toString("base64");

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        status: "failed",
        provider: "whatsapp",
        error: payload.message ?? "Twilio WhatsApp send failed.",
      };
    }

    return {
      status: "sent",
      provider: "whatsapp",
      providerMessageId: payload.sid ?? null,
      metadata: {
        twilioStatus: payload.status ?? null,
      },
    };
  }

  return {
    send,
  };
}

module.exports = {
  createWhatsAppProvider,
};
