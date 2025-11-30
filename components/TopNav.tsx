"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebaseAuth";

export default function TopNav() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  function linkClass(href: string) {
    const isActive =
      href === "/" ? pathname === "/" : pathname.startsWith(href);

    if (isActive) {
      return "text-sm font-medium text-white px-3 py-1.5 rounded-full bg-white/10 shadow-sm";
    }

    return "text-sm font-medium text-slate-200/80 hover:text-white px-3 py-1.5 rounded-full hover:bg:white/5 transition";
  }

  return (
    <header className="mb-6">
      <nav
        className="
        flex items-center justify-between 
        px-4 py-3 
        rounded-full 
        bg-slate-950/50 
        backdrop-blur-xl 
        shadow-lg shadow-black/40
      "
      >
        {/* Logo and branding */}
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 via-sky-400 to-violet-500 shadow-md shadow-indigo-500/40" />
          <span className="text-lg font-semibold tracking-tight text-white">
            Dream Lab
          </span>
        </Link>

        {/* Right side items */}
        {!authChecked ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
            <span>Loading</span>
          </div>
        ) : user ? (
          <div className="flex items-center gap-2">
            <Link href="/dreams" className={linkClass("/dreams")}>
              Dreams
            </Link>
            <Link href="/calendar" className={linkClass("/calendar")}>
              Calendar
            </Link>
            <Link href="/patterns" className={linkClass("/patterns")}>
              Patterns
            </Link>
            <Link href="/account" className={linkClass("/account")}>
              Account
            </Link>

            <button
              onClick={() => signOut(auth)}
              className="
                text-xs sm:text-sm font-medium
                text-red-300 hover:text-red-200 
                px-3 py-1.5 rounded-full 
                hover:bg-red-500/10 transition
              "
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className={linkClass("/login")}>
              Log in
            </Link>
            <Link
              href="/register"
              className="
                text-sm font-medium 
                text-slate-900 
                px-3 py-1.5 rounded-full 
                bg-white hover:bg-slate-100 
                shadow-md shadow-black/20 
                transition
              "
            >
              Sign up
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
