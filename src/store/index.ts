import Vuex from "vuex";
import persistence from "./persistence";
import socket from "./socket";
import { pinia } from "../pinia";
import { useModalStore } from "../stores/modals";
import { useLegacyOptionsStore } from "../stores/legacy-options";
import { useGrimoireStore } from "../stores/grimoire";
import { useAppMetaStore } from "../stores/app-meta";
import { useScenarioStore } from "../stores/scenario";
import players from "./modules/players";
import session from "./modules/session";
import editionJSON from "../editions.json";
import rolesJSON from "../roles.json";
import fabledJSON from "../fabled.json";
import { apiBase } from "../config";
import { customRoleDefaults, rolesJSONbyId } from "./selectors";
import { mutationBus } from "./mutation-bus";

type LegacyRootState = any;
type LegacyRootMutation = (
  this: any,
  state: LegacyRootState,
  payload?: any,
) => void;
type LegacyRootAction = (this: any, ...args: any[]) => any;

// helper functions
const getRolesByEdition = (edition: any = editionJSON[0]) => {
  if (edition.id === "all") {
    return new Map(
      rolesJSON
        .sort((a, b) => b.team.localeCompare(a.team))
        .map((role) => [role.id, role]),
    );
  }
  return new Map(
    rolesJSON
      .filter((r) => r.edition === edition.id || edition.roles.includes(r.id))
      .sort((a, b) => b.team.localeCompare(a.team))
      .map((role) => [role.id, role]),
  );
};

const getTravelersNotInEdition = (edition: any = editionJSON[0]) => {
  return new Map(
    rolesJSON
      .filter(
        (r) =>
          r.team === "traveler" &&
          r.edition !== edition.id &&
          !edition.roles.includes(r.id),
      )
      .map((role) => [role.id, role]),
  );
};

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

const clean = (id: any) => id.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");

// global data maps
const editionJSONbyId = new Map(
  editionJSON.map((edition) => [edition.id, edition]),
);

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
    /**
     * Store custom roles
     * @param state
     * @param roles Array of role IDs or full role definitions
     */
    setCustomRoles(state, roles) {
      const { useOldRole } = useLegacyOptionsStore(pinia);
      const oldRoles = (
        Object.keys(useOldRole) as Array<keyof typeof useOldRole>
      ).filter((key) => useOldRole[key] === true);
      roles = roles.map((role: any) => {
        return oldRoles.includes(role.id)
          ? { ...role, id: role.id + "old1" }
          : role; // use role if not ticked, add old1 if ticked
      });
      const processedRoles = roles
        // replace numerical role object keys with matching key names
        .map((role: any) => {
          if (role[0]) {
            const customKeys: any = Object.keys(customRoleDefaults);
            const mappedRole: Record<string, any> = {};
            for (let prop in role) {
              if (customKeys[prop]) {
                mappedRole[customKeys[prop]] = role[prop];
              }
            }
            return mappedRole;
          } else {
            return role;
          }
        })
        // clean up role.id
        .map((role: any) => {
          role.id = clean(role.id);
          return role;
        })
        // map existing roles to base definition or pre-populate custom roles to ensure all properties
        .map(
          (role: any) =>
            rolesJSONbyId.get(role.id) ||
            state.roles.get(role.id) ||
            Object.assign({}, customRoleDefaults, role),
        )
        // default empty icons and placeholders, clean up firstNight / otherNight
        .map((role: any) => {
          if (rolesJSONbyId.get(role.id)) return role;
          role.imageAlt = // map team to generic icon
            (
              {
                townsfolk: "good",
                outsider: "outsider",
                minion: "minion",
                demon: "evil",
                fabled: /^bootlegger\d+$/.test(role.id)
                  ? "bootlegger"
                  : "fabled", // 直接使用私货商人图标
                loric: /^bootlegger\d+$/.test(role.id) ? "bootlegger" : "loric",
              } as Record<string, string>
            )[role.team] || "custom";
          role.firstNight = Math.abs(role.firstNight);
          role.otherNight = Math.abs(role.otherNight);
          return role;
        })
        // filter out roles that don't match an existing role and also don't have name/ability/team
        .filter((role: any) => role.name && role.ability && role.team)
        // sort by team
        .sort((a: any, b: any) => b.team.localeCompare(a.team));
      // convert to Map without Fabled
      state.roles = new Map(
        processedRoles
          .filter(
            (role: any) => role.team !== "fabled" && role.team !== "loric",
          )
          .map((role: any) => {
            if (role.team === "traveller") role.team = "traveler";
            return role;
          })
          .map((role: any) => [role.id, role]),
      );
      // update Fabled to include custom Fabled from this script
      state.fabled = new Map([
        ...processedRoles
          .filter((r: any) => r.team === "fabled" || r.team === "loric")
          .map((r: any) => [r.id, r]),
        ...fabledJSON.map((role) => [role.id, role]),
      ]);
      // update extraTravelers map to only show travelers not in this script
      state.otherTravelers = new Map(
        rolesJSON
          .filter(
            (r) =>
              r.team === "traveler" && !roles.some((i: any) => i.id === r.id),
          )
          .map((role) => [role.id, role]),
      );
    },
    setSelectedEditions(state, selectedEditions) {
      state.selectedEditions = { ...selectedEditions };
      if (state.edition.id === "all") this.commit("setEdition", state.edition);
    },
    setStates(state, states) {
      state.states = states;
    },
    setTeamsNames(state, names) {
      state.teamsNames = names;
    },
    setFirstNight(state, firstNight) {
      state.firstNight = firstNight;
      this.commit("players/setFirstNight", firstNight);
    },
    setOtherNight(state, otherNight) {
      state.otherNight = otherNight;
      this.commit("players/setOtherNight", otherNight);
    },
    setEdition(state, edition) {
      if (editionJSONbyId.has(edition.id)) {
        state.edition = editionJSONbyId.get(edition.id);
        state.roles = getRolesByEdition(state.edition);
        if (state.edition.id === "all") {
          //只加载勾选了的剧本
          state.roles = new Map(
            Array.from(state.roles.entries() as any[]).filter((role) => {
              const value = role[1]; //value of the role
              return state.selectedEditions[value.edition];
            }),
          );
        }
        state.otherTravelers = getTravelersNotInEdition(state.edition);
        const fabled = Array.from(state.fabled.values() as any[]).filter(
          (role) => {
            return role.edition === edition.id;
          },
        );
        if (!state.session.isSpectator)
          this.commit("players/setFabled", { fabled });
      } else {
        state.edition = edition;
      }
      // 为官方角色增加原顺序选项
      if (state.roles.get("professor")) {
        state.roles.get("professor").otherNight = useLegacyOptionsStore(pinia)
          .useOldOrder.professor
          ? 79
          : 96;
      }
      if (state.roles.get("pithag")) {
        state.roles.get("pithag").otherNight = useLegacyOptionsStore(pinia)
          .useOldOrder.pithag
          ? 37
          : 16;
      }
      state.modals.edition = false;
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
