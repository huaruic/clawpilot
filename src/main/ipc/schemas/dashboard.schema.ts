import { z } from 'zod'

export const DashboardGetUsageSchema = z.object({
  since: z.number().optional(),
})
