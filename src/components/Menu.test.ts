// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import Menu from "./Menu.vue";
import { gameEvents } from "../store/game-events";
import { useGrimoireStore } from "../stores/grimoire";
import { useVotingStore } from "../stores/voting";

describe("Menu", () => {
  let testPinia: Pinia;

  beforeEach(() => {
    testPinia = createPinia();
    setActivePinia(testPinia);
  });

  it("updates the night state directly and publishes its transport event", () => {
    const received: Array<{ type: string; payload?: unknown }> = [];
    const unsubscribe = gameEvents.subscribe((event) => received.push(event));
    const wrapper = mount(Menu, {
      global: {
        plugins: [testPinia],
        stubs: { "font-awesome-icon": true },
      },
    });

    wrapper.vm.toggleNight();
    unsubscribe();

    expect(useGrimoireStore(testPinia).isNight).toBe(true);
    expect(useVotingStore(testPinia).markedPlayer).toBe(-1);
    expect(received).toContainEqual({ type: "toggleNight" });
    expect(received).toContainEqual({
      type: "session/setMarkedPlayer",
      payload: -1,
    });
  });
});
