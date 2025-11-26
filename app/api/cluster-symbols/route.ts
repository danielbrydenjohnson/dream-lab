import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type SymbolCount = {
  value: string;
  count: number;
};

type Cluster = {
  label: string;
  description: string;
  totalCount: number;
  items: string[];
};

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
    const symbols: SymbolCount[] = Array.isArray(body.symbols)
      ? body.symbols
      : [];

    if (!symbols.length) {
      return NextResponse.json(
        { clusters: [] as Cluster[] },
        { status: 200 }
      );
    }

    const systemPrompt = `
You are mapping recurring dream symbols into a small number of psychologically meaningful clusters.

You receive:
- A list of symbols with how many dreams they appear in.

Your job:
1) Group related symbols together into clusters.
2) Give each cluster:
   - a short label (2 to 5 words)
   - a very brief description of the possible meaning or domain
   - the totalCount (sum of counts of symbols in that cluster)
   - the list of symbol names in that cluster
3) If there are symbols that do not fit any group, you can put them in a "Miscellaneous" or "Other" cluster.

Rules:
- Do not invent new symbols. Only use the ones provided.
- Keep descriptions short and grounded, not mystical fluff.
- Aim for 3 to 7 clusters in total.

Return a JSON object of the form:
{
  "clusters": [
    {
      "label": "string",
      "description": "string",
      "totalCount": number,
      "items": ["symbol one", "symbol two"]
    }
  ]
}
`;

    const symbolsText = symbols
      .map((s) => `- ${s.value} (in ${s.count} dreams)`)
      .join("\n");

    const userPrompt = `
Here are the dream symbols and how often they appear:

${symbolsText}

Now cluster them following the rules.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse cluster JSON:", e, raw);
      return NextResponse.json(
        { error: "Model returned invalid cluster JSON" },
        { status: 500 }
      );
    }

    const clusters: Cluster[] = Array.isArray(parsed.clusters)
      ? parsed.clusters.map((c: any) => ({
          label: typeof c.label === "string" ? c.label : "Unlabeled cluster",
          description:
            typeof c.description === "string"
              ? c.description
              : "No description provided.",
          totalCount:
            typeof c.totalCount === "number" && c.totalCount >= 0
              ? c.totalCount
              : 0,
          items: Array.isArray(c.items)
            ? c.items
                .filter((x: any) => typeof x === "string")
                .map((x: string) => x)
            : [],
        }))
      : [];

    return NextResponse.json({ clusters });
  } catch (error) {
    console.error("Error in /api/cluster-symbols:", error);
    return NextResponse.json(
      { error: "Failed to cluster symbols" },
      { status: 500 }
    );
  }
}
