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
  embedding?: number[];
};

type CountItem = {
  value: string;
  count: number;
};

type ClusterDream = {
  id: string;
  title?: string;
  rawText: string;
  createdAt: any;
  symbols: string[];
  themes: string[];
  embedding: number[];
};

type DreamCluster = {
  id: string;
  dreams: ClusterDream[];
  centroid: number[];
  dreamCount: number;
  startDate: Date;
  endDate: Date;
  topSymbols: string[];
  topThemes: string[];
};

export default function PatternsPage() {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadingDreams, setLoadingDreams] = useState(true);

  // Cached pattern analysis
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [lastAnalysedAt, setLastAnalysedAt] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Cached top themes analysis
  const [topThemesAnalysis, setTopThemesAnalysis] = useState<string | null>(
    null
  );
  const [topThemesLastAnalysedAt, setTopThemesLastAnalysedAt] = useState<
    string | null
  >(null);
  const [topThemesAnalysing, setTopThemesAnalysing] = useState(false);
  const [topThemesError, setTopThemesError] = useState<string | null>(null);
  const [topThemesRecentRuns, setTopThemesRecentRuns] = useState<string[]>([]);

  const [showAllThemes, setShowAllThemes] = useState(false);
  const [showAllClusters, setShowAllClusters] = useState(false);

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

  // Load last saved analyses (patterns + top themes)
  useEffect(() => {
    if (!userId) {
      setAnalysis(null);
      setLastAnalysedAt(null);
      setTopThemesAnalysis(null);
      setTopThemesLastAnalysedAt(null);
      setTopThemesRecentRuns([]);
      return;
    }

    async function load(uid: string) {
      try {
        // Pattern analysis
        const patternRef = doc(db, "patternAnalyses", uid);
        const patternSnap = await getDoc(patternRef);
        if (patternSnap.exists()) {
          const data = patternSnap.data() as any;
          setAnalysis(data.analysis ?? null);
          setLastAnalysedAt(data.createdAt ?? null);
        } else {
          setAnalysis(null);
          setLastAnalysedAt(null);
        }
      } catch (error) {
        console.error("Error loading saved pattern analysis:", error);
      }

      try {
        // Top themes analysis
        const themeRef = doc(db, "themeAnalyses", uid);
        const themeSnap = await getDoc(themeRef);
        if (themeSnap.exists()) {
          const data = themeSnap.data() as any;
          setTopThemesAnalysis(data.analysis ?? null);
          setTopThemesLastAnalysedAt(data.createdAt ?? null);
          if (Array.isArray(data.recentRuns)) {
            setTopThemesRecentRuns(data.recentRuns as string[]);
          } else {
            setTopThemesRecentRuns([]);
          }
        } else {
          setTopThemesAnalysis(null);
          setTopThemesLastAnalysedAt(null);
          setTopThemesRecentRuns([]);
        }
      } catch (error) {
        console.error("Error loading saved theme analysis:", error);
      }
    }

    load(userId);
  }, [userId]);

  const totalDreams = dreams.length;

  const {
    themeCounts,
    clusters,
    dreamsWithEmbeddingCount,
  }: {
    themeCounts: CountItem[];
    clusters: DreamCluster[];
    dreamsWithEmbeddingCount: number;
  } = useMemo(() => {
    // Theme counts across all dreams
    const themeMap = new Map<string, number>();

    for (const dream of dreams) {
      const themes = dream.themes ?? [];

      for (const t of themes) {
        const key = t.trim();
        if (!key) continue;
        themeMap.set(key, (themeMap.get(key) ?? 0) + 1);
      }
    }

    const themeCounts: CountItem[] = Array.from(themeMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    // Embedding based clusters
    const dreamsWithEmbedding: ClusterDream[] = dreams
      .filter(
        (d) =>
          Array.isArray(d.embedding) && d.embedding && d.embedding.length > 0
      )
      .map((d) => ({
        id: d.id,
        title: (d as any).title,
        rawText: d.rawText,
        createdAt: d.createdAt,
        symbols: d.symbols ?? [],
        themes: d.themes ?? [],
        embedding: d.embedding as number[],
      }));

    const dreamsWithEmbeddingCount = dreamsWithEmbedding.length;
    const clusters: DreamCluster[] = [];

    if (dreamsWithEmbedding.length >= 2) {
      const SIM_THRESHOLD = 0.78;

      function cosineSimilarity(a: number[], b: number[]): number {
        let dot = 0;
        let na = 0;
        let nb = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
          const va = a[i];
          const vb = b[i];
          dot += va * vb;
          na += va * va;
          nb += vb * vb;
        }
        if (na === 0 || nb === 0) return 0;
        return dot / (Math.sqrt(na) * Math.sqrt(nb));
      }

      function averageEmbedding(vectors: number[][]): number[] {
        if (vectors.length === 0) return [];
        const dim = vectors[0].length;
        const out = new Array(dim).fill(0);
        for (const v of vectors) {
          for (let i = 0; i < dim; i++) {
            out[i] += v[i];
          }
        }
        for (let i = 0; i < dim; i++) {
          out[i] /= vectors.length;
        }
        return out;
      }

      for (const dream of dreamsWithEmbedding) {
        if (clusters.length === 0) {
          clusters.push({
            id: `cluster-1`,
            dreams: [dream],
            centroid: dream.embedding,
            dreamCount: 1,
            startDate: new Date(
              dream.createdAt?.toDate?.() ?? dream.createdAt
            ),
            endDate: new Date(dream.createdAt?.toDate?.() ?? dream.createdAt),
            topSymbols: [],
            topThemes: [],
          });
          continue;
        }

        let bestIdx = -1;
        let bestSim = -1;

        clusters.forEach((cluster, idx) => {
          const sim = cosineSimilarity(cluster.centroid, dream.embedding);
          if (sim > bestSim) {
            bestSim = sim;
            bestIdx = idx;
          }
        });

        if (bestIdx >= 0 && bestSim >= SIM_THRESHOLD) {
          const cluster = clusters[bestIdx];
          cluster.dreams.push(dream);
          cluster.dreamCount = cluster.dreams.length;
          cluster.centroid = averageEmbedding(
            cluster.dreams.map((d) => d.embedding)
          );

          const dreamDate = new Date(
            dream.createdAt?.toDate?.() ?? dream.createdAt
          );
          if (dreamDate < cluster.startDate) cluster.startDate = dreamDate;
          if (dreamDate > cluster.endDate) cluster.endDate = dreamDate;
        } else {
          clusters.push({
            id: `cluster-${clusters.length + 1}`,
            dreams: [dream],
            centroid: dream.embedding,
            dreamCount: 1,
            startDate: new Date(
              dream.createdAt?.toDate?.() ?? dream.createdAt
            ),
            endDate: new Date(dream.createdAt?.toDate?.() ?? dream.createdAt),
            topSymbols: [],
            topThemes: [],
          });
        }
      }

      // Compute top symbols and themes per cluster
      let enriched = clusters.map((cluster) => {
        const symbolMap = new Map<string, number>();
        const themeMapCluster = new Map<string, number>();

        for (const d of cluster.dreams) {
          for (const s of d.symbols ?? []) {
            const key = s.trim();
            if (!key) continue;
            symbolMap.set(key, (symbolMap.get(key) ?? 0) + 1);
          }
          for (const t of d.themes ?? []) {
            const key = t.trim();
            if (!key) continue;
            themeMapCluster.set(key, (themeMapCluster.get(key) ?? 0) + 1);
          }
        }

        const topSymbols = Array.from(symbolMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([value]) => value);

        const topThemes = Array.from(themeMapCluster.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([value]) => value);

        return {
          ...cluster,
          topSymbols,
          topThemes,
        };
      });

      // Sort by size descending
      enriched.sort((a, b) => b.dreamCount - a.dreamCount);

      return {
        themeCounts,
        clusters: enriched,
        dreamsWithEmbeddingCount,
      };
    }

    return { themeCounts, clusters: [], dreamsWithEmbeddingCount };
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

  function formatDateRange(start: Date, end: Date) {
    const startStr = start.toLocaleDateString();
    const endStr = end.toLocaleDateString();
    if (startStr === endStr) return startStr;
    return `${startStr} to ${endStr}`;
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
          analysisWindowDreams: totalDreams,
          analysisWindowType: "last-available",
          analysis: msg,
        });
      }
      return;
    }

    try {
      setAnalysing(true);

      // Use at most the last 30 dreams for analysis
      const dreamsForWindow = dreams.slice(0, 30);
      const windowDreams = dreamsForWindow.length;

      const dreamsForApi = dreamsForWindow.map((dream) => ({
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
          windowDreams,
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
          analysisWindowDreams: windowDreams,
          analysisWindowType: "last-30",
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

  async function handleAnalyseTopThemes() {
    setTopThemesError(null);

    if (!userId) {
      setTopThemesError("You need to be signed in to analyse your themes.");
      return;
    }

    // Limit: 8 runs per 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    const cleanedRuns = topThemesRecentRuns
      .map((iso) => new Date(iso))
      .filter((d) => !Number.isNaN(d.getTime()))
      .filter((d) => nowMs - d.getTime() <= THIRTY_DAYS_MS)
      .map((d) => d.toISOString());

    if (cleanedRuns.length >= 8) {
      setTopThemesError(
        "You have already run this themes analysis 8 times in the last 30 days. Let some new dreams accumulate before running it again."
      );
      setTopThemesRecentRuns(cleanedRuns);
      return;
    }

    // Use the same themeCounts that power the Top themes chips
    if (themeCounts.length === 0) {
      const msg =
        "There are no themes to analyse yet. Generate some interpretations first, then try again.";

      setTopThemesAnalysis(msg);
      const nowIso = new Date().toISOString();
      setTopThemesLastAnalysedAt(nowIso);
      const updatedRuns = [...cleanedRuns, nowIso];
      setTopThemesRecentRuns(updatedRuns);

      await setDoc(doc(db, "themeAnalyses", userId), {
        userId,
        createdAt: nowIso,
        totalDreamsAtAnalysis: totalDreams,
        themeWindowSize: 0,
        topThemesSnapshot: [],
        analysis: msg,
        recentRuns: updatedRuns,
      });

      return;
    }

    // Take the top 50 themes by frequency
    const themesForWindow = themeCounts.slice(0, 50);
    // Convert to plain string labels for the API
    const themeLabels = themesForWindow.map((t) => t.value);

    try {
      setTopThemesAnalysing(true);

      const res = await fetch("/api/analyse-top-themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: themeLabels,
          totalDreams,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const text: string =
        data.analysis ??
        "No analysis returned. Keep logging dreams and try again later.";

      const nowIso = new Date().toISOString();
      const updatedRuns = [...cleanedRuns, nowIso];

      setTopThemesAnalysis(text);
      setTopThemesLastAnalysedAt(nowIso);
      setTopThemesRecentRuns(updatedRuns);

      await setDoc(doc(db, "themeAnalyses", userId), {
        userId,
        createdAt: nowIso,
        totalDreamsAtAnalysis: totalDreams,
        themeWindowSize: themeLabels.length,
        topThemesSnapshot: themeLabels,
        analysis: text,
        recentRuns: updatedRuns,
      });
    } catch (error) {
      console.error("Error analysing top themes:", error);
      setTopThemesError("Failed to analyse your themes. Try again later.");
    } finally {
      setTopThemesAnalysing(false);
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

  const visibleThemeCounts = showAllThemes
    ? themeCounts
    : themeCounts.slice(0, 6);

  const lastAnalysedLabel = formatLastAnalysedLabel(lastAnalysedAt);
  const topThemesLastLabel = formatLastAnalysedLabel(topThemesLastAnalysedAt);

  // AI overview uses last 30 dreams at most
  const currentWindowCount = Math.min(30, totalDreams);

  // Only show clusters with at least 2 dreams
  const visibleClusters = clusters.filter((c) => c.dreamCount >= 2);
  const CLUSTER_PREVIEW_COUNT = 3;
  const clustersToRender = showAllClusters
    ? visibleClusters
    : visibleClusters.slice(0, CLUSTER_PREVIEW_COUNT);

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
            A quieter view of what keeps repeating across your dreams.
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
                Once you start recording dreams, this page will begin to show
                the themes and clusters that repeat over time.
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
                Each new dream adds another data point to your personal dream
                map.
              </p>
              {lastAnalysedLabel && (
                <p className="text-xs text-slate-500 mt-1">
                  {lastAnalysedLabel}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Themes list */}
        <section className="mb-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-4 sm:p-5 shadow-lg shadow-black/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">Top themes</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Themes that appear most often across your dreams.
                </p>
              </div>
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

        {/* Top themes AI analysis */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">
                AI reflection on your top themes
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                A short reflection on how your most frequent themes may relate
                to each other.
              </p>
              {topThemesLastLabel && (
                <p className="text-[11px] text-slate-500 mt-1">
                  {topThemesLastLabel}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleAnalyseTopThemes}
              disabled={topThemesAnalysing || totalDreams === 0}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition"
            >
              {topThemesAnalysing
                ? "Analysing..."
                : topThemesAnalysis
                ? "Re analyse themes"
                : "Analyse themes"}
            </button>
          </div>

          {topThemesError && (
            <p className="text-sm text-red-400 mb-2">{topThemesError}</p>
          )}

          {topThemesAnalysis ? (
            <p className="text-sm text-slate-100 whitespace-pre-line leading-relaxed">
              {topThemesAnalysis}
            </p>
          ) : !topThemesAnalysing ? (
            <p className="text-sm text-slate-400">
              Run an analysis to get a short reflection on how your most common
              themes may connect. The view will sharpen as themes repeat more
              often.
            </p>
          ) : null}
        </section>

        {/* AI Overview for recent dreams */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">
                AI overview of your dream patterns
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                A concise summary weaving together recurring themes across your
                recent dreams.
              </p>
              <p className="text-[11px] text-slate-500">
                Uses up to your last 30 dreams to keep the signal focused.
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
            <>
              <p className="text-sm text-slate-100 whitespace-pre-line leading-relaxed">
                {analysis}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                This overview is based on your last {currentWindowCount} dream
                {currentWindowCount === 1 ? "" : "s"}.
              </p>
            </>
          ) : !analysing ? (
            <p className="text-sm text-slate-400">
              Run an analysis to get a high level view of recurring themes from
              your recent dreams.
            </p>
          ) : null}
        </section>

        {/* Dream clusters */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold">Dream clusters</h2>
              <p className="text-xs text-slate-400 mt-1">
                Embeddings group dreams that sit close together in your inner
                landscape. These clusters often reflect repeating storylines or
                emotional terrains.
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <p>Dreams with embeddings: {dreamsWithEmbeddingCount}</p>
              <p>Clusters with shared patterns: {visibleClusters.length}</p>
            </div>
          </div>

          {dreamsWithEmbeddingCount === 0 ? (
            <p className="text-sm text-slate-400 mt-2">
              Once some of your dreams have embeddings, this section will start
              to show how they group together in meaning.
            </p>
          ) : visibleClusters.length === 0 ? (
            <p className="text-sm text-slate-400 mt-2">
              You already have dreams with embeddings, but none are similar
              enough yet to form clear clusters. For now your dream space is
              quite varied. As similar storylines and emotions repeat, groups
              will appear here.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-4 mt-3">
                {clustersToRender.map((cluster, idx) => {
                  const labelTheme = cluster.topThemes[0];
                  const labelSymbol = cluster.topSymbols[0];
                  const titleSuffix = labelTheme || labelSymbol || "";
                  const title = titleSuffix
                    ? `Cluster ${idx + 1} · ${titleSuffix}`
                    : `Cluster ${idx + 1}`;

                  const parts: string[] = [];
                  if (cluster.topSymbols.length > 0) {
                    parts.push(
                      `Shared symbols: ${cluster.topSymbols.join(", ")}`
                    );
                  }
                  if (cluster.topThemes.length > 0) {
                    parts.push(
                      `Shared themes: ${cluster.topThemes.join(", ")}`
                    );
                  }
                  const subtitle =
                    parts.length > 0
                      ? parts.join(" · ")
                      : "Dreams that sit close together in tone and storyline.";

                  const sampleDreams = cluster.dreams.slice(0, 3);
                  const extraCount =
                    cluster.dreamCount > sampleDreams.length
                      ? cluster.dreamCount - sampleDreams.length
                      : 0;

                  return (
                    <div
                      key={cluster.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/90 p-4 shadow-inner shadow-black/40"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-sm font-semibold">{title}</h3>
                        <p className="text-[11px] text-slate-400">
                          {cluster.dreamCount} dream
                          {cluster.dreamCount === 1 ? "" : "s"} ·{" "}
                          {formatDateRange(
                            cluster.startDate,
                            cluster.endDate
                          )}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3">
                        {subtitle}
                      </p>

                      <div className="space-y-2">
                        {sampleDreams.map((d) => (
                          <Link
                            key={d.id}
                            href={`/dreams/${d.id}`}
                            className="block rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 hover:border-indigo-400/80 hover:bg-slate-900 hover:shadow-lg hover:shadow-indigo-500/20 transition transform hover:-translate-y-0.5"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-slate-400">
                                {formatDate(d.createdAt)}
                              </span>
                              <span className="text-[11px] text-indigo-300">
                                View dream
                              </span>
                            </div>
                            <p className="text-[13px] text-slate-100 line-clamp-2">
                              {d.title?.trim() || "Untitled dream"}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-300 line-clamp-2 whitespace-pre-line">
                              {d.rawText}
                            </p>
                          </Link>
                        ))}
                      </div>

                      {extraCount > 0 && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          + {extraCount} more dream
                          {extraCount === 1 ? "" : "s"} in this cluster.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {visibleClusters.length > CLUSTER_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllClusters((prev) => !prev)}
                  className="mt-3 text-[11px] px-3 py-1 rounded-full border border-indigo-400/60 text-indigo-300 hover:bg-indigo-500/10 transition"
                >
                  {showAllClusters
                    ? "Show fewer clusters"
                    : `Show all ${visibleClusters.length} clusters`}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
