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

const legacyRoleSchema = z.object({ id: z.string().min(1) }).passthrough();
const legacyRoleListSchema = z.array(legacyRoleSchema);
const legacySeatUpdateSchema = z
  .object({
    index: z.number().int().nonnegative(),
    property: z.string().min(1),
    value: z.unknown(),
  })
  .passthrough();

const legacyGrimoireRoleEntrySchema = z.tuple([
  legacySeatUpdateSchema.extend({
    property: z.literal("role"),
    value: z.string().optional(),
  }),
]);
const legacyReminderSchema = z
  .object({ role: z.string().optional() })
  .passthrough();
const legacyGrimoireReminderEntrySchema = z.tuple([
  legacySeatUpdateSchema.extend({
    property: z.union([z.literal("reminder"), z.literal("stReminder")]),
    value: z.array(legacyReminderSchema),
  }),
]);
const legacyGrimoireSchema = z
  .object({
    roles: z.array(legacyGrimoireRoleEntrySchema),
    reminders: z.array(legacyGrimoireReminderEntrySchema).optional(),
    stReminders: z.array(legacyGrimoireReminderEntrySchema).optional(),
  })
  .passthrough();

export type LegacyGrimoirePayload = z.infer<typeof legacyGrimoireSchema>;
const legacyEditionPayloadSchema = z
  .object({
    edition: z.object({ id: z.string().min(1) }).passthrough(),
    roles: legacyRoleListSchema.optional(),
  })
  .passthrough();
const legacyGameStatePlayerSchema = z
  .object({
    name: z.string().optional(),
    id: z.union([z.string(), z.number()]).optional(),
    image: z.string().optional(),
    stReminders: z.array(z.unknown()).optional(),
    isDead: z.boolean().optional(),
    isSecretVoteless: z.boolean().optional(),
    isVoteless: z.boolean().optional(),
    pronouns: z.string().optional(),
    votes: z.number().optional(),
    roleId: z.string().optional(),
  })
  .passthrough();
const legacyGameStatePayloadSchema = z
  .object({
    gamestate: z.array(legacyGameStatePlayerSchema),
    isLightweight: z.boolean().optional(),
  })
  .passthrough();

export type LegacyGameStatePayload = z.infer<
  typeof legacyGameStatePayloadSchema
> &
  Record<string, unknown>;
const legacySessionStatusSchema = z
  .object({
    isSecretVoteless: z.boolean(),
    groupChatPlayers: z.array(z.string()),
    isWraith: z.boolean(),
    isUsingWraith: z.boolean(),
  })
  .passthrough();

export type LegacySessionStatusPayload = z.infer<
  typeof legacySessionStatusSchema
>;

const legacyChatPayloadSchema = z
  .object({
    message: z.string(),
    sendingPlayerId: z.string(),
    receivingPlayerId: z.string(),
  })
  .passthrough();

export type LegacyChatPayload = z.infer<typeof legacyChatPayloadSchema>;

const legacyClaimPayloadSchema = z.tuple([
  z.number().int().min(-1),
  z.string(),
  z.string(),
  z.string().optional(),
]);

export type LegacyClaimPayload = z.infer<typeof legacyClaimPayloadSchema>;
const legacyRoleActivityPayloadSchema = z
  .object({
    role: z.string().min(1),
    property: z.string().min(1),
    value: z.unknown(),
    st: z.boolean().optional(),
  })
  .passthrough();

export type LegacyRoleActivityPayload = z.infer<
  typeof legacyRoleActivityPayloadSchema
>;

const legacyUsingRolePayloadSchema = z
  .object({
    role: z.string().min(1),
    value: z.unknown(),
    playerId: z.string().min(1),
  })
  .passthrough();

export type LegacyUsingRolePayload = z.infer<
  typeof legacyUsingRolePayloadSchema
>;
const legacyNominationPayloadSchema = z.union([
  z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  z.null(),
  z.undefined(),
]);

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
  bluff: legacyRoleListSchema,
  edition: legacyEditionPayloadSchema,
  fabled: legacyRoleListSchema,
  firstNight: z.array(z.string()),
  grimoire: legacyGrimoireSchema,
  gs: legacyGameStatePayloadSchema,
  isNight: z.boolean(),
  isReview: z.boolean(),
  isVoteHistoryAllowed: z.boolean(),
  isVoteInProgress: z.boolean(),
  lock: z.tuple([
    z.number().int().nonnegative(),
    z.union([z.boolean(), z.number().finite(), z.null()]),
  ]),
  marked: z.union([
    z.number().int().min(-1),
    z
      .object({
        val: z.number().int().min(-1),
        force: z.boolean(),
      })
      .strict(),
  ]),
  move: z.tuple([
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
  ]),
  nomination: legacyNominationPayloadSchema,
  otherNight: z.array(z.string()),
  ping: z.tuple([
    z.union([z.string(), z.number().int().nonnegative()]),
    z.literal("latency"),
  ]),
  player: legacySeatUpdateSchema,
  pronouns: z.tuple([z.number().int().nonnegative(), z.string()]),
  remove: z.number().int().nonnegative(),
  secretVote: z.boolean(),
  setTimer: z.number().finite().nonnegative(),
  startTimer: z.number().finite().nonnegative(),
  stId: z.string(),
  stopTimer: z.union([z.null(), z.undefined()]),
  swap: z.tuple([
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
  ]),
  useOldOrder: z
    .object({ pithag: z.boolean(), professor: z.boolean() })
    .strict(),
  useOldRole: z
    .object({
      balloonist: z.boolean(),
      acrobat: z.boolean(),
      lilmonsta: z.boolean(),
      alchemist: z.boolean(),
      lycanthrope: z.boolean(),
    })
    .strict(),
  states: z.array(z.unknown()),
  teamsNames: z.record(z.string(), z.string()),
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
const legacySessionPayloadSchemas: Partial<
  Record<z.infer<typeof legacySessionCommandSchema>, z.ZodType>
> = {
  addGroupChat: z.array(z.string()),
  alertPopup: z.string(),
  allowHost: z.boolean(),
  allowJoin: z.boolean(),
  avatarReceived: z.string(),
  bluff: legacyRoleListSchema,
  bootlegger: z.string(),
  bye: z.string(),
  chat: legacyChatPayloadSchema,
  claim: legacyClaimPayloadSchema,
  clearVoteHistory: z.union([z.null(), z.undefined()]),
  edition: legacyEditionPayloadSchema,
  fabled: legacyRoleListSchema,
  feedback: z.union([z.string(), z.number().int().nonnegative()]),
  firstNight: z.array(z.string()),
  getGamestate: z.string(),
  getStId: z.string(),
  grimoire: legacyGrimoireSchema,
  gs: legacyGameStatePayloadSchema,
  isNight: z.boolean(),
  isReview: z.boolean(),
  isRole: legacyRoleActivityPayloadSchema,
  isVoteHistoryAllowed: z.boolean(),
  isVoteInProgress: z.boolean(),
  leaveSeat: z.union([z.null(), z.undefined()]),
  lock: legacyScalarPayloadSchemas.lock!,
  marked: legacyScalarPayloadSchemas.marked!,
  move: legacyScalarPayloadSchemas.move!,
  nomination: legacyNominationPayloadSchema,
  otherNight: z.array(z.string()),
  ping: legacyScalarPayloadSchemas.ping!,
  player: legacySeatUpdateSchema,
  pronouns: legacyScalarPayloadSchemas.pronouns!,
  remove: legacyScalarPayloadSchemas.remove!,
  removeGroupChat: z.union([z.null(), z.undefined()]),
  removeGroupChatMember: z.string(),
  secretVote: z.boolean(),
  setTalking: legacySetTalkingPayloadSchema,
  setTimer: z.number().finite().nonnegative(),
  stId: z.string(),
  startTimer: z.number().finite().nonnegative(),
  states: z.array(z.unknown()),
  stopTimer: z.union([z.null(), z.undefined()]),
  swap: legacyScalarPayloadSchemas.swap!,
  syncPlayersStatus: legacySessionStatusSchema,
  teamsNames: z.record(z.string(), z.string()),
  useOldOrder: legacyScalarPayloadSchemas.useOldOrder!,
  useOldRole: legacyScalarPayloadSchemas.useOldRole!,
  usingRole: legacyUsingRolePayloadSchema,
  vote: legacyScalarPayloadSchemas.vote!,
  votingSpeed: z.number().finite().positive(),
};

/** Validate v1 server messages before the browser dispatcher mutates state. */
export function isLegacySessionPayload(
  command: string,
  params: unknown,
): boolean {
  const parsedCommand = legacySessionCommandSchema.safeParse(command);
  if (!parsedCommand.success) return false;
  const schema = legacySessionPayloadSchemas[parsedCommand.data];
  return Boolean(schema?.safeParse(params).success);
}

const legacyDirectMessageSchema = z
  .tuple([legacySessionCommandSchema, z.unknown()])
  .superRefine(([command, params], context) => {
    if (!isLegacySessionPayload(command, params)) {
      context.addIssue({
        code: "custom",
        message: `invalid ${command} direct payload`,
      });
    }
  });

export const legacyDirectPayloadSchema = z.record(
  z.string(),
  legacyDirectMessageSchema,
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
