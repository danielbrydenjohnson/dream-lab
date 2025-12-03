"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth } from "@/lib/firebaseAuth";
import { db } from "@/lib/firebase";
import TopNav from "@/components/TopNav";

type UserProfile = {
  uid: string;
  name: string;
  username?: string;
  email: string;
};

type FriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt?: any;
  fromUserProfile?: UserProfile | null;
};

type FriendSummary = {
  uid: string;
  name: string;
  username?: string;
  email: string;
};

export default function FriendsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);

  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

  // Load current user profile (for display context)
  useEffect(() => {
    async function loadProfileForCurrentUser() {
      if (!user) return;
      setProfileLoading(true);
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          setCurrentProfile({
            uid: user.uid,
            name: data.name ?? "",
            username: data.username ?? "",
            email: data.email ?? user.email ?? "",
          });
        } else {
          setCurrentProfile({
            uid: user.uid,
            name: "",
            username: "",
            email: user.email ?? "",
          });
        }
      } catch (err) {
        console.error("Error loading current profile:", err);
      } finally {
        setProfileLoading(false);
      }
    }

    if (user) {
      loadProfileForCurrentUser();
    }
  }, [user]);

  // Load incoming pending friend requests
  useEffect(() => {
    async function loadIncoming() {
      if (!user) return;
      setIncomingLoading(true);
      try {
        const reqRef = collection(db, "friendRequests");
        const q = query(reqRef, where("toUserId", "==", user.uid));
        const snap = await getDocs(q);

        const pending: FriendRequest[] = [];
        const fromIds = new Set<string>();

        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.status === "pending") {
            pending.push({
              id: docSnap.id,
              fromUserId: data.fromUserId,
              toUserId: data.toUserId,
              status: data.status,
              createdAt: data.createdAt,
            });
            fromIds.add(data.fromUserId);
          }
        });

        // Fetch profiles for senders
        const fromProfiles: Record<string, UserProfile | null> = {};
        await Promise.all(
          Array.from(fromIds).map(async (uid) => {
            try {
              const userRef = doc(db, "users", uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const d = userSnap.data() as any;
                fromProfiles[uid] = {
                  uid,
                  name: d.name ?? "",
                  username: d.username ?? "",
                  email: d.email ?? "",
                };
              } else {
                fromProfiles[uid] = null;
              }
            } catch (err) {
              console.error("Error loading sender profile:", err);
              fromProfiles[uid] = null;
            }
          })
        );

        const enriched = pending.map((req) => ({
          ...req,
          fromUserProfile: fromProfiles[req.fromUserId] ?? null,
        }));

        setIncomingRequests(enriched);
      } catch (err) {
        console.error("Error loading incoming friend requests:", err);
      } finally {
        setIncomingLoading(false);
      }
    }

    if (user) {
      loadIncoming();
    }
  }, [user]);

  // Load friends list based on accepted friendRequests
  useEffect(() => {
    async function loadFriends() {
      if (!user) return;
      setFriendsLoading(true);

      try {
        const reqRef = collection(db, "friendRequests");

        const sentSnap = await getDocs(
          query(reqRef, where("fromUserId", "==", user.uid))
        );
        const receivedSnap = await getDocs(
          query(reqRef, where("toUserId", "==", user.uid))
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
        console.error("Error loading friends:", err);
      } finally {
        setFriendsLoading(false);
      }
    }

    if (user) {
      loadFriends();
    }
  }, [user]);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const trimmed = inviteEmail.trim();
    setInviteMessage(null);

    if (!trimmed) {
      setInviteMessage("Enter an email to send a request.");
      return;
    }

    setInviteLoading(true);

    try {
      // Look up user by email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", trimmed));
      const snap = await getDocs(q);

      if (snap.empty) {
        setInviteMessage("No Onyva account exists with that email.");
        setInviteLoading(false);
        return;
      }

      const targetDoc = snap.docs[0];
      const targetUid = targetDoc.id;

      if (targetUid === user.uid) {
        setInviteMessage("You cannot send a friend request to yourself.");
        setInviteLoading(false);
        return;
      }

      // Check for existing relationship or pending request
      const reqRef = collection(db, "friendRequests");

      const sentSnap = await getDocs(
        query(reqRef, where("fromUserId", "==", user.uid))
      );
      const receivedSnap = await getDocs(
        query(reqRef, where("toUserId", "==", user.uid))
      );

      let hasPending = false;
      let hasAccepted = false;

      sentSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.toUserId === targetUid) {
          if (data.status === "pending") hasPending = true;
          if (data.status === "accepted") hasAccepted = true;
        }
      });

      receivedSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.fromUserId === targetUid) {
          if (data.status === "pending") hasPending = true;
          if (data.status === "accepted") hasAccepted = true;
        }
      });

      if (hasPending) {
        setInviteMessage("There is already a pending request between you.");
        setInviteLoading(false);
        return;
      }

      if (hasAccepted) {
        setInviteMessage("You are already connected.");
        setInviteLoading(false);
        return;
      }

      // Create new friend request
      await addDoc(collection(db, "friendRequests"), {
        fromUserId: user.uid,
        toUserId: targetUid,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setInviteMessage("Friend request sent.");
      setInviteEmail("");
    } catch (err) {
      console.error("Error sending friend request:", err);
      setInviteMessage("Failed to send request. Try again later.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRequestAction(
    requestId: string,
    action: "accept" | "decline"
  ) {
    if (!user) return;
    setActionLoadingId(requestId);

    try {
      const reqRef = doc(db, "friendRequests", requestId);
      const snap = await getDoc(reqRef);
      if (!snap.exists()) {
        setActionLoadingId(null);
        return;
      }
      const data = snap.data() as any;
      if (data.toUserId !== user.uid || data.status !== "pending") {
        setActionLoadingId(null);
        return;
      }

      const newStatus = action === "accept" ? "accepted" : "declined";

      await updateDoc(reqRef, {
        status: newStatus,
      });

      // Refresh incoming requests
      const incomingRef = collection(db, "friendRequests");
      const incomingQ = query(incomingRef, where("toUserId", "==", user.uid));
      const incomingSnap = await getDocs(incomingQ);

      const pending: FriendRequest[] = [];
      const fromIds = new Set<string>();

      incomingSnap.forEach((docSnap) => {
        const d = docSnap.data() as any;
        if (d.status === "pending") {
          pending.push({
            id: docSnap.id,
            fromUserId: d.fromUserId,
            toUserId: d.toUserId,
            status: d.status,
            createdAt: d.createdAt,
          });
          fromIds.add(d.fromUserId);
        }
      });

      const fromProfiles: Record<string, UserProfile | null> = {};
      await Promise.all(
        Array.from(fromIds).map(async (uid) => {
          try {
            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const d = userSnap.data() as any;
              fromProfiles[uid] = {
                uid,
                name: d.name ?? "",
                username: d.username ?? "",
                email: d.email ?? "",
              };
            } else {
              fromProfiles[uid] = null;
            }
          } catch (err) {
            console.error("Error loading sender profile:", err);
            fromProfiles[uid] = null;
          }
        })
      );

      const enriched = pending.map((req) => ({
        ...req,
        fromUserProfile: fromProfiles[req.fromUserId] ?? null,
      }));

      setIncomingRequests(enriched);

      // Reload friends after accepting
      if (action === "accept") {
        const allReqRef = collection(db, "friendRequests");
        const sentSnap = await getDocs(
          query(allReqRef, where("fromUserId", "==", user.uid))
        );
        const receivedSnap = await getDocs(
          query(allReqRef, where("toUserId", "==", user.uid))
        );

        const friendIds = new Set<string>();

        sentSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          if (d.status === "accepted") {
            friendIds.add(d.toUserId);
          }
        });

        receivedSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          if (d.status === "accepted") {
            friendIds.add(d.fromUserId);
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
      }
    } catch (err) {
      console.error("Error updating friend request:", err);
    } finally {
      setActionLoadingId(null);
    }
  }

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

  return (
    <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      >
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <TopNav />

        <header className="mt-4 mb-6">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-1">
            Friends
          </h1>
          <p className="text-sm text-slate-400">
            Add trusted people and see who has requested to connect with you.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side: send requests and incoming */}
          <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/40">
            <h2 className="text-lg font-semibold mb-1">
              Send a friend request
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Enter the email linked to their Onyva account. They will be able
              to accept or decline your request.
            </p>

            <form
              onSubmit={handleSendInvite}
              className="space-y-4 sm:space-y-5 max-w-md mb-6"
            >
              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                  Friend&apos;s email
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 shadow-inner shadow-black/40"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                  disabled={inviteLoading}
                />
              </div>

              {inviteMessage && (
                <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-100">
                  {inviteMessage}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-xs sm:text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
                >
                  {inviteLoading ? "Sending..." : "Send request"}
                </button>
              </div>
            </form>

            <div className="border-t border-white/5 pt-5">
              <h2 className="text-lg font-semibold mb-1">
                Incoming requests
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                These people want to connect and share dreams with you.
              </p>

              {incomingLoading && (
                <p className="text-xs text-slate-400">
                  Loading incoming requests...
                </p>
              )}

              {!incomingLoading && incomingRequests.length === 0 && (
                <p className="text-xs text-slate-500">
                  You have no pending requests right now.
                </p>
              )}

              <div className="space-y-3 mt-3">
                {incomingRequests.map((req) => {
                  const p = req.fromUserProfile;
                  const label =
                    p && (p.name || p.username)
                      ? `${p.name || p.username} ${
                          p.email ? `(${p.email})` : ""
                        }`
                      : `User ${req.fromUserId.substring(0, 6)}...`;

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-xs sm:text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-100">{label}</p>
                        {p?.username && (
                          <p className="text-[11px] text-slate-400">
                            @{p.username}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleRequestAction(req.id, "decline")
                          }
                          disabled={actionLoadingId === req.id}
                          className="px-3 py-1.5 rounded-full border border-white/15 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-70"
                        >
                          {actionLoadingId === req.id
                            ? "Updating..."
                            : "Decline"}
                        </button>
                        <button
                          onClick={() =>
                            handleRequestAction(req.id, "accept")
                          }
                          disabled={actionLoadingId === req.id}
                          className="px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-[11px] font-medium text-white shadow-md shadow-emerald-500/30 disabled:bg-slate-700"
                        >
                          {actionLoadingId === req.id
                            ? "Updating..."
                            : "Accept"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right side: friends list */}
          <section className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/40">
            <h2 className="text-lg font-semibold mb-1">Your friends</h2>
            <p className="text-xs text-slate-400 mb-3">
              Click a friend to jump straight to the dreams they have shared
              with you.
            </p>

            {friendsLoading && (
              <p className="text-xs text-slate-400">Loading friends...</p>
            )}

            {!friendsLoading && friends.length === 0 && (
              <p className="text-xs text-slate-500">
                You do not have any friends connected yet.
              </p>
            )}

            <ul className="mt-3 space-y-3">
              {friends.map((f) => (
                <li key={f.uid}>
                  <Link
                    href={`/friends-dreams?from=${encodeURIComponent(f.uid)}`}
                    className="block rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-xs sm:text-sm hover:border-indigo-400/70 hover:bg-slate-900/90 transition"
                  >
                    <p className="font-medium text-slate-100">
                      {f.name || f.username || "Unnamed user"}
                    </p>
                    {f.username && (
                      <p className="text-[11px] text-slate-400">@{f.username}</p>
                    )}
                    {f.email && (
                      <p className="text-[11px] text-slate-500">{f.email}</p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-400">
                      View shared dreams →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-white/5 pt-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-white/10 text-xs text-slate-200 hover:bg-white/5 transition"
              >
                Back to dashboard
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
