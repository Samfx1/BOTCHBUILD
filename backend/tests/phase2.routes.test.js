const { createHmac, randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../src/app");

class InMemoryAuthRepository {
  constructor() {
    this.users = new Map();
    this.usersByEmail = new Map();
    this.twoFactor = new Map();
  }

  async createUser({ fullName, email, passwordHash, role = "investor" }) {
    const now = new Date().toISOString();
    const created = {
      id: randomUUID(),
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
      id: randomUUID(),
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
    const secret = this.twoFactor.get(userId);
    if (secret) {
      secret.is_verified = true;
    }
    const user = this.users.get(userId);
    if (user) {
      user.is_two_factor_enabled = true;
      user.updated_at = new Date().toISOString();
    }
  }
}

class InMemoryProjectsRepository {
  constructor() {
    this.projects = new Map();
    this.updates = [];
  }

  async listProjects({ status, limit, offset }) {
    const list = Array.from(this.projects.values())
      .filter((project) => (status ? project.status === status : true))
      .slice(offset, offset + limit);
    return list;
  }

  async findProjectById(projectId) {
    return this.projects.get(projectId) ?? null;
  }

  async createProject({
    ownerUserId,
    title,
    description,
    location,
    totalBudget,
    targetCompletionDate,
    status,
  }) {
    const now = new Date().toISOString();
    const created = {
      id: randomUUID(),
      owner_user_id: ownerUserId,
      owner_name: "Developer User",
      title,
      description,
      location,
      total_budget: String(totalBudget),
      funded_amount: "0",
      target_completion_date: targetCompletionDate ?? null,
      status,
      created_at: now,
      updated_at: now,
    };
    this.projects.set(created.id, created);
    return created;
  }

  async createProjectUpdate({
    projectId,
    uploadedBy,
    mediaType,
    mediaUrl,
    caption,
    capturedAt,
  }) {
    const created = {
      id: randomUUID(),
      project_id: projectId,
      uploaded_by: uploadedBy,
      media_type: mediaType,
      media_url: mediaUrl,
      caption: caption ?? null,
      captured_at: capturedAt ?? null,
      created_at: new Date().toISOString(),
    };
    this.updates.push(created);
    return created;
  }

  async listProjectUpdates(projectId, { limit }) {
    return this.updates
      .filter((update) => update.project_id === projectId)
      .slice(0, limit)
      .map((update) => ({ ...update, uploaded_by_name: "Developer User" }));
  }
}

class InMemoryInvestmentsRepository {
  constructor() {
    this.investments = new Map();
  }

  async createInvestment({ projectId, investorUserId, amount, currency }) {
    const now = new Date().toISOString();
    const created = {
      id: randomUUID(),
      project_id: projectId,
      investor_user_id: investorUserId,
      investor_email: "investor@example.com",
      amount: String(amount),
      currency,
      status: "pending",
      created_at: now,
      updated_at: now,
    };
    this.investments.set(created.id, created);
    return created;
  }

  async listInvestmentsForUser(userId, { status, limit, offset }) {
    const list = Array.from(this.investments.values())
      .filter((investment) => investment.investor_user_id === userId)
      .filter((investment) => (status ? investment.status === status : true))
      .slice(offset, offset + limit)
      .map((investment) => ({
        ...investment,
        project_title: "Airport Hills Residential Phase A",
        project_status: "in_progress",
      }));

    return list;
  }

  async findInvestmentById(investmentId) {
    const investment = this.investments.get(investmentId);
    if (!investment) {
      return null;
    }
    return {
      ...investment,
      investor_email: investment.investor_email,
      project_title: "Airport Hills Residential Phase A",
      project_owner_user_id: randomUUID(),
      project_status: "in_progress",
    };
  }

  async updateInvestmentStatus({ investmentId, status }) {
    const investment = this.investments.get(investmentId);
    if (!investment) {
      return null;
    }
    const updated = {
      ...investment,
      status,
      updated_at: new Date().toISOString(),
    };
    this.investments.set(investmentId, updated);
    return updated;
  }

  async listInvestorIdsByProject(projectId) {
    const ids = Array.from(this.investments.values())
      .filter((investment) => investment.project_id === projectId)
      .map((investment) => investment.investor_user_id);
    return Array.from(new Set(ids));
  }
}

class InMemoryPaymentsRepository {
  constructor() {
    this.transactions = new Map();
  }

  async createTransaction({
    investmentId,
    provider,
    providerReference,
    amount,
    currency,
    metadata,
    initiatedBy,
    providerCheckoutUrl,
    idempotencyKey,
  }) {
    const now = new Date().toISOString();
    const created = {
      id: randomUUID(),
      investment_id: investmentId,
      investor_user_id: initiatedBy,
      provider,
      provider_reference: providerReference,
      amount: String(amount),
      currency,
      status: "pending",
      metadata,
      initiated_by: initiatedBy,
      provider_checkout_url: providerCheckoutUrl,
      idempotency_key: idempotencyKey,
      paid_at: null,
      created_at: now,
      updated_at: now,
    };
    this.transactions.set(created.id, created);
    return created;
  }

  async findTransactionById(transactionId) {
    return this.transactions.get(transactionId) ?? null;
  }

  async findByProviderReference(providerReference) {
    return (
      Array.from(this.transactions.values()).find(
        (transaction) => transaction.provider_reference === providerReference,
      ) ?? null
    );
  }

  async updateTransactionStatus({ transactionId, status, metadata, paidAt }) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return null;
    }
    const updated = {
      ...transaction,
      status,
      metadata: {
        ...transaction.metadata,
        ...metadata,
      },
      paid_at: paidAt ?? transaction.paid_at,
      updated_at: new Date().toISOString(),
    };
    this.transactions.set(transactionId, updated);
    return updated;
  }
}

class InMemoryNotificationsRepository {
  constructor({ authRepository }) {
    this.notifications = [];
    this.preferences = new Map();
    this.authRepository = authRepository;
  }

  async listForUser(userId, { limit, offset }) {
    return this.notifications
      .filter((notification) => notification.recipient_user_id === userId)
      .slice(offset, offset + limit);
  }

  async createNotification({
    recipientUserId,
    channel,
    title,
    body,
    status = "queued",
    metadata = {},
  }) {
    const created = {
      id: randomUUID(),
      recipient_user_id: recipientUserId,
      channel,
      title,
      body,
      status,
      metadata,
      scheduled_at: null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    };
    this.notifications.unshift(created);
    return created;
  }

  async getPreferencesByUserId(userId) {
    return this.preferences.get(userId) ?? null;
  }

  async upsertPreferences({
    userId,
    emailEnabled,
    smsEnabled,
    pushEnabled,
    whatsappEnabled,
  }) {
    const now = new Date().toISOString();
    const existing = this.preferences.get(userId);
    const updated = {
      id: existing?.id ?? randomUUID(),
      user_id: userId,
      email_enabled: emailEnabled,
      sms_enabled: smsEnabled,
      push_enabled: pushEnabled,
      whatsapp_enabled: whatsappEnabled,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    this.preferences.set(userId, updated);
    return updated;
  }

  async findRecipientContact(userId) {
    const user = this.authRepository.users.get(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone_number: "+233200000000",
    };
  }
}

describe("Phase 2 core routes", () => {
  test("project -> investment -> payment -> update -> notifications flow", async () => {
    const authRepository = new InMemoryAuthRepository();
    const projectsRepository = new InMemoryProjectsRepository();
    const investmentsRepository = new InMemoryInvestmentsRepository();
    const paymentsRepository = new InMemoryPaymentsRepository();
    const notificationsRepository = new InMemoryNotificationsRepository({
      authRepository,
    });

    const app = createApp({
      authRepository,
      projectsRepository,
      investmentsRepository,
      paymentsRepository,
      notificationsRepository,
    });

    const developerRegister = await request(app).post("/api/v1/auth/register").send({
      fullName: "Developer User",
      role: "developer",
      email: "dev@example.com",
      password: "SecurePass!123",
    });
    expect(developerRegister.status).toBe(201);

    const investorRegister = await request(app).post("/api/v1/auth/register").send({
      fullName: "Investor User",
      role: "investor",
      email: "investor@example.com",
      password: "SecurePass!123",
    });
    expect(investorRegister.status).toBe(201);

    const createProject = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${developerRegister.body.accessToken}`)
      .send({
        title: "Airport Hills Residential Phase A",
        description:
          "A premium gated residential development targeting diaspora-backed remote investors.",
        location: "Accra, Ghana",
        totalBudget: 600000,
        status: "in_progress",
      });
    expect(createProject.status).toBe(201);

    const listProjects = await request(app).get("/api/v1/projects");
    expect(listProjects.status).toBe(200);
    expect(listProjects.body.projects.length).toBe(1);

    const createInvestment = await request(app)
      .post("/api/v1/investments")
      .set("Authorization", `Bearer ${investorRegister.body.accessToken}`)
      .send({
        projectId: createProject.body.id,
        amount: 12000,
        currency: "USD",
      });
    expect(createInvestment.status).toBe(201);

    const initializePayment = await request(app)
      .post("/api/v1/payments/initialize")
      .set("Authorization", `Bearer ${investorRegister.body.accessToken}`)
      .send({
        investmentId: createInvestment.body.id,
        provider: "paystack",
      });
    expect(initializePayment.status).toBe(201);
    expect(initializePayment.body.providerReference).toContain("paystack_");

    const webhookPayload = JSON.stringify({
      event: "charge.success",
      data: {
        reference: initializePayment.body.providerReference,
        status: "success",
        paid_at: new Date().toISOString(),
      },
    });
    const webhookSignature = createHmac("sha512", "paystack_dev_secret")
      .update(webhookPayload)
      .digest("hex");

    const webhookResult = await request(app)
      .post("/api/v1/payments/webhook/paystack")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", webhookSignature)
      .send(webhookPayload);
    expect(webhookResult.status).toBe(200);
    expect(webhookResult.body.result.status).toBe("succeeded");

    const uploadTarget = await request(app)
      .post("/api/v1/media/upload-target")
      .set("Authorization", `Bearer ${developerRegister.body.accessToken}`)
      .send({
        mediaType: "photo",
        fileName: "update-001.jpg",
        contentType: "image/jpeg",
        projectId: createProject.body.id,
      });
    expect(uploadTarget.status).toBe(201);
    expect(uploadTarget.body.provider).toBe("local");
    expect(uploadTarget.body.publicUrl).toContain("/uploads/");

    const postUpdate = await request(app)
      .post(`/api/v1/projects/${createProject.body.id}/updates`)
      .set("Authorization", `Bearer ${developerRegister.body.accessToken}`)
      .send({
        mediaType: "photo",
        mediaUrl: uploadTarget.body.publicUrl,
        caption: "Concrete works completed for block A.",
      });
    expect(postUpdate.status).toBe(201);

    const listUpdates = await request(app).get(
      `/api/v1/projects/${createProject.body.id}/updates`,
    );
    expect(listUpdates.status).toBe(200);
    expect(listUpdates.body.updates.length).toBe(1);

    const myNotifications = await request(app)
      .get("/api/v1/notifications/me")
      .set("Authorization", `Bearer ${investorRegister.body.accessToken}`);
    expect(myNotifications.status).toBe(200);
    expect(myNotifications.body.notifications.length).toBeGreaterThan(0);

    const updatePreferences = await request(app)
      .put("/api/v1/notifications/preferences")
      .set("Authorization", `Bearer ${investorRegister.body.accessToken}`)
      .send({
        emailEnabled: false,
        smsEnabled: true,
      });
    expect(updatePreferences.status).toBe(200);
    expect(updatePreferences.body.emailEnabled).toBe(false);
    expect(updatePreferences.body.smsEnabled).toBe(true);
  });
});
