import { clsx } from 'clsx';

const Skeleton = ({ className, ...props }) => (
  <div
    className={clsx(
      'animate-pulse rounded bg-gray-200',
      className
    )}
    {...props}
  />
);

export const SkeletonCard = () => (
  <div className="card p-6">
    <Skeleton className="h-4 w-1/3 mb-4" />
    <Skeleton className="h-8 w-1/2 mb-2" />
    <Skeleton className="h-3 w-2/3" />
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          {[...Array(cols)].map((_, i) => (
            <th key={i} className="table-header">
              <Skeleton className="h-4 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(rows)].map((_, i) => (
          <tr key={i} className="border-b border-gray-50">
            {[...Array(cols)].map((_, j) => (
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

export default Skeleton;
