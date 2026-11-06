import {
  ArrowDownRight,
  ArrowUpRight,
  Building,
  Coins,
  CreditCard,
  Landmark,
  Pencil,
  PieChart,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Spinner,
} from '../components/ui'
import { money, moneyExact } from '../format'

const ASSET_TYPES = [
  { value: 'bank', label: 'Bank Account' },
  { value: 'cash', label: 'Cash in Hand' },
  { value: 'investment', label: 'Mutual Funds & Stocks' },
  { value: 'retirement', label: 'Retirement (EPF/PPF/NPS)' },
  { value: 'gold', label: 'Gold & Precious Metals' },
  { value: 'property', label: 'Real Estate' },
  { value: 'other', label: 'Other Asset' },
]

const ASSET_ICONS = {
  bank: Landmark,
  cash: Wallet,
  investment: Coins,
  retirement: ShieldCheck,
  gold: Coins,
  property: Building,
  other: PieChart,
}

export default function NetWorth() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editingAsset, setEditingAsset] = useState(null)
  const [deletingAsset, setDeletingAsset] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/net-worth')
      setData(res)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSaveAsset(e) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const payload = {
      name: form.get('name')?.toString().trim(),
      asset_type: form.get('asset_type'),
      balance: form.get('balance'),
      institution: form.get('institution')?.toString().trim() || undefined,
      notes: form.get('notes')?.toString().trim() || undefined,
    }

    try {
      if (editingAsset && editingAsset.id) {
        await api.put(`/api/net-worth/assets/${editingAsset.id}`, payload)
      } else {
        await api.post('/api/net-worth/assets', payload)
      }
      setEditingAsset(null)
      await load()
    } catch (err) {
      alert(err.message || 'Failed to save asset.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAsset() {
    if (!deletingAsset) return
    setSaving(true)
    try {
      await api.del(`/api/net-worth/assets/${deletingAsset.id}`)
      setDeletingAsset(null)
      await load()
    } catch (err) {
      alert(err.message || 'Failed to delete asset.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Computing balance sheet & net worth" />
  if (error) return <ErrorState error={error} onRetry={load} />

  const { summary = {}, assets = [], debts = [], asset_allocation = [] } = data || {}
  const isPositive = summary.net_worth >= 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Net Worth & Balance Sheet"
        subtitle="Consolidated statement of your total assets, liabilities, and true wealth position."
        action={
          <Button onClick={() => setEditingAsset('new')} className="gap-2">
            <Plus size={15} />
            <span>Add Asset</span>
          </Button>
        }
      />

      {/* Top Level Metric Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 border-l-2 border-l-ink-900 dark:border-l-ink-100">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Total Net Worth</p>
          <p className={`mt-1 font-serif text-2xl font-medium ${isPositive ? 'text-ink-900 dark:text-ink-100' : 'text-neg'}`}>
            {money(summary.net_worth || 0)}
          </p>
          <p className="mt-1 text-[11px] muted">Assets minus liabilities</p>
        </Card>

        <Card className="p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Total Assets</p>
          <p className="mt-1 font-serif text-2xl font-medium text-pos">
            {money(summary.total_assets || 0)}
          </p>
          <p className="mt-1 text-[11px] muted">Across {summary.asset_count ?? 0} holdings</p>
        </Card>

        <Card className="p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Total Liabilities</p>
          <p className="mt-1 font-serif text-2xl font-medium text-neg">
            {money(summary.total_liabilities || 0)}
          </p>
          <p className="mt-1 text-[11px] muted">Across {summary.debt_count ?? 0} obligations</p>
        </Card>

        <Card className="p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Liquid Reserves</p>
          <p className="mt-1 font-serif text-2xl font-medium text-ink-900 dark:text-ink-100">
            {money(summary.liquid_assets || 0)}
          </p>
          <p className="mt-1 text-[11px] muted">Cash & accessible bank funds</p>
        </Card>
      </div>

      {/* Asset Allocation Breakdown */}
      {asset_allocation.length > 0 && (
        <Card className="p-5">
          <CardHeader
            title="Asset Distribution"
            subtitle="Portfolio allocation across liquid, invested, and retirement asset classes"
          />
          <div className="mt-4 space-y-3">
            {asset_allocation.map((item) => (
              <div key={item.type}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-ink-900 dark:text-ink-100">
                    {item.type.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-ink-700 dark:text-ink-300">
                    {money(item.amount)} <span className="muted">({item.share_pct}%)</span>
                  </span>
                </div>
                <ProgressBar value={item.share_pct} className="mt-1.5" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Assets & Liabilities Split Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Assets Table */}
        <Card>
          <CardHeader
            title="Assets & Holdings"
            subtitle={`${assets.length} recorded accounts`}
            action={
              <Button size="xs" variant="secondary" onClick={() => setEditingAsset('new')}>
                + Add Asset
              </Button>
            }
          />
          {assets.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No assets recorded"
              body="Record your savings accounts, mutual funds, EPF, and fixed deposits."
              action={
                <Button size="sm" onClick={() => setEditingAsset('new')}>
                  Add first asset
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-ink-200/80 dark:divide-[#242421]">
              {assets.map((asset) => {
                const Icon = ASSET_ICONS[asset.asset_type] || PieChart
                return (
                  <div key={asset.id} className="flex items-center justify-between p-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="rounded border border-ink-200/80 bg-ink-50 p-2 text-ink-700 dark:border-[#2E2E2A] dark:bg-[#1A1A18] dark:text-ink-300">
                        <Icon size={14} />
                      </div>
                      <div>
                        <p className="font-medium text-ink-900 dark:text-ink-100">{asset.name}</p>
                        <p className="mt-0.5 text-[11px] muted">
                          <span className="capitalize">{asset.asset_type}</span>
                          {asset.institution && ` · ${asset.institution}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium text-pos text-sm">
                        {money(asset.balance)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingAsset(asset)}
                          className="rounded p-1 text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAsset(asset)}
                          className="rounded p-1 text-ink-500 hover:text-neg"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Liabilities Table */}
        <Card>
          <CardHeader
            title="Liabilities & Debts"
            subtitle={`${debts.length} active commitments`}
          />
          {debts.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No liabilities recorded"
              body="Credit cards and loans appear here automatically from your Debt Planner."
            />
          ) : (
            <div className="divide-y divide-ink-200/80 dark:divide-[#242421]">
              {debts.map((debt) => (
                <div key={debt.id} className="flex items-center justify-between p-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="rounded border border-ink-200/80 bg-ink-50 p-2 text-neg dark:border-[#2E2E2A] dark:bg-[#1A1A18]">
                      <CreditCard size={14} />
                    </div>
                    <div>
                      <p className="font-medium text-ink-900 dark:text-ink-100">{debt.name}</p>
                      <p className="mt-0.5 text-[11px] muted">
                        <span className="capitalize">{debt.debt_type.replace('_', ' ')}</span>
                        {debt.interest_rate > 0 && ` · ${debt.interest_rate}% APR`}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="font-mono font-medium text-neg text-sm">
                      {money(debt.current_balance)}
                    </span>
                    <p className="font-mono text-[10px] text-right muted">
                      EMI: {money(debt.minimum_payment)}/mo
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Add / Edit Asset Modal */}
      <Modal
        open={Boolean(editingAsset)}
        onClose={() => setEditingAsset(null)}
        title={editingAsset?.id ? `Edit ${editingAsset.name}` : 'Add New Asset'}
      >
        <form onSubmit={handleSaveAsset} className="space-y-4 p-5">
          <Field label="Asset Name" required>
            <Input
              name="name"
              defaultValue={editingAsset?.name || ''}
              placeholder="e.g. HDFC Salary Account, Zerodha Mutual Funds, EPF"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset Type" required>
              <Select name="asset_type" defaultValue={editingAsset?.asset_type || 'bank'}>
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Current Balance" required>
              <Input
                name="balance"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editingAsset?.balance || ''}
                placeholder="0.00"
                required
              />
            </Field>
          </div>

          <Field label="Institution / Broker (optional)">
            <Input
              name="institution"
              defaultValue={editingAsset?.institution || ''}
              placeholder="e.g. HDFC Bank, Zerodha, SBI, EPFO"
            />
          </Field>

          <Field label="Notes (optional)">
            <Input
              name="notes"
              defaultValue={editingAsset?.notes || ''}
              placeholder="e.g. Liquid account for emergency reserve"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-3 border-t border-ink-200/90 dark:border-[#242421]">
            <Button type="button" variant="ghost" onClick={() => setEditingAsset(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingAsset?.id ? 'Save Changes' : 'Record Asset'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deletingAsset)}
        onClose={() => setDeletingAsset(null)}
        title="Delete Asset"
      >
        <div className="space-y-4 p-5">
          <p className="text-sm text-ink-800 dark:text-ink-200">
            Are you sure you want to delete <strong className="text-ink-900 dark:text-white">{deletingAsset?.name}</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-ink-200/90 dark:border-[#242421]">
            <Button variant="ghost" onClick={() => setDeletingAsset(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteAsset} loading={saving}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

