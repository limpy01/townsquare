export const sessionTransportTiming = {
  pingIntervalMs: 3 * 1000,
  reconnectDelayMs: 3 * 1000,
  sendQueueIntervalMs: 1.5 * 1000,
} as const;

export type SessionSocketUrlOptions = {
  channel: string;
  playerId: string;
  isSpectator: boolean;
  hostSecret: string;
};

/** Build the unchanged v1 session endpoint without coupling it to LiveSession. */
export function buildSessionSocketUrl(
  baseUrl: string,
  { channel, playerId, isSpectator, hostSecret }: SessionSocketUrlOptions,
): string {
  const hostPath = isSpectator ? "" : "/host";
  const authQuery = isSpectator ? "" : `?auth=${hostSecret}`;
  return `${baseUrl}${channel}/${playerId}${hostPath}${authQuery}`;
}
