import PhaseStub from '../components/PhaseStub'

export default function Transactions() {
  return (
    <PhaseStub
      title="Transactions"
      subtitle="Every income and expense entry"
      phase={4}
      building={[
        "Add, edit and delete transactions",
        "Search by description; filter by category, type and date range",
        "AI category suggestion with a confidence badge (Phase 5)",
      ]}
    />
  )
}
