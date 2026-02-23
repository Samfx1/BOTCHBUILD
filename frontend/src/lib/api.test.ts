import { apiRequest, ApiError, buildApiUrl } from "./api";
import { describe, expect, test, vi } from "vitest";

describe("api utilities", () => {
  test("buildApiUrl appends base URL for relative paths", () => {
    expect(buildApiUrl("/auth/login")).toContain("/api/v1/auth/login");
  });

  test("apiRequest resolves payload when response is successful", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await apiRequest<{ success: boolean }>("/health");
    expect(result.success).toBe(true);

    fetchSpy.mockRestore();
  });

  test("apiRequest throws ApiError for non-2xx responses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    } as Response);

    await expect(apiRequest("/protected")).rejects.toBeInstanceOf(ApiError);
    fetchSpy.mockRestore();
  });
});
