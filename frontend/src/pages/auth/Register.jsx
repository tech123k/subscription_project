import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Factory, Building2, User, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';

const INDUSTRIES = [
  { value: 'footwear', label: 'Footwear' },
  { value: 'steel', label: 'Steel' },
  { value: 'chemical', label: 'Chemical' },
  { value: 'textile', label: 'Textile' },
  { value: 'fmcg', label: 'FMCG' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'trading', label: 'Trading' },
  { value: 'other', label: 'Other' },
];

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const registerMutation = useMutation({
    mutationFn: authAPI.register,
    onSuccess: () => {
      toast.success('Company registered! Please login.');
      navigate('/login');
    },
  });

  const onSubmit = (data) => {
    registerMutation.mutate({
      company: {
        name: data.companyName,
        code: data.companyCode.toUpperCase(),
        industryType: data.industryType,
        email: data.companyEmail,
        phone: data.companyPhone,
        gstNumber: data.gstNumber,
        addressLine1: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
      },
      admin: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.adminEmail,
        password: data.password,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-4">
            <Factory size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Register Your Company</h1>
          <p className="text-slate-400 text-sm mt-1">Set up your ERP account in minutes</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                s <= step ? 'bg-primary-600 text-white' : 'bg-white/10 text-slate-400'
              }`}>{s}</div>
              {s < 2 && <div className={`w-12 h-0.5 ${s < step ? 'bg-primary-500' : 'bg-white/20'}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <Building2 size={18} className="text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">Company Information</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Company Name *</label>
                    <input {...register('companyName', { required: true })}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Alpha Manufacturing Pvt Ltd" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Company Code *</label>
                    <input {...register('companyCode', { required: true })}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="ALPHAMFG" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Industry Type *</label>
                    <select {...register('industryType', { required: true })}
                      className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Company Email *</label>
                    <input {...register('companyEmail', { required: true })} type="email"
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="info@company.com" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                    <input {...register('companyPhone')}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="+91 9999999999" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">GST Number</label>
                    <input {...register('gstNumber')}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="27AABCU9603R1ZX" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">City</label>
                    <input {...register('city')}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Mumbai" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">State</label>
                    <input {...register('state')}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Maharashtra" />
                  </div>
                </div>

                <button type="button" onClick={() => setStep(2)}
                  className="w-full mt-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all">
                  Next <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <User size={18} className="text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">Admin Account</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">First Name *</label>
                    <input {...register('firstName', { required: true })}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="John" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Last Name *</label>
                    <input {...register('lastName', { required: true })}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Doe" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Admin Email *</label>
                    <input {...register('adminEmail', { required: true })} type="email"
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="admin@company.com" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Password *</label>
                    <input {...register('password', { required: true, minLength: 8 })} type="password"
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Min 8 chars with uppercase & number" />
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button type="submit" disabled={registerMutation.isPending}
                    className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70">
                    {registerMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : 'Create Account'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <p className="text-center mt-4 text-slate-400 text-sm">
            Already have an account? <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default Register;
