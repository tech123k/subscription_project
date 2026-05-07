import { useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useNotificationStore } from '../store/notificationStore';
import { useQueryClient } from '@tanstack/react-query';

export const useSocket = () => {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('notification', (notification) => {
      addNotification(notification);
      // Invalidate related queries
      if (notification.reference_type === 'materials') {
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
      if (notification.reference_type === 'production_orders') {
        queryClient.invalidateQueries({ queryKey: ['production'] });
      }
      if (notification.reference_type === 'dispatches') {
        queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      }
    });

    socket.on('production:update', () => {
      queryClient.invalidateQueries({ queryKey: ['production'] });
    });

    socket.on('dispatch:update', () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
    });

    return () => {
      socket.off('notification');
      socket.off('production:update');
      socket.off('dispatch:update');
    };
  }, [addNotification, queryClient]);
};
