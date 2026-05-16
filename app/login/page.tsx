"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [nextPath, setNextPath] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/");
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = await getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      window.location.href = nextPath;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Log in to Revisio"
      description="Access your beta workspace. Study data still stays local on this device for now."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Email
          <input
            className="field mt-1"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Password
          <input
            className="field mt-1"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            required
          />
        </label>

        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        New to Revisio?{" "}
        <Link className="font-bold text-blue-700 hover:text-blue-600 dark:text-blue-300" href="/signup">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
