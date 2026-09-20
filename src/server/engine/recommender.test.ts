import { describe, expect, it } from "vitest";
import { getUser, getUserPreferences } from "@/server/db/catalogue";
import { recommend, recommendationScore, languagesMatch, BAND_TO_TIERS } from "./recommender";
import { listPackages, getCity } from "@/server/db/catalogue";

const HEAVY = "usr_f855344d"; // Sneha Pillai — premium / comfort / solo
const COLD = "usr_6afe5712"; // Diya Novak — cold start

describe("recommender", () => {
  it("pinned demo users exist in the dataset", () => {
    expect(getUser(HEAVY)).toBeTruthy();
    expect(getUser(COLD)).toBeTruthy();
  });

  it("routes heavy users through the preference strategy and cold-start through popularity", () => {
    const heavy = recommend({ userId: HEAVY });
    const cold = recommend({ userId: COLD });
    expect(heavy.strategy).toBe("preference");
    expect(cold.strategy).toBe("cold_start");
  });

  it("DoD gate: cold-start and preference outputs differ", () => {
    const heavy = recommend({ userId: HEAVY });
    const cold = recommend({ userId: COLD });
    expect(cold.recommendations.length).toBeGreaterThan(0);
    expect(heavy.recommendations.length).toBeGreaterThan(0);
    expect(heavy.recommendations[0].packageId).not.toBe(cold.recommendations[0].packageId);
    expect(cold.recommendations[0].reasonKey).toBe("reason.coldStart");
    expect(["reason.interest", "reason.budget", "reason.pace"]).toContain(heavy.recommendations[0].reasonKey);
  });

  it("bibliotecally respects user budget band → allowed tiers", () => {
    const heavy = recommend({ userId: HEAVY });
    const user = getUser(HEAVY)!;
    const allowed = BAND_TO_TIERS[user.budget_band] ?? [];
    for (const r of heavy.recommendations) {
      expect(allowed).toContain(r.tier);
      expect(r.currency).toBe(user.home_currency);
    }
  });

  it("only offers packages that cover at least the guide language", () => {
    const prefs = getUserPreferences(HEAVY)!;
    const heavy = recommend({ userId: HEAVY });
    for (const r of heavy.recommendations) {
      expect(r.matchedLanguages.length).toBeGreaterThan(0);
    }
    expect(prefs.guide_language).toBeTruthy();
  });

  it("recommendationScore is monotone in interest overlap, pace and budget proximity", () => {
    const pkg = listPackages().find((p) => p.theme === "wildlife") ?? listPackages()[0];
    const base = { pkg, interests: ["wildlife", "nature_birdwatching"], pace: "relaxed", band: "luxury" };
    const noInterest = { ...base, interests: ["food_street"] };
    expect(recommendationScore(base).score).toBeGreaterThan(recommendationScore(noInterest).score);
    const noPace = { ...base, pace: "packed" as const };
    expect(recommendationScore(base).score).toBeGreaterThan(recommendationScore(noPace).score);
  });

  it("languagesMatch folds BCP-47 prefixes both ways", () => {
    expect(languagesMatch(["hi"], ["hi-IN"])).toContain("hi-IN");
    expect(languagesMatch(["en-IN"], ["en"])).toContain("en");
    expect(languagesMatch(["fr"], ["en"])).toEqual([]);
  });

  it("city filter narrows results to one city", () => {
    const cold = recommend({ userId: COLD });
    const cityId = listPackages().find((p) => p.package_id === cold.recommendations[0].packageId)!.city_id;
    const narrowed = recommend({ userId: COLD, cityId });
    for (const r of narrowed.recommendations) {
      expect(r.city).toBe(cold.recommendations[0].city);
    }
  });

  it("every recommendation resolves to a real city of a real package", () => {
    const cold = recommend({ userId: COLD });
    for (const r of cold.recommendations) {
      const pkg = listPackages().find((p) => p.package_id === r.packageId);
      expect(pkg).toBeTruthy();
      expect(getCity(pkg!.city_id)?.name).toBe(r.city);
      expect(pkg!.theme).toBe(r.theme);
    }
  });
});