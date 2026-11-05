import { AlertCircle, ArrowUpRight, Info, Send, Terminal } from 'lucide-react'
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
        title="Query Ledger"
        subtitle="Interrogate your recorded transactions, budget headroom, and savings trajectory"
        action={
          meta && (
            <Badge tone="neutral">
              {meta.llm_configured ? 'Engine: Gemini + Ledger Math' : 'Engine: Deterministic Rules'}
            </Badge>
          )
        }
      />

      <Card className="flex h-[calc(100dvh-13rem)] min-h-[480px] flex-col overflow-hidden">
        <div className="flex-1 divide-y divide-ink-200/70 overflow-y-auto dark:divide-[#222220]">
          {messages.length === 0 && <Welcome meta={meta} onPick={send} />}

          {messages.map((message, index) =>
            message.role === 'user' ? (
              <QueryRow key={index} text={message.text} />
            ) : (
              <ResponseRow key={index} message={message} onPick={send} />
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2.5 px-6 py-4 font-mono text-xs muted">
              <span className="size-2 rounded-full bg-ink-400 animate-pulse" />
              <span>Computing response from ledger entries…</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
          className="flex items-end gap-2 border-t border-ink-200 bg-[#F3F1EC] p-3.5 dark:border-[#242421] dark:bg-[#161614]"
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
            placeholder="Enter a financial query (e.g., Where did my money go this month?)…"
            aria-label="Query the ledger"
            className="max-h-32 min-h-[38px] flex-1 resize-none rounded-md border border-ink-300
              bg-white px-3 py-2 text-sm placeholder:text-ink-400 transition-colors
              focus:border-ink-900 focus:outline-none focus:ring-1 focus:ring-ink-900
              dark:border-[#2E2E2A] dark:bg-[#0E0E0D] dark:text-ink-100 dark:focus:border-ink-200"
          />
          <Button type="submit" size="lg" loading={busy} disabled={!input.trim()}>
            <Send size={13} />
            <span>Run Query</span>
          </Button>
        </form>
      </Card>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed muted">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          {meta?.disclaimer ||
            'FinWise is an educational accounting tool. Responses are derived strictly from recorded ledger entries and do not constitute financial advice.'}
        </span>
      </p>
    </>
  )
}

function Welcome({ meta, onPick }) {
  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-xl">
        <div className="inline-flex items-center gap-2 font-mono text-xs font-medium text-ink-900 dark:text-ink-100">
          <Terminal size={14} />
          <span>Direct Ledger Interrogation</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed muted">
          Select a structured query below or type a question in plain English. Every figure returned
          is calculated directly from your recorded inflows, outflows, and category limits.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {(meta?.suggestions ?? []).map((question) => (
            <button
              key={question}
              onClick={() => onPick(question)}
              className="flex items-center justify-between gap-2 rounded-md border border-ink-200 bg-[#FAF9F6] px-3.5 py-2.5 text-left text-xs font-medium text-ink-800
                hover:border-ink-400 hover:bg-white dark:border-[#282825] dark:bg-[#161614] dark:text-ink-200 dark:hover:border-[#3A3A35] transition-colors group"
            >
              <span className="truncate">{question}</span>
              <ArrowUpRight
                size={13}
                className="shrink-0 text-ink-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function QueryRow({ text }) {
  return (
    <div className="bg-[#FAF9F6] px-6 py-4 dark:bg-[#161614]">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] uppercase muted shrink-0 w-16">Query</span>
        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{text}</p>
      </div>
    </div>
  )
}

function ResponseRow({ message, onPick }) {
  const fromModel = message.source === 'gemini'

  return (
    <div className="px-6 py-5 bg-white dark:bg-[#121211]">
      <div className="flex items-start gap-3">
        <span className="font-mono text-[10px] uppercase muted shrink-0 w-16 pt-0.5">Result</span>
        <div className="min-w-0 flex-1 space-y-3">
          <div
            className={`text-sm leading-relaxed whitespace-pre-line ${
              message.failed
                ? 'text-neg'
                : 'text-ink-900 dark:text-ink-100'
            }`}
          >
            {message.answer}
          </div>

          {!message.failed && message.source && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">
                {fromModel ? 'Gemini + Ledger Context' : 'Deterministic Rule Engine'}
              </Badge>
              {message.used_your_data && <Badge tone="positive">Verified against ledger</Badge>}
            </div>
          )}

          {message.notice && (
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-warn">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              {message.notice}
            </p>
          )}

          {message.suggestions?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {message.suggestions.map((question) => (
                <button
                  key={question}
                  onClick={() => onPick(question)}
                  className="rounded border border-ink-200 bg-[#FAF9F6] px-2.5 py-1 text-[11px] text-ink-700
                    hover:border-ink-400 hover:text-ink-900 dark:border-[#282825] dark:bg-[#181816] dark:text-ink-300 dark:hover:text-white transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
