import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Zap, Crown, Star, ArrowLeft, Lock } from 'lucide-react';
import { subscriptionAPI, billingAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

// Load Razorpay script
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const PLAN_ICONS = { starter: Star, growth: Zap, enterprise: Crown };
const PLAN_COLORS = {
  starter:    { bg: 'from-slate-600 to-slate-800',  badge: 'bg-slate-100 text-slate-700',  border: 'border-slate-200', ring: 'ring-slate-400' },
  growth:     { bg: 'from-indigo-600 to-purple-700', badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-300', ring: 'ring-indigo-500' },
  enterprise: { bg: 'from-amber-500 to-orange-600',  badge: 'bg-amber-100 text-amber-700',  border: 'border-amber-300', ring: 'ring-amber-500' },
};

const PlanCard = ({ plan, billing, selected, onSelect }) => {
  const Icon   = PLAN_ICONS[plan.code] || Zap;
  const colors = PLAN_COLORS[plan.code] || PLAN_COLORS.growth;
  const price  = billing === 'yearly' ? plan.yearly_price : plan.monthly_price;
  const monthly = billing === 'yearly' ? (plan.yearly_price / 12).toFixed(0) : plan.monthly_price;
  const saving  = billing === 'yearly'
    ? Math.round((1 - plan.yearly_price / (plan.monthly_price * 12)) * 100)
    : 0;

  return (
    <div
      onClick={() => onSelect(plan.code)}
      className={clsx(
        'relative bg-white rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden',
        selected ? `${colors.border} ring-2 ${colors.ring} shadow-xl scale-[1.02]` : 'border-gray-100 hover:border-gray-300 hover:shadow-md'
      )}
    >
      {plan.is_popular && (
        <div className="absolute top-0 left-0 right-0 bg-indigo-600 text-white text-[10px] font-bold text-center py-1 uppercase tracking-widest">
          Most Popular
        </div>
      )}

      {/* Header */}
      <div className={clsx('bg-gradient-to-br p-5', colors.bg, plan.is_popular && 'pt-8')}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Icon size={18} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">₹{parseInt(monthly).toLocaleString('en-IN')}</span>
          <span className="text-white/70 text-sm">/mo</span>
        </div>
        {billing === 'yearly' && saving > 0 && (
          <span className="mt-1 inline-block text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
            Save {saving}% yearly
          </span>
        )}
      </div>

      {/* Features */}
      <div className="p-5 space-y-2">
        <p className="text-xs text-gray-400 mb-3">{plan.description}</p>
        {(plan.features || []).map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-gray-600">{f}</span>
          </div>
        ))}
        <p className="text-[11px] text-gray-400 mt-3">
          {plan.max_users === -1 ? 'Unlimited users' : `Up to ${plan.max_users} users`}
          {' · '}{plan.trial_days}-day free trial
        </p>
      </div>

      {/* Select button */}
      <div className="px-5 pb-5">
        <div className={clsx(
          'w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-colors',
          selected
            ? `bg-gradient-to-r ${colors.bg} text-white`
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        )}>
          {selected ? '✓ Selected' : 'Select Plan'}
        </div>
      </div>
    </div>
  );
};

const PlanSelection = () => {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [billing, setBilling]   = useState('monthly');
  const [selected, setSelected] = useState('growth');
  const [loading, setLoading]   = useState(false);

  const { data } = useQuery({
    queryKey: ['plans'],
    queryFn:  subscriptionAPI.getPlans,
    staleTime: 10 * 60_000,
  });
  const plans = data?.data || [];

  const createSubMutation = useMutation({
    mutationFn: (data) => billingAPI.createSubscription(data),
  });

  const handleSubscribe = async () => {
    if (!selected) { toast.error('Select a plan first'); return; }
    setLoading(true);
    try {
      const res = await createSubMutation.mutateAsync({ planCode: selected, billingCycle: billing });
      const { subscriptionId, keyId, amount, planName, mode } = res.data;

      if (mode === 'manual') {
        // No Razorpay plan configured — start trial directly
        await billingAPI.startTrial({ planCode: selected });
        toast.success('Free trial started!');
        qc.invalidateQueries({ queryKey: ['my-subscription'] });
        qc.invalidateQueries({ queryKey: ['accessible-modules'] });
        navigate('/billing');
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Could not load Razorpay. Check connection.'); setLoading(false); return; }

      const options = {
        key:             keyId,
        subscription_id: subscriptionId,
        name:            'IndustrialERP',
        description:     `${planName} — ${billing}`,
        amount:          amount * 100,
        currency:        'INR',
        theme:           { color: '#4f46e5' },
        handler: async (response) => {
          try {
            await billingAPI.verifyPayment({
              razorpayPaymentId:      response.razorpay_payment_id,
              razorpaySubscriptionId: response.razorpay_subscription_id,
              razorpaySignature:      response.razorpay_signature,
              planCode:               selected,
              billingCycle:           billing,
              amount,
            });
            toast.success('Subscription activated!');
            qc.invalidateQueries({ queryKey: ['my-subscription'] });
            qc.invalidateQueries({ queryKey: ['accessible-modules'] });
            navigate('/billing');
          } catch (e) {
            toast.error(e?.message || 'Payment verification failed');
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      toast.error(e?.message || 'Failed to initiate payment');
      setLoading(false);
    }
  };

  const trialMutation = useMutation({
    mutationFn: () => billingAPI.startTrial({ planCode: selected }),
    onSuccess: () => {
      toast.success(`${plans.find(p=>p.code===selected)?.trial_days || 14}-day trial started!`);
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
      qc.invalidateQueries({ queryKey: ['accessible-modules'] });
      navigate('/dashboard');
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mx-auto mb-4 transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Choose Your Plan</h1>
          <p className="text-gray-500">Start with a {plans[0]?.trial_days || 14}-day free trial. No credit card required.</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <span className={clsx('text-sm font-medium', billing === 'monthly' ? 'text-gray-900' : 'text-gray-400')}>Monthly</span>
          <button
            onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
            className={clsx('relative w-12 h-6 rounded-full transition-colors', billing === 'yearly' ? 'bg-indigo-600' : 'bg-gray-200')}
          >
            <span className={clsx('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
              billing === 'yearly' ? 'translate-x-7' : 'translate-x-1')} />
          </button>
          <span className={clsx('text-sm font-medium', billing === 'yearly' ? 'text-gray-900' : 'text-gray-400')}>
            Yearly <span className="text-emerald-600 font-bold text-xs ml-1">Save up to 20%</span>
          </span>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {plans.map(p => (
            <PlanCard
              key={p.code}
              plan={p}
              billing={billing}
              selected={selected === p.code}
              onSelect={setSelected}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <Button
            icon={Zap}
            loading={loading}
            onClick={handleSubscribe}
            className="px-10 py-3.5 text-base"
          >
            Subscribe to {plans.find(p => p.code === selected)?.name} →
          </Button>
          <button
            onClick={() => trialMutation.mutate()}
            disabled={trialMutation.isPending}
            className="text-sm text-indigo-600 hover:underline"
          >
            Start {plans.find(p=>p.code===selected)?.trial_days || 14}-day free trial instead
          </button>
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
            <span className="flex items-center gap-1"><Lock size={11} /> Secure payment via Razorpay</span>
            <span>·</span>
            <span>Cancel anytime</span>
            <span>·</span>
            <span>GST invoice included</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;
