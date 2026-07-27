// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import DrawModal from "./DrawModal.vue";
import { useDrawStore } from "../../stores/draw";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";

describe("DrawModal", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("skips consecutive traveler seats after confirming a drawn role", async () => {
    const modals = useModalStore();
    const players = usePlayersStore();
    const draw = useDrawStore();
    modals.draw = true;
    players.setPlayers([
      { id: "one", role: { id: "chef", team: "townsfolk" } },
      { id: "two", role: { id: "barista", team: "traveler" } },
      { id: "three", role: { id: "imp", team: "demon" } },
    ]);
    draw.setRoles([{ id: "washerwoman", team: "townsfolk" }]);

    const wrapper = mount(DrawModal, {
      global: {
        stubs: {
          Modal: { template: "<div><slot /></div>" },
          Token: { template: "<span />" },
        },
      },
    });

    await wrapper.find("li").trigger("click");
    await wrapper.find(".button").trigger("click");

    expect(wrapper.text()).toContain("请为3号抽取身份");
  });
});
