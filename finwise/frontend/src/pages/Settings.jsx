import PhaseStub from '../components/PhaseStub'

export default function Settings() {
  return (
    <PhaseStub
      title="Settings"
      subtitle="Profile and preferences"
      phase={4}
      building={[
        "Name, email and self-reported monthly income",
        "Emergency fund figure used by the health score",
        "Theme preference and alert toggles",
      ]}
    />
  )
}
