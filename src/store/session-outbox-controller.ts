import type { OutboxMessage } from "../stores/message-outbox";
import {
  dispatchSessionOutboxMessage,
  type SessionOutboxTransport,
} from "./session-outbox-dispatcher";

export type SessionOutboxControllerOptions = {
  intervalMs: number;
  getQueue(): readonly OutboxMessage[];
  transport: SessionOutboxTransport;
  onAcknowledged(message: OutboxMessage): void;
  deleteAt(index: number): void;
};

/** Owns the v1 outbox schedule while the session keeps domain callbacks. */
export class SessionOutboxController {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: SessionOutboxControllerOptions) {}

  flush(): void {
    for (const message of this.options.getQueue()) {
      dispatchSessionOutboxMessage(message, this.options.transport);
    }
  }

  start(): void {
    this.stop();
    this.flush();
    this.timer = setInterval(() => this.flush(), this.options.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  get pendingCount(): number {
    return this.options.getQueue().length;
  }

  acknowledge(id: unknown): boolean {
    if (!Number.isInteger(id)) return false;
    const index = this.options
      .getQueue()
      .findIndex((message) => message.id === id);
    if (index < 0) return false;
    const message = this.options.getQueue()[index];
    if (!message) return false;
    this.options.onAcknowledged(message);
    this.options.deleteAt(index);
    return true;
  }
}
