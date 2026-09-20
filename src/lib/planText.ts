import type { Plan, PlanDay } from "@/server/engine/planner";

// Deterministic, purely-derived summary phrases for a finished Plan.
// Guarded for the UI and the Gemini fallback alike — no numbers invented
// anywhere beyond what the planner already committed.

export function planToTemplate(plan: Plan): { summary: string; bullets: string[] } {
  const ppl = `${plan.adults} adult${plan.adults === 1 ? "" : "s"}${
    plan.children > 0 ? ` + ${plan.children} child${plan.children === 1 ? "" : "ren"}` : ""
  }`;
  const over = plan.overBudget
    ? ` about ${plan.totalCost} INR, just over your ${plan.budget} INR budget`
    : ` ${plan.totalCost} INR, within your ${plan.budget} INR budget`;
  const hotel = plan.hotel
    ? ` You stay ${plan.nights} night${plan.nights === 1 ? "" : "s"} at ${plan.hotel.name} (${plan.hotel.room}).`
    : "";
  const guide = plan.guide
    ? ` ${plan.guide.name} joins you for ${plan.guide.usedDays} day${plan.guide.usedDays === 1 ? "" : "s"} (${plan.guide.languages}).`
    : "";
  const summary =
    `${plan.city} for ${ppl}: ${plan.days.length} day${plan.days.length === 1 ? "" : "s"}, ` +
    `${plan.days.reduce((n, dd) => n + dd.items.length, 0)} hand-picked stops for${over}.${hotel}${guide}`;

  const bullets = plan.days.slice(0, 3).map((day) => bulletForDay(day, plan.days.length));
  return { summary, bullets };
}

function bulletForDay(day: PlanDay, totalDays: number): string {
  const title = day.items.find((i) => i.itemType === "poi" || i.itemType === "entry_ticket")?.title;
  const rest = day.items.length - (title ? 1 : 0);
  const suffix = rest > 0 ? `, plus ${rest} more stop${rest === 1 ? "" : "s"}` : "";
  return title
    ? `Day ${day.index}/${totalDays}: ${title}${suffix}`
    : `Day ${day.index}/${totalDays}: ${day.items.map((i) => i.title).join(" · ")}`;
}