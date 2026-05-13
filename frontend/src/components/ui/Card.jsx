import { clsx } from 'clsx';

const Card = ({ children, className, title, subtitle, action, padding = true }) => (
  <div className={clsx('card', className)}>
    {(title || action) && (
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
        <div>
          {title && <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className={clsx(padding && 'p-5 sm:p-6')}>{children}</div>
  </div>
);

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'primary', trend, loading }) => {
  const colorMap = {
    primary: { bg: 'bg-primary-50', icon: 'text-primary-600' },
    success: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    danger:  { bg: 'bg-red-50',    icon: 'text-red-600' },
    purple:  { bg: 'bg-violet-50', icon: 'text-violet-600' },
    info:    { bg: 'bg-sky-50',    icon: 'text-sky-600' },
  };
  const c = colorMap[color] || colorMap.primary;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-card hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={clsx('w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0', c.bg)}>
            <Icon size={20} className={c.icon} />
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
        {loading ? <span className="opacity-30">—</span> : value}
      </p>
      {subtitle && <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>}
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={trend.value >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-slate-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
};

export default Card;
