import { clsx } from 'clsx';

const sizeMap = {
  sm: { wrap: 'py-10', icon: 'w-12 h-12 rounded-2xl',  iconSz: 22, title: 'text-sm', desc: 'text-xs' },
  md: { wrap: 'py-16', icon: 'w-16 h-16 rounded-2xl',  iconSz: 28, title: 'text-sm', desc: 'text-xs' },
  lg: { wrap: 'py-20', icon: 'w-20 h-20 rounded-3xl',  iconSz: 32, title: 'text-base', desc: 'text-sm' },
};

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  actionLabel = 'Get Started',
  size = 'md',
  className,
}) => {
  const s = sizeMap[size];
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', s.wrap, className)}>
      {Icon && (
        <div className={clsx('bg-slate-100 flex items-center justify-center mb-4 flex-shrink-0', s.icon)}>
          <Icon size={s.iconSz} className="text-slate-400" />
        </div>
      )}
      <p className={clsx('font-bold text-slate-700 tracking-tight', s.title)}>{title}</p>
      {description && (
        <p className={clsx('text-slate-400 mt-1 max-w-xs leading-relaxed', s.desc)}>{description}</p>
      )}
      {action && (
        <button
          onClick={action}
          className="mt-5 btn-primary btn text-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
