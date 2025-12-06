import { NextResponse } from "next/server";
import { getDreamEmbedding } from "../../../lib/embeddings";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server is not configured with an OpenAI API key." },
        { status: 500 }
      );
    }

    let body: any = null;

    try {
      body = await req.json();
    } catch (err) {
      console.error("Failed to parse JSON body in /api/embed-dream:", err);
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Accept both `text` and legacy `dreamText` just in case
    const textRaw: unknown = body?.text ?? body?.dreamText;
    const text =
      typeof textRaw === "string" ? textRaw.trim() : "";

    if (!text) {
      console.error("Missing text in /api/embed-dream body. Got:", body);
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const embedding = await getDreamEmbedding(text);

    return NextResponse.json({ embedding });
  } catch (error) {
    console.error("Error in /api/embed-dream:", error);
    return NextResponse.json(
      { error: "Failed to generate embedding for dream" },
      { status: 500 }
    );
  }
}
