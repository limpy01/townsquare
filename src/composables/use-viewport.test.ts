// @vitest-environment jsdom
import { defineComponent, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useViewport } from "./use-viewport";

const ViewportHost = defineComponent({
  setup() {
    return useViewport();
  },
  template: "<output>{{ width }}x{{ height }}</output>",
});

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

afterEach(() => vi.restoreAllMocks());

describe("useViewport", () => {
  it("tracks resize events and removes its listener on unmount", async () => {
    setViewport(1440, 900);
    const removeListener = vi.spyOn(window, "removeEventListener");
    const wrapper = mount(ViewportHost);

    expect(wrapper.text()).toBe("1440x900");

    setViewport(390, 844);
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(wrapper.text()).toBe("390x844");

    wrapper.unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
