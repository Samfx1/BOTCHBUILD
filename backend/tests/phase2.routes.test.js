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
    return id ? this.users.get(id) ?? null : null;
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
    return Array.from(this.projects.values())
      .filter((project) => (status ? project.status === status : true))
      .slice(offset, offset + limit);
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
      .map((update) => ({
        ...update,
        uploaded_by_name: "Developer User",
      }));
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
    return Array.from(this.investments.values())
      .filter((investment) => investment.investor_user_id === userId)
      .filter((investment) => (status ? investment.status === status : true))
      .slice(offset, offset + limit)
      .map((investment) => ({
        ...investment,
        project_title: "Airport Hills Residential Phase A",
        project_status: "in_progress",
      }));
  }

  async findInvestmentById(investmentId) {
    const investment = this.investments.get(investmentId);
    if (!investment) {
      return null;
    }
    return {
      ...investment,
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
    return Array.from(
      new Set(
        Array.from(this.investments.values())
          .filter((investment) => investment.project_id === projectId)
          .map((investment) => investment.investor_user_id),
      ),
    );
  }
}

class InMemoryPaymentsRepository {
  constructor() {
    this.transactions = new Map();
    this.webhookEvents = new Map();
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

  async appendTransactionMetadata({ transactionId, metadata }) {
    return this.updateTransactionStatus({
      transactionId,
      status: this.transactions.get(transactionId)?.status ?? "pending",
      metadata,
      paidAt: this.transactions.get(transactionId)?.paid_at ?? null,
    });
  }

  async createOrGetWebhookEvent({
    provider,
    eventKey,
    eventType,
    providerReference,
    payloadHash,
    payload,
  }) {
    const key = `${provider}:${eventKey}`;
    if (this.webhookEvents.has(key)) {
      return {
        event: this.webhookEvents.get(key),
        isNew: false,
      };
    }

    const created = {
      id: randomUUID(),
      provider,
      event_key: eventKey,
      event_type: eventType ?? null,
      provider_reference: providerReference ?? null,
      payload_hash: payloadHash,
      payload,
      status: "received",
      error_count: 0,
      last_error: null,
      processed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.webhookEvents.set(key, created);
    return {
      event: created,
      isNew: true,
    };
  }

  async findWebhookEventById(eventId) {
    return (
      Array.from(this.webhookEvents.values()).find((event) => event.id === eventId) ??
      null
    );
  }

  async markWebhookEventProcessed(eventId) {
    const event = await this.findWebhookEventById(eventId);
    if (!event) {
      return null;
    }
    event.status = "processed";
    event.processed_at = new Date().toISOString();
    event.updated_at = new Date().toISOString();
    return event;
  }

  async markWebhookEventFailed({ eventId, errorMessage }) {
    const event = await this.findWebhookEventById(eventId);
    if (!event) {
      return null;
    }
    event.status = "failed";
    event.error_count += 1;
    event.last_error = errorMessage;
    event.updated_at = new Date().toISOString();
    return event;
  }

  async listPendingTransactionsOlderThan({ olderThanMinutes, limit }) {
    const threshold = Date.now() - olderThanMinutes * 60 * 1000;
    return Array.from(this.transactions.values())
      .filter((transaction) => transaction.status === "pending")
      .filter((transaction) => new Date(transaction.created_at).getTime() <= threshold)
      .slice(0, limit);
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

  async findNotificationById(notificationId) {
    return this.notifications.find((item) => item.id === notificationId) ?? null;
  }

  async markNotificationDelivery({ notificationId, status, metadata }) {
    const notification = await this.findNotificationById(notificationId);
    if (!notification) {
      return null;
    }
    notification.status = status;
    notification.metadata = {
      ...notification.metadata,
      ...metadata,
    };
    if (status === "sent") {
      notification.sent_at = new Date().toISOString();
    }
    return notification;
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

class InMemoryJobsRepository {
  constructor() {
    this.jobs = new Map();
  }

  async enqueueJob({
    type,
    payload = {},
    dedupeKey = null,
    maxAttempts = 5,
    runAt = null,
  }) {
    const active = Array.from(this.jobs.values()).find(
      (job) =>
        dedupeKey &&
        job.dedupe_key === dedupeKey &&
        (job.status === "queued" || job.status === "running"),
    );

    if (active) {
      return {
        job: active,
        enqueued: false,
      };
    }

    const now = new Date().toISOString();
    const created = {
      id: randomUUID(),
      type,
      status: "queued",
      payload,
      dedupe_key: dedupeKey,
      attempts: 0,
      max_attempts: maxAttempts,
      run_at: runAt ?? now,
      locked_at: null,
      locked_by: null,
      completed_at: null,
      last_error: null,
      created_at: now,
      updated_at: now,
    };
    this.jobs.set(created.id, created);
    return {
      job: created,
      enqueued: true,
    };
  }

  async claimDueJobs({ workerId, limit }) {
    const now = Date.now();
    const queued = Array.from(this.jobs.values())
      .filter((job) => job.status === "queued")
      .filter((job) => new Date(job.run_at).getTime() <= now)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(0, limit);

    return queued.map((job) => {
      job.status = "running";
      job.attempts += 1;
      job.locked_by = workerId;
      job.locked_at = new Date().toISOString();
      job.updated_at = new Date().toISOString();
      return job;
    });
  }

  async markCompleted(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }
    job.status = "completed";
    job.completed_at = new Date().toISOString();
    job.locked_at = null;
    job.locked_by = null;
    job.updated_at = new Date().toISOString();
    return job;
  }

  async markFailed({ jobId, errorMessage, retryRunAt, dead }) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }
    job.status = dead ? "dead" : "queued";
    job.run_at = retryRunAt ?? job.run_at;
    job.last_error = errorMessage;
    job.locked_at = null;
    job.locked_by = null;
    job.updated_at = new Date().toISOString();
    return job;
  }

  async listJobs({ status, limit, offset }) {
    return Array.from(this.jobs.values())
      .filter((job) => (status ? job.status === status : true))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit);
  }
}

class InMemoryAuditRepository {
  constructor() {
    this.events = [];
  }

  async createEvent({
    actorUserId,
    entityType,
    entityId,
    action,
    level,
    requestId,
    metadata,
  }) {
    const created = {
      id: randomUUID(),
      actor_user_id: actorUserId ?? null,
      entity_type: entityType,
      entity_id: entityId ?? null,
      action,
      level: level ?? "info",
      request_id: requestId ?? null,
      metadata: metadata ?? {},
      created_at: new Date().toISOString(),
    };
    this.events.unshift(created);
    return created;
  }

  async listEvents({ limit, offset, level, entityType }) {
    return this.events
      .filter((event) => (level ? event.level === level : true))
      .filter((event) => (entityType ? event.entity_type === entityType : true))
      .slice(offset, offset + limit);
  }
}

describe("Phase 2 core routes", () => {
  test("project -> investment -> queued webhook -> jobs -> notifications flow", async () => {
    const authRepository = new InMemoryAuthRepository();
    const projectsRepository = new InMemoryProjectsRepository();
    const investmentsRepository = new InMemoryInvestmentsRepository();
    const paymentsRepository = new InMemoryPaymentsRepository();
    const notificationsRepository = new InMemoryNotificationsRepository({
      authRepository,
    });
    const jobsRepository = new InMemoryJobsRepository();
    const auditRepository = new InMemoryAuditRepository();

    const app = createApp({
      authRepository,
      projectsRepository,
      investmentsRepository,
      paymentsRepository,
      notificationsRepository,
      jobsRepository,
      auditRepository,
    });

    const adminRegister = await request(app).post("/api/v1/auth/register").send({
      fullName: "Admin User",
      role: "investor",
      email: "admin@example.com",
      password: "SecurePass!123",
    });
    authRepository.users.get(adminRegister.body.user.id).role = "admin";
    const adminLogin = await request(app).post("/api/v1/auth/login").send({
      email: "admin@example.com",
      password: "SecurePass!123",
    });
    expect(adminLogin.status).toBe(200);
    const adminAccessToken = adminLogin.body.accessToken;

    const developerRegister = await request(app).post("/api/v1/auth/register").send({
      fullName: "Developer User",
      role: "developer",
      email: "dev@example.com",
      password: "SecurePass!123",
    });

    const investorRegister = await request(app).post("/api/v1/auth/register").send({
      fullName: "Investor User",
      role: "investor",
      email: "investor@example.com",
      password: "SecurePass!123",
    });

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
    expect(webhookResult.status).toBe(202);
    expect(webhookResult.body.result.accepted).toBe(true);
    expect(webhookResult.body.result.processedInline).toBe(false);

    const processJobs = await request(app)
      .post("/api/v1/ops/jobs/process")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        limit: 50,
      });
    expect(processJobs.status).toBe(200);
    expect(processJobs.body.processedCount).toBeGreaterThan(0);

    const transaction = await request(app)
      .get(`/api/v1/payments/${initializePayment.body.id}`)
      .set("Authorization", `Bearer ${investorRegister.body.accessToken}`);
    expect(transaction.status).toBe(200);
    expect(transaction.body.status).toBe("succeeded");

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

    const postUpdate = await request(app)
      .post(`/api/v1/projects/${createProject.body.id}/updates`)
      .set("Authorization", `Bearer ${developerRegister.body.accessToken}`)
      .send({
        mediaType: "photo",
        mediaUrl: uploadTarget.body.publicUrl,
        caption: "Concrete works completed for block A.",
      });
    expect(postUpdate.status).toBe(201);

    const myNotifications = await request(app)
      .get("/api/v1/notifications/me")
      .set("Authorization", `Bearer ${investorRegister.body.accessToken}`);
    expect(myNotifications.status).toBe(200);
    expect(myNotifications.body.notifications.length).toBeGreaterThan(0);

    const auditEvents = await request(app)
      .get("/api/v1/ops/audit?limit=20")
      .set("Authorization", `Bearer ${adminAccessToken}`);
    expect(auditEvents.status).toBe(200);
    expect(auditEvents.body.events.length).toBeGreaterThan(0);

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
