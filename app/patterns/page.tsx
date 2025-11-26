"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
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

type SymbolCluster = {
  label: string;
  description: string;
  totalCount: number;
  items: string[];
};

export default function PatternsPage() {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadingDreams, setLoadingDreams] = useState(true);

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [showAllSymbols, setShowAllSymbols] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);

  const [clusters, setClusters] = useState<SymbolCluster[] | null>(null);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);

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
        console.error("Error loading dreams for patterns:", error);
        setDreams([]);
        setLoadingDreams(false);
      }
    );

    return () => unsub();
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

  async function handleAnalysePatterns() {
    setAnalysisError(null);
    setAnalysis(null);

    if (totalDreams < 3) {
      setAnalysis(
        "You have only logged a few dreams so far. That is a good start, but patterns are still forming. Keep recording your dreams regularly and rerun this analysis once you have a richer history."
      );
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
      setAnalysis(data.analysis ?? "No analysis returned.");
    } catch (error) {
      console.error("Error analysing patterns:", error);
      setAnalysisError("Failed to analyse patterns. Try again later.");
    } finally {
      setAnalysing(false);
    }
  }

  async function handleClusterSymbols() {
    setClusterError(null);
    setClusters(null);

    if (symbolCounts.length < 3) {
      setClusterError(
        "You need a few more recurring symbols before clustering becomes useful. Generate more interpretations and try again."
      );
      return;
    }

    try {
      setLoadingClusters(true);

      // Limit the number of symbols sent to keep prompts compact.
      const topSymbolsForApi = symbolCounts.slice(0, 30);

      const res = await fetch("/api/cluster-symbols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: topSymbolsForApi,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      setClusters(data.clusters ?? []);
    } catch (error) {
      console.error("Error clustering symbols:", error);
      setClusterError("Failed to build clusters. Try again later.");
    } finally {
      setLoadingClusters(false);
    }
  }

  if (authChecked && !userId) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <TopNav />
          <div className="mt-8 text-center space-y-4">
            <p className="text-lg">
              You need to be logged in to see your dream patterns.
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

  const visibleSymbolCounts = showAllSymbols
    ? symbolCounts
    : symbolCounts.slice(0, 5);

  const visibleThemeCounts = showAllThemes
    ? themeCounts
    : themeCounts.slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <TopNav />

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dream patterns</h1>
        </div>

        <section className="mb-6 p-4 rounded-md bg-slate-900 border border-slate-800">
          {loadingDreams ? (
            <p className="text-slate-400">Loading your dreams...</p>
          ) : totalDreams === 0 ? (
            <div>
              <p className="text-slate-200 mb-2">
                You have not logged any dreams yet.
              </p>
              <p className="text-slate-400 text-sm mb-4">
                Start recording your dreams regularly. As your archive grows,
                you will see recurring symbols, themes, and storylines. That is
                when this analysis page becomes useful.
              </p>
              <Link
                href="/dreams/new"
                className="inline-block px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium"
              >
                Write your first dream
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-lg font-semibold mb-1">
                You have logged {totalDreams} dream
                {totalDreams === 1 ? "" : "s"}.
              </p>
              <p className="text-slate-400 text-sm">
                Each dream adds more data to your personal dream map. The more
                you record, the clearer the recurring symbols and themes become.
              </p>
            </div>
          )}
        </section>

        {totalDreams > 0 && (
          <>
            {/* Symbol clusters section */}
            <section className="mb-6 p-4 rounded-md bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">Symbol clusters</h2>
                <button
                  onClick={handleClusterSymbols}
                  disabled={loadingClusters || symbolCounts.length === 0}
                  className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {loadingClusters ? "Clustering..." : "Build clusters"}
                </button>
              </div>

              {clusterError && (
                <p className="text-sm text-red-400 mb-2">{clusterError}</p>
              )}

              {clusters && clusters.length > 0 ? (
                <div className="space-y-3">
                  {clusters.map((cluster, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-800 rounded-md p-3 bg-slate-950"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-slate-100">
                          {cluster.label}
                        </h3>
                        <span className="text-xs text-slate-500">
                          {cluster.totalCount} symbol occurrence
                          {cluster.totalCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      {cluster.description && (
                        <p className="text-xs text-slate-300 mb-2">
                          {cluster.description}
                        </p>
                      )}
                      {cluster.items && cluster.items.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {cluster.items.map((item, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-200"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : !loadingClusters ? (
                <p className="text-sm text-slate-400">
                  Use clustering to see how your recurring symbols group into a
                  smaller number of meaningful domains. This becomes more useful
                  as you log more dreams and extract more symbols.
                </p>
              ) : null}
            </section>

            <section className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold">Top symbols</h2>
                  {symbolCounts.length > 5 && (
                    <button
                      onClick={() => setShowAllSymbols((v) => !v)}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {showAllSymbols ? "Show top only" : "Show all"}
                    </button>
                  )}
                </div>
                {symbolCounts.length === 0 ? (
                  <p className="text-slate-400 text-sm">
                    No symbols have been extracted yet. Generate interpretations
                    for your dreams to start building this list.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {visibleSymbolCounts.map((item) => (
                      <li
                        key={item.value}
                        className="flex items-center justify-between"
                      >
                        <span className="text-slate-100">{item.value}</span>
                        <span className="text-slate-400">
                          {item.count} dream
                          {item.count === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 rounded-md bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold">Top themes</h2>
                  {themeCounts.length > 5 && (
                    <button
                      onClick={() => setShowAllThemes((v) => !v)}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {showAllThemes ? "Show top only" : "Show all"}
                    </button>
                  )}
                </div>
                {themeCounts.length === 0 ? (
                  <p className="text-slate-400 text-sm">
                    No themes have been extracted yet. Generate interpretations
                    for your dreams to start building this list.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {visibleThemeCounts.map((item) => (
                      <li
                        key={item.value}
                        className="flex items-center justify-between"
                      >
                        <span className="text-slate-100">{item.value}</span>
                        <span className="text-slate-400">
                          {item.count} dream
                          {item.count === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="mb-6 p-4 rounded-md bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">
                  AI overview of your dream patterns
                </h2>
                <button
                  onClick={handleAnalysePatterns}
                  disabled={analysing || totalDreams === 0}
                  className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {analysing ? "Analysing..." : "Analyse patterns"}
                </button>
              </div>

              {analysisError && (
                <p className="text-sm text-red-400 mb-2">{analysisError}</p>
              )}

              {analysis ? (
                <p className="text-sm text-slate-100 whitespace-pre-line">
                  {analysis}
                </p>
              ) : !analysing ? (
                <p className="text-sm text-slate-400">
                  Run an analysis to get a higher level view of how your dream
                  symbols and themes connect over time. If you only have a few
                  dreams logged, the model will encourage you to keep recording
                  until stronger patterns emerge.
                </p>
              ) : null}
            </section>

            <section className="p-4 rounded-md bg-slate-900 border border-slate-800">
              <h2 className="text-xl font-semibold mb-3">
                Recent dreams used in this analysis
              </h2>
              <ul className="space-y-3 text-sm">
                {dreams.slice(0, 10).map((dream) => (
                  <li
                    key={dream.id}
                    className="border border-slate-800 rounded-md p-3 bg-slate-950"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-xs">
                        {formatDate(dream.createdAt)}
                      </span>
                      <Link
                        href={`/dreams/${dream.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        View dream
                      </Link>
                    </div>
                    <p className="text-slate-100 line-clamp-2 mb-2">
                      {dream.rawText}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(dream.symbols ?? []).slice(0, 4).map((symbol, idx) => (
                        <span
                          key={`sym-${idx}`}
                          className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-200"
                        >
                          {symbol}
                        </span>
                      ))}
                      {(dream.themes ?? []).slice(0, 4).map((theme, idx) => (
                        <span
                          key={`theme-${idx}`}
                          className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-200"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
