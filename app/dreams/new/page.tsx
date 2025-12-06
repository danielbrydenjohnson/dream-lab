"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
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
      const finalText = text.trim();

      // 1) Create the dream doc (allowed by Firestore rules because user is authed)
      const docRef = await addDoc(collection(db, "dreams"), {
        userId,
        title: finalTitle,
        rawText: finalText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        psychInterpretation: "",
        mysticInterpretation: "",
        symbols: [],
        themes: [],
      });

      // 2) Ask server for embedding (no Firestore here, just OpenAI)
      const combinedText = `${finalTitle}\n\n${finalText}`;

      try {
        const res = await fetch("/api/embed-dream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: combinedText,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const embedding = data.embedding;

          if (Array.isArray(embedding)) {
            // 3) Write embedding from client side (user is authed so rules allow it)
            const ref = doc(db, "dreams", docRef.id);
            await updateDoc(ref, {
              embedding,
              updatedAt: serverTimestamp(),
            });
          } else {
            console.warn("No valid embedding returned from /api/embed-dream");
          }
        } else {
          const errorPayload = await res.json().catch(() => null);
          console.error(
            "embed-dream API error:",
            res.status,
            errorPayload || "(no body)"
          );
        }
      } catch (err) {
        console.error("Failed to call /api/embed-dream:", err);
      }

      router.push("/dreams");
    } catch (error) {
      console.error("Error saving dream:", error);
      setErrorMessage("Failed to save dream. Check console for details.");
      setSaving(false);
    }
  }

  if (authChecked && !userId) {
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
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-6 shadow-xl shadow-black/40">
              <h1 className="text-2xl font-semibold mb-3">
                You need to log in
              </h1>
              <p className="text-sm text-slate-300 mb-5">
                You need to be logged in to write and save dreams.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition transform hover:-translate-y-0.5"
              >
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
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

        {/* Breadcrumb */}
        <div className="mt-3 mb-4 flex items-center justify-between">
          <Link
            href="/dreams"
            className="inline-flex items-center text-xs sm:text-sm text-slate-300 hover:text-white"
          >
            <span className="mr-1 text-slate-400">{"←"}</span>
            Back to dreams
          </Link>
        </div>

        {/* Card */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/40">
          <header className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
              Write a new dream
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Capture as much detail as you can while it is still fresh. The AI
              will use this text for interpretations and pattern analysis.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                placeholder="For example: The collapsing staircase, The ocean of mirrors..."
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Title helps you and the AI refer back to this dream later.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Dream text <span className="text-red-400">*</span>
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-64 sm:h-72 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40 resize-vertical"
                placeholder="Write the dream as you remember it. Include places, people, emotions, and any strange details."
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Do not worry about perfect grammar. Honest detail is more
                useful than polished wording.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-200">
                {errorMessage}
              </div>
            )}

            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                You can generate interpretations after saving this dream.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
              >
                {saving ? "Saving..." : "Save dream"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
