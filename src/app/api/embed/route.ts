import { NextRequest, NextResponse } from "next/server";

// Live embedding endpoint - calls Python BGE-M3 service
const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000";

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

  try {
    // Call Python embedding service
    const response = await fetch(`${PYTHON_SERVICE_URL}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        concept,
        language,
        definition: definition || concept, // Use concept as fallback
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout for first request (model warmup)
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          error: error.detail || "Python service error",
          status: "error",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Python service error:", error);

    // Return error with helpful message
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "Request timeout - model may be loading"
            : "Python service unavailable. Start with: cd python && uvicorn app.main:app --reload --port 8000",
        status: "offline",
      },
      { status: 503 }
    );
  }
}
