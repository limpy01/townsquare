import { z } from "zod";

const jsonObjectSchema = z.object({}).passthrough();
const roleReferenceSchema = z.union([z.string(), jsonObjectSchema]);

/**
 * The historical game-state export is intentionally permissive: player and
 * edition objects contain evolving fields, while these container shapes are
 * required before the client applies the import.
 */
export const gameStateSchema = z
  .object({
    bluffs: z.array(z.string()).default([]),
    edition: jsonObjectSchema.optional(),
    roles: z.union([z.array(z.unknown()), z.literal("")]).default(""),
    fabled: z.array(roleReferenceSchema).default([]),
    players: z
      .array(
        z
          .object({
            role: roleReferenceSchema.optional(),
            reminders: z.array(z.unknown()).optional(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

export type GameState = z.infer<typeof gameStateSchema>;

export function parseGameState(input: unknown): GameState {
  return gameStateSchema.parse(input);
}
