"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebaseAuth";
import { onAuthStateChanged } from "firebase/auth";
import TopNav from "@/components/TopNav";

export default function NewDreamPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!userId) {
      setErrorMessage("You must be logged in to save a dream.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Please give this dream a title.");
      return;
    }

    if (!text.trim()) {
      setErrorMessage("Dream text cannot be empty.");
      return;
    }

    setSaving(true);

    try {
      const finalTitle = title.trim();

      await addDoc(collection(db, "dreams"), {
        userId,
        title: finalTitle,
        rawText: text.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        psychInterpretation: "",
        mysticInterpretation: "",
        symbols: [],
        themes: [],
      });

      router.push("/dreams");
    } catch (error) {
      console.error("Error saving dream:", error);
      setErrorMessage("Failed to save dream. Check console for details.");
      setSaving(false);
    }
  }

  if (authChecked && !userId) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <TopNav />
          <div className="mt-8 text-center">
            <p className="mb-4">You need to be logged in to write dreams.</p>
            <Link
              href="/login"
              className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
            >
              Go to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <TopNav />

        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/dreams"
            className="text-sm text-slate-300 hover:text-white"
          >
            ← Back to dreams
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-4">Write a new dream</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:outline-none"
              placeholder="For example: The collapsing staircase, The ocean of mirrors..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Title is required. It helps you and the AI refer back to this
              dream later.
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Dream text <span className="text-red-400">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-56 p-4 rounded-md bg-slate-800 text-white placeholder-slate-400 focus:outline-none"
              placeholder="Write your dream as you remember it..."
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-400">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-white font-medium"
          >
            {saving ? "Saving..." : "Save dream"}
          </button>
        </form>
      </div>
    </main>
  );
}
