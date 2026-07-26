import { describe, expect, it } from "vitest";
import {
  clearTownsquareStorage,
  migrateTownsquareStorage,
  readStoredArray,
  readStoredJson,
  readStoredRecord,
  readStoredWithSchema,
  townsquareStorageKeys,
} from "./storage";
import { persistedSessionSchema } from "@townsquare/contracts/local-storage";

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

  it("rejects JSON that does not satisfy its persisted-value schema", () => {
    expect(
      readStoredWithSchema(
        storage({ session: '[true, "room"]' }),
        "session",
        persistedSessionSchema,
      ),
    ).toEqual([true, "room"]);
    expect(
      readStoredWithSchema(
        storage({ session: '["yes", 42]' }),
        "session",
        persistedSessionSchema,
      ),
    ).toBeNull();
  });

  it("only clears keys owned by Town Square", () => {
    const removed: string[] = [];
    clearTownsquareStorage({ removeItem: (key) => removed.push(key) });

    expect(removed).toEqual(townsquareStorageKeys);
    expect(removed).not.toContain("unrelated-application-key");
  });

  it("migrates the legacy avatar key without overwriting a current avatar", () => {
    const values = new Map<string, string>([
      ["playerProfileImage", "legacy.webp"],
      ["playerAvatar", "current.webp"],
    ]);
    const adapter = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    expect(migrateTownsquareStorage(adapter)).toBe(true);
    expect(values.get("playerAvatar")).toBe("current.webp");
    expect(values.has("playerProfileImage")).toBe(false);
    expect(migrateTownsquareStorage(adapter)).toBe(false);
  });

  it("copies the legacy avatar when there is no current value", () => {
    const values = new Map<string, string>([
      ["playerProfileImage", "legacy.webp"],
    ]);
    const adapter = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    expect(migrateTownsquareStorage(adapter)).toBe(true);
    expect(values.get("playerAvatar")).toBe("legacy.webp");
  });

  it("leaves the legacy key available when a migration write fails", () => {
    const values = new Map<string, string>([
      ["playerProfileImage", "legacy.webp"],
    ]);
    const adapter = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: (key: string) => values.delete(key),
    };

    expect(migrateTownsquareStorage(adapter)).toBe(false);
    expect(values.get("playerProfileImage")).toBe("legacy.webp");
  });
});
