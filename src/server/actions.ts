"use server";

import { planFor, type Plan, type PlanRequest } from "@/server/engine/planner";
import { explainPlan, type ExplainResult } from "@/server/ai/explainer";
import { planToTemplate } from "@/lib/planText";
import { splitList, getCity, listPackages } from "@/server/db/catalogue";

export async function planTrip(input: PlanRequest): Promise<Plan> {
  return planFor(input);
}

/** Gemini-phrased summary of a finished plan; falls back to the template. */
export async function planSummary(plan: Plan): Promise<ExplainResult> {
  return explainPlan(plan);
}

export async function planTemplateSummary(plan: Plan): Promise<ExplainResult> {
  return { ...planToTemplate(plan), source: "template" };
}

/** City options the planner can actually serve (has an INR package). */
export async function plannerCities(): Promise<{ cityId: string; name: string }[]> {
  const ids = new Set(listPackages().filter((p) => p.currency === "INR").map((p) => p.city_id));
  return [...ids]
    .map((id) => getCity(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ cityId: c.city_id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** BCP-47 codes actually spoken by guides in a city (for the language select). */
export async function guideLanguages(cityId: string): Promise<string[]> {
  const { listGuides } = await import("@/server/db/catalogue");
  const langs = new Set<string>();
  for (const g of listGuides(cityId)) {
    for (const l of splitList(g.languages)) langs.add(l);
  }
  return [...langs].sort();
}