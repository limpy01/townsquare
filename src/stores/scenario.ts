import { defineStore } from "pinia";
import editionJSON from "../editions.json";
import rolesJSON from "../roles.json";
import fabledJSON from "../fabled.json";
import jinxesJSON from "../hatred.json";

const clean = (id: string) => id.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");

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
      .filter(
        (role) =>
          role.edition === edition.id || edition.roles.includes(role.id),
      )
      .sort((a, b) => b.team.localeCompare(a.team))
      .map((role) => [role.id, role]),
  );
};

const getTravelersNotInEdition = (edition: any = editionJSON[0]) =>
  new Map(
    rolesJSON
      .filter(
        (role) =>
          role.team === "traveler" &&
          role.edition !== edition.id &&
          !edition.roles.includes(role.id),
      )
      .map((role) => [role.id, role]),
  );

const editionJSONbyId = new Map(
  editionJSON.map((edition) => [edition.id, edition]),
);

const jinxes = new Map(
  jinxesJSON.map(({ id, hatred }) => [
    clean(id),
    new Map(hatred.map(({ id, reason }) => [clean(id), reason])),
  ]),
);

export const useScenarioStore = defineStore("scenario", {
  state: () => ({
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
});
