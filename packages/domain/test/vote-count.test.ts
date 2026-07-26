import { describe, expect, it } from "vitest";
import { countVotes, getNightOrder } from "../src/index.js";

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
});
