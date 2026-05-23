import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Printer, AlertTriangle } from 'lucide-react';
import { accountingAPI } from '../../services/api';
import { clsx } from 'clsx';

const fmt = (n) => n === 0 ? '—' : `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const TrialBalance = () => {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [hideZero, setHideZero] = useState(true);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trial-balance', asOf],
    queryFn: () => accountingAPI.getTrialBalance({ asOf }),
    staleTime: 60_000,
  });

  const allRows = data?.data || [];
  const grandDr = data?.grandDr || 0;
  const grandCr = data?.grandCr || 0;
  const diff = Math.abs(grandDr - grandCr);
  const balanced = diff < 0.01;

  const rows = hideZero ? allRows.filter(r => r.closing_dr > 0 || r.closing_cr > 0) : allRows;

  // Group by group_name
  const grouped = rows.reduce((acc, r) => {
    if (!acc[r.group_name]) acc[r.group_name] = { nature: r.nature, items: [] };
    acc[r.group_name].items.push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Trial Balance</h1>
          <p className="text-xs text-gray-400 mt-0.5">Account-wise closing balances as of selected date</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">As of Date</label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <input type="checkbox" id="hideZero" checked={hideZero} onChange={e => setHideZero(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded" />
          <label htmlFor="hideZero" className="text-xs text-gray-600 select-none cursor-pointer">Hide zero-balance accounts</label>
        </div>
        {!balanced && grandDr > 0 && (
          <div className="ml-auto flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            <AlertTriangle size={13} />
            Out of balance by ₹{diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <BarChart3 size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm text-gray-500">No data. Post vouchers first.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:shadow-none print:border-0">
          <table className="w-full text-xs">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Ledger Account</th>
                <th className="px-4 py-3 text-right font-semibold text-blue-200">Debit (Dr)</th>
                <th className="px-4 py-3 text-right font-semibold text-purple-200">Credit (Cr)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([groupName, { nature, items }]) => (
                <Fragment key={groupName}>
                  <tr className={clsx(
                    'border-t border-gray-100',
                    nature === 'debit' ? 'bg-blue-50' : 'bg-purple-50'
                  )}>
                    <td colSpan={3} className={clsx(
                      'px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider',
                      nature === 'debit' ? 'text-blue-700' : 'text-purple-700'
                    )}>
                      {groupName}
                    </td>
                  </tr>
                  {items.map(r => (
                    <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 pl-8 text-gray-700">
                        {r.name}
                        {r.account_type && (
                          <span className="ml-2 text-[9px] text-gray-400">({r.account_type.replace(/_/g,' ')})</span>
                        )}
                      </td>
                      <td className={clsx('px-4 py-2 text-right font-mono', r.closing_dr > 0 ? 'text-blue-700 font-semibold' : 'text-gray-300')}>
                        {fmt(r.closing_dr)}
                      </td>
                      <td className={clsx('px-4 py-2 text-right font-mono', r.closing_cr > 0 ? 'text-purple-700 font-semibold' : 'text-gray-300')}>
                        {fmt(r.closing_cr)}
                      </td>
                    </tr>
                  ))}
                  {/* Group subtotal */}
                  <tr className={clsx('border-t border-gray-200', nature === 'debit' ? 'bg-blue-50/60' : 'bg-purple-50/60')}>
                    <td className="px-4 py-1.5 pl-8 text-[10px] font-bold text-gray-600">
                      Sub-total — {groupName}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono text-[11px] font-bold text-blue-700">
                      {fmt(items.reduce((s, r) => s + r.closing_dr, 0))}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono text-[11px] font-bold text-purple-700">
                      {fmt(items.reduce((s, r) => s + r.closing_cr, 0))}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot className="bg-gray-900 text-white">
              <tr>
                <td className="px-4 py-3 font-bold text-sm">Grand Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-blue-200 text-sm">
                  {fmt(grandDr)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-purple-200 text-sm">
                  {fmt(grandCr)}
                </td>
              </tr>
            </tfoot>
          </table>

          {balanced && grandDr > 0 && (
            <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 text-xs text-emerald-700 font-medium text-center">
              ✓ Trial Balance tallied — Dr = Cr = ₹{grandDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrialBalance;
