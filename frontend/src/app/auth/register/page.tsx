"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import type { RegisterResponse } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiRequest<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          email,
          password,
        }),
      });

      setAccessToken(response.accessToken);
      router.push("/auth/2fa/setup");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="rounded-xl bg-white p-8 shadow-sm dark:bg-slate-900">
        <h1 className="mb-2 text-2xl font-bold">Create your investor account</h1>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Use a strong password (12+ chars with uppercase, lowercase, number,
          and symbol).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Full name</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email address</span>
            <input
              type="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          Already registered?{" "}
          <Link className="font-medium text-teal-700 dark:text-teal-300" href="/auth/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
