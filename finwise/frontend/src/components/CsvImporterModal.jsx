import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Tag,
  Upload,
} from 'lucide-react'
import { useState } from 'react'

import { api } from '../api'
import { Badge, Button, Modal } from './ui'
import { money, moneyExact } from '../format'

const SAMPLE_CSV = `Date,Description,Amount,Type
2026-10-18,Swiggy food order,420.00,Debit
2026-10-19,Monthly salary credit,52000.00,Credit
2026-10-20,BESCOM electricity bill,1250.00,Debit
2026-10-21,Uber ride to office,280.00,Debit
2026-10-22,Apollo pharmacy medicines,650.00,Debit`

export default function CsvImporterModal({ open, onClose, onImported }) {
  const [csvText, setCsvText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState(null)

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setCsvText(event.target?.result || '')
      setError(null)
    }
    reader.readAsText(file)
  }

  async function handlePreview() {
    if (!csvText.trim()) {
      setError('Please select a CSV file or paste statement text.')
      return
    }
    setParsing(true)
    setError(null)
    try {
      const res = await api.post('/api/import/preview', { csv_text: csvText })
      setPreview(res)
    } catch (err) {
      setError(err.message || 'Failed to parse CSV statement.')
    } finally {
      setParsing(false)
    }
  }

  async function handleCommit() {
    if (!preview?.rows?.length) return
    setCommitting(true)
    try {
      const res = await api.post('/api/import/commit', { rows: preview.rows })
      onImported?.(res.imported_count)
      onClose()
      setPreview(null)
      setCsvText('')
    } catch (err) {
      setError(err.message || 'Failed to import transactions.')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose()
        setPreview(null)
        setError(null)
      }}
      title="Import Bank Statement (CSV)"
    >
      <div className="space-y-4 p-5">
        {!preview ? (
          <>
            <p className="text-xs text-ink-700 dark:text-ink-300">
              Upload your bank or card statement CSV. Descriptions will be classified locally
              using the Scikit-Learn categorizer before being added to your ledger.
            </p>

            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-ink-300/80 p-6 text-center dark:border-[#2E2E2A]">
              <FileSpreadsheet size={28} className="text-ink-400" />
              <label className="mt-3 cursor-pointer">
                <span className="rounded bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900">
                  Select CSV File
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="mt-2 text-[11px] muted">Supports HDFC, ICICI, SBI, Axis, Cred, or custom CSVs</p>
            </div>

            <div>
              <div className="flex items-center justify-between pb-1">
                <span className="font-mono text-[11px] uppercase muted">Or Paste CSV Text Directly</span>
                <button
                  type="button"
                  onClick={() => setCsvText(SAMPLE_CSV)}
                  className="font-mono text-[11px] text-ink-600 hover:underline dark:text-ink-400"
                >
                  Load Sample
                </button>
              </div>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Date,Description,Amount,Type&#10;2026-10-18,Swiggy food order,420.00,Debit"
                className="w-full font-mono text-xs rounded-md border border-ink-300 bg-white p-2.5 dark:border-[#2E2E2A] dark:bg-[#121211] dark:text-ink-100"
              />
            </div>

            {error && <p className="text-xs text-neg">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-ink-200/90 pt-3 dark:border-[#242421]">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handlePreview} loading={parsing} disabled={!csvText.trim()}>
                Preview & Classify Entries
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-ink-900 dark:text-ink-100">
                  {preview.total_parsed} Transactions Parsed
                </p>
                <p className="text-[11px] muted">
                  Review categories predicted by the local model before committing:
                </p>
              </div>
              {preview.duplicates_flagged > 0 && (
                <Badge tone="warning">
                  {preview.duplicates_flagged} possible duplicate(s)
                </Badge>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-ink-200/80 rounded border border-ink-200/90 text-xs dark:divide-[#242421] dark:border-[#242421]">
              {preview.rows.map((row, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-ink-50/50 dark:hover:bg-[#161614]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-900 dark:text-ink-100">{row.description}</span>
                      {row.is_duplicate && (
                        <span className="font-mono text-[9px] text-warn font-semibold">
                          (DUPLICATE)
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[10px] muted">
                      {row.date} · {row.txn_type}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded bg-ink-100 px-2 py-0.5 font-mono text-[10px] text-ink-800 dark:bg-[#20201D] dark:text-ink-200">
                      <Tag size={10} />
                      {row.category} ({Math.round(row.confidence * 100)}%)
                    </span>
                    <span className={`font-mono font-medium ${row.txn_type === 'income' ? 'text-pos' : 'text-neg'}`}>
                      {money(row.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-neg">{error}</p>}

            <div className="flex justify-between border-t border-ink-200/90 pt-3 dark:border-[#242421]">
              <Button variant="ghost" onClick={() => setPreview(null)}>
                ← Back
              </Button>
              <Button onClick={handleCommit} loading={committing} className="gap-1.5">
                <Check size={14} />
                <span>Confirm & Import ({preview.total_parsed})</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
