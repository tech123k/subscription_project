import useNetworkStatus from '../../hooks/useNetworkStatus';

const NetworkBanner = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] text-center text-sm py-2 px-4 font-medium transition-colors ${
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-red-500 text-white'
      }`}
    >
      {isOnline ? 'Back online' : 'No internet connection. Check your network.'}
    </div>
  );
};

export default NetworkBanner;
