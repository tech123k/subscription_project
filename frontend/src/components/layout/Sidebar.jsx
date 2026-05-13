import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Factory, Truck, FileText, Warehouse,
  Users, Settings, BarChart3, ClipboardList, ShoppingCart,
  Building2, ChevronRight, LogOut, Boxes, BookOpen,
  CreditCard, X, Zap, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

/* ─── Palette (royal blue enterprise) ────────────────────
   Base:   #1e3a8a  blue-900  (top of gradient)
   Deep:   #172554  blue-950  (bottom of gradient)
   Active: white/13 pill with white text
   Rest:   blue-200/55 icon, blue-100/60 text
   Hover:  white/07 bg, white/95 text
──────────────────────────────────────────────────────── */

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard',  icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Warehouses', icon: Warehouse,       path: '/warehouses' },
      { label: 'Reports',    icon: BarChart3,       path: '/reports' },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { label: 'Suppliers',       icon: Boxes,        path: '/suppliers' },
      { label: 'Materials',       icon: Package,      path: '/materials' },
      { label: 'Purchase Orders', icon: ClipboardList, path: '/po' },
      { label: 'GRN / Inward',    icon: Truck,        path: '/grn' },
    ],
  },
  {
    label: 'Production',
    items: [
      { label: 'Products',          icon: Factory,  path: '/production/products' },
      { label: 'Production Orders', icon: Zap,      path: '/production' },
      { label: 'Attributes',        icon: Settings, path: '/production/attributes' },
    ],
  },
  {
    label: 'Sales & Finance',
    items: [
      { label: 'Sales Orders', icon: ShoppingCart, path: '/sales-orders' },
      { label: 'Customers',    icon: Users,        path: '/customers' },
      { label: 'Dispatch',     icon: Truck,        path: '/dispatches' },
      { label: 'Invoices',     icon: FileText,     path: '/invoices' },
      { label: 'Ledger',       icon: BookOpen,     path: '/ledger' },
      { label: 'Outstanding',  icon: CreditCard,   path: '/credit' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Users',      icon: Users,        path: '/users',     adminOnly: true },
      { label: 'Audit Logs', icon: ClipboardList, path: '/audit',    adminOnly: true },
      { label: 'Companies',  icon: Building2,    path: '/companies', superAdminOnly: true },
      { label: 'Settings',   icon: Settings,     path: '/settings' },
    ],
  },
];

/* ─── NavItem ────────────────────────────────────────── */
const NavItem = ({ item, collapsed, onMobileClose }) => (
  <NavLink
    to={item.path}
    onClick={onMobileClose}
    title={collapsed ? item.label : undefined}
    end={item.path === '/production'}
    className={({ isActive }) => clsx(
      'group relative flex items-center rounded-xl transition-all duration-200 outline-none',
      collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
      'text-sm font-medium select-none',
      isActive
        ? [
            'bg-white/[0.13] text-white font-semibold',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.08)]',
            collapsed && 'ring-1 ring-inset ring-white/[0.18]',
          ]
        : 'text-blue-100/60 hover:bg-white/[0.07] hover:text-white/95'
    )}
  >
    {({ isActive }) => (
      <>
        {/* Sliding active bg pill — Framer Motion layoutId */}
        {isActive && (
          <motion.span
            layoutId="sidebar-active-pill"
            className="absolute inset-0 rounded-xl"
            transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
          />
        )}

        <item.icon
          size={collapsed ? 18 : 16}
          className={clsx(
            'flex-shrink-0 relative z-10 transition-colors duration-150',
            isActive
              ? 'text-white'
              : 'text-blue-200/55 group-hover:text-white/85'
          )}
        />

        {!collapsed && (
          <span className="flex-1 truncate relative z-10 tracking-[-0.01em]">
            {item.label}
          </span>
        )}

        {/* Active indicator dot */}
        {!collapsed && isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0 relative z-10" />
        )}
      </>
    )}
  </NavLink>
);

/* ─── NavGroup (collapsible) ─────────────────────────── */
const NavGroup = ({ group, collapsed, onMobileClose, defaultOpen = true }) => {
  const location = useLocation();
  const hasActive = group.items.some(i =>
    location.pathname === i.path || location.pathname.startsWith(i.path + '/')
  );
  const [open, setOpen] = useState(defaultOpen || hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  /* collapsed: just show icons, no group header */
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {group.items.map(item => (
          <NavItem key={item.path} item={item} collapsed onMobileClose={onMobileClose} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-1.5 mb-1 group/hdr rounded-lg hover:bg-white/[0.04] transition-colors"
      >
        <span className="text-[10px] font-bold text-blue-200/40 uppercase tracking-[0.1em] group-hover/hdr:text-blue-200/65 transition-colors">
          {group.label}
        </span>
        <ChevronRight
          size={11}
          className={clsx(
            'text-blue-200/25 group-hover/hdr:text-blue-200/50 transition-all duration-200',
            open && 'rotate-90'
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden space-y-0.5"
          >
            {group.items.map(item => (
              <NavItem key={item.path} item={item} collapsed={false} onMobileClose={onMobileClose} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── SidebarBody ────────────────────────────────────── */
const SidebarBody = ({ collapsed, onMobileClose, onToggleCollapse }) => {
  const { user, logout } = useAuthStore();

  const visibleGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.superAdminOnly && user?.role !== 'super_admin') return false;
      if (item.adminOnly && !['super_admin', 'company_admin'].includes(user?.role)) return false;
      return true;
    }),
  })).filter(g => g.items.length > 0);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  return (
    <div className="flex flex-col h-full">

      {/* ── Logo / Brand ── */}
      <div className={clsx(
        'flex items-center flex-shrink-0',
        'border-b border-white/[0.07]',
        collapsed ? 'justify-center px-3 py-[18px]' : 'gap-3 px-4 py-[18px]'
      )}>
        {/* Brand icon — frosted white on blue */}
        <div className="w-9 h-9 rounded-xl bg-white/[0.15] ring-1 ring-white/[0.18] flex items-center justify-center flex-shrink-0 shadow-md shadow-black/20">
          <Factory size={17} className="text-white" />
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm tracking-tight leading-tight">
              IndustrialERP
            </p>
            <p className="text-blue-200/50 text-xs truncate mt-0.5">
              {user?.companyName || 'Platform'}
            </p>
          </div>
        )}

        {/* Mobile close — only when expanded */}
        {!collapsed && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg text-blue-200/40 hover:text-white hover:bg-white/[0.07] transition-colors ml-auto"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* ── User card ── */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2.5 bg-white/[0.06] rounded-xl px-3 py-2.5">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md shadow-black/20 select-none">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white/90 text-[13px] font-semibold truncate leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-blue-200/55 text-[11px] truncate capitalize leading-snug mt-0.5">
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed avatar */}
      {collapsed && (
        <div className="flex justify-center py-3 border-b border-white/[0.07] flex-shrink-0">
          <div
            title={`${user?.firstName} ${user?.lastName}`}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-black/20 select-none"
          >
            {initials}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <div className={clsx('space-y-5', collapsed ? 'px-2' : 'px-3')}>
          {visibleGroups.map((group, i) => (
            <NavGroup
              key={group.label}
              group={group}
              collapsed={collapsed}
              onMobileClose={onMobileClose}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </nav>

      {/* ── Bottom actions ── */}
      <div className={clsx(
        'flex-shrink-0 border-t border-white/[0.07] pt-2 pb-3',
        collapsed ? 'px-2 flex flex-col items-center gap-1' : 'px-3 space-y-0.5'
      )}>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx(
            'hidden lg:flex items-center rounded-xl text-blue-200/55',
            'hover:bg-white/[0.07] hover:text-white/90',
            'transition-all duration-150 text-sm font-medium',
            collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5 w-full'
          )}
        >
          {collapsed
            ? <PanelLeftOpen size={16} className="flex-shrink-0" />
            : <>
                <PanelLeftClose size={16} className="flex-shrink-0" />
                <span className="flex-1 truncate">Collapse</span>
              </>
          }
        </button>

        {/* Sign out */}
        <button
          onClick={logout}
          title={collapsed ? 'Sign Out' : undefined}
          className={clsx(
            'group flex items-center rounded-xl text-blue-200/55',
            'hover:text-red-300 hover:bg-red-400/[0.12]',
            'transition-all duration-150 text-sm font-medium',
            collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5 w-full'
          )}
        >
          <LogOut
            size={16}
            className="flex-shrink-0 text-blue-200/45 group-hover:text-red-300 transition-colors"
          />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
};

/* ─── Sidebar (shell) ────────────────────────────────── */
const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => (
  <>
    {/* Mobile backdrop */}
    <AnimatePresence>
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-30 lg:hidden"
          onClick={onMobileClose}
        />
      )}
    </AnimatePresence>

    <aside className={clsx(
      'fixed inset-y-0 left-0 z-40 flex flex-col',
      /* ── THE BRAND GRADIENT ── */
      'bg-gradient-to-b from-[#1e3a8a] to-[#172554]',
      /* Right edge: subtle border + shadow for separation */
      'border-r border-white/[0.07]',
      'shadow-[4px_0_24px_rgba(0,0,0,0.28)]',
      /* Width */
      'transition-all duration-300 ease-out',
      collapsed ? 'lg:w-16' : 'lg:w-64',
      'w-72 sm:w-64',
      /* Mobile slide */
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    )}>
      <SidebarBody
        collapsed={collapsed}
        onMobileClose={onMobileClose}
        onToggleCollapse={onToggle}
      />
    </aside>
  </>
);

export default Sidebar;
