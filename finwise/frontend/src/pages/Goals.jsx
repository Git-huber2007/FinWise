import PhaseStub from '../components/PhaseStub'

export default function Goals() {
  return (
    <PhaseStub
      title="Savings Goals"
      subtitle="What you are saving for, and when you will get there"
      phase={8}
      building={[
        "Create goals with target amounts and dates",
        "Progress bars and estimated completion dates",
        "Forecasts from your actual savings history, labelled as estimates",
      ]}
    />
  )
}
