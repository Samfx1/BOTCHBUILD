"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import type { AuditEvent, OperationJob, User } from "@/lib/types";

type JobsResponse = {
  jobs: OperationJob[];
};

type AuditResponse = {
  events: AuditEvent[];
};

export default function OpsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<OperationJob[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setError(null);
    setIsLoading(true);
    try {
      const me = await apiRequest<User>("/users/me", {
        headers: getAuthHeaders(),
      });
      setUser(me);

      if (me.role !== "admin") {
        setError("Only admin users can access operations controls.");
        return;
      }

      const [jobsResponse, auditResponse] = await Promise.all([
        apiRequest<JobsResponse>("/ops/jobs?limit=30", {
          headers: getAuthHeaders(),
        }),
        apiRequest<AuditResponse>("/ops/audit?limit=30", {
          headers: getAuthHeaders(),
        }),
      ]);

      setJobs(jobsResponse.jobs);
      setAuditEvents(auditResponse.events);
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Unable to load operations dashboard.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function processDueJobs() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await apiRequest<{
        processedCount: number;
        claimedCount: number;
      }>("/ops/jobs/process", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          limit: 50,
        }),
      });
      setMessage(
        `Processed ${response.processedCount} jobs (claimed ${response.claimedCount}).`,
      );
      await loadData();
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not process queued jobs.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function enqueueReconciliation() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await apiRequest<{
        enqueued: boolean;
        job: OperationJob;
      }>("/ops/reconciliation/payments", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          olderThanMinutes: 60,
          limit: 100,
        }),
      });
      setMessage(
        response.enqueued
          ? `Reconciliation job queued: ${response.job.id}`
          : `Reconciliation job already active: ${response.job.id}`,
      );
      await loadData();
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not enqueue reconciliation job.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Operations hardening dashboard</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Admin controls for queue processing, reconciliation, and audit
              tracking.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      {isLoading ? <p>Loading operations data...</p> : null}
      {user && user.role !== "admin" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Current account role: {user.role}. Admin role required.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Queue controls</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={processDueJobs}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-70 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Process due jobs now
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={enqueueReconciliation}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Enqueue payment reconciliation
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Recent operation jobs</h2>
        <div className="mt-4 space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No jobs recorded yet.
            </p>
          ) : null}
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-md border border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{job.type}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase dark:bg-slate-800">
                  {job.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Attempts {job.attempts}/{job.maxAttempts}
              </p>
              {job.lastError ? (
                <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                  Last error: {job.lastError}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Audit events</h2>
        <div className="mt-4 space-y-3">
          {auditEvents.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No audit events yet.
            </p>
          ) : null}
          {auditEvents.map((event) => (
            <article
              key={event.id}
              className="rounded-md border border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{event.action}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase dark:bg-slate-800">
                  {event.level}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {event.entityType}
                {event.entityId ? `:${event.entityId}` : ""} ·{" "}
                {new Date(event.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
