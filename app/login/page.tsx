"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseAuth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: any) {
      console.error("Login failed:", err);
      setError("Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex items-center justify-center px-4 sm:px-6">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      >
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* App title and tagline */}
        <div className="mb-5 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 via-sky-400 to-violet-500 shadow-md shadow-indigo-500/40" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Dream Lab
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Log back in to your dream archive and keep mapping the patterns.
          </p>
        </div>

        {/* Login card */}
        <div className="w-full rounded-2xl border border-white/10 bg-slate-950/85 backdrop-blur-xl px-5 py-6 sm:px-6 sm:py-7 shadow-xl shadow-black/40">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 text-center">
            Log in
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="Your password"
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/60 bg-red-950/70 px-3 py-2 text-xs text-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex w-full items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition transform hover:-translate-y-0.5"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          {/* Forgot Password Link */}
          <p className="text-center text-xs sm:text-sm text-indigo-300 hover:text-indigo-200 mt-3">
            <Link href="/forgot-password">Forgot your password?</Link>
          </p>

          <p className="text-center text-xs sm:text-sm text-slate-400 mt-4">
            No account?{" "}
            <Link
              href="/register"
              className="text-indigo-300 hover:text-indigo-200"
            >
              Sign up
            </Link>
          </p>
        </div>

        {/* Back home for logged in users who ended up here */}
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-[11px] sm:text-xs text-slate-400 hover:text-slate-200"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
