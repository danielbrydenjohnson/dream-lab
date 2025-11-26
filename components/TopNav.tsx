"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebaseAuth";

export default function TopNav() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  return (
    <nav className="w-full flex items-center justify-between mb-6 py-3">
      <Link href="/" className="text-xl font-semibold text-white">
        Dream Lab
      </Link>

      {!authChecked ? (
        <div className="text-sm text-slate-400">...</div>
      ) : user ? (
        <div className="flex items-center gap-4">
          <Link
            href="/dreams"
            className="text-sm text-slate-300 hover:text-white"
          >
            Dreams
          </Link>

          <Link
            href="/patterns"
            className="text-sm text-slate-300 hover:text-white"
          >
            Patterns
          </Link>

          {/* NEW — Account page link */}
          <Link
            href="/account"
            className="text-sm text-slate-300 hover:text-white"
          >
            Account
          </Link>

          <button
            onClick={() => signOut(auth)}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Log out
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-slate-300 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            Sign up
          </Link>
        </div>
      )}
    </nav>
  );
}
