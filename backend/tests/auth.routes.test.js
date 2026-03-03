const speakeasy = require("speakeasy");
const request = require("supertest");
const { createApp } = require("../src/app");

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
    const id = this.usersByEmail.get(email);
    if (!id) {
      return null;
    }
    return this.users.get(id) ?? null;
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.twoFactor.set(userId, record);
    return record;
  }

  async getTwoFactorSecretByUserId(userId) {
    return this.twoFactor.get(userId) ?? null;
  }

  async markTwoFactorVerified(userId) {
    const record = this.twoFactor.get(userId);
    if (record) {
      record.is_verified = true;
      record.updated_at = new Date().toISOString();
    }
    const user = this.users.get(userId);
    if (user) {
      user.is_two_factor_enabled = true;
      user.updated_at = new Date().toISOString();
    }
  }
}

describe("Auth routes", () => {
  test("register -> setup 2FA -> login -> verify login flow", async () => {
    const repository = new InMemoryAuthRepository();
    const app = createApp({ authRepository: repository });

    const registerResponse = await request(app).post("/api/v1/auth/register").send({
      fullName: "Nana Kwame",
      email: "nana@example.com",
      password: "SecurePass!123",
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.accessToken).toBeTruthy();

    const setupResponse = await request(app)
      .post("/api/v1/auth/2fa/setup")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
      .send();

    expect(setupResponse.status).toBe(200);
    expect(setupResponse.body.manualEntryKey).toBeTruthy();
    expect(setupResponse.body.qrCodeDataUrl).toContain("data:image/png;base64");

    const setupToken = speakeasy.totp({
      secret: setupResponse.body.manualEntryKey,
      encoding: "base32",
    });

    const verifySetupResponse = await request(app)
      .post("/api/v1/auth/2fa/verify-setup")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
      .send({ token: setupToken });

    expect(verifySetupResponse.status).toBe(200);
    expect(verifySetupResponse.body.twoFactorEnabled).toBe(true);

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: "nana@example.com",
      password: "SecurePass!123",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.requiresTwoFactor).toBe(true);
    expect(loginResponse.body.tempToken).toBeTruthy();

    const verifyLoginToken = speakeasy.totp({
      secret: setupResponse.body.manualEntryKey,
      encoding: "base32",
    });

    const verifyLoginResponse = await request(app)
      .post("/api/v1/auth/2fa/verify-login")
      .send({
        tempToken: loginResponse.body.tempToken,
        token: verifyLoginToken,
      });

    expect(verifyLoginResponse.status).toBe(200);
    expect(verifyLoginResponse.body.accessToken).toBeTruthy();

    const meResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${verifyLoginResponse.body.accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.email).toBe("nana@example.com");
    expect(meResponse.body.isTwoFactorEnabled).toBe(true);
  });

  test("login returns 401 for wrong password", async () => {
    const repository = new InMemoryAuthRepository();
    const app = createApp({ authRepository: repository });

    await request(app).post("/api/v1/auth/register").send({
      fullName: "Efua Asamoah",
      email: "efua@example.com",
      password: "SecurePass!123",
    });

    const response = await request(app).post("/api/v1/auth/login").send({
      email: "efua@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
  });
});
