"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import type { Project, ProjectUpdate, User } from "@/lib/types";

type UpdatesResponse = {
  updates: ProjectUpdate[];
};

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateForm, setUpdateForm] = useState({
    mediaType: "photo",
    mediaUrl: "",
    caption: "",
    capturedAt: "",
  });

  const canPostUpdate = useMemo(
    () => user?.role === "developer" || user?.role === "admin",
    [user],
  );

  useEffect(() => {
    async function loadProject() {
      setIsLoading(true);
      setError(null);
      try {
        const [projectResponse, updatesResponse] = await Promise.all([
          apiRequest<Project>(`/projects/${projectId}`),
          apiRequest<UpdatesResponse>(`/projects/${projectId}/updates`),
        ]);
        setProject(projectResponse);
        setUpdates(updatesResponse.updates);

        try {
          const me = await apiRequest<User>("/users/me", {
            headers: getAuthHeaders(),
          });
          setUser(me);
        } catch {
          setUser(null);
        }
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message);
        } else {
          setError("Unable to load project details.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectId]);

  async function handlePostUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const created = await apiRequest<ProjectUpdate>(`/projects/${projectId}/updates`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          mediaType: updateForm.mediaType,
          mediaUrl: updateForm.mediaUrl,
          caption: updateForm.caption || undefined,
          capturedAt: updateForm.capturedAt
            ? new Date(updateForm.capturedAt).toISOString()
            : undefined,
        }),
      });
      setUpdates((prev) => [created, ...prev]);
      setUpdateForm({
        mediaType: "photo",
        mediaUrl: "",
        caption: "",
        capturedAt: "",
      });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not post project update.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <Link
        href="/projects"
        className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Back to projects
      </Link>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading project details...</p> : null}

      {project ? (
        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {project.description}
          </p>
          <div className="mt-3 space-y-1 text-sm">
            <p>
              <strong>Location:</strong> {project.location}
            </p>
            <p>
              <strong>Status:</strong> {project.status.replace("_", " ")}
            </p>
            <p>
              <strong>Total budget:</strong> ${project.totalBudget.toLocaleString()}
            </p>
            <p>
              <strong>Funded so far:</strong> ${project.fundedAmount.toLocaleString()}
            </p>
          </div>
        </section>
      ) : null}

      {canPostUpdate ? (
        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Post photo/video update</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handlePostUpdate}>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={updateForm.mediaType}
              onChange={(event) =>
                setUpdateForm((prev) => ({
                  ...prev,
                  mediaType: event.target.value,
                }))
              }
            >
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Captured date/time"
              type="datetime-local"
              value={updateForm.capturedAt}
              onChange={(event) =>
                setUpdateForm((prev) => ({ ...prev, capturedAt: event.target.value }))
              }
            />
            <input
              className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Media URL"
              value={updateForm.mediaUrl}
              onChange={(event) =>
                setUpdateForm((prev) => ({ ...prev, mediaUrl: event.target.value }))
              }
              required
            />
            <textarea
              className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              rows={3}
              placeholder="Caption"
              value={updateForm.caption}
              onChange={(event) =>
                setUpdateForm((prev) => ({ ...prev, caption: event.target.value }))
              }
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-fit rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
            >
              {isSubmitting ? "Posting..." : "Post update"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Progress timeline</h2>
        <div className="mt-4 space-y-3">
          {updates.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No updates published yet.
            </p>
          ) : null}
          {updates.map((update) => (
            <article
              key={update.id}
              className="rounded-md border border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold uppercase">
                  {update.mediaType} update
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(update.createdAt).toLocaleString()}
                </p>
              </div>
              <a
                href={update.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-sm text-teal-700 underline dark:text-teal-300"
              >
                {update.mediaUrl}
              </a>
              {update.caption ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {update.caption}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Posted by: {update.uploadedByName ?? "Unknown"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
