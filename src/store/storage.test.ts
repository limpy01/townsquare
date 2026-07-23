import { describe, expect, it } from "vitest";
import {
  clearTownsquareStorage,
  readStoredArray,
  readStoredJson,
  readStoredRecord,
  townsquareStorageKeys,
} from "./storage";

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

  it("only clears keys owned by Town Square", () => {
    const removed: string[] = [];
    clearTownsquareStorage({ removeItem: (key) => removed.push(key) });

    expect(removed).toEqual(townsquareStorageKeys);
    expect(removed).not.toContain("unrelated-application-key");
  });
});
