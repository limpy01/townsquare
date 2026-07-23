import Vuex from "vuex";
import persistence from "./persistence";
import socket from "./socket";
import { pinia } from "../pinia";
import { useModalStore } from "../stores/modals";
import { useGrimoireStore } from "../stores/grimoire";
import { useAppMetaStore } from "../stores/app-meta";
import { useScenarioStore } from "../stores/scenario";
import players from "./modules/players";
import session from "./modules/session";
import { apiBase } from "../config";
import { mutationBus } from "./mutation-bus";

type LegacyRootState = any;
type LegacyRootMutation = (
  this: any,
  state: LegacyRootState,
  payload?: any,
) => void;
type LegacyRootAction = (this: any, ...args: any[]) => any;

const set =
  (key: string) =>
  ({ grimoire }: LegacyRootState, val: any) => {
    grimoire[key] = val;
  };

const toggle =
  (key: string) =>
  ({ grimoire }: LegacyRootState, val: any) => {
    if (val === true || val === false) {
      grimoire[key] = val;
    } else {
      grimoire[key] = !grimoire[key];
    }
  };

const scenarioStateKeys = [
  "edition",
  "selectedEditions",
  "roles",
  "otherTravelers",
  "fabled",
  "jinxes",
  "states",
  "teamsNames",
  "firstNight",
  "otherNight",
] as const;

const createLegacyRootState = () => {
  const state: Record<string, unknown> = {
    // Compatibility projection for Options API and WebSocket consumers.
    // Pinia owns this reactive object; remove this alias with Vuex.
    grimoire: useGrimoireStore(pinia).$state,
    // Compatibility projection for Options API components that still use mapState.
    // Pinia owns this reactive object; remove this alias once those consumers move.
    modals: useModalStore(pinia).$state,
  };
  const scenario = useScenarioStore(pinia);
  for (const key of scenarioStateKeys) {
    Object.defineProperty(state, key, {
      enumerable: true,
      get: () => scenario[key],
      set: (value) => {
        scenario[key] = value as never;
      },
    });
  }
  return state;
};

const rootStoreOptions: any = {
  modules: {
    players,
    session,
  },
  state: createLegacyRootState(),
  mutations: {
    setZoom: set("zoom"),
    setBackground: set("background"),
    setLatestVersion(_state, val) {
      useAppMetaStore(pinia).setLatestVersion(val);
    },
    setLastVersion(_state, val) {
      useAppMetaStore(pinia).setLastVersion(val);
    },
    setFloatingNotice(_state, val) {
      useAppMetaStore(pinia).setFloatingNotice(val);
    },
    setAudioThreshold: set("audioThreshold"),
    toggleMuted: toggle("isMuted"),
    toggleMenu: toggle("isMenuOpen"),
    toggleNightOrder: toggle("isNightOrder"),
    toggleStatic: toggle("isStatic"),
    toggleNight: toggle("isNight"),
    toggleGrimoire: toggle("isPublic"),
    toggleImageOptIn: toggle("isImageOptIn"),
    toggleForwardEvilInfo: toggle("isForwardEvilInfo"),
    toggleModal(_state, name) {
      useModalStore(pinia).toggle(name);
    },
    setCustomRoles(_state, roles) {
      useScenarioStore(pinia).setCustomRoles(roles);
    },
    setSelectedEditions(_state, selectedEditions) {
      const scenario = useScenarioStore(pinia);
      scenario.setSelectedEditions(selectedEditions);
      if (scenario.edition.id === "all")
        this.commit("setEdition", scenario.edition);
    },
    setStates(_state, states) {
      useScenarioStore(pinia).setStates(states);
    },
    setTeamsNames(_state, names) {
      useScenarioStore(pinia).setTeamsNames(names);
    },
    setFirstNight(_state, firstNight) {
      useScenarioStore(pinia).setFirstNight(firstNight);
    },
    setOtherNight(_state, otherNight) {
      useScenarioStore(pinia).setOtherNight(otherNight);
    },
    setEdition(state, edition) {
      const fabled = useScenarioStore(pinia).setEdition(edition);
      if (fabled && !state.session.isSpectator)
        this.commit("players/setFabled", { fabled });
    },
  } as Record<string, LegacyRootMutation>,
  actions: {
    async fetchInit() {
      try {
        // const response = await fetch('http://localhost:3000/api/init');
        const response = await fetch(`${apiBase}/dynamic/init`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const message = await response.text();
        const payload = JSON.parse(message).payload;
        if (!!payload && typeof payload === "object") {
          const propertyList = ["version", "floatingNotice"];
          const mutationMapping: Record<string, string> = {
            version: "setLatestVersion",
            floatingNotice: "setFloatingNotice",
          };
          for (const property of propertyList) {
            if (payload[property])
              this.commit(mutationMapping[property], payload[property]);
          }
        }
        const appMeta = useAppMetaStore(pinia);
        if (
          appMeta.version != appMeta.latestVersion ||
          appMeta.latestVersion != appMeta.lastVersion
        )
          useModalStore(pinia).toggle("version");
      } catch (e) {
        return null;
      }
    },
  } as Record<string, LegacyRootAction>,
  plugins: [
    persistence,
    socket,
    (store: {
      subscribe: (subscriber: (mutation: any, state: any) => void) => void;
    }) => {
      store.subscribe((mutation, state) => mutationBus.emit(mutation, state));
    },
  ],
};

export default new Vuex.Store(rootStoreOptions);
