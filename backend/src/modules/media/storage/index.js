const { HttpError } = require("../../../utils/httpError");
const { createCloudinaryStorageAdapter } = require("./cloudinary.storage");
const { createLocalStorageAdapter } = require("./local.storage");
const { createS3StorageAdapter } = require("./s3.storage");

function createMediaStorageAdapter({ env }) {
  if (env.MEDIA_STORAGE_PROVIDER === "local") {
    return createLocalStorageAdapter({ env });
  }

  if (env.MEDIA_STORAGE_PROVIDER === "s3") {
    return createS3StorageAdapter({ env });
  }

  if (env.MEDIA_STORAGE_PROVIDER === "cloudinary") {
    return createCloudinaryStorageAdapter({ env });
  }

  throw new HttpError(
    500,
    `Unsupported media storage provider: ${env.MEDIA_STORAGE_PROVIDER}`,
  );
}

module.exports = {
  createMediaStorageAdapter,
};
