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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon size={16} className="text-gray-400" />
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full border rounded-lg text-sm text-gray-900 placeholder-gray-400',
            'focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-150',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            Icon ? 'pl-10' : 'pl-3',
            IconRight ? 'pr-10' : 'pr-3',
            'py-2',
            error
              ? 'border-red-300 focus:ring-red-500 bg-red-50'
              : 'border-gray-200 focus:ring-primary-500 bg-white',
            className
          )}
          {...props}
        />
        {IconRight && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <IconRight size={16} className="text-gray-400" />
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
