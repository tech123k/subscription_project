import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Upload, X, Building2, Globe, CreditCard } from 'lucide-react';
import { companyAPI } from '../services/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { INDUSTRY_TYPES, INDIAN_STATES } from '../utils/constants';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const CompanySettings = () => {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState({
    name: '', industryType: '', gstNumber: '', panNumber: '',
    address: '', city: '', state: '', pincode: '',
    phone: '', email: '', website: '',
    bankName: '', bankAccount: '', bankIfsc: '', bankBranch: '',
    invoicePrefix: 'INV', dispatchPrefix: 'DSP', productionPrefix: 'PRD',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const { data } = useQuery({
    queryKey: ['company-settings'],
    queryFn: companyAPI.getSettings,
  });

  useEffect(() => {
    if (data?.data) {
      const c = data.data;
      setForm({
        name: c.name || '', industryType: c.industry_type || '', gstNumber: c.gst_number || '',
        panNumber: c.pan_number || '', address: c.address || '', city: c.city || '',
        state: c.state || '', pincode: c.pincode || '', phone: c.phone || '',
        email: c.email || '', website: c.website || '', bankName: c.bank_name || '',
        bankAccount: c.bank_account || '', bankIfsc: c.bank_ifsc || '', bankBranch: c.bank_branch || '',
        invoicePrefix: c.invoice_prefix || 'INV', dispatchPrefix: c.dispatch_prefix || 'DSP',
        productionPrefix: c.production_prefix || 'PRD',
      });
      if (c.logo_url) setLogoPreview(c.logo_url);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (formData) => companyAPI.updateSettings(formData),
    onSuccess: (res) => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  const handleSubmit = () => {
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== '') formData.append(k, v); });
    if (logoFile) formData.append('logo', logoFile);
    save.mutate(formData);
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your company profile and preferences</p>
      </div>

      {/* Logo */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">Company Logo</h3>
        <div className="flex items-center gap-5">
          {logoPreview ? (
            <div className="relative">
              <img src={logoPreview} alt="logo" className="w-20 h-20 object-contain rounded-xl border border-gray-200 p-1" />
              <button onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                <X size={11} />
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
              <Building2 size={24} className="text-gray-300" />
            </div>
          )}
          <div>
            <label className="cursor-pointer">
              <span className="btn-secondary text-sm py-1.5 px-4 inline-flex items-center gap-2">
                <Upload size={14} />Upload Logo
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
            <p className="text-xs text-gray-400 mt-1">PNG or JPG, max 2MB. Appears on invoices.</p>
          </div>
        </div>
      </Card>

      {/* Company Info */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Building2 size={16} />Company Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Company Name *</label>
            <input value={form.name} onChange={f('name')} className="input-field" />
          </div>
          <div>
            <label className="label">Industry Type</label>
            <select value={form.industryType} onChange={f('industryType')} className="input-field">
              <option value="">Select industry...</option>
              {INDUSTRY_TYPES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">GST Number</label>
            <input value={form.gstNumber} onChange={f('gstNumber')} className="input-field" placeholder="22AAAAA0000A1Z5" />
          </div>
          <div>
            <label className="label">PAN Number</label>
            <input value={form.panNumber} onChange={f('panNumber')} className="input-field" placeholder="AAAAA0000A" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input value={form.phone} onChange={f('phone')} className="input-field" type="tel" />
          </div>
          <div>
            <label className="label">Email</label>
            <input value={form.email} onChange={f('email')} className="input-field" type="email" />
          </div>
          <div>
            <label className="label">Website</label>
            <input value={form.website} onChange={f('website')} className="input-field" placeholder="https://example.com" />
          </div>
        </div>
        <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Address</label>
            <input value={form.address} onChange={f('address')} className="input-field" />
          </div>
          <div>
            <label className="label">City</label>
            <input value={form.city} onChange={f('city')} className="input-field" />
          </div>
          <div>
            <label className="label">State</label>
            <select value={form.state} onChange={f('state')} className="input-field">
              <option value="">Select state...</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pincode</label>
            <input value={form.pincode} onChange={f('pincode')} className="input-field" />
          </div>
        </div>
      </Card>

      {/* Bank Details */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><CreditCard size={16} />Bank Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Bank Name</label>
            <input value={form.bankName} onChange={f('bankName')} className="input-field" />
          </div>
          <div>
            <label className="label">Branch</label>
            <input value={form.bankBranch} onChange={f('bankBranch')} className="input-field" />
          </div>
          <div>
            <label className="label">Account Number</label>
            <input value={form.bankAccount} onChange={f('bankAccount')} className="input-field" />
          </div>
          <div>
            <label className="label">IFSC Code</label>
            <input value={form.bankIfsc} onChange={f('bankIfsc')} className="input-field" />
          </div>
        </div>
      </Card>

      {/* Number Prefixes */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Globe size={16} />Document Numbering</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Invoice Prefix</label>
            <input value={form.invoicePrefix} onChange={f('invoicePrefix')} className="input-field" placeholder="INV" />
            <p className="text-xs text-gray-400 mt-1">e.g. {form.invoicePrefix || 'INV'}-2024-0001</p>
          </div>
          <div>
            <label className="label">Dispatch Prefix</label>
            <input value={form.dispatchPrefix} onChange={f('dispatchPrefix')} className="input-field" placeholder="DSP" />
            <p className="text-xs text-gray-400 mt-1">e.g. {form.dispatchPrefix || 'DSP'}-2024-0001</p>
          </div>
          <div>
            <label className="label">Production Prefix</label>
            <input value={form.productionPrefix} onChange={f('productionPrefix')} className="input-field" placeholder="PRD" />
            <p className="text-xs text-gray-400 mt-1">e.g. {form.productionPrefix || 'PRD'}-2024-0001</p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button icon={Save} loading={save.isPending} onClick={handleSubmit}>Save Settings</Button>
      </div>
    </div>
  );
};

export default CompanySettings;
