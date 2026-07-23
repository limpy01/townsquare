import { pinia } from "../pinia";
import { useGrimoireStore } from "../stores/grimoire";
import { usePlayersStore } from "../stores/players";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";
import { mutationBus } from "./mutation-bus";

/**
 * State shape consumed by legacy persistence and WebSocket effects.
 * Keeping this projection separate lets Pinia callers use those effects without
 * entering the Vuex compatibility store.
 */
export function getLegacyEffectState() {
  const scenario = useScenarioStore(pinia);

  return {
    grimoire: useGrimoireStore(pinia).$state,
    players: usePlayersStore(pinia).$state,
    session: useSessionIdentityStore(pinia).$state,
    edition: scenario.edition,
  };
}

export function emitLegacyMutation(type: string, payload?: unknown) {
  mutationBus.emit({ type, payload }, getLegacyEffectState());
}
