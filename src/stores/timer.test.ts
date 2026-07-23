import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTimerStore } from "./timer";

describe("timer store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  afterEach(() => vi.useRealTimers());

  it("counts down elapsed time and stops at zero", () => {
    const timer = useTimerStore();

    timer.startTimer(2);
    vi.advanceTimersByTime(1000);
    expect(timer.seconds).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(timer.seconds).toBe(0);

    vi.advanceTimersByTime(5000);
    expect(timer.seconds).toBe(0);
  });

  it("retains the current duration when started without an argument", () => {
    const timer = useTimerStore();
    timer.setTimer(5);

    timer.startTimer();
    vi.advanceTimersByTime(1000);

    expect(timer.seconds).toBe(4);
  });
});
