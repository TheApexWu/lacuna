import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const EXAMPLES_DIR = join(process.cwd(), "python/examples");
const DATA_DIR = join(process.cwd(), "python/data");

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") || "list";
  const file = request.nextUrl.searchParams.get("file");

  if (action === "list") {
    try {
      // List all concept JSON files
      const datasets: { id: string; name: string; path: string; source: string }[] = [];

      // From examples/
      try {
        const exampleFiles = await readdir(EXAMPLES_DIR);
        for (const f of exampleFiles) {
          if (f.endsWith("_concepts.json")) {
            const name = f.replace("_concepts.json", "").replace(/_/g, " ");
            datasets.push({
              id: f,
              name: name.charAt(0).toUpperCase() + name.slice(1),
              path: `python/examples/${f}`,
              source: "examples",
            });
          }
        }
      } catch {
        // examples dir might not exist
      }

      // From data/
      try {
        const dataFiles = await readdir(DATA_DIR);
        for (const f of dataFiles) {
          if (f.endsWith(".json") && !f.includes("concept_ids")) {
            const name = f.replace(".json", "").replace(/_/g, " ");
            datasets.push({
              id: f,
              name: name.charAt(0).toUpperCase() + name.slice(1),
              path: `python/data/${f}`,
              source: "data",
            });
          }
        }
      } catch {
        // data dir might not exist
      }

      return NextResponse.json({ datasets });
    } catch (error) {
      return NextResponse.json({ error: "Failed to list datasets" }, { status: 500 });
    }
  }

  if (action === "load" && file) {
    try {
      // Determine which directory
      let filePath: string;
      if (file.startsWith("python/examples/")) {
        filePath = join(process.cwd(), file);
      } else if (file.startsWith("python/data/")) {
        filePath = join(process.cwd(), file);
      } else {
        // Default to examples
        filePath = join(EXAMPLES_DIR, file);
      }

      const content = await readFile(filePath, "utf-8");
      const concepts = JSON.parse(content);

      return NextResponse.json({
        concepts,
        file,
        count: concepts.length,
      });
    } catch (error) {
      return NextResponse.json({ error: `Failed to load ${file}` }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
