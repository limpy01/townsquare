import { describe, expect, it } from "vitest";
import sessionModule from "./session";

describe("session Vuex compatibility module", () => {
  it("normalizes persisted session IDs", () => {
    const state = sessionModule.state();

    sessionModule.mutations.setSessionId(state, "Room ID! 123456789");

    expect(state.sessionId).toBe("roomid1234");
  });

  it("ignores vote changes when no nomination is active", () => {
    const state = sessionModule.state();
    state.votes = [false];

    sessionModule.mutations.vote(state, [0, true]);
    expect(state.votes).toEqual([false]);

    state.nomination = [0, 1];
    sessionModule.mutations.vote(state, [0, true]);
    expect(state.votes).toEqual([true]);
  });
});
