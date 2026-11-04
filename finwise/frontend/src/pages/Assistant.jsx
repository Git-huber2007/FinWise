import { AlertCircle, Bot, Info, Send, Sparkles, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { api } from '../api'
import { Badge, Button, Card, PageHeader } from '../components/ui'

/**
 * FINWISE AI Assistant.
 *
 * Every answer is labelled with the engine that produced it, so "the AI said
 * so" is never ambiguous: a reply from the built-in rule engine says so
 * plainly rather than passing itself off as the model.
 */
export default function Assistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    api.get('/api/ai/chat/starters').then(setMeta).catch(() => {})
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function send(text) {
    const question = (text ?? input).trim()
    if (!question || busy) return

    setMessages((m) => [...m, { role: 'user', text: question }])
    setInput('')
    setBusy(true)

    try {
      const reply = await api.post('/api/ai/chat', { message: question })
      setMessages((m) => [...m, { role: 'assistant', ...reply }])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          answer: err.message,
          failed: true,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="FINWISE AI Assistant"
        subtitle="Ask about your own finances — answers come from your recorded transactions"
        action={
          meta && (
            <Badge tone={meta.llm_configured ? 'brand' : 'neutral'}>
              {meta.llm_configured ? 'Gemini connected' : 'Built-in engine'}
            </Badge>
          )
        }
      />

      <Card className="flex h-[calc(100vh-15rem)] min-h-[460px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && <Welcome meta={meta} onPick={send} />}

          {messages.map((message, index) =>
            message.role === 'user' ? (
              <UserBubble key={index} text={message.text} />
            ) : (
              <AssistantBubble key={index} message={message} onPick={send} />
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs muted">
              <Bot size={15} />
              <span className="flex gap-1">
                <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
          className="flex items-end gap-2 border-t border-ink-200 p-4 dark:border-ink-800"
        >
          <textarea
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter makes a new line.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            placeholder="Ask about your spending, budgets or savings…"
            aria-label="Ask the assistant"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-ink-200
              bg-white px-3 py-2.5 text-sm placeholder:text-ink-400 focus:border-brand-500
              dark:border-ink-800 dark:bg-ink-950"
          />
          <Button type="submit" loading={busy} disabled={!input.trim()}>
            <Send size={15} />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </Card>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed muted">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          {meta?.disclaimer ||
            'FINWISE AI is an educational project. This is general information based on the transactions you have recorded, not financial advice.'}
        </span>
      </p>
    </>
  )
}

function Dot({ delay = '0ms' }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400"
      style={{ animationDelay: delay }}
    />
  )
}

function Welcome({ meta, onPick }) {
  return (
    <div className="py-6 text-center">
      <Bot size={26} className="mx-auto text-brand-400" />
      <p className="mt-3 text-sm font-medium">Ask me about your finances</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed muted">
        I answer from the transactions, budgets and goals you have recorded here. I will
        not invent figures, and I will tell you when something is not recorded yet.
      </p>

      <div className="mx-auto mt-5 flex max-w-lg flex-wrap justify-center gap-2">
        {(meta?.suggestions ?? []).map((question) => (
          <button
            key={question}
            onClick={() => onPick(question)}
            className="rounded-full border border-ink-200 px-3 py-1.5 text-xs transition
              hover:border-brand-500 hover:text-brand-400 dark:border-ink-800"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end gap-2.5">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-500 px-3.5 py-2.5 text-sm text-white">
        {text}
      </div>
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-200 dark:bg-ink-800">
        <User size={14} />
      </div>
    </div>
  )
}

function AssistantBubble({ message, onPick }) {
  const fromModel = message.source === 'gemini'

  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-400">
        <Bot size={14} />
      </div>

      <div className="max-w-[85%] space-y-2">
        <div
          className={`rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed ${
            message.failed
              ? 'bg-neg/10 text-neg'
              : 'bg-ink-100 dark:bg-ink-800/70'
          }`}
        >
          {message.answer}
        </div>

        {/* The engine that answered is always shown. A rule-engine reply must
            not be mistaken for a model one, or vice versa. */}
        {!message.failed && message.source && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={fromModel ? 'brand' : 'neutral'}>
              {fromModel ? (
                <>
                  <Sparkles size={10} /> Gemini
                </>
              ) : (
                'Built-in engine'
              )}
            </Badge>
            {message.used_your_data && <Badge tone="positive">from your data</Badge>}
          </div>
        )}

        {message.notice && (
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-warn">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {message.notice}
          </p>
        )}

        {message.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.suggestions.map((question) => (
              <button
                key={question}
                onClick={() => onPick(question)}
                className="rounded-full border border-ink-200 px-2.5 py-1 text-[11px] transition
                  hover:border-brand-500 hover:text-brand-400 dark:border-ink-800"
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
