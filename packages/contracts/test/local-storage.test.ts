import { describe, expect, it } from "vitest";
import {
  parseTownsquareStorageVersion,
  persistedSessionSchema,
  persistedUseOldOrderSchema,
  townsquareStorageVersion,
} from "../src/local-storage";

describe("browser storage contract", () => {
  it("accepts the historical values that are safe to restore", () => {
    expect(persistedSessionSchema.parse([false, "room-42"])).toEqual([
      false,
      "room-42",
    ]);
    expect(
      persistedUseOldOrderSchema.parse({ pithag: true, professor: false }),
    ).toEqual({ pithag: true, professor: false });
  });

  it("parses missing and malformed migration markers as version zero", () => {
    expect(parseTownsquareStorageVersion(null)).toBe(0);
    expect(parseTownsquareStorageVersion("not-a-version")).toBe(0);
    expect(
      parseTownsquareStorageVersion(String(townsquareStorageVersion)),
    ).toBe(townsquareStorageVersion);
  });
});
