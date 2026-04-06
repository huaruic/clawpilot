import React, { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { highlightCode } from '../../lib/shiki'

interface Props {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: Props): React.ReactElement {
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    highlightCode(code, language || 'text').then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => { cancelled = true }
  }, [code, language])

  function handleCopy(): void {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="code-block group relative my-3 overflow-hidden rounded-xl border border-border">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border bg-[hsl(var(--muted)/0.5)] px-4 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      {html ? (
        <div
          className="shiki-container overflow-x-auto p-4 text-[13px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        // Fallback while shiki loads
        <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
          <code className="font-mono">{code}</code>
        </pre>
      )}
    </div>
  )
}

/**
 * Inline code — simple styled span, no highlighting.
 */
export function InlineCode({
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>): React.ReactElement {
  return (
    <code className="chat-inline-code" {...props}>
      {children}
    </code>
  )
}
