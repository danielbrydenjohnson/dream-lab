"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Dream = {
  id: string;
  title?: string;
  rawText: string;
  createdAt: any;
};

export default function EditDreamPage() {
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
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          setTitle(fullDream.title ?? "");
          setText(fullDream.rawText);
        } else {
          setDream(null);
        }
      } catch (error) {
        console.error("Error loading dream for edit:", error);
        setDream(null);
      } finally {
        setLoading(false);
      }
    }

    fetchDream();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    if (!title.trim()) {
      setErrorMessage("Title cannot be empty.");
      return;
    }

    if (!text.trim()) {
      setErrorMessage("Dream text cannot be empty.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const ref = doc(db, "dreams", id as string);
      const finalTitle = title.trim();

      await updateDoc(ref, {
        title: finalTitle,
        rawText: text.trim(),
        updatedAt: serverTimestamp(),
      });

      router.push(`/dreams/${id}`);
    } catch (error) {
      console.error("Error saving edited dream:", error);
      setErrorMessage("Failed to save changes. Check console.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Loading dream...</p>
      </main>
    );
  }

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

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/dreams/${id}`}
            className="text-sm text-slate-300 hover:text-white"
          >
            ← Back to dream
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-4">Edit dream</h1>

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
              Title is required. Keep something that helps you recognise the
              dream at a glance.
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
              placeholder="Edit your dream..."
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
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
