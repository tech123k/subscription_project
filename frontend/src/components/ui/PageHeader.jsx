import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * PageHeader — consistent page header with optional breadcrumbs and actions.
 *
 * Usage:
 *   <PageHeader
 *     title="Purchase Orders"
 *     subtitle="Manage supplier purchase orders"
 *     breadcrumbs={[{ label: 'Procurement' }, { label: 'Purchase Orders' }]}
 *     actions={<Button>New PO</Button>}
 *   />
 */
const PageHeader = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}) => (
  <div className={clsx('flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6', className)}>
    <div className="min-w-0">
      {breadcrumbs?.length > 0 && (
        <nav aria-label="breadcrumb" className="flex items-center gap-1 mb-1.5 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={11} className="text-slate-300" />}
              {crumb.path ? (
                <Link
                  to={crumb.path}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-xs text-slate-500 font-semibold">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      )}
    </div>

    {actions && (
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {actions}
      </div>
    )}
  </div>
);

export default PageHeader;
