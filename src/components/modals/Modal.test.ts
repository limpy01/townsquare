// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Modal from "./Modal.vue";

const mountModal = (props: Record<string, unknown> = {}) =>
  mount(Modal, {
    props: { name: "roles", visible: true, ...props },
    global: {
      stubs: {
        transition: false,
        "font-awesome-icon": true,
      },
    },
  });

describe("Modal", () => {
  it("emits close from the backdrop and close control", async () => {
    const wrapper = mountModal();

    await wrapper.find(".modal-backdrop").trigger("click");
    await wrapper.findAll(".top-right-button")[1]!.trigger("click");

    expect(wrapper.emitted("close")).toHaveLength(2);
  });

  it("keeps an active text input open when its backdrop is clicked", async () => {
    const wrapper = mountModal({ name: "input", type: "input" });

    await wrapper.find(".modal-backdrop").trigger("click");

    expect(wrapper.emitted("close")).toBeUndefined();
  });

  it("toggles the maximized class without affecting the modal name", async () => {
    const wrapper = mountModal({ name: "reference" });

    await wrapper.findAll(".top-right-button")[0]!.trigger("click");

    expect(wrapper.find(".modal").classes()).toEqual(
      expect.arrayContaining(["reference", "maximized"]),
    );
  });
});
