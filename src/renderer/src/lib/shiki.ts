/**
 * Shiki highlighter singleton — lazily loaded, shared across all code blocks.
 *
 * Uses bundled web languages for fast startup. Additional languages
 * are loaded on-demand when encountered.
 */

import { createHighlighter, type Highlighter } from 'shiki'

// Common languages for AI chat code blocks
const PRELOAD_LANGS = [
  'typescript', 'javascript', 'tsx', 'jsx',
  'python', 'bash', 'shell', 'sh', 'zsh',
  'json', 'yaml', 'toml',
  'html', 'css', 'sql',
  'markdown', 'md',
  'go', 'rust', 'java', 'c', 'cpp',
  'ruby', 'php', 'swift', 'kotlin',
  'dockerfile', 'diff',
] as const

const LIGHT_THEME = 'github-light'
const DARK_THEME = 'one-dark-pro'

let highlighterPromise: Promise<Highlighter> | null = null

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [LIGHT_THEME, DARK_THEME],
      langs: [...PRELOAD_LANGS],
    })
  }
  return highlighterPromise
}

/**
 * Highlight code to HTML string.
 * Returns null if the highlighter hasn't loaded yet (caller should show plain text).
 */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const highlighter = await getHighlighter()

  // Normalize language name
  const normalizedLang = normalizeLang(lang)

  // Load language on demand if not pre-loaded
  const loadedLangs = highlighter.getLoadedLanguages()
  if (!loadedLangs.includes(normalizedLang as never)) {
    try {
      await highlighter.loadLanguage(normalizedLang as never)
    } catch {
      // Unknown language — fall back to plaintext
      return highlighter.codeToHtml(code, {
        lang: 'text',
        themes: { light: LIGHT_THEME, dark: DARK_THEME },
      })
    }
  }

  return highlighter.codeToHtml(code, {
    lang: normalizedLang,
    themes: { light: LIGHT_THEME, dark: DARK_THEME },
  })
}

// Pre-warm the highlighter on import (non-blocking)
getHighlighter().catch(() => {})

// ─── Helpers ──────────────────────────────────────────────────

const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  zsh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  objc: 'objective-c',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  kt: 'kotlin',
}

function normalizeLang(lang: string): string {
  const lower = lang.toLowerCase().trim()
  return LANG_ALIASES[lower] ?? lower
}

export { LIGHT_THEME, DARK_THEME }
