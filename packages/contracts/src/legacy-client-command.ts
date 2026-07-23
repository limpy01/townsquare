import { z } from "zod";

import { legacySessionCommandSchema } from "./legacy-session-command.js";

/**
 * Top-level v1 commands accepted by the WebSocket server. Payloads retain
 * their legacy shapes and are validated by their dedicated command handlers.
 */
export const legacyClientCommandSchema = z.enum([
  "bluff",
  "bootlegger",
  "clearVoteHistory",
  "direct",
  "edition",
  "fabled",
  "firstNight",
  "grimoire",
  "gs",
  "isNight",
  "isReview",
  "isVoteHistoryAllowed",
  "isVoteInProgress",
  "lock",
  "marked",
  "move",
  "nomination",
  "otherNight",
  "ping",
  "player",
  "pronouns",
  "remove",
  "request",
  "secretVote",
  "setTalking",
  "setTimer",
  "stId",
  "startTimer",
  "states",
  "stopTimer",
  "swap",
  "teamsNames",
  "uploadFile",
  "useOldOrder",
  "useOldRole",
  "vote",
  "votingSpeed",
]);

export type LegacyClientCommand = z.infer<typeof legacyClientCommandSchema>;

/**
 * Scalar v1 broadcast commands whose payloads have remained stable. The
 * remaining commands retain their dedicated compatibility handlers until
 * their nested payloads are described by contracts as well.
 */
const legacyScalarPayloadSchemas: Partial<
  Record<LegacyClientCommand, z.ZodType>
> = {
  clearVoteHistory: z.union([z.null(), z.undefined()]),
  bootlegger: z.string(),
  isNight: z.boolean(),
  isReview: z.boolean(),
  isVoteHistoryAllowed: z.boolean(),
  isVoteInProgress: z.boolean(),
  lock: z.tuple([
    z.number().int().nonnegative(),
    z.union([z.boolean(), z.number().finite(), z.null()]),
  ]),
  secretVote: z.boolean(),
  setTimer: z.number().finite().nonnegative(),
  startTimer: z.number().finite().nonnegative(),
  stId: z.string(),
  stopTimer: z.union([z.null(), z.undefined()]),
  votingSpeed: z.number().finite().positive(),
  vote: z.tuple([
    z.number().int().nonnegative(),
    z.union([z.boolean(), z.number().finite(), z.null()]),
    z.boolean(),
  ]),
};

export function isLegacyClientPayload(
  command: LegacyClientCommand,
  params: unknown,
): boolean {
  const schema = legacyScalarPayloadSchemas[command];
  return !schema || schema.safeParse(params).success;
}

export const legacySetTalkingPayloadSchema = z
  .object({
    seatNum: z.number().int().nonnegative(),
    isTalking: z.boolean(),
  })
  .passthrough();

export type LegacySetTalkingPayload = z.infer<
  typeof legacySetTalkingPayloadSchema
>;

/**
 * A direct message is delivered to one or more browser session dispatchers.
 * Restrict its inner command to that dispatcher's supported command set so a
 * host cannot use the transport as an arbitrary client-side command channel.
 */
export const legacyDirectPayloadSchema = z.record(
  z.string(),
  z.tuple([legacySessionCommandSchema, z.unknown()]),
);

export type LegacyDirectPayload = z.infer<typeof legacyDirectPayloadSchema>;

const legacyRequestTargetSchema = z
  .array(z.unknown())
  .min(1)
  .max(2)
  .refine((value) => typeof value[0] === "string");

export const legacyRequestPayloadSchema = z.union([
  z.object({ checkAllowHost: legacyRequestTargetSchema }).strict(),
  z.object({ checkAllowJoin: legacyRequestTargetSchema }).strict(),
  z
    .object({
      deleteMessage: z.tuple([
        z.string(),
        z.tuple([z.literal("direct"), z.union([z.string(), z.number()])]),
      ]),
    })
    .strict(),
]);

export type LegacyRequestPayload = z.infer<typeof legacyRequestPayloadSchema>;

export const legacyUploadFilePayloadSchema = z
  .object({
    uploadAvatar: z.tuple([z.string(), z.string().min(1)]),
  })
  .strict();

export type LegacyUploadFilePayload = z.infer<
  typeof legacyUploadFilePayloadSchema
>;

export function isLegacyClientCommand(
  command: string,
): command is LegacyClientCommand {
  return legacyClientCommandSchema.safeParse(command).success;
}
