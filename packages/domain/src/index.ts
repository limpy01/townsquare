export interface VoteRecord {
  playerId: string;
  voted: boolean;
}

export function countVotes(votes: readonly VoteRecord[]): number {
  return votes.filter((vote) => vote.voted).length;
}

export interface NightOrderRole {
  id?: string;
  firstNight?: number;
  otherNight?: number;
}

export interface NightOrderEntry extends NightOrderRole {
  role?: NightOrderRole;
}

export interface NightOrderPosition {
  first: number;
  other: number;
}

/**
 * `getNightOrder` populates an entry for every player and fabled role that was
 * passed to it, so consumers rendering those same collections always receive
 * a position.
 */
export interface NightOrder extends Map<NightOrderEntry, NightOrderPosition> {
  get(key: NightOrderEntry): NightOrderPosition;
}

/**
 * Calculate displayed first-night and other-night positions for active roles.
 *
 * A custom order applies only when it lists every active role for that night;
 * this preserves the historical fallback to each role's numeric order.
 */
export function getNightOrder(
  players: readonly NightOrderEntry[],
  fabled: readonly NightOrderEntry[],
  firstNightOrder: readonly string[],
  otherNightOrder: readonly string[],
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

  const nightOrder = new Map<NightOrderEntry, NightOrderPosition>();
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
  return nightOrder as NightOrder;
}
