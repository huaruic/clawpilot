import { z } from 'zod'

export const CreateProfileSchema = z.object({
  name: z.string().min(1).max(50),
  modelRef: z.string().regex(/^.+\/.+$/, 'Must be in "provider/model" format').optional(),
  inheritWorkspace: z.boolean().default(true),
  channelBindings: z
    .array(
      z.object({
        channelType: z.string().min(1),
        accountId: z.string().min(1),
      }),
    )
    .optional(),
})

export const UpdateProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50).optional(),
  modelRef: z.string().regex(/^.+\/.+$/, 'Must be in "provider/model" format').nullable().optional(),
})

export const DeleteProfileSchema = z.object({
  id: z.string().min(1),
})

export const RouteQuerySchema = z.object({
  channelType: z.string().min(1),
  accountId: z.string().min(1),
})

export const SetRouteSchema = z.object({
  channelType: z.string().min(1),
  accountId: z.string().min(1),
  profileId: z.string().min(1),
})

export const ClearRouteSchema = z.object({
  channelType: z.string().min(1),
  accountId: z.string().min(1),
})
