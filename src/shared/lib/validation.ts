import { z } from 'zod';

export const storeIdSchema = z.string().uuid();
export const productIdSchema = z.string().uuid();
export const dateSchema = z.string().datetime();

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
