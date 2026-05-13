import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { connectSocket, disconnectSocket } from '../services/socket';
import queryClient from '../lib/queryClient';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: ({ user, accessToken, refreshToken }) => {
        queryClient.clear();
        set({ user, accessToken, refreshToken, isAuthenticated: true });
        connectSocket(accessToken);
      },

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      updateUser: (userData) => {
        set((state) => ({ user: { ...state.user, ...userData } }));
      },

      logout: () => {
        disconnectSocket();
        queryClient.clear();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      getCompanyId: () => get().user?.companyId,
      getRole: () => get().user?.role,
      isSuperAdmin: () => get().user?.role === 'super_admin',
      isCompanyAdmin: () => ['super_admin', 'company_admin'].includes(get().user?.role),
      isReadOnly: () => get().user?.role === 'read_only',
    }),
    {
      name: 'erp-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
