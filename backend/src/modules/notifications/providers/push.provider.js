function createPushProvider() {
  async function send({ metadata = {} }) {
    return {
      status: "sent",
      provider: "push",
      providerMessageId: `mock-push-${Date.now()}`,
      metadata: {
        dryRun: true,
        reason: "Push adapter placeholder for Phase 2 integration.",
        ...metadata,
      },
    };
  }

  return {
    send,
  };
}

module.exports = {
  createPushProvider,
};
