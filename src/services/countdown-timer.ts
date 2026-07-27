export type CountdownUpdate = (seconds: number) => void;

export class CountdownTimer {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastUpdateTime: number | null = null;

  start(initialSeconds: number, update: CountdownUpdate) {
    this.stop();
    this.lastUpdateTime = Date.now();
    update(initialSeconds);
    this.interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - (this.lastUpdateTime ?? now)) / 1000;
      if (elapsedSeconds <= 0) return;

      const remaining = Math.max(0, initialSeconds - elapsedSeconds);
      update(remaining);
      if (remaining === 0) this.stop();
    }, 1000);
  }

  stop() {
    if (this.interval !== null) clearInterval(this.interval);
    this.interval = null;
    this.lastUpdateTime = null;
  }
}
