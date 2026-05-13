import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Factory, Truck, FileText, Warehouse,
  Users, Settings, BarChart3, Bell, ClipboardList, ShoppingCart,
  Building2, ChevronDown, LogOut, User, Boxes, ArrowLeftRight,
  BookOpen, CreditCard, TrendingDown,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Warehouses', icon: Warehouse, path: '/warehouses' },
  {
    label: 'Materials',
    icon: Package,
    children: [
      { label: 'Suppliers', path: '/suppliers' },
      { label: 'Material Master', path: '/materials' },
      { label: 'Purchase Orders', path: '/po' },
      { label: 'GRN / Inward', path: '/grn' },
    ],
  },
  {
    label: 'Production',
    icon: Factory,
    children: [
      { label: 'Product Master', path: '/production/products' },
      { label: 'Attribute Master', path: '/production/attributes' },
      { label: 'Production Orders', path: '/production' },
      { label: 'Workflow Builder', path: '/production/workflows' },
    ],
  },
  {
    label: 'Sales Orders',
    icon: ShoppingCart,
    children: [
      { label: 'Order List', path: '/sales-orders' },
      { label: 'New Order', path: '/sales-orders/create' },
    ],
  },
  { label: 'Dispatch', icon: Truck, path: '/dispatches' },
  { label: 'Customers', icon: ShoppingCart, path: '/customers' },
  { label: 'Invoices', icon: FileText, path: '/invoices' },
  { label: 'Ledger', icon: BookOpen, path: '/ledger' },
  { label: 'Credit / Outstanding', icon: CreditCard, path: '/credit' },
  { label: 'Reports', icon: BarChart3, path: '/reports' },
  { label: 'Users', icon: Users, path: '/users', adminOnly: true },
  { label: 'Audit Logs', icon: ClipboardList, path: '/audit', adminOnly: true },
  { label: 'Companies', icon: Building2, path: '/companies', superAdminOnly: true },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

const NavItem = ({ item, collapsed }) => {
  const location = useLocation();
  const isActive = item.path
    ? location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    : item.children?.some(c => location.pathname.startsWith(c.path));

  if (item.children) {
    return <NavGroup item={item} isActive={isActive} collapsed={collapsed} />;
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => clsx(
        'sidebar-link group',
        isActive && 'active'
      )}
    >
      <item.icon size={18} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
};

const NavGroup = ({ item, isActive, collapsed }) => {
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'sidebar-link w-full justify-between group',
          isActive && 'text-white'
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon size={18} />
          {!collapsed && <span>{item.label}</span>}
        </div>
        {!collapsed && (
          <ChevronDown
            size={14}
            className={clsx('transition-transform duration-200', open && 'rotate-180')}
          />
        )}
      </button>

      <AnimatePresence>
        {open && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden ml-4 mt-1 space-y-1 border-l border-white/10 pl-3"
          >
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) => clsx(
                  'block py-1.5 px-2 rounded-md text-xs transition-colors',
                  isActive
                    ? 'text-white bg-primary-600/50'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                {child.label}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Sidebar = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuthStore();

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly && user?.role !== 'super_admin') return false;
    if (item.adminOnly && !['super_admin', 'company_admin'].includes(user?.role)) return false;
    return true;
  });

  return (
    <aside className={clsx(
      'fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <Factory size={18} className="text-white" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="overflow-hidden"
          >
            <p className="text-white font-bold text-sm">IndustrialERP</p>
            <p className="text-slate-400 text-xs">{user?.companyName || 'Platform'}</p>
          </motion.div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
        {visibleItems.map((item) => (
          <NavItem key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="border-t border-white/10 p-3">
        <div className={clsx('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-slate-400 text-xs truncate capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="text-slate-400 hover:text-white transition-colors p-1"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
