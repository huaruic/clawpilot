import { ipcMain } from 'electron'
import { z } from 'zod'
import { AgentService, type AgentCreateMode } from '../services/AgentService'

const CreateAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mode: z.enum(['inherit', 'generate']),
  defaultModel: z.string().optional(),
})

const DeleteAgentSchema = z.object({
  id: z.string().min(1),
})

const UpdateModelSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
})

export function registerAgentsIpc(service: AgentService): void {
  ipcMain.handle('agents:list', async () => {
    return await service.listAgents()
  })

  ipcMain.handle('agents:create', async (_, raw) => {
    const params = CreateAgentSchema.parse(raw)
    return await service.createAgent({
      id: params.id,
      name: params.name,
      mode: params.mode as AgentCreateMode,
      defaultModel: params.defaultModel,
    })
  })

  ipcMain.handle('agents:delete', async (_, raw) => {
    const { id } = DeleteAgentSchema.parse(raw)
    await service.deleteAgent(id)
    return { ok: true }
  })

  ipcMain.handle('agents:updateModel', async (_, raw) => {
    const { id, model } = UpdateModelSchema.parse(raw)
    return await service.updateDefaultModel(id, model)
  })
}
