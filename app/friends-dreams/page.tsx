"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  DocumentData,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth } from "@/lib/firebaseAuth";
import { db } from "@/lib/firebase";
import TopNav from "@/components/TopNav";

type DreamListItem = {
  id: string;
  title?: string;
  createdAt: any;
  userId?: string;
  rawText?: string;
};

type OwnerProfile = {
  uid: string;
  name: string;
  username?: string;
  email: string;
};

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

export default function FriendsDreamsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [dreams, setDreams] = useState<DreamListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [ownerProfiles, setOwnerProfiles] = useState<
    Record<string, OwnerProfile>
  >({});

  const filterOwnerId = searchParams.get("from") || "";

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      if (!u) {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // Load dreams shared with this user
  useEffect(() => {
    async function loadSharedDreams() {
      if (!user) return;
      setLoading(true);

      try {
        const dreamsRef = collection(db, "dreams");
        const q = query(
          dreamsRef,
          where("sharedWithUserIds", "array-contains", user.uid)
        );
        const snap = await getDocs(q);

        const items: DreamListItem[] = [];
        const ownerIds = new Set<string>();

        snap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const userId = data.userId as string | undefined;
          if (userId) {
            ownerIds.add(userId);
          }

          items.push({
            id: docSnap.id,
            title: data.title ?? "",
            createdAt: data.createdAt,
            userId,
            rawText: data.rawText ?? "",
          });
        });

        // Sort newest first by createdAt if available
        items.sort((a, b) => {
          const aTime =
            typeof a.createdAt === "string"
              ? new Date(a.createdAt).getTime()
              : a.createdAt?.toMillis
              ? a.createdAt.toMillis()
              : 0;
          const bTime =
            typeof b.createdAt === "string"
              ? new Date(b.createdAt).getTime()
              : b.createdAt?.toMillis
              ? b.createdAt.toMillis()
              : 0;
          return bTime - aTime;
        });

        setDreams(items);

        // Load owner profiles
        const profiles: Record<string, OwnerProfile> = {};
        await Promise.all(
          Array.from(ownerIds).map(async (uid) => {
            try {
              const userRef = doc(db, "users", uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const d = userSnap.data() as any;
                profiles[uid] = {
                  uid,
                  name: d.name ?? "",
                  username: d.username ?? "",
                  email: d.email ?? "",
                };
              } else {
                profiles[uid] = {
                  uid,
                  name: "Unknown user",
                  username: undefined,
                  email: "",
                };
              }
            } catch (err) {
              console.error("Error loading owner profile:", err);
              profiles[uid] = {
                uid,
                name: "Unknown user",
                username: undefined,
                email: "",
              };
            }
          })
        );

        setOwnerProfiles(profiles);
      } catch (err) {
        console.error("Error loading shared dreams:", err);
        setDreams([]);
        setOwnerProfiles({});
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadSharedDreams();
    }
  }, [user]);

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex items-center justify-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          aria-hidden="true"
        >
          <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
          <div className="absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl px-6 py-4 shadow-xl shadow-black/40">
          <p className="text-sm text-slate-300">Checking your session...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const filteredDreams =
    filterOwnerId && dreams.length > 0
      ? dreams.filter((d) => d.userId === filterOwnerId)
      : dreams;

  const ownerLabel =
    filterOwnerId && ownerProfiles[filterOwnerId]
      ? ownerProfiles[filterOwnerId].name ||
        ownerProfiles[filterOwnerId].username ||
        ownerProfiles[filterOwnerId].email ||
        "this person"
      : null;

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

        {/* Header */}
        <header className="mt-4 mb-6">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-1">
            Shared Dreams
          </h1>
          {filterOwnerId && ownerLabel ? (
            <p className="text-sm text-slate-400">
              Dreams that{" "}
              <span className="text-slate-100 font-medium">
                {ownerLabel}
              </span>{" "}
              has shared with you.
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Dreams that other people have explicitly shared with you on Onyva.
            </p>
          )}
        </header>

        {/* Content */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/40">
          {loading ? (
            <p className="text-sm text-slate-300">Loading shared dreams...</p>
          ) : filteredDreams.length === 0 ? (
            <div>
              <p className="text-sm text-slate-300 mb-2">
                No one has shared any dreams with you here yet.
              </p>
              <p className="text-xs text-slate-400">
                When a friend shares a dream and selects you in their sharing
                list, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDreams.map((dream) => {
                const owner =
                  dream.userId && ownerProfiles[dream.userId]
                    ? ownerProfiles[dream.userId]
                    : undefined;

                const ownerText = owner
                  ? owner.name ||
                    owner.username ||
                    owner.email ||
                    "Unknown user"
                  : "Unknown user";

                const snippet =
                  dream.rawText && dream.rawText.trim().length > 0
                    ? dream.rawText.trim()
                    : "";

                return (
                  <Link
                    key={dream.id}
                    href={`/dreams/${dream.id}`}
                    className="block rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 hover:border-indigo-400/70 hover:bg-slate-900/90 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm sm:text-base font-medium text-slate-50">
                          {dream.title?.trim() || "Untitled dream"}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Shared by{" "}
                          <span className="text-slate-100 font-medium">
                            {ownerText}
                          </span>{" "}
                          • {formatDate(dream.createdAt)}
                        </p>
                        {snippet && (
                          <p className="mt-2 text-xs text-slate-300 line-clamp-2 whitespace-pre-line">
                            {snippet}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1">
                        View details →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Back link mobile */}
        <div className="mt-6 sm:hidden">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-white/10 text-xs text-slate-200 hover:bg.white/5 hover:bg-white/5 transition"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
