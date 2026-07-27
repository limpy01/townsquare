import { pinia } from "../pinia";
import { useGrimoireStore } from "../stores/grimoire";
import { usePlayersStore } from "../stores/players";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";

export type GameEvent = {
  type: string;
  payload?: unknown;
};

export type GameEventSubscriber<State = unknown> = (
  event: GameEvent,
  state: State,
) => void;

/**
 * Explicit domain-effect channel. Store actions mutate Pinia directly; callers
 * then publish only the externally observable game event needed by persistence
 * and the v1 session transport.
 */
export function createGameEventChannel<State = unknown>() {
  const subscribers = new Set<GameEventSubscriber<State>>();

  return {
    publish(event: GameEvent, state: State) {
      subscribers.forEach((subscriber) => subscriber(event, state));
    },
    subscribe(subscriber: GameEventSubscriber<State>) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}

export const gameEvents = createGameEventChannel();

/** State snapshot required by persistence and transport effects. */
export function getGameEffectState() {
  const scenario = useScenarioStore(pinia);
  return {
    grimoire: useGrimoireStore(pinia).$state,
    players: usePlayersStore(pinia).$state,
    session: useSessionIdentityStore(pinia).$state,
    edition: scenario.edition,
  };
}

export function emitGameEvent(type: string, payload?: unknown) {
  gameEvents.publish({ type, payload }, getGameEffectState());
}
