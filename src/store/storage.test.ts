import { describe, expect, it } from "vitest";
import { readStoredArray, readStoredJson, readStoredRecord } from "./storage";

const storage = (values: Record<string, string>) => ({
  getItem(key: string) {
    return values[key] ?? null;
  },
});

describe("stored JSON readers", () => {
  it("returns the fallback instead of throwing for malformed JSON", () => {
    expect(readStoredJson(storage({ broken: "{" }), "broken", false)).toBe(
      false,
    );
  });

  it("only accepts the expected container shape", () => {
    expect(readStoredArray(storage({ value: "{}" }), "value")).toEqual([]);
    expect(readStoredRecord(storage({ value: "[]" }), "value")).toEqual({});
  });
});
