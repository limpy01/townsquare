import { z } from "zod";

export const dynamicInitResponseSchema = z.object({
  payload: z.object({
    version: z.string(),
    floatingNotice: z.string(),
  }),
});

export type DynamicInitResponse = z.infer<typeof dynamicInitResponseSchema>;

export function parseDynamicInitResponse(input: unknown): DynamicInitResponse {
  return dynamicInitResponseSchema.parse(input);
}
