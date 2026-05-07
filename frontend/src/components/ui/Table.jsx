import { clsx } from 'clsx';
import { ChevronUp, ChevronDown } from 'lucide-react';
import Skeleton from './Skeleton';

const Table = ({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  onRowClick,
  className,
  stickyHeader = false,
}) => {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="table-header">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                {columns.map((col, j) => (
                  <td key={j} className="table-cell">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead className={clsx('bg-gray-50 border-b border-gray-200', stickyHeader && 'sticky top-0 z-10')}>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={clsx('table-header', col.className)}
                style={{ width: col.width }}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              onClick={() => onRowClick?.(row)}
              className={clsx(
                'group transition-colors duration-100',
                onRowClick && 'cursor-pointer hover:bg-blue-50/50',
                rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
              )}
            >
              {columns.map((col, colIdx) => (
                <td key={colIdx} className={clsx('table-cell', col.cellClassName)}>
                  {col.cell ? col.cell(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
