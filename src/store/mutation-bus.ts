export type StoreMutation = {
  type: string;
  payload?: unknown;
};

export type StoreMutationSubscriber<State = unknown> = (
  mutation: StoreMutation,
  state: State,
) => void;

/**
 * Event channel for persistence and transport side effects emitted by Pinia
 * command boundaries.
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
