import PhaseStub from '../components/PhaseStub'

export default function Assistant() {
  return (
    <PhaseStub
      title="AI Assistant"
      subtitle="Ask questions about your own finances"
      phase={7}
      building={[
        "Answers grounded in your real transaction aggregates",
        "Gemini when configured, rule-based engine as fallback",
        "Never invents transaction history",
      ]}
    />
  )
}
