"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import {
  clearTempTwoFactorToken,
  getTempTwoFactorToken,
  setAccessToken,
} from "@/lib/auth";
import type { User } from "@/lib/types";

type VerifyLoginResponse = {
  accessToken: string;
  user: User;
};

export default function VerifyTwoFactorLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const tempToken = getTempTwoFactorToken();
    if (!tempToken) {
      setError("Temporary login session expired. Please sign in again.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest<VerifyLoginResponse>("/auth/2fa/verify-login", {
        method: "POST",
        body: JSON.stringify({
          tempToken,
          token,
        }),
      });

      setAccessToken(response.accessToken);
      clearTempTwoFactorToken();
      router.push("/dashboard");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not verify code.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="rounded-xl bg-white p-8 shadow-sm dark:bg-slate-900">
        <h1 className="mb-2 text-2xl font-bold">Verify two-factor login</h1>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Enter the 6-digit code from your authenticator app.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Verification code</span>
            <input
              maxLength={6}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="123456"
              required
            />
          </label>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Verifying..." : "Complete sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          Need a new session?{" "}
          <Link className="font-medium text-teal-700 dark:text-teal-300" href="/auth/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
