export type LegacyStore = {
  commit(type: string, payload?: any): void;
  state: any;
};

export type LegacyGetter = (state: any) => any;
export type LegacyAction = (context: any, payload?: any) => any;
export type LegacyMutation = (
  this: LegacyStore,
  state: any,
  payload?: any,
) => void;
