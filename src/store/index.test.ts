import { describe, expect, it, vi } from "vitest";
import { pinia } from "../pinia";
import { useModalStore } from "../stores/modals";

vi.mock("./persistence", () => ({ default: () => undefined }));
vi.mock("./socket", () => ({ default: () => undefined }));

import store from "./index";

describe("root Vuex compatibility store", () => {
  it("initializes the default edition role map", () => {
    store.commit("setEdition", { id: "tb" });

    expect(store.state.edition.id).toBe("tb");
    expect(store.state.roles).toBeInstanceOf(Map);
    expect(store.state.roles.get("washerwoman").id).toBe("washerwoman");
  });

  it("projects the Pinia modal state for legacy consumers", () => {
    expect(store.state.modals).toBe(useModalStore(pinia).$state);
  });
});
