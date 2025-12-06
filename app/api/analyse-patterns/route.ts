import { NextResponse } from "next/server";
import OpenAI from "openai";

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

    const dreams: {
      id: string;
      createdAt: string;
      symbols: string[];
      themes: string[];
    }[] = body.dreams ?? [];

    const totalDreams: number = body.totalDreams ?? dreams.length;
    const windowDreams: number = body.windowDreams ?? dreams.length;

    if (!Array.isArray(dreams) || dreams.length === 0) {
      return NextResponse.json(
        {
          analysis:
            "You have not logged any dreams yet. Start recording your dreams regularly so patterns, recurring symbols, and themes can begin to emerge.",
        },
        { status: 200 }
      );
    }

    const systemPrompt = `
You are an analyst of personal dream patterns.

You receive:
- A compact list of dreams with date, symbols, and themes
- The total number of dreams ever logged
- The number of dreams in the current analysis window

Your job:
1) Identify recurring symbols or themes across these dreams.
2) Explain possible psychological or mythic meaning, but avoid certainty.
3) If there are only a few dreams in the window, clearly say that the dataset is small and conclusions are tentative.
4) Suggest one or two practical things the dreamer can pay attention to next time they log dreams.

Constraints on length:
- Maximum 3 paragraphs.
- Maximum 8 sentences in total.
- No filler, poetic language, or metaphors.
- Keep sentences short and direct.

Tone:
- Clear and grounded
- Observational rather than interpretive
- Encourage continued tracking and exploration, not dependency on you.
- no em or en dashes

Return the final answer as plain text only.
`;

    const userPrompt = `
Total dreams ever logged: ${totalDreams}
Dreams in this analysis window: ${windowDreams}

Here is a compact list of dreams with their extracted symbols and themes:

${dreams
  .map((d) => {
    const date = d.createdAt;
    const sym = d.symbols && d.symbols.length ? d.symbols.join(", ") : "none";
    const th = d.themes && d.themes.length ? d.themes.join(", ") : "none";
    return `- Dream ${d.id} (${date})
  Symbols: ${sym}
  Themes: ${th}`;
  })
  .join("\n\n")}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const analysis = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error in /api/analyse-patterns:", error);
    return NextResponse.json(
      { error: "Failed to analyse dream patterns" },
      { status: 500 }
    );
  }
}
