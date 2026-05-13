import { clsx } from 'clsx';
import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  helperText,
  icon: Icon,
  iconRight: IconRight,
  className,
  containerClassName,
  required,
  ...props
}, ref) => {
  return (
    <div className={clsx('flex flex-col', containerClassName)}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Icon size={15} className={error ? 'text-red-400' : 'text-slate-400'} />
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'input-field',
            Icon ? 'pl-10' : '',
            IconRight ? 'pr-10' : '',
            error && 'input-error',
            className
          )}
          {...props}
        />
        {IconRight && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
            <IconRight size={15} className="text-slate-400" />
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-slate-400">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
