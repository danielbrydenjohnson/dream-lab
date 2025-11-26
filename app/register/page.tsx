"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "@/lib/firebaseAuth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
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
          "Welcome to Dream Lab. Check your email to verify your account and complete setup."
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
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-2 text-center">
          Create your Dream Lab account
        </h1>
        <p className="text-sm text-slate-400 mb-6 text-center">
          Start building a private record of your dreams and patterns.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input
              type="text"
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              type="text"
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="for example dreamwalker"
            />
            <p className="mt-1 text-xs text-slate-500">
              Lowercase letters, numbers, dots and underscores only.
            </p>
          </div>

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

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400 text-center">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
