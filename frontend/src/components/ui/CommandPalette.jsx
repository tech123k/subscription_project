/**
 * CommandPalette — ⌘K / Ctrl+K global search
 *
 * Static items: fuzzy-matched pages + quick actions
 * Live search: backend ERP data (materials, customers, invoices, …)
 * React Query v5 + 300ms debounce + keyboard navigation
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Search, LayoutDashboard, Package, ClipboardList, Truck, Factory,
  ShoppingCart, FileText, Users, Warehouse, BarChart3, Settings,
  BookOpen, CreditCard, Building2, User, Boxes,
  CornerDownLeft, ArrowUp, ArrowDown, Compass, Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCommandStore } from '../../store/commandStore';
import { searchAPI } from '../../services/api';

/* ═══════════════════════════════════════════════════════
   STATIC ITEM CATALOG
═══════════════════════════════════════════════════════ */
const ALL_ITEMS = [
  { group: 'Navigate', label: 'Dashboard',         icon: LayoutDashboard, path: '/dashboard',             keywords: 'home overview analytics kpi' },
  { group: 'Navigate', label: 'Materials',          icon: Package,         path: '/materials',             keywords: 'stock inventory raw material item' },
  { group: 'Navigate', label: 'Purchase Orders',    icon: ClipboardList,   path: '/po',                    keywords: 'PO procurement buy order supplier' },
  { group: 'Navigate', label: 'GRN / Inward',       icon: Truck,           path: '/grn',                   keywords: 'receive inward goods receipt note grn' },
  { group: 'Navigate', label: 'Suppliers',          icon: Boxes,           path: '/suppliers',             keywords: 'vendor procurement partner payable' },
  { group: 'Navigate', label: 'Production Orders',  icon: Factory,         path: '/production',            keywords: 'manufacture batch work order job shop floor' },
  { group: 'Navigate', label: 'Products',           icon: Package,         path: '/production/products',   keywords: 'catalogue SKU item finished goods product' },
  { group: 'Navigate', label: 'Attributes',         icon: Settings,        path: '/production/attributes', keywords: 'variant color size specification attribute' },
  { group: 'Navigate', label: 'Sales Orders',       icon: ShoppingCart,    path: '/sales-orders',          keywords: 'sell order customer OMS sales so' },
  { group: 'Navigate', label: 'Customers',          icon: Users,           path: '/customers',             keywords: 'client buyer account receivable customer' },
  { group: 'Navigate', label: 'Dispatches',         icon: Truck,           path: '/dispatches',            keywords: 'ship delivery send consignment dispatch logistics' },
  { group: 'Navigate', label: 'Invoices',           icon: FileText,        path: '/invoices',              keywords: 'bill payment finance accounts invoice' },
  { group: 'Navigate', label: 'Inventory Ledger',   icon: BookOpen,        path: '/ledger',                keywords: 'stock movements history log ledger inventory' },
  { group: 'Navigate', label: 'Outstanding',        icon: CreditCard,      path: '/credit',                keywords: 'credit receivable due payment pending outstanding' },
  { group: 'Navigate', label: 'Warehouses',         icon: Warehouse,       path: '/warehouses',            keywords: 'storage location godown warehouse store' },
  { group: 'Navigate', label: 'Reports',            icon: BarChart3,       path: '/reports',               keywords: 'analytics charts summary export report' },

  { group: 'Create New', label: 'New Material',          icon: Package,       path: '/materials/create',      keywords: 'add create material new stock' },
  { group: 'Create New', label: 'New Purchase Order',    icon: ClipboardList, path: '/po/create',             keywords: 'new create PO order supplier' },
  { group: 'Create New', label: 'New GRN Entry',         icon: Truck,         path: '/grn/create',            keywords: 'receive create goods inward entry' },
  { group: 'Create New', label: 'New Production Order',  icon: Factory,       path: '/production/create',     keywords: 'start create production manufacture batch' },
  { group: 'Create New', label: 'New Sales Order',       icon: ShoppingCart,  path: '/sales-orders/create',   keywords: 'new create order sell sales' },
  { group: 'Create New', label: 'New Dispatch',          icon: Truck,         path: '/dispatches/create',     keywords: 'ship create send goods dispatch' },
  { group: 'Create New', label: 'New Invoice',           icon: FileText,      path: '/invoices/create',       keywords: 'bill create customer new invoice' },

  { group: 'Settings', label: 'My Profile',          icon: User,          path: '/profile',  keywords: 'account password personal name profile' },
  { group: 'Settings', label: 'Company Settings',    icon: Building2,     path: '/settings', keywords: 'organization configure branding company' },
  { group: 'Settings', label: 'User Management',     icon: Users,         path: '/users',    keywords: 'team roles permissions members users' },
  { group: 'Settings', label: 'Audit Logs',          icon: ClipboardList, path: '/audit',    keywords: 'history track changes activity audit log' },
];

const STATIC_GROUP_ORDER = ['Navigate', 'Create New', 'Settings'];

/* ─── Backend type → icon + group label ─── */
const TYPE_META = {
  material:      { icon: Package,      group: 'Materials' },
  customer:      { icon: Users,        group: 'Customers' },
  supplier:      { icon: Boxes,        group: 'Suppliers' },
  invoice:       { icon: FileText,     group: 'Invoices' },
  dispatch:      { icon: Truck,        group: 'Dispatches' },
  product:       { icon: Factory,      group: 'Products' },
  warehouse:     { icon: Warehouse,    group: 'Warehouses' },
  purchaseOrder: { icon: ClipboardList, group: 'Purchase Orders' },
};

const BACKEND_GROUP_ORDER = [
  'Materials', 'Products', 'Customers', 'Suppliers',
  'Invoices', 'Purchase Orders', 'Dispatches', 'Warehouses',
];

/* ═══════════════════════════════════════════════════════
   RECENT SEARCHES (localStorage)
═══════════════════════════════════════════════════════ */
const RECENT_KEY = 'erp_cmd_recent_v2';
const MAX_RECENT = 6;

const getRecentPaths = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
};

const persistRecent = (path) => {
  try {
    const current = getRecentPaths();
    const updated = [path, ...current.filter(p => p !== path)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
};

/* ═══════════════════════════════════════════════════════
   FUZZY SCORER (static items)
═══════════════════════════════════════════════════════ */
const scoreItem = (item, raw) => {
  if (!raw) return 0;
  const q = raw.toLowerCase().trim();
  if (!q) return 0;

  const label    = item.label.toLowerCase();
  const keywords = (item.keywords || '').toLowerCase();
  const group    = item.group.toLowerCase();
  const hay      = `${label} ${keywords} ${group}`;

  if (label === q)           return 100;
  if (label.startsWith(q))  return 90;
  if (label.includes(q))    return 75;
  if (keywords.includes(q)) return 55;

  const words = q.split(/\s+/).filter(w => w.length > 1);
  if (words.length > 1 && words.every(w => hay.includes(w))) return 40;

  const acronym = label.split(/[\s/\-]+/).map(w => w[0]).join('');
  if (acronym === q)           return 50;
  if (acronym.startsWith(q))  return 35;

  if (label.split(' ').some(w => w.startsWith(q))) return 30;

  return -1;
};

/* ═══════════════════════════════════════════════════════
   DEBOUNCE HOOK
═══════════════════════════════════════════════════════ */
const useDebounced = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════ */
const SectionLabel = ({ label, icon: Icon }) => (
  <div className="flex items-center gap-2 px-3 pt-3.5 pb-1.5">
    {Icon && <Icon size={11} className="text-slate-400" />}
    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
  </div>
);

const SkeletonRow = () => (
  <div className="flex items-center gap-3 px-3 py-2.5">
    <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 animate-pulse" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3 bg-slate-100 rounded animate-pulse w-2/5" />
      <div className="h-2.5 bg-slate-50 rounded animate-pulse w-1/4" />
    </div>
  </div>
);

const ResultItem = ({ item, isActive, isRecent, isBackend, onClick, innerRef }) => {
  const isCreate = item.group === 'Create New';
  const sublabel = item.sublabel || item.path;

  return (
    <button
      ref={innerRef}
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
        'transition-colors duration-100 text-left group outline-none',
        isActive
          ? 'bg-blue-50 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)]'
          : 'hover:bg-slate-50'
      )}
    >
      <div className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
        isActive
          ? isCreate ? 'bg-emerald-100' : isBackend ? 'bg-indigo-100' : 'bg-blue-100'
          : isCreate ? 'bg-emerald-50 group-hover:bg-emerald-100'
          : isBackend ? 'bg-indigo-50 group-hover:bg-indigo-100'
          : isRecent  ? 'bg-amber-50 group-hover:bg-amber-100'
          : 'bg-slate-100 group-hover:bg-slate-200'
      )}>
        <item.icon
          size={15}
          className={clsx(
            'transition-colors',
            isActive
              ? isCreate ? 'text-emerald-600' : isBackend ? 'text-indigo-600' : 'text-blue-600'
              : isCreate ? 'text-emerald-600'
              : isBackend ? 'text-indigo-500'
              : isRecent  ? 'text-amber-600'
              : 'text-slate-500'
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className={clsx(
          'text-[13.5px] font-semibold truncate leading-tight',
          isActive ? 'text-blue-800' : 'text-slate-800'
        )}>
          {isCreate && <span className="text-emerald-500 font-bold mr-0.5">+</span>}
          {item.label}
        </p>
        <p className={clsx(
          'text-[11px] truncate mt-0.5',
          isBackend ? 'text-slate-500' : 'font-mono',
          isActive ? 'text-blue-400' : 'text-slate-400'
        )}>
          {sublabel}
        </p>
      </div>

      <CornerDownLeft
        size={13}
        className={clsx(
          'flex-shrink-0 transition-all duration-150',
          isActive
            ? 'text-blue-400 opacity-100'
            : 'text-slate-300 opacity-0 group-hover:opacity-100'
        )}
      />
    </button>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
const CommandPalette = () => {
  const { isOpen, close } = useCommandStore();
  const navigate = useNavigate();

  const [query, setQuery]         = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const activeRef = useRef(null);

  /* ── Global shortcut ── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useCommandStore.getState().open();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── On open: reset + focus ── */
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  /* ── Debounced query for backend search ── */
  const debouncedQuery = useDebounced(query, 300);
  const shouldSearch = debouncedQuery.trim().length >= 2;

  /* ── Backend search ── */
  const { data: searchResponse, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchAPI.global(debouncedQuery),
    enabled: isOpen && shouldSearch,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  /* ── Convert backend rows → flat items with icon ── */
  const backendItems = useMemo(() => {
    if (!searchResponse?.data) return [];
    const d = searchResponse.data;
    const KEY_MAP = {
      materials:      'material',
      customers:      'customer',
      suppliers:      'supplier',
      invoices:       'invoice',
      dispatches:     'dispatch',
      products:       'product',
      warehouses:     'warehouse',
      purchaseOrders: 'purchaseOrder',
    };
    return Object.entries(KEY_MAP).flatMap(([key, type]) => {
      const meta = TYPE_META[type];
      return (d[key] || []).map(r => ({ ...r, icon: meta.icon, group: meta.group, isBackend: true }));
    });
  }, [searchResponse]);

  /* ── Static filtered+scored items ── */
  const staticFiltered = useMemo(() => {
    if (!query.trim()) return [];
    return ALL_ITEMS
      .map(item => ({ item, score: scoreItem(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [query]);

  /* ── When not searching: show static grouped items ── */
  const staticGrouped = useMemo(() => {
    if (query.trim()) return [];
    const map = {};
    STATIC_GROUP_ORDER.forEach(g => { map[g] = ALL_ITEMS.filter(i => i.group === g); });
    return STATIC_GROUP_ORDER
      .filter(g => map[g]?.length)
      .map(g => ({ label: g, items: map[g], isStatic: true }));
  }, [query]);

  /* ── Grouped structure when searching ── */
  const searchGrouped = useMemo(() => {
    if (!shouldSearch) return [];
    const groups = [];

    /* Backend ERP data groups */
    const backendMap = {};
    backendItems.forEach(item => {
      if (!backendMap[item.group]) backendMap[item.group] = [];
      backendMap[item.group].push(item);
    });
    BACKEND_GROUP_ORDER.forEach(g => {
      if (backendMap[g]?.length) groups.push({ label: g, items: backendMap[g], isBackend: true });
    });

    /* Static page + action matches */
    if (staticFiltered.length) {
      groups.push({ label: 'Pages & Actions', icon: Compass, items: staticFiltered, isStatic: true });
    }

    return groups;
  }, [shouldSearch, backendItems, staticFiltered]);

  /* ── Flat list for keyboard navigation ── */
  const allFlat = useMemo(() => {
    if (shouldSearch) {
      return searchGrouped.flatMap(g => g.items);
    }
    return staticGrouped.flatMap(g => g.items);
  }, [shouldSearch, searchGrouped, staticGrouped]);

  const grouped = shouldSearch ? searchGrouped : staticGrouped;

  /* ── Reset active when query or results change ── */
  useEffect(() => { setActiveIdx(0); }, [query, backendItems]);

  /* ── Scroll active into view ── */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  /* ── Stable close helper — bypasses any React batching / stale closure ── */
  const forceClose = useCallback(() => {
    useCommandStore.getState().close();
  }, []);

  /* ── Select an item ── */
  const selectItem = useCallback((item) => {
    forceClose();
    navigate(item.path);
  }, [forceClose, navigate]);

  /* ── Global Escape handler ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') useCommandStore.getState().close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── Keyboard handler (on input) ── */
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, allFlat.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allFlat[activeIdx]) selectItem(allFlat[activeIdx]);
        break;
      default:
        break;
    }
  }, [allFlat, activeIdx, selectItem]);

  /* ── Render ── */
  let flatCount = 0;
  const isEmpty = !isFetching && allFlat.length === 0 && query.trim().length > 0;

  const overlay = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cp-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 bg-slate-900/60 z-[9998]"
          onClick={forceClose}
        />
      )}
      {isOpen && (
        <motion.div
          key="cp-panel"
          initial={{ opacity: 0, scale: 0.96, y: -12 }}
          animate={{ opacity: 1, scale: 1,    y: 0 }}
          exit={{ opacity: 0,  scale: 0.96, y: -12 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 top-[8vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl z-[9999]"
        >
            <div className="bg-white rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.28),0_0_0_1px_rgba(0,0,0,0.06)]">

              {/* ── Search input ── */}
              <div className="flex items-center gap-3.5 px-4 py-3.5 border-b border-slate-100">
                {isFetching ? (
                  <Loader2 size={19} className="flex-shrink-0 text-blue-500 animate-spin" />
                ) : (
                  <Search
                    size={19}
                    className={clsx(
                      'flex-shrink-0 transition-colors duration-150',
                      query ? 'text-blue-500' : 'text-slate-400'
                    )}
                  />
                )}
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages, materials, customers, invoices…"
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  className="flex-1 text-[15px] text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent font-medium"
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {query && (
                    <button
                      onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                      aria-label="Clear search"
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-400 text-[10px] font-mono font-bold">
                    esc
                  </kbd>
                </div>
              </div>

              {/* ── Results ── */}
              <div
                ref={listRef}
                className="max-h-[min(62vh,480px)] overflow-y-auto p-2 scrollbar-hide"
              >
                {/* Loading skeleton — shown when first fetching for a new query */}
                {isFetching && backendItems.length === 0 && (
                  <div className="pt-2">
                    <SectionLabel label="Searching ERP data…" />
                    {[1, 2, 3, 4].map(n => <SkeletonRow key={n} />)}
                  </div>
                )}

                {/* Empty state */}
                {isEmpty && (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Search size={20} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      No results for <span className="text-slate-900">"{query}"</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try searching by name, code, or number
                    </p>
                  </div>
                )}

                {/* Result groups */}
                {(!isFetching || backendItems.length > 0) && grouped.map(({ label, icon: GroupIcon, items, isBackend }) => (
                  <div key={label}>
                    <SectionLabel label={label} icon={GroupIcon} />
                    {items.map((item) => {
                      const idx = flatCount++;
                      const isActive = idx === activeIdx;
                      const isRecent = label === 'Recent';
                      return (
                        <ResultItem
                          key={`${item.path}-${label}-${item.id || ''}`}
                          item={item}
                          isActive={isActive}
                          isRecent={isRecent}
                          isBackend={!!isBackend}
                          innerRef={isActive ? activeRef : null}
                          onClick={() => selectItem(item)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* ── Footer ── */}
              <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-5 bg-slate-50/60">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="flex items-center gap-0.5">
                    <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px] shadow-sm">
                      <ArrowUp size={9} className="inline" />
                    </kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px] shadow-sm">
                      <ArrowDown size={9} className="inline" />
                    </kbd>
                  </span>
                  Navigate
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px] shadow-sm">↵</kbd>
                  Open
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px] shadow-sm">esc</kbd>
                  Close
                </span>
                {shouldSearch && (
                  <span className="ml-auto text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                    Live ERP search
                  </span>
                )}
                {!shouldSearch && (
                  <span className="ml-auto text-[11px] text-slate-300 font-mono hidden sm:block">⌘K</span>
                )}
              </div>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
};

export default CommandPalette;
