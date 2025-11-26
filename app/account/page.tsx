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
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Checking your session...</p>
      </main>
    );
  }

  if (!user) {
    return null;
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

          {/* Profile details */}
          <form onSubmit={handleSaveProfile} className="mb-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Email
              </label>
              <p className="text-base text-slate-100">
                {profile?.email ?? user.email}
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Name
              </label>
              <input
                type="text"
                className="w-full max-w-md rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={profile?.name ?? ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, name: e.target.value } : prev
                  )
                }
                disabled={profileLoading}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full max-w-md rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={profile?.username ?? ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, username: e.target.value } : prev
                  )
                }
                disabled={profileLoading}
              />
              <p className="mt-1 text-xs text-slate-500">
                Lowercase letters, numbers, dots and underscores only.
              </p>
            </div>

            {profileMessage && (
              <p className="text-sm text-emerald-400">{profileMessage}</p>
            )}

            <button
              type="submit"
              disabled={profileLoading || profileSaving}
              className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-sm font-medium"
            >
              {profileSaving ? "Saving..." : "Save profile"}
            </button>
          </form>

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
