import { NextRequest, NextResponse } from "next/server";

// Live embedding endpoint scaffold.
// Connects to BGE-M3 pipeline on Mac Mini for real-time concept embedding.
// TODO: Wire to Brendan's embed.py via HTTP or direct Python subprocess.

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { concept, language, definition } = body as {
    concept: string;
    language: string;
    definition?: string;
  };

  if (!concept || !language) {
    return NextResponse.json(
      { error: "concept and language are required" },
      { status: 400 }
    );
  }

  // Scaffold response with expected shape
  // Replace with real pipeline call when embed.py is running
  return NextResponse.json({
    concept,
    language,
    definition: definition || null,
    embedding: null, // Float32Array from BGE-M3, 1024-dim
    position: null, // [x, z] after UMAP projection
    weight: null, // 0-1 normalized
    neighbors: [], // Nearest concepts by cosine distance
    status: "scaffold", // Changes to "live" when pipeline connected
  });
}
