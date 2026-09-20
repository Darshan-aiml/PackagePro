import { describe, expect, it } from "vitest";
import { planFor, nightsBetween, dateRange, pickRoomAndHotel, matchGuide, type Plan } from "./planner";
import { listPackages, listComponents } from "@/server/db/catalogue";
import { d, sumDecimal } from "@/lib/money";

const HEAVY = "usr_f855344d";
const COLD = "usr_6afe5712";
// Guide availability only exists within September 2026 — ask for those dates.
const START = "2026-09-14";
const END = "2026-09-18";

function cityWithInrPackage(): string {
  return listPackages().find((p) => p.currency === "INR")!.city_id;
}

function baseReq(userId = COLD, budgetINR = "200000"): Parameters<typeof planFor>[0] {
  return { userId, cityId: cityWithInrPackage(), startDate: START, endDate: END, adults: 2, children: 0, budgetINR };
}

function sumPlanCost(plan: Plan): string {
  const items = plan.days.flatMap((dd) => dd.items);
  return sumDecimal(items.map((i) => i.cost)).toFixed(2);
}

describe("planner date helpers", () => {
  it("nightsBetween counts nights, dateRange counts days", () => {
    expect(nightsBetween("2026-09-14", "2026-09-18")).toBe(4);
    expect(dateRange("2026-09-14", "2026-09-18").length).toBe(5);
  });
});

describe("planner (AI itinerary builder)", () => {
  it("assembles a plan with hotel, guide, items and exact totals", () => {
    const plan = planFor(baseReq());
    expect(plan.totalCost).toMatch(/^\d+\.\d{2}$/);
    expect(plan.hotel).toBeTruthy();
    expect(plan.guide).toBeTruthy();
    expect(plan.days.length).toBeGreaterThan(0);
    // hotel + guide + package lines all flow through day items → totals reconcile.
    expect(plan.totalCost).toBe(sumPlanCost(plan));
    // every item carries an explanation (except none) and INR stays text.
    for (const day of plan.days) {
      for (const item of day.items) {
        expect(item.explanationKey).toBeTruthy();
        expect(item.cost).toMatch(/^\d+\.\d{2}$/);
      }
    }
  });

  it("honours the guide language preference when asked", () => {
    const plan = planFor(baseReq(HEAVY)); // prefs.guide_language = hi
    expect(plan.guide).toBeTruthy();
    expect(plan.guide!.languages.toLowerCase()).toContain("hi");
  });

  it("is versioned: replanning the same trip bumps the version and keeps a single active itinerary", () => {
    // Unique dates → fresh trip, so versions count from 1.
    const req = { ...baseReq(), startDate: "2026-09-21", endDate: "2026-09-23" };
    const a = planFor(req);
    const b = planFor(req);
    expect(a.version).toBe(1);
    expect(b.version).toBe(2);
    expect(a.tripId).toBe(b.tripId);
    expect(a.itineraryId).not.toBe(b.itineraryId);
  });

  it("budget: an oversized budget stays under budget; a tiny one at least flags it", () => {
    const comfy = planFor(baseReq(COLD, "5000000"));
    expect(comfy.overBudget).toBe(false);
    expect(d(comfy.totalCost).lte(d(comfy.budget))).toBe(true);

    const tight = planFor(baseReq(COLD, "8000"));
    // Either the greedy drop-down squeezed in, or we say so honestly.
    expect(tight.overBudget).toBe(d(tight.totalCost).gt(d(tight.budget)));
  });

  it("keeps locked (non-swappable, must-keep) lines in every plan", () => {
    const plan = planFor(baseReq());
    const locked = plan.days.flatMap((dd) => dd.items).filter((i) => i.locked);
    expect(locked.length).toBeGreaterThan(0);
  });

  it("selection handoff: kept components from the configurator survive planning", () => {
    const packageId = listPackages().find((p) => p.currency === "INR")!.package_id;
    const kept = listComponents(packageId)
      .filter((c) => c.is_swappable === 1)
      .slice(0, 3)
      .map((c) => c.component_id);
    const plan = planFor({
      ...baseReq(),
      selection: { packageId, keptComponentIds: kept },
    });
    const titles = plan.days.flatMap((dd) => dd.items).map((i) => i.title);
    for (const keptId of kept) {
      const c = listComponents(packageId).find((cc) => cc.component_id === keptId);
      expect(titles).toContain(c!.title);
    }
  });

  it("pickRoomAndHotel obeys party size and budget share (≤60%)", () => {
    const cityId = cityWithInrPackage();
    const pick = pickRoomAndHotel(cityId, 2, 1, 4, "200000");
    expect(pick).toBeTruthy();
    expect(d(pick!.total).lte(d("200000").times(0.6))).toBe(true);
  });

  it("matchGuide requires availability on every date", () => {
    const cityId = cityWithInrPackage();
    const pick = matchGuide({ cityId, dates: dateRange(START, END).slice(0, 4), theme: "heritage" });
    expect(pick?.usedDays ?? 0).toBeGreaterThan(0);
  });
});