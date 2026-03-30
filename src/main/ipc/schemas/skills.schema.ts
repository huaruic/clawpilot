import { z } from 'zod'

export const SetSkillEnabledSchema = z.object({
  skillKey: z.string().min(1),
  enabled: z.boolean(),
})

export const DeleteSkillSchema = z.object({
  skillKey: z.string().min(1),
})

export const InstallSkillSchema = z.object({
  sourcePath: z.string().min(1),
  overwrite: z.boolean().optional(),
})
