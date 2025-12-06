import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = "text-embedding-3-small";

export async function getDreamEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot create embedding for empty text");
  }

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Failed to get embedding from OpenAI");
  }

  return embedding;
}
