const {
  loginSchema,
  registerSchema,
  verifyLogin2FASchema,
  verifyTokenSchema,
} = require("./auth.validation");

function createAuthController({ authService }) {
  async function register(req, res) {
    const payload = registerSchema.parse(req.body);
    const result = await authService.register(payload);
    return res.status(201).json(result);
  }

  async function login(req, res) {
    const payload = loginSchema.parse(req.body);
    const result = await authService.login(payload);
    return res.status(200).json(result);
  }

  async function setupTwoFactor(req, res) {
    const result = await authService.setupTwoFactor({
      userId: req.auth.sub,
      email: req.auth.email,
    });
    return res.status(200).json(result);
  }

  async function verifyTwoFactorSetup(req, res) {
    const payload = verifyTokenSchema.parse(req.body);
    const result = await authService.verifyTwoFactorSetup({
      userId: req.auth.sub,
      token: payload.token,
    });
    return res.status(200).json(result);
  }

  async function verifyTwoFactorLogin(req, res) {
    const payload = verifyLogin2FASchema.parse(req.body);
    const result = await authService.verifyTwoFactorLogin(payload);
    return res.status(200).json(result);
  }

  return {
    register,
    login,
    setupTwoFactor,
    verifyTwoFactorSetup,
    verifyTwoFactorLogin,
  };
}

module.exports = {
  createAuthController,
};
