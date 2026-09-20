import { d } from "@/lib/money";
import {
  listPackages,
  getUser,
  getUserPreferences,
  splitList,
  listComponents,
  getCity,
} from "@/server/db/catalogue";
import type { PackageRow, UserRow } from "@/server/db/types";
import { getHotelStatsFromDb } from "./hotelStats";

// Personalized package ranking. Strategy is gated on users.segment:
//  - cold_start → language-filtered *popularity* + an explicit “we know little
//                  about you yet” reason (the honest cold-start path).
//  - heavy/light → hard filters first (language, budget→tier, city), then
//                  interests·pace·price-proximity scoring, tiebreak = more of
//                  your languages covered.
// Scoring lives in pure functions (recommendationScore) so it is testable
// without a database.

export interface Recommendation {
  packageId: string;
  name: string;
  city: string;
  theme: string;
  tier: string;
  basePrice: string;
  currency: string;
  durationDays: number;
  score: number;
  reasonKey: string;
  matchedLanguages: string[];
  fit: { interestMatches: string[]; budgetFit: boolean; paceFit: boolean };
}

export const BAND_TO_TIERS: Record<string, string[]> = {
  shoestring: ["standard"],
  value: ["standard", "deluxe"],
  mid: ["standard", "deluxe"],
  premium: ["deluxe", "premium"],
  luxury: ["premium"],
};

export const BAND_DAILY_INR: Record<string, number> = {
  shoestring: 2500,
  value: 4200,
  mid: 8500,
  premium: 16000,
  luxury: 32000,
};

export function interestToThemes(code: string): string[] {
  if (code.startsWith("wildlife") || code.includes("safari")) return ["wildlife"];
  if (code.startsWith("religious") || code.includes("pilgrim")) return ["pilgrimage"];
  if (code.includes("temple") || code.includes("heritage")) return ["heritage", "pilgrimage"];
  if (code.startsWith("museum") || code.includes("art")) return ["heritage"];
  if (code.startsWith("nature") || code.includes("garden") || code.includes("lake"))
    return ["adventure", "wellness"];
  if (code.includes("wellness") || code.includes("yoga") || code.includes("spa")) return ["wellness"];
  if (code.includes("food") || code.includes("cooking") || code.includes("craft") || code.includes("shopping"))
    return ["food_trail", "heritage"];
  if (code.includes("nightlife") || code.includes("live_music")) return ["honeymoon", "adventure"];
  if (code.includes("beach")) return ["honeymoon", "family"];
  if (code.includes("mountain") || code.includes("trek")) return ["adventure"];
  return [];
}

/** Exact-token or prefix BCP-47 match (en matches en-IN): returns the offered hits. */
export function languagesMatch(preferred: string[], offered: string[]): string[] {
  const out: string[] = [];
  for (const p of preferred) {
    const hit = offered.find((o) => o === p || o.startsWith(`${p}-`) || p.startsWith(`${o}-`));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

export function tierAllowed(pkg: PackageRow, band: string): boolean {
  return (BAND_TO_TIERS[band] ?? ["standard"]).includes(pkg.tier);
}

function paceFits(pkg: PackageRow, pace: string): boolean {
  if (pace === "relaxed") return pkg.duration_days >= 5;
  if (pace === "packed") return pkg.duration_days <= 4;
  return pkg.duration_days >= 3 && pkg.duration_days <= 7;
}

/** Weighted score from preference signals (pure). */
export function recommendationScore(input: {
  pkg: PackageRow;
  interests: string[];
  pace: string;
  band: string;
}): { score: number; interestMatches: string[]; budgetFit: boolean; paceFit: boolean } {
  const { pkg, interests, pace, band } = input;
  const interestMatches = interests.filter((i) => interestToThemes(i).includes(pkg.theme));
  const refDaily = BAND_DAILY_INR[band] ?? 8500;
  const perDay = d(pkg.base_price).div(pkg.duration_days).toNumber();
  const distance = Math.abs(perDay - refDaily) / refDaily;
  const budgetFit = distance <= 0.35;
  const paceFit = paceFits(pkg, pace);

  let score = 0;
  score += Math.min(interestMatches.length, 2) * 40;
  score += Math.max(0, 30 - distance * 30);
  score += paceFit ? 12 : 0;
  score += Math.min(pkg.duration_days, 7);
  return { score, interestMatches, budgetFit, paceFit };
}

export function topReason(f: { interestMatches: string[]; budgetFit: boolean; paceFit: boolean }): string {
  if (f.interestMatches.length > 0) return "reason.interest";
  if (f.budgetFit) return "reason.budget";
  if (f.paceFit) return "reason.pace";
  return "reason.popular";
}

let popularityCache: Map<string, number> | null = null;

/** Popularity = review-weighted guest score of a package's signature hotels. */
export function popularity(packageId: string): number {
  if (!popularityCache) {
    popularityCache = new Map();
    const stats = new Map(getHotelStatsFromDb().map((h) => [h.id, h]));
    for (const pkg of listPackages()) {
      const hotels = listComponents(pkg.package_id).filter((c) => c.entity_type === "hotel" && c.entity_id);
      let acc = 0;
      let sum = 0;
      for (const h of hotels) {
        const s = stats.get(h.entity_id as string);
        if (s) {
          acc += s.score * s.reviewCount;
          sum += s.reviewCount;
        }
      }
      popularityCache.set(pkg.package_id, sum > 0 ? acc / sum : 0);
    }
  }
  return popularityCache.get(packageId) ?? 0;
}

export function recommend(input: {
  userId: string;
  cityId?: string;
  currency?: string;
}): { recommendations: Recommendation[]; strategy: "cold_start" | "preference"; user: UserRow } {
  const user = getUser(input.userId);
  if (!user) throw new Error(`unknown user ${input.userId}`);
  const prefs = getUserPreferences(input.userId);
  const isColdStart = user.segment === "cold_start";
  const currency = input.currency ?? user.home_currency;

  const preferred = prefs ? splitList(prefs.preferred_languages) : [];
  const guideLang = prefs?.guide_language ? [prefs.guide_language] : [];
  const interests = prefs ? splitList(prefs.interests) : [];
  const wantsAnyLanguage = preferred.length === 0 && guideLang.length === 0;

  const rows = listPackages()
    .filter((p) => !input.cityId || p.city_id === input.cityId)
    .map((pkg) => {
      const offered = splitList(pkg.languages_offered);
      const languageNeed = guideLang.length > 0 ? guideLang : preferred;
      const langMatch = languagesMatch(languageNeed, offered);
      const hardOk =
        pkg.currency === currency &&
        (wantsAnyLanguage || langMatch.length > 0) &&
        (isColdStart || !prefs || tierAllowed(pkg, user.budget_band));

      const city = getCity(pkg.city_id);

      let score = 0;
      let interestMatches: string[] = [];
      let budgetFit = false;
      let paceFit = false;

      if (!isColdStart && prefs) {
        const scored = recommendationScore({ pkg, interests, pace: prefs.pace, band: user.budget_band });
        score = scored.score;
        interestMatches = scored.interestMatches;
        budgetFit = scored.budgetFit;
        paceFit = scored.paceFit;
      } else {
        score = popularity(pkg.package_id);
      }

      return {
        packageId: pkg.package_id,
        name: pkg.name,
        city: city?.name ?? "",
        theme: pkg.theme,
        tier: pkg.tier,
        basePrice: pkg.base_price,
        currency: pkg.currency,
        durationDays: pkg.duration_days,
        score,
        reasonKey: isColdStart || !prefs ? "reason.coldStart" : topReason({ interestMatches, budgetFit, paceFit }),
        matchedLanguages: langMatch,
        fit: { interestMatches, budgetFit, paceFit },
        hardOk,
      };
    })
    .filter((r) => r.hardOk)
    .filter((r) => isColdStart || !prefs || r.score > 0);

  rows.sort((a, b) => b.matchedLanguages.length - a.matchedLanguages.length || b.score - a.score);

  return {
    recommendations: rows.slice(0, 8),
    strategy: isColdStart ? "cold_start" : "preference",
    user,
  };
}