"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseAuth";
import TopNav from "@/components/TopNav";

type Dream = {
  id: string;
  title?: string;
  rawText: string;
  createdAt: any; // Firestore Timestamp or string
  userId?: string;
  psychInterpretation?: string;
  mysticInterpretation?: string;
  symbols?: string[];
  themes?: string[];
};

export default function DreamDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = (params as any).id as string | string[] | undefined;
  const id =
    typeof rawId === "string"
      ? rawId
      : Array.isArray(rawId)
      ? rawId[0]
      : undefined;

  const [dream, setDream] = useState<Dream | null>(null);
  const [loading, setLoading] = useState(true);

  const [psychText, setPsychText] = useState<string | null>(null);
  const [mysticText, setMysticText] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [interpreting, setInterpreting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Fetch dream
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setDream(null);
      return;
    }

    async function fetchDream() {
      try {
        const ref = doc(db, "dreams", id as string);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as Omit<Dream, "id">;
          const fullDream: Dream = { id: snap.id, ...data };
          setDream(fullDream);

          setPsychText(fullDream.psychInterpretation ?? null);
          setMysticText(fullDream.mysticInterpretation ?? null);
          setSymbols(fullDream.symbols ?? []);
          setThemes(fullDream.themes ?? []);
        } else {
          setDream(null);
        }
      } catch (error) {
        console.error("Error fetching dream:", error);
        setDream(null);
      } finally {
        setLoading(false);
      }
    }

    fetchDream();
  }, [id]);

  // Decide ownership once we know both dream and auth state
  useEffect(() => {
    if (!authChecked) return;
    if (!dream) return;

    if (!userId) {
      setIsOwner(false);
      return;
    }

    setIsOwner(dream.userId === userId);
  }, [authChecked, dream, userId]);

  function formatDate(value: any) {
    if (!value) return "";
    if (typeof value === "string") {
      return new Date(value).toLocaleString();
    }
    if (value.toDate) {
      return value.toDate().toLocaleString();
    }
    return String(value);
  }

  async function handleInterpretation() {
    if (!dream || !isOwner) return;

    setInterpreting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/interpret-dream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dreamText: dream.rawText,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      const newPsych = data.psychInterpretation ?? null;
      const newMystic = data.mysticInterpretation ?? null;
      const newSymbols = Array.isArray(data.symbols) ? data.symbols : [];
      const newThemes = Array.isArray(data.themes) ? data.themes : [];

      // Update local state
      setPsychText(newPsych);
      setMysticText(newMystic);
      setSymbols(newSymbols);
      setThemes(newThemes);

      // Persist to Firestore as the logged in owner
      const ref = doc(db, "dreams", dream.id);
      await updateDoc(ref, {
        psychInterpretation: newPsych ?? "",
        mysticInterpretation: newMystic ?? "",
        symbols: newSymbols,
        themes: newThemes,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error calling interpret-dream API or saving:", error);
      setErrorMessage(
        "Something went wrong generating or saving the interpretation."
      );
    } finally {
      setInterpreting(false);
    }
  }

  async function handleDelete() {
    if (!dream || !id || !isOwner) return;
    if (!confirm("Delete this dream permanently?")) return;

    setDeleting(true);
    try {
      const ref = doc(db, "dreams", id as string);
      await deleteDoc(ref);
      router.push("/dreams");
    } catch (error) {
      console.error("Error deleting dream:", error);
      alert("Failed to delete dream. Check console.");
      setDeleting(false);
    }
  }

  const isStillLoading =
    loading || !authChecked || (dream && isOwner === null);

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

        {isStillLoading ? (
          <div className="mt-20 flex justify-center">
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-5 shadow-xl shadow-black/40 text-center">
              <p className="text-sm text-slate-300">Loading dream...</p>
            </div>
          </div>
        ) : !userId ? (
          // No auth
          <div className="mt-20 flex justify-center">
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-6 shadow-xl shadow-black/40 text-center">
              <h1 className="text-xl font-semibold mb-3">
                You need to log in
              </h1>
              <p className="text-sm text-slate-300 mb-5">
                You must be logged in to view this dream.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition transform hover:-translate-y-0.5"
              >
                Go to login
              </Link>
            </div>
          </div>
        ) : !dream ? (
          // Not found
          <div className="mt-20 flex justify-center">
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-6 shadow-xl shadow-black/40 text-center">
              <h1 className="text-xl font-semibold mb-3">Dream not found</h1>
              <p className="text-sm text-slate-300 mb-5">
                This dream does not exist or may have been deleted.
              </p>
              <Link
                href="/dreams"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition transform hover:-translate-y-0.5"
              >
                Back to dreams
              </Link>
            </div>
          </div>
        ) : isOwner === false ? (
          // Not owner
          <div className="mt-20 flex justify-center">
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-6 shadow-xl shadow-black/40 text-center">
              <h1 className="text-xl font-semibold mb-3">
                You do not have access
              </h1>
              <p className="text-sm text-slate-300 mb-5">
                This dream belongs to another user.
              </p>
              <Link
                href="/dreams"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition transform hover:-translate-y-0.5"
              >
                Back to your dreams
              </Link>
            </div>
          </div>
        ) : (
          // Owner view
          <div className="mt-4 mb-10">
            {/* Breadcrumb and actions */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/dreams"
                className="inline-flex items-center text-xs sm:text-sm text-slate-300 hover:text-white"
              >
                <span className="mr-1 text-slate-400">{"←"}</span>
                Back to dreams
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/dreams/${dream.id}/edit`}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-100 border border-white/10 transition"
                >
                  Edit
                </Link>

                <button
                  onClick={handleInterpretation}
                  disabled={interpreting}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition"
                >
                  {interpreting ? "Interpreting..." : "Generate interpretation"}
                </button>

                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-xs sm:text-sm font-medium text-white transition"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>

            {/* Header */}
            <header className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                {formatDate(dream.createdAt)}
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
                {dream.title?.trim() || "Untitled dream"}
              </h1>
              <p className="text-sm text-slate-400">
                Full entry plus psychological and mystical interpretations.
              </p>
            </header>

            {errorMessage && (
              <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-950/60 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            {/* Main layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Dream text */}
              <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
                <h2 className="text-lg font-semibold mb-3">Dream text</h2>
                <p className="whitespace-pre-line text-sm sm:text-base text-slate-100 leading-relaxed">
                  {dream.rawText}
                </p>
              </section>

              {/* Symbols and themes side panel */}
              <aside className="space-y-4">
                <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
                  <h2 className="text-sm font-semibold mb-2">Key symbols</h2>
                  {symbols.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No symbols extracted yet. Generate an interpretation to
                      see them.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {symbols.map((symbol, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-[11px] text-slate-100 border border-white/10"
                        >
                          {symbol}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
                  <h2 className="text-sm font-semibold mb-2">Themes</h2>
                  {themes.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No themes extracted yet. Generate an interpretation to see
                      them.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {themes.map((theme, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-[11px] text-slate-100 border border-white/10"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              </aside>
            </div>

            {/* Interpretations */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
                <h2 className="text-lg font-semibold mb-3">
                  Psychological interpretation
                </h2>
                {psychText ? (
                  <p className="text-sm text-slate-100 whitespace-pre-line leading-relaxed">
                    {psychText}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    Click "Generate interpretation" to see a psychology based
                    view of this dream.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
                <h2 className="text-lg font-semibold mb-3">
                  Mystical interpretation
                </h2>
                {mysticText ? (
                  <p className="text-sm text-slate-100 whitespace-pre-line leading-relaxed">
                    {mysticText}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    Click "Generate interpretation" to see a more symbolic,
                    mystical view of this dream.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
