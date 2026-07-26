// @vitest-environment jsdom
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import Intro from "./Intro.vue";
import { useGrimoireStore } from "../stores/grimoire";

describe("Intro", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function mountIntro() {
    return mount(Intro, {
      global: {
        stubs: { "font-awesome-icon": true },
      },
    });
  }

  it("emits typed host and join commands from the visible entry points", async () => {
    const wrapper = mountIntro();
    const buttons = wrapper.findAll(".button");

    await buttons[1]!.trigger("click");
    await buttons[2]!.trigger("click");

    expect(wrapper.emitted("trigger")).toEqual([
      [["hostSession"]],
      [["joinSession"]],
    ]);
  });

  it("opens and closes the shared menu state", async () => {
    const wrapper = mountIntro();
    const grimoire = useGrimoireStore();

    await wrapper.findAll(".button")[0]!.trigger("click");
    expect(grimoire.isMenuOpen).toBe(true);

    await wrapper.findAll(".button")[0]!.trigger("click");
    expect(grimoire.isMenuOpen).toBe(false);
  });
});
