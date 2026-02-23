"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import type { User } from "@/lib/types";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const accessToken = getAccessToken();
      if (!accessToken) {
        setError("You are not signed in.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiRequest<User>("/users/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setUser(response);
      } catch (requestError) {
        clearAccessToken();
        if (requestError instanceof ApiError) {
          setError(requestError.message);
        } else {
          setError("Unable to load your session.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 py-12">
      <div className="rounded-xl bg-white p-8 shadow-sm dark:bg-slate-900">
        <h1 className="mb-2 text-2xl font-bold">Investor dashboard</h1>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Phase 1 session check and security baseline.
        </p>

        {isLoading ? <p>Loading session...</p> : null}

        {!isLoading && error ? (
          <div className="space-y-3">
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
            <Link
              href="/auth/login"
              className="inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Sign in
            </Link>
          </div>
        ) : null}

        {!isLoading && user ? (
          <div className="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-700">
            <p>
              <strong>Name:</strong> {user.fullName}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Role:</strong> {user.role}
            </p>
            <p>
              <strong>2FA enabled:</strong> {user.isTwoFactorEnabled ? "Yes" : "No"}
            </p>
            {!user.isTwoFactorEnabled ? (
              <Link
                href="/auth/2fa/setup"
                className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Enable 2FA
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
