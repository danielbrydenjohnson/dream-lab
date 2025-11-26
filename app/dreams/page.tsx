"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebaseAuth";
import TopNav from "@/components/TopNav";

type Dream = {
  id: string;
  title?: string;
  rawText: string;
  createdAt: any; // Firestore Timestamp or string
};

export default function DreamsPage() {
  const router = useRouter();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) {
      setDreams([]);
      return;
    }

    const dreamsRef = collection(db, "dreams");
    const q = query(
      dreamsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Dream, "id">),
      }));
      setDreams(items);
    });

    return () => unsubscribe();
  }, [userId]);

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

  const trimmedSearch = searchTerm.trim().toLowerCase();

  const filteredDreams =
    trimmedSearch.length === 0
      ? dreams
      : dreams.filter((dream) => {
          const title = (dream.title || "").toLowerCase();
          const text = dream.rawText.toLowerCase();
          return (
            title.includes(trimmedSearch) || text.includes(trimmedSearch)
          );
        });

  if (authChecked && !userId) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <TopNav />
          <div className="mt-8 text-center">
            <p className="mb-4">
              You need to be logged in to see your dreams.
            </p>
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

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">Your dreams</h1>
          <Link
            href="/dreams/new"
            className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
          >
            Write a new dream
          </Link>
        </div>

        {dreams.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
              Search dreams
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or text..."
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Showing {filteredDreams.length} of {dreams.length} dreams
              {trimmedSearch ? ` for "${searchTerm}"` : ""}.
            </p>
          </div>
        )}

        {dreams.length === 0 ? (
          <p className="text-center text-slate-400 mt-10">
            No dreams saved yet. Start by logging your first one.
          </p>
        ) : filteredDreams.length === 0 ? (
          <p className="text-center text-slate-400 mt-10">
            No dreams match your search.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredDreams.map((dream) => (
              <Link
                key={dream.id}
                href={`/dreams/${dream.id}`}
                className="block p-4 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-600 hover:bg-slate-800 transition"
              >
                <p className="text-xs text-slate-400 mb-1">
                  {formatDate(dream.createdAt)}
                </p>
                <p className="text-white font-semibold mb-1">
                  {dream.title?.trim() || "Untitled dream"}
                </p>
                <p className="text-slate-300 line-clamp-2 whitespace-pre-line text-sm">
                  {dream.rawText}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
