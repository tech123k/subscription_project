import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Printer } from 'lucide-react';
import { accountingAPI } from '../../services/api';
import { clsx } from 'clsx';

const fmt = (n) => `₹${Math.abs(parseFloat(n || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const firstDayOfYear = () => {
  const y = new Date().getFullYear();
  return `${y}-04-01`; // Indian FY starts April 1
};

const ProfitLoss = () => {
  const [from, setFrom] = useState(firstDayOfYear());
  const [to, setTo]     = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['profit-loss', from, to],
    queryFn: () => accountingAPI.getProfitLoss({ from, to }),
    staleTime: 60_000,
  });

  const income   = data?.data?.income   || [];
  const expenses = data?.data?.expenses || [];
  const totalIncome   = data?.data?.totalIncome   || 0;
  const totalExpenses = data?.data?.totalExpenses || 0;
  const netProfit     = data?.data?.netProfit     || 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Profit & Loss</h1>
          <p className="text-xs text-gray-400 mt-0.5">Income vs Expenses for selected period</p>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
          <Printer size={13} /> Print
        </button>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
      </div>

      {/* KPI Cards */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Income</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700 tracking-tight">{fmt(totalIncome)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-red-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <TrendingDown size={16} className="text-red-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Expenses</span>
            </div>
            <p className="text-2xl font-bold text-red-700 tracking-tight">{fmt(totalExpenses)}</p>
          </div>
          <div className={clsx(
            'rounded-2xl border p-4 shadow-sm',
            netProfit >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', netProfit >= 0 ? 'bg-indigo-100' : 'bg-orange-100')}>
                <TrendingUp size={16} className={netProfit >= 0 ? 'text-indigo-700' : 'text-orange-700'} />
              </div>
              <span className="text-xs font-medium text-gray-500">
                {netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
              </span>
            </div>
            <p className={clsx('text-2xl font-bold tracking-tight', netProfit >= 0 ? 'text-indigo-700' : 'text-orange-700')}>
              {fmt(netProfit)}
            </p>
          </div>
        </div>
      )}

      {/* P&L Statement */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Income Side */}
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
            <div className="bg-emerald-600 px-4 py-3">
              <h3 className="text-sm font-bold text-white">Income</h3>
            </div>
            {income.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">No income entries</div>
            ) : (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-50">
                  {income.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{r.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700">
                        {fmt(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-emerald-800">Total Income</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-800">{fmt(totalIncome)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Expense Side */}
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <div className="bg-red-600 px-4 py-3">
              <h3 className="text-sm font-bold text-white">Expenses</h3>
            </div>
            {expenses.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">No expense entries</div>
            ) : (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-50">
                  {expenses.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{r.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-red-700">
                        {fmt(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-red-50 border-t-2 border-red-200">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-red-800">Total Expenses</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-red-800">{fmt(totalExpenses)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Net Result */}
      {!isLoading && (totalIncome > 0 || totalExpenses > 0) && (
        <div className={clsx(
          'rounded-2xl p-4 flex items-center justify-between',
          netProfit >= 0 ? 'bg-indigo-600' : 'bg-orange-600'
        )}>
          <span className="text-white font-bold text-sm">
            {netProfit >= 0 ? 'Net Profit' : 'Net Loss'} for Period
          </span>
          <span className="text-white font-bold text-xl tracking-tight font-mono">
            {fmt(netProfit)}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProfitLoss;
