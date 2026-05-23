import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Zap, CheckCircle } from 'lucide-react';
import { useModules } from '../hooks/useModules';
import { useQuery } from '@tanstack/react-query';
import { subscriptionAPI } from '../services/api';
import { clsx } from 'clsx';

const MODULE_LABELS = {
  inventory:  'Inventory & Materials',
  warehouses: 'Warehouse Management',
  production: 'Production Orders',
  sales:      'Sales Orders',
  dispatch:   'Dispatch & Delivery',
  accounting: 'Accounting & Finance',
  reports:    'Reports & Analytics',
};

const UpgradeScreen = ({ moduleCode, sub }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 animate-fade-in">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Lock icon */}
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
          <Lock size={36} className="text-indigo-600" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {MODULE_LABELS[moduleCode] || moduleCode} Locked
          </h2>
          <p className="text-gray-500 mt-2 text-sm">
            {sub?.status === 'trial' && sub?.trialExpired
              ? 'Your free trial has ended. Upgrade to continue using this module.'
              : sub?.status === 'cancelled' || sub?.status === 'expired'
              ? 'Your subscription has ended. Renew to regain access.'
              : 'This module is not included in your current plan. Upgrade to unlock it.'}
          </p>
        </div>

        {/* Current plan */}
        {sub && sub.plan_name && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-left">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Current Plan</p>
            <p className="text-sm font-bold text-gray-800">{sub.plan_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">Status: <span className="capitalize font-medium">{sub.status}</span></p>
          </div>
        )}

        {/* What's available in Enterprise */}
        <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 text-left space-y-2">
          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Unlock with Enterprise</p>
          {['Inventory Management','Production Orders','Sales Orders','Dispatch Tracking','Accounting','Advanced Reports'].map(f => (
            <div key={f} className="flex items-center gap-2">
              <CheckCircle size={13} className="text-indigo-500 flex-shrink-0" />
              <span className="text-xs text-indigo-700">{f}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/billing')}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors shadow-md shadow-indigo-200"
          >
            <Zap size={16} /> Upgrade Plan
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Wraps any page/route — shows upgrade screen if module is inaccessible.
 * Usage: <ModuleGuard module="accounting"><AccountingPage /></ModuleGuard>
 */
const ModuleGuard = ({ module: moduleCode, children }) => {
  const { canAccess, isLoading } = useModules();

  const { data: subData } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: subscriptionAPI.getMySubscription,
    staleTime: 5 * 60_000,
  });
  const sub = subData?.data;

  // While loading → render children optimistically (avoids flicker)
  if (isLoading) return children;

  if (!canAccess(moduleCode)) {
    return <UpgradeScreen moduleCode={moduleCode} sub={sub} />;
  }

  return children;
};

export default ModuleGuard;
