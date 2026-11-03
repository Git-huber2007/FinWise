import PhaseStub from '../components/PhaseStub'

export default function Reports() {
  return (
    <PhaseStub
      title="Reports"
      subtitle="Monthly summaries you can keep"
      phase={9}
      building={[
        "Income, expense, savings and category breakdowns",
        "Month-to-month comparison",
        "Download as PDF, export transactions as CSV",
      ]}
    />
  )
}
