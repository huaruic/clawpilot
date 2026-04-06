/**
 * Routing Profile Type Definitions
 *
 * A RoutingProfile connects Channels to Providers — it decides
 * "which model processes messages from which channel".
 *
 * Architecture:
 *   Channel --route--> RoutingProfile --modelRef--> Provider
 *
 * The `routing` block in openclaw.json is Paris-specific.
 * RoutingService translates it into `agents.list` + `bindings`
 * that the Gateway understands natively.
 */

export interface RoutingProfile {
  /** Slug identifier, e.g. "default", "support-bot" */
  id: string
  /** Display name, e.g. "Customer Support" */
  name: string
  /**
   * Model reference in "provider/model" format, e.g. "anthropic/claude-opus-4-6".
   * null means inherit the global default (agents.defaults.model.primary).
   */
  modelRef: string | null
  /** Whether workspace bootstrap files (SOUL.md etc.) were copied from the main agent */
  inheritWorkspace: boolean
  /** Workspace directory path. Defaults to ~/.openclaw/workspace-{id} */
  workspacePath?: string
  createdAt: string
  updatedAt: string
}

export interface ChannelRoute {
  /** Channel type, e.g. "telegram", "discord" */
  channelType: string
  /** Account identifier within the channel, e.g. "default", "main" */
  accountId: string
  /** Which RoutingProfile handles messages from this channel+account */
  profileId: string
}

export interface RoutingSnapshot {
  profiles: RoutingProfile[]
  routes: ChannelRoute[]
  /** The profile that receives unrouted channel messages */
  defaultProfileId: string
  /** Global default model from agents.defaults.model.primary */
  globalModelRef: string | null
}

export interface CreateProfileInput {
  name: string
  /** "provider/model" format. Omit or undefined to inherit global default. */
  modelRef?: string
  /** Default true — copy SOUL.md etc. from the main workspace */
  inheritWorkspace?: boolean
  /** Bind channels during creation (one-step setup) */
  channelBindings?: Array<{
    channelType: string
    accountId: string
  }>
}

export interface UpdateProfileInput {
  name?: string
  /** Set to null to clear override and inherit global default */
  modelRef?: string | null
}
