// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useMenuAudioDetection } from "./use-menu-audio-detection";
import { useAudioStore } from "../stores/audio";

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "mediaDevices",
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (mediaDevicesDescriptor)
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("menu audio detection", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("creates the microphone graph, detects speech, and stops its animation frame", async () => {
    const audio = useAudioStore();
    const getByteFrequencyData = vi.fn((data: Uint8Array) => {
      data[1] = 200;
    });
    const analyser = {
      frequencyBinCount: 16,
      fftSize: 0,
      getByteFrequencyData,
    } as unknown as AnalyserNode;
    const source = {
      connect: vi.fn(),
    } as unknown as MediaStreamAudioSourceNode;
    const getUserMedia = vi
      .fn()
      .mockResolvedValue({} as unknown as MediaStream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return {
        sampleRate: 8000,
        createMediaStreamSource: vi.fn(() => source),
        createAnalyser: vi.fn(() => analyser),
      } as unknown as AudioContext;
    });
    vi.stubGlobal("AudioContext", AudioContextMock);
    const requestFrame = vi.fn(() => 42);
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    const setTalking = vi.fn((value: boolean) => audio.setTalking(value));
    const controller = useMenuAudioDetection({
      audio,
      getAudioThreshold: () => 150,
      setTalking,
    });

    controller.startListening("free");
    await Promise.resolve();
    await Promise.resolve();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(source.connect).toHaveBeenCalledWith(analyser);
    expect(getByteFrequencyData).toHaveBeenCalledOnce();
    expect(audio.isTalking).toBe(true);
    expect(audio.listeningFrame).toBe(42);

    controller.stopListening("free");

    expect(cancelFrame).toHaveBeenCalledWith(42);
    expect(audio.listeningFrame).toBeNull();
    expect(setTalking).toHaveBeenLastCalledWith(false);
  });

  it("does not request the microphone for an inactive input mode", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const controller = useMenuAudioDetection({
      audio: useAudioStore(),
      getAudioThreshold: () => 150,
      setTalking: vi.fn(),
    });

    controller.startListening("keyboard");

    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
