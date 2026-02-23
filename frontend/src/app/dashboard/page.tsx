"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import type { Investment, User } from "@/lib/types";

type InvestmentsResponse = {
  investments: Investment[];
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
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

        if (response.role === "investor" || response.role === "admin") {
          const investmentsResponse = await apiRequest<InvestmentsResponse>(
            "/investments/me",
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          setInvestments(investmentsResponse.investments);
        }
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
          Phase 2 includes project tracking, investments, payment initialization,
          and notifications.
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
          <div className="space-y-5 rounded-md border border-slate-200 p-4 dark:border-slate-700">
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
            <div className="flex flex-wrap gap-2">
              <Link
                href="/projects"
                className="inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Open projects
              </Link>
              <Link
                href="/notifications"
                className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Notifications
              </Link>
            </div>
            {!user.isTwoFactorEnabled ? (
              <Link
                href="/auth/2fa/setup"
                className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Enable 2FA
              </Link>
            ) : null}

            {user.role === "investor" || user.role === "admin" ? (
              <section className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                <h2 className="text-sm font-semibold uppercase tracking-wide">
                  My investments ({investments.length})
                </h2>
                {investments.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No investments yet. Visit the projects page to start one.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {investments.slice(0, 5).map((investment) => (
                      <li
                        key={investment.id}
                        className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700"
                      >
                        <p className="font-medium">{investment.projectTitle}</p>
                        <p>
                          ${investment.amount.toLocaleString()} {investment.currency} ·{" "}
                          {investment.status}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
