import { z } from "zod";

export const legacyFeedbackSchema = z.union([
  z.string(),
  z.number(),
  z.literal(false),
]);

export type LegacyFeedback = z.infer<typeof legacyFeedbackSchema>;

export const playerIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, "invalid player ID");

export const roomIdSchema = z
  .string()
  .regex(/^(?:[1-9]\d{0,3}|10000)$/, "invalid room ID");

export const avatarUploadSchema = z.object({
  playerId: playerIdSchema,
  uploadContent: z.string().min(1),
});

export type AvatarUpload = z.infer<typeof avatarUploadSchema>;

export function parseAvatarUpload(input: unknown): AvatarUpload {
  return avatarUploadSchema.parse(input);
}

export type LegacyEnvelope =
  | readonly [command: string]
  | readonly [command: string, params: unknown]
  | readonly [command: string, params: unknown, feedback: LegacyFeedback];

export interface DecodedLegacyEnvelope {
  command: string;
  params?: unknown;
  feedback?: LegacyFeedback;
}

export const scriptTeamSchema = z.enum([
  "townsfolk",
  "outsider",
  "minion",
  "demon",
  "traveler",
  "traveller",
  "fabled",
  "loric",
]);

const scriptRoleInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    team: scriptTeamSchema.optional(),
    ability: z.string().optional(),
  })
  .passthrough();

export type CanonicalScriptTeam = Exclude<
  z.infer<typeof scriptTeamSchema>,
  "traveller"
>;

export type ScriptRole = Omit<z.infer<typeof scriptRoleInputSchema>, "team"> & {
  id: string;
  team: CanonicalScriptTeam | undefined;
};

export function cleanScriptRoleId(id: string): string {
  return id.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseCustomScript(input: unknown): ScriptRole[] {
  const rawRoles = z.array(scriptRoleInputSchema).parse(input);

  return rawRoles.map((rawRole, index) => {
    const id = cleanScriptRoleId(rawRole.id);
    if (!id) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [index, "id"],
          message: "role id must contain at least one ASCII letter or number",
        },
      ]);
    }

    const isCustom =
      rawRole.name !== undefined ||
      rawRole.team !== undefined ||
      rawRole.ability !== undefined;
    if (isCustom && (!rawRole.name || !rawRole.team || !rawRole.ability)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [index],
          message: "custom roles require name, team, and ability",
        },
      ]);
    }

    const team: CanonicalScriptTeam | undefined =
      rawRole.team === "traveller" ? "traveler" : rawRole.team;
    return { ...rawRole, id, team };
  });
}

const legacyEnvelopeSchema = z
  .array(z.unknown())
  .min(1)
  .max(3)
  .superRefine((value, context) => {
    if (typeof value[0] !== "string") {
      context.addIssue({ code: "custom", message: "command must be a string" });
    }
    if (
      value.length === 3 &&
      !legacyFeedbackSchema.safeParse(value[2]).success
    ) {
      context.addIssue({
        code: "custom",
        message: "feedback must be string, number, or false",
      });
    }
  });

export function decodeLegacyEnvelope(input: unknown): DecodedLegacyEnvelope {
  const envelope = legacyEnvelopeSchema.parse(input);
  const command = envelope[0];

  if (typeof command !== "string") {
    throw new Error("Invalid legacy envelope command");
  }
  if (envelope.length === 1) return { command };
  if (envelope.length === 2) return { command, params: envelope[1] };

  const feedback = legacyFeedbackSchema.parse(envelope[2]);
  return { command, params: envelope[1], feedback };
}

export function encodeLegacyEnvelope({
  command,
  ...rest
}: DecodedLegacyEnvelope): LegacyEnvelope {
  if (!("params" in rest) && !("feedback" in rest)) return [command];
  if (!("feedback" in rest)) return [command, rest.params];
  return [command, rest.params, rest.feedback];
}
