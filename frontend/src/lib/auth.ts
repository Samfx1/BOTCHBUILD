const ACCESS_TOKEN_KEY = "botchbuild_access_token";
const TEMP_2FA_TOKEN_KEY = "botchbuild_temp_2fa_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getTempTwoFactorToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(TEMP_2FA_TOKEN_KEY);
}

export function setTempTwoFactorToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(TEMP_2FA_TOKEN_KEY, token);
}

export function clearTempTwoFactorToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(TEMP_2FA_TOKEN_KEY);
}
