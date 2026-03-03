const speakeasy = require("speakeasy");
const { createAuthService } = require("../src/modules/auth/auth.service");
const { verifyAccessToken } = require("../src/utils/jwt");

class InMemoryAuthRepository {
  constructor() {
    this.users = new Map();
    this.usersByEmail = new Map();
    this.twoFactor = new Map();
    this.lastId = 0;
  }

  async createUser({ fullName, email, passwordHash, role = "investor" }) {
    this.lastId += 1;
    const now = new Date().toISOString();
    const created = {
      id: `user-${this.lastId}`,
      full_name: fullName,
      email,
      password_hash: passwordHash,
      role,
      is_two_factor_enabled: false,
      created_at: now,
      updated_at: now,
    };
    this.users.set(created.id, created);
    this.usersByEmail.set(email, created.id);
    return created;
  }

  async findUserByEmail(email) {
    const userId = this.usersByEmail.get(email);
    if (!userId) {
      return null;
    }

    return this.users.get(userId) ?? null;
  }

  async findUserById(userId) {
    return this.users.get(userId) ?? null;
  }

  async upsertTwoFactorSecret({ userId, secret }) {
    const record = {
      id: `2fa-${userId}`,
      user_id: userId,
      secret,
      is_verified: false,
    };
    this.twoFactor.set(userId, record);
    return record;
  }

  async getTwoFactorSecretByUserId(userId) {
    return this.twoFactor.get(userId) ?? null;
  }

  async markTwoFactorVerified(userId) {
    const twoFactor = this.twoFactor.get(userId);
    if (twoFactor) {
      twoFactor.is_verified = true;
    }
    const user = this.users.get(userId);
    if (user) {
      user.is_two_factor_enabled = true;
      user.updated_at = new Date().toISOString();
    }
  }
}

describe("Auth service", () => {
  let repository;
  let authService;

  beforeEach(() => {
    repository = new InMemoryAuthRepository();
    authService = createAuthService({ authRepository: repository });
  });

  test("register creates a user and access token", async () => {
    const result = await authService.register({
      fullName: "Kofi Mensah",
      email: "kofi@example.com",
      password: "SecurePass!123",
    });

    expect(result.user.email).toBe("kofi@example.com");
    expect(result.accessToken).toBeTruthy();

    const tokenPayload = verifyAccessToken(result.accessToken);
    expect(tokenPayload.email).toBe("kofi@example.com");
  });

  test("register rejects duplicate email", async () => {
    await authService.register({
      fullName: "Ama Serwaa",
      email: "ama@example.com",
      password: "SecurePass!123",
    });

    await expect(
      authService.register({
        fullName: "Ama Serwaa",
        email: "ama@example.com",
        password: "SecurePass!123",
      }),
    ).rejects.toThrow("Account with this email already exists.");
  });

  test("login without 2FA returns access token", async () => {
    await authService.register({
      fullName: "Yaw Boateng",
      email: "yaw@example.com",
      password: "SecurePass!123",
    });

    const login = await authService.login({
      email: "yaw@example.com",
      password: "SecurePass!123",
    });

    expect(login.requiresTwoFactor).toBe(false);
    expect(login.accessToken).toBeTruthy();
  });

  test("login with enabled 2FA returns temporary token", async () => {
    const registered = await authService.register({
      fullName: "Abena Osei",
      email: "abena@example.com",
      password: "SecurePass!123",
    });

    const setup = await authService.setupTwoFactor({
      userId: registered.user.id,
      email: registered.user.email,
    });

    const setupToken = speakeasy.totp({
      secret: setup.manualEntryKey,
      encoding: "base32",
    });

    await authService.verifyTwoFactorSetup({
      userId: registered.user.id,
      token: setupToken,
    });

    const login = await authService.login({
      email: "abena@example.com",
      password: "SecurePass!123",
    });

    expect(login.requiresTwoFactor).toBe(true);
    expect(login.tempToken).toBeTruthy();
  });

  test("verifyTwoFactorLogin returns access token", async () => {
    const registered = await authService.register({
      fullName: "Kojo Arthur",
      email: "kojo@example.com",
      password: "SecurePass!123",
    });

    const setup = await authService.setupTwoFactor({
      userId: registered.user.id,
      email: registered.user.email,
    });

    const setupToken = speakeasy.totp({
      secret: setup.manualEntryKey,
      encoding: "base32",
    });

    await authService.verifyTwoFactorSetup({
      userId: registered.user.id,
      token: setupToken,
    });

    const login = await authService.login({
      email: "kojo@example.com",
      password: "SecurePass!123",
    });

    const loginToken = speakeasy.totp({
      secret: setup.manualEntryKey,
      encoding: "base32",
    });

    const verified = await authService.verifyTwoFactorLogin({
      tempToken: login.tempToken,
      token: loginToken,
    });

    expect(verified.accessToken).toBeTruthy();
    expect(verified.user.email).toBe("kojo@example.com");
  });
});
