"use client";

import { useEffect, useMemo, useState } from "react";
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
  title?: string;
  rawText: string;
  createdAt: any;
  userId?: string;
};

type CalendarCell = {
  date: Date;
  inCurrentMonth: boolean;
};

function toDate(value: any): Date | null {
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

function dateKey(date: Date): string {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

// Monday as first day of week: 0 = Monday, 6 = Sunday
function getWeekdayIndexMonday(date: Date): number {
  const jsDay = date.getDay(); // 0 Sunday, 1 Monday...
  return (jsDay + 6) % 7;
}

function buildMonthMatrix(currentMonth: Date): CalendarCell[] {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = getWeekdayIndexMonday(firstOfMonth);
  const cells: CalendarCell[] = [];

  // Start from the Monday of the first week that contains the 1st
  const startDate = new Date(year, month, 1 - firstWeekday);

  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    cells.push({
      date: d,
      inCurrentMonth: d.getMonth() === month,
    });
  }

  return cells;
}

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loadingDreams, setLoadingDreams] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Load dreams for user
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
        console.error("Error loading dreams for calendar:", error);
        setDreams([]);
        setLoadingDreams(false);
      }
    );

    return () => unsub();
  }, [userId]);

  // Map dateKey -> count and dreams
  const { countsByDate, dreamsByDate } = useMemo(() => {
    const counts = new Map<string, number>();
    const byDate = new Map<string, Dream[]>();

    for (const dream of dreams) {
      const d = toDate(dream.createdAt);
      if (!d) continue;
      const key = dateKey(d);

      counts.set(key, (counts.get(key) ?? 0) + 1);
      const existing = byDate.get(key) ?? [];
      existing.push(dream);
      byDate.set(key, existing);
    }

    return { countsByDate: counts, dreamsByDate: byDate };
  }, [dreams]);

  // Pick selectedDateKey default: today if any dreams, otherwise null
  useEffect(() => {
    if (selectedDateKey) return;
    const todayKey = dateKey(new Date());
    if (countsByDate.has(todayKey)) {
      setSelectedDateKey(todayKey);
    }
  }, [countsByDate, selectedDateKey]);

  const cells = useMemo(() => buildMonthMatrix(currentMonth), [currentMonth]);

  function monthLabel(date: Date) {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    });
    return formatter.format(date);
  }

  function changeMonth(offset: number) {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m + offset, 1);
    });
  }

  if (authChecked && !userId) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <TopNav />
          <div className="mt-12 text-center space-y-4">
            <h1 className="text-2xl font-semibold">Dream calendar</h1>
            <p className="text-sm text-slate-400">
              Log in to see your dream history on a calendar.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition"
            >
              Go to login
            </Link>
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

        <header className="mt-4 mb-4">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-1">
            Dream calendar
          </h1>
          <p className="text-sm text-slate-400">
            See when you have been logging dreams and dive into specific nights.
          </p>
        </header>

        {loadingDreams ? (
          <p className="text-sm text-slate-400 mt-6">Loading your dreams...</p>
        ) : dreams.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/40">
            <p className="text-sm text-slate-200 mb-2">
              You have not logged any dreams yet.
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Once you start logging dreams, this calendar will show streaks and
              clusters of activity.
            </p>
            <Link
              href="/dreams/new"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition"
            >
              Write your first dream
            </Link>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
            {/* Calendar card */}
            <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-200 hover:bg-white/10 text-sm"
                  >
                    {"←"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          new Date().getFullYear(),
                          new Date().getMonth(),
                          1
                        )
                      )
                    }
                    className="text-sm font-medium text-slate-100 hover:text-white"
                  >
                    {monthLabel(currentMonth)}
                  </button>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-200 hover:bg-white/10 text-sm"
                  >
                    {"→"}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-3 rounded-full bg-slate-800 border border-white/10" />
                    0 dreams
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-3 rounded-full bg-indigo-500/40 border border-indigo-400/60" />
                    1 dream
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-3 rounded-full bg-indigo-500/80 border border-indigo-300" />
                    2+ dreams
                  </span>
                </div>
              </div>

              {/* Weekday header */}
              <div className="grid grid-cols-7 text-center text-[11px] text-slate-400 mb-2">
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
                <div>Sun</div>
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-xs">
                {cells.map((cell, idx) => {
                  const key = dateKey(cell.date);
                  const count = countsByDate.get(key) ?? 0;
                  const isSelected = selectedDateKey === key;
                  const inMonth = cell.inCurrentMonth;

                  let bgClass = "bg-slate-900/60 border-white/5";
                  if (count === 1) {
                    bgClass =
                      "bg-indigo-500/25 border-indigo-400/60 shadow-sm shadow-indigo-500/30";
                  } else if (count >= 2) {
                    bgClass =
                      "bg-indigo-500/80 border-indigo-300 shadow-md shadow-indigo-500/40";
                  }

                  const borderClass = isSelected
                    ? "border-2 border-white"
                    : "border";

                  const textClass = inMonth
                    ? "text-slate-100"
                    : "text-slate-500";

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDateKey(key)}
                      className={`aspect-square rounded-xl ${borderClass} ${bgClass} flex flex-col items-center justify-center transition hover:scale-[1.03]`}
                    >
                      <span
                        className={`text-[11px] leading-none ${textClass}`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {count > 0 && (
                        <span className="mt-0.5 text-[9px] text-slate-100">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Side panel: dreams for selected date */}
            <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/40">
              <h2 className="text-lg font-semibold mb-1">
                Dreams on this day
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Tap a day in the calendar to see the dreams you logged that
                night.
              </p>

              {selectedDateKey && dreamsByDate.has(selectedDateKey) ? (
                <div className="space-y-3">
                  {dreamsByDate
                    .get(selectedDateKey)!
                    .slice()
                    .sort((a, b) => {
                      const da = toDate(a.createdAt)?.getTime() ?? 0;
                      const db = toDate(b.createdAt)?.getTime() ?? 0;
                      return db - da;
                    })
                    .map((dream) => (
                      <Link
                        key={dream.id}
                        href={`/dreams/${dream.id}`}
                        className="block rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 hover:border-indigo-400/70 hover:bg-slate-900 transition"
                      >
                        <p className="text-xs text-slate-400 mb-0.5">
                          {dream.title?.trim() || "Untitled dream"}
                        </p>
                        <p className="text-[11px] text-slate-100 line-clamp-2 whitespace-pre-line">
                          {dream.rawText}
                        </p>
                      </Link>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  No dreams logged for the selected day yet.
                </p>
              )}

              <div className="mt-5 border-t border-white/10 pt-3">
                <p className="text-[11px] text-slate-500 mb-2">
                  Want to add a dream for today?
                </p>
                <Link
                  href="/dreams/new"
                  className="inline-flex items-center justify-center px-3 py-2 rounded-full bg-indigo-500 hover:bg-indigo-600 text-[11px] font-medium text-white shadow-md shadow-indigo-500/30 transition"
                >
                  Write a new dream
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
