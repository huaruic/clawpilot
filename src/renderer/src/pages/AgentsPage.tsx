import React, { useEffect, useState } from 'react'
import type { AgentInfo } from '../api/ipc'

export function AgentsPage(): React.ReactElement {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    id: '',
    name: '',
    mode: 'inherit' as 'inherit' | 'generate',
    defaultModel: '',
  })

  useEffect(() => {
    void load()
  }, [])

  async function load(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const list = await window.clawpilot.agents.list()
      setAgents(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(): Promise<void> {
    if (!form.id.trim() || !form.name.trim()) return
    setCreating(true)
    setError(null)
    try {
      await window.clawpilot.agents.create({
        id: form.id,
        name: form.name,
        mode: form.mode,
        defaultModel: form.defaultModel.trim() ? form.defaultModel.trim() : undefined,
      })
      setForm({ id: '', name: '', mode: 'inherit', defaultModel: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(agent: AgentInfo): Promise<void> {
    const confirmed = window.confirm(`Delete agent ${agent.name}? This removes its workspace folder.`)
    if (!confirmed) return
    try {
      await window.clawpilot.agents.delete({ id: agent.id })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleUpdateModel(agent: AgentInfo, model: string): Promise<void> {
    try {
      await window.clawpilot.agents.updateModel({ id: agent.id, model })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCopyPath(path: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(path)
    } catch {
      // ignore
    }
  }

  async function handleOpenPath(path: string): Promise<void> {
    await window.clawpilot.app.openPath(path)
  }

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage multi-agent workspaces and defaults for OpenClaw.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">Create Agent</h2>
          <p className="mt-1 text-sm text-zinc-500">Create a new agent with a fixed workspace under ClawPilot.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-zinc-400">
            Agent ID
            <input
              value={form.id}
              onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))}
              placeholder="sales-bot"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Display Name
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Sales Bot"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Persona Source
            <select
              value={form.mode}
              onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as 'inherit' | 'generate' }))}
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
            >
              <option value="inherit">Inherit from main workspace</option>
              <option value="generate">Generate default persona files</option>
            </select>
          </label>
          <label className="text-sm text-zinc-400">
            Default Model (optional)
            <input
              value={form.defaultModel}
              onChange={(event) => setForm((prev) => ({ ...prev, defaultModel: event.target.value }))}
              placeholder="provider/model"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => void handleCreate()}
            disabled={creating || !form.id.trim() || !form.name.trim()}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
          >
            {creating ? 'Creating…' : 'Create Agent'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h2 className="text-lg font-medium text-zinc-100">Existing Agents</h2>
        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-400">
            Loading agents...
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-400">
            No agents yet.
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-medium text-zinc-100">{agent.name}</div>
                    <div className="text-xs text-zinc-500 mt-1">ID: {agent.id}</div>
                    <div className="mt-3 text-xs text-zinc-500">Workspace</div>
                    <div className="text-sm text-zinc-200 font-mono break-all">{agent.workspacePath}</div>
                    <div className="mt-3 text-xs text-zinc-500">Default Model</div>
                    <div className="text-sm text-zinc-200 font-mono break-all">
                      {agent.defaultModel || 'Not set'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => void handleCopyPath(agent.workspacePath)}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                    >
                      Copy Path
                    </button>
                    <button
                      onClick={() => void handleOpenPath(agent.workspacePath)}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                    >
                      Open Folder
                    </button>
                    {agent.id !== 'main' && (
                      <button
                        onClick={() => void handleDelete(agent)}
                        className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    defaultValue={agent.defaultModel ?? ''}
                    placeholder="provider/model"
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleUpdateModel(agent, (event.target as HTMLInputElement).value)
                      }
                    }}
                  />
                  <button
                    onClick={(event) => {
                      const input = (event.currentTarget.previousElementSibling as HTMLInputElement | null)
                      if (!input) return
                      void handleUpdateModel(agent, input.value)
                    }}
                    className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                  >
                    Save Model
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
