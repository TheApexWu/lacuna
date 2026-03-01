import { NextRequest, NextResponse } from "next/server";
import { getExtractorAgentId, callAgent } from "../../../lib/mistral";

interface ExtractedConcept {
  name: string;
  label_en: string;
  label_de: string;
  definition_en: string;
  definition_de: string;
  cluster_hint: string;
  confidence: number;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { text, languages } = body as {
    text: string;
    languages?: string[];
  };

  if (!text) {
    return NextResponse.json(
      { error: "text is required" },
      { status: 400 }
    );
  }

  const langs = languages || ["en", "de"];

  const prompt = `Analyze the following text and extract conceptual frames that would reveal structural differences between ${langs.join(" and ")}.

Text:
"""
${text}
"""

Focus on concepts where translation is imperfect. Extract 5-15 concepts.`;

  try {
    const agentId = await getExtractorAgentId();
    const raw = await callAgent(agentId, prompt);

    let concepts: ExtractedConcept[] = [];
    try {
      const parsed = JSON.parse(raw);
      concepts = parsed.concepts || [];
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        concepts = parsed.concepts || [];
      }
    }

    return NextResponse.json({
      concepts,
      agentId,
      model: "mistral-large-latest",
    });
  } catch (err) {
    console.error("Extractor agent error:", err);
    return NextResponse.json(
      {
        concepts: [],
        error: err instanceof Error ? err.message : "Agent call failed",
      },
      { status: 500 }
    );
  }
}
