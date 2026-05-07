import { clsx } from 'clsx';

const variants = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
};

const statusMap = {
  pending: 'warning',
  in_progress: 'primary',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'default',
  on_hold: 'orange',
  ready: 'info',
  packed: 'purple',
  dispatched: 'primary',
  in_transit: 'info',
  delivered: 'success',
  delayed: 'danger',
  returned: 'default',
  draft: 'default',
  paid: 'success',
  partial: 'warning',
  unpaid: 'danger',
  approved: 'success',
  conditional: 'orange',
  active: 'success',
  inactive: 'default',
  low: 'danger',
  ok: 'success',
};

export const StatusBadge = ({ status, className }) => {
  const variant = statusMap[status?.toLowerCase()] || 'default';
  const label = status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={variant} className={className}>{label}</Badge>;
};

const Badge = ({ children, variant = 'default', dot = false, className }) => (
  <span className={clsx(
    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
    variants[variant],
    className
  )}>
    {dot && (
      <span className={clsx('w-1.5 h-1.5 rounded-full', {
        'bg-gray-500': variant === 'default',
        'bg-primary-600': variant === 'primary',
        'bg-green-600': variant === 'success',
        'bg-amber-500': variant === 'warning',
        'bg-red-600': variant === 'danger',
        'bg-blue-600': variant === 'info',
      })} />
    )}
    {children}
  </span>
);

export default Badge;
