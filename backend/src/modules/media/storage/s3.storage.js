const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { HttpError } = require("../../../utils/httpError");

function createS3StorageAdapter({ env }) {
  const client = new S3Client({
    region: env.AWS_REGION,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  async function createUploadTarget({ key, contentType }) {
    if (!env.AWS_S3_BUCKET) {
      throw new HttpError(500, "S3 storage requires AWS_S3_BUCKET configuration.");
    }

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const signedUrl = await getSignedUrl(client, command, {
      expiresIn: 900,
    });

    const publicBaseUrl =
      env.AWS_S3_PUBLIC_BASE_URL ??
      `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;

    return {
      provider: "s3",
      key,
      upload: {
        method: "PUT",
        url: signedUrl,
        headers: {
          "Content-Type": contentType,
        },
      },
      publicUrl: `${publicBaseUrl}/${key}`,
      expiresInSeconds: 900,
    };
  }

  return {
    createUploadTarget,
  };
}

module.exports = {
  createS3StorageAdapter,
};
