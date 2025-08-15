import { useUser } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'

export default function Dashboard() {
  const { user } = useUser()
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setDashboardData({
        totalSales: 45678.90,
        totalTax: 3654.31,
        transactionCount: 156,
        recentTransactions: [
          { id: '1', date: '2024-01-15', amount: 124.99, tax: 10.00, customer: 'John Doe' },
          { id: '2', date: '2024-01-14', amount: 89.50, tax: 7.16, customer: 'Jane Smith' },
          { id: '3', date: '2024-01-13', amount: 256.78, tax: 20.54, customer: 'Bob Wilson' }
        ]
      })
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName || 'there'}!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's what's happening with your sales tax tracking today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Sales (This Month)
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${dashboardData?.totalSales.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">🧾</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Tax Collected
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${dashboardData?.totalTax.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">📊</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Transactions
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {dashboardData?.transactionCount}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Transactions</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Your latest sales with tax calculations
          </p>
        </div>
        <ul className="divide-y divide-gray-200">
          {dashboardData?.recentTransactions.map((transaction) => (
            <li key={transaction.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {transaction.customer.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.customer}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.date}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      ${transaction.amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Tax: ${transaction.tax.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/transactions"
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">💳</span>
              <div>
                <div className="text-sm font-medium text-gray-900">View Transactions</div>
                <div className="text-xs text-gray-500">Manage all transactions</div>
              </div>
            </div>
          </a>

          <a
            href="/reports"
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">📋</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Generate Report</div>
                <div className="text-xs text-gray-500">Tax compliance reports</div>
              </div>
            </div>
          </a>

          <a
            href="/integrations"
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">🔗</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Setup Integration</div>
                <div className="text-xs text-gray-500">Connect your POS</div>
              </div>
            </div>
          </a>

          <a
            href="/business-setup"
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">⚙️</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Business Settings</div>
                <div className="text-xs text-gray-500">Configure your business</div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}