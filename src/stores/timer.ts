import { defineStore } from "pinia";
import { CountdownTimer } from "../services/countdown-timer";

let countdown = new CountdownTimer();

export const useTimerStore = defineStore("timer", {
  state: () => ({
    seconds: 480,
  }),
  actions: {
    setTimer(seconds: number) {
      this.seconds = seconds;
    },
    startTimer(seconds?: number) {
      if (seconds) this.seconds = seconds;
      const initialSeconds = this.seconds;
      countdown.start(initialSeconds, (remaining) => {
        this.seconds = remaining;
      });
    },
    stopTimer() {
      countdown.stop();
    },
  },
});
