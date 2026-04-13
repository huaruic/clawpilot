import { describe, expect, it } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { _testExports } from '../skills.ipc'

const {
  extractFrontmatter,
  readFrontmatterValue,
  readMetadataEmoji,
  unquote,
  escapeRegExp,
  resolveUserPath,
} = _testExports

describe('extractFrontmatter', () => {
  it('extracts YAML block between --- markers', () => {
    const raw = `---\nname: test-skill\ndescription: A test\n---\n# Body`
    expect(extractFrontmatter(raw)).toBe('name: test-skill\ndescription: A test')
  })

  it('returns empty string when no frontmatter markers', () => {
    expect(extractFrontmatter('# Just a heading')).toBe('')
  })

  it('returns empty string when missing closing marker', () => {
    expect(extractFrontmatter('---\nname: broken')).toBe('')
  })

  it('handles Windows-style line endings', () => {
    const raw = '---\r\nname: win-skill\r\n---\r\nBody'
    expect(extractFrontmatter(raw)).toBe('name: win-skill')
  })

  it('returns empty string for empty input', () => {
    expect(extractFrontmatter('')).toBe('')
  })
})

describe('readFrontmatterValue', () => {
  const fm = 'name: my-skill\ndescription: Does things\nhomepage: https://example.com'

  it('reads a simple key-value pair', () => {
    expect(readFrontmatterValue(fm, 'name')).toBe('my-skill')
  })

  it('reads description value', () => {
    expect(readFrontmatterValue(fm, 'description')).toBe('Does things')
  })

  it('reads URL value', () => {
    expect(readFrontmatterValue(fm, 'homepage')).toBe('https://example.com')
  })

  it('returns null for missing key', () => {
    expect(readFrontmatterValue(fm, 'missing')).toBeNull()
  })

  it('trims whitespace from values', () => {
    expect(readFrontmatterValue('key:   spaced value  ', 'key')).toBe('spaced value')
  })
})

describe('readMetadataEmoji', () => {
  it('extracts emoji from JSON-style metadata', () => {
    const fm = 'metadata: {"emoji": "rocket"}'
    expect(readMetadataEmoji(fm)).toBe('rocket')
  })

  it('returns null when no emoji metadata', () => {
    expect(readMetadataEmoji('name: test')).toBeNull()
  })
})

describe('unquote', () => {
  it('removes double quotes', () => {
    expect(unquote('"hello"')).toBe('hello')
  })

  it('removes single quotes', () => {
    expect(unquote("'hello'")).toBe('hello')
  })

  it('leaves unquoted strings as-is', () => {
    expect(unquote('hello')).toBe('hello')
  })

  it('trims whitespace before unquoting', () => {
    expect(unquote('  "padded"  ')).toBe('padded')
  })

  it('does not unquote mismatched quotes', () => {
    expect(unquote('"mismatched\'')).toBe('"mismatched\'')
  })
})

describe('escapeRegExp', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegExp('hello.world')).toBe('hello\\.world')
  })

  it('escapes brackets and parens', () => {
    expect(escapeRegExp('a[b](c)')).toBe('a\\[b\\]\\(c\\)')
  })

  it('leaves plain strings unchanged', () => {
    expect(escapeRegExp('simple')).toBe('simple')
  })
})

describe('resolveUserPath', () => {
  it('expands ~ to home directory', () => {
    expect(resolveUserPath('~')).toBe(os.homedir())
  })

  it('expands ~/ prefix', () => {
    expect(resolveUserPath('~/Documents')).toBe(path.join(os.homedir(), 'Documents'))
  })

  it('resolves relative paths', () => {
    const result = resolveUserPath('relative/path')
    expect(path.isAbsolute(result)).toBe(true)
  })

  it('returns empty string for empty input', () => {
    expect(resolveUserPath('')).toBe('')
  })

  it('trims whitespace', () => {
    expect(resolveUserPath('  ~  ')).toBe(os.homedir())
  })
})
