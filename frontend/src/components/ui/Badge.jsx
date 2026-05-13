import { clsx } from 'clsx';

const variants = {
  default:  { pill: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  primary:  { pill: 'bg-primary-100 text-primary-700', dot: 'bg-primary-500' },
  success:  { pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  warning:  { pill: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  danger:   { pill: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
  info:     { pill: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500' },
  purple:   { pill: 'bg-violet-100 text-violet-700',   dot: 'bg-violet-500' },
  orange:   { pill: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
};

const statusMap = {
  pending:     'warning',
  in_progress: 'primary',
  running:     'primary',
  completed:   'success',
  rejected:    'danger',
  cancelled:   'default',
  on_hold:     'orange',
  ready:       'info',
  packed:      'purple',
  dispatched:  'primary',
  in_transit:  'info',
  delivered:   'success',
  delayed:     'danger',
  returned:    'default',
  draft:       'default',
  paid:        'success',
  partial:     'warning',
  unpaid:      'danger',
  approved:    'success',
  conditional: 'orange',
  active:      'success',
  inactive:    'default',
  low:         'danger',
  ok:          'success',
  open:        'primary',
  closed:      'default',
};

export const StatusBadge = ({ status, className }) => {
  const variant = statusMap[status?.toLowerCase()] || 'default';
  const label = status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
  return <Badge variant={variant} dot className={className}>{label}</Badge>;
};

const Badge = ({ children, variant = 'default', dot = false, className }) => {
  const v = variants[variant] || variants.default;
  return (
    <span className={clsx(
      'badge font-semibold',
      v.pill,
      className
    )}>
      {dot && <span className={clsx('badge-dot', v.dot)} />}
      {children}
    </span>
  );
};

export default Badge;
