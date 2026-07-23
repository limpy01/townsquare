import { describe, expect, it } from "vitest";
import { getNightOrder } from "./night-order";

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
});
