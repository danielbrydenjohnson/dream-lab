"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, deleteUser, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth } from "@/lib/firebaseAuth";
import { db } from "@/lib/firebase";
import TopNav from "@/components/TopNav";

type UserProfile = {
  name: string;
  username: string;
  email: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

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

  // Load profile from Firestore
  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      setProfileLoading(true);
      setProfileMessage(null);
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          setProfile({
            name: data.name ?? "",
            username: data.username ?? "",
            email: data.email ?? user.email ?? "",
          });
        } else {
          // Legacy user: no profile yet
          setProfile({
            name: "",
            username: "",
            email: user.email ?? "",
          });
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        setProfileMessage("Failed to load profile details.");
      } finally {
        setProfileLoading(false);
      }
    }

    if (user) {
      loadProfile();
    }
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;

    setProfileMessage(null);

    const newName = profile.name.trim();
    const newUsernameRaw = profile.username.trim();

    if (!newName || !newUsernameRaw) {
      setProfileMessage("Name and username are required.");
      return;
    }

    const newUsername = newUsernameRaw.toLowerCase();

    if (!/^[a-z0-9_\.]+$/.test(newUsername)) {
      setProfileMessage(
        "Username can only contain lowercase letters, numbers, dots and underscores."
      );
      return;
    }

    setProfileSaving(true);

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      const hadProfile = userSnap.exists();
      let oldUsername = "";

      if (hadProfile) {
        const current = userSnap.data() as any;
        oldUsername = (current.username ?? "").toLowerCase();
      }

      // If username changed, check availability and update mapping
      if (newUsername !== oldUsername) {
        const newUsernameRef = doc(db, "usernames", newUsername);
        const newUsernameSnap = await getDoc(newUsernameRef);
        if (newUsernameSnap.exists()) {
          setProfileMessage("That username is already taken.");
          setProfileSaving(false);
          return;
        }

        // Create new mapping
        await setDoc(newUsernameRef, {
          uid: user.uid,
          createdAt: serverTimestamp(),
        });

        // Delete old mapping if it existed
        if (oldUsername) {
          const oldUsernameRef = doc(db, "usernames", oldUsername);
          await deleteDoc(oldUsernameRef).catch(() => {});
        }
      }

      // Create or update profile doc
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email ?? profile.email,
          name: newName,
          username: newUsername,
          updatedAt: serverTimestamp(),
          ...(hadProfile ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: newName,
              username: newUsername,
            }
          : prev
      );
      setProfileMessage("Profile updated.");
    } catch (err) {
      console.error("Error updating profile:", err);
      setProfileMessage("Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

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

      // Delete profile and username mapping if present
      if (profile?.username) {
        const unameLower = profile.username.trim().toLowerCase();
        if (unameLower) {
          await deleteDoc(doc(db, "usernames", unameLower)).catch(() => {});
        }
      }
      await deleteDoc(doc(db, "users", user.uid)).catch(() => {});

      // Delete auth user
      await deleteUser(user);

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
      <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex items-center justify-center">
        {/* Background glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          aria-hidden="true"
        >
          <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
          <div className="absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl px-6 py-4 shadow-xl shadow-black/40">
          <p className="text-sm text-slate-300">Checking your session...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    // Redirect already triggered above
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      >
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <TopNav />

        {/* Header */}
        <header className="mt-4 mb-6">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-1">
            Account settings
          </h1>
          <p className="text-sm text-slate-400">
            Manage your profile, username, and account safety.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile card */}
          <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/40">
            <h2 className="text-lg font-semibold mb-1">Profile</h2>
            <p className="text-xs text-slate-400 mb-4">
              These details are used across Onyva and for future social or
              sharing features.
            </p>

            <form
              onSubmit={handleSaveProfile}
              className="space-y-4 sm:space-y-5"
            >
              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                  Email
                </label>
                <p className="text-sm sm:text-base text-slate-100 bg-slate-900/60 rounded-xl border border-white/5 px-3 py-2">
                  {profile?.email ?? user.email}
                </p>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40 max-w-md"
                  value={profile?.name ?? ""}
                  onChange={(e) =>
                    setProfile((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev
                    )
                  }
                  disabled={profileLoading}
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40 max-w-md"
                  value={profile?.username ?? ""}
                  onChange={(e) =>
                    setProfile((prev) =>
                      prev ? { ...prev, username: e.target.value } : prev
                    )
                  }
                  disabled={profileLoading}
                  placeholder="your.username"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Lowercase letters, numbers, dots and underscores only.
                </p>
              </div>

              {profileMessage && (
                <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-200">
                  {profileMessage}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                {profileLoading && (
                  <p className="text-[11px] text-slate-500">
                    Loading profile details...
                  </p>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <Link
                    href="/"
                    className="hidden sm:inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-white/10 text-xs sm:text-sm text-slate-200 hover:bg-white/5 transition"
                  >
                    Back to dashboard
                  </Link>
                  <button
                    type="submit"
                    disabled={profileLoading || profileSaving}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
                  >
                    {profileSaving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Danger zone */}
          <section className="rounded-2xl border border-red-500/40 bg-red-950/70 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-red-900/40">
            <h2 className="text-lg font-semibold text-red-50 mb-1">
              Danger zone
            </h2>
            <p className="text-xs text-red-100/80 mb-4">
              This will remove your account and every dream linked to it. There
              is no undo.
            </p>

            {errorMessage && (
              <div className="mb-3 rounded-xl border border-red-500/70 bg-red-950 px-3 py-2 text-xs text-red-100">
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-xs sm:text-sm font-medium text-white shadow-md shadow-red-700/40 transition"
            >
              {deleting ? "Deleting account..." : "Delete my account"}
            </button>

            <p className="mt-3 text-[11px] text-red-100/80">
              All dreams and data associated with this email will be deleted
              from Onyva.
            </p>

            <div className="mt-4 border-t border-red-500/30 pt-3">
              <p className="text-[11px] text-red-100/70">
                If you only want a break, you can simply log out and come back
                later. This option is for permanent removal.
              </p>
            </div>
          </section>
        </div>

        {/* Mobile back link */}
        <div className="mt-6 sm:hidden">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-white/10 text-xs text-slate-200 hover:bg-white/5 transition"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
