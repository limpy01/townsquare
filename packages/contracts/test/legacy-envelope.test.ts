import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  cleanScriptRoleId,
  decodeLegacyEnvelope,
  encodeLegacyEnvelope,
  isLegacyClientCommand,
  isLegacyClientPayload,
  legacyClientCommandSchema,
  legacyDirectPayloadSchema,
  legacyRequestPayloadSchema,
  legacySetTalkingPayloadSchema,
  isLegacySessionPayload,
  isLegacySessionCommand,
  legacySessionCommandSchema,
  legacyUploadFilePayloadSchema,
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

  it("validates known scalar and specialized command payloads", () => {
    expect(isLegacyClientPayload("setTimer", 30)).toBe(true);
    expect(isLegacyClientPayload("setTimer", -1)).toBe(false);
    expect(isLegacyClientPayload("direct", { player: ["chat", {}] })).toBe(
      false,
    );
  });

  it("validates the player talking payload", () => {
    expect(
      legacySetTalkingPayloadSchema.parse({ seatNum: 2, isTalking: true }),
    ).toMatchObject({ seatNum: 2, isTalking: true });
    expect(
      legacySetTalkingPayloadSchema.safeParse({
        seatNum: "2",
        isTalking: true,
      }).success,
    ).toBe(false);
  });

  it("validates direct, request, and upload payload envelopes", () => {
    expect(
      legacyDirectPayloadSchema.parse({
        "player-a": [
          "chat",
          {
            message: "hello",
            sendingPlayerId: "host",
            receivingPlayerId: "player-a",
          },
        ],
      }),
    ).toMatchObject({
      "player-a": [
        "chat",
        {
          message: "hello",
          sendingPlayerId: "host",
          receivingPlayerId: "player-a",
        },
      ],
    });
    expect(
      legacyDirectPayloadSchema.safeParse({ "player-a": ["unknown", {}] })
        .success,
    ).toBe(false);
    expect(
      legacyDirectPayloadSchema.safeParse({
        "player-a": ["gs", { gamestate: {} }],
      }).success,
    ).toBe(false);

    expect(
      legacyRequestPayloadSchema.parse({
        deleteMessage: ["player-a", ["direct", 101]],
      }),
    ).toMatchObject({ deleteMessage: ["player-a", ["direct", 101]] });
    expect(
      legacyRequestPayloadSchema.safeParse({ arbitraryRequest: [] }).success,
    ).toBe(false);

    expect(
      legacyUploadFilePayloadSchema.parse({
        uploadAvatar: ["player-a", "data:image/png;base64,AA=="],
      }),
    ).toMatchObject({
      uploadAvatar: ["player-a", "data:image/png;base64,AA=="],
    });
    expect(
      legacyUploadFilePayloadSchema.safeParse({
        uploadAvatar: ["player-a"],
      }).success,
    ).toBe(false);
    expect(
      isLegacyClientPayload("direct", { "player-a": ["unknown", {}] }),
    ).toBe(false);
    expect(isLegacyClientPayload("request", { arbitraryRequest: [] })).toBe(
      false,
    );
    expect(
      isLegacyClientPayload("setTalking", { seatNum: "0", isTalking: true }),
    ).toBe(false);
    expect(
      isLegacyClientPayload("uploadFile", { uploadAvatar: ["player-a"] }),
    ).toBe(false);
  });
});

describe("legacy session command boundary", () => {
  it("accepts commands handled by the browser session dispatcher", () => {
    expect(legacySessionCommandSchema.parse("syncPlayersStatus")).toBe(
      "syncPlayersStatus",
    );
    expect(isLegacySessionCommand("avatarReceived")).toBe(true);
  });

  it("rejects commands with no browser session handler", () => {
    expect(legacySessionCommandSchema.safeParse("setRooms").success).toBe(
      false,
    );
    expect(isLegacySessionCommand("setRooms")).toBe(false);
  });

  it("validates server payloads before browser dispatch", () => {
    expect(
      isLegacySessionPayload("gs", {
        gamestate: [{ id: "player-a" }],
      }),
    ).toBe(true);
    expect(isLegacySessionPayload("gs", { gamestate: {} })).toBe(false);
    expect(isLegacySessionPayload("chat", { message: "missing ids" })).toBe(
      false,
    );
    expect(isLegacySessionPayload("unknown", null)).toBe(false);
    expect(isLegacySessionPayload("pong", null)).toBe(false);
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

  it.each([
    [{ id: "!!!" }],
    [{ id: "custom", name: "Custom", team: "townsfolk" }],
  ])("rejects incomplete normalized custom roles %#", (input) => {
    expect(() => parseCustomScript(input)).toThrow();
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

  it("validates host and join request targets", () => {
    expect(
      legacyRequestPayloadSchema.parse({ checkAllowHost: ["player-a"] }),
    ).toEqual({ checkAllowHost: ["player-a"] });
    expect(
      legacyRequestPayloadSchema.safeParse({ checkAllowJoin: [1] }).success,
    ).toBe(false);
  });
});

describe("game-state import input", () => {
  it("accepts the historical game-state fixture without stripping extensions", async () => {
    const gameState = await fixture("game-state/legacy-v1.json");

    expect(parseGameState(gameState)).toMatchObject({
      edition: { id: "tb" },
      bluffs: ["chef"],
      players: [
        {
          id: 7,
          role: "chef",
          legacyExtension: { seat: 0 },
        },
      ],
    });
  });

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
