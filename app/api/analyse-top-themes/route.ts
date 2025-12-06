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

    const themes: string[] = Array.isArray(body.themes) ? body.themes : [];
    const totalDreams: number = body.totalDreams ?? 0;

    if (themes.length === 0) {
      return NextResponse.json(
        {
          analysis:
            "There are no recurring themes yet. As you log more dreams and generate interpretations, this view will become more meaningful.",
        },
        { status: 200 }
      );
    }

    const trimmedThemes = themes.slice(0, 50);

    const systemPrompt = `
You analyse recurring dream themes.

You are always given a clear list of themes. Never say that the themes are unclear, missing, incomplete, or did not come through.

Your job:
1) Notice any obvious clusters, tensions, or contrasts between themes.
2) Offer possible psychological or emotional threads that might link them.
3) Keep everything tentative and observational, not diagnostic.
4) Encourage the dreamer to keep tracking rather than chase certainty.

Requirements:
- You must explicitly reference at least three of the themes by name.
- Maximum 6 sentences total.
- Plain text only.
- No metaphors or poetic language.
- No em or en dashes.
`;

    const userPrompt = `
Total dreams logged: ${totalDreams}

Here are the most frequent themes, ordered from most common downward:

${trimmedThemes.map((t, idx) => `${idx + 1}. ${t}`).join("\n")}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
    });

    const analysis = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!analysis) {
      return NextResponse.json(
        {
          analysis:
            "There are recurring themes present, but the system could not generate a stable summary this time. Try again after a few more dreams.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error in /api/analyse-top-themes:", error);
    return NextResponse.json(
      { error: "Failed to analyse top themes" },
      { status: 500 }
    );
  }
}
