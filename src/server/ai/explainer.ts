import "server-only";
import type { Plan } from "@/server/engine/planner";
import { planToTemplate } from "@/lib/planText";

// The "AI" surface. The planner is deterministic (see planner.ts); this layer
// only gives the structured plan a confident voice. Two sources:
//   1. template — 100% derived from plan facts, zero hallucination risk
//   2. gemini   — same facts, rephrased, if a key is configured
// Any error (no key, timeout, malformed reply) falls back to the template.

export interface LlmConfig {
  apiKey?: string;
  model?: string;
  provider?: "gemini";
  timeoutMs?: number;
}

export interface ExplainResult {
  summary: string;
  bullets: string[];
  source: "template" | "gemini";
  model?: string;
}

/** Deterministic template explanation (isomorphic core in lib/planText). */
export function explainPlanTemplate(plan: Plan): ExplainResult {
  const { summary, bullets } = planToTemplate(plan);
  return { summary, bullets, source: "template" };
}

/** Gemini phrasing of the same facts. The prompt lets the model rephrase the
 *  supplied facts only — never invent. Falls back to the template on any failure. */
export async function explainPlan(
  plan: Plan,
  config: LlmConfig = {},
): Promise<ExplainResult> {
  const {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
    timeoutMs = 4000,
  } = config;
  const base = planToTemplate(plan);
  if (!apiKey) return { ...base, source: "template" };

  const system =
    "You write crisp, warm, first-person travel-planning notes. You may ONLY rephrase the facts supplied; " +
    "never add prices, places, or numbers that are not in the input. Keep the total (INR) and every day's " +
    "stops intact. Reply as JSON: {\"summary\": string, \"bullets\": string[]}.";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(base) }] }],
        }),
      },
    );
    if (!res.ok) throw new Error(`gemini ${res.status}`);
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("empty gemini reply");
    const block = text.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
    const parsed = JSON.parse(block) as Partial<ExplainResult>;
    if (typeof parsed.summary !== "string" || parsed.summary.length < 10) throw new Error("malformed summary");
    return {
      summary: parsed.summary,
      bullets:
        Array.isArray(parsed.bullets) && parsed.bullets.length > 0
          ? parsed.bullets.slice(0, 4)
          : base.bullets,
      source: "gemini",
      model,
    };
  } catch {
    return { ...base, source: "template" };
  }
}