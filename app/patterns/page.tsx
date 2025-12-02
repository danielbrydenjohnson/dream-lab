"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebaseAuth";
import TopNav from "@/components/TopNav";

type Dream = {
  id: string;
  rawText: string;
  createdAt: any;
  userId?: string;
  symbols?: string[];
  themes?: string[];
};

type CountItem = {
  value: string;
  count: number;
};

export default function PatternsPage() {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadingDreams, setLoadingDreams] = useState(true);

  // Cached analysis
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [lastAnalysedAt, setLastAnalysedAt] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [showAllSymbols, setShowAllSymbols] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Load dreams
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
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Dream, "id">),
        }));
        setDreams(items);
        setLoadingDreams(false);
      },
      (error) => {
        console.error("Error loading dreams for patterns:", error);
        setDreams([]);
        setLoadingDreams(false);
      }
    );

    return () => unsub();
  }, [userId]);

  // Load last saved analysis
  useEffect(() => {
    if (!userId) {
      setAnalysis(null);
      setLastAnalysedAt(null);
      return;
    }

    async function loadAnalysis(uid: string) {
      try {
        const ref = doc(db, "patternAnalyses", uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          setAnalysis(data.analysis ?? null);
          setLastAnalysedAt(data.createdAt ?? null);
        } else {
          setAnalysis(null);
          setLastAnalysedAt(null);
        }
      } catch (error) {
        console.error("Error loading saved pattern analysis:", error);
      }
    }

    loadAnalysis(userId);
  }, [userId]);

  const totalDreams = dreams.length;

  const { symbolCounts, themeCounts } = useMemo(() => {
    const symbolMap = new Map<string, number>();
    const themeMap = new Map<string, number>();

    for (const dream of dreams) {
      const symbols = dream.symbols ?? [];
      const themes = dream.themes ?? [];

      for (const s of symbols) {
        const key = s.trim();
        if (!key) continue;
        symbolMap.set(key, (symbolMap.get(key) ?? 0) + 1);
      }

      for (const t of themes) {
        const key = t.trim();
        if (!key) continue;
        themeMap.set(key, (themeMap.get(key) ?? 0) + 1);
      }
    }

    const symbolCounts: CountItem[] = Array.from(symbolMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    const themeCounts: CountItem[] = Array.from(themeMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    return { symbolCounts, themeCounts };
  }, [dreams]);

  function formatDate(value: any) {
    if (!value) return "";
    if (typeof value === "string") {
      return new Date(value).toLocaleDateString();
    }
    if (value.toDate) {
      return value.toDate().toLocaleDateString();
    }
    return String(value);
  }

  function formatLastAnalysedLabel(createdAtIso: string | null) {
    if (!createdAtIso) return null;

    const date = new Date(createdAtIso);
    if (Number.isNaN(date.getTime())) return null;

    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Last analysed today";
    if (diffDays === 1) return "Last analysed 1 day ago";
    return `Last analysed ${diffDays} days ago`;
  }

  async function handleAnalysePatterns() {
    setAnalysisError(null);

    // Enforce one analysis every 30 days
    if (lastAnalysedAt) {
      const last = new Date(lastAnalysedAt);
      if (!Number.isNaN(last.getTime())) {
        const diffMs = Date.now() - last.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 30) {
          const when =
            diffDays <= 0
              ? "today"
              : diffDays === 1
              ? "1 day ago"
              : `${diffDays} days ago`;

          setAnalysisError(
            `You last analysed your patterns ${when}. You can run a new analysis once 30 days have passed.`
          );
          return;
        }
      }
    }

    if (totalDreams < 3) {
      const msg =
        "You have only logged a few dreams so far. Patterns are still forming. Keep recording dreams and re run analysis once more data appears.";

      setAnalysis(msg);
      const now = new Date().toISOString();
      setLastAnalysedAt(now);

      if (userId) {
        await setDoc(doc(db, "patternAnalyses", userId), {
          userId,
          createdAt: now,
          totalDreamsAtAnalysis: totalDreams,
          symbolCountsSnapshot: symbolCounts,
          themeCountsSnapshot: themeCounts,
          analysis: msg,
        });
      }
      return;
    }

    try {
      setAnalysing(true);

      const dreamsForApi = dreams.map((dream) => ({
        id: dream.id,
        createdAt: formatDate(dream.createdAt),
        symbols: dream.symbols ?? [],
        themes: dream.themes ?? [],
      }));

      const res = await fetch("/api/analyse-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dreams: dreamsForApi,
          totalDreams,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const text = data.analysis ?? "No analysis returned.";

      const nowIso = new Date().toISOString();

      setAnalysis(text);
      setLastAnalysedAt(nowIso);

      if (userId) {
        await setDoc(doc(db, "patternAnalyses", userId), {
          userId,
          createdAt: nowIso,
          totalDreamsAtAnalysis: totalDreams,
          symbolCountsSnapshot: symbolCounts,
          themeCountsSnapshot: themeCounts,
          analysis: text,
        });
      }
    } catch (error) {
      console.error("Error analysing patterns:", error);
      setAnalysisError("Failed to analyse patterns. Try again later.");
    } finally {
      setAnalysing(false);
    }
  }

  if (authChecked && !userId) {
    return (
      <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
          <div className="absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <TopNav />
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-6 shadow-xl shadow-black/40">
              <h1 className="text-2xl font-semibold mb-3">
                Sign in to see your patterns
              </h1>
              <p className="text-sm text-slate-300 mb-5">
                You need to be logged in to see your dream patterns.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition"
              >
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const visibleSymbolCounts = showAllSymbols
    ? symbolCounts
    : symbolCounts.slice(0, 6);

  const visibleThemeCounts = showAllThemes
    ? themeCounts
    : themeCounts.slice(0, 6);

  const lastAnalysedLabel = formatLastAnalysedLabel(lastAnalysedAt);

  return (
    <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <TopNav />

        {/* Header */}
        <div className="mt-4 mb-6">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-1">
            Dream patterns
          </h1>
          <p className="text-sm text-slate-400">
            Symbols and themes that keep showing up across your dreams.
          </p>
        </div>

        {/* Summary */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
          {loadingDreams ? (
            <p className="text-slate-300 text-sm">Loading your dreams...</p>
          ) : totalDreams === 0 ? (
            <div>
              <p className="text-slate-100 mb-2">
                You have not logged any dreams yet.
              </p>
              <p className="text-slate-400 text-sm mb-4">
                Start recording your dreams. As your archive grows, recurring
                symbols and themes will emerge and this page will become
                meaningful.
              </p>
              <Link
                href="/dreams/new"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition"
              >
                Write your first dream
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-semibold mb-1">
                You have logged {totalDreams} dream
                {totalDreams === 1 ? "" : "s"}.
              </p>
              <p className="text-slate-400 text-sm">
                Each dream adds more data to your personal dream map.
              </p>
              {lastAnalysedLabel && (
                <p className="text-xs text-slate-500 mt-1">
                  {lastAnalysedLabel}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Symbols + Themes */}
        <section className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-4 sm:p-5 shadow-lg shadow-black/40">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Top symbols</h2>
              {symbolCounts.length > 6 && (
                <button
                  onClick={() => setShowAllSymbols((v) => !v)}
                  className="text-[11px] px-3 py-1 rounded-full border border-indigo-400/60 text-indigo-300 hover:bg-indigo-500/10 transition"
                >
                  {showAllSymbols ? "Show top only" : "Show all"}
                </button>
              )}
            </div>

            {symbolCounts.length === 0 ? (
              <p className="text-slate-400 text-sm">
                No symbols extracted yet. Generate interpretations to start
                building this list.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visibleSymbolCounts.map((item) => (
                  <span
                    key={item.value}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 text-[11px] text-slate-100 border border-white/10"
                  >
                    <span>{item.value}</span>
                    <span className="text-slate-400">{item.count}×</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-4 sm:p-5 shadow-lg shadow-black/40">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Top themes</h2>
              {themeCounts.length > 6 && (
                <button
                  onClick={() => setShowAllThemes((v) => !v)}
                  className="text-[11px] px-3 py-1 rounded-full border border-indigo-400/60 text-indigo-300 hover:bg-indigo-500/10 transition"
                >
                  {showAllThemes ? "Show top only" : "Show all"}
                </button>
              )}
            </div>

            {themeCounts.length === 0 ? (
              <p className="text-slate-400 text-sm">
                No themes extracted yet. Generate interpretations to start
                building this list.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visibleThemeCounts.map((item) => (
                  <span
                    key={item.value}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 text-[11px] text-slate-100 border border-white/10"
                  >
                    <span>{item.value}</span>
                    <span className="text-slate-400">{item.count}×</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* AI Overview */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">
                AI overview of your dream patterns
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                A concise summary connecting your recurring symbols and themes.
              </p>
              <p className="text-[11px] text-slate-500">
                To save compute, this analysis can be run at most once every 30
                days.
              </p>
              {lastAnalysedLabel && (
                <p className="text-[11px] text-slate-500 mt-1">
                  {lastAnalysedLabel}
                </p>
              )}
            </div>
            <button
              onClick={handleAnalysePatterns}
              disabled={analysing || totalDreams === 0}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition"
            >
              {analysing
                ? "Analysing..."
                : analysis
                ? "Re analyse patterns"
                : "Analyse patterns"}
            </button>
          </div>

          {analysisError && (
            <p className="text-sm text-red-400 mb-2">{analysisError}</p>
          )}

          {analysis ? (
            <p className="text-sm text-slate-100 whitespace-pre-line leading-relaxed">
              {analysis}
            </p>
          ) : !analysing ? (
            <p className="text-sm text-slate-400">
              Run an analysis to get a high level view of your recurring
              symbols and themes.
            </p>
          ) : null}
        </section>

        {/* Recent dreams */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
          <h2 className="text-lg font-semibold mb-3">
            Recent dreams used in this analysis
          </h2>
          <ul className="space-y-3 text-sm">
            {dreams.slice(0, 10).map((dream) => (
              <li
                key={dream.id}
                className="rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-inner shadow-black/40"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-400">
                    {formatDate(dream.createdAt)}
                  </span>
                  <Link
                    href={`/dreams/${dream.id}`}
                    className="text-[11px] text-indigo-300 hover:text-indigo-200"
                  >
                    View dream
                  </Link>
                </div>
                <p className="text-slate-100 line-clamp-2 mb-2">
                  {dream.rawText}
                </p>

                <div className="flex flex-wrap gap-2">
                  {(dream.symbols ?? []).slice(0, 4).length > 0 && (
                    <span className="text-[11px] text-slate-400 mr-1">
                      Symbols:
                    </span>
                  )}
                  {(dream.symbols ?? [])
                    .slice(0, 4)
                    .map((symbol, idx) => (
                      <span
                        key={`sym-${idx}`}
                        className="px-2 py-0.5 rounded-full bg-slate-900 text-[10px] text-slate-100 border border-white/10"
                      >
                        {symbol}
                      </span>
                    ))}
                </div>

                {(dream.themes ?? []).slice(0, 4).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-[11px] text-slate-400 mr-1">
                      Themes:
                    </span>
                    {(dream.themes ?? [])
                      .slice(0, 4)
                      .map((theme, idx) => (
                        <span
                          key={`theme-${idx}`}
                          className="px-2 py-0.5 rounded-full bg-slate-900 text-[10px] text-slate-100 border border-white/10"
                        >
                          {theme}
                        </span>
                      ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
