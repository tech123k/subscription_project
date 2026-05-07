import { clsx } from 'clsx';

const Card = ({ children, className, title, subtitle, action, padding = true }) => (
  <div className={clsx('card', className)}>
    {(title || action) && (
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className={clsx(padding && 'p-6')}>{children}</div>
  </div>
);

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'primary', trend, loading }) => {
  const colorMap = {
    primary: { bg: 'bg-primary-50', icon: 'text-primary-600', val: 'text-primary-900' },
    success: { bg: 'bg-green-50', icon: 'text-green-600', val: 'text-green-900' },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-600', val: 'text-amber-900' },
    danger: { bg: 'bg-red-50', icon: 'text-red-600', val: 'text-red-900' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', val: 'text-purple-900' },
    info: { bg: 'bg-blue-50', icon: 'text-blue-600', val: 'text-blue-900' },
  };
  const c = colorMap[color] || colorMap.primary;

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className={clsx('text-2xl font-bold', c.val)}>
            {loading ? '...' : value}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', c.bg)}>
            <Icon size={22} className={c.icon} />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-xs">
          <span className={trend.value >= 0 ? 'text-green-600' : 'text-red-500'}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
};

export default Card;
