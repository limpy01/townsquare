import rolesJSON from "../roles.json";

export const rolesJSONbyId = new Map(rolesJSON.map((role) => [role.id, role]));

export const customRoleDefaults: Record<string, any> = {
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

/**
 * Compact a custom script for transport and game-state export.
 * Official roles are represented by their ID; custom roles only include fields
 * that differ from the baseline definition.
 */
export function getCustomRolesStripped(roles: Iterable<any>) {
  const customRoles: any[] = [];
  const customKeys = Object.keys(customRoleDefaults);
  const strippedProps = [
    "firstNightReminder",
    "otherNightReminder",
    "isCustom",
  ];

  for (const role of roles) {
    if (!role.isCustom) {
      customRoles.push({ id: role.id });
      continue;
    }

    const strippedRole: Record<number, any> = {};
    for (const prop in role) {
      if (strippedProps.includes(prop)) continue;
      const value = role[prop];
      if (customKeys.includes(prop) && value !== customRoleDefaults[prop]) {
        strippedRole[customKeys.indexOf(prop)] = value;
      }
    }
    customRoles.push(strippedRole);
  }
  return customRoles;
}
