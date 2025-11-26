"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebaseAuth";
import { onAuthStateChanged } from "firebase/auth";
import TopNav from "@/components/TopNav";
import { calculateStreaks, DreamForStreaks } from "@/lib/streaks";

type Dream = {
  id: string;
  rawText: string;
  createdAt: any;
  userId?: string;
  psychInterpretation?: string;
  mysticInterpretation?: string;
};

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loadingDreams, setLoadingDreams] = useState(true);

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
      setLoadingDreams(false);
      return;
    }

    setLoadingDreams(true);

    const dreamsRef = collection(db, "dreams");
    const q = query(
      dreamsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Dream, "id">),
        }));
        setDreams(items);
        setLoadingDreams(false);
      },
      (error) => {
        console.error("Error loading dreams on home:", error);
        setDreams([]);
        setLoadingDreams(false);
      }
    );

    return () => unsub();
  }, [userId]);

  const totalDreams = dreams.length;
  const interpretedDreams = dreams.filter(
    (d) => d.psychInterpretation || d.mysticInterpretation
  ).length;
  const lastDream = dreams[0];

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

  // Helper to normalise createdAt to Date for streaks
  function toDateFromCreatedAt(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "string") {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value.toDate === "function") {
      const d = value.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    return null;
  }

  // Compute streak stats
  let currentStreak = 0;
  let bestStreak = 0;
  let daysLoggedThisWeek = 0;

  if (!loadingDreams && dreams.length > 0) {
    const streakInput: DreamForStreaks[] = dreams
      .map((d) => {
        const date = toDateFromCreatedAt(d.createdAt);
        return date ? { createdAt: date } : null;
      })
      .filter((d): d is DreamForStreaks => d !== null);

    if (streakInput.length > 0) {
      const stats = calculateStreaks(streakInput);
      currentStreak = stats.currentStreak;
      bestStreak = stats.bestStreak;
      daysLoggedThisWeek = stats.daysLoggedThisWeek;
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <TopNav />

        {!authChecked ? (
          <p className="text-slate-400">Checking your session...</p>
        ) : !userId ? (
          // LOGGED OUT VIEW
          <section className="mt-10 max-w-2xl mx-auto rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center">
            <h1 className="text-4xl font-bold mb-6">Dream Lab</h1>

            <p className="text-slate-300 text-lg leading-relaxed mb-8">
              <span className="text-white font-semibold">
                Every night your mind runs a hidden simulation.
              </span>
              <br />
              You wake up and forget the code.
              <br />
              Dream Lab is where you catch the fragments, stack them over time,
              and start to see the symbols and themes that always return.
            </p>

            <div className="flex justify-center gap-4">
              <Link
                href="/register"
                className="px-5 py-3 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="px-5 py-3 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 font-medium"
              >
                Log in
              </Link>
            </div>
          </section>
        ) : (
          // LOGGED IN DASHBOARD
          <>
            <section className="mt-2 mb-6">
              <h1 className="text-3xl font-bold mb-2">
                Your Dream Lab dashboard
              </h1>
              <p className="text-slate-400 text-sm">
                Quick overview of your dream activity and shortcuts to keep
                logging and exploring.
              </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Dreams logged
                </p>
                {loadingDreams ? (
                  <p className="text-2xl font-semibold text-slate-300">
                    ...
                  </p>
                ) : (
                  <p className="text-2xl font-semibold">{totalDreams}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Every entry makes patterns clearer.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Interpreted dreams
                </p>
                {loadingDreams ? (
                  <p className="text-2xl font-semibold text-slate-300">
                    ...
                  </p>
                ) : (
                  <p className="text-2xl font-semibold">
                    {interpretedDreams}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Use AI to extract meaning, symbols and themes.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Last dream
                </p>
                {loadingDreams ? (
                  <p className="text-sm text-slate-300">Loading...</p>
                ) : lastDream ? (
                  <>
                    <p className="text-sm text-slate-100 mb-1">
                      {formatDate(lastDream.createdAt)}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {lastDream.rawText}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">
                    No dreams logged yet.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Dream streak
                </p>
                {loadingDreams ? (
                  <p className="text-2xl font-semibold text-slate-300">
                    ...
                  </p>
                ) : (
                  <>
                    <p className="text-2xl font-semibold">
                      {currentStreak} day{currentStreak === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Best streak: {bestStreak} day
                      {bestStreak === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-slate-500">
                      This week: {daysLoggedThisWeek} day
                      {daysLoggedThisWeek === 1 ? "" : "s"}
                    </p>
                  </>
                )}
              </div>
            </section>

            <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <h2 className="text-xl font-semibold mb-3">
                What do you want to do next?
              </h2>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dreams/new"
                  className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
                >
                  Write a new dream
                </Link>
                <Link
                  href="/dreams"
                  className="px-4 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  View all dreams
                </Link>
                <Link
                  href="/patterns"
                  className="px-4 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  Explore patterns
                </Link>
              </div>
            </section>

            {totalDreams === 0 && !loadingDreams && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <h2 className="text-lg font-semibold mb-2">
                  Start mapping your dream world
                </h2>
                <p className="text-slate-400 text-sm mb-3">
                  The real value comes once you have a history of dreams. Aim to
                  record at least a handful over the next few weeks. Then the
                  patterns view will begin to show recurring symbols and themes.
                </p>
                <Link
                  href="/dreams/new"
                  className="inline-block px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
                >
                  Log your first dream
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
