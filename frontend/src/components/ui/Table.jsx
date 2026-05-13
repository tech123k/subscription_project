import { clsx } from 'clsx';
import { FileText } from 'lucide-react';
import { SkeletonTable } from './Skeleton';

const Table = ({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records found',
  emptyDescription,
  emptyIcon: EmptyIcon = FileText,
  onRowClick,
  className,
  stickyHeader = false,
}) => {
  if (loading) {
    return <SkeletonTable rows={5} cols={columns.length} />;
  }

  if (!data?.length) {
    return (
      <div className="empty-state py-20">
        <div className="empty-state-icon">
          <EmptyIcon size={28} className="text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">{emptyMessage}</p>
        {emptyDescription && (
          <p className="text-xs text-slate-400 max-w-xs">{emptyDescription}</p>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead className={clsx('bg-slate-50 border-b border-slate-100', stickyHeader && 'sticky top-0 z-10')}>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={clsx('table-header', col.className)}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((row, rowIdx) => (
            <tr
              key={row.id ?? rowIdx}
              onClick={() => onRowClick?.(row)}
              className={clsx(
                'table-row-hover transition-colors duration-100',
                onRowClick && 'cursor-pointer'
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
