export interface LobbyState {
  allowReconnect: boolean;
  isReconnecting: boolean;
  ping: number;
  rooms: string[] | null;
}

const state = (): LobbyState => ({
  ping: 0,
  rooms: null,
  isReconnecting: false,
  allowReconnect: true,
});

const set =
  <Key extends keyof LobbyState>(key: Key) =>
  (currentState: LobbyState, value: LobbyState[Key]) => {
    currentState[key] = value;
  };

const lobby = {
  namespaced: true,
  state,
  getters: {},
  actions: {},
  mutations: {
    setPing: set("ping"),
    setReconnecting: set("isReconnecting"),
    setAllowConnect: set("allowReconnect"),
  },
};

export default lobby;
