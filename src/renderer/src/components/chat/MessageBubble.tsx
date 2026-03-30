import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { ChatMessage } from '../../stores/chatStore'

interface Props {
  message: ChatMessage
}

export function MessageBubble({ message }: Props): React.ReactElement {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.state === 'streaming'
  const isError = message.state === 'error' || message.state === 'aborted'
  const isSending = message.state === 'sending'
  const isTool = message.kind === 'tool_call' || message.kind === 'tool_result'

  if (isSystem || isTool) {
    return (
      <div className="flex justify-center">
        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs border ${
          isTool
            ? 'bg-zinc-900 text-zinc-300 border-zinc-700'
            : 'bg-zinc-950 text-zinc-400 border-zinc-800'
        }`}>
          <pre className="whitespace-pre-wrap font-sans break-words m-0">{message.content}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} ${isSending ? 'opacity-70' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs text-white shrink-0 mt-1">
          AI
        </div>
      )}

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-violet-600 text-white rounded-tr-sm'
            : isError
            ? 'bg-red-950 text-red-300 border border-red-800 rounded-tl-sm'
            : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
        }`}
      >
        {isUser || isError ? (
          <pre className="whitespace-pre-wrap font-sans break-words m-0">{message.content}</pre>
        ) : (
          <div className="chat-markdown break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={{
                code(props) {
                  const { className, children, ...rest } = props
                  const match = /language-(\w+)/.exec(className ?? '')
                  const code = String(children).replace(/\n$/, '')

                  if (!match) {
                    return (
                      <code className="chat-inline-code" {...rest}>
                        {children}
                      </code>
                    )
                  }

                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ margin: 0, background: 'transparent', padding: 0 }}
                    >
                      {code}
                    </SyntaxHighlighter>
                  )
                },
                a(props) {
                  return <a {...props} target="_blank" rel="noreferrer" />
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 animate-pulse rounded-sm" />
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300 shrink-0 mt-1">
          U
        </div>
      )}
    </div>
  )
}
