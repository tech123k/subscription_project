import { clsx } from 'clsx';

/**
 * FormSection — groups related form fields with a title and optional description.
 *
 * Usage:
 *   <FormSection title="Basic Info" description="Core product details">
 *     <Input label="Name" ... />
 *   </FormSection>
 */
export const FormSection = ({ title, description, children, className, cols = 2 }) => (
  <div className={clsx('pb-7 border-b border-slate-100 last:border-0 last:pb-0', className)}>
    <div className="mb-5">
      <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
      {description && (
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
      )}
    </div>
    <div className={clsx(
      'grid gap-4',
      cols === 1 && 'grid-cols-1',
      cols === 2 && 'grid-cols-1 sm:grid-cols-2',
      cols === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    )}>
      {children}
    </div>
  </div>
);

/**
 * StickyFooter — sticky form action bar that sticks to the bottom of a form/page.
 *
 * Usage:
 *   <StickyFooter>
 *     <Button variant="secondary">Cancel</Button>
 *     <Button type="submit">Save</Button>
 *   </StickyFooter>
 */
export const StickyFooter = ({ children, className }) => (
  <div className={clsx(
    'sticky bottom-0 z-10',
    '-mx-4 sm:-mx-6 px-4 sm:px-6',
    'py-4 mt-6',
    'bg-white/95 backdrop-blur-sm',
    'border-t border-slate-100',
    'flex items-center justify-end gap-3',
    className
  )}>
    {children}
  </div>
);

/**
 * FormCard — wraps form content in a card (use inside a page with card-padded).
 */
export const FormCard = ({ children, className }) => (
  <div className={clsx('card divide-y divide-slate-100', className)}>
    {children}
  </div>
);

export default FormSection;
