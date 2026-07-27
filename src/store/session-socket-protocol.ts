import {
  decodeLegacyEnvelope,
  encodeLegacyEnvelope,
  type LegacyFeedback,
} from "@townsquare/contracts/legacy-envelope";
import {
  isLegacySessionCommand,
  type LegacySessionCommand,
} from "@townsquare/contracts/legacy-session-command";

export type DecodedSessionMessage = {
  command: LegacySessionCommand;
  params?: unknown;
  feedback?: LegacyFeedback;
};

/** Decode the v1 array envelope before it reaches the session dispatcher. */
export const decodeSessionMessage = (
  data: unknown,
): DecodedSessionMessage | null => {
  if (typeof data !== "string") return null;

  try {
    const envelope = decodeLegacyEnvelope(JSON.parse(data));
    if (!isLegacySessionCommand(envelope.command)) return null;
    const message: DecodedSessionMessage = { command: envelope.command };
    if (envelope.params !== undefined) message.params = envelope.params;
    if (envelope.feedback !== undefined) message.feedback = envelope.feedback;
    return message;
  } catch {
    return null;
  }
};

/** Keep the wire representation stable while transport code stays tuple-free. */
export const encodeSessionMessage = (
  command: string,
  params: unknown,
  feedback: LegacyFeedback = false,
): string =>
  JSON.stringify(encodeLegacyEnvelope({ command, params, feedback }));
