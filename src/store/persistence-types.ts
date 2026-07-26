export type PersistenceStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

export type PersistenceStore = {
  commit(type: string, payload?: unknown): void;
  getters?: Record<string, unknown>;
  state: {
    roles?: Map<string, unknown>;
  };
};

export type PersistenceMutation = {
  type: string;
  payload?: unknown;
};

export type PersistenceRuntimeState = {
  grimoire?: {
    isPublic?: boolean;
    isMuted?: boolean;
    isStatic?: boolean;
    isImageOptIn?: boolean;
  };
  edition?: { isOfficial?: boolean };
  players?: {
    bluffs?: unknown[];
    fabled?: unknown[];
    players?: unknown[];
  };
  session?: { isSpectator?: boolean };
};
