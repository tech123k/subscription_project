import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSocket } from '../../hooks/useSocket';
import { useNotificationStore } from '../../store/notificationStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationAPI } from '../../services/api';
import { StatusBadge } from '../ui/Badge';
import { format } from 'date-fns';

const NotificationPanel = () => {
  const { isOpen, close, notifications, setNotifications, markAsRead, markAllAsRead, setUnreadCount } = useNotificationStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationAPI.getAll({ limit: 30 });
      setNotifications(res.data);
      return res.data;
    },
    enabled: isOpen,
  });

  const readMutation = useMutation({
    mutationFn: (id) => notificationAPI.markAsRead(id),
    onSuccess: (_, id) => {
      markAsRead(id);
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () => notificationAPI.markAllAsRead(),
    onSuccess: () => {
      markAllAsRead();
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
    },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-modal z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary-600" />
                <h2 className="font-semibold text-gray-900">Notifications</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => readAllMutation.mutate()}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Mark all read
                </button>
                <button onClick={close} className="p-1 rounded hover:bg-gray-100">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {isLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
              ) : !notifications?.length ? (
                <div className="p-8 text-center text-gray-400 text-sm">No notifications</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && readMutation.mutate(n.id)}
                    className={clsx(
                      'px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors',
                      !n.is_read && 'bg-primary-50/50 border-l-2 border-primary-500'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                        !n.is_read ? 'bg-primary-500' : 'bg-gray-300'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(n.created_at), 'MMM d, HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useSocket();

  const handleMenuToggle = () => {
    if (window.innerWidth < 1024) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((o) => !o);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={clsx(
        'flex-1 flex flex-col min-w-0 transition-all duration-300',
        // Mobile: no margin (sidebar is an overlay)
        // Desktop: margin based on collapsed state
        collapsed ? 'lg:ml-16' : 'lg:ml-64'
      )}>
        <Header onMenuToggle={handleMenuToggle} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      <NotificationPanel />
    </div>
  );
};

export default Layout;
