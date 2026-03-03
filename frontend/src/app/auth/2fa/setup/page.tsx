"use client";

import Link from "next/link";
import { useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { TwoFactorSetupResponse } from "@/lib/types";

export default function TwoFactorSetupPage() {
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function initializeSetup() {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setError("Sign in first to configure 2FA.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsLoadingSetup(true);
    try {
      const response = await apiRequest<TwoFactorSetupResponse>("/auth/2fa/setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setSetup(response);
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not initialize 2FA setup.");
      }
    } finally {
      setIsLoadingSetup(false);
    }
  }

  async function verifySetup() {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setError("Sign in first to configure 2FA.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsVerifying(true);
    try {
      await apiRequest<{ twoFactorEnabled: boolean }>("/auth/2fa/verify-setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });
      setMessage("Two-factor authentication enabled successfully.");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not verify 2FA token.");
      }
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
      <div className="rounded-xl bg-white p-8 shadow-sm dark:bg-slate-900">
        <h1 className="mb-2 text-2xl font-bold">Set up two-factor authentication</h1>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Recommended for all diaspora investor and developer accounts.
        </p>

        <button
          onClick={initializeSetup}
          disabled={isLoadingSetup}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoadingSetup ? "Generating QR code..." : "Generate 2FA QR code"}
        </button>

        {setup ? (
          <div className="mt-6 space-y-4 rounded-md border border-slate-200 p-4 dark:border-slate-700">
            {/* Displayed as image to scan in authenticator apps */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrCodeDataUrl} alt="2FA QR Code" className="h-56 w-56 rounded" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Manual entry key:{" "}
              <code className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
                {setup.manualEntryKey}
              </code>
            </p>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">6-digit code</span>
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950"
                placeholder="123456"
                maxLength={6}
              />
            </label>

            <button
              onClick={verifySetup}
              disabled={isVerifying}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              {isVerifying ? "Verifying..." : "Verify and enable"}
            </button>
          </div>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          Continue to{" "}
          <Link className="font-medium text-teal-700 dark:text-teal-300" href="/dashboard">
            dashboard
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
