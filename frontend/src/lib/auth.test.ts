import {
  clearAccessToken,
  clearTempTwoFactorToken,
  getAccessToken,
  getAuthHeaders,
  getTempTwoFactorToken,
  setAccessToken,
  setTempTwoFactorToken,
} from "./auth";
import { describe, expect, test } from "vitest";

describe("auth storage helpers", () => {
  test("stores and clears access token", () => {
    clearAccessToken();
    expect(getAccessToken()).toBeNull();

    setAccessToken("access-token-1");
    expect(getAccessToken()).toBe("access-token-1");

    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  test("stores temporary 2FA token in session storage", () => {
    clearTempTwoFactorToken();
    expect(getTempTwoFactorToken()).toBeNull();

    setTempTwoFactorToken("temp-token-1");
    expect(getTempTwoFactorToken()).toBe("temp-token-1");
  });

  test("creates bearer header when token exists", () => {
    clearAccessToken();
    expect(getAuthHeaders()).toEqual({});

    setAccessToken("access-token-2");
    expect(getAuthHeaders()).toEqual({
      Authorization: "Bearer access-token-2",
    });
  });
});
