// lib/streaks.ts

export type DreamForStreaks = {
    createdAt: Date;
  };
  
  export type StreakStats = {
    currentStreak: number;
    bestStreak: number;
    daysLoggedThisWeek: number;
  };
  
  function formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  function parseKeyToDate(key: string): Date {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  
  export function calculateStreaks(dreams: DreamForStreaks[]): StreakStats {
    if (!dreams || dreams.length === 0) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        daysLoggedThisWeek: 0,
      };
    }
  
    // Build a set of distinct days when at least one dream was logged
    const daySet = new Set<string>();
    for (const dream of dreams) {
      const date = dream.createdAt;
      if (!(date instanceof Date) || isNaN(date.getTime())) continue;
      daySet.add(formatDateKey(date));
    }
  
    if (daySet.size === 0) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        daysLoggedThisWeek: 0,
      };
    }
  
    const today = new Date();
  
    // Current streak: walk backwards from today until we hit a day with no dream
    let currentStreak = 0;
    const cursor = new Date(today);
    while (true) {
      const key = formatDateKey(cursor);
      if (!daySet.has(key)) break;
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  
    // Best streak: longest run of consecutive days in the set
    const sortedKeys = Array.from(daySet).sort();
    let bestStreak = 1;
    let streak = 1;
  
    for (let i = 1; i < sortedKeys.length; i++) {
      const prevDate = parseKeyToDate(sortedKeys[i - 1]);
      const currDate = parseKeyToDate(sortedKeys[i]);
      const diffDays =
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
  
      if (Math.round(diffDays) === 1) {
        streak += 1;
      } else {
        if (streak > bestStreak) bestStreak = streak;
        streak = 1;
      }
    }
    if (streak > bestStreak) bestStreak = streak;
  
    // Days logged this week (Monday to today)
    const dayOfWeek = today.getDay(); // 0 Sunday, 1 Monday, ...
    const diffToMonday = (dayOfWeek + 6) % 7; // number of days since Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
  
    let daysLoggedThisWeek = 0;
    for (let i = 0; i <= diffToMonday; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = formatDateKey(d);
      if (daySet.has(key)) {
        daysLoggedThisWeek += 1;
      }
    }
  
    return {
      currentStreak,
      bestStreak,
      daysLoggedThisWeek,
    };
  }
  