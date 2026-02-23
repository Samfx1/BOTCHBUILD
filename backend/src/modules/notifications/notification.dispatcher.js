const { createEmailProvider } = require("./providers/email.provider");
const { createPushProvider } = require("./providers/push.provider");
const { createSmsProvider } = require("./providers/sms.provider");
const { createWhatsAppProvider } = require("./providers/whatsapp.provider");

function createNotificationDispatcher({ env }) {
  const providers = {
    email: createEmailProvider({ env }),
    sms: createSmsProvider({ env }),
    push: createPushProvider({ env }),
    whatsapp: createWhatsAppProvider({ env }),
  };

  async function send({ channel, recipient, title, body, metadata }) {
    const provider = providers[channel];
    if (!provider) {
      return {
        status: "failed",
        provider: channel,
        error: `No adapter configured for channel "${channel}".`,
      };
    }

    return provider.send({
      recipient,
      title,
      body,
      metadata,
    });
  }

  return {
    send,
  };
}

module.exports = {
  createNotificationDispatcher,
};
