import { NextRequest, NextResponse } from "next/server";
import { concepts, CLUSTER_HEX, getLabel } from "../../../../data/versailles";
import { getInterpreterAgentId, callAgent } from "../../../../lib/mistral";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lang = request.nextUrl.searchParams.get("lang") || "en";
  const doInterpret = request.nextUrl.searchParams.get("interpret") === "true";

  const concept = concepts.find((c) => c.id === id);
  if (!concept) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  // Compute Euclidean distances to all other concepts per language
  const neighbors: Record<string, { id: string; label: string; distance: number }[]> = {};

  const languages = Object.keys(concept.position);
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
      const distance = Math.sqrt(dx * dx + dz * dz);

      dists.push({
        id: other.id,
        label: getLabel(other, l),
        distance,
      });
    }

    dists.sort((a, b) => a.distance - b.distance);
    neighbors[l] = dists.slice(0, 8);
  }

  // Optional inline interpretation
  let interpretation: string | null = null;
  if (doInterpret) {
    try {
      const agentId = await getInterpreterAgentId();
      const ghostStatus = Object.entries(concept.ghost)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const prompt = `Concept: "${getLabel(concept, lang)}" (id: ${concept.id})
Cluster: ${concept.cluster}
Hero: ${concept.hero ? "yes" : "no"}
Ghost in: ${ghostStatus.length > 0 ? ghostStatus.join(", ") : "none"}
Weight: ${JSON.stringify(concept.weight)}
Neighbors: ${Object.entries(neighbors)
        .map(
          ([l, ns]) =>
            `${l.toUpperCase()}: ${ns
              .slice(0, 5)
              .map((n) => `${n.label}(${n.distance.toFixed(3)})`)
              .join(", ")}`
        )
        .join(" | ")}`;
      const raw = await callAgent(agentId, prompt);
      try {
        const parsed = JSON.parse(raw);
        interpretation = parsed.interpretation || raw;
      } catch {
        interpretation = raw;
      }
    } catch (err) {
      console.error("Inline interpretation failed:", err);
    }
  }

  return NextResponse.json({
    id: concept.id,
    label: getLabel(concept, lang),
    cluster: concept.cluster,
    clusterColor: CLUSTER_HEX[concept.cluster] || "#f59e0b",
    source: concept.source,
    weight: concept.weight,
    position: concept.position,
    ghost: concept.ghost,
    hero: concept.hero || false,
    definition: concept.definitions?.[lang] || concept.definitions?.["en"] || null,
    neighbors,
    interpretation,
  });
}
