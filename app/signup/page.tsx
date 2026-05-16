"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    setError("");
    setMessage("");
    setLoading(true);

    if (!trimmedUsername) {
      setError("Username is required.");
      setLoading(false);
      return;
    }

    try {
      const supabase = await getSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: trimmedUsername
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        window.location.href = "/";
        return;
      }

      setMessage("Account created. Check your email to confirm your signup, then log in.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Beta access"
      title="Create your account"
      description="Sign up for Revisio. Your study data remains local until cloud sync is added."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Username
          <input
            className="field mt-1"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="tadeas"
            required
          />
        </label>
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
            minLength={6}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            required
          />
        </label>

        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
            {message}
          </p>
        ) : null}

        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link className="font-bold text-blue-700 hover:text-blue-600 dark:text-blue-300" href="/login">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
