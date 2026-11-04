import { AlertCircle, Bot, Info, Send, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { api } from '../api'
import { Badge, Button, Card, PageHeader } from '../components/ui'

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
        title="Financial Assistant"
        subtitle="Ask questions about your finances — answers are calculated from your recorded transactions"
        action={
          meta && (
            <Badge tone={meta.llm_configured ? 'brand' : 'neutral'}>
              {meta.llm_configured ? 'Gemini connected' : 'Rule-based engine'}
            </Badge>
          )
        }
      />

      <Card className="flex h-[calc(100vh-14rem)] min-h-[480px] flex-col">
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
            <div className="flex items-center gap-2 text-xs muted pl-1">
              <Bot size={15} />
              <span className="flex items-center gap-1">
                Thinking <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
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
          className="flex items-end gap-2 border-t border-ink-200 bg-ink-50/50 p-3.5 dark:border-ink-800 dark:bg-ink-900/50"
        >
          <textarea
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            placeholder="Ask about your spending, budget deficits, or savings goals…"
            aria-label="Ask the assistant"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-ink-200
              bg-white px-3 py-2 text-sm placeholder:text-ink-400 shadow-subtle transition-colors
              focus:border-brand-500 focus:ring-1 focus:ring-brand-500
              dark:border-ink-700 dark:bg-[#0D0E12] dark:text-ink-100"
          />
          <Button type="submit" loading={busy} disabled={!input.trim()}>
            <Send size={14} />
            <span>Send</span>
          </Button>
        </form>
      </Card>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed muted">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          {meta?.disclaimer ||
            'FINWISE is an educational project. Information is derived from recorded transactions and is not professional financial advice.'}
        </span>
      </p>
    </>
  )
}

function Dot({ delay = '0ms' }) {
  return (
    <span
      className="inline-block h-1 w-1 animate-bounce rounded-full bg-ink-400"
      style={{ animationDelay: delay }}
    />
  )
}

function Welcome({ meta, onPick }) {
  return (
    <div className="py-8 text-center max-w-lg mx-auto">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300 mb-3">
        <Bot size={20} />
      </div>
      <p className="text-sm font-semibold text-ink-900 dark:text-white">Ask about your finances</p>
      <p className="mt-1 text-xs leading-relaxed muted">
        Answers are computed directly from the transactions, budgets, and savings goals you have
        recorded. No figures are estimated or invented.
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {(meta?.suggestions ?? []).map((question) => (
          <button
            key={question}
            onClick={() => onPick(question)}
            className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 shadow-subtle
              hover:border-ink-400 hover:text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:text-white transition-colors"
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
      <div className="max-w-[80%] rounded-xl bg-ink-900 px-3.5 py-2.5 text-xs sm:text-sm text-white dark:bg-ink-100 dark:text-ink-900">
        {text}
      </div>
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-200 text-ink-700 text-xs font-medium dark:bg-ink-800 dark:text-ink-300">
        <User size={13} />
      </div>
    </div>
  )
}

function AssistantBubble({ message, onPick }) {
  const fromModel = message.source === 'gemini'

  return (
    <div className="flex gap-2.5">
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300">
        <Bot size={13} />
      </div>

      <div className="max-w-[85%] space-y-2">
        <div
          className={`rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed border ${
            message.failed
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
              : 'bg-white border-ink-200 text-ink-900 dark:bg-ink-850 dark:border-ink-700 dark:text-ink-100'
          }`}
        >
          {message.answer}
        </div>

        {!message.failed && message.source && (
          <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
            <Badge tone={fromModel ? 'brand' : 'neutral'}>
              {fromModel ? 'Gemini 1.5' : 'Rule engine'}
            </Badge>
            {message.used_your_data && <Badge tone="positive">from your data</Badge>}
          </div>
        )}

        {message.notice && (
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400 pl-0.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {message.notice}
          </p>
        )}

        {message.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {message.suggestions.map((question) => (
              <button
                key={question}
                onClick={() => onPick(question)}
                className="rounded-md border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-700
                  hover:border-ink-400 hover:text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:text-white transition-colors"
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
