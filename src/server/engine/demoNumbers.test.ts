import { it } from "vitest";
import { planFor } from "./planner";
import { recommend } from "./recommender";
import { listCities } from "@/server/db/catalogue";

it("demodata", () => {
  for (const uid of ["usr_6afe5712", "usr_f855344d", "usr_aa216995"]) {
    const { recommendations, strategy } = recommend({ userId: uid });
    console.log(
      "USER",
      uid,
      strategy,
      "→",
      recommendations[0]?.name,
      recommendations[0]?.reasonKey,
      "₹" + recommendations[0]?.basePrice,
    );
  }
  const jodhpur = listCities().find((c) => c.name === "Jodhpur")!;
  const plan = planFor({
    userId: "usr_f855344d",
    cityId: jodhpur.city_id,
    startDate: "2026-09-14",
    endDate: "2026-09-16",
    adults: 2,
    children: 0,
    budgetINR: "40000",
    guideLanguage: "hi",
  });
  console.log("PLAN", plan.title, "total", plan.totalCost, "budget", plan.budget, "over", plan.overBudget);
  console.log("  hotel:", plan.hotel ? `${plan.hotel.name} ${plan.hotel.room} ×${plan.hotel.nights} @${plan.hotel.ratePerNight}` : "none", "warnings:", plan.warnings);
  console.log("  guide:", plan.guide ? `${plan.guide.name} ${plan.guide.languages} ${plan.guide.usedDays}d @${plan.guide.dayRate}` : "none");
  for (const day of plan.days) {
    console.log("  ", "D" + day.index, day.items.map((i) => `${i.itemType}:${i.title}(${i.cost})`).join("  "));
  }
  const tight = planFor({
    userId: "usr_f855344d",
    cityId: jodhpur.city_id,
    startDate: "2026-09-14",
    endDate: "2026-09-16",
    adults: 2,
    children: 0,
    budgetINR: "6000",
    guideLanguage: "hi",
  });
  console.log("TIGHT total", tight.totalCost, "over", tight.overBudget, "warnings", tight.warnings.map((w) => `${w.key}(${JSON.stringify(w.params)})`).join(" | "));
});