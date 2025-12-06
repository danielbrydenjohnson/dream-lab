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
import DreamInsightPanel from "@/components/DreamInsightPanel";

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

        {!authChecked ? (
          <div className="mt-10 flex justify-center">
            <p className="text-slate-400 text-sm">Checking your session...</p>
          </div>
        ) : !userId ? (
          // LOGGED OUT VIEW
          <div className="mt-16 mb-24">
            {/* Hero */}
            <section className="flex flex-col items-center text-center">
              <div className="max-w-2xl">
                <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
                  Onyva
                </h1>
                <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-6">
                  <span className="text-white font-semibold">
                    A dream intelligence system that helps you understand the
                    patterns behind your nights.
                  </span>
                </p>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                  Your dreams are not random. They are signals from the deeper
                  layers of your mind. Onyva helps you capture them, interpret
                  them, and follow the threads that appear over weeks, months,
                  and years.
                </p>

                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm sm:text-base font-medium text-white shadow-lg shadow-indigo-500/25 transition transform hover:-translate-y-0.5"
                  >
                    Get started
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-sm sm:text-base font-medium text-slate-100 transition"
                  >
                    Log in
                  </Link>
                </div>

                <p className="mt-6 text-xs text-slate-500">
                  No feeds, no likes. Just you, your dreams, and the patterns
                  underneath.
                </p>

                <p className="mt-2 text-[11px] text-slate-600">
                  Onyva is evolving. New features are released regularly as we
                  build the first intelligent map of the dreaming mind.
                </p>
              </div>
            </section>

            {/* Divider */}
            <div className="mt-16 border-t border-slate-800/80" />

            {/* Section 1: What Onyva does today */}
            <section className="mt-10">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center">
                A place to record, understand, and explore your dreams.
              </h2>
              <div className="max-w-2xl mx-auto mt-6 space-y-6 text-sm sm:text-base text-slate-300">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-100 mb-1">
                    Record your dreams
                  </h3>
                  <p>
                    A calm space to write your dreams soon after waking. No
                    noise, no feeds, no judgement.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-100 mb-1">
                    AI enriched interpretations
                  </h3>
                  <p>
                    Thoughtful psychological and symbolic reflections generated
                    for each dream.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-100 mb-1">
                    Patterns across time
                  </h3>
                  <p>
                    Themes, symbols, and recurring emotions. Onyva highlights
                    the threads that keep showing up.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-100 mb-1">
                    Dream clusters and sharing
                  </h3>
                  <p>
                    See which dreams sit close together beneath the surface,
                    and share selected dreams with trusted friends.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Why dreams matter */}
            <section className="mt-16">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center">
                Your dreams are not random.
              </h2>
              <div className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 space-y-3 text-center">
                <p>
                  Every night, your mind runs a private simulation that blends
                  memory, emotion, and imagination. Most of it disappears the
                  moment you wake up. The rest becomes fragments.
                </p>
                <p>
                  Onyva helps you capture these fragments and see what they are
                  pointing to. Dreams are often the most honest data we have
                  about ourselves. We just rarely organise them.
                </p>
              </div>
            </section>

            {/* Section 3: Where Onyva is going */}
            <section className="mt-16 mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center">
                We are building something deeper.
              </h2>
              <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 text-center">
                Onyva is an ongoing project. Over time, it will grow into a full
                dream intelligence system with:
              </p>
              <ul className="max-w-2xl mx-auto mt-4 space-y-1 list-disc list-inside text-sm sm:text-base text-slate-300 text-left">
                <li>Emotional timelines</li>
                <li>Archetype detection</li>
                <li>Dream maps built from embeddings</li>
                <li>Voice logging with AI transcription</li>
                <li>Monthly psyche reports</li>
                <li>Lucid dreaming tools</li>
                <li>Dream reconstruction visuals</li>
                <li>Cross dream pattern discovery</li>
              </ul>
              <p className="mt-6 text-sm text-slate-300 text-center">
                You can start today. Onyva will grow with you.
              </p>
            </section>
          </div>
        ) : (
          // LOGGED IN DASHBOARD
          <>
            <section className="mt-6 mb-6">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
                Your dream overview
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                A quick snapshot of your dream activity, streaks, and shortcuts
                to keep logging and exploring.
              </p>
            </section>

            {/* Stats grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-900/20 p-4 sm:p-5 shadow-lg shadow-black/30">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                  Dreams logged
                </p>
                {loadingDreams ? (
                  <p className="text-3xl font-semibold text-slate-300">...</p>
                ) : (
                  <p className="text-3xl font-semibold">{totalDreams}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Each entry is another frame in the simulation.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-900/70 via-slate-900/60 to-slate-900/20 p-4 sm:p-5 shadow-lg shadow-black/30">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300 mb-1">
                  Interpreted
                </p>
                {loadingDreams ? (
                  <p className="text-3xl font-semibold text-slate-200">...</p>
                ) : (
                  <p className="text-3xl font-semibold">
                    {interpretedDreams}
                  </p>
                )}
                <p className="text-xs text-slate-300/80 mt-2">
                  AI reflections to pull out symbols and themes.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 shadow-lg shadow-black/30">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                  Last dream
                </p>
                {loadingDreams ? (
                  <p className="text-sm text-slate-300">Loading...</p>
                ) : lastDream ? (
                  <>
                    <p className="text-xs text-slate-400 mb-1">
                      {formatDate(lastDream.createdAt)}
                    </p>
                    <p className="text-xs text-slate-100/90 line-clamp-3">
                      {lastDream.rawText}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">
                    No dreams logged yet.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 shadow-lg shadow-black/30 flex flex-col justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                    Dream streak
                  </p>
                  {loadingDreams ? (
                    <p className="text-3xl font-semibold text-slate-300">
                      ...
                    </p>
                  ) : (
                    <p className="text-3xl font-semibold">
                      {currentStreak} day{currentStreak === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
                {!loadingDreams && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-slate-400">
                      Best streak: {""}
                      <span className="text-slate-100">
                        {bestStreak} day{bestStreak === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      This week: {""}
                      <span className="text-slate-100">
                        {daysLoggedThisWeek} day
                        {daysLoggedThisWeek === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Actions */}
            <section className="mb-8 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5">
              <h2 className="text-lg sm:text-xl font-semibold mb-3">
                What next
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mb-4">
                Capture last night while it is still fresh, or dive into the
                patterns you have already started.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dreams/new"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
                >
                  Write a new dream
                </Link>
                <Link
                  href="/dreams"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-slate-700 bg-slate-950/40 hover:bg-slate-800 text-sm font-medium text-slate-100 transition"
                >
                  View all dreams
                </Link>
                <Link
                  href="/patterns"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-slate-700 bg-slate-950/40 hover:bg-slate-800 text-sm font-medium text-slate-100 transition"
                >
                  Explore patterns
                </Link>
              </div>
            </section>

            {/* Empty state */}
            {totalDreams === 0 && !loadingDreams && (
              <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-5 sm:p-6 mb-6">
                <h2 className="text-lg font-semibold mb-2">
                  Start mapping your dream world
                </h2>
                <p className="text-sm text-slate-400 mb-4">
                  The real value kicks in once you have a history of dreams.
                  Aim to record at least a few over the next weeks and the
                  patterns view will start surfacing recurring symbols and
                  themes.
                </p>
                <Link
                  href="/dreams/new"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition"
                >
                  Log your first dream
                </Link>
              </section>
            )}

            {/* Dream insight panel */}
            <DreamInsightPanel />
          </>
        )}
      </div>
    </main>
  );
}
