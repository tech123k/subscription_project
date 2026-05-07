import { format, formatDistanceToNow, isValid } from 'date-fns';

export const formatDate = (date, fmt = 'MMM d, yyyy') => {
  if (!date) return '-';
  const d = new Date(date);
  return isValid(d) ? format(d, fmt) : '-';
};

export const formatDateTime = (date) => formatDate(date, 'MMM d, yyyy h:mm a');

export const timeAgo = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '-';
};

export const formatCurrency = (amount, decimals = 2) => {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

export const formatNumber = (n, decimals = 2) =>
  Number(n || 0).toFixed(decimals);

export const formatPercent = (n) => `${Number(n || 0).toFixed(1)}%`;

export const truncate = (str, len = 30) =>
  str && str.length > len ? `${str.slice(0, len)}…` : str || '-';

export const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

export const humanize = (str) =>
  str ? str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

export const generateOrderNumber = (prefix = 'ORD') => {
  const now = new Date();
  const date = format(now, 'yyyyMMdd');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${date}-${rand}`;
};

export const getInitials = (name = '') =>
  name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const buildQueryString = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  });
  return q.toString();
};

export const safeJSON = (str, fallback = null) => {
  try { return JSON.parse(str); } catch { return fallback; }
};

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export const sumBy = (arr, key) =>
  (arr || []).reduce((acc, item) => acc + (Number(item[key]) || 0), 0);

export const groupBy = (arr, key) =>
  (arr || []).reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
