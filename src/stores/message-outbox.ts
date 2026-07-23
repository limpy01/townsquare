import { defineStore } from "pinia";

export type OutboxMessage = {
  type: string;
  playerId: string;
  command: string;
  params: unknown;
  id: number;
};

export const useMessageOutboxStore = defineStore("message-outbox", {
  state: () => ({
    queue: [] as OutboxMessage[],
    uniqueFeedback: {} as Record<string, ReturnType<typeof setTimeout>>,
  }),
  actions: {
    add(message: OutboxMessage) {
      this.queue.push(message);
    },
    remove(index: number) {
      if (this.queue.length === 0) return;
      this.queue.splice(index, 1);
    },
    checkUnique(feedback: string) {
      if (this.uniqueFeedback[feedback]) return false;
      this.uniqueFeedback[feedback] = setTimeout(
        () => {
          delete this.uniqueFeedback[feedback];
        },
        1000 * 60 * 3,
      );
      return true;
    },
  },
});
