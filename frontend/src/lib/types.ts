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
