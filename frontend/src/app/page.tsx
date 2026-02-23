import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-2xl bg-white p-10 shadow-sm dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">
          Botch Build - Phase 1 Foundation
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          Secure diaspora investment portal for Ghana real estate projects
        </h1>
        <p className="max-w-3xl text-slate-600 dark:text-slate-300">
          Foundation + Phases 2-3 include account security, project discovery,
          investor payment workflows, progress updates, notification controls,
          and operations hardening.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/auth/register"
            className="rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Create account
          </Link>
          <Link
            href="/auth/login"
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Dashboard
          </Link>
          <Link
            href="/projects"
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Projects
          </Link>
          <Link
            href="/ops"
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Ops
          </Link>
        </div>
      </main>
    </div>
  );
}
