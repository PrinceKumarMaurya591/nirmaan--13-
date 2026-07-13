import React, { useState } from 'react';
import { Hammer, Plus, IndianRupee, History, TrendingUp, X, Check, FileText, Trash2, Edit2 } from 'lucide-react';
import { useAppContext } from '../store';
import { cn } from '../lib/utils';
import { Project, Subcontractor } from '../types';

export function SubcontractorTracker({ project }: { project: Project }) {
  const { state, updateProject, confirm, addToRecycleBin } = useAppContext();
  
  const canView = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff' || (state.currentRole === 'Site Incharge' && state.currentUser?.canViewSubcontractors);
  
  if (!canView) return null;

  const [isOpen, setIsOpen] = useState(state.currentView === 'subcontractor_view' || state.currentRole === 'Site Incharge' || state.currentRole === 'Munshi');
  const subs = project.subcontractors || [];

  return (
    <div id="subcontractor-tracker" className="mt-8 border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
      <div 
        className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
             <Hammer className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-indigo-900">Subcontractors</h3>
            <p className="text-xs text-indigo-600 font-medium">{subs.length} Active Contracts</p>
          </div>
        </div>
        <button className="text-indigo-600 hover:bg-indigo-100 p-1 rounded transition-colors font-bold text-sm">
          {isOpen ? 'Close' : 'Manage Subcontractors'}
        </button>
      </div>
      
      {isOpen && (
        <div className="p-4 sm:p-6">
           <SubcontractorManager project={project} subs={subs} />
        </div>
      )}
    </div>
  );
}

function SubcontractorManager({ project, subs }: { project: Project, subs: Subcontractor[] }) {
  const { state, updateProject, confirm, updateUser, addToRecycleBin, prompt, addToast } = useAppContext();
  const isMobileView = state.currentView === 'subcontractor_view' || state.currentRole === 'Munshi' || state.currentRole === 'Site Incharge';
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', workDescription: '', rate: '', unit: 'Sq Ft', estimatedQuantity: '' });
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [editSubId, setEditSubId] = useState<string | null>(null);

  const [progressForm, setProgressForm] = useState({ quantity: '', date: new Date().toISOString().split('T')[0] });
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '', date: new Date().toISOString().split('T')[0], paidBy: 'cash' });

  const handleAddSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.rate || !form.workDescription) return;
    
    if (editSubId) {
      const updatedSubs = subs.map(s => s.id === editSubId ? { 
        ...s, 
        name: form.name, 
        phone: form.phone, 
        workDescription: form.workDescription, 
        rate: Number(form.rate), 
        unit: form.unit, 
        estimatedQuantity: form.estimatedQuantity ? Number(form.estimatedQuantity) : undefined 
      } : s);
      updateProject(project.id, (prev: any) => ({ subcontractors: (prev.subcontractors || []).map((s: any) => s.id === editSubId ? { ...s, name: form.name, phone: form.phone, workDescription: form.workDescription, rate: Number(form.rate), unit: form.unit, estimatedQuantity: form.estimatedQuantity ? Number(form.estimatedQuantity) : undefined } : s) }));
      setEditSubId(null);
    } else {
      const newSub: Subcontractor = {
        id: `sub_${Date.now()}`,
        name: form.name,
        phone: form.phone,
        workDescription: form.workDescription,
        rate: Number(form.rate),
        unit: form.unit,
        estimatedQuantity: form.estimatedQuantity ? Number(form.estimatedQuantity) : undefined,
        progress: [],
        payments: []
      };
      updateProject(project.id, { subcontractors: [...subs, newSub] });
    }

    setShowAddForm(false);
    setForm({ name: '', phone: '', workDescription: '', rate: '', unit: 'Sq Ft', estimatedQuantity: '' });
  };

  const handleAddProgress = (subId: string) => {
    if (!progressForm.quantity) return;
    
    const newProgress = {
      id: `prog_${Date.now()}`,
      date: progressForm.date,
      quantity: Number(progressForm.quantity),
      reportedBy: state.currentUser?.name || 'Unknown'
    };

    updateProject(project.id, (prev: any) => ({ 
      subcontractors: (prev.subcontractors || []).map((s: any) => 
        s.id === subId ? { ...s, progress: [...(s.progress||[]), newProgress] } : s
      ) 
    }));
    setProgressForm({ quantity: '', date: new Date().toISOString().split('T')[0] });
  };

  const handleAddPayment = (subId: string) => {
    if (!paymentForm.amount) return;
    
    const newPayment = {
      id: `pay_${Date.now()}`,
      date: paymentForm.date,
      amount: Number(paymentForm.amount),
      note: paymentForm.note,
      paidBy: paymentForm.paidBy,
      submittedBy: state.currentUser?.name || 'Unknown'
    };

    updateProject(project.id, (prev: any) => ({ 
      subcontractors: (prev.subcontractors || []).map((s: any) => 
        s.id === subId ? { ...s, payments: [...(s.payments||[]), newPayment] } : s
      ) 
    }));
    setPaymentForm({ amount: '', note: '', date: new Date().toISOString().split('T')[0], paidBy: 'cash' });
  };

  const handleDeleteSub = async (subId: string) => {
    if (!await confirm("Delete this subcontractor? All history will be lost.")) return;
    const sub = subs.find(s => s.id === subId);
    if (sub) {
      addToRecycleBin({
        projectId: project.id,
        itemType: 'Subcontractor',
        itemName: `${sub.name} (Subcontractor)`,
        itemData: sub,
        deletedBy: state.currentUser?.name || 'Unknown',
        deleteReason: 'User Deleted Subcontractor'
      });
    }
    updateProject(project.id, { subcontractors: subs.filter(s => s.id !== subId) });
  };

  const handleDeleteProgress = async (subId: string, progressId: string) => {
    if (!await confirm("Delete this work log?")) return;

    const enteredPin = await prompt("Enter your Password to confirm deleting this work log:");
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

    const reason = await prompt("Please provide a reason for deleting this work log:");
    if (!reason) return;

    const sub = subs.find(s => s.id === subId);
    const prog = sub?.progress.find(p => p.id === progressId);
    if (prog) {
      addToRecycleBin({
        projectId: project.id,
        itemType: 'Subcontractor Work Log',
        itemName: `Work Log for ${sub?.name} - ${prog.quantity} ${sub?.unit}`,
        itemData: { subId, progressId, data: prog },
        deletedBy: state.currentUser?.name || 'Unknown',
        deleteReason: reason
      });
    }
    updateProject(project.id, (prev: any) => ({ subcontractors: (prev.subcontractors||[]).map((s: any) => s.id === subId ? { ...s, progress: s.progress.filter((p: any) => p.id !== progressId) } : s) }));
    addToast("Work log deleted successfully.", "success");
  };

  const handleDeletePayment = async (subId: string, paymentId: string) => {
    if (!await confirm("Delete this payment?")) return;

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

    const sub = subs.find(s => s.id === subId);
    const pay = sub?.payments.find(p => p.id === paymentId);
    if (pay) {
      addToRecycleBin({
        projectId: project.id,
        itemType: 'Subcontractor Payment',
        itemName: `Payment for ${sub?.name} - ₹${pay.amount}`,
        itemData: { subId, paymentId, data: pay },
        deletedBy: state.currentUser?.name || 'Unknown',
        deleteReason: reason
      });
    }
    updateProject(project.id, (prev: any) => ({ subcontractors: (prev.subcontractors||[]).map((s: any) => s.id === subId ? { ...s, payments: s.payments.filter((p: any) => p.id !== paymentId) } : s) }));
    addToast("Payment deleted successfully.", "success");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h4 className="font-bold text-slate-800">Assigned Subcontractors</h4>
         <button 
           onClick={() => setShowAddForm(!showAddForm)}
           className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors"
         >
           <Plus className="w-4 h-4" /> Add Subcontractor
         </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddSub} className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Subcontractor Name / Firm</label>
            <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 outline-none" placeholder="Raju Tiles Contractor" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Phone Number</label>
            <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 outline-none" placeholder="9876543210" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Work Description</label>
            <input required type="text" value={form.workDescription} onChange={e => setForm({...form, workDescription: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 outline-none" placeholder="e.g. Wall Plaster, Tile Fixing" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Rate (₹)</label>
              <input required type="number" value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 outline-none" placeholder="15" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Unit</label>
              <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 outline-none bg-white">
                <option>Sq Ft</option>
                <option>Sq Meter</option>
                <option>Running Ft</option>
                <option>Running Meter</option>
                <option>Running Sq Ft</option>
                <option>Running Sq Meter</option>
                <option>Running Sqr Ft</option>
                <option>Running Sqr Meter</option>
                <option>Brass (100 Cft)</option>
                <option>Cubic Ft</option>
                <option>Cubic Meter</option>
                <option>Kg</option>
                <option>Metric Ton</option>
                <option>Numbers</option>
                <option>Bags</option>
                <option>Lumpsum</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Total Est. Qty (Optional)</label>
            <input type="number" value={form.estimatedQuantity} onChange={e => setForm({...form, estimatedQuantity: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 outline-none" placeholder="e.g. 5000" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => { setShowAddForm(false); setEditSubId(null); setForm({ name: '', phone: '', workDescription: '', rate: '', unit: 'Sq Ft', estimatedQuantity: '' }) }} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded shadow hover:bg-indigo-700 transition-colors">Save Subcontractor</button>
          </div>
        </form>
      )}

      {subs.length === 0 ? (
        <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Hammer className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-medium text-sm">No subcontractors assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subs.map(sub => {
            const safeRate = Number(sub.rate) || 0;
            const totalWork = (sub.progress || []).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
            const totalEarning = totalWork * safeRate;
            const totalPaid = (sub.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const balance = totalEarning - totalPaid;
            
            const isExpanded = expandedSubId === sub.id;

            return (
              <div key={sub.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                <div 
                  className="p-4 bg-slate-50 cursor-pointer flex flex-col gap-4 select-none hover:bg-slate-100/70 transition-colors"
                  onClick={() => setExpandedSubId(isExpanded ? null : sub.id)}
                >
                  {/* Basic Info */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <h5 className="font-bold text-slate-800 text-base md:text-lg break-words leading-tight">{sub.name}</h5>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                          {sub.workDescription}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/85 text-slate-700">
                          ₹{safeRate} / {sub.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                      {sub.phone && <span>📞 {sub.phone}</span>}
                      {sub.estimatedQuantity && (
                        <span>Est. Qty: <strong className="text-slate-700">{sub.estimatedQuantity} {sub.unit}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Financial Info and Actions */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t pt-3 border-slate-200/60">
                    <div className="grid grid-cols-2 md:flex md:items-center gap-3 md:gap-6 w-full md:w-auto">
                      <div className="bg-white md:bg-transparent p-2 md:p-0 rounded-lg border md:border-0 border-slate-100 shadow-3xs md:shadow-none flex flex-col md:items-start">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Work Value</p>
                        <p className="text-sm font-extrabold text-slate-800">₹{totalEarning.toLocaleString()}</p>
                      </div>
                      <div className="bg-white md:bg-transparent p-2 md:p-0 rounded-lg border md:border-0 border-slate-100 shadow-3xs md:shadow-none flex flex-col md:items-start">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance Due</p>
                        <p className={cn("text-sm font-extrabold", balance > 0 ? "text-amber-600" : balance < 0 ? "text-emerald-600" : "text-slate-600")}>
                          ₹{balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0 border-t md:border-0 pt-2 md:pt-0 border-slate-100">
                      {(state.currentRole === 'Super Admin' || state.currentRole === 'Admin') && (
                        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg shadow-3xs">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm({
                                name: sub.name,
                                phone: sub.phone || '',
                                workDescription: sub.workDescription || '',
                                rate: String(sub.rate),
                                unit: sub.unit,
                                estimatedQuantity: sub.estimatedQuantity ? String(sub.estimatedQuantity) : ''
                              });
                              setEditSubId(sub.id);
                              setShowAddForm(true);
                            }}
                            className="text-slate-500 hover:text-indigo-600 transition-colors p-1.5 hover:bg-slate-50 rounded"
                            title="Edit Subcontractor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteSub(sub.id); }}
                            className="text-slate-500 hover:text-red-500 transition-colors p-1.5 hover:bg-slate-50 rounded"
                            title="Delete Subcontractor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="bg-white border border-slate-200 p-1.5 rounded-lg text-slate-400 shadow-3xs hover:text-indigo-600 hover:border-slate-300 transition-colors ml-auto md:ml-0">
                        {isExpanded ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="flex flex-col lg:flex-row gap-6">
                      
                      {/* Work Progress Section */}
                      <div className="border border-slate-100 rounded-lg bg-slate-50 p-3 md:p-4">
                        <h6 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                          <TrendingUp className="w-4 h-4 text-emerald-600" /> Work Log
                        </h6>
                        <div className="flex flex-col md:flex-row gap-2 mb-4">
                          <div className="flex flex-col md:flex-row flex-1 gap-2">
                            <input type="date" value={progressForm.date} onChange={e => setProgressForm({...progressForm, date: e.target.value})} className="border border-slate-300 rounded px-2.5 py-2 text-sm outline-none w-full bg-white" />
                            <input type="number" placeholder={`Qty (${sub.unit})`} value={progressForm.quantity} onChange={e => setProgressForm({...progressForm, quantity: e.target.value})} className="border border-slate-300 rounded px-2.5 py-2 text-sm outline-none w-full bg-white" />
                          </div>
                          <button onClick={() => handleAddProgress(sub.id)} className="bg-emerald-600 text-white px-4 py-2.5 rounded text-sm font-bold hover:bg-emerald-700 w-full md:w-auto shrink-0 shadow-3xs transition-colors">Add Work</button>
                        </div>
                        <div className="text-sm font-medium text-slate-800 mb-2 p-2 bg-white rounded border border-slate-200 flex justify-between">
                          <span>Total Completed:</span>
                          <span className="text-emerald-700 font-bold">{totalWork} {sub.unit}</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 no-scrollbar">
                          {sub.progress.slice().reverse().map(p => (
                            <div key={p.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-0 hover:bg-slate-100/50 transition-colors px-1 rounded">
                              <div className="flex flex-col">
                                <span className="text-slate-500 font-medium">{p.date} • by {p.reportedBy}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-700">+{p.quantity} {sub.unit}</span>
                                {(state.currentRole === 'Super Admin' || state.currentRole === 'Admin') && (
                                  <button onClick={() => handleDeleteProgress(sub.id, p.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Payment Section */}
                      <div className="border border-slate-100 rounded-lg bg-slate-50 p-3 md:p-4">
                        <h6 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                          <IndianRupee className="w-4 h-4 text-amber-600" /> Payment & Advances
                        </h6>
                        <div className="flex flex-col gap-2 mb-4">
                          <div className="flex flex-col md:flex-row gap-2">
                            <input type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="border border-slate-300 rounded px-2.5 py-2 text-sm outline-none w-full bg-white" />
                            <input type="number" placeholder="₹ Amount" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="border border-slate-300 rounded px-2.5 py-2 text-sm outline-none w-full bg-white" />
                          </div>
                          <div className="flex flex-col md:flex-row gap-2">
                            <input type="text" placeholder="Note (Optional)" value={paymentForm.note} onChange={e => setPaymentForm({...paymentForm, note: e.target.value})} className="border border-slate-300 rounded px-2.5 py-2 text-sm outline-none w-full bg-white" />
                            <button onClick={() => handleAddPayment(sub.id)} className="bg-amber-600 text-white px-4 py-2.5 rounded text-sm font-bold hover:bg-amber-700 w-full md:w-24 shrink-0 shadow-3xs transition-colors">Pay</button>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-slate-800 mb-2 p-2 bg-white rounded border border-slate-200 flex justify-between">
                          <span>Total Paid:</span>
                          <span className="text-amber-700 font-bold">₹{totalPaid.toLocaleString()}</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 no-scrollbar">
                          {sub.payments.slice().reverse().map(p => (
                            <div key={p.id} className="flex flex-col py-1.5 border-b border-slate-100 last:border-0 hover:bg-slate-100/50 transition-colors px-1 rounded">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-medium">{p.date}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-rose-600">₹{p.amount.toLocaleString()}</span>
                                  {(state.currentRole === 'Super Admin' || state.currentRole === 'Admin') && (
                                    <button onClick={() => handleDeletePayment(sub.id, p.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {p.note && <p className="text-[10px] text-slate-400 mt-0.5">{p.note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
