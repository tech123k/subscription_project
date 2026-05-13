import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

const sizes = {
  sm:   'sm:max-w-md',
  md:   'sm:max-w-lg',
  lg:   'sm:max-w-2xl',
  xl:   'sm:max-w-4xl',
  '2xl':'sm:max-w-6xl',
  full: 'sm:max-w-full sm:mx-4',
};

const Modal = ({ isOpen, onClose, title, children, size = 'md', footer, className }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              'relative w-full bg-white shadow-modal overflow-hidden',
              'rounded-t-2xl sm:rounded-2xl',
              sizes[size],
              className
            )}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="px-5 sm:px-6 py-5 max-h-[75vh] sm:max-h-[65vh] overflow-y-auto">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-100">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    )}
  </AnimatePresence>
);

export default Modal;
