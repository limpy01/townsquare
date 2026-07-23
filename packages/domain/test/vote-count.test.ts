import { describe, expect, it } from "vitest";
import { countVotes } from "../src/index.js";

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
