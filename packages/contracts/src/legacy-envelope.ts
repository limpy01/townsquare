export type LegacyFeedback = string | number | false;

export type LegacyEnvelope =
  | readonly [command: string]
  | readonly [command: string, params: unknown]
  | readonly [command: string, params: unknown, feedback: LegacyFeedback];

export interface DecodedLegacyEnvelope {
  command: string;
  params?: unknown;
  feedback?: LegacyFeedback;
}

const isLegacyFeedback = (value: unknown): value is LegacyFeedback =>
  typeof value === "string" || typeof value === "number" || value === false;

export function decodeLegacyEnvelope(input: unknown): DecodedLegacyEnvelope {
  if (!Array.isArray(input) || input.length < 1 || input.length > 3) {
    throw new Error("Invalid legacy envelope");
  }

  const [command, params, feedback] = input;
  if (typeof command !== "string") {
    throw new Error("Invalid legacy envelope command");
  }
  if (input.length === 1) return { command };
  if (input.length === 2) return { command, params };
  if (!isLegacyFeedback(feedback)) {
    throw new Error("Invalid legacy envelope feedback");
  }

  return { command, params, feedback };
}

export function encodeLegacyEnvelope({
  command,
  ...rest
}: DecodedLegacyEnvelope): LegacyEnvelope {
  if (!("params" in rest) && !("feedback" in rest)) return [command];
  if (!("feedback" in rest)) return [command, rest.params];
  return [command, rest.params, rest.feedback];
}
