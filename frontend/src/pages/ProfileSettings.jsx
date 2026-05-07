import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Save, Key } from 'lucide-react';
import { userAPI } from '../services/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { getInitials } from '../utils/helpers';
import toast from 'react-hot-toast';

const ProfileSettings = () => {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [form, setForm] = useState({ fullName: '', phone: '', department: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    if (user) {
      setForm({ fullName: user.fullName || user.full_name || '', phone: user.phone || '', department: user.department || '' });
    }
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: (d) => userAPI.updateProfile(d),
    onSuccess: (res) => {
      toast.success('Profile updated');
      if (updateUser) updateUser(res.data);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const changePassword = useMutation({
    mutationFn: (d) => userAPI.changePassword(d),
    onSuccess: () => {
      toast.success('Password changed');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const fp = (k) => (e) => setPwForm((p) => ({ ...p, [k]: e.target.value }));

  const handleChangePassword = () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    changePassword.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  const roleLabel = user?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account information</p>
      </div>

      {/* Avatar */}
      <Card className="p-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-bold">
            {getInitials(user?.fullName || user?.full_name || '')}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{user?.fullName || user?.full_name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">{roleLabel}</span>
          </div>
        </div>
      </Card>

      {/* Profile form */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Full Name</label>
            <input value={form.fullName} onChange={f('fullName')} className="input-field" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input value={form.phone} onChange={f('phone')} className="input-field" type="tel" />
          </div>
          <div>
            <label className="label">Department</label>
            <input value={form.department} onChange={f('department')} className="input-field" placeholder="e.g. Production" />
          </div>
          <div className="col-span-2">
            <label className="label">Email</label>
            <input value={user?.email || ''} className="input-field bg-gray-50 text-gray-500" disabled />
            <p className="text-xs text-gray-400 mt-1">Contact admin to change your email address.</p>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button icon={Save} loading={updateProfile.isPending} onClick={() => updateProfile.mutate(form)}>
            Save Profile
          </Button>
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Key size={16} />Change Password</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Current Password</label>
            <input value={pwForm.currentPassword} onChange={fp('currentPassword')} className="input-field" type="password" />
          </div>
          <div>
            <label className="label">New Password</label>
            <input value={pwForm.newPassword} onChange={fp('newPassword')} className="input-field" type="password" />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input value={pwForm.confirmPassword} onChange={fp('confirmPassword')} className="input-field" type="password" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="secondary" icon={Key} loading={changePassword.isPending} onClick={handleChangePassword}>
            Change Password
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfileSettings;
