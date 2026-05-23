import { useQuery } from '@tanstack/react-query';
import { subscriptionAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

export const useModules = () => {
  const token = useAuthStore((s) => s.accessToken);

  const { data, isLoading, error } = useQuery({
    queryKey: ['accessible-modules'],
    queryFn:  subscriptionAPI.getAccessibleModules,
    enabled:  Boolean(token),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const accessible = data?.data?.accessible || null; // null = not loaded yet
  const all        = data?.data?.all        || [];
  const status     = data?.data?.status     || null;

  const canAccess  = (moduleCode) => {
    if (!accessible) return true;      // still loading → optimistic open
    if (accessible.includes('*')) return true; // legacy/super admin
    return accessible.includes(moduleCode);
  };

  return { accessible, all, status, canAccess, isLoading, error };
};
