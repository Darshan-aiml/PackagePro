import { describe, expect, it } from "vitest";
import {
  amountEquals,
  amountGt,
  d,
  formatDelta,
  formatMoney,
  selectionTotal,
  sumDecimal,
} from "./money";

describe("money layer (rule R3: no floats near priced arithmetic)", () => {
  it("sums textual amounts exactly", () => {
    expect(sumDecimal(["0.10", "0.20"]).toFixed(2)).toBe("0.30");
    expect(sumDecimal(["12345.67", "-500.00", "350.50"]).toFixed(2)).toBe("12196.17");
  });

  it("selectionTotal = base plus kept deltas", () => {
    expect(selectionTotal("10000.00", ["-250.00", "+340.50"])).toBe("10090.50");
    expect(selectionTotal("10000.00", [])).toBe("10000.00");
  });

  it("keeps two decimal places even for integer inputs", () => {
    expect(selectionTotal("10000", ["5"])).toBe("10005.00");
  });

  it("formats with the dataset minor-unit exponent", () => {
    const inr = { iso4217: "INR", minor_unit_exponent: 2 };
    expect(formatMoney("120.6", inr, "en-IN")).toBe("₹120.60");
    const jpy = { iso4217: "JPY", minor_unit_exponent: 0 };
    expect(formatMoney("120.9", jpy, "en-IN")).toBe("JP¥121"); // scale→round avoids drift
  });

  it("renders signed deltas", () => {
    const inr = { iso4217: "INR", minor_unit_exponent: 2 };
    expect(formatDelta("-50.00", inr)).toBe("−₹50.00");
    expect(formatDelta("50.00", inr)).toBe("+₹50.00");
  });

  it("compares without crossing into float", () => {
    expect(amountEquals("1.10", "1.10")).toBe(true);
    expect(amountEquals("0.10", "0.1")).toBe(true);
    expect(amountGt("2.00", "1.99")).toBe(true);
    expect(d("0.1").plus(0.2).toFixed(2)).toBe("0.30");
  });
});