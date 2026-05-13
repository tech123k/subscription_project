import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import useNetworkStatus from '../../hooks/useNetworkStatus';

const NetworkBanner = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const show = !isOnline || wasOffline;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 text-sm py-2.5 px-4 font-semibold shadow-md ${
            isOnline
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {isOnline
            ? <><Wifi size={15} /> Back online — connection restored</>
            : <><WifiOff size={15} /> No internet connection. Check your network.</>
          }
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NetworkBanner;
