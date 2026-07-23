import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  cleanScriptRoleId,
  decodeLegacyEnvelope,
  encodeLegacyEnvelope,
  isLegacyClientCommand,
  legacyClientCommandSchema,
  parseAvatarUpload,
  parseCustomScript,
  parseDynamicInitResponse,
  parseGameState,
} from "../src/index.js";

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL(`../../test-fixtures/${name}`, import.meta.url),
      "utf8",
    ),
  );
}

describe("legacy WebSocket v1 envelopes", () => {
  it("round-trips command-only, parameterized, and feedback envelopes", async () => {
    const fixtures = (await fixture("ws/legacy-envelopes.json")) as unknown[];

    for (const fixture of fixtures) {
      expect(encodeLegacyEnvelope(decodeLegacyEnvelope(fixture))).toEqual(
        fixture,
      );
    }
  });

  it.each([
    null,
    {},
    [],
    [false],
    ["ping", {}, true],
    ["ping", {}, false, "extra"],
  ])("rejects malformed input %#", (input) => {
    expect(() => decodeLegacyEnvelope(input)).toThrow();
  });
});

describe("legacy client command boundary", () => {
  it("accepts supported v1 client commands", () => {
    expect(legacyClientCommandSchema.parse("direct")).toBe("direct");
    expect(isLegacyClientCommand("setTimer")).toBe(true);
  });

  it("rejects unknown commands before server dispatch", () => {
    expect(
      legacyClientCommandSchema.safeParse("runArbitraryCode").success,
    ).toBe(false);
    expect(isLegacyClientCommand("runArbitraryCode")).toBe(false);
  });
});

describe("custom script input", () => {
  it("normalizes IDs while preserving complete custom and official roles", async () => {
    const script = await fixture("scripts/custom-role-complete.json");
    const roles = parseCustomScript(script);

    expect(roles.map((role) => role.id)).toEqual([
      "testseer",
      "investigator",
      "imp",
    ]);
    expect(roles[0]).toMatchObject({
      name: "测试先知",
      ability: "每个夜晚，你会得知一名玩家。",
      team: "townsfolk",
    });
    expect(cleanScriptRoleId("Test_Seer!")).toBe("testseer");
  });

  it("accepts the traveller spelling and canonicalizes it", async () => {
    const script = await fixture("scripts/custom-role-traveller.json");
    expect(parseCustomScript(script)[0]).toMatchObject({ team: "traveler" });
  });

  it("rejects malformed custom roles before they enter the domain", async () => {
    await expect(
      fixture("scripts/invalid-script.json").then(parseCustomScript),
    ).rejects.toThrow();
  });
});

describe("HTTP boundary input", () => {
  it("accepts the dynamic initialization response", () => {
    expect(
      parseDynamicInitResponse({
        payload: { version: "3.3.1", floatingNotice: "维护通知" },
      }),
    ).toEqual({
      payload: { version: "3.3.1", floatingNotice: "维护通知" },
    });
  });

  it("rejects malformed dynamic initialization responses", () => {
    expect(() =>
      parseDynamicInitResponse({ payload: { version: 3 } }),
    ).toThrow();
  });

  it("accepts a complete avatar upload request", () => {
    expect(
      parseAvatarUpload({
        playerId: "player-a",
        uploadContent: "data:image/png;base64,AA==",
      }),
    ).toEqual({
      playerId: "player-a",
      uploadContent: "data:image/png;base64,AA==",
    });
  });

  it.each([
    {},
    { playerId: "invalid id", uploadContent: "data:image/png;base64,AA==" },
    { playerId: "player-a", uploadContent: "" },
  ])("rejects malformed avatar upload input %#", (input) => {
    expect(() => parseAvatarUpload(input)).toThrow();
  });
});

describe("game-state import input", () => {
  it("provides compatible defaults for optional historical fields", () => {
    expect(parseGameState({})).toMatchObject({
      bluffs: [],
      roles: "",
      fabled: [],
      players: [],
    });
  });

  it.each([
    { bluffs: {} },
    { fabled: {} },
    { players: {} },
    { players: [{ role: 1 }] },
  ])("rejects invalid game-state containers %#", (input) => {
    expect(() => parseGameState(input)).toThrow();
  });
});
