import TransactionList from '../components/transactions/TransactionList'

export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">交易流水</h2>
      <TransactionList />
    </div>
  )
}
