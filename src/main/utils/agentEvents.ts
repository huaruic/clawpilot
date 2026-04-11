/**
 * Return the first non-empty trimmed string among the given candidates.
 * Shared helper for extracting text fields out of loosely typed agent
 * event payloads.
 */
export function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/**
 * Single source of truth for reading a user-facing error message out of an
 * agent event's `data` payload.
 *
 * OpenClaw's lifecycle `phase: "error"` events put the friendly error text in
 * `data.error` (see compact-*.js handleAgentEnd → emitLifecycleTerminal).
 * Some other error surfaces use `data.reason` or `data.message`. Keeping all
 * three reads in one function means a field rename upstream is a one-line
 * change here, not a hunt through normalization + logging paths.
 *
 * Returns an empty string when no candidate is populated; callers supply
 * their own fallback (e.g. 'Agent failed before reply' for UI, 'Agent failed'
 * for logs).
 */
export function extractAgentErrorMessage(
  data: Record<string, unknown> | undefined,
): string {
  if (!data) return ''
  return firstString(data.error, data.reason, data.message)
}
