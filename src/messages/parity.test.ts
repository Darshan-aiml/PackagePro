import { describe, expect, it } from "vitest";
import en from "./en.json";
import hi from "./hi.json";
import ta from "./ta.json";

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatten(v as Record<string, unknown>, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

const sets = { en: flatten(en).sort(), hi: flatten(hi).sort(), ta: flatten(ta).sort() };

describe("message parity (DoD: en/hi/ta key-for-key identical)", () => {
  it("hi has exactly the same keys as en", () => {
    expect(sets.hi).toEqual(sets.en);
  });
  it("ta has exactly the same keys as en", () => {
    expect(sets.ta).toEqual(sets.en);
  });
});