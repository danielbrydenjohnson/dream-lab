"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  onAuthStateChanged,
  deleteUser,
  User,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { auth } from "@/lib/firebaseAuth";
import { db } from "@/lib/firebase";
import TopNav from "@/components/TopNav";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      if (!u) {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  async function handleDeleteAccount() {
    if (!user) return;

    const confirmed = confirm(
      "This will permanently delete your account and all your dreams. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setDeleting(true);
    setErrorMessage(null);

    try {
      // Delete all dreams for this user
      const dreamsRef = collection(db, "dreams");
      const q = query(dreamsRef, where("userId", "==", user.uid));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      // Delete auth user
      await deleteUser(user);

      // After deletion, send them to home
      router.push("/");
    } catch (err: any) {
      console.error("Error deleting account:", err);
      if (err.code === "auth/requires-recent-login") {
        setErrorMessage(
          "For security, please log out and log in again before deleting your account."
        );
      } else {
        setErrorMessage("Failed to delete account. Check console for details.");
      }
      setDeleting(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Checking your session...</p>
      </main>
    );
  }

  if (!user) {
    return null; // Redirecting to /login
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <TopNav />

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6">
          <h1 className="text-2xl font-bold mb-2">Account</h1>
          <p className="text-sm text-slate-400 mb-4">
            Manage your Dream Lab account.
          </p>

          <div className="mb-6">
            <p className="text-sm text-slate-400">Email</p>
            <p className="text-base text-slate-100">{user.email}</p>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-400 mb-4">{errorMessage}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/"
              className="px-4 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm"
            >
              Back to dashboard
            </Link>

            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-sm font-medium"
            >
              {deleting ? "Deleting account..." : "Delete my account"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Deleting your account will remove all dreams and data associated
            with this email.
          </p>
        </section>
      </div>
    </main>
  );
}
