"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function MockCheckoutPage() {
  const params = useParams<{ providerReference: string }>();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-6 py-10">
      <div className="rounded-xl bg-white p-8 shadow-sm dark:bg-slate-900">
        <h1 className="text-2xl font-bold">Mock provider checkout</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          This page simulates the external checkout redirect for Phase 2 local
          development.
        </p>
        <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 font-mono text-sm dark:bg-slate-800">
          Reference: {params.providerReference}
        </p>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          In production, this redirects to Stripe or Paystack hosted checkout.
        </p>
        <Link
          href="/projects"
          className="mt-4 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}
