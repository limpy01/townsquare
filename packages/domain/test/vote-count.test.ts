import { describe, expect, it } from "vitest";
import {
  countVotes,
  buildScenarioRoleCatalog,
  getEditionRoles,
  getNightOrder,
  getOtherTravelers,
} from "../src/index.js";

describe("countVotes", () => {
  it("counts only affirmative votes without mutating the input", () => {
    const votes = [
      { playerId: "a", voted: true },
      { playerId: "b", voted: false },
      { playerId: "c", voted: true },
    ];

    expect(countVotes(votes)).toBe(2);
    expect(votes).toEqual([
      { playerId: "a", voted: true },
      { playerId: "b", voted: false },
      { playerId: "c", voted: true },
    ]);
  });
});

describe("edition role catalog", () => {
  const roles = [
    { id: "chef", edition: "tb", team: "townsfolk" },
    { id: "imp", edition: "tb", team: "demon" },
    { id: "barista", edition: "bmr", team: "traveler" },
    { id: "gunslinger", edition: "bmr", team: "traveler" },
  ];

  it("selects and sorts an edition without mutating its catalog", () => {
    expect(getEditionRoles(roles, { id: "tb", roles: ["barista"] })).toEqual([
      roles[2],
      roles[0],
      roles[1],
    ]);
    expect(roles.map((role) => role.id)).toEqual([
      "chef",
      "imp",
      "barista",
      "gunslinger",
    ]);
  });

  it("keeps the complete catalog for the all-editions view", () => {
    expect(getEditionRoles(roles, { id: "all", roles: [] })).toHaveLength(4);
  });

  it("finds only travellers absent from the selected edition", () => {
    expect(getOtherTravelers(roles, { id: "tb", roles: ["barista"] })).toEqual([
      roles[3],
    ]);
  });

  it("separates custom roles, fabled roles, and available travellers", () => {
    const catalog = buildScenarioRoleCatalog(
      [
        { id: "custom", edition: "custom", team: "townsfolk" },
        { id: "legacy-traveller", edition: "custom", team: "traveller" },
        { id: "custom-fabled", edition: "custom", team: "fabled" },
      ],
      roles,
      [{ id: "bootlegger", edition: "custom", team: "fabled" }],
    );

    expect([...catalog.roles.values()]).toMatchObject([
      { id: "custom", team: "townsfolk" },
      { id: "legacy-traveller", team: "traveler" },
    ]);
    expect([...catalog.fabled.keys()]).toEqual(["custom-fabled", "bootlegger"]);
    expect([...catalog.otherTravelers.keys()]).toEqual([
      "barista",
      "gunslinger",
    ]);
  });
});

describe("getNightOrder", () => {
  it("uses a custom sequence when every active role is present", () => {
    const first = { id: "first", firstNight: 8, otherNight: 4 };
    const second = { id: "second", firstNight: 4, otherNight: 8 };
    const players = [{ role: first }, { role: second }];

    const order = getNightOrder(
      players,
      [],
      ["second", "first"],
      ["first", "second"],
    );

    expect(order.get(players[0]!)).toEqual({ first: 2, other: 0 });
    expect(order.get(players[1]!)).toEqual({ first: 0, other: 2 });
  });

  it("falls back to numeric order when a custom sequence is incomplete", () => {
    const first = { id: "first", firstNight: 8, otherNight: 4 };
    const second = { id: "second", firstNight: 4, otherNight: 8 };
    const fabled = { id: "fabled", firstNight: 12, otherNight: 12 };
    const players = [{ role: first }, { role: second }];

    const order = getNightOrder(players, [fabled], ["first"], ["first"]);

    expect(order.get(players[0]!)).toEqual({ first: 2, other: 1 });
    expect(order.get(players[1]!)).toEqual({ first: 1, other: 2 });
    expect(order.get(fabled)).toEqual({ first: 3, other: 3 });
  });

  it("keeps entries without an active role at position zero", () => {
    const unassigned = {};
    const inactive = { role: { id: "inactive", firstNight: 0 } };

    const order = getNightOrder(
      [unassigned, inactive],
      [],
      ["unused"],
      ["unused"],
    );

    expect(order.get(unassigned)).toEqual({ first: 0, other: 0 });
    expect(order.get(inactive)).toEqual({ first: 0, other: 0 });
  });

  it("deduplicates matching numeric positions when custom order is unavailable", () => {
    const first = { id: "first", firstNight: 3, otherNight: 2 };
    const second = { id: "second", firstNight: 3, otherNight: 2 };
    const players = [{ role: first }, { role: second }];

    const order = getNightOrder(players, [], [], []);

    expect(order.get(players[0]!)).toEqual({ first: 1, other: 1 });
    expect(order.get(players[1]!)).toEqual({ first: 1, other: 1 });
  });

  it("handles an active custom-order role without an id", () => {
    const anonymous = { role: { firstNight: 1, otherNight: 1 } };

    const order = getNightOrder([anonymous], [], [""], [""]);

    expect(order.get(anonymous)).toEqual({ first: 0, other: 0 });
  });
});
