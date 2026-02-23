const { HttpError } = require("../../utils/httpError");
const { signAccessToken, signTwoFactorToken, verifyTwoFactorToken } = require("../../utils/jwt");
const { comparePassword, hashPassword } = require("../../utils/password");
const { generateTwoFactorSetup, verifyTotpToken } = require("../../utils/twoFactor");

function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    isTwoFactorEnabled: user.is_two_factor_enabled,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function createAuthService({ authRepository }) {
  async function register(input) {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw new HttpError(409, "Account with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);
    const created = await authRepository.createUser({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
    });

    return {
      user: sanitizeUser(created),
      accessToken: signAccessToken(created),
    };
  }

  async function login(input) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      throw new HttpError(401, "Invalid email or password.");
    }

    const isValidPassword = await comparePassword(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new HttpError(401, "Invalid email or password.");
    }

    if (user.is_two_factor_enabled) {
      return {
        requiresTwoFactor: true,
        tempToken: signTwoFactorToken(user.id),
      };
    }

    return {
      requiresTwoFactor: false,
      accessToken: signAccessToken(user),
      user: sanitizeUser(user),
    };
  }

  async function setupTwoFactor({ userId, email }) {
    const setup = await generateTwoFactorSetup(email);
    await authRepository.upsertTwoFactorSecret({
      userId,
      secret: setup.secret,
    });

    return {
      qrCodeDataUrl: setup.qrCodeDataUrl,
      manualEntryKey: setup.manualEntryKey,
    };
  }

  async function verifyTwoFactorSetup({ userId, token }) {
    const twoFactor = await authRepository.getTwoFactorSecretByUserId(userId);
    if (!twoFactor) {
      throw new HttpError(
        400,
        "Two-factor setup not initialized. Request /2fa/setup first.",
      );
    }

    const valid = verifyTotpToken(twoFactor.secret, token);
    if (!valid) {
      throw new HttpError(401, "Invalid two-factor token.");
    }

    await authRepository.markTwoFactorVerified(userId);
    return { twoFactorEnabled: true };
  }

  async function verifyTwoFactorLogin({ tempToken, token }) {
    let payload;
    try {
      payload = verifyTwoFactorToken(tempToken);
    } catch (_error) {
      throw new HttpError(401, "Invalid or expired temporary two-factor token.");
    }

    const user = await authRepository.findUserById(payload.sub);
    if (!user || !user.is_two_factor_enabled) {
      throw new HttpError(401, "Two-factor authentication is not enabled for this user.");
    }

    const twoFactor = await authRepository.getTwoFactorSecretByUserId(user.id);
    if (!twoFactor || !twoFactor.is_verified) {
      throw new HttpError(401, "Two-factor setup is not fully verified.");
    }

    const valid = verifyTotpToken(twoFactor.secret, token);
    if (!valid) {
      throw new HttpError(401, "Invalid two-factor token.");
    }

    return {
      accessToken: signAccessToken(user),
      user: sanitizeUser(user),
    };
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
  createAuthService,
};
