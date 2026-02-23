function createLocalStorageAdapter({ env }) {
  async function createUploadTarget({ key }) {
    return {
      provider: "local",
      key,
      upload: null,
      publicUrl: `${env.BACKEND_PUBLIC_URL}/uploads/${key}`,
      expiresInSeconds: 0,
      note:
        "Local mode expects externally hosted media URLs or manual file hosting during development.",
    };
  }

  return {
    createUploadTarget,
  };
}

module.exports = {
  createLocalStorageAdapter,
};
