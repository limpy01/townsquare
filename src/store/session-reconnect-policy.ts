export class SessionReconnectPolicy {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly delayMs: number) {}

  schedule(reconnect: () => void): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      reconnect();
    }, this.delayMs);
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
