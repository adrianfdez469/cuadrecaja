import { z } from 'zod';

export const processedDataSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  lastName: z.string().optional(),
  ci: z.string().optional(),
  type: z.enum(['credential', 'identity']),
});

export type IProcessedData = z.infer<typeof processedDataSchema>;
