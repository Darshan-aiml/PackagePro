import { describe, expect, it } from "vitest";
import { createPriceEngine, computeSelectionTotal, describeSwap } from "./price";
import { listPackages, getCurrency } from "@/server/db/catalogue";
import { d } from "@/lib/money";

function fixturePackage() {
  // First INR package that actually has a swappable group with alternatives.
  for (const pkg of listPackages().filter((p) => p.currency === "INR")) {
    const engine = createPriceEngine();
    const line = engine.listLines(pkg.package_id).find((l) => l.isSwappable && l.swapGroup);
    if (line && engine.alternatives(line).length > 0) return { pkg, line: engine.listLines(pkg.package_id), engine };
  }
  throw new Error("no fixture package with swappable alternatives found");
}

describe("price engine (swap & live reprice)", () => {
  it("exposes base, currency and lines per package", () => {
    const engine = createPriceEngine();
    const pkg = listPackages().find((p) => p.currency === "INR")!;
    expect(engine.getBase(pkg.package_id)).toBe(pkg.base_price);
    expect(engine.getCurrency(pkg.package_id)).toBe(pkg.currency);
    const lines = engine.listLines(pkg.package_id);
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.some((l) => l.componentType === "hotel")).toBe(true);
  });

  it("recompute total = base + kept deltas, exactly", () => {
    const { pkg, line } = fixturePackage();
    const engine = createPriceEngine();
    const base = engine.getBase(pkg.package_id);
    const kept = line.filter((l) => !l.isOptional);
    expect(engine.selectionTotal(base, kept)).toBe(
      computeSelectionTotal(base, kept.map((l) => l.priceDelta)),
    );
    // Sanity: it is a real 2-dp amount, not a float carry.
    const total = engine.selectionTotal(base, kept);
    expect(total).toMatch(/^\d+\.\d{2}$/);
  });

  it("swapping a line moves the total by the delta difference", () => {
    const { pkg, line } = fixturePackage();
    const engine = createPriceEngine();
    const swappable = line.find((l) => l.isSwappable && l.swapGroup)!;
    const alt = engine.alternatives(swappable)[0];
    const base = engine.getBase(pkg.package_id);
    const kept = line.filter((l) => l.componentId !== swappable.componentId && !l.isOptional);
    const before = d(engine.selectionTotal(base, kept));
    const after = engine.selectionTotal(base, [...kept, alt]);
    const expected = d(base)
      .plus(kept.reduce((a, l) => a.plus(d(l.priceDelta)), d(0)))
      .plus(d(alt.priceDelta))
      .toFixed(2);
    expect(after).toBe(expected);
    expect(d(after).eq(before)).toBe(false);
  });

  it("alternatives are package-local and never the line itself", () => {
    const { pkg, line } = fixturePackage();
    const engine = createPriceEngine();
    const swappable = line.find(
      (l) => l.isSwappable && l.swapGroup && engine.alternatives(l).length > 0,
    )!;
    const alts = engine.alternatives(swappable);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => a.packageId === swappable.packageId && a.swapGroup === swappable.swapGroup)).toBe(true);
    expect(alts.every((a) => a.componentId !== swappable.componentId)).toBe(true);
    expect(pkg.currency).toBe(swappable.currency);
  });

  it("describeSwap reports a signed delta for the UI toast", () => {
    const { pkg, line } = fixturePackage();
    const engine = createPriceEngine();
    const swappable = line.find((l) => l.isSwappable && l.swapGroup)!;
    const alt = engine.alternatives(swappable)[0];
    const currency = getCurrency(pkg.currency)!;
    const { delta, label } = describeSwap(swappable, alt, currency);
    expect(delta).toMatch(/^[+−]/);
    expect(label).toContain("→");
  });
});