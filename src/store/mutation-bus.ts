export type StoreMutation = {
  type: string;
  payload?: unknown;
};

export type StoreMutationSubscriber<State = unknown> = (
  mutation: StoreMutation,
  state: State,
) => void;

/**
 * Compatibility event channel for persistence and transport side effects.
 * Vuex feeds this channel today; Pinia actions can feed the same channel while
 * the legacy facade is removed incrementally.
 */
export function createMutationBus<State = unknown>() {
  const subscribers = new Set<StoreMutationSubscriber<State>>();

  return {
    emit(mutation: StoreMutation, state: State) {
      subscribers.forEach((subscriber) => subscriber(mutation, state));
    },
    subscribe(subscriber: StoreMutationSubscriber<State>) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}

export const mutationBus = createMutationBus();
