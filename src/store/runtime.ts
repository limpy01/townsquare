import initializePersistence from "./persistence";
import initializeSocket from "./socket";

let initialized = false;

/** Starts browser-only persistence and socket effects after Pinia is installed. */
export const initializeRuntime = () => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  initializePersistence();
  initializeSocket();
};
