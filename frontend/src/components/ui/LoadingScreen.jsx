import { Factory } from 'lucide-react';

const LoadingScreen = ({ message = 'Loading...' }) => (
  <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 gap-6">
    {/* Animated brand mark */}
    <div className="relative">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
        <Factory size={28} className="text-white" />
      </div>
      {/* Orbiting ring */}
      <div className="absolute -inset-2 rounded-[20px] border-2 border-primary-200 border-t-primary-500 animate-spin" />
    </div>

    <div className="text-center">
      <p className="text-sm font-semibold text-slate-700">{message}</p>
      <p className="text-xs text-slate-400 mt-0.5">IndustrialERP</p>
    </div>

    {/* Progress dots */}
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  </div>
);

export default LoadingScreen;
