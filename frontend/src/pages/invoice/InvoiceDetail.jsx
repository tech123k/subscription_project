import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Plus, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { invoiceAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { usePermission } from '../../hooks/usePermission';
import toast from 'react-hot-toast';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceAPI.getById(id),
  });

  const addPayment = useMutation({
    mutationFn: ({ amount, paymentDate, paymentMode, reference }) =>
      invoiceAPI.addPayment(id, { amount, paymentDate, paymentMode, reference }),
    onSuccess: () => {
      toast.success('Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to record payment'),
  });

  const invoice = data?.data;
  const items = invoice?.items || [];
  const payments = invoice?.payments || [];

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="card p-6 h-48 bg-gray-50" />
    </div>
  );

  const handleAddPayment = () => {
    const amount = prompt('Payment amount (₹)?');
    if (!amount || isNaN(amount)) return;
    const paymentMode = prompt('Payment mode (cash/bank_transfer/cheque/upi)?') || 'bank_transfer';
    const reference = prompt('Reference/UTR number (optional)?') || '';
    addPayment.mutate({ amount: Number(amount), paymentDate: new Date().toISOString().split('T')[0], paymentMode, reference });
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/invoices')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{invoice?.invoice_number}</h1>
              <StatusBadge status={invoice?.payment_status} />
              <StatusBadge status={invoice?.status} />
            </div>
            <p className="text-sm text-gray-500">{invoice?.customer_name} • {formatDate(invoice?.invoice_date)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {can('update') && invoice?.payment_status !== 'paid' && (
            <Button variant="secondary" icon={Plus} size="sm" loading={addPayment.isPending} onClick={handleAddPayment}>
              Add Payment
            </Button>
          )}
          <a href={invoiceAPI.getPDF(id)} download target="_blank" rel="noopener noreferrer">
            <Button icon={Download} size="sm">Download PDF</Button>
          </a>
        </div>
      </div>

      {/* Invoice Card */}
      <div className="card p-6">
        {/* Header */}
        <div className="flex justify-between mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bill To</p>
            <p className="font-bold text-gray-900">{invoice?.customer_name}</p>
            {invoice?.customer_gst && <p className="text-sm text-gray-500">GST: {invoice.customer_gst}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Invoice</p>
            <p className="font-bold text-gray-900 text-lg">{invoice?.invoice_number}</p>
            <p className="text-sm text-gray-500">Date: {formatDate(invoice?.invoice_date)}</p>
            {invoice?.due_date && <p className="text-sm text-gray-500">Due: {formatDate(invoice?.due_date)}</p>}
          </div>
        </div>

        {/* Items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium">Description</th>
                <th className="text-center py-2 pr-4 text-xs text-gray-500 font-medium">HSN</th>
                <th className="text-right py-2 pr-4 text-xs text-gray-500 font-medium">Qty</th>
                <th className="text-right py-2 pr-4 text-xs text-gray-500 font-medium">Rate</th>
                <th className="text-right py-2 pr-4 text-xs text-gray-500 font-medium">GST</th>
                <th className="text-right py-2 text-xs text-gray-500 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 pr-4 font-medium text-gray-900">{item.description}</td>
                  <td className="py-3 pr-4 text-center text-gray-500 text-xs">{item.hsn_code || '—'}</td>
                  <td className="py-3 pr-4 text-right">{item.quantity} {item.unit}</td>
                  <td className="py-3 pr-4 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 pr-4 text-right text-gray-500">{item.gst_rate}%</td>
                  <td className="py-3 text-right font-semibold">{formatCurrency(item.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 border-t border-gray-100 pt-4 flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice?.subtotal)}</span>
            </div>
            {invoice?.cgst_amount > 0 && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>CGST</span>
                  <span>{formatCurrency(invoice?.cgst_amount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST</span>
                  <span>{formatCurrency(invoice?.sgst_amount)}</span>
                </div>
              </>
            )}
            {invoice?.igst_amount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>IGST</span>
                <span>{formatCurrency(invoice?.igst_amount)}</span>
              </div>
            )}
            {invoice?.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(invoice?.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
              <span>Total</span>
              <span>{formatCurrency(invoice?.net_amount)}</span>
            </div>
            <div className="flex justify-between text-green-600 font-medium">
              <span>Paid</span>
              <span>{formatCurrency(invoice?.paid_amount)}</span>
            </div>
            {Number(invoice?.balance_amount) > 0 && (
              <div className="flex justify-between text-red-600 font-bold">
                <span>Balance Due</span>
                <span>{formatCurrency(invoice?.balance_amount)}</span>
              </div>
            )}
          </div>
        </div>

        {invoice?.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{invoice.notes}</p>
          </div>
        )}
        {invoice?.terms && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Terms & Conditions</p>
            <p className="text-xs text-gray-500">{invoice.terms}</p>
          </div>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Payment History</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <DollarSign size={14} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-gray-500">{p.payment_mode?.replace(/_/g, ' ')} {p.reference ? `• ${p.reference}` : ''}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">{formatDate(p.payment_date)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetail;
