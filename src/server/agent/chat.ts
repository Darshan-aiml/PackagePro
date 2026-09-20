import {
  listPackages,
  getPackage,
  getCity,
  listComponents,
  getCurrency,
} from "@/server/db/catalogue";
import { recommend } from "@/server/engine/recommender";
import { planTrip } from "@/server/actions";
import { d } from "@/lib/money";

// ---------------------------------------------------------------------------
// Gemini API types for the generateContent response.
// ---------------------------------------------------------------------------
interface GeminiPart { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } }
interface GeminiContent { role: string; parts: GeminiPart[] }
interface GeminiCandidate { content?: GeminiContent }
interface GeminiResponse { candidates?: GeminiCandidate[] }

// ---------------------------------------------------------------------------
// Agent memory — keyed by a simple session id. For a production harness you'd
// persist this to a database or KV store; here it lives in-process for the
// demo and resets when the server process restarts.
// ---------------------------------------------------------------------------
const memory = new Map<string, AgentMessage[]>();

export function getMemory(sessionId: string): AgentMessage[] {
  return memory.get(sessionId) ?? [];
}

// ---------------------------------------------------------------------------
// Agent tools — each one is a real operation against PackagePro's catalogue.
// The agent decides which to call; the harness serialises the arguments and
// returns JSON back to the model so it can reason about the result.
// ---------------------------------------------------------------------------
export type ToolResult = { toolCallId: string; output: string };
export type ToolCall = { name: string; args: Record<string, unknown> };

const TOOL_DEFS = [
  {
    name: "list_packages",
    description:
      "List all active tour packages with theme, tier, city, duration and price.",
    parameters: {
      type: "object" as const,
      properties: {
        theme: {
          type: "string" as const,
          description: "Filter by theme (e.g. adventure, heritage, wellness).",
        },
        tier: {
          type: "string" as const,
          description: "Filter by tier (standard, deluxe, premium, luxury).",
        },
        city: {
          type: "string" as const,
          description: "Filter by destination city name.",
        },
      },
    },
  },
  {
    name: "get_package",
    description:
      "Get the full details of a package by id: description, theme, tier, " +
      "duration, price, and component swap groups.",
    parameters: {
      type: "object" as const,
      properties: {
        packageId: { type: "string" as const, description: "Package id." },
      },
      required: ["packageId"] as const,
    },
  },
  {
    name: "get_city",
    description: "Look up a destination city and the packages it serves.",
    parameters: {
      type: "object" as const,
      properties: {
        cityId: { type: "string" as const, description: "City id." },
      },
      required: ["cityId"] as const,
    },
  },
  {
    name: "plan_trip",
    description:
      "Generate a deterministic itinerary for a city and dates. Returns " +
      "the plan id, days, hotel, guide, and total cost in INR.",
    parameters: {
      type: "object" as const,
      properties: {
        cityId: { type: "string" as const, description: "Destination city id." },
        startDate: { type: "string" as const, description: "Start date (YYYY-MM-DD)." },
        endDate: { type: "string" as const, description: "End date (YYYY-MM-DD)." },
        adults: { type: "number" as const, description: "Number of adults.", minimum: 1, maximum: 9 },
        budgetINR: { type: "string" as const, description: "Budget in INR as a string." },
      },
      required: ["cityId", "startDate", "endDate"] as const,
    },
  },
  {
    name: "recommend",
    description:
      "Get personalised package recommendations for a user based on their segment and preferences.",
    parameters: {
      type: "object" as const,
      properties: {
        userId: { type: "string" as const, description: "User id." },
      },
      required: ["userId"] as const,
    },
  },
  {
    name: "get_currency",
    description: "Look up a currency by its iso4217 code for formatting prices.",
    parameters: {
      type: "object" as const,
      properties: {
        iso4217: { type: "string" as const, description: "Currency code, e.g. INR." },
      },
      required: ["iso4217"] as const,
    },
  },
];

// ---------------------------------------------------------------------------
// Execute one tool call against the real catalogue. Returns a compact JSON
// string the model can consume.
// ---------------------------------------------------------------------------
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const out = async (data: unknown) => ({
    toolCallId: crypto.randomUUID(),
    output: JSON.stringify(data, null, 2),
  });

  switch (name) {
    case "list_packages": {
      const { theme, tier, city } = args as {
        theme?: string;
        tier?: string;
        city?: string;
      };
      const pkgs = listPackages().filter((p) => {
        if (theme && p.theme !== theme) return false;
        if (tier && p.tier !== tier) return false;
        if (city) {
          const c = getCity(
            listPackages().find((q) => q.package_id === p.package_id)?.city_id ?? "",
          );
          if (!c || !c.name.toLowerCase().includes(city.toLowerCase())) return false;
        }
        return true;
      });
      const trimmed = pkgs.slice(0, 50).map((p) => ({
        packageId: p.package_id,
        name: p.name,
        city: getCity(p.city_id)?.name ?? p.city_id,
        theme: p.theme,
        tier: p.tier,
        durationDays: p.duration_days,
        basePrice: p.base_price,
        currency: p.currency,
      }));
      return out(trimmed);
    }
    case "get_package": {
      const pkg = getPackage(args.packageId as string);
      if (!pkg) return out({ error: "Package not found" });
      const city = getCity(pkg.city_id);
      return out({
        packageId: pkg.package_id,
        name: pkg.name,
        description: pkg.description,
        theme: pkg.theme,
        tier: pkg.tier,
        difficulty: pkg.difficulty,
        durationDays: pkg.duration_days,
        durationNights: pkg.duration_nights,
        basePrice: pkg.base_price,
        currency: pkg.currency,
        city: city?.name ?? pkg.city_id,
        components: listComponents(pkg.package_id).map((c) => ({
          componentId: c.component_id,
          title: c.title,
          componentType: c.component_type,
          dayIndex: c.day_index,
          priceDelta: c.price_delta,
          isOptional: c.is_optional === 1,
          isSwappable: c.is_swappable === 1,
          swapGroup: c.swap_group,
        })),
      });
    }
    case "get_city": {
      const c = getCity(args.cityId as string);
      if (!c) return out({ error: "City not found" });
      return out({
        cityId: c.city_id,
        name: c.name,
        state: c.state,
        country: c.country_code,
        packages: listPackages()
          .filter((p) => p.city_id === c.city_id)
          .map((p) => ({
            packageId: p.package_id,
            name: p.name,
            tier: p.tier,
            basePrice: p.base_price,
          })),
      });
    }
    case "plan_trip": {
      const { cityId, startDate, endDate, adults, budgetINR } =
        args as {
          cityId: string;
          startDate: string;
          endDate: string;
          adults?: number;
          budgetINR?: string;
        };
      const plan = await planTrip({
        userId: "agent-demo",
        cityId,
        startDate,
        endDate,
        adults: adults ?? 2,
        children: 0,
        budgetINR: budgetINR ?? "40000",
      });
      const total = d(plan.totalCost).toFixed(2);
      return out({
        planId: plan.version,
        title: plan.title,
        days: plan.days.map((day) => ({
          index: day.index,
          items: day.items.map((i) => ({
            title: i.title,
            itemType: i.itemType,
            cost: i.cost,
            durationMinutes: i.durationMinutes,
          })),
        })),
        totalCost: total,
        currency: plan.totalCost
          ? "INR"
          : "INR",
        budget: plan.budget,
        overBudget: plan.overBudget,
        hotel: plan.hotel
          ? { name: plan.hotel.name, room: plan.hotel.room }
          : null,
        guide: plan.guide
          ? { name: plan.guide.name, languages: plan.guide.languages }
          : null,
      });
    }
    case "recommend": {
      const userId = args.userId as string;
      const { recommendations, strategy } = recommend({ userId });
      return out({
        strategy,
        recommendations: recommendations.map((r) => ({
          packageId: r.packageId,
          name: r.name,
          city: r.city,
          theme: r.theme,
          tier: r.tier,
          basePrice: r.basePrice,
          durationDays: r.durationDays,
          reason: r.reasonKey,
        })),
      });
    }
    case "get_currency": {
      const currency = getCurrency(args.iso4217 as string);
      if (!currency) return out({ error: "Currency not found" });
      return out(currency);
    }
    default:
      return out({ error: `Unknown tool: ${name}` });
  }
}

// ---------------------------------------------------------------------------
// Run the agent loop: send the conversation to Gemini, handle any tool
// calls it returns, execute them, and feed results back until Gemini
// produces a final text answer.
// ---------------------------------------------------------------------------
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const API_KEY = process.env.GEMINI_API_KEY;

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolStep {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  result: ToolResult;
}

export async function runAgent(
  sessionId: string,
  messages: AgentMessage[],
): Promise<{ content: string; toolSteps: ToolStep[]; usedTools: boolean }> {
  if (!API_KEY) {
    return {
      content:
        "I'm offline right now — no Gemini key is configured. Set GEMINI_API_KEY and try again.",
      toolSteps: [],
      usedTools: false,
    };
  }

  const geminiMessages: GeminiContent[] = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const body = {
    contents: geminiMessages,
    tools: [{ functionDeclarations: TOOL_DEFS }],
    generationConfig: {
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  } as const;

  // Multi-turn tool loop: Gemini may call tools, we execute, feed back.
  const toolSteps: ToolStep[] = [];
  let currentBody = body;
  let answer = "";

  for (let round = 0; round < 4; round++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify(currentBody),
      },
    );

    if (!res.ok) {
      throw new Error(`Gemini ${res.status}`);
    }

    const json = (await res.json()) as GeminiResponse;

    const candidates = json.candidates ?? [];
    const candidate = candidates[0];
    const parts = candidate?.content?.parts ?? [];
    const textPart = parts.find((p) => p.text);
    const funcPart = parts.find((p) => p.functionCall);

    if (funcPart?.functionCall) {
      const fc = funcPart.functionCall;
      const result = await executeTool(fc.name, fc.args);
      toolSteps.push({
        toolCallId: result.toolCallId,
        name: fc.name,
        args: fc.args,
        result,
      });
      const responseParts: GeminiContent[] = [
        ...geminiMessages,
        ...toolSteps.map((ts) => ({
          role: "model",
          parts: [{ functionResponse: { name: ts.name, response: JSON.parse(ts.result.output) } }],
        })),
        { role: "user", parts: [{ text: "Based on the tool results above, answer the user." }] },
      ];
      currentBody = {
        contents: responseParts,
        tools: [{ functionDeclarations: TOOL_DEFS }],
        generationConfig: body.generationConfig,
      };
    } else if (textPart?.text) {
      answer = textPart.text;
      break;
    } else {
      answer = "I'm not sure how to help with that. Try asking about packages, destinations, or planning a trip.";
      break;
    }
  }

  return {
    content: answer,
    toolSteps,
    usedTools: toolSteps.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Build a rich, tool-aware system prompt that gives the agent its context
// and personality, matching PackagePro's warm adventure-luxury brand.
// ---------------------------------------------------------------------------
export function buildSystemPrompt(locale = "en"): string {
  return `You are PackagePro's AI travel agent. Your name is PackagePro. You help travellers discover, compare, and plan tours across India and the Himalayas using real-time catalogue data.

Locale: ${locale}.`;
  return `You are PackagePro's AI travel agent. Your name is PackagePro. You help travellers discover, compare, and plan tours across India and the Himalayas using real-time catalogue data.

Personality: warm, knowledgeable, and concise. You sound like a seasoned travel advisor — never robotic. You match the adventure-luxury brand: confident, inviting, precise with numbers.

Context you always have:
- All prices are in Indian Rupees (INR) and use exact decimal arithmetic — never round or estimate.
- Every tour is deterministic: you can plan a trip, see every component (hotel, guide, transfer, POI), and reprice live as stops change.
- You may recommend packages, detail a package's components and swap groups, look up cities, plan itineraries, and fetch personalised recommendations.

Available tools:
- list_packages — find tours by theme, tier, or city.
- get_package — full details of one tour, including swap groups.
- get_city — destination info and available tours.
- plan_trip — generate a deterministic itinerary for dates, adults, and budget.
- recommend — personalised picks for a traveller.
- get_currency — currency metadata for formatting.

Rules:
- Use tools whenever the user asks for specifics (a destination, a price, a plan, a recommendation). Never guess data — fetch it.
- Always present prices with the exact INR amount from the catalogue.
- When the user seems undecided, offer 3 tailored options using list_packages or recommend, then let them pick one.
- If a tool returns an error or empty result, tell the user plainly and suggest alternatives.
- End every answer with a clear next step (e.g., "Want to plan this trip?" or "Which stop would you swap?").
- Reply in the language the user used if it is en, hi, or ta; otherwise default to English.
- Do not add facts, prices, or places not in the tool results. Stay grounded.`;
}
