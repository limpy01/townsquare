import { z } from "zod";

export const roleTeamSchema = z.enum([
  "townsfolk",
  "outsider",
  "minion",
  "demon",
  "traveler",
  "traveller",
  "fabled",
  "loric",
]);

/**
 * Shared, compatibility-first game data models. They deliberately leave
 * unknown historical fields intact while validating the fields that routes,
 * storage and transport use to identify and classify game data.
 */
export const roleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    image: z.string().optional(),
    ability: z.string().optional(),
    edition: z.string().optional(),
    team: roleTeamSchema.optional(),
    firstNight: z.number().finite().optional(),
    firstNightReminder: z.string().optional(),
    otherNight: z.number().finite().optional(),
    otherNightReminder: z.string().optional(),
    reminders: z.array(z.string()).optional(),
    remindersGlobal: z.array(z.string()).optional(),
    setup: z.boolean().optional(),
  })
  .passthrough();

export const editionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    author: z.string().optional(),
    roles: z.array(z.string()).optional(),
  })
  .passthrough();

export const jinxSchema = z
  .object({
    id: z.string().min(1),
    reason: z.string(),
  })
  .passthrough();

export const playerSchema = z
  .object({
    id: z.union([z.string(), z.number().int()]),
    name: z.string().optional(),
    image: z.string().optional(),
    role: z.union([z.string(), roleSchema]).optional(),
    reminders: z.array(z.unknown()).optional(),
    stReminders: z.array(z.unknown()).optional(),
    isDead: z.boolean().optional(),
    isVoteless: z.boolean().optional(),
    votes: z.number().finite().optional(),
    pronouns: z.string().optional(),
  })
  .passthrough();

export type GameRole = z.infer<typeof roleSchema>;
export type Edition = z.infer<typeof editionSchema>;
export type Fabled = GameRole;
export type Jinx = z.infer<typeof jinxSchema>;
export type Player = z.infer<typeof playerSchema>;

export const parseGameRole = (input: unknown): GameRole =>
  roleSchema.parse(input);
export const parseEdition = (input: unknown): Edition =>
  editionSchema.parse(input);
export const parsePlayer = (input: unknown): Player =>
  playerSchema.parse(input);
