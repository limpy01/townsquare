import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAudioStore } from "./audio";

describe("audio store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("tracks the active speech detection frame", () => {
    const audio = useAudioStore();

    audio.setListeningFrame(42);
    expect(audio.listeningFrame).toBe(42);

    audio.setListeningFrame(null);
    expect(audio.listeningFrame).toBeNull();
  });

  it("tracks local speech independently of the animation frame", () => {
    const audio = useAudioStore();

    audio.setTalking(true);
    expect(audio.isTalking).toBe(true);

    audio.setTalking(false);
    expect(audio.isTalking).toBe(false);
  });
});
