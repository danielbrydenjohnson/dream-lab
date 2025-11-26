"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebaseAuth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!email.trim()) {
      setErrorMessage("Enter your email.");
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setInfoMessage(
        "If this email is registered, a reset link has been sent. Check your inbox and spam folder."
      );
    } catch (err: any) {
      console.error("Error sending password reset:", err);
      let msg = "Could not send reset email.";
      if (err.code === "auth/user-not-found") {
        msg = "No account found with that email.";
      }
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-2 text-center">
          Reset your password
        </h1>
        <p className="text-sm text-slate-400 mb-6 text-center">
          Enter the email you used to sign up. We&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-400">{errorMessage}</p>
          )}

          {infoMessage && (
            <p className="text-sm text-emerald-400">{infoMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-white font-medium text-sm"
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400 text-center">
          Remembered it?{" "}
          <Link
            href="/login"
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
