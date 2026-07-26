import { defineStore } from "pinia";
import {
  buildScenarioRoleCatalog,
  getEditionRoles,
  getOtherTravelers,
} from "@townsquare/domain";
import { parseCustomScript } from "@townsquare/contracts/custom-script";
import editionJSON from "../editions.json";
import rolesJSON from "../roles.json";
import fabledJSON from "../fabled.json";
import jinxesJSON from "../hatred.json";
import { pinia } from "../pinia";
import { customRoleDefaults, rolesJSONbyId } from "../store/selectors";
import { useLegacyOptionsStore } from "./legacy-options";
import { useModalStore } from "./modals";
import { usePlayersStore } from "./players";
import { useSessionIdentityStore } from "./session-identity";

const clean = (id: string) => id.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");

const getRolesByEdition = (edition: any = editionJSON[0]) =>
  new Map(getEditionRoles(rolesJSON, edition).map((role) => [role.id, role]));

const getTravelersNotInEdition = (edition: any = editionJSON[0]) =>
  new Map(getOtherTravelers(rolesJSON, edition).map((role) => [role.id, role]));

const editionJSONbyId = new Map(
  editionJSON.map((edition) => [edition.id, edition]),
);

const jinxes = new Map(
  jinxesJSON.map(({ id, hatred }) => [
    clean(id),
    new Map(hatred.map(({ id, reason }) => [clean(id), reason])),
  ]),
);

type ScenarioState = {
  edition: any;
  selectedEditions: Record<string, boolean>;
  roles: Map<any, any>;
  otherTravelers: Map<any, any>;
  fabled: Map<any, any>;
  jinxes: Map<any, any>;
  states: unknown[];
  teamsNames: Record<string, string>;
  firstNight: unknown[];
  otherNight: unknown[];
};

export const useScenarioStore = defineStore("scenario", {
  state: (): ScenarioState => ({
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
    fabled: new Map(fabledJSON.map((role) => [role.id, role])),
    jinxes,
    states: [] as unknown[],
    teamsNames: {
      townsfolk: "镇民",
      outsider: "外来者",
      minion: "爪牙",
      demon: "恶魔",
    },
    firstNight: [] as unknown[],
    otherNight: [] as unknown[],
  }),
  actions: {
    setSelectedEditions(selectedEditions: Record<string, boolean>) {
      this.selectedEditions = { ...selectedEditions };
      if (this.edition?.id === "all") this.setEdition(this.edition);
    },
    setStates(states: unknown[]) {
      this.states = states;
    },
    setTeamsNames(names: Record<string, string>) {
      this.teamsNames = names;
    },
    setFirstNight(firstNight: unknown[]) {
      this.firstNight = firstNight;
      usePlayersStore(pinia).firstNightOrder = firstNight;
    },
    setOtherNight(otherNight: unknown[]) {
      this.otherNight = otherNight;
      usePlayersStore(pinia).otherNightOrder = otherNight;
    },
    setCustomRoles(rawRoles: unknown) {
      if (!Array.isArray(rawRoles)) return false;
      let validRoles: any[];
      try {
        // Historical compact array entries are normalized below. Object-shaped
        // input is untrusted custom-script data and must cross the shared schema.
        validRoles = rawRoles.some(Array.isArray)
          ? rawRoles
          : parseCustomScript(rawRoles);
      } catch {
        return false;
      }
      const legacyOptions = useLegacyOptionsStore(pinia);
      const oldRoles = (
        Object.keys(legacyOptions.useOldRole) as Array<
          keyof typeof legacyOptions.useOldRole
        >
      ).filter((key) => legacyOptions.useOldRole[key] === true);
      const roles = validRoles.map((role) =>
        oldRoles.includes(role.id) ? { ...role, id: role.id + "old1" } : role,
      );
      const processedRoles = roles
        .map((role: any) => {
          if (!role[0]) return role;
          const customKeys: any = Object.keys(customRoleDefaults);
          const mappedRole: Record<string, any> = {};
          for (const prop in role) {
            if (customKeys[prop]) mappedRole[customKeys[prop]] = role[prop];
          }
          return mappedRole;
        })
        .map((role: any) => ({ ...role, id: clean(role.id) }))
        .map(
          (role: any) =>
            rolesJSONbyId.get(role.id) ||
            this.roles.get(role.id) ||
            Object.assign({}, customRoleDefaults, role),
        )
        .map((role: any) => {
          if (rolesJSONbyId.get(role.id)) return role;
          role.imageAlt =
            (
              {
                townsfolk: "good",
                outsider: "outsider",
                minion: "minion",
                demon: "evil",
                fabled: /^bootlegger\d+$/.test(role.id)
                  ? "bootlegger"
                  : "fabled",
                loric: /^bootlegger\d+$/.test(role.id) ? "bootlegger" : "loric",
              } as Record<string, string>
            )[role.team] || "custom";
          role.firstNight = Math.abs(role.firstNight);
          role.otherNight = Math.abs(role.otherNight);
          return role;
        })
        .filter((role: any) => role.name && role.ability && role.team)
        .sort((a: any, b: any) => b.team.localeCompare(a.team));

      const catalog = buildScenarioRoleCatalog(
        processedRoles,
        rolesJSON,
        fabledJSON,
      );
      this.roles = catalog.roles;
      this.fabled = catalog.fabled;
      this.otherTravelers = catalog.otherTravelers;
      return true;
    },
    setEdition(edition: any) {
      let fabled: any[] | undefined;
      if (editionJSONbyId.has(edition.id)) {
        this.edition = editionJSONbyId.get(edition.id);
        this.roles = getRolesByEdition(this.edition);
        if (this.edition.id === "all") {
          this.roles = new Map(
            Array.from(this.roles.entries()).filter(
              ([, role]: any) => this.selectedEditions[role.edition],
            ),
          );
        }
        this.otherTravelers = getTravelersNotInEdition(this.edition);
        fabled = Array.from(this.fabled.values()).filter(
          (role: any) => role.edition === edition.id,
        );
        if (!useSessionIdentityStore(pinia).isSpectator) {
          usePlayersStore(pinia).setFabled({ fabled });
        }
      } else {
        this.edition = edition;
      }
      if (this.roles.get("professor")) {
        this.roles.get("professor").otherNight = useLegacyOptionsStore(pinia)
          .useOldOrder.professor
          ? 79
          : 96;
      }
      if (this.roles.get("pithag")) {
        this.roles.get("pithag").otherNight = useLegacyOptionsStore(pinia)
          .useOldOrder.pithag
          ? 37
          : 16;
      }
      useModalStore(pinia).edition = false;
      return fabled;
    },
  },
});
