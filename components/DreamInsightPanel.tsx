"use client";

import { useEffect, useRef, useState } from "react";
import { DREAM_INSIGHTS } from "@/lib/dreamInsights";

const RECENT_HISTORY_SIZE = 4;

export default function DreamInsightPanel() {
  const [index, setIndex] = useState(() => {
    if (DREAM_INSIGHTS.length === 0) return 0;
    return Math.floor(Math.random() * DREAM_INSIGHTS.length);
  });
  const [recentIndices, setRecentIndices] = useState<number[]>([]);
  const [isFading, setIsFading] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (DREAM_INSIGHTS.length > 0) {
      setRecentIndices([index]);
    }
  }, []); // run once on mount

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (DREAM_INSIGHTS.length === 0) {
    return null;
  }

  function pickNextIndex(currentIndex: number, history: number[]): number {
    const total = DREAM_INSIGHTS.length;
    if (total <= 1) return currentIndex;

    const avoidSet = new Set<number>([currentIndex, ...history]);
    const candidates: number[] = [];

    for (let i = 0; i < total; i++) {
      if (!avoidSet.has(i)) {
        candidates.push(i);
      }
    }

    if (candidates.length === 0) {
      return (currentIndex + 1) % total;
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  function handleNextInsight() {
    if (DREAM_INSIGHTS.length <= 1) return;

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setIsFading(true);

    timeoutRef.current = window.setTimeout(() => {
      setIndex((current) => {
        const next = pickNextIndex(current, recentIndices);
        setRecentIndices((prev) => {
          const updated = [...prev, next];
          if (updated.length > RECENT_HISTORY_SIZE) {
            updated.shift();
          }
          return updated;
        });
        return next;
      });
      setIsFading(false);
    }, 150);
  }

  const insight = DREAM_INSIGHTS[index];
  const opacityClass = isFading ? "opacity-0" : "opacity-100";

  return (
    <section className="mb-8 rounded-2xl border border-white/10 bg-slate-900/85 p-4 sm:p-5 shadow-lg shadow-black/30">
      <div className="flex items-start justify-between gap-3">
        <div className={`transition-opacity duration-300 ${opacityClass}`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
            Dream insight
          </p>
          <p className="text-sm sm:text-base text-slate-100 leading-relaxed">
            {insight}
          </p>
        </div>

        <button
          type="button"
          onClick={handleNextInsight}
          className="mt-1 text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-4 decoration-slate-600"
        >
          Another insight
        </button>
      </div>

      <p className="mt-3 text-[10px] text-slate-500">
        Small reminders about how your dream world works.
      </p>
    </section>
  );
}
