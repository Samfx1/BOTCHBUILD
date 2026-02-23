export type User = {
  id: string;
  fullName: string;
  email: string;
  role: "investor" | "developer" | "admin";
  isTwoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RegisterResponse = {
  user: User;
  accessToken: string;
};

export type LoginResponse =
  | {
      requiresTwoFactor: true;
      tempToken: string;
    }
  | {
      requiresTwoFactor: false;
      accessToken: string;
      user: User;
    };

export type TwoFactorSetupResponse = {
  qrCodeDataUrl: string;
  manualEntryKey: string;
};

export type ProjectStatus = "planned" | "in_progress" | "completed" | "paused";

export type Project = {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  title: string;
  description: string;
  location: string;
  totalBudget: number;
  fundedAmount: number;
  targetCompletionDate: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectUpdate = {
  id: string;
  projectId: string;
  uploadedBy: string;
  uploadedByName: string | null;
  mediaType: "photo" | "video";
  mediaUrl: string;
  caption: string | null;
  capturedAt: string | null;
  createdAt: string;
};

export type InvestmentStatus = "pending" | "active" | "cancelled" | "withdrawn";

export type Investment = {
  id: string;
  projectId: string;
  investorUserId: string;
  amount: number;
  currency: string;
  status: InvestmentStatus;
  projectTitle: string;
  projectStatus: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type PaymentProvider = "stripe" | "paystack";

export type PaymentTransaction = {
  id: string;
  investmentId: string;
  investorUserId: string;
  provider: PaymentProvider;
  providerReference: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  metadata: Record<string, unknown>;
  initiatedBy: string;
  providerCheckoutUrl: string | null;
  idempotencyKey: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: string;
  recipientUserId: string;
  channel: "email" | "sms" | "push" | "whatsapp";
  title: string;
  body: string;
  status: "queued" | "sent" | "failed";
  metadata: Record<string, unknown>;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type NotificationPreferences = {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};
