import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, access } from "fs/promises";
import { join } from "path";

const EXAMPLES_DIR = join(process.cwd(), "python/examples");
const DATA_DIR = join(process.cwd(), "python/data");
const BENCHMARK_DIR = join(process.cwd(), "python/benchmark_output");

interface ModelInfo {
  key: string;
  name: string;
  dimensions: number;
  type: string;
  notes: string;
  available: boolean;
  hasData: boolean;
}

interface BenchmarkMetrics {
  clas: { score: number; per_concept: Record<string, number> };
  topology: { preservation: number; p_value: number };
  cluster_coherence: { per_cluster: Record<string, Record<string, number>>; average: number };
  ghost_detection: { rate: number; per_ghost: Record<string, Record<string, number>> };
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") || "list";
  const file = request.nextUrl.searchParams.get("file");
  const model = request.nextUrl.searchParams.get("model");

  // List available embedding models
  if (action === "list-models") {
    try {
      // Read manifest from benchmark output
      const manifestPath = join(BENCHMARK_DIR, "manifest.json");
      let manifest: { models: ModelInfo[]; available: string[]; benchmark_models?: string[] } = {
        models: [],
        available: [],
      };

      try {
        const content = await readFile(manifestPath, "utf-8");
        manifest = JSON.parse(content);
      } catch {
        // No manifest yet, return default models
        manifest.models = [
          { key: "bge-m3", name: "BGE-M3", dimensions: 1024, type: "local", notes: "Current baseline", available: true, hasData: false },
          { key: "e5-large", name: "Multilingual E5 Large", dimensions: 1024, type: "local", notes: "Microsoft contrastive", available: true, hasData: false },
          { key: "mistral-embed", name: "Mistral Embed", dimensions: 1024, type: "api", notes: "Requires API key", available: false, hasData: false },
          { key: "cohere-embed", name: "Cohere Embed v3", dimensions: 1024, type: "api", notes: "Requires API key", available: false, hasData: false },
          { key: "sonar", name: "SONAR", dimensions: 1024, type: "local", notes: "200+ languages", available: false, hasData: false },
          { key: "nv-embed", name: "NV-Embed-v2", dimensions: 1024, type: "local", notes: "Decoder architecture", available: false, hasData: false },
        ];
      }

      // Check which models have benchmark data
      const modelsWithData: ModelInfo[] = await Promise.all(
        manifest.models.map(async (m) => {
          const conceptsPath = join(BENCHMARK_DIR, m.key, "concepts.json");
          let hasData = false;
          try {
            await access(conceptsPath);
            hasData = true;
          } catch {
            // No data for this model
          }
          return {
            ...m,
            available: manifest.available?.includes(m.key) ?? false,
            hasData,
          };
        })
      );

      return NextResponse.json({
        models: modelsWithData,
        benchmarked: manifest.benchmark_models || [],
      });
    } catch (error) {
      return NextResponse.json({ error: "Failed to list models" }, { status: 500 });
    }
  }

  // Load model-specific concepts
  if (action === "load-model" && model) {
    try {
      const conceptsPath = join(BENCHMARK_DIR, model, "concepts.json");
      const metricsPath = join(BENCHMARK_DIR, model, "metrics.json");

      // Load concepts
      const conceptsContent = await readFile(conceptsPath, "utf-8");
      const concepts = JSON.parse(conceptsContent);

      // Load metrics
      let metrics: BenchmarkMetrics | null = null;
      try {
        const metricsContent = await readFile(metricsPath, "utf-8");
        metrics = JSON.parse(metricsContent);
      } catch {
        // Metrics might not exist
      }

      return NextResponse.json({
        concepts,
        model,
        count: concepts.length,
        metrics,
      });
    } catch (error) {
      return NextResponse.json({ error: `No benchmark data for model: ${model}` }, { status: 404 });
    }
  }

  // Load comparison data
  if (action === "comparison") {
    try {
      const comparisonPath = join(BENCHMARK_DIR, "comparison.json");
      const content = await readFile(comparisonPath, "utf-8");
      const comparison = JSON.parse(content);
      return NextResponse.json(comparison);
    } catch (error) {
      return NextResponse.json({ error: "No comparison data available" }, { status: 404 });
    }
  }

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

      // From benchmark_output/ (model-specific)
      try {
        const benchmarkDirs = await readdir(BENCHMARK_DIR);
        for (const dir of benchmarkDirs) {
          // Skip files, only process directories
          if (dir.endsWith(".json")) continue;

          const conceptsPath = join(BENCHMARK_DIR, dir, "concepts.json");
          try {
            await access(conceptsPath);
            datasets.push({
              id: `benchmark-${dir}`,
              name: `${dir} (benchmark)`,
              path: `python/benchmark_output/${dir}/concepts.json`,
              source: "benchmark",
            });
          } catch {
            // No concepts.json in this dir
          }
        }
      } catch {
        // benchmark_output might not exist
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
      } else if (file.startsWith("python/benchmark_output/")) {
        filePath = join(process.cwd(), file);
      } else {
        // Default to examples
        filePath = join(EXAMPLES_DIR, file);
      }

      const content = await readFile(filePath, "utf-8");
      const concepts = JSON.parse(content);

      // Try to load metrics if this is a benchmark file
      let metrics = null;
      if (file.includes("benchmark_output")) {
        const metricsPath = filePath.replace("concepts.json", "metrics.json");
        try {
          const metricsContent = await readFile(metricsPath, "utf-8");
          metrics = JSON.parse(metricsContent);
        } catch {
          // No metrics
        }
      }

      return NextResponse.json({
        concepts,
        file,
        count: concepts.length,
        metrics,
      });
    } catch (error) {
      return NextResponse.json({ error: `Failed to load ${file}` }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
