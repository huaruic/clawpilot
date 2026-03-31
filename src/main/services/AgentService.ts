import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getDefaultOpenClawWorkspaceRoot, getOpenClawStateDir } from './RuntimeLocator'

export interface AgentSummary {
  id: string
  name: string
  workspacePath: string
  defaultModel?: string
  createdAt?: number
}

export type AgentCreateMode = 'inherit' | 'generate'

interface AgentRegistry {
  agents: Record<string, AgentSummary>
}

const PERSONA_FILES = ['SOUL.md', 'AGENTS.md', 'IDENTITY.md', 'USER.md'] as const

export class AgentService {
  private registryPath(): string {
    return path.join(getOpenClawStateDir(), 'agents', 'agents.json')
  }

  private agentsRoot(): string {
    return path.join(getOpenClawStateDir(), 'agents')
  }

  private workspacePath(agentId: string): string {
    return path.join(this.agentsRoot(), agentId, 'workspace')
  }

  async listAgents(): Promise<AgentSummary[]> {
    const registry = await this.readRegistry()
    const byId = new Map(Object.entries(registry.agents))

    // Ensure main exists
    if (!byId.has('main')) {
      byId.set('main', {
        id: 'main',
        name: 'Main',
        workspacePath: getDefaultOpenClawWorkspaceRoot(),
      })
    }

    return Array.from(byId.values())
      .map((agent) => ({
        ...agent,
        workspacePath: agent.workspacePath || this.workspacePath(agent.id),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  async createAgent(params: {
    id: string
    name: string
    mode: AgentCreateMode
    defaultModel?: string
  }): Promise<AgentSummary> {
    const id = sanitizeAgentId(params.id)
    if (!id) throw new Error('Agent id is required')
    if (id === 'main') throw new Error('main is reserved')

    const registry = await this.readRegistry()
    if (registry.agents[id]) {
      throw new Error('Agent already exists')
    }

    const workspace = this.workspacePath(id)
    await fs.mkdir(workspace, { recursive: true })

    if (params.mode === 'inherit') {
      await this.copyPersonaFiles(getDefaultOpenClawWorkspaceRoot(), workspace)
    } else {
      await this.writePersonaTemplates(workspace, params.name)
    }

    const entry: AgentSummary = {
      id,
      name: params.name.trim() || id,
      workspacePath: workspace,
      defaultModel: params.defaultModel?.trim() || undefined,
      createdAt: Date.now(),
    }

    registry.agents[id] = entry
    await this.writeRegistry(registry)

    return entry
  }

  async deleteAgent(agentId: string): Promise<void> {
    const id = agentId.trim()
    if (!id || id === 'main') {
      throw new Error('Cannot delete main agent')
    }

    const registry = await this.readRegistry()
    delete registry.agents[id]
    await this.writeRegistry(registry)

    const agentDir = path.join(this.agentsRoot(), id)
    await fs.rm(agentDir, { recursive: true, force: true })
  }

  async updateDefaultModel(agentId: string, model: string): Promise<AgentSummary> {
    const registry = await this.readRegistry()
    const entry = registry.agents[agentId]
    if (!entry) {
      throw new Error('Agent not found')
    }
    entry.defaultModel = model.trim()
    registry.agents[agentId] = entry
    await this.writeRegistry(registry)
    return entry
  }

  private async readRegistry(): Promise<AgentRegistry> {
    try {
      const raw = await fs.readFile(this.registryPath(), 'utf-8')
      const parsed = JSON.parse(raw) as AgentRegistry
      return {
        agents: parsed?.agents && typeof parsed.agents === 'object' ? parsed.agents : {},
      }
    } catch {
      return { agents: {} }
    }
  }

  private async writeRegistry(registry: AgentRegistry): Promise<void> {
    await fs.mkdir(path.dirname(this.registryPath()), { recursive: true })
    await fs.writeFile(this.registryPath(), JSON.stringify(registry, null, 2), 'utf-8')
  }

  private async copyPersonaFiles(sourceWorkspace: string, targetWorkspace: string): Promise<void> {
    await fs.mkdir(targetWorkspace, { recursive: true })
    for (const file of PERSONA_FILES) {
      const src = path.join(sourceWorkspace, file)
      const dest = path.join(targetWorkspace, file)
      try {
        await fs.copyFile(src, dest)
      } catch {
        // ignore missing persona file
      }
    }
  }

  private async writePersonaTemplates(workspace: string, name: string): Promise<void> {
    const templates: Record<string, string> = {
      'SOUL.md': `# SOUL\n\nYou are ${name}.\n`,
      'AGENTS.md': `# AGENTS\n\n- name: ${name}\n`,
      'IDENTITY.md': `# IDENTITY\n\nName: ${name}\n`,
      'USER.md': '# USER\n\n',
    }

    await fs.mkdir(workspace, { recursive: true })
    await Promise.all(Object.entries(templates).map(([file, content]) =>
      fs.writeFile(path.join(workspace, file), content, 'utf-8')
    ))
  }
}

function sanitizeAgentId(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
}
