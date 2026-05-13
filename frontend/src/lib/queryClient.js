import { QueryClient } from '@tanstack/react-query';

const shouldRetry = (failureCount, error) => {
  // Never retry client errors (4xx) — these won't fix themselves
  if (error?.status >= 400 && error?.status < 500) return false;
  // Retry network/timeout errors up to 2 times
  if (error?.isTimeout || error?.isOffline || error?.status === 0) return failureCount < 2;
  // Retry server errors once
  return failureCount < 1;
};

const retryDelay = (attempt) => Math.min(1000 * 2 ** attempt, 10000);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: shouldRetry,
      retryDelay,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default queryClient;
