// lib/dreamSimilarity.ts
// Client side helper for working with dream embeddings.
// This module is meant to be used from client components where Firebase Auth is active.

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp,
  } from "firebase/firestore";
  import { db } from "./firebase";
  
  export type DreamWithEmbedding = {
    id: string;
    userId: string;
    title?: string;
    rawText: string;
    embedding?: number[];
    createdAt?: any;
    [key: string]: any;
  };
  
  export type SimilarDream = {
    id: string;
    title?: string;
    similarity: number;
    createdAt: any;
    dream: DreamWithEmbedding;
  };
  
  /**
   * Cosine similarity between two vectors.
   * Returns a value between -1 and 1, where higher means more similar.
   */
  export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }
  
    let dot = 0;
    let normA = 0;
    let normB = 0;
  
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];
      dot += x * y;
      normA += x * x;
      normB += y * y;
    }
  
    if (normA === 0 || normB === 0) {
      return 0;
    }
  
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Fetches all dreams for a user and silently backfills missing embeddings.
   * This should be called from a client where the user is authenticated.
   */
  export async function ensureDreamEmbeddingsForUser(
    userId: string
  ): Promise<DreamWithEmbedding[]> {
    if (!userId) {
      throw new Error("ensureDreamEmbeddingsForUser: userId is required");
    }
  
    const dreamsRef = collection(db, "dreams");
    const q = query(dreamsRef, where("userId", "==", userId));
    const snap = await getDocs(q);
  
    const dreams: DreamWithEmbedding[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        userId: data.userId,
        title: data.title ?? "",
        rawText: data.rawText ?? "",
        embedding: data.embedding,
        createdAt: data.createdAt,
        ...data,
      };
    });
  
    // Backfill missing embeddings one by one.
    // This runs on the client, so Firestore rules allow the updates.
    for (const dream of dreams) {
      const hasValidEmbedding =
        Array.isArray(dream.embedding) && dream.embedding.length > 0;
  
      if (hasValidEmbedding) {
        continue;
      }
  
      const combinedText = `${dream.title || ""}\n\n${dream.rawText || ""}`.trim();
  
      if (!combinedText) {
        // Nothing to embed for this dream, skip.
        continue;
      }
  
      try {
        const res = await fetch("/api/embed-dream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: combinedText }),
        });
  
        if (!res.ok) {
          // Do not throw, just log and continue. Silent fix.
          const payload = await res.json().catch(() => null);
          console.error(
            "Failed to generate embedding for dream",
            dream.id,
            res.status,
            payload || "(no body)"
          );
          continue;
        }
  
        const data = await res.json();
        const embedding = data.embedding;
  
        if (Array.isArray(embedding) && embedding.length > 0) {
          dream.embedding = embedding as number[];
  
          // Persist embedding back to Firestore from the client
          try {
            const ref = doc(db, "dreams", dream.id);
            await updateDoc(ref, {
              embedding,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            console.error(
              "Failed to save embedding back to Firestore for dream",
              dream.id,
              err
            );
          }
        } else {
          console.warn(
            "embed-dream returned no valid embedding for dream",
            dream.id
          );
        }
      } catch (err) {
        console.error("Error calling /api/embed-dream for dream", dream.id, err);
      }
    }
  
    return dreams;
  }
  
  /**
   * Returns the most similar dreams for a given source dream.
   * Will silently generate embeddings for dreams that are missing them.
   */
  export async function getSimilarDreamsForUser(
    userId: string,
    sourceDreamId: string,
    maxResults: number = 10
  ): Promise<SimilarDream[]> {
    const dreams = await ensureDreamEmbeddingsForUser(userId);
  
    const source = dreams.find(
      (d) =>
        d.id === sourceDreamId &&
        Array.isArray(d.embedding) &&
        d.embedding.length > 0
    );
  
    if (!source || !source.embedding) {
      console.warn(
        "getSimilarDreamsForUser: source dream has no embedding, returning empty list"
      );
      return [];
    }
  
    const results: SimilarDream[] = [];
  
    for (const dream of dreams) {
      if (
        dream.id === sourceDreamId ||
        !Array.isArray(dream.embedding) ||
        dream.embedding.length === 0
      ) {
        continue;
      }
  
      const sim = cosineSimilarity(source.embedding, dream.embedding);
  
      results.push({
        id: dream.id,
        title: dream.title,
        similarity: sim,
        createdAt: dream.createdAt,
        dream,
      });
    }
  
    // Sort by similarity descending and limit
    results.sort((a, b) => b.similarity - a.similarity);
  
    return results.slice(0, maxResults);
  }
  