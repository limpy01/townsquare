import Vuex from "vuex";
import persistence from "./persistence";
import socket from "./socket";
import { pinia } from "../pinia";
import { useModalStore } from "../stores/modals";
import players from "./modules/players";
import session from "./modules/session";
import editionJSON from "../editions.json";
import rolesJSON from "../roles.json";
import fabledJSON from "../fabled.json";
import jinxesJSON from "../hatred.json";
import { apiBase } from "../config";

type LegacyRootState = any;
type LegacyRootMutation = (
  this: any,
  state: LegacyRootState,
  payload?: any,
) => void;
type LegacyRootGetter = (state: LegacyRootState) => any;
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
const rolesJSONbyId = new Map(rolesJSON.map((role) => [role.id, role]));
const fabled = new Map(fabledJSON.map((role) => [role.id, role]));

// jinxes
let jinxes = {};
try {
  // Note: can't fetch live list due to lack of CORS headers
  // fetch("https://bloodontheclocktower.com/script/data/hatred.json")
  //   .then(res => res.json())
  //   .then(jinxesJSON => {
  jinxes = new Map(
    jinxesJSON.map(({ id, hatred }) => [
      clean(id),
      new Map(hatred.map(({ id, reason }) => [clean(id), reason])),
    ]),
  );
  // });
} catch (e) {
  console.error("couldn't load jinxes", e);
}

// base definition for custom roles
const customRole: Record<string, any> = {
  id: "",
  name: "",
  image: "",
  ability: "",
  edition: "custom",
  firstNight: 0,
  firstNightReminder: "",
  otherNight: 0,
  otherNightReminder: "",
  reminders: [],
  remindersGlobal: [],
  jinxes: [],
  setup: false,
  team: "townsfolk",
  isCustom: true,
};

const rootStoreOptions: any = {
  modules: {
    players,
    session,
  },
  state: {
    version: "3.3.1",
    latestVersion: "",
    lastVersion: "",
    floatingNotice: "",
    grimoire: {
      isNight: false,
      isNightOrder: true,
      isPublic: false,
      isMenuOpen: false,
      isStatic: false,
      isMuted: false,
      isImageOptIn: true,
      isForwardEvilInfo: false,
      zoom: 0,
      background: "",
      audioThreshold: 150,
    },
    // Compatibility projection for Options API components that still use mapState.
    // Pinia owns this reactive object; remove this alias once those consumers move.
    modals: useModalStore(pinia).$state,
    edition: editionJSONbyId.get("tb"),
    selectedEditions: {
      tb: true,
      bmr: true,
      snv: true,
      exp: true,
      hdcs: true,
      syyl: true,
    },
    roles: getRolesByEdition(),
    otherTravelers: getTravelersNotInEdition(),
    fabled,
    jinxes,
    states: [],
    teamsNames: {
      townsfolk: "镇民",
      outsider: "外来者",
      minion: "爪牙",
      demon: "恶魔",
    },
    firstNight: [],
    otherNight: [],
  },
  getters: {
    /**
     * Return all custom roles, with default values and non-essential data stripped.
     * Role object keys will be replaced with a numerical index to conserve bandwidth.
     * @param roles
     * @returns {[]}
     */
    customRolesStripped: ({ roles }) => {
      const customRoles: any[] = [];
      const customKeys = Object.keys(customRole);
      const strippedProps = [
        "firstNightReminder",
        "otherNightReminder",
        "isCustom",
      ];
      roles.forEach((role: any) => {
        if (!role.isCustom) {
          customRoles.push({ id: role.id });
        } else {
          const strippedRole: Record<number, any> = {};
          for (let prop in role) {
            if (strippedProps.includes(prop)) {
              continue;
            }
            const value = role[prop];
            if (customKeys.includes(prop) && value !== customRole[prop]) {
              strippedRole[customKeys.indexOf(prop)] = value;
            }
          }
          customRoles.push(strippedRole);
        }
      });
      return customRoles;
    },
    rolesJSONbyId: () => rolesJSONbyId,
  } as Record<string, LegacyRootGetter>,
  mutations: {
    setZoom: set("zoom"),
    setBackground: set("background"),
    setLatestVersion(state, val) {
      state.latestVersion = val;
    },
    setLastVersion(state, val) {
      state.lastVersion = val;
    },
    setFloatingNotice(state, val) {
      state.floatingNotice = val;
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
      const oldRoles = Object.keys(state.session.isUseOldRole).filter(
        (key) => state.session.isUseOldRole[key] === true,
      );
      roles = roles.map((role: any) => {
        return oldRoles.includes(role.id)
          ? { ...role, id: role.id + "old1" }
          : role; // use role if not ticked, add old1 if ticked
      });
      const processedRoles = roles
        // replace numerical role object keys with matching key names
        .map((role: any) => {
          if (role[0]) {
            const customKeys: any = Object.keys(customRole);
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
            Object.assign({}, customRole, role),
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
        state.roles.get("professor").otherNight = state.session.isUseOldOrder
          .professor
          ? 79
          : 96;
      }
      if (state.roles.get("pithag")) {
        state.roles.get("pithag").otherNight = state.session.isUseOldOrder
          .pithag
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
        if (
          this.state.version != this.state.latestVersion ||
          this.state.latestVersion != this.state.lastVersion
        )
          useModalStore(pinia).toggle("version");
      } catch (e) {
        return null;
      }
    },
  } as Record<string, LegacyRootAction>,
  plugins: [persistence, socket],
};

export default new Vuex.Store(rootStoreOptions);
