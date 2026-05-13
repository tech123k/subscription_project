const LoadingScreen = ({ message = 'Loading...' }) => (
  <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  </div>
);

export default LoadingScreen;
