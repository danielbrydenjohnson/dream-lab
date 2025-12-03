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
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebaseAuth";
import TopNav from "@/components/TopNav";

type Dream = {
  id: string;
  title?: string;
  rawText: string;
  createdAt: any; // Firestore Timestamp or string
  psychInterpretation?: string;
  mysticInterpretation?: string;
  sharedWithUserIds?: string[];
};

export default function DreamsPage() {
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
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Dream, "id">),
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
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-md p-6 shadow-xl shadow-black/40">
              <h1 className="text-2xl font-semibold mb-3">
                Sign in to continue
              </h1>
              <p className="text-sm text-slate-300 mb-5">
                You need to be logged in to view and search your dreams.
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

        {/* Header */}
        <div className="mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Your dreams
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Browse, search, and revisit the simulations you have already
              captured.
            </p>
          </div>
          <Link
            href="/dreams/new"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
          >
            Write a new dream
          </Link>
        </div>

        {/* Search */}
        {dreams.length > 0 && (
          <div className="mb-5 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-md p-4 sm:p-5 shadow-lg shadow-black/40">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                  Search dreams
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title or text..."
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                />
              </div>
              <div className="text-xs text-slate-400">
                <p className="mb-1">
                  Showing{" "}
                  <span className="text-slate-100 font-medium">
                    {filteredDreams.length}
                  </span>{" "}
                  of{" "}
                  <span className="text-slate-100 font-medium">
                    {dreams.length}
                  </span>{" "}
                  dreams
                </p>
                {trimmedSearch && (
                  <p className="text-xs text-slate-500">
                    Filtered by{" "}
                    <span className="text-slate-200">
                      "{searchTerm.trim()}"
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* States */}
        {dreams.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-6 text-center shadow-lg shadow-black/40">
            <h2 className="text-lg font-semibold mb-2">
              No dreams saved yet
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Start by logging your first dream. Over time this page becomes
              your archive of strange storylines, recurring places, and familiar
              characters.
            </p>
            <Link
              href="/dreams/new"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition"
            >
              Log your first dream
            </Link>
          </section>
        ) : filteredDreams.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 text-center shadow-lg shadow-black/40">
            <h2 className="text-lg font-semibold mb-2">
              No dreams match your search
            </h2>
            <p className="text-sm text-slate-400">
              Try a different word or clear the search to see all your dreams
              again.
            </p>
          </section>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredDreams.map((dream) => {
              const interpreted =
                Boolean(dream.psychInterpretation) ||
                Boolean(dream.mysticInterpretation);

              const sharedCount =
                dream.sharedWithUserIds && dream.sharedWithUserIds.length
                  ? dream.sharedWithUserIds.length
                  : 0;

              return (
                <Link
                  key={dream.id}
                  href={`/dreams/${dream.id}`}
                  className="block rounded-2xl border border-white/10 bg-slate-950/80 p-4 sm:p-5 hover:border-indigo-400/80 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-indigo-500/20 transition transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                        {formatDate(dream.createdAt)}
                      </p>
                      <p className="text-base sm:text-lg font-semibold text-white">
                        {dream.title?.trim() || "Untitled dream"}
                      </p>
                    </div>

                    {(interpreted || sharedCount > 0) && (
                      <div className="flex flex-col items-end gap-1">
                        {interpreted && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium text-emerald-300 border border-emerald-500/40">
                            Interpreted
                          </span>
                        )}
                        {sharedCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-medium text-sky-300 border border-sky-500/40">
                            Shared with {sharedCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-3 whitespace-pre-line">
                    {dream.rawText}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
