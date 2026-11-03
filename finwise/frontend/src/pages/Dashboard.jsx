import PhaseStub from '../components/PhaseStub'

export default function Dashboard() {
  return (
    <PhaseStub
      title="Dashboard"
      subtitle="Your financial position at a glance"
      phase={6}
      building={[
        "Income, expenses, savings and savings-rate tiles",
        "Budget utilisation and Financial Health Score",
        "Income vs expenses, category split, monthly trend, savings growth",
        "Recent transactions and AI-generated insights",
      ]}
    />
  )
}
