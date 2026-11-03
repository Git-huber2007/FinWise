import PhaseStub from '../components/PhaseStub'

export default function Budget() {
  return (
    <PhaseStub
      title="Budget Planner"
      subtitle="Plan the month, then track against it"
      phase={4}
      building={[
        "Set an overall monthly budget and per-category budgets",
        "Remaining budget and utilisation bars",
        "Alerts when a category approaches or exceeds its limit",
      ]}
    />
  )
}
