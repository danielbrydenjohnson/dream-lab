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

      // Redirect to HOME dashboard
      router.push("/");
    } catch (err: any) {
      console.error("Login failed:", err);
      setError("Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
      <div className="w-full max-w-md p-6 rounded-xl bg-slate-900 border border-slate-800">
        <h1 className="text-2xl font-bold mb-4 text-center">Log in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            className="p-3 rounded-md bg-slate-800 text-white focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Password"
            className="p-3 rounded-md bg-slate-800 text-white focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium disabled:bg-slate-700"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        {/* Forgot Password Link */}
        <p className="text-center text-sm text-indigo-400 hover:text-indigo-300 mt-3">
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>

        <p className="text-center text-sm text-slate-400 mt-4">
          No account?{" "}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
