import { NextResponse } from "next/server";
import OpenAI from "openai";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server is not configured with an OpenAI API key." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const dreamText: string = body.dreamText ?? "";
    const dreamId: string | undefined = body.dreamId;

    if (!dreamText.trim()) {
      return NextResponse.json(
        { error: "dreamText is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `
You are an assistant that interprets dreams from two complementary angles
and also extracts compact symbols and themes for pattern tracking.

1) Psychological interpretation:
   - Grounded in mainstream psychology and neuroscience
   - Focus on emotions, memory processing, recent life events, and underlying concerns
   - Be clear and practical, no jargon

2) Mystical interpretation:
   - Symbolic, archetypal, spiritual
   - Embrace strangeness and metaphor, but stay coherent
   - Treat the dream as a message from the deeper self or unconscious

3) Symbols:
   - Return a SHORT list of key symbols in the dream
   - These are objects, locations, figures, or images that stand out
   - Each symbol should be a very short phrase (for example "ocean", "stairs", "abandoned house")
   - Return AT MOST 5 symbols

4) Themes:
   - Return a SHORT list of core themes in the dream
   - These are abstract ideas like "loss", "transformation", "feeling watched", "being late"
   - Each theme should be a very short phrase
   - Return AT MOST 5 themes

Return ONLY valid JSON with exactly these keys:
- "psychInterpretation": string
- "mysticInterpretation": string
- "symbols": array of strings
- "themes": array of strings

No extra keys, no markdown, no commentary.
`;

    const userPrompt = `
Here is the dream text:

"${dreamText}"
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    let parsed: {
      psychInterpretation?: string;
      mysticInterpretation?: string;
      symbols?: unknown;
      themes?: unknown;
    };

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse JSON from OpenAI:", raw);
      return NextResponse.json(
        { error: "Failed to parse interpretation from model." },
        { status: 500 }
      );
    }

    const psychInterpretation = parsed.psychInterpretation ?? "";
    const mysticInterpretation = parsed.mysticInterpretation ?? "";

    const symbols = Array.isArray(parsed.symbols)
      ? parsed.symbols
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    const themes = Array.isArray(parsed.themes)
      ? parsed.themes
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    if (dreamId) {
      try {
        const ref = doc(db, "dreams", dreamId);
        await updateDoc(ref, {
          psychInterpretation,
          mysticInterpretation,
          symbols,
          themes,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to save interpretations to Firestore:", err);
      }
    }

    return NextResponse.json({
      psychInterpretation,
      mysticInterpretation,
      symbols,
      themes,
    });
  } catch (error) {
    console.error("Error in /api/interpret-dream:", error);
    return NextResponse.json(
      { error: "Failed to interpret dream" },
      { status: 500 }
    );
  }
}
