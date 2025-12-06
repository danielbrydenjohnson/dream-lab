// app/api/analyse-themes/route.ts
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

    const themes: { value: string; count: number }[] = body.themes ?? [];
    const totalDreams: number = body.totalDreams ?? 0;

    if (!Array.isArray(themes) || themes.length === 0) {
      return NextResponse.json(
        {
          analysis:
            "There are no recurring themes yet. As you log more dreams and generate interpretations, this view will become more meaningful.",
        },
        { status: 200 }
      );
    }

    const systemPrompt = `
You are an analyst of recurring dream themes.

You receive:
- A list of themes with how often they appear
- The total number of dreams logged

Your job:
1) Notice which themes are most central.
2) Offer possible psychological or symbolic readings without certainty.
3) Comment on how concentrated or spread out the themes are.
4) Gently suggest what the dreamer might pay attention to as they keep tracking dreams.

Constraints:
- Maximum 6 short lines.
- Each line is a separate bullet, but do NOT include bullet characters, just line breaks.
- No metaphors or poetic language.
- No clinical language or diagnosis.
- No em or en dashes.

Tone:
- Calm and observational.
- Grounded and tentative, never absolute.
- Encourage continued tracking and gentle curiosity.

Return plain text only.
`;

    const themesList = themes
      .map((t) => `${t.value} (${t.count})`)
      .join(", ");

    const userPrompt = `
Total dreams logged: ${totalDreams}

Here are the most frequent themes and how often they appear:
${themesList}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 300,
    });

    const analysis = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error in /api/analyse-themes:", error);
    return NextResponse.json(
      { error: "Failed to analyse dream themes" },
      { status: 500 }
    );
  }
}
