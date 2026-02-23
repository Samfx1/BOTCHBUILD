const { createUploadTargetSchema } = require("./media.validation");

function createMediaController({ mediaService }) {
  async function createUploadTarget(req, res) {
    const input = createUploadTargetSchema.parse(req.body);
    const uploadTarget = await mediaService.createUploadTarget({
      actor: {
        id: req.auth.sub,
        role: req.auth.role,
      },
      input,
    });

    return res.status(201).json(uploadTarget);
  }

  return {
    createUploadTarget,
  };
}

module.exports = {
  createMediaController,
};
