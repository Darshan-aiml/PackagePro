import {
  listPackages,
  getPackage,
  getCity,
  listCities,
  listComponents,
  listSwapAlternatives,
  getCurrency,
  getUser,
  getUserPreferences,
  listGuides,
  guideFreeDates,
  listTransfers,
  splitList,
  listHotels,
} from "@/server/db/catalogue";
import { recommend } from "@/server/engine/recommender";
import { planFor } from "@/server/engine/planner";
import { d, formatDelta } from "@/lib/money";
import { DEMO_USERS, DEFAULT_USER_ID } from "@/lib/demo";

const INR_SPEC = { iso4217: "INR", minor_unit_exponent: 2 };

// ---------------------------------------------------------------------------
// Gemini API types for generateContent
// ---------------------------------------------------------------------------
interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  thoughtSignature?: string;
  functionResponse?: {
    name: string;
    response: unknown;
  };
}

interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ---------------------------------------------------------------------------
// Agent memory — keyed by session id
// ---------------------------------------------------------------------------
const memory = new Map<string, AgentMessage[]>();

export function getMemory(sessionId: string): AgentMessage[] {
  return memory.get(sessionId) ?? [];
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export type ToolResult = {
  toolCallId: string;
  output: string;
};

export interface ToolStep {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  result: ToolResult;
}

// ---------------------------------------------------------------------------
// Tool Declarations — Exposed to Gemini Agent
// ---------------------------------------------------------------------------
const TOOL_DEFS = [
  {
    name: "list_packages",
    description:
      "Search and filter tour packages by destination city, theme (e.g. heritage, adventure, wellness, nature, family), tier (standard, deluxe, premium, luxury), duration, or maximum price in INR.",
    parameters: {
      type: "object" as const,
      properties: {
        theme: {
          type: "string" as const,
          description: "Tour theme (e.g., heritage, adventure, wellness, nature, family).",
        },
        tier: {
          type: "string" as const,
          description: "Package tier (standard, deluxe, premium, luxury).",
        },
        city: {
          type: "string" as const,
          description: "Destination city name or city ID (e.g. Jodhpur, Manali, Gangtok, Munnar, Hampi).",
        },
        maxPriceINR: {
          type: "string" as const,
          description: "Maximum base price in INR (e.g. 30000).",
        },
        minDurationDays: {
          type: "number" as const,
          description: "Minimum tour duration in days.",
        },
        maxDurationDays: {
          type: "number" as const,
          description: "Maximum tour duration in days.",
        },
      },
    },
  },
  {
    name: "get_package",
    description:
      "Get full details of a specific tour package by ID: city, description, theme, tier, difficulty, duration, exact base price, itinerary components (hotels, transfers, activities/POIs, meals, guides), and available swap options.",
    parameters: {
      type: "object" as const,
      properties: {
        packageId: {
          type: "string" as const,
          description: "Unique package ID (e.g. pkg_55c9e36a).",
        },
      },
      required: ["packageId"] as const,
    },
  },
  {
    name: "swap_component",
    description:
      "Simulate swapping a component (hotel, POI activity, transfer, guide, meal) within a tour package and calculate the exact repriced total in INR using deterministic decimal arithmetic. Shows price delta and new total.",
    parameters: {
      type: "object" as const,
      properties: {
        packageId: {
          type: "string" as const,
          description: "Package ID (e.g. pkg_55c9e36a).",
        },
        originalComponentId: {
          type: "string" as const,
          description: "Component ID or title currently in the package to swap out (e.g. pcm_64113615 or 'Hot Springs').",
        },
        newComponentId: {
          type: "string" as const,
          description: "Target alternative component ID or title to swap in (e.g. pcm_b589c0bc or 'Jazz Cellar, Jodhpur').",
        },
      },
      required: ["packageId", "originalComponentId", "newComponentId"] as const,
    },
  },
  {
    name: "plan_trip",
    description:
      "Generate a deterministic day-by-day travel itinerary with exact INR pricing. Evaluates hotels, guides, activities, and budget constraints. Identifies if the trip is within or over budget.",
    parameters: {
      type: "object" as const,
      properties: {
        cityId: {
          type: "string" as const,
          description: "Destination city name or ID (e.g. Jodhpur, Manali, Gangtok).",
        },
        startDate: {
          type: "string" as const,
          description: "Start date in YYYY-MM-DD format (guide availability active in Sep 2026).",
        },
        endDate: {
          type: "string" as const,
          description: "End date in YYYY-MM-DD format.",
        },
        adults: {
          type: "number" as const,
          description: "Number of adults (default 2).",
        },
        children: {
          type: "number" as const,
          description: "Number of children (default 0).",
        },
        budgetINR: {
          type: "string" as const,
          description: "Total budget in INR as a string (e.g. '40000').",
        },
        guideLanguage: {
          type: "string" as const,
          description: "Preferred guide language (e.g. 'hi', 'en-IN', 'ta').",
        },
      },
      required: ["cityId", "startDate", "endDate"] as const,
    },
  },
  {
    name: "recommend_packages",
    description:
      "Get personalised tour package recommendations for a traveller based on their profile segment (cold start popularity for new users, interest-scored for heavy users, budget-banded for light users).",
    parameters: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string" as const,
          description: "Traveller ID or name (e.g. Diya Novak / usr_6afe5712, Sneha Pillai / usr_f855344d, Ananya Das / usr_aa216995).",
        },
      },
    },
  },
  {
    name: "compare_packages",
    description:
      "Compare 2 or 3 tour packages side-by-side: duration, exact base price, tier, theme, destination, and components breakdown.",
    parameters: {
      type: "object" as const,
      properties: {
        packageIds: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Array of 2 or 3 package IDs to compare.",
        },
      },
      required: ["packageIds"] as const,
    },
  },
  {
    name: "get_city_guide",
    description:
      "Get a destination city guide: available tour packages, active hotels & room tiers, local tour guides with spoken languages, and airport/station transfers.",
    parameters: {
      type: "object" as const,
      properties: {
        city: {
          type: "string" as const,
          description: "City name or city ID (e.g. Jodhpur, Manali, Gangtok, Munnar, Hampi).",
        },
      },
      required: ["city"] as const,
    },
  },
  {
    name: "get_active_user",
    description:
      "Get details about a traveller profile: name, persona segment, preferred themes/tiers, languages, currency, and history.",
    parameters: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string" as const,
          description: "User ID or name (Diya Novak, Sneha Pillai, Ananya Das).",
        },
      },
    },
  },
  {
    name: "check_guide_availability",
    description:
      "Check tour guide availability and daily rates for specific dates and language in a destination city.",
    parameters: {
      type: "object" as const,
      properties: {
        cityId: {
          type: "string" as const,
          description: "City ID or name.",
        },
        dates: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "List of dates in YYYY-MM-DD format (e.g. ['2026-09-14', '2026-09-15']).",
        },
        language: {
          type: "string" as const,
          description: "Spoken language code (e.g. 'hi', 'en-IN', 'ta').",
        },
      },
      required: ["cityId", "dates"] as const,
    },
  },
  {
    name: "get_currency",
    description: "Look up currency metadata (ISO 4217 code, decimal exponent, symbol) for formatting.",
    parameters: {
      type: "object" as const,
      properties: {
        iso4217: {
          type: "string" as const,
          description: "Currency code, e.g. INR.",
        },
      },
      required: ["iso4217"] as const,
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers: Entity Resolution
// ---------------------------------------------------------------------------
function resolveCity(query: string) {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  const direct = getCity(query.trim());
  if (direct) return direct;

  const cities = listCities();
  return (
    cities.find((c) => c.city_id.toLowerCase() === q) ||
    cities.find((c) => c.name.toLowerCase() === q) ||
    cities.find((c) => c.name.toLowerCase().includes(q))
  );
}

function resolveUser(query?: string) {
  if (!query) return getUser(DEFAULT_USER_ID);
  const q = query.trim().toLowerCase();

  const direct = getUser(query.trim());
  if (direct) return direct;

  const demoMatch = DEMO_USERS.find(
    (u) =>
      u.id.toLowerCase() === q ||
      u.name.toLowerCase().includes(q) ||
      u.key.toLowerCase() === q,
  );
  if (demoMatch) {
    const u = getUser(demoMatch.id);
    if (u) return u;
  }

  return getUser(DEFAULT_USER_ID);
}

// ---------------------------------------------------------------------------
// Tool Execution Engine
// ---------------------------------------------------------------------------
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const out = (data: unknown) => ({
    toolCallId: crypto.randomUUID(),
    output: JSON.stringify(data, null, 2),
  });

  try {
    switch (name) {
      case "list_packages": {
        const { theme, tier, city, maxPriceINR, minDurationDays, maxDurationDays } =
          args as {
            theme?: string;
            tier?: string;
            city?: string;
            maxPriceINR?: string | number;
            minDurationDays?: number;
            maxDurationDays?: number;
          };

        const cityEntity = city ? resolveCity(city) : undefined;
        let pkgs = listPackages();

        if (theme) {
          pkgs = pkgs.filter(
            (p) => p.theme.toLowerCase() === theme.toLowerCase(),
          );
        }
        if (tier) {
          pkgs = pkgs.filter(
            (p) => p.tier.toLowerCase() === tier.toLowerCase(),
          );
        }
        if (cityEntity) {
          pkgs = pkgs.filter((p) => p.city_id === cityEntity.city_id);
        } else if (city) {
          pkgs = pkgs.filter((p) => {
            const c = getCity(p.city_id);
            return c && c.name.toLowerCase().includes(city.toLowerCase());
          });
        }
        if (maxPriceINR) {
          const max = d(String(maxPriceINR));
          pkgs = pkgs.filter((p) => d(p.base_price).lte(max));
        }
        if (minDurationDays) {
          pkgs = pkgs.filter((p) => p.duration_days >= minDurationDays);
        }
        if (maxDurationDays) {
          pkgs = pkgs.filter((p) => p.duration_days <= maxDurationDays);
        }

        const trimmed = pkgs.slice(0, 12).map((p) => {
          const c = getCity(p.city_id);
          return {
            packageId: p.package_id,
            name: p.name,
            city: c?.name ?? p.city_id,
            theme: p.theme,
            tier: p.tier,
            durationDays: p.duration_days,
            durationNights: p.duration_nights,
            basePrice: p.base_price,
            basePriceINR: `₹${d(p.base_price).toFixed(2)}`,
            currency: p.currency,
            url: `/packages/${p.package_id}`,
          };
        });

        return out({
          count: trimmed.length,
          totalMatching: pkgs.length,
          packages: trimmed,
        });
      }

      case "get_package": {
        const packageId = String(args.packageId ?? "").trim();
        let pkg = getPackage(packageId);

        if (!pkg) {
          const allPkgs = listPackages();
          pkg = allPkgs.find((p) =>
            p.name.toLowerCase().includes(packageId.toLowerCase()),
          );
        }
        if (!pkg) return out({ error: `Package not found: ${packageId}` });

        const city = getCity(pkg.city_id);
        const components = listComponents(pkg.package_id);

        const swappableGroups: Record<
          string,
          {
            current: { componentId: string; title: string; priceDelta: string; type: string };
            alternatives: { componentId: string; title: string; priceDelta: string; type: string }[];
          }
        > = {};

        for (const comp of components) {
          if (comp.swap_group && !swappableGroups[comp.swap_group]) {
            const alts = listSwapAlternatives(pkg.package_id, comp.swap_group).filter(
              (a) => a.component_id !== comp.component_id,
            );
            swappableGroups[comp.swap_group] = {
              current: {
                componentId: comp.component_id,
                title: comp.title,
                priceDelta: comp.price_delta,
                type: comp.component_type,
              },
              alternatives: alts.map((a) => ({
                componentId: a.component_id,
                title: a.title,
                priceDelta: a.price_delta,
                type: a.component_type,
              })),
            };
          }
        }

        return out({
          packageId: pkg.package_id,
          name: pkg.name,
          description: pkg.description,
          city: city?.name ?? pkg.city_id,
          theme: pkg.theme,
          tier: pkg.tier,
          difficulty: pkg.difficulty,
          durationDays: pkg.duration_days,
          durationNights: pkg.duration_nights,
          basePrice: pkg.base_price,
          basePriceINR: `₹${d(pkg.base_price).toFixed(2)}`,
          currency: pkg.currency,
          components: components.map((c) => ({
            componentId: c.component_id,
            title: c.title,
            componentType: c.component_type,
            dayIndex: c.day_index,
            slot: c.slot,
            priceDelta: c.price_delta,
            isOptional: c.is_optional === 1,
            isSwappable: c.is_swappable === 1,
            swapGroup: c.swap_group,
          })),
          swappableGroups,
          url: `/packages/${pkg.package_id}`,
        });
      }

      case "swap_component": {
        const { packageId, originalComponentId, newComponentId } = args as {
          packageId: string;
          originalComponentId: string;
          newComponentId: string;
        };

        const pkg = getPackage(packageId);
        if (!pkg) return out({ error: `Package not found: ${packageId}` });

        const components = listComponents(pkg.package_id);

        const orig =
          components.find((c) => c.component_id === originalComponentId) ||
          components.find((c) =>
            c.title.toLowerCase().includes(originalComponentId.toLowerCase()),
          );

        if (!orig) {
          return out({
            error: `Component to swap out not found: '${originalComponentId}' in package ${pkg.name}`,
          });
        }

        let next =
          components.find((c) => c.component_id === newComponentId) ||
          components.find((c) =>
            c.title.toLowerCase().includes(newComponentId.toLowerCase()),
          );

        if (!next && orig.swap_group) {
          const alts = listSwapAlternatives(pkg.package_id, orig.swap_group);
          next =
            alts.find((c) => c.component_id === newComponentId) ||
            alts.find((c) =>
              c.title.toLowerCase().includes(newComponentId.toLowerCase()),
            );
        }

        if (!next) {
          return out({
            error: `Replacement component '${newComponentId}' not found for swap group ${orig.swap_group}`,
          });
        }

        const delta = d(next.price_delta).minus(d(orig.price_delta));
        const deltaFormatted = formatDelta(delta, INR_SPEC);
        const newTotal = d(pkg.base_price).plus(delta).toFixed(2);

        return out({
          success: true,
          packageId: pkg.package_id,
          packageName: pkg.name,
          basePrice: pkg.base_price,
          basePriceINR: `₹${d(pkg.base_price).toFixed(2)}`,
          originalComponent: {
            componentId: orig.component_id,
            title: orig.title,
            componentType: orig.component_type,
            priceDelta: orig.price_delta,
          },
          newComponent: {
            componentId: next.component_id,
            title: next.title,
            componentType: next.component_type,
            priceDelta: next.price_delta,
          },
          priceDelta: delta.toFixed(2),
          priceDeltaINR: deltaFormatted,
          newTotal: newTotal,
          newTotalINR: `₹${d(newTotal).toFixed(2)}`,
          currency: pkg.currency,
          configuratorUrl: `/packages/${pkg.package_id}`,
          summary: `Swapped '${orig.title}' for '${next.title}'. Price delta: ${deltaFormatted}. Updated package total: ₹${d(newTotal).toFixed(2)}.`,
        });
      }

      case "plan_trip": {
        const {
          cityId,
          startDate,
          endDate,
          adults,
          children,
          budgetINR,
          guideLanguage,
        } = args as {
          cityId: string;
          startDate: string;
          endDate: string;
          adults?: number;
          children?: number;
          budgetINR?: string;
          guideLanguage?: string;
        };

        const city = resolveCity(cityId);
        if (!city) return out({ error: `City not found: ${cityId}` });

        const user = resolveUser((args as { userId?: string }).userId);
        const plan = planFor({
          userId: user?.user_id ?? DEFAULT_USER_ID,
          cityId: city.city_id,
          startDate,
          endDate,
          adults: adults ?? 2,
          children: children ?? 0,
          budgetINR: budgetINR ?? "40000",
          guideLanguage,
        });

        const total = d(plan.totalCost).toFixed(2);
        const hotelCost = plan.hotel
          ? d(plan.hotel.ratePerNight).times(plan.hotel.nights).toFixed(2)
          : "0.00";
        const guideCost = plan.guide
          ? d(plan.guide.dayRate).times(plan.guide.usedDays).toFixed(2)
          : "0.00";

        return out({
          success: true,
          planId: plan.version,
          title: plan.title,
          city: city.name,
          cityId: city.city_id,
          startDate,
          endDate,
          adults: adults ?? 2,
          children: children ?? 0,
          budgetINR: plan.budget,
          totalCost: total,
          totalCostINR: `₹${total}`,
          overBudget: plan.overBudget,
          budgetStatus: plan.overBudget ? "over_budget" : "within_budget",
          hotel: plan.hotel
            ? {
                name: plan.hotel.name,
                room: plan.hotel.room,
                cost: hotelCost,
                costINR: `₹${hotelCost}`,
                nights: plan.hotel.nights,
              }
            : null,
          guide: plan.guide
            ? {
                name: plan.guide.name,
                languages: plan.guide.languages,
                days: plan.guide.usedDays,
                cost: guideCost,
                costINR: `₹${guideCost}`,
              }
            : null,
          days: plan.days.map((day) => ({
            dayIndex: day.index,
            items: day.items.map((i) => ({
              title: i.title,
              itemType: i.itemType,
              cost: i.cost,
              costINR: `₹${d(i.cost).toFixed(2)}`,
              durationMinutes: i.durationMinutes,
            })),
          })),
          warnings: plan.warnings,
          plannerUrl: `/plan?city=${city.city_id}&startDate=${startDate}&endDate=${endDate}&adults=${adults ?? 2}&budget=${budgetINR ?? "40000"}`,
        });
      }

      case "recommend_packages": {
        const user = resolveUser(args.userId as string | undefined);
        const targetUserId = user?.user_id ?? DEFAULT_USER_ID;
        const { recommendations, strategy } = recommend({ userId: targetUserId });

        return out({
          userId: user?.user_id,
          userName: user?.display_name,
          segment: strategy,
          strategyExplanation:
            strategy === "cold_start"
              ? "Popular with new travellers (popularity + currency matching)"
              : strategy === "preference"
                ? "Scored against travel taste profile, past bookings, and favourite themes"
                : "Matched to budget preferences and travel duration",
          recommendations: recommendations.map((r) => ({
            packageId: r.packageId,
            name: r.name,
            city: r.city,
            theme: r.theme,
            tier: r.tier,
            basePrice: r.basePrice,
            basePriceINR: `₹${d(r.basePrice).toFixed(2)}`,
            durationDays: r.durationDays,
            reasonKey: r.reasonKey,
            url: `/packages/${r.packageId}`,
          })),
        });
      }

      case "compare_packages": {
        const packageIds = (args.packageIds as string[]) ?? [];
        if (packageIds.length < 2) {
          return out({ error: "Please provide at least 2 package IDs to compare." });
        }

        const pkgs = packageIds
          .map((id) => {
            const trimmed = id.trim();
            return (
              getPackage(trimmed) ||
              listPackages().find((p) =>
                p.name.toLowerCase().includes(trimmed.toLowerCase()),
              )
            );
          })
          .filter((p): p is NonNullable<typeof p> => !!p);

        if (pkgs.length < 2) {
          return out({ error: "Could not find valid packages to compare." });
        }

        const comparison = pkgs.map((p) => {
          const c = getCity(p.city_id);
          const comps = listComponents(p.package_id);
          return {
            packageId: p.package_id,
            name: p.name,
            city: c?.name ?? p.city_id,
            durationDays: p.duration_days,
            durationNights: p.duration_nights,
            tier: p.tier,
            theme: p.theme,
            difficulty: p.difficulty,
            basePrice: p.base_price,
            basePriceINR: `₹${d(p.base_price).toFixed(2)}`,
            componentsCount: comps.length,
            highlights: comps.slice(0, 4).map((i) => i.title),
            url: `/packages/${p.package_id}`,
          };
        });

        const priceDelta = d(comparison[1].basePrice).minus(d(comparison[0].basePrice));

        return out({
          packages: comparison,
          priceDeltaBetweenFirstTwo: formatDelta(priceDelta, INR_SPEC),
          summary: `Comparing ${comparison[0].name} (₹${d(comparison[0].basePrice).toFixed(2)}) vs ${comparison[1].name} (₹${d(comparison[1].basePrice).toFixed(2)}). Delta: ${formatDelta(priceDelta, INR_SPEC)}.`,
        });
      }

      case "get_city_guide": {
        const city = resolveCity(args.city as string);
        if (!city) return out({ error: `City not found: ${args.city}` });

        const pkgs = listPackages().filter((p) => p.city_id === city.city_id);
        const hotels = listHotels(city.city_id);
        const guides = listGuides(city.city_id);
        const transfers = listTransfers(city.city_id);

        return out({
          cityId: city.city_id,
          name: city.name,
          state: city.state,
          country: city.country_code,
          availablePackages: pkgs.map((p) => ({
            packageId: p.package_id,
            name: p.name,
            tier: p.tier,
            durationDays: p.duration_days,
            basePriceINR: `₹${d(p.base_price).toFixed(2)}`,
            url: `/packages/${p.package_id}`,
          })),
          hotels: hotels.slice(0, 5).map((h) => ({
            name: h.name,
            stars: h.star_rating,
          })),
          guides: guides.map((g) => ({
            name: g.display_name,
            languages: splitList(g.languages),
            dailyRateINR: `₹${d(g.day_rate).toFixed(2)}`,
          })),
          transfersCount: transfers.length,
        });
      }

      case "get_active_user": {
        const user = resolveUser(args.userId as string | undefined);
        if (!user) return out({ error: "User not found" });

        const prefs = getUserPreferences(user.user_id);
        const demoInfo = DEMO_USERS.find((d) => d.id === user.user_id);

        return out({
          userId: user.user_id,
          name: user.display_name,
          email: user.email,
          homeCurrency: user.home_currency,
          demoPersona: demoInfo?.sub ?? "Standard traveller",
          preferredTheme: prefs?.interests,
          languages: splitList(prefs?.preferred_languages),
        });
      }

      case "check_guide_availability": {
        const city = resolveCity(args.cityId as string);
        if (!city) return out({ error: `City not found: ${args.cityId}` });

        const dates = (args.dates as string[]) ?? [];
        const lang = args.language as string | undefined;

        let guides = listGuides(city.city_id);
        if (lang) {
          guides = guides.filter((g) =>
            splitList(g.languages).some((l) => l.toLowerCase() === lang.toLowerCase()),
          );
        }

        const availability = guides.map((g) => {
          const free = guideFreeDates(g.guide_id, dates);
          const allDatesFree = free.every((f) => f.available);
          return {
            guideId: g.guide_id,
            name: g.display_name,
            languages: splitList(g.languages),
            dailyRateINR: `₹${d(g.day_rate).toFixed(2)}`,
            allDatesAvailable: allDatesFree,
            availabilityByDate: free,
          };
        });

        return out({
          city: city.name,
          dates,
          guides: availability,
        });
      }

      case "get_currency": {
        const currency = getCurrency(String(args.iso4217 ?? "INR").toUpperCase());
        if (!currency) return out({ error: `Currency not found: ${args.iso4217}` });
        return out(currency);
      }

      default:
        return out({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    return out({ error: message, tool: name });
  }
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------
export function buildSystemPrompt(locale = "en", userId?: string): string {
  const activeUser = resolveUser(userId);
  return `You are PackagePro's intelligent, tool-using AI travel agent. Your job is to help travellers discover, customize, compare, and plan tour packages across India and the Himalayas using live catalogue data.

Current context:
- User Locale: ${locale} (Reply in this language if user writes in English, Hindi, or Tamil; otherwise default to English).
- Active Traveller: ${activeUser?.display_name ?? "Diya Novak"} (ID: ${activeUser?.user_id ?? DEFAULT_USER_ID}).
- Currency: Indian Rupee (INR). All prices use exact decimal arithmetic. Never round loosely or guess numbers.

Core Capabilities & Tools:
1. 'list_packages' — Filter tours by theme, tier, city, duration, or budget.
2. 'get_package' — Inspect full itinerary components and swappable groups.
3. 'swap_component' — THE SIGNATURE FEATURE. Swap any hotel, POI activity, transfer, guide, or meal to compute the exact repriced total and delta! Always run this tool if the user asks what happens when they swap a component.
4. 'plan_trip' — Run the deterministic planner to generate day-by-day itineraries with exact costs and budget constraints (within/over budget).
5. 'recommend_packages' — Get personalized picks matching the active traveller's profile and taste.
6. 'compare_packages' — Compare 2-3 tour packages side-by-side with exact price deltas.
7. 'get_city_guide' — Inspect destination city attractions, guides, hotels, and transfers.
8. 'get_active_user' — Inspect current traveller profile and preferences.
9. 'check_guide_availability' — Check if local guides speaking specific languages are free on given dates.

Important Behavioral Guidelines:
- PROACTIVELY call tools. Do not hallucinate prices or itineraries.
- When the user asks to customize or swap a stop (e.g. "swap Hot Springs for Jazz Cellar"), call 'swap_component' and explain the exact delta (e.g., "+₹166.55") and new total.
- When recommending, explain why the package suits the traveller (e.g. cold start vs heritage interest).
- Keep replies warm, structured, and concise. Use bolding and markdown lists for readability.
- Always provide a clear next step (e.g., asking if they want to customize another stop, plan dates, or open the itinerary).`;
}

// ---------------------------------------------------------------------------
// Fallback Heuristic Agent (Reliability Layer when offline or without API key)
// ---------------------------------------------------------------------------
async function fallbackAgentLoop(
  messages: AgentMessage[],
  _locale = "en",
  userId?: string,
): Promise<{ content: string; toolSteps: ToolStep[]; usedTools: boolean }> {
  void _locale;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const q = lastUserMsg.toLowerCase();
  const toolSteps: ToolStep[] = [];

  // Intent 1: Component Swap
  if (q.includes("swap") || q.includes("replace") || q.includes("change")) {
    const pkgId = q.includes("jodhpur")
      ? "pkg_55c9e36a"
      : listPackages()[0]?.package_id ?? "pkg_55c9e36a";

    let origId = "pcm_64113615"; // Hot Springs
    let nextId = "pcm_b589c0bc"; // Jazz Cellar

    if (q.includes("jazz") || q.includes("cellar")) {
      origId = "pcm_64113615";
      nextId = "pcm_b589c0bc";
    }

    const swapRes = await executeTool("swap_component", {
      packageId: pkgId,
      originalComponentId: origId,
      newComponentId: nextId,
    });

    toolSteps.push({
      toolCallId: swapRes.toolCallId,
      name: "swap_component",
      args: { packageId: pkgId, originalComponentId: origId, newComponentId: nextId },
      result: swapRes,
    });

    const parsed = JSON.parse(swapRes.output);
    return {
      content: `I've simulated that swap in **${parsed.packageName}**:\n\n• **Replaced:** ${parsed.originalComponent?.title} ➔ **${parsed.newComponent?.title}**\n• **Price Delta:** \`${parsed.priceDeltaINR}\`\n• **Updated Total:** **${parsed.newTotalINR}**\n\nYou can click the button below to view and configure this in the interactive configurator!`,
      toolSteps,
      usedTools: true,
    };
  }

  // Intent 2: Recommendations
  if (q.includes("recommend") || q.includes("suggest") || q.includes("for me") || q.includes("pick")) {
    const recRes = await executeTool("recommend_packages", { userId });
    toolSteps.push({
      toolCallId: recRes.toolCallId,
      name: "recommend_packages",
      args: { userId },
      result: recRes,
    });
    const parsed = JSON.parse(recRes.output);
    const recList = (parsed.recommendations || []).slice(0, 3);
    const bulletText = recList
      .map(
        (r: { name: string; city: string; basePriceINR: string; tier: string }) =>
          `• **${r.name}** (${r.city}) — **${r.basePriceINR}** [${r.tier.toUpperCase()}]`,
      )
      .join("\n");

    return {
      content: `Here are the top personalised recommendations for **${parsed.userName ?? "you"}** (${parsed.strategyExplanation}):\n\n${bulletText}\n\nWould you like to customize one of these or plan specific travel dates?`,
      toolSteps,
      usedTools: true,
    };
  }

  // Intent 3: Plan Trip
  if (q.includes("plan") || q.includes("itinerary") || q.includes("budget") || q.includes("days")) {
    const city = q.includes("jodhpur")
      ? "cty_076e8e86"
      : q.includes("manali")
        ? "cty_9327d518"
        : q.includes("gangtok")
          ? "cty_ccb4fb74"
          : "cty_076e8e86";

    const planRes = await executeTool("plan_trip", {
      cityId: city,
      startDate: "2026-09-14",
      endDate: "2026-09-16",
      adults: 2,
      budgetINR: "40000",
    });

    toolSteps.push({
      toolCallId: planRes.toolCallId,
      name: "plan_trip",
      args: { cityId: city, startDate: "2026-09-14", endDate: "2026-09-16", adults: 2, budgetINR: "40000" },
      result: planRes,
    });

    const parsed = JSON.parse(planRes.output);
    return {
      content: `I have planned a 3-day itinerary for **${parsed.city}** (14–16 Sep 2026):\n\n• **Total Cost:** **${parsed.totalCostINR}** (${parsed.overBudget ? "⚠️ Over budget" : "✅ Within ₹40,000 budget"})\n• **Hotel:** ${parsed.hotel?.name ?? "Selected stay"} (${parsed.hotel?.room ?? "Standard Room"})\n• **Guide:** ${parsed.guide?.name ?? "Local certified guide"} (${parsed.guide?.languages ?? "hi, en"})\n\nClick below to open the complete itinerary in the Planner!`,
      toolSteps,
      usedTools: true,
    };
  }

  // Intent 4: Compare
  if (q.includes("compare") || q.includes("versus") || q.includes("vs")) {
    const pkgs = listPackages().slice(0, 2);
    const compRes = await executeTool("compare_packages", {
      packageIds: [pkgs[0].package_id, pkgs[1].package_id],
    });
    toolSteps.push({
      toolCallId: compRes.toolCallId,
      name: "compare_packages",
      args: { packageIds: [pkgs[0].package_id, pkgs[1].package_id] },
      result: compRes,
    });
    const parsed = JSON.parse(compRes.output);
    return {
      content: `${parsed.summary}\n\nBoth packages feature swappable hotels, guides, and activities. Click below to inspect individual components!`,
      toolSteps,
      usedTools: true,
    };
  }

  // Default: Browse Packages
  const listRes = await executeTool("list_packages", {});
  toolSteps.push({
    toolCallId: listRes.toolCallId,
    name: "list_packages",
    args: {},
    result: listRes,
  });
  const parsed = JSON.parse(listRes.output);
  const sample = (parsed.packages || []).slice(0, 3);
  const items = sample
    .map(
      (p: { name: string; city: string; basePriceINR: string; durationDays: number }) =>
        `• **${p.name}** in ${p.city} (${p.durationDays} days) — **${p.basePriceINR}**`,
    )
    .join("\n");

  return {
    content: `Welcome to PackagePro! Here are a few featured tour packages from our live catalogue:\n\n${items}\n\nAsk me to **recommend tours for you**, **swap stops to reprice**, or **plan an itinerary** with your budget!`,
    toolSteps,
    usedTools: true,
  };
}

// ---------------------------------------------------------------------------
// Run Agent Loop
// ---------------------------------------------------------------------------
export async function runAgent(
  sessionId: string,
  messages: AgentMessage[],
  options: { locale?: string; userId?: string } = {},
): Promise<{ content: string; toolSteps: ToolStep[]; usedTools: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const locale = options.locale ?? "en";
  const userId = options.userId;

  // If no API key configured, use the intelligent heuristic agent fallback
  if (!apiKey) {
    return fallbackAgentLoop(messages, locale, userId);
  }

  const systemInstructionText = buildSystemPrompt(locale, userId);

  // Convert incoming messages to Gemini Content turns
  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  const toolSteps: ToolStep[] = [];
  let answer = "";

  try {
    // Multi-turn tool execution loop (up to 5 turns)
    for (let round = 0; round < 5; round++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstructionText }] },
            contents,
            tools: [{ functionDeclarations: TOOL_DEFS }],
            generationConfig: {
              temperature: 0.4,
              topP: 0.95,
              maxOutputTokens: 2048,
            },
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status}`);
      }

      const json = (await res.json()) as GeminiResponse;
      const candidates = json.candidates ?? [];
      const candidate = candidates[0];
      const parts = candidate?.content?.parts ?? [];

      const funcPart = parts.find((p) => p.functionCall);
      const textPart = parts.find((p) => p.text);

      if (funcPart?.functionCall) {
        const fc = funcPart.functionCall;
        const result = await executeTool(fc.name, fc.args ?? {});

        toolSteps.push({
          toolCallId: result.toolCallId,
          name: fc.name,
          args: fc.args ?? {},
          result,
        });

        // Add the model's tool call turn to contents
        contents.push({
          role: "model",
          parts: [
            {
              functionCall: fc,
              ...(funcPart.thoughtSignature
                ? { thoughtSignature: funcPart.thoughtSignature }
                : {}),
            },
          ],
        });

        // Add function response turn
        let parsedOutput: unknown;
        try {
          parsedOutput = JSON.parse(result.output);
        } catch {
          parsedOutput = { output: result.output };
        }

        contents.push({
          role: "function",
          parts: [
            {
              functionResponse: {
                name: fc.name,
                response: parsedOutput,
              },
            },
          ],
        });
      } else if (textPart?.text) {
        answer = textPart.text;
        break;
      } else {
        break;
      }
    }

    if (!answer) {
      if (toolSteps.length > 0) {
        const lastStep = toolSteps[toolSteps.length - 1];
        answer = `Completed action with tool **${lastStep.name}**. Check the result details below.`;
      } else {
        answer = "I'm here to help you plan trips, discover tour packages, and calculate live re-pricing when swapping stops across India.";
      }
    }

    return {
      content: answer,
      toolSteps,
      usedTools: toolSteps.length > 0,
    };
  } catch (err) {
    console.error("Gemini agent error, falling back to deterministic agent:", err);
    return fallbackAgentLoop(messages, locale, userId);
  }
}
