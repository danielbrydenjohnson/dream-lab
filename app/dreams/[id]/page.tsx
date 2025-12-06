"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseAuth";
import TopNav from "@/components/TopNav";
import {
  getSimilarDreamsForUser,
  SimilarDream,
} from "@/lib/dreamSimilarity";

type Dream = {
  id: string;
  title?: string;
  rawText: string;
  createdAt: any; // Firestore Timestamp or string
  userId?: string;
  psychInterpretation?: string;
  mysticInterpretation?: string;
  symbols?: string[];
  themes?: string[];
  sharedWithUserIds?: string[];
};

type FriendSummary = {
  uid: string;
  name: string;
  username?: string;
  email: string;
};

export default function DreamDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = (params as any).id as string | string[] | undefined;
  const id =
    typeof rawId === "string"
      ? rawId
      : Array.isArray(rawId)
      ? rawId[0]
      : undefined;

  const [dream, setDream] = useState<Dream | null>(null);
  const [loading, setLoading] = useState(true);

  const [psychText, setPsychText] = useState<string | null>(null);
  const [mysticText, setMysticText] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [interpreting, setInterpreting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  // Sharing state
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [sharedWithIds, setSharedWithIds] = useState<string[]>([]);
  const [sharingSaving, setSharingSaving] = useState(false);
  const [sharingMessage, setSharingMessage] = useState<string | null>(null);
  const [sharingExpanded, setSharingExpanded] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");

  // Similar dreams state
  const [similarDreams, setSimilarDreams] = useState<SimilarDream[] | null>(
    null
  );
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Fetch dream
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setDream(null);
      return;
    }

    async function fetchDream() {
      try {
        const ref = doc(db, "dreams", id as string);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as Omit<Dream, "id">;
          const fullDream: Dream = { id: snap.id, ...data };
          setDream(fullDream);

          setPsychText(fullDream.psychInterpretation ?? null);
          setMysticText(fullDream.mysticInterpretation ?? null);
          setSymbols(fullDream.symbols ?? []);
          setThemes(fullDream.themes ?? []);
          setSharedWithIds(fullDream.sharedWithUserIds ?? []);
        } else {
          setDream(null);
        }
      } catch (error) {
        console.error("Error fetching dream:", error);
        setDream(null);
      } finally {
        setLoading(false);
      }
    }

    fetchDream();
  }, [id]);

  // Decide ownership once we know both dream and auth state
  useEffect(() => {
    if (!authChecked) return;
    if (!dream) return;

    if (!userId) {
      setIsOwner(false);
      return;
    }

    setIsOwner(dream.userId === userId);
  }, [authChecked, dream, userId]);

  // Load friends (only if owner, since only owner can share)
  useEffect(() => {
    async function loadFriends() {
      if (!userId || !isOwner) return;

      setFriendsLoading(true);
      try {
        const reqRef = collection(db, "friendRequests");

        const sentSnap = await getDocs(
          query(reqRef, where("fromUserId", "==", userId))
        );
        const receivedSnap = await getDocs(
          query(reqRef, where("toUserId", "==", userId))
        );

        const friendIds = new Set<string>();

        sentSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.status === "accepted") {
            friendIds.add(data.toUserId);
          }
        });

        receivedSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.status === "accepted") {
            friendIds.add(data.fromUserId);
          }
        });

        const profiles: FriendSummary[] = [];
        await Promise.all(
          Array.from(friendIds).map(async (uid) => {
            try {
              const userRef = doc(db, "users", uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const d = userSnap.data() as any;
                profiles.push({
                  uid,
                  name: d.name ?? "",
                  username: d.username ?? "",
                  email: d.email ?? "",
                });
              } else {
                profiles.push({
                  uid,
                  name: "Unknown user",
                  username: undefined,
                  email: "",
                });
              }
            } catch (err) {
              console.error("Error loading friend profile:", err);
            }
          })
        );

        setFriends(profiles);
      } catch (err) {
        console.error("Error loading friends for sharing:", err);
      } finally {
        setFriendsLoading(false);
      }
    }

    if (userId && isOwner) {
      loadFriends();
    }
  }, [userId, isOwner]);

  // Load similar dreams (owner only, once we know dream and user)
  useEffect(() => {
    async function loadSimilar() {
      if (!userId || !dream || !isOwner) return;

      setSimilarLoading(true);
      setSimilarError(null);

      try {
        const results = await getSimilarDreamsForUser(userId, dream.id, 5);
        setSimilarDreams(results);
      } catch (err) {
        console.error("Error loading similar dreams:", err);
        setSimilarError("Could not load similar dreams right now.");
      } finally {
        setSimilarLoading(false);
      }
    }

    if (isOwner && dream && userId) {
      loadSimilar();
    }
  }, [userId, dream, isOwner]);

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

  async function handleInterpretation() {
    if (!dream || !isOwner) return;

    setInterpreting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/interpret-dream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dreamText: dream.rawText,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      const newPsych = data.psychInterpretation ?? null;
      const newMystic = data.mysticInterpretation ?? null;
      const newSymbols = Array.isArray(data.symbols) ? data.symbols : [];
      const newThemes = Array.isArray(data.themes) ? data.themes : [];

      setPsychText(newPsych);
      setMysticText(newMystic);
      setSymbols(newSymbols);
      setThemes(newThemes);

      const ref = doc(db, "dreams", dream.id);
      await updateDoc(ref, {
        psychInterpretation: newPsych ?? "",
        mysticInterpretation: newMystic ?? "",
        symbols: newSymbols,
        themes: newThemes,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error calling interpret-dream API or saving:", error);
      setErrorMessage(
        "Something went wrong generating or saving the interpretation."
      );
    } finally {
      setInterpreting(false);
    }
  }

  async function handleDelete() {
    if (!dream || !id || !isOwner) return;
    if (!confirm("Delete this dream permanently?")) return;

    setDeleting(true);
    try {
      const ref = doc(db, "dreams", id as string);
      await deleteDoc(ref);
      router.push("/dreams");
    } catch (error) {
      console.error("Error deleting dream:", error);
      alert("Failed to delete dream. Check console.");
      setDeleting(false);
    }
  }

  async function handleSaveSharing(e: React.FormEvent) {
    e.preventDefault();
    if (!dream || !isOwner) return;

    setSharingSaving(true);
    setSharingMessage(null);

    try {
      const ref = doc(db, "dreams", dream.id);
      await updateDoc(ref, {
        sharedWithUserIds: sharedWithIds,
        updatedAt: serverTimestamp(),
      });
      setSharingMessage("Sharing updated.");
    } catch (err) {
      console.error("Error updating sharing:", err);
      setSharingMessage("Failed to update sharing. Try again.");
    } finally {
      setSharingSaving(false);
    }
  }

  const alreadyInterpreted =
    Boolean(psychText && psychText.trim()) ||
    Boolean(mysticText && mysticText.trim()) ||
    (symbols && symbols.length > 0) ||
    (themes && themes.length > 0);

  const isStillLoading =
    loading || !authChecked || (dream && isOwner === null);

  const ownerSharedCount = sharedWithIds.length;

  const trimmedFriendSearch = friendSearch.trim().toLowerCase();
  const filteredFriends =
    trimmedFriendSearch === ""
      ? friends
      : friends.filter((f) => {
          const name = (f.name || "").toLowerCase();
          const username = (f.username || "").toLowerCase();
          const email = (f.email || "").toLowerCase();
          return (
            name.includes(trimmedFriendSearch) ||
            username.includes(trimmedFriendSearch) ||
            email.includes(trimmedFriendSearch)
          );
        });

  const VISIBLE_LIMIT = 5;
  const totalFiltered = filteredFriends.length;

  const friendsToRender =
    trimmedFriendSearch !== "" || sharingExpanded
      ? filteredFriends
      : filteredFriends.slice(0, VISIBLE_LIMIT);

  function scrollToSharing() {
    setSharingExpanded(true);
    const el = document.getElementById("sharing-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

        {isStillLoading ? (
          <div className="mt-20 flex justify-center">
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-5 shadow-xl shadow-black/40 text-center">
              <p className="text-sm text-slate-300">Loading dream...</p>
            </div>
          </div>
        ) : !userId ? (
          <div className="mt-20 flex justify-center">
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-6 shadow-xl shadow-black/40 text-center">
              <h1 className="text-xl font-semibold mb-3">
                You need to log in
              </h1>
              <p className="text-sm text-slate-300 mb-5">
                You must be logged in to view this dream.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition transform hover:-translate-y-0.5"
              >
                Go to login
              </Link>
            </div>
          </div>
        ) : !dream ? (
          <div className="mt-20 flex justify-center">
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-6 shadow-xl shadow-black/40 text-center">
              <h1 className="text-xl font-semibold mb-3">Dream not found</h1>
              <p className="text-sm text-slate-300 mb-5">
                This dream does not exist, or you do not have access to view it.
              </p>
              <Link
                href="/dreams"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white shadow-md shadow-indigo-500/40 transition transform hover:-translate-y-0.5"
              >
                Back to dreams
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 mb-10">
            {/* Breadcrumb and actions */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/dreams"
                className="inline-flex items-center text-xs sm:text-sm text-slate-300 hover:text:white"
              >
                <span className="mr-1 text-slate-400">{"←"}</span>
                Back to dreams
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                {isOwner ? (
                  <>
                    <Link
                      href={`/dreams/${dream.id}/edit`}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-100 border border-white/10 transition"
                    >
                      Edit
                    </Link>

                    <button
                      onClick={handleInterpretation}
                      disabled={interpreting || alreadyInterpreted}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition"
                    >
                      {interpreting
                        ? "Interpreting..."
                        : alreadyInterpreted
                        ? "Already interpreted"
                        : "Generate interpretation"}
                    </button>

                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-xs sm:text-sm font-medium text-white transition"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>

                    {alreadyInterpreted && (
                      <p className="w-full text-[11px] text-slate-400 mt-1">
                        This dream has already been interpreted. Interpretations
                        are generated once per dream.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    This dream was shared with you. You can read it, but cannot
                    edit or re-interpret it.
                  </p>
                )}
              </div>
            </div>

            {/* Header */}
            <header className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                {formatDate(dream.createdAt)}
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
                {dream.title?.trim() || "Untitled dream"}
              </h1>
              <p className="text-sm text-slate-400">
                Full entry plus psychological and mystical interpretations.
              </p>

              {isOwner && (
                <p className="mt-2 text-xs text-slate-500">
                  {ownerSharedCount === 0 ? (
                    "Not shared. Only you can see this dream."
                  ) : (
                    <>
                      Shared with{" "}
                      <span className="text-slate-200 font-medium">
                        {ownerSharedCount}{" "}
                        {ownerSharedCount === 1 ? "friend" : "friends"}
                      </span>
                      .{" "}
                      <button
                        type="button"
                        onClick={scrollToSharing}
                        className="underline underline-offset-2 text-slate-200 hover:text-white"
                      >
                        Manage sharing
                      </button>
                    </>
                  )}
                </p>
              )}
            </header>

            {errorMessage && (
              <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-950/60 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            {/* Main layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Dream text */}
              <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
                <h2 className="text-lg font-semibold mb-3">Dream text</h2>
                <p className="whitespace-pre-line text-sm sm:text-base text-slate-100 leading-relaxed">
                  {dream.rawText}
                </p>
              </section>

              {/* Symbols and themes side panel */}
              <aside className="space-y-4">
                <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
                  <h2 className="text-sm font-semibold mb-2">Key symbols</h2>
                  {symbols.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No symbols extracted yet. Generate an interpretation to
                      see them.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {symbols.map((symbol, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-[11px] text-slate-100 border border-white/10"
                        >
                          {symbol}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
                  <h2 className="text-sm font-semibold mb-2">Themes</h2>
                  {themes.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No themes extracted yet. Generate an interpretation to see
                      them.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {themes.map((theme, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-[11px] text-slate-100 border border-white/10"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              </aside>
            </div>

            {/* Interpretations */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
                <h2 className="text-lg font-semibold mb-3">
                  Psychological interpretation
                </h2>
                {psychText ? (
                  <p className="text-sm text-slate-100 whitespace-pre-line leading-relaxed">
                    {psychText}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    {isOwner
                      ? 'Click "Generate interpretation" to see a psychology based view of this dream.'
                      : "The owner has not generated a psychological interpretation yet."}
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
                <h2 className="text-lg font-semibold mb-3">
                  Mystical interpretation
                </h2>
                {mysticText ? (
                  <p className="text-sm text-slate-100 whitespace-pre-line leading-relaxed">
                    {mysticText}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    {isOwner
                      ? 'Click "Generate interpretation" to see a more symbolic, mystical view of this dream.'
                      : "The owner has not generated a mystical interpretation yet."}
                  </p>
                )}
              </section>
            </div>

            {/* Similar dreams (owner only) */}
            {isOwner && (
              <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40">
                <h2 className="text-lg font-semibold mb-2">
                  Similar dreams
                </h2>
                <p className="text-xs text-slate-400 mb-3">
                  Based on the deeper patterns in your entries, these dreams sit
                  closest to this one in your inner landscape.
                </p>

                {similarLoading && (
                  <p className="text-sm text-slate-300">
                    Looking for nearby dreams...
                  </p>
                )}

                {similarError && (
                  <p className="text-sm text-red-200">{similarError}</p>
                )}

                {!similarLoading &&
                  !similarError &&
                  (similarDreams == null || similarDreams.length === 0) && (
                    <p className="text-sm text-slate-400">
                      No close matches yet. As you log more dreams, patterns
                      will start to appear here.
                    </p>
                  )}

                {!similarLoading &&
                  !similarError &&
                  similarDreams &&
                  similarDreams.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {similarDreams.map((item) => {
                        const similarityPercent = Math.round(
                          item.similarity * 100
                        );

                        const sourceSymbols = symbols || [];
                        const targetSymbols = Array.isArray(
                          (item.dream as any).symbols
                        )
                          ? ((item.dream as any).symbols as string[])
                          : [];

                        const sourceThemes = themes || [];
                        const targetThemes = Array.isArray(
                          (item.dream as any).themes
                        )
                          ? ((item.dream as any).themes as string[])
                          : [];

                        const symbolOverlap = sourceSymbols.filter((s) =>
                          targetSymbols.includes(s)
                        );
                        const themeOverlap = sourceThemes.filter((t) =>
                          targetThemes.includes(t)
                        );

                        const reasonParts: string[] = [];
                        if (symbolOverlap.length > 0) {
                          reasonParts.push(
                            `Shared symbols: ${symbolOverlap.join(", ")}`
                          );
                        }
                        if (themeOverlap.length > 0) {
                          reasonParts.push(
                            `Shared themes: ${themeOverlap.join(", ")}`
                          );
                        }

                        const reasonText =
                          reasonParts.length > 0
                            ? reasonParts.join(" · ")
                            : "Similar emotional tone and storyline.";

                        return (
                          <Link
                            key={item.id}
                            href={`/dreams/${item.id}`}
                            className="block rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 hover:border-indigo-400/80 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-indigo-500/20 transition transform hover:-translate-y-0.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                                  {formatDate(item.createdAt)}
                                </p>
                                <p className="text-sm font-medium text-slate-100">
                                  {item.title?.trim() || "Untitled dream"}
                                </p>
                              </div>
                              <div className="flex items-center">
                                <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-3 py-1 text-[11px] font-medium text-indigo-200 border border-indigo-500/40">
                                  {similarityPercent}%
                                  <span className="ml-1 text-slate-300">
                                    similarity
                                  </span>
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-slate-300 line-clamp-2 whitespace-pre-line">
                              {item.dream.rawText}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {reasonText}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  )}
              </section>
            )}

            {/* Share with friends (owner only) */}
            {isOwner && (
              <section
                id="sharing-section"
                className="mt-6 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 shadow-lg shadow-black/40"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h2 className="text-lg font-semibold">
                    Share this dream with friends
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Only the friends you select below will be able to read this
                  dream when they are logged in.
                </p>

                {friendsLoading ? (
                  <p className="text-xs text-slate-400">
                    Loading your friends...
                  </p>
                ) : friends.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    You do not have any friends connected yet. Go to the{" "}
                    <Link
                      href="/friends"
                      className="underline underline-offset-2 text-slate-100"
                    >
                      Friends
                    </Link>{" "}
                    page to connect with someone first.
                  </p>
                ) : (
                  <form
                    onSubmit={handleSaveSharing}
                    className="space-y-4 max-w-md"
                  >
                    {/* Search friends */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
                        Search friends
                      </label>
                      <input
                        type="text"
                        value={friendSearch}
                        onChange={(e) => setFriendSearch(e.target.value)}
                        placeholder="Filter by name, username, or email..."
                        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                      />
                    </div>

                    {/* Friends list */}
                    <div className="space-y-2">
                      {totalFiltered === 0 ? (
                        <p className="text-[11px] text-slate-500">
                          No friends match this search.
                        </p>
                      ) : (
                        <>
                          {friendsToRender.map((f) => {
                            const checked = sharedWithIds.includes(f.uid);
                            return (
                              <label
                                key={f.uid}
                                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs sm:text-sm cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                                  checked={checked}
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setSharedWithIds((prev) => {
                                      if (isChecked) {
                                        if (prev.includes(f.uid)) return prev;
                                        return [...prev, f.uid];
                                      } else {
                                        return prev.filter(
                                          (idVal) => idVal !== f.uid
                                        );
                                      }
                                    });
                                  }}
                                />
                                <div>
                                  <p className="text-slate-100">
                                    {f.name || f.username || "Unnamed user"}
                                  </p>
                                  {f.username && (
                                    <p className="text-[11px] text-slate-400">
                                      @{f.username}
                                    </p>
                                  )}
                                  {f.email && (
                                    <p className="text-[11px] text-slate-500">
                                      {f.email}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}

                          {trimmedFriendSearch === "" &&
                            totalFiltered > VISIBLE_LIMIT && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSharingExpanded((prev) => !prev)
                                }
                                className="mt-1 text-[11px] text-slate-300 hover:text-white underline underline-offset-2"
                              >
                                {sharingExpanded
                                  ? "Show fewer friends"
                                  : `Show all ${totalFiltered} friends`}
                              </button>
                            )}
                        </>
                      )}
                    </div>

                    {sharingMessage && (
                      <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-100">
                        {sharingMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={sharingSaving}
                      className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
                    >
                      {sharingSaving ? "Saving..." : "Save sharing"}
                    </button>
                  </form>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
