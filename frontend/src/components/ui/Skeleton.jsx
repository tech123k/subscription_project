import { clsx } from 'clsx';

const Skeleton = ({ className, ...props }) => (
  <div className={clsx('skeleton', className)} {...props} />
);

export const SkeletonCard = ({ lines = 3 }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between mb-4">
      <div className="w-11 h-11 rounded-xl skeleton" />
    </div>
    <div className="skeleton h-4 w-2/5 mb-2" />
    <div className="skeleton h-7 w-3/5 mb-2" />
    <div className="skeleton h-3 w-1/2" />
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr>
          {[...Array(cols)].map((_, i) => (
            <th key={i} className="table-header">
              <div className="skeleton h-3 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(rows)].map((_, i) => (
          <tr key={i} className="border-b border-slate-50">
            {[...Array(cols)].map((_, j) => (
              <td key={j} className="table-cell">
                <div className={clsx('skeleton h-4', j === 0 ? 'w-4/5' : j === cols - 1 ? 'w-12' : 'w-full')} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const SkeletonForm = ({ fields = 4 }) => (
  <div className="space-y-5">
    {[...Array(fields)].map((_, i) => (
      <div key={i}>
        <div className="skeleton h-3.5 w-24 mb-2 rounded" />
        <div className="skeleton h-10 w-full rounded-xl" />
      </div>
    ))}
  </div>
);

export default Skeleton;
