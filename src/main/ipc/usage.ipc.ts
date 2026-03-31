import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import {
  UsageService,
  type SessionUsageSummary,
  type ModelUsageSummary,
  type MessageUsagePage,
  type UsageBreakdownRow,
} from '../services/UsageService'

const ListUsageSchema = z.object({
  agentId: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  since: z.number().optional(),
  until: z.number().optional(),
})

export function registerUsageIpc(service: UsageService): void {
  ipcMain.handle('usage:listSessions', async (_event: IpcMainInvokeEvent, params: unknown): Promise<SessionUsageSummary[]> => {
    const { agentId, limit, since, until } = ListUsageSchema.parse(params ?? {})
    return await service.listSessionUsage({ agentId, limit, since, until })
  })

  ipcMain.handle('usage:aggregateByModel', async (_event: IpcMainInvokeEvent, params: unknown): Promise<ModelUsageSummary[]> => {
    const { agentId, since, until } = ListUsageSchema.parse(params ?? {})
    return await service.aggregateByModel({ agentId, since, until })
  })

  ipcMain.handle('usage:listMessages', async (_event: IpcMainInvokeEvent, params: unknown): Promise<MessageUsagePage> => {
    const { agentId, limit, offset, since, until } = ListUsageSchema.parse(params ?? {})
    return await service.listMessageUsage({ agentId, limit, offset, since, until })
  })

  ipcMain.handle('usage:breakdownByModel', async (_event: IpcMainInvokeEvent, params: unknown): Promise<UsageBreakdownRow[]> => {
    const { agentId, since, until } = ListUsageSchema.parse(params ?? {})
    return await service.aggregateMessagesByModel({ agentId, since, until })
  })

  ipcMain.handle('usage:breakdownByDay', async (_event: IpcMainInvokeEvent, params: unknown): Promise<UsageBreakdownRow[]> => {
    const { agentId, since, until } = ListUsageSchema.parse(params ?? {})
    return await service.aggregateMessagesByDay({ agentId, since, until })
  })
}
