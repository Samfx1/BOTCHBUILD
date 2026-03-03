"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import type {
  Investment,
  PaymentProvider,
  PaymentTransaction,
  Project,
  User,
} from "@/lib/types";

type ProjectsResponse = { projects: Project[] };
type InvestmentsResponse = { investments: Investment[] };

const defaultProviderByProject: Record<string, PaymentProvider> = {};

export default function ProjectsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [myInvestments, setMyInvestments] = useState<Investment[]>([]);
  const [amountByProject, setAmountByProject] = useState<Record<string, string>>({});
  const [providerByProject, setProviderByProject] = useState<
    Record<string, PaymentProvider>
  >(defaultProviderByProject);
  const [checkoutByProject, setCheckoutByProject] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    location: "",
    totalBudget: "",
    targetCompletionDate: "",
  });

  const canCreateProject = useMemo(
    () => user?.role === "developer" || user?.role === "admin",
    [user],
  );

  useEffect(() => {
    async function loadPage() {
      setError(null);
      setIsLoading(true);
      try {
        const [me, projectsResponse] = await Promise.all([
          apiRequest<User>("/users/me", { headers: getAuthHeaders() }),
          apiRequest<ProjectsResponse>("/projects"),
        ]);

        setUser(me);
        setProjects(projectsResponse.projects);

        if (me.role === "investor" || me.role === "admin") {
          const investmentsResponse = await apiRequest<InvestmentsResponse>(
            "/investments/me",
            { headers: getAuthHeaders() },
          );
          setMyInvestments(investmentsResponse.investments);
        }
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message);
        } else {
          setError("Unable to load projects.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadPage();
  }, []);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const created = await apiRequest<Project>("/projects", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: projectForm.title,
          description: projectForm.description,
          location: projectForm.location,
          totalBudget: Number(projectForm.totalBudget),
          targetCompletionDate: projectForm.targetCompletionDate || undefined,
          status: "planned",
        }),
      });

      setProjects((prev) => [created, ...prev]);
      setProjectForm({
        title: "",
        description: "",
        location: "",
        totalBudget: "",
        targetCompletionDate: "",
      });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not create project.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInvest(projectId: string) {
    const amountValue = Number(amountByProject[projectId]);
    const provider = providerByProject[projectId] ?? "paystack";

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Enter a valid investment amount.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const investment = await apiRequest<Investment>("/investments", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          projectId,
          amount: amountValue,
          currency: "USD",
        }),
      });

      setMyInvestments((prev) => [investment, ...prev]);

      const payment = await apiRequest<PaymentTransaction>("/payments/initialize", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          investmentId: investment.id,
          provider,
        }),
      });

      setCheckoutByProject((prev) => ({
        ...prev,
        [projectId]:
          payment.providerCheckoutUrl ??
          `Initialized (${payment.provider}) ref ${payment.providerReference}`,
      }));
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Could not initialize investment payment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function getMyInvestmentCount(projectId: string): number {
    return myInvestments.filter((investment) => investment.projectId === projectId).length;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Phase 2 investment workflows: project discovery, investor commitments,
          and payment initialization.
        </p>
      </header>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading project board...</p> : null}

      {canCreateProject ? (
        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Create a project</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateProject}>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Project title"
              value={projectForm.title}
              onChange={(event) =>
                setProjectForm((prev) => ({ ...prev, title: event.target.value }))
              }
              required
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Location"
              value={projectForm.location}
              onChange={(event) =>
                setProjectForm((prev) => ({ ...prev, location: event.target.value }))
              }
              required
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Total budget"
              type="number"
              min={0}
              value={projectForm.totalBudget}
              onChange={(event) =>
                setProjectForm((prev) => ({
                  ...prev,
                  totalBudget: event.target.value,
                }))
              }
              required
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Target completion date"
              type="date"
              value={projectForm.targetCompletionDate}
              onChange={(event) =>
                setProjectForm((prev) => ({
                  ...prev,
                  targetCompletionDate: event.target.value,
                }))
              }
            />
            <textarea
              className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Project description"
              value={projectForm.description}
              onChange={(event) =>
                setProjectForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={4}
              required
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-fit rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
            >
              {isSubmitting ? "Creating..." : "Create project"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="grid gap-4">
        {projects.map((project) => (
          <article
            key={project.id}
            className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">{project.title}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase dark:bg-slate-800">
                {project.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {project.description}
            </p>
            <p className="mt-3 text-sm">
              <strong>Location:</strong> {project.location}
            </p>
            <p className="text-sm">
              <strong>Budget:</strong> ${project.totalBudget.toLocaleString()} |{" "}
              <strong>Funded:</strong> ${project.fundedAmount.toLocaleString()}
            </p>
            <p className="text-sm">
              <strong>My investments in this project:</strong>{" "}
              {getMyInvestmentCount(project.id)}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/projects/${project.id}`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                View details and updates
              </Link>
            </div>

            {user?.role === "investor" || user?.role === "admin" ? (
              <div className="mt-5 rounded-md border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm font-semibold">Invest in this project</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Amount (USD)"
                    type="number"
                    min={1}
                    value={amountByProject[project.id] ?? ""}
                    onChange={(event) =>
                      setAmountByProject((prev) => ({
                        ...prev,
                        [project.id]: event.target.value,
                      }))
                    }
                  />
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={providerByProject[project.id] ?? "paystack"}
                    onChange={(event) =>
                      setProviderByProject((prev) => ({
                        ...prev,
                        [project.id]: event.target.value as PaymentProvider,
                      }))
                    }
                  >
                    <option value="paystack">Paystack</option>
                    <option value="stripe">Stripe</option>
                  </select>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleInvest(project.id)}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-70 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                  >
                    Invest + Initialize payment
                  </button>
                </div>
                {checkoutByProject[project.id] ? (
                  <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                    Payment session:{" "}
                    <a
                      className="underline"
                      href={checkoutByProject[project.id]}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {checkoutByProject[project.id]}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
