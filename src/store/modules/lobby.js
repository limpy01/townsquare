const state = () => ({
  ping: 0,
  rooms: null,
  isReconnecting: false,
  allowReconnect: true
});

const getters = {};

const actions = {};

// mutations helper functions
const set = key => (state, val) => {
  state[key] = val;
};

const mutations = {
  setPing: set("ping"),
  setReconnecting: set("isReconnecting"),
  setAllowConnect: set("allowReconnect")
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};
