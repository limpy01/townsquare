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

type ScenarioEdition = {
  id: string;
  roles: string[];
  isOfficial: boolean;
  [property: string]: unknown;
};

const roleCatalog = rolesJSON as unknown as ScenarioCatalogRole[];
const fabledCatalog = fabledJSON as unknown as ScenarioCatalogRole[];
const editionCatalog = editionJSON as unknown as ScenarioEdition[];
const defaultEdition = editionCatalog[0]!;

const normalizeEdition = (value: unknown): ScenarioEdition | null => {
  if (typeof value !== "object" || value === null) return null;
  const edition = value as Record<string, unknown>;
  if (typeof edition.id !== "string") return null;
  return {
    ...edition,
    id: edition.id,
    isOfficial: edition.isOfficial === true,
    roles: Array.isArray(edition.roles)
      ? edition.roles.filter((role): role is string => typeof role === "string")
      : [],
  };
};

const getRolesByEdition = (edition: ScenarioEdition = defaultEdition) =>
  new Map(getEditionRoles(roleCatalog, edition).map((role) => [role.id, role]));

const getTravelersNotInEdition = (edition: ScenarioEdition = defaultEdition) =>
  new Map(
    getOtherTravelers(roleCatalog, edition).map((role) => [role.id, role]),
  );

const editionJSONbyId = new Map<string, ScenarioEdition>(
  editionCatalog.map((edition) => [edition.id, edition]),
);

const jinxes = new Map(
  jinxesJSON.map(({ id, hatred }) => [
    clean(id),
    new Map(hatred.map(({ id, reason }) => [clean(id), reason])),
  ]),
);

type ScenarioState = {
  edition: ScenarioEdition;
  selectedEditions: Record<string, boolean>;
  roles: Map<string, ScenarioCatalogRole>;
  otherTravelers: Map<string, ScenarioCatalogRole>;
  fabled: Map<string, ScenarioCatalogRole>;
  jinxes: Map<string, Map<string, string>>;
  states: unknown[];
  teamsNames: Record<string, string>;
  firstNight: unknown[];
  otherNight: unknown[];
};

export const useScenarioStore = defineStore("scenario", {
  state: (): ScenarioState => ({
    edition: editionJSONbyId.get("tb") ?? defaultEdition,
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
    fabled: new Map(fabledCatalog.map((role) => [role.id, role])),
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
        roleCatalog,
        fabledCatalog,
      );
      this.roles = catalog.roles;
      this.fabled = catalog.fabled;
      this.otherTravelers = catalog.otherTravelers;
      return true;
    },
    setEdition(value: unknown) {
      const edition = normalizeEdition(value);
      if (!edition) return undefined;
      let fabled: ScenarioCatalogRole[] | undefined;
      const knownEdition = editionJSONbyId.get(edition.id);
      if (knownEdition) {
        this.edition = knownEdition;
        this.roles = getRolesByEdition(this.edition);
        if (this.edition.id === "all") {
          this.roles = new Map(
            Array.from(this.roles.entries()).filter(([, role]) =>
              typeof role.edition === "string"
                ? this.selectedEditions[role.edition]
                : false,
            ),
          );
        }
        this.otherTravelers = getTravelersNotInEdition(this.edition);
        fabled = Array.from(this.fabled.values()).filter(
          (role) => role.edition === edition.id,
        );
        if (!useSessionIdentityStore(pinia).isSpectator) {
          usePlayersStore(pinia).setFabled({ fabled });
        }
      } else {
        this.edition = edition;
      }
      const professor = this.roles.get("professor");
      if (professor) {
        professor.otherNight = useLegacyOptionsStore(pinia).useOldOrder
          .professor
          ? 79
          : 96;
      }
      const pithag = this.roles.get("pithag");
      if (pithag) {
        pithag.otherNight = useLegacyOptionsStore(pinia).useOldOrder.pithag
          ? 37
          : 16;
      }
      useModalStore(pinia).edition = false;
      return fabled;
    },
  },
});
