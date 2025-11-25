"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebaseAuth";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setLoggedIn(!!user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  async function handleLogout() {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  }

  function linkClass(target: string) {
    const isActive = pathname === target;
    return [
      "px-3 py-1 rounded-md text-sm font-medium",
      isActive
        ? "bg-slate-800 text-white"
        : "text-slate-300 hover:text-white hover:bg-slate-800",
    ].join(" ");
  }

  return (
    <nav className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 flex items-center justify-between backdrop-blur">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-lg font-semibold text-white">
          Dream Lab
        </Link>
        <span className="hidden text-slate-500 text-xs sm:inline">
          Map your dream world over time
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/" className={linkClass("/")}>
          Home
        </Link>
        <Link href="/dreams" className={linkClass("/dreams")}>
          Dreams
        </Link>
        <Link href="/patterns" className={linkClass("/patterns")}>
          Patterns
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {!authChecked ? (
          <span className="text-xs text-slate-400">Checking auth...</span>
        ) : loggedIn ? (
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded-md border border-slate-600 text-xs text-slate-200 hover:bg-slate-800"
          >
            Log out
          </button>
        ) : (
          <>
            <Link
              href="/login"
              className="px-3 py-1 rounded-md border border-slate-600 text-xs text-slate-200 hover:bg-slate-800"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="px-3 py-1 rounded-md bg-indigo-500 hover:bg-indigo-600 text-xs text-white"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
