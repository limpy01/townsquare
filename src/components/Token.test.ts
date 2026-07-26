// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import Token from "./Token.vue";

describe("Token", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("renders a role with optional metadata omitted", () => {
    const wrapper = mount(Token, { props: { role: {} } });

    expect(wrapper.classes()).toContain("token");
    expect(wrapper.find(".icon").exists()).toBe(false);
  });

  it("renders reminder leaves and emits its explicit role event", async () => {
    const wrapper = mount(Token, {
      props: {
        role: {
          id: "chef",
          name: "Chef",
          reminders: ["one"],
          remindersGlobal: ["two"],
        },
      },
    });

    await wrapper.trigger("click");

    expect(wrapper.find(".leaf-top2").exists()).toBe(true);
    expect(wrapper.emitted("set-role")).toHaveLength(1);
  });
});
