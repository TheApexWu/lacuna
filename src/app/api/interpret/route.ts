import { NextRequest, NextResponse } from "next/server";
import { concepts, getLabel } from "../../../data/versailles";
import { getInterpreterAgentId, callAgent } from "../../../lib/mistral";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { conceptId, language } = body as {
    conceptId: string;
    language: string;
  };

  if (!conceptId) {
    return NextResponse.json(
      { error: "conceptId is required" },
      { status: 400 }
    );
  }

  const lang = language || "en";
  const concept = concepts.find((c) => c.id === conceptId);
  if (!concept) {
    return NextResponse.json(
      { error: "Concept not found" },
      { status: 404 }
    );
  }

  // Compute neighbor distances for both languages
  const languages = Object.keys(concept.position);
  const neighborData: Record<
    string,
    { id: string; label: string; distance: number }[]
  > = {};

  for (const l of languages) {
    const pos = concept.position[l];
    if (!pos) continue;
    const dists: { id: string; label: string; distance: number }[] = [];
    for (const other of concepts) {
      if (other.id === concept.id) continue;
      const oPos = other.position[l];
      if (!oPos) continue;
      const dx = pos[0] - oPos[0];
      const dz = pos[1] - oPos[1];
      dists.push({
        id: other.id,
        label: getLabel(other, l),
        distance: Math.sqrt(dx * dx + dz * dz),
      });
    }
    dists.sort((a, b) => a.distance - b.distance);
    neighborData[l] = dists.slice(0, 5);
  }

  // Build prompt
  const ghostStatus = Object.entries(concept.lacuna)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const weightDelta =
    languages.length >= 2
      ? Math.abs(
          (concept.weight[languages[0]] || 0) -
            (concept.weight[languages[1]] || 0)
        )
      : 0;

  const prompt = `Concept: "${getLabel(concept, lang)}" (id: ${concept.id})
Cluster: ${concept.cluster}
Hero concept: ${concept.hero ? "yes" : "no"}
Ghost in: ${ghostStatus.length > 0 ? ghostStatus.join(", ") : "none (present in all languages)"}
Weight: ${JSON.stringify(concept.weight)}
Weight delta between languages: ${weightDelta.toFixed(2)}
Viewing language: ${lang}

Neighbors by language:
${Object.entries(neighborData)
  .map(
    ([l, neighbors]) =>
      `  ${l.toUpperCase()}: ${neighbors.map((n) => `${n.label} (${n.distance.toFixed(3)})`).join(", ")}`
  )
  .join("\n")}

${
  languages.length >= 2
    ? `Key divergence: Compare the nearest neighbor distances between ${languages[0].toUpperCase()} and ${languages[1].toUpperCase()}. Which concepts cluster differently, and what does this reveal?`
    : ""
}`;

  try {
    const agentId = await getInterpreterAgentId();
    const raw = await callAgent(agentId, prompt);

    // Parse JSON response
    let interpretation: string;
    try {
      const parsed = JSON.parse(raw);
      interpretation = parsed.interpretation || raw;
    } catch {
      // Agent returned plain text instead of JSON
      interpretation = raw.replace(/```json\n?|\n?```/g, "").trim();
      try {
        const parsed = JSON.parse(interpretation);
        interpretation = parsed.interpretation || interpretation;
      } catch {
        // Use raw text as-is
      }
    }

    return NextResponse.json({
      conceptId,
      interpretation,
      agentId,
      model: "mistral-large-latest",
    });
  } catch (err) {
    console.error("Interpreter agent error:", err);
    return NextResponse.json(
      {
        conceptId,
        interpretation: null,
        error: err instanceof Error ? err.message : "Agent call failed",
      },
      { status: 500 }
    );
  }
}
