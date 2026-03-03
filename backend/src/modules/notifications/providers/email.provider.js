const nodemailer = require("nodemailer");

function createEmailProvider({ env }) {
  const canSendLive =
    Boolean(env.SMTP_HOST) && Boolean(env.SMTP_USER) && Boolean(env.SMTP_PASS);

  const transporter = canSendLive
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      })
    : null;

  async function send({ recipient, title, body, metadata = {} }) {
    if (!recipient?.email) {
      return {
        status: "failed",
        provider: "email",
        error: "Recipient email is missing.",
      };
    }

    if (!transporter) {
      return {
        status: "sent",
        provider: "email",
        providerMessageId: `mock-email-${Date.now()}`,
        metadata: {
          dryRun: true,
          reason: "SMTP configuration missing.",
          ...metadata,
        },
      };
    }

    const mail = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: recipient.email,
      subject: title,
      text: body,
    });

    return {
      status: "sent",
      provider: "email",
      providerMessageId: mail.messageId,
      metadata: {
        smtpResponse: mail.response,
      },
    };
  }

  return {
    send,
  };
}

module.exports = {
  createEmailProvider,
};
