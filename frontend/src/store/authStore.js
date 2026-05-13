import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { connectSocket, disconnectSocket } from '../services/socket';
import queryClient from '../lib/queryClient';

// Decode JWT payload without a library (base64 is safe to parse client-side)
const decodeJwt = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

// BroadcastChannel syncs login/logout/token across tabs in the same browser
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('erp_auth')
  : null;

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      expiresAt: null,       // epoch ms when access token expires
      isAuthenticated: false,

      setAuth: ({ user, accessToken }) => {
        const decoded = decodeJwt(accessToken);
        const expiresAt = decoded?.exp ? decoded.exp * 1000 : null;
        queryClient.clear();
        set({ user, accessToken, expiresAt, isAuthenticated: true });
        connectSocket(accessToken);
        channel?.postMessage({ type: 'LOGIN', accessToken, user, expiresAt });
      },

      setAccessToken: (accessToken) => {
        const decoded = decodeJwt(accessToken);
        const expiresAt = decoded?.exp ? decoded.exp * 1000 : null;
        set({ accessToken, expiresAt });
        channel?.postMessage({ type: 'TOKEN_REFRESH', accessToken, expiresAt });
      },

      updateUser: (userData) => {
        set((state) => ({ user: { ...state.user, ...userData } }));
      },

      logout: () => {
        disconnectSocket();
        queryClient.clear();
        set({ user: null, accessToken: null, expiresAt: null, isAuthenticated: false });
        channel?.postMessage({ type: 'LOGOUT' });
      },

      // Returns true when the access token expires within the next 90 seconds
      isTokenExpiringSoon: () => {
        const { expiresAt } = get();
        return expiresAt ? expiresAt - Date.now() < 90 * 1000 : false;
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
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
        // refreshToken is NOT persisted — it lives only in the httpOnly cookie
      }),
    }
  )
);

// ── Multi-tab sync ───────────────────────────────────────────────────────────
if (channel) {
  channel.onmessage = ({ data }) => {
    const { type, accessToken, user, expiresAt } = data;

    if (type === 'LOGOUT') {
      disconnectSocket();
      queryClient.clear();
      useAuthStore.setState({ user: null, accessToken: null, expiresAt: null, isAuthenticated: false });
    } else if (type === 'LOGIN' && accessToken) {
      useAuthStore.setState({ user, accessToken, expiresAt, isAuthenticated: true });
      connectSocket(accessToken);
      queryClient.clear();
    } else if (type === 'TOKEN_REFRESH' && accessToken) {
      useAuthStore.setState({ accessToken, expiresAt });
    }
  };
}
