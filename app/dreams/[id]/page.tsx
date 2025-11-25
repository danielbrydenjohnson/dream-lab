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

type Dream = {
  id: string;
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

  // Loading state
  if (loading || !authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Loading dream...</p>
      </main>
    );
  }

  // No auth
  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <p className="mb-4">You must be logged in to view this dream.</p>
          <Link
            href="/login"
            className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  // Not found
  if (!dream) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <p className="mb-4">Dream not found.</p>
          <Link
            href="/dreams"
            className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
          >
            Back to dreams
          </Link>
        </div>
      </main>
    );
  }

  // Not owner
  if (isOwner === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <p className="mb-4">You do not have access to this dream.</p>
          <Link
            href="/dreams"
            className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
          >
            Back to your dreams
          </Link>
        </div>
      </main>
    );
  }

  // Owner view
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/dreams"
            className="text-sm text-slate-300 hover:text-white"
          >
            ← Back to dreams
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/dreams/${dream.id}/edit`}
              className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-sm font-medium"
            >
              Edit
            </Link>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-sm font-medium"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>

            <button
              onClick={handleInterpretation}
              disabled={interpreting}
              className="px-3 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-sm font-medium"
            >
              {interpreting ? "Interpreting..." : "Generate interpretation"}
            </button>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-2">
          Dream from {formatDate(dream.createdAt)}
        </h1>

        <section className="mt-4 p-4 rounded-md bg-slate-800 mb-6">
          <h2 className="text-xl font-semibold mb-2">Dream text</h2>
          <p className="whitespace-pre-line text-slate-100">
            {dream.rawText}
          </p>
        </section>

        {errorMessage && (
          <p className="mb-4 text-sm text-red-400">{errorMessage}</p>
        )}

        <section className="p-4 rounded-md bg-slate-800 mb-4">
          <h2 className="text-xl font-semibold mb-2">
            Psychological interpretation
          </h2>
          {psychText ? (
            <p className="text-slate-100 whitespace-pre-line">
              {psychText}
            </p>
          ) : (
            <p className="text-slate-400 text-sm">
              Click "Generate interpretation" to see a psychology based view of
              this dream.
            </p>
          )}
        </section>

        <section className="p-4 rounded-md bg-slate-800 mb-4">
          <h2 className="text-xl font-semibold mb-2">
            Mystical interpretation
          </h2>
          {mysticText ? (
            <p className="text-slate-100 whitespace-pre-line">
              {mysticText}
            </p>
          ) : (
            <p className="text-slate-400 text-sm">
              Click "Generate interpretation" to see a more symbolic, mystical
              view of this dream.
            </p>
          )}
        </section>

        <section className="p-4 rounded-md bg-slate-800 mb-4">
          <h2 className="text-xl font-semibold mb-3">Key symbols</h2>
          {symbols.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No symbols extracted yet. Generate an interpretation to see them.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {symbols.map((symbol, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-slate-700 text-xs text-slate-100"
                >
                  {symbol}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="p-4 rounded-md bg-slate-800">
          <h2 className="text-xl font-semibold mb-3">Themes</h2>
          {themes.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No themes extracted yet. Generate an interpretation to see them.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-slate-700 text-xs text-slate-100"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
