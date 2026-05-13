import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  danger:    'btn-danger',
  ghost:     'btn-ghost',
  success:   'btn-success',
  warning:   'btn bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm px-4 py-2.5 focus:ring-amber-400/40',
  outline:   'btn border border-primary-500 text-primary-600 hover:bg-primary-50 active:bg-primary-100 px-4 py-2.5 focus:ring-primary-500/30',
};

const sizes = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className,
  fullWidth = false,
  ...props
}) => {
  return (
    <button
      className={clsx(
        'btn',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin flex-shrink-0" />
      ) : Icon ? (
        <Icon size={15} className="flex-shrink-0" />
      ) : null}
      {children}
      {IconRight && !loading && <IconRight size={15} className="flex-shrink-0" />}
    </button>
  );
};

export default Button;
