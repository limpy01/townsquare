type NightOrderEntry = {
  id?: string;
  firstNight?: number;
  otherNight?: number;
  role?: NightOrderEntry;
};

export type NightOrder = Map<any, any>;

/** Calculate displayed first-night and other-night positions for active roles. */
export function getNightOrder(
  players: NightOrderEntry[],
  fabled: NightOrderEntry[],
  firstNightOrder: string[],
  otherNightOrder: string[],
): NightOrder {
  const firstNight = [0];
  const otherNight = [0];
  const firstNightRoles = players
    .map((player) => player.role ?? {})
    .filter((role) => (role.firstNight ?? 0) > 0)
    .map((role) => role.id);
  const customFirstNight = firstNightRoles.every((role) =>
    firstNightOrder.includes(role ?? ""),
  );
  const otherNightRoles = players
    .map((player) => player.role ?? {})
    .filter((role) => (role.otherNight ?? 0) > 0)
    .map((role) => role.id);
  const customOtherNight = otherNightRoles.every((role) =>
    otherNightOrder.includes(role ?? ""),
  );
  const entries = [...players, ...fabled];

  entries.forEach((entry) => {
    const role = entry.role ?? entry;
    if (
      customFirstNight &&
      firstNightOrder.indexOf(role.id ?? "") > -1 &&
      role.firstNight
    ) {
      firstNight.push(firstNightOrder.indexOf(role.id ?? ""));
    } else if (role.firstNight && !firstNight.includes(role.firstNight)) {
      firstNight.push(role.firstNight);
    }
    if (
      customOtherNight &&
      otherNightOrder.indexOf(role.id ?? "") > -1 &&
      role.otherNight
    ) {
      otherNight.push(otherNightOrder.indexOf(role.id ?? ""));
    } else if (role.otherNight && !otherNight.includes(role.otherNight)) {
      otherNight.push(role.otherNight);
    }
  });
  firstNight.sort((a, b) => a - b);
  otherNight.sort((a, b) => a - b);

  const nightOrder: NightOrder = new Map();
  entries.forEach((entry) => {
    const role = entry.role ?? entry;
    nightOrder.set(entry, {
      first: Math.max(
        customFirstNight
          ? firstNight.indexOf(firstNightOrder.indexOf(role.id ?? ""))
          : firstNight.indexOf(role.firstNight ?? 0),
        0,
      ),
      other: Math.max(
        customOtherNight
          ? otherNight.indexOf(otherNightOrder.indexOf(role.id ?? ""))
          : otherNight.indexOf(role.otherNight ?? 0),
        0,
      ),
    });
  });
  return nightOrder;
}
