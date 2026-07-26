import { describe, expect, it } from "vitest";
import {
  parseEdition,
  parseGameRole,
  parsePlayer,
  roleTeamSchema,
} from "../src/game-data";

describe("shared game data contract", () => {
  it("keeps supported role fields and historical extensions", () => {
    expect(
      parseGameRole({
        id: "custom-role",
        team: "traveller",
        ability: "A legacy spelling remains compatible.",
        legacyExtension: true,
      }),
    ).toMatchObject({
      id: "custom-role",
      team: "traveller",
      legacyExtension: true,
    });
  });

  it("validates editions and historical numeric player IDs", () => {
    expect(parseEdition({ id: "tb", roles: ["chef"] })).toMatchObject({
      id: "tb",
      roles: ["chef"],
    });
    expect(parsePlayer({ id: 42, role: "chef", votes: 2 })).toMatchObject({
      id: 42,
      role: "chef",
      votes: 2,
    });
  });

  it("rejects incomplete identifiers and unsupported classifications", () => {
    expect(() => parseGameRole({ id: "", team: "good" })).toThrow();
    expect(() => roleTeamSchema.parse("good")).toThrow();
    expect(() => parsePlayer({ id: "player", votes: Infinity })).toThrow();
  });
});
