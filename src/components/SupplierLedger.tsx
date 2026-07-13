import React, { useState } from 'react';
import { Project, SupplierPayment } from '../types';
import { useAppContext } from '../store';
import { Store, IndianRupee, Plus, Trash2, Calendar, FileText, Lock } from 'lucide-react';
import { formatINR, normalizeVendorName } from '../lib/utils';

export function SupplierLedger({ project }: { project: Project }) {
  const { state, updateProject, updateUser, addToast, confirm, prompt, addToRecycleBin } = useAppContext();
  const isAdminOrOfficeStaff = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';
  
  if (!isAdminOrOfficeStaff) return null;

  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
    vendor: string;
    amount: string;
    date: string;
    note: string;
    paidBy: 'office' | 'petty_cash';
  } | null>(null);

  // Compute vendor ledger
  const vendorMap = new Map<string, {
    totalBilled: number;
    totalPaidInitially: number;
    payments: (SupplierPayment & { isDirectBill?: boolean; billItemName?: string })[];
  }>();

  (project.expenseItems || []).forEach(item => {
    if (item.category === 'material' && item.status === 'Approved' && item.vendor && item.vendor.trim() !== '') {
      const vName = normalizeVendorName(item.vendor);
      // Exclude payments/bills that belong to other dedicated ledgers (Labor, Machinery, Shifting, Subcontractors)
      if (
        vName.startsWith('LABOR:') || 
        vName.startsWith('MACHINE:') || 
        vName.startsWith('SHIFTING:') || 
        vName.startsWith('SUBCONTRACTOR:')
      ) {
        return;
      }
      if (!vendorMap.has(vName)) vendorMap.set(vName, { totalBilled: 0, totalPaidInitially: 0, payments: [] });
      const record = vendorMap.get(vName)!;
      record.totalBilled += item.amount;
      if (item.paidBy && item.paidBy !== 'unpaid' && item.paidBy !== 'used') {
        record.totalPaidInitially += item.amount;
        // Push a virtual payment representing direct payment at the time of entry
        record.payments.push({
          id: `bill-pay-${item.id}`,
          vendorName: vName,
          amount: item.amount,
          date: item.date,
          note: `${item.itemName || 'Material'}${item.quantity ? ` (${item.quantity})` : ''} (Direct Paid Bill)`,
          paidBy: item.paidBy,
          isDirectBill: true,
          billItemName: item.itemName
        });
      }
    }
  });

  (project.supplierPayments || []).forEach(pay => {
    if (pay.status === 'Rejected' || pay.status === 'Pending Approval') {
      return;
    }
    const vName = normalizeVendorName(pay.vendorName);
    // Exclude payments that belong to other dedicated ledgers (Labor, Machinery, Shifting, Subcontractors)
    if (
      vName.startsWith('LABOR:') || 
      vName.startsWith('MACHINE:') || 
      vName.startsWith('SHIFTING:') || 
      vName.startsWith('SUBCONTRACTOR:')
    ) {
      return;
    }
    
    if (!vendorMap.has(vName)) {
      vendorMap.set(vName, { totalBilled: 0, totalPaidInitially: 0, payments: [] });
    }
    const record = vendorMap.get(vName)!;
    record.payments.push({
      ...pay,
      isDirectBill: false
    });
  });

  const vendors = Array.from(vendorMap.entries()).map(([name, data]) => {
    // Sort payments by date descending
    const sortedPayments = [...data.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalPaid = Math.round(sortedPayments.reduce((acc, p) => acc + p.amount, 0));
    const totalBilled = Math.round(data.totalBilled);
    
    // balance > 0 means we still owe money (Due)
    // balance < 0 means we overpaid (Advance/Extra Payment)
    const balance = totalBilled - totalPaid;

    return {
      name,
      ...data,
      totalBilled,
      payments: sortedPayments,
      totalPaid,
      balance
    };
  }).filter(v => v.totalBilled > 0 || v.payments.length > 0);

  if (vendors.length === 0) return null;

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm) return;

    if (!paymentForm.amount || isNaN(Number(paymentForm.amount)) || Number(paymentForm.amount) <= 0) {
      return addToast("Invalid payment amount", "error");
    }

    const newPayment: SupplierPayment = {
      id: `spay-${Date.now()}`,
      vendorName: paymentForm.vendor,
      amount: Number(paymentForm.amount),
      date: paymentForm.date,
      note: paymentForm.note,
      paidBy: paymentForm.paidBy,
      submittedBy: state.currentUser?.name,
      submittedById: state.currentUser?.id,
      submittedByRole: state.currentUser?.role
    };

    updateProject(project.id, {
      supplierPayments: [...(project.supplierPayments || []), newPayment]
    });

    if (newPayment.paidBy === 'petty_cash' && state.currentUser) {
      if (state.currentUser.role !== 'Admin' && state.currentUser.role !== 'Super Admin') {
        const currentBal = state.currentUser.pettyCashBalance || 0;
        updateUser(state.currentUser.id, { pettyCashBalance: currentBal - newPayment.amount });
      }
    }

    setPaymentForm(null);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!await confirm("Are you sure you want to delete this payment?")) return;

    const enteredPin = await prompt("Enter your Password to confirm deleting this payment:");
    if (enteredPin === null) return;
    
    try {
      const res = await window.fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: state.currentUser?.phone, pin: enteredPin })
      });
      
      if (!res.ok) {
        addToast("Incorrect Password.", "error");
        return;
      }
    } catch (err) {
      addToast("Failed to verify password.", "error");
      return;
    }

    const reason = await prompt("Please provide a reason for deleting this payment:");
    if (!reason) return;

    const paymentToDelete = project.supplierPayments?.find(p => p.id === paymentId);
    
    if (paymentToDelete) {
      if (paymentToDelete.paidBy === 'petty_cash' && paymentToDelete.submittedById) {
        const user = state.users.find(u => u.id === paymentToDelete.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + paymentToDelete.amount });
        }
      }

      addToRecycleBin({
        projectId: project.id,
        itemType: 'SupplierPayment',
        itemName: paymentToDelete.vendorName || 'Supplier Payment',
        itemData: paymentToDelete,
        deletedBy: state.currentUser?.name || 'Unknown',
        deleteReason: reason
      });

      updateProject(project.id, {
        supplierPayments: (project.supplierPayments || []).filter(p => p.id !== paymentId)
      });
      
      addToast("Payment deleted successfully.", "success");
    }
  };

  return (
    <div className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Store className="w-5 h-5 text-indigo-500" />
          Material Suppliers & Vendors
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {vendors.map((v) => (
          <div key={v.name} className="p-4 sm:p-6 transition-colors hover:bg-slate-50/50">
            <div 
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
              onClick={() => setExpandedVendor(expandedVendor === v.name ? null : v.name)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-lg font-bold text-slate-800">{v.name}</h4>
                  {v.balance > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{state.language === 'hi' ? 'बाकी (Due)' : 'Due'}</span>}
                  {v.balance < 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{state.language === 'hi' ? 'अग्रिम (Advance)' : 'Advance'}</span>}
                  {v.balance === 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{state.language === 'hi' ? 'चुक्ता (Settled)' : 'Settled'}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span className="text-slate-500 font-medium">{state.language === 'hi' ? 'कुल बिल:' : 'Billed:'} <span className="text-slate-700">{formatINR(v.totalBilled)}</span></span>
                  <span className="text-slate-500 font-medium">{state.language === 'hi' ? 'कुल भुगतान:' : 'Paid:'} <span className="text-emerald-600">{formatINR(v.totalPaid)}</span></span>
                  {v.balance < 0 && (
                    <span className="text-amber-600 font-semibold">{state.language === 'hi' ? 'अतिरिक्त भुगतान:' : 'Extra Payment:'} <span>{formatINR(Math.abs(v.balance))}</span></span>
                  )}
                </div>
              </div>
              <div className="flex flex-row md:flex-col items-center md:items-end justify-between sm:justify-center gap-2">
                <div className="text-right">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mb-0.5">
                    {v.balance < 0 
                      ? (state.language === 'hi' ? 'अग्रिम राशि' : 'Advance Paid') 
                      : (state.language === 'hi' ? 'बाकी राशि' : 'Balance Due')}
                  </span>
                  <span className={`text-xl font-bold ${v.balance > 0 ? 'text-red-600' : v.balance < 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {formatINR(v.balance > 0 ? v.balance : (v.balance < 0 ? Math.abs(v.balance) : 0))}
                  </span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPaymentForm({
                      vendor: v.name,
                      amount: '',
                      date: new Date().toISOString().split('T')[0],
                      note: 'Partial payment',
                      paidBy: 'office'
                    });
                    setExpandedVendor(v.name);
                  }}
                  className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Pay Now
                </button>
              </div>
            </div>

            {/* Expanded Ledger View */}
            {expandedVendor === v.name && (
              <div className="mt-6 pt-4 border-t border-slate-100 animate-in fade-in duration-300">
                <h5 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Payment History & Ledger</h5>
                
                {paymentForm?.vendor === v.name && (
                  <form onSubmit={handleAddPayment} className="mb-6 bg-slate-100/50 p-4 rounded-xl border border-slate-200">
                    <h6 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><IndianRupee className="w-4 h-4"/> Record Payment to {v.name}</h6>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                        <input type="date" required value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹)</label>
                        <input type="number" required min="1" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} placeholder="e.g. 50000" className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Paid From</label>
                        <select value={paymentForm.paidBy} onChange={e => setPaymentForm({...paymentForm, paidBy: e.target.value as any})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="office">Office Account</option>
                          <option value="petty_cash">Petty Cash (Site)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Ref</label>
                        <input type="text" value={paymentForm.note} onChange={e => setPaymentForm({...paymentForm, note: e.target.value})} placeholder="RTGS/Check No." className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold text-sm transition-colors">Save Payment</button>
                      <button type="button" onClick={() => setPaymentForm(null)} className="text-slate-500 hover:text-slate-700 font-semibold text-sm">Cancel</button>
                    </div>
                  </form>
                )}

                {v.payments.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No extra/partial payments recorded for this vendor yet.</p>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Paid By/Ref</th>
                          <th className="px-4 py-3 font-semibold text-right">Amount</th>
                          <th className="px-4 py-3 font-semibold text-center w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {v.payments.map(p => (
                          <tr key={p.id} className={p.isDirectBill ? "bg-amber-50/20" : ""}>
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {p.date}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold flex items-center gap-1 text-slate-700">
                                    <FileText className="w-3 h-3 text-slate-400 shrink-0"/>
                                    {p.paidBy === 'office' ? 'Office Account' : p.paidBy === 'petty_cash' ? 'Petty Cash (Site)' : p.paidBy}
                                  </span>
                                  {p.isDirectBill && (
                                    <span className="text-[9px] bg-amber-100 border border-amber-200 text-amber-800 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      {state.language === 'hi' ? 'सीधा भुगतान (बिल)' : 'Direct Paid Bill'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-slate-500 font-medium whitespace-normal break-words max-w-md">{p.note}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatINR(p.amount)}</td>
                            <td className="px-4 py-3 text-center">
                              {p.isDirectBill ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 border border-slate-200 text-slate-500 font-bold px-2 py-1 rounded" title="This was recorded automatically when adding a paid material entry. To change it, edit or delete the material bill entry.">
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  {state.language === 'hi' ? 'लिंक्ड' : 'Linked'}
                                </span>
                              ) : (
                                <button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors" title="Delete payment">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
