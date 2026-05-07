import { useAuthStore } from '../store/authStore';

const ROLE_HIERARCHY = {
  super_admin: 100,
  company_admin: 80,
  department_user: 50,
  read_only: 10,
};

export const usePermission = () => {
  const role = useAuthStore((s) => s.user?.role);

  const can = (action) => {
    if (role === 'super_admin' || role === 'company_admin') return true;
    if (role === 'read_only') return action === 'view';
    return true;
  };

  const hasRole = (...roles) => roles.includes(role);

  const isSuperAdmin = role === 'super_admin';
  const isCompanyAdmin = ['super_admin', 'company_admin'].includes(role);
  const isReadOnly = role === 'read_only';

  return { can, hasRole, isSuperAdmin, isCompanyAdmin, isReadOnly, role };
};
