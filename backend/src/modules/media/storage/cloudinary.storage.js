const { createHash } = require("node:crypto");
const { HttpError } = require("../../../utils/httpError");

function signCloudinaryParams(params, apiSecret) {
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1")
    .update(`${toSign}${apiSecret}`)
    .digest("hex");
}

function createCloudinaryStorageAdapter({ env }) {
  async function createUploadTarget({ key, mediaType }) {
    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET
    ) {
      throw new HttpError(
        500,
        "Cloudinary storage requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      );
    }

    const resourceType = mediaType === "video" ? "video" : "image";
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "botchbuild/project-updates";
    const publicId = key.replace(/\.[^.]+$/, "");
    const signature = signCloudinaryParams(
      {
        folder,
        public_id: publicId,
        timestamp,
      },
      env.CLOUDINARY_API_SECRET,
    );

    return {
      provider: "cloudinary",
      key,
      upload: {
        method: "POST",
        url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
        fields: {
          api_key: env.CLOUDINARY_API_KEY,
          timestamp: String(timestamp),
          signature,
          folder,
          public_id: publicId,
        },
      },
      publicUrl: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${folder}/${publicId}`,
      expiresInSeconds: 900,
    };
  }

  return {
    createUploadTarget,
  };
}

module.exports = {
  createCloudinaryStorageAdapter,
};
