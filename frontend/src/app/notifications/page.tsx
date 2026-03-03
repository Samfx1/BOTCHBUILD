"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import type { Notification, NotificationPreferences } from "@/lib/types";

type NotificationsResponse = {
  notifications: Notification[];
};

type PreferenceKey =
  | "emailEnabled"
  | "smsEnabled"
  | "pushEnabled"
  | "whatsappEnabled";

const preferenceFields: Array<{ label: string; key: PreferenceKey }> = [
  { label: "Email", key: "emailEnabled" },
  { label: "SMS", key: "smsEnabled" },
  { label: "Push", key: "pushEnabled" },
  { label: "WhatsApp", key: "whatsappEnabled" },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setError(null);
      setIsLoading(true);
      try {
        const [notificationsResponse, preferencesResponse] = await Promise.all([
          apiRequest<NotificationsResponse>("/notifications/me", {
            headers: getAuthHeaders(),
          }),
          apiRequest<NotificationPreferences>("/notifications/preferences", {
            headers: getAuthHeaders(),
          }),
        ]);
        setNotifications(notificationsResponse.notifications);
        setPreferences(preferencesResponse);
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message);
        } else {
          setError("Unable to load notifications.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleSavePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const updated = await apiRequest<NotificationPreferences>(
        "/notifications/preferences",
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            emailEnabled: preferences.emailEnabled,
            smsEnabled: preferences.smsEnabled,
            pushEnabled: preferences.pushEnabled,
            whatsappEnabled: preferences.whatsappEnabled,
          }),
        },
      );
      setPreferences(updated);
      setMessage("Notification preferences updated.");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not save preferences.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createTestNotification() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      await apiRequest<{ notification: Notification | null }>("/notifications/test", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          channel: "email",
          title: "Phase 2 test notification",
          body: "This confirms your notification channel is active.",
        }),
      });

      const refreshed = await apiRequest<NotificationsResponse>("/notifications/me", {
        headers: getAuthHeaders(),
      });
      setNotifications(refreshed.notifications);
      setMessage("Test notification created.");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Unable to create test notification.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Manage communication channels and review project/payment alerts.
        </p>
      </header>

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

      {isLoading ? <p>Loading notifications...</p> : null}

      {preferences ? (
        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Channel preferences</h2>
          <form className="mt-4 space-y-3" onSubmit={handleSavePreferences}>
            {preferenceFields.map(({ label, key }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  onChange={(event) =>
                    setPreferences((prev) =>
                      prev
                        ? {
                            ...prev,
                            [key]: event.target.checked,
                          }
                        : prev,
                    )
                  }
                />
                {label}
              </label>
            ))}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
              >
                Save preferences
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={createTestNotification}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Send test notification
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Recent alerts</h2>
        <div className="mt-4 space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No notifications yet.
            </p>
          ) : null}
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className="rounded-md border border-slate-200 p-4 dark:border-slate-700"
            >
              <p className="text-sm font-semibold">{notification.title}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {notification.body}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {notification.channel.toUpperCase()} ·{" "}
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
