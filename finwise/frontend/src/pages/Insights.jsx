import PhaseStub from '../components/PhaseStub'

export default function Insights() {
  return (
    <PhaseStub
      title="AI Insights"
      subtitle="Patterns found in your own transactions"
      phase={6}
      building={[
        "Month-over-month movement per category",
        "Category share of total spending",
        "Concrete reduction opportunities with rupee amounts",
        "Flagged unusual transactions (Phase 8)",
      ]}
    />
  )
}
