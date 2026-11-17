import { describe, expect, it } from "vitest";
import { executeTool, runAgent, buildSystemPrompt } from "./chat";

describe("PackagePro AI Agent Tools & Engine", () => {
  it("builds a rich system prompt with locale and active user context", () => {
    const prompt = buildSystemPrompt("en", "usr_f855344d");
    expect(prompt).toContain("PackagePro's intelligent, tool-using AI travel agent");
    expect(prompt).toContain("Sneha Pillai");
    expect(prompt).toContain("swap_component");
    expect(prompt).toContain("plan_trip");
  });

  it("executes list_packages tool with city and tier filters", async () => {
    const res = await executeTool("list_packages", {
      city: "Jodhpur",
      tier: "standard",
    });
    const parsed = JSON.parse(res.output);
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.packages[0].city).toBe("Jodhpur");
    expect(parsed.packages[0].tier).toBe("standard");
    expect(parsed.packages[0].basePriceINR).toContain("₹");
  });

  it("executes get_package tool and groups swappable alternatives", async () => {
    const res = await executeTool("get_package", { packageId: "pkg_55c9e36a" });
    const parsed = JSON.parse(res.output);
    expect(parsed.name).toContain("Jodhpur Heritage");
    expect(parsed.components.length).toBeGreaterThan(0);
    expect(parsed.swappableGroups).toHaveProperty("poi_e36a");
    expect(parsed.swappableGroups.poi_e36a.current.title).toBe("Hot Springs");
    expect(parsed.swappableGroups.poi_e36a.alternatives[0].title).toBe("Jazz Cellar, Jodhpur");
  });

  it("executes swap_component tool and computes exact decimal repricing", async () => {
    // Demo swap: Hot Springs (pcm_64113615, +385.31) -> Jazz Cellar (pcm_b589c0bc, +551.86)
    // Delta: +166.55. Base: 10921.73 -> New total: 11088.28
    const res = await executeTool("swap_component", {
      packageId: "pkg_55c9e36a",
      originalComponentId: "pcm_64113615",
      newComponentId: "pcm_b589c0bc",
    });
    const parsed = JSON.parse(res.output);
    expect(parsed.success).toBe(true);
    expect(parsed.priceDelta).toBe("166.55");
    expect(parsed.priceDeltaINR).toBe("+₹166.55");
    expect(parsed.newTotal).toBe("11088.28");
    expect(parsed.newTotalINR).toBe("₹11088.28");
    expect(parsed.configuratorUrl).toContain("pkg_55c9e36a");
  });

  it("executes plan_trip tool with budget and itinerary constraints", async () => {
    const res = await executeTool("plan_trip", {
      cityId: "cty_076e8e86",
      startDate: "2026-09-14",
      endDate: "2026-09-16",
      adults: 2,
      budgetINR: "40000",
    });
    const parsed = JSON.parse(res.output);
    expect(parsed.success).toBe(true);
    expect(parsed.city).toBe("Jodhpur");
    expect(parsed.overBudget).toBe(false);
    expect(parsed.days.length).toBe(2);
    expect(parsed.hotel).not.toBeNull();
    expect(parsed.guide).not.toBeNull();
    expect(parsed.plannerUrl).toContain("city=cty_076e8e86");
  });

  it("executes recommend_packages tool reflecting user segment differences", async () => {
    // Diya Novak is cold start
    const coldRes = await executeTool("recommend_packages", { userId: "usr_6afe5712" });
    const coldParsed = JSON.parse(coldRes.output);
    expect(coldParsed.segment).toBe("cold_start");

    // Sneha Pillai is heavy preference
    const heavyRes = await executeTool("recommend_packages", { userId: "usr_f855344d" });
    const heavyParsed = JSON.parse(heavyRes.output);
    expect(heavyParsed.segment).toBe("preference");

    // Recommender picks differ by design
    expect(coldParsed.recommendations[0].packageId).not.toBe(
      heavyParsed.recommendations[0].packageId,
    );
  });

  it("executes compare_packages tool side-by-side", async () => {
    const res = await executeTool("compare_packages", {
      packageIds: ["pkg_55c9e36a", "pkg_2d89ae17"],
    });
    const parsed = JSON.parse(res.output);
    expect(parsed.packages.length).toBe(2);
    expect(parsed.priceDeltaBetweenFirstTwo).toBeDefined();
    expect(parsed.summary).toContain("Comparing");
  });

  it("executes get_city_guide tool for Jodhpur", async () => {
    const res = await executeTool("get_city_guide", { city: "Jodhpur" });
    const parsed = JSON.parse(res.output);
    expect(parsed.name).toBe("Jodhpur");
    expect(parsed.availablePackages.length).toBeGreaterThan(0);
    expect(parsed.hotels.length).toBeGreaterThan(0);
    expect(parsed.guides.length).toBeGreaterThan(0);
  });

  it("executes get_active_user tool for Sneha Pillai", async () => {
    const res = await executeTool("get_active_user", { userId: "usr_f855344d" });
    const parsed = JSON.parse(res.output);
    expect(parsed.name).toBe("Sneha Pillai");
    expect(parsed.demoPersona).toContain("Heavy");
    expect(parsed.languages.length).toBeGreaterThan(0);
  });

  it("executes check_guide_availability tool for valid dates", async () => {
    const res = await executeTool("check_guide_availability", {
      cityId: "cty_076e8e86",
      dates: ["2026-09-14", "2026-09-15"],
    });
    const parsed = JSON.parse(res.output);
    expect(parsed.guides.length).toBeGreaterThan(0);
    expect(parsed.guides[0]).toHaveProperty("allDatesAvailable");
  });

    it(
    "runs agent loop and returns toolSteps and content",
    async () => {
      const res = await runAgent("test-session", [
        {
          role: "user",
          content:
            "In Jodhpur Heritage (package pkg_55c9e36a), please swap component pcm_64113615 for pcm_b589c0bc and calculate the new total.",
        },
      ]);
      expect(res.usedTools).toBe(true);
      expect(res.toolSteps.length).toBeGreaterThan(0);
      const toolNames = res.toolSteps.map((s) => s.name);
      expect(toolNames.some((name) => name === "swap_component" || name === "get_package")).toBe(true);
      expect(res.content.length).toBeGreaterThan(20);
    },
    20000,
  );
});
