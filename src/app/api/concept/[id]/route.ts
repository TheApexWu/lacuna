import { NextRequest, NextResponse } from "next/server";
import { concepts, CLUSTER_HEX, getLabel } from "../../../../data/versailles";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lang = request.nextUrl.searchParams.get("lang") || "en";

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

  return NextResponse.json({
    id: concept.id,
    label: getLabel(concept, lang),
    cluster: concept.cluster,
    clusterColor: CLUSTER_HEX[concept.cluster] || "#f59e0b",
    source: concept.source,
    weight: concept.weight,
    position: concept.position,
    lacuna: concept.lacuna,
    hero: concept.hero || false,
    definition: concept.definitions?.[lang] || concept.definitions?.["en"] || null,
    neighbors,
    interpretation: null, // Placeholder for Mistral agent
  });
}
