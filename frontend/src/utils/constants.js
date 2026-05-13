export const INDUSTRY_TYPES = [
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

export const MATERIAL_UNITS = [
  { value: 'kg', label: 'Kg' },
  { value: 'gram', label: 'Gram' },
  { value: 'liter', label: 'Liter' },
  { value: 'ml', label: 'ML' },
  { value: 'piece', label: 'Piece' },
  { value: 'meter', label: 'Meter' },
  { value: 'box', label: 'Box' },
  { value: 'pair', label: 'Pair' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'ton', label: 'Ton' },
  { value: 'sqft', label: 'Sq.Ft' },
  { value: 'set', label: 'Set' },
];

export const PRODUCTION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const DISPATCH_STATUSES = [
  { value: 'ready', label: 'Ready' },
  { value: 'packed', label: 'Packed' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'returned', label: 'Returned' },
];

export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PRIORITIES = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export const QC_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'conditional', label: 'Conditional' },
];

export const SUBSCRIPTION_PLANS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

export const USER_ROLES = [
  { value: 'company_admin', label: 'Company Admin' },
  { value: 'department_user', label: 'Department User' },
  { value: 'read_only', label: 'Read Only' },
];

export const INVOICE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const GST_RATES = [0, 5, 12, 18, 28];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
];
