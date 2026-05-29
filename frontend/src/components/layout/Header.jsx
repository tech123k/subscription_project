import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell, Menu, Search, User, LogOut, Settings,
  ChevronDown, Plus,
  LayoutDashboard, Package, ClipboardList, ShoppingCart,
  Building2, BarChart3, Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useCommandStore } from '../../store/commandStore';
import { useQuery } from '@tanstack/react-query';
import { notificationAPI } from '../../services/api';

/* ─── Quick-create items ──────────────────────────────────── */
const QUICK_CREATE = [
  { label: 'Material',         icon: Package,       path: '/materials/create' },
  { label: 'Purchase Order',   icon: ClipboardList, path: '/po/create' },
  { label: 'Production Order', icon: LayoutDashboard, path: '/production/create' },
  { label: 'Sales Order',      icon: ShoppingCart,  path: '/sales-orders/create' },
];

/* ─── Menu item component ────────────────────────────────── */
const MenuItem = ({ icon: Icon, label, hint, badge, onClick, danger }) => (
  <button
    onClick={onClick}
    className={clsx(
      'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-100',
      danger
        ? 'text-red-600 hover:bg-red-50'
        : 'text-slate-700 hover:bg-slate-50'
    )}
  >
    <Icon
      size={14}
      className={clsx('flex-shrink-0', danger ? 'text-red-400' : 'text-slate-400')}
    />
    <span className="flex-1 text-left">{label}</span>
    {hint && <span className="text-[10px] text-slate-300 font-mono">{hint}</span>}
    {badge && (
      <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold rounded-full">
        {badge}
      </span>
    )}
  </button>
);

const MenuSection = ({ title, children }) => (
  <div className="p-1.5 border-b border-slate-100 last:border-0">
    {title && (
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] px-3 pt-1 pb-1.5">
        {title}
      </p>
    )}
    {children}
  </div>
);

const Header = ({ onMenuToggle }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuthStore();
  const { unreadCount, setUnreadCount, toggleOpen } = useNotificationStore();
  const { open: openCommand } = useCommandStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreate, setShowCreate]     = useState(false);
  const createRef   = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    setShowCreate(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showCreate) return;
    const handler = (e) => {
      if (createRef.current && !createRef.current.contains(e.target)) {
        setShowCreate(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCreate]);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  useQuery({
    queryKey: ['notification-count'],
    queryFn: async () => {
      const res = await notificationAPI.getUnreadCount();
      setUnreadCount(res.data.count);
      return res.data.count;
    },
    refetchInterval: 60000,
  });

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  const closeMenu = () => setShowUserMenu(false);
  const go = (path) => { navigate(path); closeMenu(); };

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-100 shadow-[0_1px_0_rgba(0,0,0,0.04)] flex items-center px-3 sm:px-5 gap-2 sm:gap-3 sticky top-0 z-30">

      {/* Menu toggle */}
      <button
        onClick={onMenuToggle}
        aria-label="Toggle sidebar"
        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0"
      >
        <Menu size={19} />
      </button>

      {/* ── Search button (desktop) ── */}
      <button
        onClick={openCommand}
        className="relative flex-1 max-w-sm hidden sm:flex items-center gap-2.5 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 hover:bg-white hover:border-slate-300 hover:shadow-sm text-slate-400 transition-all cursor-pointer"
        aria-label="Open search"
      >
        <Search size={14} className="text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-left text-sm">Search anything...</span>
      </button>


      <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">

        {/* Mobile search trigger */}
        <button
          onClick={openCommand}
          aria-label="Search"
          className="sm:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <Search size={18} />
        </button>

        {/* ── Quick Create ── */}
        <div className="relative hidden sm:block" ref={createRef}>
          <button
            onMouseDown={() => setShowCreate(v => !v)}
            aria-label="Quick create"
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors',
              showCreate
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            )}
          >
            <Plus size={15} />
            <span className="hidden lg:block">Create</span>
          </button>

          {showCreate && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-dropdown z-50 overflow-hidden p-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 pb-1.5">
                Quick Create
              </p>
              {QUICK_CREATE.map(({ label, icon: Icon, path: itemPath }) => (
                <button
                  key={itemPath}
                  onClick={() => { setShowCreate(false); navigate(itemPath); }}
                  className="dropdown-item w-full"
                >
                  <Icon size={14} className="text-primary-500" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Notifications ── */}
        <button
          onClick={toggleOpen}
          aria-label="Notifications"
          className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* ── User menu ── */}
        <div className="relative" ref={userMenuRef}>
          <button
            onMouseDown={() => setShowUserMenu(v => !v)}
            aria-label="User menu"
            className={clsx(
              'flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors',
              showUserMenu ? 'bg-slate-100' : 'hover:bg-slate-100'
            )}
          >
            {user?.companyLogo ? (
              <img
                src={user.companyLogo}
                alt="logo"
                className="w-8 h-8 rounded-lg object-contain border border-slate-200 bg-white flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm select-none">
                {initials}
              </div>
            )}
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-slate-400 capitalize leading-tight">
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
            <ChevronDown
              size={14}
              className={clsx('text-slate-400 hidden sm:block transition-transform duration-200', showUserMenu && 'rotate-180')}
            />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.14),0_0_0_1px_rgba(0,0,0,0.04)] z-50 overflow-hidden">
                  {/* ── Profile card ── */}
                  <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-slate-50 to-indigo-50/40 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                      {user?.companyLogo ? (
                        <img
                          src={user.companyLogo}
                          alt="logo"
                          className="w-11 h-11 rounded-xl object-contain border border-slate-200 bg-white flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md select-none">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[15px] text-slate-900 truncate leading-tight">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-[12px] text-slate-500 truncate mt-0.5">{user?.email}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 text-primary-700 capitalize">
                            {user?.role?.replace(/_/g, ' ')}
                          </span>
                          {user?.companyName && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <Building2 size={10} />
                              <span className="truncate max-w-[120px]">{user.companyName}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Account ── */}
                  <MenuSection title="Account">
                    <MenuItem icon={User}     label="My Profile"       onClick={() => go('/profile')} />
                    <MenuItem icon={Settings} label="Company Settings"  onClick={() => go('/settings')} />
                  </MenuSection>

                  {/* ── Navigate ── */}
                  <MenuSection title="Navigate">
                    <MenuItem icon={LayoutDashboard} label="Dashboard"    onClick={() => go('/dashboard')} />
                    <MenuItem icon={BarChart3}        label="Reports"      onClick={() => go('/reports')} />
                    {['super_admin', 'company_admin'].includes(user?.role) && (
                      <MenuItem icon={Shield} label="Audit Logs" onClick={() => go('/audit')} />
                    )}
                  </MenuSection>

                  {/* ── Sign out ── */}
                  <MenuSection>
                    <MenuItem icon={LogOut} label="Sign Out" danger onClick={logout} />
                  </MenuSection>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
