import initializePersistence from "./persistence";
import initializeSocket from "./socket";
import { gameRuntime } from "./legacy-commands";

let initialized = false;

/** Starts browser-only persistence and socket effects after Pinia is installed. */
export const initializeRuntime = () => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  initializePersistence();
  initializeSocket(gameRuntime);
};
