"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "@/lib/firebaseAuth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedName || !trimmedUsername || !trimmedEmail || !trimmedPassword) {
      setErrorMessage("Name, username, email and password are required.");
      return;
    }

    if (!/^[a-z0-9_\.]+$/.test(trimmedUsername)) {
      setErrorMessage(
        "Username can only contain lowercase letters, numbers, dots and underscores."
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1) Check username availability directly in Firestore
      const usernameRef = doc(db, "usernames", trimmedUsername);
      const usernameSnap = await getDoc(usernameRef);

      if (usernameSnap.exists()) {
        setErrorMessage("That username is already taken. Try another one.");
        setSubmitting(false);
        return;
      }

      // 2) Create auth user
      const cred = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        trimmedPassword
      );

      if (!cred.user) {
        setErrorMessage("Failed to create user account.");
        setSubmitting(false);
        return;
      }

      const uid = cred.user.uid;

      // 3) Create user profile and username mapping
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, {
        uid,
        email: trimmedEmail,
        name: trimmedName,
        username: trimmedUsername,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(usernameRef, {
        uid,
        createdAt: serverTimestamp(),
      });

      // 4) Send verification email
      try {
        await sendEmailVerification(cred.user);
        setInfoMessage(
          "Welcome to Onyva. Check your email to verify your account and complete setup."
        );
      } catch (err) {
        console.error("Error sending verification email:", err);
        setInfoMessage(
          "Account created. If you do not see a verification email, you can request one again from your account later."
        );
      }

      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err: any) {
      console.error("Error creating user:", err);
      let msg = "Failed to create account.";
      if (err.code === "auth/email-already-in-use") {
        msg = "This email is already in use. Try logging in instead.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password is too weak. Try something stronger.";
      }
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
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
              Onyva
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Create a private space for your dreams, patterns and symbols.
          </p>
        </div>

        {/* Register card */}
        <div className="w-full rounded-2xl border border-white/10 bg-slate-950/85 backdrop-blur-xl px-5 py-6 sm:px-6 sm:py-7 shadow-xl shadow-black/40">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 text-center">
            Create your account
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-5 text-center">
            A few details, then you can start logging dreams.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Name
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Username
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="for example dreamwalker"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Lowercase letters, numbers, dots and underscores only.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Choose a secure password"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-500/60 bg-red-950/70 px-3 py-2 text-xs text-red-100">
                {errorMessage}
              </div>
            )}

            {infoMessage && (
              <div className="rounded-xl border border-emerald-500/60 bg-emerald-950/70 px-3 py-2 text-xs text-emerald-100">
                {infoMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition transform hover:-translate-y-0.5"
            >
              {submitting ? "Creating account..." : "Sign up"}
            </button>
          </form>

          <p className="mt-4 text-xs sm:text-sm text-slate-400 text-center">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-indigo-300 hover:text-indigo-200"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
