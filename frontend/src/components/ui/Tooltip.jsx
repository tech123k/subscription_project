import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

/**
 * Tooltip — lightweight hover tooltip.
 *
 * Usage:
 *   <Tooltip content="Save changes">
 *     <button>Save</button>
 *   </Tooltip>
 */
const Tooltip = ({
  children,
  content,
  side = 'top',
  delay = 400,
  className,
}) => {
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);

  if (!content) return children;

  const show = () => { timer.current = setTimeout(() => setVisible(true), delay); };
  const hide = () => { clearTimeout(timer.current); setVisible(false); };

  const positions = {
    top:    'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left:   'right-full mr-2 top-1/2 -translate-y-1/2',
    right:  'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const initY = side === 'top' ? 4 : side === 'bottom' ? -4 : 0;
  const initX = side === 'left' ? 4 : side === 'right' ? -4 : 0;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: initY, x: initX }}
            animate={{ opacity: 1, scale: 1,    y: 0,     x: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.1 }}
            role="tooltip"
            className={clsx(
              'absolute z-[100] pointer-events-none whitespace-nowrap',
              'px-2.5 py-1.5 rounded-lg',
              'bg-slate-900 text-white text-xs font-medium',
              'shadow-lg',
              positions[side],
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tooltip;
