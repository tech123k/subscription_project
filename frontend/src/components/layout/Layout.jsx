import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, CheckCheck, Clock } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from '../ui/CommandPalette';
import { useSocket } from '../../hooks/useSocket';
import { useNotificationStore } from '../../store/notificationStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationAPI } from '../../services/api';
import { StatusBadge } from '../ui/Badge';
import { format, formatDistanceToNow } from 'date-fns';

/* ─── Notification Panel ─────────────────────────────────── */
const typeIconMap = {
  low_stock: '📦',
  production: '🏭',
  sales: '🛒',
  dispatch: '🚚',
  invoice: '📄',
  system: '⚙️',
};

const NotificationItem = ({ n, onRead }) => {
  const isUnread = !n.is_read;
  return (
    <div
      onClick={() => isUnread && onRead(n.id)}
      className={clsx(
        'relative px-5 py-4 transition-colors cursor-pointer group',
        isUnread
          ? 'bg-primary-50/50 hover:bg-primary-50'
          : 'hover:bg-slate-50'
      )}
    >
      {isUnread && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-500 rounded-r" />
      )}
      <div className="flex items-start gap-3">
        <div className={clsx(
          'w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5',
          isUnread ? 'bg-primary-100' : 'bg-slate-100'
        )}>
          {typeIconMap[n.type] || '🔔'}
        </div>
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm leading-snug truncate', isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
            {n.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
          <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
            <Clock size={10} />
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </p>
        </div>
        {isUnread && (
          <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
        )}
      </div>
    </div>
  );
};

const NotificationPanel = () => {
  const { isOpen, close, notifications, setNotifications, markAsRead, markAllAsRead, unreadCount } = useNotificationStore();
  const queryClient = useQueryClient();

  const { isLoading } = useQuery({
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px]"
            onClick={close}
          />

          <motion.aside
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-[−4px_0_32px_rgba(0,0,0,0.10)] z-50 flex flex-col border-l border-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Bell size={15} className="text-primary-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 tracking-tight text-sm">Notifications</h2>
                  {unreadCount > 0 && (
                    <p className="text-[11px] text-slate-400">{unreadCount} unread</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => readAllMutation.mutate()}
                    disabled={readAllMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-xl font-semibold transition-colors"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
                <button
                  onClick={close}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 scrollbar-hide">
              {isLoading ? (
                <div className="p-5 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="skeleton w-8 h-8 rounded-xl flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3.5 w-3/4 rounded" />
                        <div className="skeleton h-3 w-full rounded" />
                        <div className="skeleton h-2.5 w-1/3 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !notifications?.length ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <Bell size={22} className="opacity-30" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600 mb-0.5">You're all caught up</p>
                  <p className="text-xs">No new notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem key={n.id} n={n} onRead={(id) => readMutation.mutate(id)} />
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

/* ─── Page transition wrapper ────────────────────────────── */
const PageTransition = ({ children, locationKey }) => (
  <motion.div
    key={locationKey}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.18, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

/* ─── Layout ─────────────────────────────────────────────── */
const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useSocket();

  const handleMenuToggle = () => {
    if (window.innerWidth < 1024) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((o) => !o);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={clsx(
        'flex-1 flex flex-col min-w-0 transition-all duration-300',
        collapsed ? 'lg:ml-16' : 'lg:ml-64'
      )}>
        <Header onMenuToggle={handleMenuToggle} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <PageTransition locationKey={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <NotificationPanel />
      <CommandPalette />
    </div>
  );
};

export default Layout;
