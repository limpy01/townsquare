import { z } from "zod";

/**
 * The browser keeps its historical flat localStorage layout for compatibility.
 * This marker only records that the non-destructive key migration has run.
 */
export const townsquareStorageVersionKey = "townsquareStorageVersion";
export const townsquareStorageVersion = 1;

export const townsquareStorageVersionSchema = z.number().int().nonnegative();

export const persistedSessionSchema = z.tuple([z.boolean(), z.string().min(1)]);

export const persistedUseOldOrderSchema = z
  .object({ pithag: z.boolean(), professor: z.boolean() })
  .strict();

export const persistedUseOldRoleSchema = z
  .object({
    balloonist: z.boolean(),
    acrobat: z.boolean(),
    lilmonsta: z.boolean(),
    alchemist: z.boolean(),
    lycanthrope: z.boolean(),
  })
  .strict();

export const persistedSelectedEditionsSchema = z.record(
  z.string(),
  z.boolean(),
);
export const persistedStringRecordSchema = z.record(z.string(), z.string());
export const persistedStringArraySchema = z.array(z.string());
export const persistedFiniteNumberSchema = z.number().finite();
export const persistedBooleanSchema = z.boolean();
export const persistedSeatSchema = z.number().int().min(-1);

export type PersistedSession = z.infer<typeof persistedSessionSchema>;
export type PersistedUseOldOrder = z.infer<typeof persistedUseOldOrderSchema>;
export type PersistedUseOldRole = z.infer<typeof persistedUseOldRoleSchema>;

export function parseTownsquareStorageVersion(value: string | null): number {
  if (value === null) return 0;
  const parsed = townsquareStorageVersionSchema.safeParse(Number(value));
  return parsed.success ? parsed.data : 0;
}
