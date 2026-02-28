import { NextRequest, NextResponse } from "next/server";
import { getExtractorAgentId, getInterpreterAgentId, callAgent } from "../../../lib/mistral";

type Stage = "extracting" | "embedding" | "validating" | "interpreting" | "complete";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { topic, languages } = body as {
    topic: string;
    languages?: string[];
  };

  if (!topic) {
    return NextResponse.json(
      { error: "topic is required" },
      { status: 400 }
    );
  }

  const langs = languages || ["en", "de"];
  const stages: { stage: Stage; timestamp: number }[] = [];

  try {
    // Stage 1: Extract concepts
    stages.push({ stage: "extracting", timestamp: Date.now() });

    const extractorId = await getExtractorAgentId();
    const extractPrompt = `Extract conceptual frames from this topic that reveal structural differences between ${langs.join(" and ")}:

Topic: "${topic}"

Focus on concepts central to this topic where translation is imperfect.`;

    const extractRaw = await callAgent(extractorId, extractPrompt);
    let concepts: Array<{
      name: string;
      label_en: string;
      label_de: string;
      definition_en: string;
      definition_de: string;
      cluster_hint: string;
      confidence: number;
    }> = [];

    try {
      const parsed = JSON.parse(extractRaw);
      concepts = parsed.concepts || [];
    } catch {
      const jsonMatch = extractRaw.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        concepts = parsed.concepts || [];
      }
    }

    // Stage 2: Embedding (scaffold -- requires Mac Mini pipeline)
    stages.push({ stage: "embedding", timestamp: Date.now() });
    // TODO: POST each concept to /api/embed when Brendan's pipeline is live
    // For now, skip to interpretation

    // Stage 3: Validation (scaffold)
    stages.push({ stage: "validating", timestamp: Date.now() });
    // TODO: Validate cosine distances via Brendan's validator

    // Stage 4: Interpret top concepts
    stages.push({ stage: "interpreting", timestamp: Date.now() });

    const interpreterId = await getInterpreterAgentId();
    const interpretations: Array<{ concept: string; interpretation: string }> = [];

    // Interpret top 5 by confidence
    const topConcepts = concepts
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 5);

    for (const concept of topConcepts) {
      try {
        const interpretPrompt = `Concept: "${concept.label_en}" / "${concept.label_de}"
Cluster hint: ${concept.cluster_hint}
Definition (EN): ${concept.definition_en}
Definition (DE): ${concept.definition_de}
Context: ${topic}

Explain why this concept likely diverges in topology between ${langs.join(" and ")}.`;

        const raw = await callAgent(interpreterId, interpretPrompt);
        let interp = raw;
        try {
          const parsed = JSON.parse(raw);
          interp = parsed.interpretation || raw;
        } catch {
          // use raw
        }

        interpretations.push({ concept: concept.name, interpretation: interp });
      } catch {
        interpretations.push({
          concept: concept.name,
          interpretation: "Interpretation failed",
        });
      }
    }

    stages.push({ stage: "complete", timestamp: Date.now() });

    return NextResponse.json({
      stage: "complete",
      concepts,
      interpretations,
      stages,
      terrain_update: null, // Will contain UMAP coordinates when embedding pipeline is live
    });
  } catch (err) {
    console.error("Orchestrator error:", err);
    return NextResponse.json(
      {
        stage: stages[stages.length - 1]?.stage || "extracting",
        error: err instanceof Error ? err.message : "Orchestration failed",
        stages,
      },
      { status: 500 }
    );
  }
}
