import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Factory, Building2, User, ChevronRight, ChevronLeft,
  Loader2, Mail, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';

const INDUSTRIES = [
  { value: 'footwear',      label: 'Footwear' },
  { value: 'steel',         label: 'Steel' },
  { value: 'chemical',      label: 'Chemical' },
  { value: 'textile',       label: 'Textile' },
  { value: 'fmcg',          label: 'FMCG' },
  { value: 'machinery',     label: 'Machinery' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'trading',       label: 'Trading' },
  { value: 'other',         label: 'Other' },
];

const INPUT = 'w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';
const LABEL = 'block text-sm font-medium text-slate-300 mb-1';

// ── OTP digit input ──────────────────────────────────────────
const OTPInput = ({ value, onChange }) => {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleChange = (idx, e) => {
    const ch = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = ch;
    const joined = next.join('').slice(0, 6);
    onChange(joined);
    if (ch && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) onChange(pasted);
  };

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((idx) => (
        <input
          key={idx}
          ref={(el) => (inputs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKey(idx, e)}
          className="w-11 h-12 text-center text-xl font-bold bg-white/10 border-2 border-white/20 text-white rounded-xl focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/40 transition-all"
        />
      ))}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────
const Register = () => {
  const navigate = useNavigate();
  const [step, setStep]     = useState(1);
  const [otp, setOtp]       = useState('');
  const [countdown, setCd]  = useState(0);

  const { register, handleSubmit, getValues, trigger, formState: { errors } } = useForm();

  // Start 60-second resend cooldown
  const startCooldown = () => {
    setCd(60);
    const t = setInterval(() => {
      setCd((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; });
    }, 1000);
  };

  // ── Send OTP mutation ──────────────────────────────────────
  const sendOtpMut = useMutation({
    mutationFn: () => authAPI.sendOtp({
      email:     getValues('adminEmail'),
      firstName: getValues('firstName'),
    }),
    onSuccess: () => {
      toast.success(`OTP sent to ${getValues('adminEmail')}`);
      setStep(3);
      startCooldown();
    },
    onError: (err) => {
      const msg = err?.message || '';
      if (err?.status === 429 || msg.includes('wait')) {
        toast.error('Please wait before requesting another OTP.');
      } else {
        toast.error(msg || 'Failed to send OTP. Check email address.');
      }
    },
  });

  // ── Register mutation ──────────────────────────────────────
  const registerMut = useMutation({
    mutationFn: (data) => authAPI.register(data),
    onSuccess: () => {
      toast.success('Account created! Please login.');
      navigate('/login');
    },
    onError: (err) => {
      const msg = (err?.message || '').toLowerCase();
      if (err?.status === 400 && msg.includes('otp')) {
        toast.error(err.message);           // OTP-specific error
      } else if (err?.status === 409 || msg.includes('duplicate')) {
        toast.error('Company code or email already registered. Use a different code.');
        setStep(1);
      } else if (err?.status === 400 && (msg.includes('password') || msg.includes('validation'))) {
        toast.error('Password needs at least 1 capital letter and 1 number. Example: Admin@123');
        setStep(2);
      } else {
        toast.error(err?.message || 'Registration failed');
      }
    },
  });

  // ── Step 2 → 3: validate then send OTP ───────────────────
  const handleSendOtp = async () => {
    const valid = await trigger(['firstName', 'lastName', 'adminEmail', 'password']);
    if (!valid) return;
    sendOtpMut.mutate();
  };

  // ── Step 3 submit: verify OTP + register ─────────────────
  const handleVerifyAndRegister = () => {
    if (otp.length < 6) { toast.error('Enter the complete 6-digit OTP'); return; }
    const data = getValues();
    registerMut.mutate({
      company: {
        name:        data.companyName,
        code:        data.companyCode.toUpperCase(),
        industryType: data.industryType,
        email:       data.companyEmail,
        phone:       data.companyPhone,
        gstNumber:   data.gstNumber,
        addressLine1: data.address,
        city:        data.city,
        state:       data.state,
        pincode:     data.pincode,
      },
      admin: {
        firstName: data.firstName,
        lastName:  data.lastName,
        email:     data.adminEmail,
        password:  data.password,
      },
      otp,
    });
  };

  const STEPS = [
    { icon: Building2, label: 'Company' },
    { icon: User,      label: 'Admin' },
    { icon: ShieldCheck, label: 'Verify' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-4">
            <Factory size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Register Your Company</h1>
          <p className="text-slate-400 text-sm mt-1">Set up your ERP account in minutes</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? 'bg-primary-600 text-white' :
                  done   ? 'bg-emerald-500/20 text-emerald-400' :
                           'bg-white/10 text-slate-400'
                }`}>
                  <s.icon size={12} />
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-0.5 mx-0.5 rounded ${done ? 'bg-emerald-500' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Company Info ── */}
            {step === 1 && (
              <motion.div key="s1"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-5">
                  <Building2 size={18} className="text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">Company Information</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={LABEL}>Company Name *</label>
                    <input {...register('companyName', { required: true })} className={INPUT} placeholder="Alpha Manufacturing Pvt Ltd" />
                  </div>
                  <div>
                    <label className={LABEL}>Company Code *</label>
                    <input {...register('companyCode', { required: true })} className={INPUT} placeholder="ALPHAMFG" />
                  </div>
                  <div>
                    <label className={LABEL}>Industry Type *</label>
                    <select {...register('industryType', { required: true })}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Company Email *</label>
                    <input {...register('companyEmail', { required: true })} type="email" className={INPUT} placeholder="info@company.com" />
                  </div>
                  <div>
                    <label className={LABEL}>Phone</label>
                    <input {...register('companyPhone')} className={INPUT} placeholder="+91 9999999999" />
                  </div>
                  <div>
                    <label className={LABEL}>GST Number</label>
                    <input {...register('gstNumber')} className={INPUT} placeholder="27AABCU9603R1ZX" />
                  </div>
                  <div>
                    <label className={LABEL}>City</label>
                    <input {...register('city')} className={INPUT} placeholder="Mumbai" />
                  </div>
                  <div>
                    <label className={LABEL}>State</label>
                    <input {...register('state')} className={INPUT} placeholder="Maharashtra" />
                  </div>
                </div>

                <button type="button" onClick={() => setStep(2)}
                  className="w-full mt-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all">
                  Next <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: Admin Info + Send OTP ── */}
            {step === 2 && (
              <motion.div key="s2"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-5">
                  <User size={18} className="text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">Admin Account</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>First Name *</label>
                    <input {...register('firstName', { required: true })} className={INPUT} placeholder="John" />
                  </div>
                  <div>
                    <label className={LABEL}>Last Name *</label>
                    <input {...register('lastName', { required: true })} className={INPUT} placeholder="Doe" />
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL}>Admin Email * <span className="text-xs text-slate-500">(OTP will be sent here)</span></label>
                    <input {...register('adminEmail', { required: true })} type="email" className={INPUT} placeholder="admin@company.com" />
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL}>Password * <span className="text-xs text-slate-500">Min 8 chars, 1 uppercase, 1 number</span></label>
                    <input {...register('password', { required: true, minLength: 8 })} type="password" className={INPUT} placeholder="Admin@123" />
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button type="button" onClick={handleSendOtp} disabled={sendOtpMut.isPending}
                    className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70">
                    {sendOtpMut.isPending
                      ? <><Loader2 size={15} className="animate-spin" /> Sending...</>
                      : <><Mail size={15} /> Send OTP</>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: OTP Verification ── */}
            {step === 3 && (
              <motion.div key="s3"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={18} className="text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">Verify Email</h2>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                  <p className="text-slate-400 text-sm">OTP sent to</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{getValues('adminEmail')}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-400 text-center">Enter the 6-digit code from your email</p>
                  <OTPInput value={otp} onChange={setOtp} />
                </div>

                {/* Resend */}
                <div className="text-center">
                  {countdown > 0 ? (
                    <p className="text-slate-500 text-xs">Resend OTP in <span className="text-primary-400 font-semibold">{countdown}s</span></p>
                  ) : (
                    <button type="button" onClick={() => sendOtpMut.mutate()} disabled={sendOtpMut.isPending}
                      className="text-primary-400 hover:text-primary-300 text-xs font-medium flex items-center gap-1 mx-auto transition-colors disabled:opacity-50">
                      <RefreshCw size={11} className={sendOtpMut.isPending ? 'animate-spin' : ''} />
                      Resend OTP
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(2)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button type="button" onClick={handleVerifyAndRegister} disabled={registerMut.isPending || otp.length < 6}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60">
                    {registerMut.isPending
                      ? <><Loader2 size={15} className="animate-spin" /> Creating...</>
                      : <><ShieldCheck size={15} /> Verify & Register</>}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p className="text-center mt-4 text-slate-400 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
