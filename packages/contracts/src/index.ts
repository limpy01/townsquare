import { z } from "zod";

export * from "./legacy-envelope.js";
export * from "./legacy-client-command.js";
export * from "./custom-script.js";
export * from "./dynamic-init.js";
export * from "./game-state.js";

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
