import PhaseStub from '../components/PhaseStub'

export default function Health() {
  return (
    <PhaseStub
      title="Financial Health"
      subtitle="A transparent checkup, not a credit score"
      phase={6}
      building={[
        "Score out of 100 with every weight shown",
        "Strengths, weaknesses and spending warnings",
        "Suggested savings target and a monthly improvement plan",
      ]}
    />
  )
}
