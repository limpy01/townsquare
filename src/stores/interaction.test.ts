import { beforeEach, describe, expect, it } from "vitest";
import { pinia } from "../pinia";
import { useInteractionStore } from "./interaction";

describe("interaction Pinia store", () => {
  const interaction = useInteractionStore(pinia);

  beforeEach(() => interaction.$reset());

  it("tracks chat visibility and input focus independently", () => {
    interaction.setChatOpen(true);
    interaction.setTyping(true);

    expect(interaction.$state).toEqual({ isChatOpen: true, isTyping: true });

    interaction.setTyping(false);
    interaction.setChatOpen(false);

    expect(interaction.$state).toEqual({ isChatOpen: false, isTyping: false });
  });
});
