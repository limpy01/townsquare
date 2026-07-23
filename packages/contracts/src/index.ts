import { z } from "zod";

export * from "./legacy-envelope.js";

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
