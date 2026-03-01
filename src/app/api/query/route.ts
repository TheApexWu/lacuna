import { NextRequest, NextResponse } from "next/server";
import { getClient } from "../../../lib/mistral";
import conceptEmbeddings from "../../../data/concept-embeddings.json";

type EmbeddingData = {
  dimension: number;
  languages: Record<string, Record<string, number[]>>;
};

const data = conceptEmbeddings as EmbeddingData;
const allLangs = Object.keys(data.languages);
const conceptIds = Object.keys(data.languages[allLangs[0]]);

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function mag(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

function cosine(a: number[], b: number[]): number {
  const ma = mag(a);
  const mb = mag(b);
  if (ma === 0 || mb === 0) return 0;
  return dot(a, b) / (ma * mb);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { text, lang_a, lang_b } = body as {
    text: string;
    lang_a?: string;
    lang_b?: string;
  };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const a = lang_a || "en";
  const b = lang_b || "de";

  if (!data.languages[a]) {
    return NextResponse.json(
      { error: `Unknown language: ${a}. Available: ${allLangs.join(", ")}` },
      { status: 400 }
    );
  }
  if (!data.languages[b]) {
    return NextResponse.json(
      { error: `Unknown language: ${b}. Available: ${allLangs.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const client = getClient();
    const embedResponse = await client.embeddings.create({
      model: "mistral-embed",
      inputs: [text.trim()],
    });

    const userVector = embedResponse.data[0].embedding as number[];

    const activations = conceptIds.map((id) => {
      const vecA = (data.languages[a]?.[id] ?? []) as number[];
      const vecB = (data.languages[b]?.[id] ?? []) as number[];
      const simA = cosine(userVector, vecA);
      const simB = cosine(userVector, vecB);
      return {
        conceptId: id,
        [`similarity_${a}`]: Math.round(simA * 1000) / 1000,
        [`similarity_${b}`]: Math.round(simB * 1000) / 1000,
        divergence: Math.round(Math.abs(simA - simB) * 1000) / 1000,
        direction: Math.abs(simA - simB) < 0.005 ? "neutral" : simA > simB ? a : b,
      };
    });

    // Sort by divergence descending -- the gaps ARE the findings
    activations.sort((x, y) => y.divergence - x.divergence);

    return NextResponse.json({
      query: text.trim(),
      lang_a: a,
      lang_b: b,
      activations,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
