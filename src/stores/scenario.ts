import { defineStore } from "pinia";
import {
  buildScenarioRoleCatalog,
  getEditionRoles,
  getOtherTravelers,
  normalizeScenarioCustomRoles,
} from "@townsquare/domain";
import type {
  ScenarioCatalogRole,
  ScenarioRoleDefaults,
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
      let validRoles: unknown[];
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
      const processedRoles = normalizeScenarioCustomRoles(
        validRoles,
        oldRoles,
        customRoleDefaults as unknown as ScenarioRoleDefaults,
        rolesJSONbyId as unknown as ReadonlyMap<string, ScenarioCatalogRole>,
        this.roles as ReadonlyMap<string, ScenarioCatalogRole>,
      );

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
