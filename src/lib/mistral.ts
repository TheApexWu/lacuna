import { Mistral } from "@mistralai/mistralai";

// Singleton client
let client: Mistral | null = null;

function getClient(): Mistral {
  if (!client) {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) throw new Error("MISTRAL_API_KEY not set");
    client = new Mistral({ apiKey: key });
  }
  return client;
}

// Agent ID cache (survives HMR in dev via global)
const globalCache = globalThis as unknown as {
  __mistralAgents?: { interpreter?: string; extractor?: string };
};
if (!globalCache.__mistralAgents) {
  globalCache.__mistralAgents = {};
}

const INTERPRETER_INSTRUCTION = `You analyze conceptual topology gaps between languages in the context of historical treaties and political discourse.

Given a concept with its neighbors and embedding distances in two languages, explain WHY the distances diverge. Connect to the historical and cultural context of the Treaty of Versailles. Be specific about what the gap reveals about how each language structures this concept differently.

Respond with ONLY a JSON object matching this schema:
{
  "interpretation": "your 2-3 sentence interpretation here"
}

Rules:
- 2-3 sentences maximum
- No hedging, no qualifiers like "it seems" or "perhaps"
- Reference specific distance values when they illustrate the point
- If the concept is a ghost (exists in one language but not the other), explain what its absence reveals about the other language's conceptual landscape
- Write with authority. You are a computational linguist presenting empirical findings.`;

const EXTRACTOR_INSTRUCTION = `You decompose documents and topics into conceptual frames for cross-linguistic topology analysis.

Given a text or topic, extract the core concepts that would reveal structural differences between languages. Focus on concepts where translation is imperfect -- where the target language must choose between multiple framings, compress distinct ideas into one word, or lacks a direct equivalent.

Respond with ONLY a JSON object matching this schema:
{
  "concepts": [
    {
      "name": "concept_id_snake_case",
      "label_en": "English label",
      "label_de": "German label",
      "definition_en": "English definition (one sentence)",
      "definition_de": "German definition (one sentence)",
      "cluster_hint": "one of: core, justice, victory, humiliation, ghost-de, ghost-en",
      "confidence": 0.0 to 1.0
    }
  ]
}

Rules:
- Extract 5-15 concepts per input
- Prioritize concepts with known cross-linguistic divergence
- confidence reflects how likely the concept reveals a real topology gap
- cluster_hint is your best guess at which thematic cluster the concept belongs to
- Use snake_case for name field, no spaces`;

const MODEL = "mistral-large-latest";

export async function getInterpreterAgentId(): Promise<string> {
  if (globalCache.__mistralAgents?.interpreter) {
    return globalCache.__mistralAgents.interpreter;
  }
  const c = getClient();
  const agent = await c.beta.agents.create({
    model: MODEL,
    name: "LACUNA Interpreter",
    instructions: INTERPRETER_INSTRUCTION,
  });
  globalCache.__mistralAgents!.interpreter = agent.id;
  return agent.id;
}

export async function getExtractorAgentId(): Promise<string> {
  if (globalCache.__mistralAgents?.extractor) {
    return globalCache.__mistralAgents.extractor;
  }
  const c = getClient();
  const agent = await c.beta.agents.create({
    model: MODEL,
    name: "LACUNA Extractor",
    instructions: EXTRACTOR_INSTRUCTION,
  });
  globalCache.__mistralAgents!.extractor = agent.id;
  return agent.id;
}

export async function callAgent(
  agentId: string,
  userMessage: string
): Promise<string> {
  const c = getClient();
  const response = await c.agents.complete({
    agentId,
    messages: [{ role: "user", content: userMessage }],
  });
  const choice = response.choices?.[0];
  if (!choice || !choice.message?.content) {
    throw new Error("Empty agent response");
  }
  // content can be string or array of content chunks
  const content = choice.message.content;
  if (typeof content === "string") return content;
  // If it's an array of content chunks, concatenate text parts
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : "text" in c ? c.text : ""))
      .join("");
  }
  return String(content);
}

export { getClient, MODEL };
