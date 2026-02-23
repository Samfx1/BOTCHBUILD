const { randomUUID } = require("node:crypto");
const { createMediaStorageAdapter } = require("./storage");

function sanitizeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createMediaService({
  env,
  mediaStorageAdapter = createMediaStorageAdapter({ env }),
}) {
  async function createUploadTarget({ actor, input }) {
    const safeFileName = sanitizeFileName(input.fileName);
    const key = [
      "project-updates",
      input.projectId ?? "general",
      `${Date.now()}-${randomUUID().slice(0, 8)}-${safeFileName}`,
    ].join("/");

    const target = await mediaStorageAdapter.createUploadTarget({
      key,
      mediaType: input.mediaType,
      contentType: input.contentType,
      requestedBy: actor.id,
    });

    return {
      ...target,
      requestedBy: actor.id,
      mediaType: input.mediaType,
      contentType: input.contentType,
    };
  }

  return {
    createUploadTarget,
  };
}

module.exports = {
  createMediaService,
};
