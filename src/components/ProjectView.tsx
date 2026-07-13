import React, { useState, useRef } from 'react';
import { useAppContext } from '../store';
import { formatINR, resizeImage, openMediaInNewTab, normalizeVendorName } from '../lib/utils';
import { FileText, Camera, Box, Truck, Users, Settings2, Receipt, ArrowLeft, PlusCircle, CheckCircle, Upload, Edit2, Save, X, Wallet, Download, Printer, Trash2, Hammer, CheckCircle2, XCircle, AlertCircle, Activity, Search, ArrowDownLeft, ArrowUpRight, Check, Coins, Eye, Sparkles, ChevronDown, ChevronUp, Calendar, Banknote } from 'lucide-react';
import { Project, ExpenseEntry, SupplierPayment } from '../types';
import { SitePhotoGallery } from './SitePhotoGallery';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


function StaffHistoryModal({ userName, project, onClose }: { userName: string, project: Project, onClose: () => void }) {
  const { state, updateProject, updateUser, addToast, confirm, prompt, addToRecycleBin, addApprovalRequest } = useAppContext();
  const isAdminOrOfficeStaff = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', date: '', note: '', desc: '' });

  const advances = project.advanceHistory?.filter(a => a.userName === userName) || [];
  const expenseItems = project.expenseItems?.filter(i => i.submittedBy === userName && i.paidBy === 'petty_cash' && i.status !== 'Rejected') || [];
  const supplierPayments = project.supplierPayments?.filter(p => p.submittedBy === userName && p.paidBy === 'petty_cash') || [];

  const totalAdvance = advances.reduce((s, a) => s + a.amount, 0);
  const totalExpense = expenseItems.reduce((s, i) => s + i.amount, 0) + supplierPayments.reduce((s, p) => s + p.amount, 0);
  const balance = totalAdvance - totalExpense;

  const combinedExpenses = [
    ...expenseItems.map(e => ({ id: e.id, date: e.date, type: 'Expense', desc: e.itemName, amount: e.amount, status: e.status })),
    ...supplierPayments.map(p => ({ id: p.id, date: p.date, type: 'Supplier Payment', desc: p.vendorName, amount: p.amount, status: 'Paid' }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDeleteAdvance = async (advId: string, userId: string, amt: number) => {
    const reason = await prompt("Please provide a reason for deletion:");
    if (!reason) return;
    
    const itemToDelete = (project.advanceHistory || []).find(a => a.id === advId);
    if (!itemToDelete) return;

    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      addApprovalRequest({
        projectId: project.id,
        module: 'AdvanceEntry',
        recordId: itemToDelete.id,
        itemName: `Advance given to user ${userId}`,
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: itemToDelete
      });
      addToast('Deletion request submitted for Admin approval.', 'info');
      return;
    }

    const user = state.users.find(u => u.id === userId);
    if (user) {
      updateUser(userId, { pettyCashBalance: (user.pettyCashBalance || 0) - amt });
    }
    
    addToRecycleBin({
      projectId: project.id,
      itemType: 'AdvanceEntry',
      itemName: `Advance given to user ${userId}`,
      itemData: itemToDelete,
      deletedBy: state.currentUser?.name || 'Unknown',
      deleteReason: 'Deleted by Admin'
    });

    const updated = (project.advanceHistory || []).filter(a => a.id !== advId);
    updateProject(project.id, { advanceHistory: updated });
    addToast('Advance payment log deleted successfully', 'success');
  };

  const handleSaveAdvance = (adv: any) => {
    const newAmt = Number(editForm.amount) || 0;
    if (newAmt <= 0) return addToast('Amount must be positive', 'error');
    
    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...adv, amount: newAmt, date: editForm.date, note: editForm.note };
      addApprovalRequest({
        projectId: project.id,
        module: 'AdvanceEntry',
        recordId: adv.id,
        itemName: adv.itemName || adv.vendorName || adv.name || 'AdvanceEntry',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit of Advance Entry [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]',
        oldData: adv,
        newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingId(null);
      return;
    }

    const diff = newAmt - adv.amount;
    const user = state.users.find(u => u.id === adv.userId);
    if (user && diff !== 0) {
      updateUser(adv.userId, { pettyCashBalance: (user.pettyCashBalance || 0) + diff });
    }
    
    const updated = (project.advanceHistory || []).map(a => 
      a.id === adv.id ? { ...a, amount: newAmt, date: editForm.date, note: editForm.note } : a
    );
    updateProject(project.id, { advanceHistory: updated });
    setEditingId(null);
    addToast('Advance payment log updated successfully', 'success');
  };

  const handleDeleteExpense = async (id: string, type: string, amt: number) => {
    const isOfficeStaff = state.currentRole === 'Office Staff';
    const isAdminOrSuperAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin';
    let reason = '';
    
    if (!isOfficeStaff && !isAdminOrSuperAdmin) {
      const enteredPin = await prompt("Enter your Password to confirm deleting this entry:");
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

      reason = await prompt("Please provide a reason for deleting this entry:") || '';
      if (!reason) return;
    } else {
      if (isAdminOrSuperAdmin) {
        const ok = await confirm("Are you sure you want to delete this entry?");
        if (!ok) return;
      }
      reason = await prompt("Please provide a reason for deletion:") || '';
      if (!reason) return;
    }

    if (type === 'Expense') {
      const expItem = project.expenseItems?.find(i => i.id === id);
      if (!expItem) return;

      if (isOfficeStaff) {
        addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: expItem.id,
        itemName: expItem.itemName || 'ExpenseEntry',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: expItem
      });
        addToast('Deletion request submitted for Admin approval.', 'info');
        return;
      }

      if (expItem.status === 'Approved' && expItem.paidBy === 'petty_cash' && expItem.submittedById) {
        const user = state.users.find(u => u.id === expItem.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + expItem.amount });
        }
      }
      addToRecycleBin({
        projectId: project.id,
        itemType: 'ExpenseEntry',
        itemName: expItem.itemName,
        itemData: expItem,
        deletedBy: state.currentUser?.name || 'Unknown',
        deleteReason: 'Deleted by Admin'
      });
      const updated = (project.expenseItems || []).filter(i => i.id !== id);
      updateProject(project.id, { expenseItems: updated });
    } else {
      const pItem = project.supplierPayments?.find(p => p.id === id);
      if (!pItem) return;

      if (isOfficeStaff) {
        addApprovalRequest({
        projectId: project.id,
        module: 'SupplierPayment',
        recordId: pItem.id,
        itemName: pItem.vendorName || 'SupplierPayment',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: pItem
      });
        addToast('Deletion request submitted for Admin approval.', 'info');
        return;
      }

      if (pItem.paidBy === 'petty_cash' && pItem.submittedById) {
        const user = state.users.find(u => u.id === pItem.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + pItem.amount });
        }
      }
      addToRecycleBin({
        projectId: project.id,
        itemType: 'SupplierPayment',
        itemName: pItem.vendorName,
        itemData: pItem,
        deletedBy: state.currentUser?.name || 'Unknown',
        deleteReason: 'Deleted by Admin'
      });
      const updated = (project.supplierPayments || []).filter(p => p.id !== id);
      updateProject(project.id, { supplierPayments: updated });
    }
    addToast('Entry deleted successfully', 'success');
  };

  const handleSaveExpense = (id: string, type: string, originalAmt: number) => {
    const newAmt = Number(editForm.amount) || 0;
    if (newAmt <= 0) return addToast('Amount must be positive', 'error');

    const isOfficeStaff = state.currentRole === 'Office Staff';

    if (type === 'Expense') {
      const expItem = project.expenseItems?.find(i => i.id === id);
      if (expItem) {
        if (isOfficeStaff) {
          const editedData = { ...expItem, amount: newAmt, date: editForm.date, itemName: editForm.desc };
          addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: expItem.id,
        itemName: expItem.itemName || 'ExpenseEntry',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit of Expense Entry [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]',
        oldData: expItem,
        newData: editedData
      });
          addToast('Edit request submitted for Admin approval.', 'info');
          setEditingId(null);
          return;
        }

        const diff = newAmt - originalAmt;
        if (expItem.status === 'Approved' && expItem.paidBy === 'petty_cash' && expItem.submittedById && diff !== 0) {
          const user = state.users.find(u => u.id === expItem.submittedById);
          if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
            updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
          }
        }
      }
      const updated = (project.expenseItems || []).map(i => 
        i.id === id ? { ...i, amount: newAmt, date: editForm.date, itemName: editForm.desc } : i
      );
      updateProject(project.id, { expenseItems: updated });
    } else {
      const pItem = project.supplierPayments?.find(p => p.id === id);
      if (pItem) {
        if (isOfficeStaff) {
          const editedData = { ...pItem, amount: newAmt, date: editForm.date };
          addApprovalRequest({
        projectId: project.id,
        module: 'SupplierPayment',
        recordId: pItem.id,
        itemName: pItem.vendorName || 'SupplierPayment',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit of Supplier Payment [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]',
        oldData: pItem,
        newData: editedData
      });
          addToast('Edit request submitted for Admin approval.', 'info');
          setEditingId(null);
          return;
        }

        const diff = newAmt - originalAmt;
        if (pItem.paidBy === 'petty_cash' && pItem.submittedById && diff !== 0) {
          const user = state.users.find(u => u.id === pItem.submittedById);
          if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
            updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
          }
        }
      }
      const updated = (project.supplierPayments || []).map(p => 
        p.id === id ? { ...p, amount: newAmt, date: editForm.date } : p
      );
      updateProject(project.id, { supplierPayments: updated });
    }
    setEditingId(null);
    addToast('Entry updated successfully', 'success');
  };

  const sortedAdvances = [...advances].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="Go back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{userName}'s Ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">Site advance and expense history</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-950 font-bold px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg shadow-xs transition-colors">
          Close Ledger
        </button>
      </div>

      <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Total Received</p>
              <p className="text-2xl font-bold text-emerald-600">{formatINR(totalAdvance)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Total Spent</p>
              <p className="text-2xl font-bold text-orange-600">{formatINR(totalExpense)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Current Balance</p>
              <p className={`text-2xl font-bold ${balance < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatINR(balance)}</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Advances Received */}
            <div>
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-500" /> Advances Received
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {sortedAdvances.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">No advances received.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-slate-500">Date</th>
                          <th className="px-4 py-2 font-semibold text-slate-500">Note</th>
                        <th className="px-4 py-2 font-semibold text-slate-500 text-right">Amount</th>
                        {isAdminOrOfficeStaff && <th className="px-4 py-2 font-semibold text-slate-500 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedAdvances.map(a => {
                        const isEditing = editingId === a.id;
                        return (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input 
                                  type="date" 
                                  value={editForm.date} 
                                  onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                  className="border p-1 rounded text-xs w-28 bg-white" 
                                />
                              ) : (
                                new Date(a.date).toLocaleDateString()
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  value={editForm.note} 
                                  onChange={e => setEditForm({ ...editForm, note: e.target.value })} 
                                  className="border p-1 rounded text-xs w-full bg-white" 
                                />
                              ) : (
                                a.note || '-'
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={editForm.amount} 
                                  onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                  className="border p-1 rounded text-xs w-20 text-right bg-white" 
                                />
                              ) : (
                                <span className="font-bold text-emerald-600">{formatINR(a.amount)}</span>
                              )}
                            </td>
                            {isAdminOrOfficeStaff && (
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {isEditing ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button onClick={() => handleSaveAdvance(a)} className="text-emerald-600 hover:text-emerald-700 p-1 bg-emerald-50 hover:bg-emerald-100 rounded" title="Save"><Save className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 hover:bg-slate-200 rounded" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-1.5">
                                    <button onClick={() => { setEditingId(a.id); setEditForm({ date: a.date.split('T')[0], amount: String(a.amount), note: a.note || '', desc: '' }); }} className="text-slate-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeleteAdvance(a.id, a.userId, a.amount)} className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>

            {/* Expenses Made */}
            <div>
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-orange-500" /> Expenses Made
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {combinedExpenses.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">No expenses made.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-slate-500">Date</th>
                          <th className="px-4 py-2 font-semibold text-slate-500">Description</th>
                        <th className="px-4 py-2 font-semibold text-slate-500 text-right">Amount</th>
                        {isAdminOrOfficeStaff && <th className="px-4 py-2 font-semibold text-slate-500 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {combinedExpenses.map(e => {
                        const isEditing = editingId === e.id;
                        return (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input 
                                  type="date" 
                                  value={editForm.date} 
                                  onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                  className="border p-1 rounded text-xs w-28 bg-white" 
                                />
                              ) : (
                                new Date(e.date).toLocaleDateString()
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  value={editForm.desc} 
                                  onChange={e => setEditForm({ ...editForm, desc: e.target.value })} 
                                  className="border p-1 rounded text-xs w-full bg-white" 
                                />
                              ) : (
                                <>
                                  <div className="font-medium">{e.desc}</div>
                                  <div className="text-xs text-slate-400">{e.type}</div>
                                </>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={editForm.amount} 
                                  onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                  className="border p-1 rounded text-xs w-20 text-right bg-white" 
                                />
                              ) : (
                                <span className="font-bold text-orange-600">{formatINR(e.amount)}</span>
                              )}
                            </td>
                            {isAdminOrOfficeStaff && (
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {isEditing ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button onClick={() => handleSaveExpense(e.id, e.type, e.amount)} className="text-emerald-600 hover:text-emerald-700 p-1 bg-emerald-50 hover:bg-emerald-100 rounded" title="Save"><Save className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 hover:bg-slate-200 rounded" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-1.5">
                                    <button onClick={() => { setEditingId(e.id); setEditForm({ date: e.date.split('T')[0], amount: String(e.amount), note: '', desc: e.desc }); }} className="text-slate-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeleteExpense(e.id, e.type, e.amount)} className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

function SiteAdvanceTracker({ project }: { project: Project }) {
  const { state, updateProject, updateUser, addToast, confirm, prompt, addToRecycleBin, addApprovalRequest } = useAppContext();
  const [selectedUser, setSelectedUser] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [proofPhoto, setProofPhoto] = useState('');
  const [viewingStaffHistory, setViewingStaffHistory] = useState<string | null>(null);

  const [editingAdvId, setEditingAdvId] = useState<string | null>(null);
  const [editAdvForm, setEditAdvForm] = useState({ amount: '', date: '', note: '' });

  const handleDeleteAdvance = async (advId: string, userId: string, amt: number) => {
    const reason = await prompt("Please provide a reason for deletion:");
    if (!reason) return;
    
    const user = state.users.find(u => u.id === userId);
    if (user) {
      updateUser(userId, { pettyCashBalance: (user.pettyCashBalance || 0) - amt });
    }
    
    const itemToDelete = (project.advanceHistory || []).find(a => a.id === advId);
    if (itemToDelete) {
      addToRecycleBin({
        projectId: project.id,
        itemType: 'AdvanceEntry',
        itemName: `Advance given to user ${userId}`,
        itemData: itemToDelete,
        deletedBy: state.currentUser?.name || 'Unknown',
        deleteReason: 'Deleted by Admin'
      });
    }

    const updated = (project.advanceHistory || []).filter(a => a.id !== advId);
    updateProject(project.id, { advanceHistory: updated });
    addToast('Advance payment log deleted successfully', 'success');
  };

  const handleSaveAdvance = (adv: any) => {
    const newAmt = Number(editAdvForm.amount) || 0;
    if (newAmt <= 0) return addToast('Amount must be positive', 'error');
    
    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...adv, amount: newAmt, date: editAdvForm.date, note: editAdvForm.note };
      addApprovalRequest({
        projectId: project.id,
        module: 'AdvanceEntry',
        recordId: adv.id,
        itemName: adv.itemName || adv.vendorName || adv.name || 'AdvanceEntry',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit of Advance Entry [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]',
        oldData: adv,
        newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingAdvId(null);
      return;
    }

    const diff = newAmt - adv.amount;
    const user = state.users.find(u => u.id === adv.userId);
    if (user && diff !== 0) {
      updateUser(adv.userId, { pettyCashBalance: (user.pettyCashBalance || 0) + diff });
    }
    
    const updated = (project.advanceHistory || []).map(a => 
      a.id === adv.id ? { ...a, amount: newAmt, date: editAdvForm.date, note: editAdvForm.note } : a
    );
    updateProject(project.id, { advanceHistory: updated });
    setEditingAdvId(null);
    addToast('Advance payment log updated successfully', 'success');
  };

  const isAdminOrOfficeStaff = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';

  // Only consider Site Incharge or Munshi who are assigned to this project
  const staffArray = state.users.filter(u => (u.role === 'Site Incharge' || u.role === 'Munshi') && u.assignedProjects.includes(project.id));

  const handleAssignAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !amount || isNaN(Number(amount))) return;
    const userToFund = state.users.find(u => u.id === selectedUser);
    if (!userToFund) return;

    const newAdvance = {
      id: Date.now().toString(),
      date,
      userId: userToFund.id,
      userName: userToFund.name,
      userRole: userToFund.role,
      amount: Number(amount),
      note,
      proofPhoto
    };

    updateProject(project.id, {
      advanceHistory: [...(project.advanceHistory || []), newAdvance]
    });

    updateUser(userToFund.id, {
      pettyCashBalance: (userToFund.pettyCashBalance || 0) + Number(amount)
    });

    setAmount('');
    setNote('');
    setProofPhoto('');
  };

  const getExpensesForUser = (userName: string) => {
    const expenseTotal = project.expenseItems?.filter(i => i.submittedBy === userName && i.paidBy === 'petty_cash' && i.status !== 'Rejected').reduce((sum, item) => sum + item.amount, 0) || 0;
    const supplierTotal = project.supplierPayments?.filter(p => p.submittedBy === userName && p.paidBy === 'petty_cash').reduce((sum, item) => sum + item.amount, 0) || 0;
    return expenseTotal + supplierTotal;
  };

  const getAdvancesForUser = (userName: string) => {
    return project.advanceHistory?.filter(a => a.userName === userName).reduce((sum, item) => sum + item.amount, 0) || 0;
  };

  // Generate unique staff involved in this project (either received an advance, OR submitted an expense, OR currently assigned)
  const adminNames = state.users.filter(u => u.role === 'Admin' || u.role === 'Super Admin').map(u => u.name);
  const involvedUsers = Array.from(new Set([
    ...(project.advanceHistory?.map(a => a.userName) || []),
    ...(project.expenseItems?.map(e => e.submittedBy).filter(Boolean) as string[]) || [],
    ...(project.supplierPayments?.map(p => p.submittedBy).filter(Boolean) as string[]) || [],
    ...staffArray.filter(u => u.assignedProjects.includes(project.id)).map(u => u.name)
  ])).filter(name => !adminNames.includes(name));

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-8">
      <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center justify-between">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-amber-600" />
          Site Expense & Advance Tracking
        </h3>
      </div>
      
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap mb-6">
            <thead className="bg-slate-50 border-b border-slate-100 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 font-bold text-slate-500">Staff Name</th>
                <th className="px-4 py-3 font-bold text-slate-500 text-right">Total Advance Given</th>
                <th className="px-4 py-3 font-bold text-slate-500 text-right">Site Expenses Made</th>
                <th className="px-4 py-3 font-bold text-slate-500 text-right">Site Balance (Surplus/Deficit)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {involvedUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">No advance or expense records found for this site.</td>
                </tr>
              )}
              {involvedUsers.map(uName => {
                const adv = getAdvancesForUser(uName);
                const exp = getExpensesForUser(uName);
                const bal = adv - exp;
                return (
                  <tr key={uName} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setViewingStaffHistory(uName)}>
                    <td className="px-4 py-3 font-bold text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800">{uName}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600 text-right">{formatINR(adv)}</td>
                    <td className="px-4 py-3 font-bold text-orange-600 text-right">{formatINR(exp)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold px-2 py-1 rounded ${bal < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {formatINR(bal)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {viewingStaffHistory && (
          <StaffHistoryModal 
            userName={viewingStaffHistory} 
            project={project} 
            onClose={() => setViewingStaffHistory(null)} 
          />
        )}

        {isAdminOrOfficeStaff && (
          <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 mb-3 block">Issue Advance Payment for {project.name}</h4>
            {staffArray.length === 0 ? (
              <p className="text-sm text-slate-500 mb-2">No staff are currently assigned to this project. Please assign a Site Incharge or Munshi from User Management to issue advances.</p>
            ) : (
              <form onSubmit={handleAssignAdvance} className="space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <select 
                    value={selectedUser} 
                    onChange={e => setSelectedUser(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-500 flex-1 min-w-[200px]"
                  >
                    <option value="">Select Staff...</option>
                    {staffArray.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Amount ₹"
                    className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-500 w-full md:w-32"
                  />
                  <input 
                    type="text" 
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Note / Purpose"
                    className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-500 flex-1"
                  />
                  <button 
                    type="submit"
                    disabled={!selectedUser || !amount || isNaN(Number(amount))}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm w-full md:w-auto"
                  >
                    Add Advance
                  </button>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Camera className="w-3 h-3" /> Proof of Payment (Optional)
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const base64 = await resizeImage(file);
                        setProofPhoto(base64);
                      }
                    }} className="text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200" />
                    {proofPhoto && <img src={proofPhoto} alt="Proof" className="h-8 w-8 object-cover rounded border border-slate-200"/>}
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {project.advanceHistory && project.advanceHistory.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h4 className="text-sm font-bold text-slate-800 mb-3">Advance Payment Logs</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {[...project.advanceHistory].reverse().map(adv => {
                const isEditing = editingAdvId === adv.id;
                return (
                  <div key={adv.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-sm">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            value={editAdvForm.date} 
                            onChange={e => setEditAdvForm({ ...editAdvForm, date: e.target.value })} 
                            className="border p-1 rounded text-xs w-28 bg-white" 
                          />
                          <input 
                            type="number" 
                            placeholder="Amount"
                            value={editAdvForm.amount} 
                            onChange={e => setEditAdvForm({ ...editAdvForm, amount: e.target.value })} 
                            className="border p-1 rounded text-xs w-24 bg-white" 
                          />
                        </div>
                        <input 
                          type="text" 
                          placeholder="Note"
                          value={editAdvForm.note} 
                          onChange={e => setEditAdvForm({ ...editAdvForm, note: e.target.value })} 
                          className="border p-1 rounded text-xs w-full bg-white" 
                        />
                        <div className="flex justify-end gap-2 mt-1">
                          <button onClick={() => handleSaveAdvance(adv)} className="bg-emerald-500 text-white font-bold px-2 py-1 rounded text-xs hover:bg-emerald-600 transition-colors flex items-center gap-1 shadow-sm">
                            <Save className="w-3 h-3" /> Save
                          </button>
                          <button onClick={() => setEditingAdvId(null)} className="bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded text-xs hover:bg-slate-200 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {adv.proofPhoto ? (
                             <a href={adv.proofPhoto} target="_blank" rel="noreferrer" className="shrink-0">
                               <img src={adv.proofPhoto} alt="Proof" className="h-10 w-10 object-cover rounded border border-slate-200 hover:opacity-80 transition-opacity" />
                             </a>
                          ) : (
                             <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                               <FileText className="w-4 h-4" />
                             </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-700">{adv.userName} <span className="text-xs font-normal text-slate-400 ml-1">({adv.userRole})</span></p>
                            <p className="text-xs text-slate-500 mt-0.5">{adv.note || 'No note provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">{formatINR(adv.amount)}</p>
                            <p className="text-xs text-slate-400 font-medium">
                              {(() => {
                                if (!adv.date) return 'N/A';
                                const d = new Date(adv.date);
                                if (isNaN(d.getTime())) return adv.date;
                                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                              })()}
                            </p>
                          </div>
                          {isAdminOrOfficeStaff && (
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded px-1">
                              <button 
                                onClick={() => { setEditingAdvId(adv.id); setEditAdvForm({ date: adv.date ? adv.date.split('T')[0] : '', amount: String(adv.amount), note: adv.note || '' }); }} 
                                className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-100 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteAdvance(adv.id, adv.userId, adv.amount)} 
                                className="text-slate-400 hover:text-red-600 p-1 hover:bg-slate-100 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentReceivedForm({ project }: { project: Project }) {
  const { updateProject } = useAppContext();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!isNaN(val) && val > 0) {
      const newReceipt = { id: Date.now().toString(), date, amount: val, note };
      updateProject(project.id, { 
        received: project.received + val,
        receiptsHistory: [...(project.receiptsHistory || []), newReceipt]
      });
      setAmount('');
      setNote('');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddPayment} className="space-y-4">
        <div>
          <label className="text-sm font-bold text-slate-700">Record Department Payment</label>
          <p className="text-xs text-slate-500 mb-2">Log a running payment (bhugtaan) received for this contract.</p>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in ₹"
                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-emerald-500"
              />
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[130px] sm:w-40 shrink-0 bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note / Ref / Cheque No."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-emerald-500"
              />
              <button 
                type="submit"
                disabled={!amount || isNaN(Number(amount))}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold px-6 py-2.5 sm:py-2 rounded-lg transition-colors shadow-sm"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </form>

      {project.receiptsHistory && project.receiptsHistory.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Payment History</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {project.receiptsHistory.map(receipt => (
              <div key={receipt.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded border border-slate-100 text-sm">
                <div>
                  <p className="font-semibold text-slate-700">{formatINR(receipt.amount)}</p>
                  {receipt.note && <p className="text-xs text-slate-500 mt-0.5">{receipt.note}</p>}
                </div>
                <div className="text-slate-500 text-xs text-right whitespace-nowrap ml-4">
                  {(() => {
                    if (!receipt.date) return 'N/A';
                    const d = new Date(receipt.date);
                    if (isNaN(d.getTime())) return receipt.date;
                    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectStatusToggle({ project }: { project: Project }) {
  const { updateProject } = useAppContext();

  const handleToggle = () => {
    const newStatus = project.status === 'Active' ? 'Completed' : 'Active';
    // Removed window.confirm due to iframe restrictions
    updateProject(project.id, { status: newStatus });
  };

  return (
    <div className="flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-8 mt-2 lg:mt-0">
      <p className="text-sm font-bold text-slate-700 mb-2">Update Project Status</p>
      <p className="text-xs text-slate-500 mb-4">Marking a project as completed will move it out of the active working sites list.</p>
      <button 
        onClick={handleToggle}
        className={`flex items-center justify-center gap-2 font-bold px-4 py-2.5 rounded-lg transition-colors border shadow-sm ${
          project.status === 'Active' 
            ? 'bg-slate-50 hover:bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300'
            : 'bg-slate-50 hover:bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300'
        }`}
      >
        <CheckCircle className="w-5 h-5" />
        {project.status === 'Active' ? 'Mark as Completed' : 'Revert to Active'}
      </button>
    </div>
  );
}



function ApprovalQueueModal({ project, onClose }: { project: Project, onClose: () => void }) {
  const { state, updateProject, updateUser, addNotification, addToast } = useAppContext();
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const isAdminOrOfficeStaff = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';
  
  if (!isAdminOrOfficeStaff) return null;
  
  const pendingItems = (project.expenseItems || []).filter(e => {
    if (e.status !== 'Pending Approval') return false;
    if (state.currentRole === 'Office Staff') {
      const user = state.users.find(u => u.id === e.submittedById);
      if (user && (user.role === 'Office Staff' || user.role === 'Admin' || user.role === 'Super Admin')) return false;
    }
    return true;
  });
  const pendingDocs = (project.documents || []).filter(d => {
    if (d.status !== 'Pending Approval') return false;
    if (state.currentRole === 'Office Staff') {
      const user = state.users.find(u => u.id === d.uploadedById);
      if (user && (user.role === 'Office Staff' || user.role === 'Admin' || user.role === 'Super Admin')) return false;
    }
    return true;
  });
  const pendingLabors = (project.labors || []).filter(l => {
    if (l.approvalStatus !== 'Pending Approval') return false;
    if (state.currentRole === 'Office Staff') {
      // For labor, submittedBy may not be on the labor record, but we assume it's createdBy if present.
      // If we don't track createdBy on labor, we can try to find the user by createdBy.
      const user = state.users.find(u => u.id === l.createdBy);
      if (user && (user.role === 'Office Staff' || user.role === 'Admin' || user.role === 'Super Admin')) return false;
    }
    return true;
  });
  const pendingPhotos = (project.sitePhotos || []).filter(p => {
    if (p.status !== 'Pending Approval') return false;
    if (state.currentRole === 'Office Staff') {
      const user = state.users.find(u => u.id === p.uploadedById);
      if (user && (user.role === 'Office Staff' || user.role === 'Admin' || user.role === 'Super Admin')) return false;
    }
    return true;
  });

  const handleApprovePhoto = (photo: import('../types').SitePhoto) => {
    updateProject(project.id, (prevProj) => {
      const newPhotos = prevProj.sitePhotos!.map(p => p.id === photo.id ? { ...p, status: 'Approved' as const, approvedBy: state.currentUser?.name, approvedById: state.currentUser?.id } : p);
      return { sitePhotos: newPhotos };
    }, `Approved Site Photo: ${photo.category}`);
    addNotification(`Approved Site Photo: ${photo.category}`);
  };

  const handleRejectPhoto = (photo: import('../types').SitePhoto, reason: string) => {
    updateProject(project.id, (prevProj) => {
      const newPhotos = prevProj.sitePhotos!.map(p => p.id === photo.id ? { ...p, status: 'Rejected' as const, rejectionReason: reason, rejectedBy: state.currentUser?.name, rejectedById: state.currentUser?.id } : p);
      return { sitePhotos: newPhotos };
    }, `Rejected Site Photo: ${photo.category}`);
    addNotification(`Rejected Site Photo`);
    setRejectingId(null);
    setRejectReason("");
  };

  const handleApprove = (item: any, markPaidOffice: boolean = false) => {
    updateProject(project.id, (prevProj) => {
      const newItems = prevProj.expenseItems!.map(e => e.id === item.id ? { ...e, status: 'Approved' as const, approvedBy: state.currentUser?.name, approvedById: state.currentUser?.id, paidBy: markPaidOffice ? 'office' : e.paidBy } : e);
      return { expenseItems: newItems as any };
    });
    if (item.paidBy === 'petty_cash' && item.submittedById) {
      const user = state.users.find(u => u.id === item.submittedById);
      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - item.amount });
      }
    }
    addNotification(`Approved Entry for ${item.submittedBy}`);
  };

  const handleApproveLabor = (labor: import('../types').LaborEntry) => {
    updateProject(project.id, (prevProj) => {
      const newLabors = prevProj.labors!.map(l => l.id === labor.id ? { ...l, approvalStatus: 'Approved', approvedBy: state.currentUser?.name, approvedById: state.currentUser?.id } : l);
      return { labors: newLabors as any };
    }, `Approved New Labor: ${labor.name}`);
    addNotification(`Approved New Labor: ${labor.name}`);
  };

  const submitRejectLabor = (labor: import('../types').LaborEntry) => {
    if (!rejectReason) return addToast('Please provide a reason for rejection.', 'error');
    updateProject(project.id, (prevProj) => {
      const newLabors = prevProj.labors!.map(l => l.id === labor.id ? { ...l, approvalStatus: 'Rejected', rejectionReason: rejectReason, rejectedBy: state.currentUser?.name, rejectedById: state.currentUser?.id } : l);
      return { labors: newLabors as any };
    }, `Rejected New Labor: ${labor.name} (${rejectReason})`);
    addNotification(`Rejected New Labor: ${labor.name}`);
    setRejectingId(null);
    setRejectReason("");
  };

  const submitReject = (item: any) => {
    if (!rejectReason) return addToast('Please provide a reason for rejection.', 'error');
    updateProject(project.id, (prevProj) => {
      const newItems = prevProj.expenseItems!.map(e => e.id === item.id ? { ...e, status: 'Rejected' as const, rejectionReason: rejectReason, rejectedBy: state.currentUser?.name, rejectedById: state.currentUser?.id } : e);
      return { expenseItems: newItems as any };
    }, `Rejected Entry: ${item.itemName} (${rejectReason})`);
    addNotification(`Rejected Entry from ${item.submittedBy}: ${rejectReason}`);
    setRejectingId(null);
    setRejectReason("");
  };

  const handleApproveDoc = (doc: any) => {
    updateProject(project.id, (prevProj) => {
      const newDocs = prevProj.documents!.map(d => d.id === doc.id ? { ...d, status: 'Approved' as const, approvedBy: state.currentUser?.name, approvedById: state.currentUser?.id } : d);
      return { documents: newDocs as any };
    });
    addNotification(`Approved Document from ${doc.uploadedBy}`);
  };

  const handleBulkApproveLabor = () => {
    const laborItems = pendingItems.filter(e => e.category === 'labor');
    if (laborItems.length === 0) return addToast('No pending labor attendances to approve.', 'error');
    
    let balanceUpdates: Record<string, number> = {};

    updateProject(project.id, (prevProj) => {
      let newItems = [...(prevProj.expenseItems || [])];
      laborItems.forEach(item => {
        newItems = newItems.map(e => e.id === item.id ? { ...e, status: 'Approved' as const, approvedBy: state.currentUser?.name, approvedById: state.currentUser?.id } : e);
        if (item.paidBy === 'petty_cash' && item.submittedById) {
          balanceUpdates[item.submittedById] = (balanceUpdates[item.submittedById] || 0) + item.amount;
        }
      });
      return { expenseItems: newItems as any };
    }, `Bulk Approved ${laborItems.length} Labor Attendances`);
    
    // Update user petty cash balances if needed
    Object.entries(balanceUpdates).forEach(([userId, amountToDeduct]) => {
      const user = state.users.find(u => u.id === userId);
      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - amountToDeduct });
      }
    });

    addToast(`Bulk approved ${laborItems.length} labor records.`, 'success');
  };

  const submitRejectDoc = (doc: any) => {
    if (!rejectReason) return addToast('Please provide a reason for rejection.', 'error');
    updateProject(project.id, (prevProj) => {
      const newDocs = prevProj.documents!.map(d => d.id === doc.id ? { ...d, status: 'Rejected' as const, rejectionReason: rejectReason, rejectedBy: state.currentUser?.name, rejectedById: state.currentUser?.id } : d);
      return { documents: newDocs as any };
    }, `Rejected Document (${rejectReason})`);
    addNotification(`Rejected Document from ${doc.uploadedBy}: ${rejectReason}`);
    setRejectingId(null);
    setRejectReason("");
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="Go back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Approval Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">Review and approve field entries for {project.name}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {pendingItems.filter(e => e.category === 'labor').length > 0 && (
            <button onClick={() => { if (confirm('Approve all pending labor attendances?')) handleBulkApproveLabor(); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors">
              <CheckCircle className="w-4 h-4" /> Bulk Approve Labors
            </button>
          )}
          <button onClick={onClose} className="text-slate-600 hover:text-slate-950 font-bold px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg shadow-xs transition-colors">
            Close Queue
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {pendingItems.length === 0 && pendingDocs.length === 0 && pendingLabors.length === 0 && pendingPhotos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">All Caught Up!</h3>
              <p className="text-slate-500 mt-1">There are no pending entries requiring your approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingLabors.map(labor => (
                <div key={labor.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors bg-white shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 uppercase tracking-wider">New Labor Onboarding</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">{labor.name}</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><span className="text-slate-400">Role:</span> <span className="font-medium text-slate-700">{labor.type} {labor.customType ? `(${labor.customType})` : ''}</span></p>
                      <p><span className="text-slate-400">Daily Rate:</span> <span className="font-semibold text-slate-800">{formatINR(labor.rate)}</span></p>
                      {labor.phone && <p><span className="text-slate-400">Phone:</span> {labor.phone}</p>}
                      {labor.address && <p><span className="text-slate-400">Address:</span> {labor.address}</p>}
                    </div>
                  </div>
                  
                  {labor.photo && (
                    <div className="shrink-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Photo</p>
                      <img src={labor.photo} alt={labor.name} className="w-32 h-32 object-cover rounded-lg border border-slate-200 shadow-sm" />
                    </div>
                  )}

                  <div className="shrink-0 flex flex-col justify-end gap-3 md:w-48 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {rejectingId === labor.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea 
                          placeholder="Reason for rejection..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-red-500"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => submitRejectLabor(labor)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 rounded text-sm transition-colors">Submit</button>
                          <button onClick={() => setRejectingId(null)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-1.5 rounded text-sm transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleApproveLabor(labor)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button 
                          onClick={() => setRejectingId(labor.id)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 font-bold rounded-lg border border-red-200 hover:border-red-300 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {pendingItems.map(item => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors bg-white shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 uppercase tracking-wider">{item.category}</span>
                      {item.paidBy === 'unpaid' && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 uppercase tracking-wider flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Payment Req</span>
                      )}
                      {item.paidBy === 'used' && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 uppercase tracking-wider">Used</span>
                      )}
                      {item.paidBy === 'petty_cash' && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 uppercase tracking-wider">Petty Cash</span>
                      )}
                      <span className="text-sm text-slate-400 ml-auto">{item.date}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">{item.itemName}</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><span className="text-slate-400">Submitted by:</span> <span className="font-medium text-slate-700">{item.submittedBy}</span> <span className="text-slate-400 text-xs">({item.submittedByRole})</span></p>
                      {item.vendorQuantity && item.vendorUnit ? (
                        <>
                          <p><span className="text-slate-400">{state.language === 'hi' ? 'बिल की मात्रा:' : 'Billed Qty:'}</span> <span className="font-semibold text-slate-800">{item.vendorQuantity} {item.vendorUnit}</span></p>
                          {item.quantity && <p className="text-xs text-slate-500"><span className="text-slate-400">{state.language === 'hi' ? 'मानक मात्रा (Standard):' : 'Std Qty:'}</span> {item.quantity}</p>}
                        </>
                      ) : (
                        item.quantity && <p><span className="text-slate-400">{state.language === 'hi' ? 'मात्रा:' : 'Quantity:'}</span> {item.quantity}</p>
                      )}
                      
                      {item.vendorRate && item.vendorUnit ? (
                        <>
                          <p><span className="text-slate-400">{state.language === 'hi' ? 'बिल का रेट:' : 'Billed Rate:'}</span> <span className="font-semibold text-slate-800">{formatINR(item.vendorRate)} / {item.vendorUnit}</span></p>
                          {item.rate && item.rate > 0 && <p className="text-xs text-slate-500"><span className="text-slate-400">{state.language === 'hi' ? 'मानक दर (Standard):' : 'Std Rate:'}</span> {formatINR(item.rate)} / {item.quantity.split(' ').slice(1).join(' ') || 'Unit'}</p>}
                        </>
                      ) : (
                        item.rate && item.rate > 0 && <p><span className="text-slate-400">{state.language === 'hi' ? 'दर:' : 'Rate:'}</span> {formatINR(item.rate)} / {item.quantity.split(' ').slice(1).join(' ') || 'Unit'}</p>
                      )}
                      {item.vendor && <p><span className="text-slate-400">Vendor:</span> {item.vendor}</p>}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-end justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Amount</p>
                        <p className="text-2xl font-black text-slate-800">{formatINR(item.amount)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {item.photo && (
                    <div className="shrink-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attachment</p>
                      <img src={item.photo} alt="Proof" className="w-32 h-32 object-cover rounded-lg border border-slate-200 shadow-sm" />
                    </div>
                  )}

                  {item.livePhoto && (
                    <div className="shrink-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Camera className="w-3 h-3 text-emerald-500" /> Live Verification</p>
                      <img src={item.livePhoto} alt="Live Photo" className="w-32 h-32 object-cover rounded-lg border-2 border-emerald-100 shadow-sm" />
                      {item.entryLatitude && item.entryLongitude && (
                         <a 
                           href={`https://www.google.com/maps/search/?api=1&query=${item.entryLatitude},${item.entryLongitude}`} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="text-[10px] font-semibold text-blue-600 hover:underline mt-2 flex items-center gap-1"
                         >
                           View Location on Map
                         </a>
                      )}
                    </div>
                  )}

                  <div className="shrink-0 flex flex-col justify-end gap-3 md:w-48 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {rejectingId === item.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          placeholder="Rejection Reason..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none h-20"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={() => submitReject(item)} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm">Submit</button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-lg text-sm transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {item.paidBy === 'unpaid' ? (
                          <>
                            <button onClick={() => handleApprove(item, true)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Approve & Mark Paid
                            </button>
                            <button onClick={() => handleApprove(item, false)} className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-2.5 rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Approve Only (Unpaid)
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleApprove(item, false)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </button>
                        )}
                        <button onClick={() => setRejectingId(item.id)} className="w-full bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold py-2.5 rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2">
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {pendingDocs.map(doc => (
                <div key={doc.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors bg-white shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 uppercase tracking-wider">Document</span>
                      <span className="text-sm text-slate-400 ml-auto">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">{doc.name}</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><span className="text-slate-400">Submitted by:</span> <span className="font-medium text-slate-700">{doc.uploadedBy || 'Unknown'}</span></p>
                      {doc.description && <p><span className="text-slate-400">Description:</span> {doc.description}</p>}
                    </div>
                  </div>
                  
                  {doc.data && (
                    <div className="shrink-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attachment</p>
                      <img src={doc.data} alt="Proof" className="w-32 h-32 object-cover rounded-lg border border-slate-200 shadow-sm" />
                    </div>
                  )}

                  <div className="shrink-0 flex flex-col justify-end gap-3 md:w-48 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {rejectingId === doc.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          placeholder="Rejection Reason..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none h-20"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={() => submitRejectDoc(doc)} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm">Submit</button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-lg text-sm transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button onClick={() => handleApproveDoc(doc)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => setRejectingId(doc.id)} className="w-full bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold py-2.5 rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2">
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {pendingPhotos.map(photo => (
                <div key={photo.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors bg-white shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 uppercase tracking-wider">Site Photo</span>
                      <span className="text-sm text-slate-400 ml-auto">{photo.dateTaken ? new Date(photo.dateTaken).toLocaleDateString() : (photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleDateString() : '')}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">{photo.name}</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><span className="text-slate-400">Category:</span> <span className="font-medium text-slate-700">{photo.category || 'General'}</span></p>
                      <p><span className="text-slate-400">Uploaded by:</span> <span className="font-medium text-slate-700">{photo.uploadedBy || 'Unknown'}</span></p>
                      {photo.remarks && <p><span className="text-slate-400">Remarks:</span> {photo.remarks}</p>}
                    </div>
                  </div>
                  
                  {photo.data && (
                    <div className="shrink-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attachment</p>
                      <img src={photo.data} alt="Site Photo" className="w-32 h-32 object-cover rounded-lg border border-slate-200 shadow-sm" />
                    </div>
                  )}

                  <div className="shrink-0 flex flex-col justify-end gap-3 md:w-48 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {rejectingId === photo.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          placeholder="Rejection Reason..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none h-20"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleRejectPhoto(photo, rejectReason)} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm">Submit</button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-lg text-sm transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button onClick={() => handleApprovePhoto(photo)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => setRejectingId(photo.id)} className="w-full bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold py-2.5 rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2">
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}

function ExpenseDial({ label, amount, total, colorClass, icon: Icon, actionLabel, onAction }: { label: string, amount: number, total: number, colorClass: string, icon: any, actionLabel: string, onAction: () => void }) {
  const percentage = Math.min(100, Math.max(0, (amount / total) * 100));
  
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4 sm:gap-5 shadow-sm group">
      <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-slate-100"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <path
            className={colorClass}
            strokeDasharray={`${percentage}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
          />
        </svg>
        <Icon className={`absolute inset-0 m-auto w-4 h-4 sm:w-5 sm:h-5 ${colorClass.split(' ')[0]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] sm:text-sm font-semibold text-slate-500 uppercase tracking-widest truncate" title={label}>{label}</p>
        <p className="text-base sm:text-xl font-bold text-slate-800 mt-1 truncate">{formatINR(amount)}</p>
      </div>
      <button 
        onClick={onAction}
        className="text-[10px] sm:text-xs font-medium text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-2 sm:px-3 py-1.5 rounded border border-slate-200 transition-colors shrink-0"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function LaborGroupedView({ project, triggerUpload, isAdminOrOfficeStaff }: { project: Project, triggerUpload: (id: string) => void, isAdminOrOfficeStaff: boolean }) {
  const { updateProject, state, addToast, updateUser, confirm, prompt, addToRecycleBin, addApprovalRequest } = useAppContext();
  
  const laborMap = new Map<string, { wages: ExpenseEntry[], advances: ExpenseEntry[], payments: SupplierPayment[] }>();

  (project.expenseItems || []).forEach(item => {
    if (item.status === 'Approved' || item.status === 'Pending Approval') {
      if (item.category === 'labor' && item.itemName.includes('- Daily Wage')) {
         const name = item.itemName.split(' (')[0].trim().toUpperCase();
         if (!laborMap.has(name)) laborMap.set(name, { wages: [], advances: [], payments: [] });
         laborMap.get(name)!.wages.push(item);
      } else if (item.category === 'misc' && item.itemName.startsWith('Advance to ')) {
         const name = item.itemName.replace('Advance to ', '').trim().toUpperCase();
         if (!laborMap.has(name)) laborMap.set(name, { wages: [], advances: [], payments: [] });
         laborMap.get(name)!.advances.push(item);
      }
    }
  });

  (project.supplierPayments || []).forEach(pay => {
    if (pay.vendorName.startsWith('LABOR: ')) {
      const name = pay.vendorName.replace('LABOR: ', '').trim().toUpperCase();
      if (laborMap.has(name)) {
        laborMap.get(name)!.payments.push(pay);
      }
    }
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMode, setPayMode] = useState<'office'|'petty_cash'>('office');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', date: '' });

  const handleSaveExpense = (item: ExpenseEntry) => {
    const amt = Math.round(Number(editForm.amount)) || 0;
    if (amt <= 0) return addToast('Amount must be positive', 'error');

    // Office Staff bypass removed

    // Refund/adjust petty cash balance if needed
    if (item.status === 'Approved' && item.paidBy === 'petty_cash' && item.submittedById) {
      const diff = amt - item.amount;
      if (diff !== 0) {
        const user = state.users.find(u => u.id === item.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
        }
      }
    }

    const updated = (project.expenseItems || []).map(i => 
      i.id === item.id ? { ...i, amount: amt, date: editForm.date } : i
    );
    updateProject(project.id, { expenseItems: updated });
    setEditingId(null);
    addToast('Labor entry updated successfully', 'success');
  };

  const handleDeleteExpense = async (item: ExpenseEntry) => {
    if (!await confirm('Are you sure you want to delete this entry?')) return;

    const isOfficeStaff = state.currentRole === 'Office Staff';
    const isAdminOrSuperAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin';
    let reason = '';
    
    if (isOfficeStaff) {
      reason = await prompt("Please provide a reason for deletion:") || '';
      if (!reason) return;
      addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: item.id,
        itemName: item.itemName || 'ExpenseEntry',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: item
      });
      addToast('Deletion request submitted for Admin approval.', 'info');
      return;
    }

    if (!isAdminOrSuperAdmin) {
      const enteredPin = await prompt("Enter your Password to confirm deleting this entry:");
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
    }

    reason = await prompt("Please provide a reason for deleting this entry:") || '';
    if (!reason) return;

    if (item.status === 'Approved' && item.paidBy === 'petty_cash' && item.submittedById) {
      const user = state.users.find(u => u.id === item.submittedById);
      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + item.amount });
      }
    }

    addToRecycleBin({
      projectId: project.id,
      itemType: 'ExpenseEntry',
      itemName: item.itemName || 'Expense',
      itemData: item,
      deletedBy: state.currentUser?.name || 'Unknown',
      deleteReason: reason
    });

    const updated = (project.expenseItems || []).filter(i => i.id !== item.id);
    updateProject(project.id, { expenseItems: updated });
    addToast('Labor entry deleted successfully', 'success');
  };

  const handleSavePayment = (pay: SupplierPayment) => {
    const amt = Math.round(Number(editForm.amount)) || 0;
    if (amt <= 0) return addToast('Amount must be positive', 'error');

    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...pay, amount: amt, date: editForm.date };
      addApprovalRequest({
        projectId: project.id,
        module: 'SupplierPayment',
        recordId: pay.id,
        itemName: pay.vendorName || 'SupplierPayment',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit',
        oldData: pay, newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingId(null);
      return;
    }

    // Refund/adjust petty cash balance if needed
    if (pay.paidBy === 'petty_cash' && pay.submittedById) {
      const diff = amt - pay.amount;
      if (diff !== 0) {
        const user = state.users.find(u => u.id === pay.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
        }
      }
    }

    const updated = (project.supplierPayments || []).map(p => 
      p.id === pay.id ? { ...p, amount: amt, date: editForm.date } : p
    );
    updateProject(project.id, { supplierPayments: updated });
    setEditingId(null);
    addToast('Payment entry updated successfully', 'success');
  };

  const handleDeletePayment = async (pay: SupplierPayment) => {
    if (!await confirm('Are you sure you want to delete this payment?')) return;

    const isOfficeStaff = state.currentRole === 'Office Staff';
    const isAdminOrSuperAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin';
    let reason = '';
    
    if (isOfficeStaff) {
      reason = await prompt("Please provide a reason for deletion:") || '';
      if (!reason) return;
      addApprovalRequest({
        projectId: project.id,
        module: 'SupplierPayment',
        recordId: pay.id,
        itemName: pay.vendorName || 'SupplierPayment',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: pay
      });
      addToast('Deletion request submitted for Admin approval.', 'info');
      return;
    }

    if (!isAdminOrSuperAdmin) {
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
    }

    reason = await prompt("Please provide a reason for deleting this payment:") || '';
    if (!reason) return;

    if (pay.paidBy === 'petty_cash' && pay.submittedById) {
      const user = state.users.find(u => u.id === pay.submittedById);
      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + pay.amount });
      }
    }

    addToRecycleBin({
      projectId: project.id,
      itemType: 'SupplierPayment',
      itemName: pay.vendorName || 'Payment',
      itemData: pay,
      deletedBy: state.currentUser?.name || 'Unknown',
      deleteReason: reason
    });

    const updated = (project.supplierPayments || []).filter(p => p.id !== pay.id);
    updateProject(project.id, { supplierPayments: updated });
    addToast('Payment entry deleted successfully', 'success');
  };

  const handlePay = (name: string, overrideAmount?: number) => {
    const paymentAmt = overrideAmount ?? Number(payAmount);
    if (!paymentAmt || isNaN(paymentAmt) || paymentAmt <= 0) return addToast('Invalid amount', 'error');
    
    const newPayment: SupplierPayment = {
      id: `spay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vendorName: `LABOR: ${name}`,
      amount: paymentAmt,
      date: payDate,
      note: 'Payment for remaining balance',
      paidBy: isAdminOrOfficeStaff ? payMode : 'petty_cash',
      submittedBy: state.currentUser?.name,
      submittedById: state.currentUser?.id,
      submittedByRole: state.currentUser?.role
    };
    
    if (newPayment.paidBy === 'petty_cash' && state.currentUser) {
      if (state.currentUser.role !== 'Admin' && state.currentUser.role !== 'Super Admin') {
        const currentBal = state.currentUser.pettyCashBalance || 0;
        updateUser(state.currentUser.id, { pettyCashBalance: currentBal - paymentAmt });
      }
    }
    
    setPayAmount('');
    setPayDate(new Date().toISOString().split('T')[0]);
    return newPayment;
  };

  const handleBulkPay = () => {
    const balancesToPay = Array.from(laborMap.entries()).map(([name, data]) => {
      const totalWage = data.wages.reduce((sum, w) => sum + w.amount, 0);
      const totalAdvance = data.advances.reduce((sum, a) => sum + a.amount, 0);
      const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);
      return { name, balance: totalWage - totalAdvance - totalPaid };
    }).filter(x => x.balance > 0);

    if (balancesToPay.length === 0) {
      return addToast('No remaining balances to pay.', 'error');
    }

    const newPayments = balancesToPay.map(x => handlePay(x.name, x.balance)).filter(Boolean) as SupplierPayment[];
    
    updateProject(project.id, {
      supplierPayments: [...(project.supplierPayments || []), ...newPayments]
    });

    addToast(`Bulk payment of ₹${balancesToPay.reduce((s, x) => s + x.balance, 0)} made to ${balancesToPay.length} labors.`, 'success');
  };

  return (
    <div className="p-6 flex flex-col gap-4">
      {isAdminOrOfficeStaff && (
        <div className="flex justify-end mb-2">
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to pay ALL pending positive balances in full?')) {
                handleBulkPay();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
          >
            <Banknote className="w-4 h-4" /> Bulk Pay All Balances
          </button>
        </div>
      )}
      {Array.from(laborMap.entries()).map(([name, data]) => {
         const totalWage = data.wages.reduce((sum, w) => sum + w.amount, 0);
         const totalAdvance = data.advances.reduce((sum, a) => sum + a.amount, 0);
         const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);
         const balance = totalWage - totalAdvance - totalPaid;
         const totalDays = data.wages.reduce((sum, w) => sum + (w.quantity === '0.5 Day' ? 0.5 : 1), 0);

         return (
           <div key={name} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
             <div 
               className="bg-slate-50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors"
               onClick={() => setExpanded(expanded === name ? null : name)}
             >
               <div>
                 <h3 className="font-bold text-slate-800 text-lg">{name}</h3>
                 <p className="text-sm text-slate-500">{totalDays} Days Worked</p>
               </div>
               <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-left sm:text-right w-full sm:w-auto">
                 <div>
                   <p className="text-xs text-slate-500 uppercase font-bold">Total Wage</p>
                   <p className="font-bold text-slate-800">{formatINR(totalWage)}</p>
                 </div>
                 <div>
                   <p className="text-xs text-rose-500 uppercase font-bold">Advance/Paid</p>
                   <p className="font-bold text-rose-600">{formatINR(totalAdvance + totalPaid)}</p>
                 </div>
                 <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm min-w-[120px]">
                   <p className="text-xs text-slate-500 uppercase font-bold">Balance</p>
                   <p className={`font-bold text-lg ${balance > 0 ? 'text-rose-600' : balance < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                     {formatINR(balance)}
                   </p>
                 </div>
               </div>
             </div>
             {expanded === name && (
               <div className="p-4 bg-white border-t border-slate-200">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Wage History</h4>
                     <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-2">
                       {data.wages.map(w => {
                         const isEditing = editingId === w.id;
                         return (
                           <div key={w.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded border border-slate-100 min-h-[42px]">
                             {isEditing ? (
                               <div className="flex items-center gap-2 w-full">
                                 <input 
                                   type="date" 
                                   value={editForm.date} 
                                   onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                   className="border p-1 rounded text-xs w-28 bg-white" 
                                 />
                                 <input 
                                   type="number" 
                                   value={editForm.amount} 
                                   onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                   className="border p-1 rounded text-xs w-24 bg-white" 
                                 />
                                 <button onClick={() => handleSaveExpense(w)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors" title="Save"><Check className="w-4 h-4" /></button>
                                 <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1 rounded transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
                               </div>
                             ) : (
                               <>
                                 <div className="flex items-center gap-2">
                                   <span className="text-slate-600 font-medium">{new Date(w.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                   {w.quantity === '0.5 Day' && <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">Half</span>}
                                   {w.status === 'Pending Approval' && <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase">Pending</span>}
                                 </div>
                                 <div className="flex items-center gap-3">
                                   <span className="font-bold text-slate-800">{formatINR(w.amount)}</span>
                                   {isAdminOrOfficeStaff && (
                                     <div className="flex items-center gap-1 bg-white border border-slate-100 rounded px-1">
                                       <button 
                                         onClick={() => { setEditingId(w.id); setEditForm({ date: w.date.split('T')[0], amount: String(w.amount) }); }} 
                                         className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                         title="Edit"
                                       >
                                         <Edit2 className="w-3.5 h-3.5" />
                                       </button>
                                       <button 
                                         onClick={() => handleDeleteExpense(w)} 
                                         className="text-slate-400 hover:text-red-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                         title="Delete"
                                       >
                                         <Trash2 className="w-3.5 h-3.5" />
                                       </button>
                                     </div>
                                   )}
                                 </div>
                               </>
                             )}
                           </div>
                         );
                       })}
                     </div>
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Advances & Payments</h4>
                     <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-2">
                       {data.advances.map(a => {
                         const isEditing = editingId === a.id;
                         return (
                           <div key={a.id} className="flex justify-between items-center text-sm p-2 bg-rose-50 rounded border border-rose-100 min-h-[42px]">
                             {isEditing ? (
                               <div className="flex items-center gap-2 w-full">
                                 <input 
                                   type="date" 
                                   value={editForm.date} 
                                   onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                   className="border p-1 rounded text-xs w-28 bg-white" 
                                 />
                                 <input 
                                   type="number" 
                                   value={editForm.amount} 
                                   onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                   className="border p-1 rounded text-xs w-24 bg-white" 
                                 />
                                 <button onClick={() => handleSaveExpense(a)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors" title="Save"><Check className="w-4 h-4" /></button>
                                 <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1 rounded transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
                               </div>
                             ) : (
                               <>
                                 <div className="flex items-center gap-2">
                                   <span className="text-rose-600 font-medium">Advance ({new Date(a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})</span>
                                   {a.status === 'Pending Approval' && <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase">Pending</span>}
                                 </div>
                                 <div className="flex items-center gap-3">
                                   <span className="font-bold text-rose-700">{formatINR(a.amount)}</span>
                                   {isAdminOrOfficeStaff && (
                                     <div className="flex items-center gap-1 bg-white border border-slate-100 rounded px-1">
                                       <button 
                                         onClick={() => { setEditingId(a.id); setEditForm({ date: a.date.split('T')[0], amount: String(a.amount) }); }} 
                                         className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                         title="Edit"
                                       >
                                         <Edit2 className="w-3.5 h-3.5" />
                                       </button>
                                       <button 
                                         onClick={() => handleDeleteExpense(a)} 
                                         className="text-slate-400 hover:text-red-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                         title="Delete"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                           </div>
                         );
                       })}
                       {data.payments.map(p => {
                         const isEditing = editingId === p.id;
                         return (
                           <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-emerald-50 rounded border border-emerald-100 min-h-[42px]">
                             {isEditing ? (
                               <div className="flex items-center gap-2 w-full">
                                 <input 
                                   type="date" 
                                   value={editForm.date} 
                                   onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                   className="border p-1 rounded text-xs w-28 bg-white" 
                                 />
                                 <input 
                                   type="number" 
                                   value={editForm.amount} 
                                   onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                   className="border p-1 rounded text-xs w-24 bg-white" 
                                 />
                                 <button onClick={() => handleSavePayment(p)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors" title="Save"><Check className="w-4 h-4" /></button>
                                 <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1 rounded transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
                               </div>
                             ) : (
                               <>
                                 <span className="text-emerald-600 font-medium">Payment ({new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})</span>
                                 <div className="flex items-center gap-3">
                                   <span className="font-bold text-emerald-700">{formatINR(p.amount)}</span>
                                   {isAdminOrOfficeStaff && (
                                     <div className="flex items-center gap-1 bg-white border border-slate-100 rounded px-1">
                                       <button 
                                         onClick={() => { setEditingId(p.id); setEditForm({ date: p.date.split('T')[0], amount: String(p.amount) }); }} 
                                         className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                         title="Edit"
                                       >
                                         <Edit2 className="w-3.5 h-3.5" />
                                       </button>
                                       <button 
                                         onClick={() => handleDeletePayment(p)} 
                                         className="text-slate-400 hover:text-red-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                         title="Delete"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                           </div>
                         );
                       })}
                     </div>
                     
                     {balance > 0 && (
                       <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                         <p className="text-xs font-bold text-slate-600 mb-2 uppercase">Pay Remaining Balance</p>
                         <div className="flex flex-col sm:flex-row gap-2">
                           <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="border p-2 rounded text-sm w-full sm:w-32 outline-none focus:border-amber-500 bg-white" />
                           <input type="number" placeholder="₹ Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="border p-2 rounded text-sm w-full outline-none focus:border-amber-500 bg-white" />
                           {isAdminOrOfficeStaff ? (
                             <select value={payMode} onChange={e => setPayMode(e.target.value as any)} className="border p-2 rounded text-sm bg-white outline-none focus:border-amber-500">
                               <option value="office">Office</option>
                               <option value="petty_cash">Petty Cash</option>
                             </select>
                           ) : (
                             <select disabled value="petty_cash" className="border p-2 rounded text-sm bg-slate-100 text-slate-500 outline-none">
                               <option value="petty_cash">Petty Cash</option>
                             </select>
                           )}
                           <button onClick={() => handlePay(name)} className="bg-amber-500 text-white font-bold px-4 py-2 rounded text-sm hover:bg-amber-600 whitespace-nowrap shadow-sm transition-colors">Pay</button>
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             )}
           </div>
         )
      })}
      {laborMap.size === 0 && (
         <div className="p-12 text-center text-slate-500">No approved labor entries found.</div>
       )}
    </div>
  );
}

function MachineryGroupedView({ project, triggerUpload, isAdminOrOfficeStaff }: { project: Project, triggerUpload: (id: string) => void, isAdminOrOfficeStaff: boolean }) {
  const { updateProject, state, addToast, updateUser, confirm, prompt, addToRecycleBin, addApprovalRequest } = useAppContext();
  
  const machineMap = new Map<string, { bills: ExpenseEntry[], payments: SupplierPayment[] }>();

  (project.expenseItems || []).forEach(item => {
    if (item.status === 'Approved' && item.category === 'machinery') {
       const match = item.itemName.match(/Machinery:\s*(.*?)(?:\s*(?:\+|\[)Fuel.*)?$/i);
       const rawName = match ? match[1].replace(/\]$/, '').trim() : 'UNKNOWN MACHINE';
       const name = normalizeVendorName(`MACHINE: ${rawName}`).replace('MACHINE:', '').trim();
       if (!machineMap.has(name)) machineMap.set(name, { bills: [], payments: [] });
       machineMap.get(name)!.bills.push(item);
    }
  });

  (project.supplierPayments || []).forEach(pay => {
    if (pay.status === 'Rejected' || pay.status === 'Pending Approval' || pay.status === 'Deleted') {
      return;
    }
    const vNameUpper = normalizeVendorName(pay.vendorName);
    if (vNameUpper.startsWith('MACHINE:')) {
      const name = vNameUpper.replace('MACHINE:', '').trim();
      if (machineMap.has(name)) {
        machineMap.get(name)!.payments.push(pay);
      }
    }
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMode, setPayMode] = useState<'office'|'petty_cash'>('office');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', date: '', quantity: '', rate: '' });

  const handleSaveExpense = (item: ExpenseEntry) => {
    const amt = Math.round(Number(editForm.amount)) || 0;
    const qty = parseFloat(editForm.quantity) || 0;
    const rate = Number(editForm.rate) || 0;
    
    if (amt <= 0) return addToast('Amount must be positive', 'error');

    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...item, amount: amt, date: editForm.date, quantity: String(qty), rate: rate };
      addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: item.id,
        itemName: item.itemName || 'ExpenseEntry',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit',
        oldData: item, newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingId(null);
      return;
    }

    // Refund/adjust petty cash balance if needed
    if (item.status === 'Approved' && item.paidBy === 'petty_cash' && item.submittedById) {
      const diff = amt - item.amount;
      if (diff !== 0) {
        const user = state.users.find(u => u.id === item.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
        }
      }
    }

    const updated = (project.expenseItems || []).map(i => 
      i.id === item.id ? { ...i, amount: amt, date: editForm.date, quantity: String(qty), rate: rate } : i
    );
    updateProject(project.id, { expenseItems: updated });
    setEditingId(null);
    addToast('Entry updated successfully', 'success');
  };

  const handleDeleteExpense = async (item: ExpenseEntry) => {
    if (!await confirm('Are you sure you want to delete this entry?')) return;

    const isOfficeStaff = state.currentRole === 'Office Staff';
    const isAdminOrSuperAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin';
    let reason = '';
    
    if (isOfficeStaff) {
      reason = await prompt("Please provide a reason for deletion:") || '';
      if (!reason) return;
      addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: item.id,
        itemName: item.itemName || 'ExpenseEntry',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: item
      });
      addToast('Deletion request submitted for Admin approval.', 'info');
      return;
    }

    if (!isAdminOrSuperAdmin) {
      const enteredPin = await prompt("Enter your Password to confirm deleting this entry:");
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
    }

    reason = await prompt("Please provide a reason for deleting this entry:") || '';
    if (!reason) return;

    if (item.status === 'Approved' && item.paidBy === 'petty_cash' && item.submittedById) {
      const user = state.users.find(u => u.id === item.submittedById);
      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + item.amount });
      }
    }

    addToRecycleBin({
      projectId: project.id,
      itemType: 'ExpenseEntry',
      itemName: item.itemName || 'Expense',
      itemData: item,
      deletedBy: state.currentUser?.name || 'Unknown',
      deleteReason: reason
    });

    const updated = (project.expenseItems || []).filter(i => i.id !== item.id);
    updateProject(project.id, { expenseItems: updated });
    addToast('Entry deleted successfully', 'success');
  };

  const handleSavePayment = (pay: SupplierPayment) => {
    const amt = Math.round(Number(editForm.amount)) || 0;
    if (amt <= 0) return addToast('Amount must be positive', 'error');

    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...pay, amount: amt, date: editForm.date };
      addApprovalRequest({
        projectId: project.id,
        module: 'SupplierPayment',
        recordId: pay.id,
        itemName: pay.vendorName || 'SupplierPayment',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit',
        oldData: pay, newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingId(null);
      return;
    }

    // Refund/adjust petty cash balance if needed
    if (pay.paidBy === 'petty_cash' && pay.submittedById) {
      const diff = amt - pay.amount;
      if (diff !== 0) {
        const user = state.users.find(u => u.id === pay.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
        }
      }
    }

    const updated = (project.supplierPayments || []).map(p => 
      p.id === pay.id ? { ...p, amount: amt, date: editForm.date } : p
    );
    updateProject(project.id, { supplierPayments: updated });
    setEditingId(null);
    addToast('Payment entry updated successfully', 'success');
  };

  const handleDeletePayment = async (pay: SupplierPayment) => {
    if (!await confirm('Are you sure you want to delete this payment?')) return;

    const isOfficeStaff = state.currentRole === 'Office Staff';
    const isAdminOrSuperAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin';
    let reason = '';
    
    if (isOfficeStaff) {
      reason = await prompt("Please provide a reason for deletion:") || '';
      if (!reason) return;
      addApprovalRequest({
        projectId: project.id,
        module: 'SupplierPayment',
        recordId: pay.id,
        itemName: pay.vendorName || 'SupplierPayment',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: pay
      });
      addToast('Deletion request submitted for Admin approval.', 'info');
      return;
    }

    if (!isAdminOrSuperAdmin) {
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
    }

    reason = await prompt("Please provide a reason for deleting this payment:") || '';
    if (!reason) return;

    if (pay.paidBy === 'petty_cash' && pay.submittedById) {
      const user = state.users.find(u => u.id === pay.submittedById);
      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + pay.amount });
      }
    }

    addToRecycleBin({
      projectId: project.id,
      itemType: 'SupplierPayment',
      itemName: pay.vendorName || 'Payment',
      itemData: pay,
      deletedBy: state.currentUser?.name || 'Unknown',
      deleteReason: reason
    });

    const updated = (project.supplierPayments || []).filter(p => p.id !== pay.id);
    updateProject(project.id, { supplierPayments: updated });
    addToast('Payment entry deleted successfully', 'success');
  };

  const handlePay = (name: string) => {
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) return addToast('Invalid amount', 'error');
    const paymentAmt = Number(payAmount);
    const newPayment: SupplierPayment = {
      id: `spay-${Date.now()}`,
      vendorName: `MACHINE: ${name}`,
      amount: paymentAmt,
      date: payDate,
      note: 'Payment for machinery',
      paidBy: isAdminOrOfficeStaff ? payMode : 'petty_cash',
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
        updateUser(state.currentUser.id, { pettyCashBalance: currentBal - paymentAmt });
      }
    }
    setPayAmount('');
    setPayDate(new Date().toISOString().split('T')[0]);
    addToast(`Payment of ₹${payAmount} made for ${name}`, 'success');
  };

  return (
    <div className="p-6 flex flex-col gap-4">
      {Array.from(machineMap.entries()).map(([name, data]) => {
         const totalBilled = data.bills.reduce((sum, w) => sum + w.amount, 0);
         const totalInitiallyPaid = data.bills.reduce((sum, w) => sum + (w.paidBy !== 'unpaid' ? w.amount : 0), 0);
         const totalPayments = data.payments.reduce((sum, p) => sum + p.amount, 0);
         const balance = totalBilled - totalInitiallyPaid - totalPayments;

         return (
           <div key={name} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
             <div 
               className="bg-slate-50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors"
               onClick={() => setExpanded(expanded === name ? null : name)}
             >
               <div>
                 <div className="flex items-center gap-2 flex-wrap">
                   <h3 className="font-bold text-slate-800 text-lg">{name}</h3>
                   {balance <= 0 && totalBilled > 0 && (
                     <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 shadow-3xs">
                       <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Settled
                     </span>
                   )}
                 </div>
                 <p className="text-sm text-slate-500">{data.bills.length} Entries</p>
               </div>
               <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-left sm:text-right w-full sm:w-auto">
                 <div>
                   <p className="text-xs text-slate-500 uppercase font-bold">Total Billed</p>
                   <p className="font-bold text-slate-800">{formatINR(totalBilled)}</p>
                 </div>
                 <div>
                   <p className="text-xs text-rose-500 uppercase font-bold">Already Paid</p>
                   <p className="font-bold text-rose-600">{formatINR(totalInitiallyPaid + totalPayments)}</p>
                 </div>
                 <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm min-w-[120px]">
                   <p className="text-xs text-slate-500 uppercase font-bold">Balance</p>
                   <p className={`font-bold text-lg ${balance > 0 ? 'text-rose-600' : balance < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                     {formatINR(balance)}
                   </p>
                 </div>
               </div>
             </div>
             {expanded === name && (() => {
               // Calculate FIFO allocation for display
               const allocatedBills = [...data.bills]
                 .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                 .map(w => {
                   let allocatedPaid = 0;
                   let allocatedBalance = w.amount;
                   let isSettled = false;
                   
                   if (w.paidBy !== 'unpaid') {
                     allocatedPaid = w.amount;
                     allocatedBalance = 0;
                     isSettled = true;
                   }
                   
                   return {
                     ...w,
                     allocatedPaid,
                     allocatedBalance,
                     isSettled
                   };
                 });

               let pool = totalPayments;
               allocatedBills.forEach(w => {
                 if (w.paidBy === 'unpaid') {
                   const amtPaid = Math.min(w.allocatedBalance, pool);
                   pool -= amtPaid;
                   w.allocatedPaid += amtPaid;
                   w.allocatedBalance -= amtPaid;
                   w.isSettled = w.allocatedBalance <= 0;
                 }
               });

               const displayBills = allocatedBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

               return (
                 <div className="p-4 bg-white border-t border-slate-200">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                       <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Usage & Bills</h4>
                       <div className="max-h-[400px] overflow-y-auto pr-2 flex flex-col gap-3">
                         {displayBills.map(w => {
                           const isEditing = editingId === w.id;
                           return (
                             <div key={w.id}>
                               {isEditing ? (
                                 <div className="p-3 bg-white rounded-lg border border-slate-300 shadow-sm flex flex-col gap-2.5">
                                   <div className="text-xs font-bold text-slate-500 uppercase">Edit Machinery Entry</div>
                                   <div className="grid grid-cols-2 gap-2">
                                     <div className="flex flex-col gap-1">
                                       <label className="text-[10px] text-slate-400 uppercase">Date</label>
                                       <input 
                                         type="date" 
                                         value={editForm.date} 
                                         onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                         className="border p-1.5 rounded text-xs bg-slate-50 outline-none focus:border-amber-500 bg-white" 
                                       />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                       <label className="text-[10px] text-slate-400 uppercase">Hours / Qty</label>
                                       <input 
                                         type="text" 
                                         placeholder="e.g. 5 Hours"
                                         value={editForm.quantity} 
                                         onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} 
                                         className="border p-1.5 rounded text-xs bg-slate-50 outline-none focus:border-amber-500 bg-white" 
                                       />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                       <label className="text-[10px] text-slate-400 uppercase">Rate</label>
                                       <input 
                                         type="number" 
                                         placeholder="Rate"
                                         value={editForm.rate} 
                                         onChange={e => setEditForm({ ...editForm, rate: e.target.value })} 
                                         className="border p-1.5 rounded text-xs bg-slate-50 outline-none focus:border-amber-500 bg-white" 
                                       />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                       <label className="text-[10px] text-slate-400 uppercase">Total Amount</label>
                                       <input 
                                         type="number" 
                                         placeholder="Amount"
                                         value={editForm.amount} 
                                         onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                         className="border p-1.5 rounded text-xs bg-slate-50 outline-none focus:border-amber-500 bg-white" 
                                       />
                                     </div>
                                   </div>
                                   <div className="flex justify-end gap-1.5 mt-1 pt-1.5 border-t">
                                     <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-slate-500 hover:bg-slate-100 rounded text-xs font-semibold">Cancel</button>
                                     <button onClick={() => handleSaveExpense(w)} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-bold shadow-xs">Save</button>
                                   </div>
                                 </div>
                               ) : (
                                 <div className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/60 transition-colors flex flex-col gap-2.5">
                                   <div className="flex justify-between items-start">
                                     <div className="flex flex-col">
                                       <span className="text-slate-800 font-bold text-sm">
                                         {new Date(w.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                       </span>
                                       {w.itemName && (
                                         <span className="text-xs text-slate-500 font-medium mt-0.5">
                                           {w.itemName}
                                         </span>
                                       )}
                                     </div>
                                     
                                     <div>
                                       {w.isSettled ? (
                                         <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-200 shadow-3xs">
                                           <CheckCircle className="w-3 h-3 text-emerald-600" /> Settled
                                         </span>
                                       ) : w.allocatedPaid > 0 ? (
                                         <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 font-bold uppercase px-2 py-0.5 rounded-full border border-amber-200">
                                           Partially Paid
                                         </span>
                                       ) : (
                                         <span className="inline-flex items-center gap-1 text-[10px] bg-rose-100 text-rose-800 font-bold uppercase px-2 py-0.5 rounded-full border border-rose-200">
                                           Pending
                                         </span>
                                       )}
                                     </div>
                                   </div>

                                   {(w.vendor || w.description) && (
                                     <div className="text-xs text-slate-600 bg-white/70 border border-slate-100 p-2 rounded-md space-y-1">
                                       {w.vendor && (
                                         <p><span className="text-slate-400 font-medium">Vendor/Supplier:</span> <span className="font-semibold text-slate-700">{w.vendor}</span></p>
                                       )}
                                       {w.description && (
                                         <p><span className="text-slate-400 font-medium">Note:</span> <span className="text-slate-700 italic">"{w.description}"</span></p>
                                       )}
                                     </div>
                                   )}

                                   <div className="grid grid-cols-4 gap-2 bg-slate-200/45 p-2 rounded-md text-center text-xs border border-slate-200/30">
                                     <div>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hours/Qty</p>
                                       <p className="font-semibold text-slate-700 mt-0.5">{w.quantity || '-'}</p>
                                     </div>
                                     <div>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rate</p>
                                       <p className="font-semibold text-slate-700 mt-0.5">{w.rate ? `₹${w.rate}` : '-'}</p>
                                     </div>
                                     <div>
                                       <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Paid</p>
                                       <p className="font-bold text-emerald-600 mt-0.5">{formatINR(w.allocatedPaid)}</p>
                                     </div>
                                     <div>
                                       <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Balance</p>
                                       <p className="font-bold text-rose-600 mt-0.5">{formatINR(w.allocatedBalance)}</p>
                                     </div>
                                   </div>

                                   {isAdminOrOfficeStaff && (
                                     <div className="flex justify-end gap-1.5 mt-1 pt-1.5 border-t border-slate-200/40">
                                       <button 
                                         onClick={() => { setEditingId(w.id); setEditForm({ date: w.date.split('T')[0], amount: String(w.amount), quantity: String(w.quantity), rate: String(w.rate || 0) }); }} 
                                         className="text-slate-400 hover:text-blue-600 p-1 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all shadow-3xs"
                                         title="Edit"
                                       >
                                         <Edit2 className="w-3.5 h-3.5" />
                                       </button>
                                       <button 
                                         onClick={() => handleDeleteExpense(w)} 
                                         className="text-slate-400 hover:text-red-600 p-1 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all shadow-3xs"
                                         title="Delete"
                                       >
                                         <Trash2 className="w-3.5 h-3.5" />
                                       </button>
                                     </div>
                                   )}
                                 </div>
                               )}
                             </div>
                           );
                         })}
                       </div>
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Payments Made</h4>
                       <div className="max-h-[400px] overflow-y-auto pr-2 flex flex-col gap-2">
                         {data.payments.map(p => {
                           const isEditing = editingId === p.id;
                           return (
                             <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-emerald-50 rounded border border-emerald-100 min-h-[42px]">
                               {isEditing ? (
                                 <div className="flex items-center gap-2 w-full">
                                   <input 
                                     type="date" 
                                     value={editForm.date} 
                                     onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                     className="border p-1 rounded text-xs w-28 bg-white" 
                                   />
                                   <input 
                                     type="number" 
                                     value={editForm.amount} 
                                     onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                     className="border p-1 rounded text-xs w-24 bg-white" 
                                   />
                                   <button onClick={() => handleSavePayment(p)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors" title="Save"><Check className="w-4 h-4" /></button>
                                   <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1 rounded transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
                                 </div>
                               ) : (
                                 <>
                                   <span className="text-emerald-600 font-medium">Payment ({new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})</span>
                                   <div className="flex items-center gap-3">
                                     <span className="font-bold text-emerald-700">{formatINR(p.amount)}</span>
                                     {isAdminOrOfficeStaff && (
                                       <div className="flex gap-1 bg-white border border-slate-100 rounded px-1 shadow-2xs">
                                         <button 
                                           onClick={() => { setEditingId(p.id); setEditForm({ date: p.date.split('T')[0], amount: String(p.amount), quantity: '', rate: '' }); }} 
                                           className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                           title="Edit"
                                         >
                                           <Edit2 className="w-3.5 h-3.5" />
                                         </button>
                                         <button 
                                           onClick={() => handleDeletePayment(p)} 
                                           className="text-slate-400 hover:text-red-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                           title="Delete"
                                         >
                                           <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                 </>
                               )}
                             </div>
                           );
                         })}
                         {data.payments.length === 0 && <p className="text-xs text-slate-400 italic">No separate payments recorded.</p>}
                       </div>
                       
                       {balance > 0 && (
                         <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                           <p className="text-xs font-bold text-slate-600 mb-2 uppercase">Pay Remaining Balance</p>
                           <div className="flex flex-col sm:flex-row gap-2">
                             <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="border p-2 rounded text-sm w-full sm:w-32 outline-none focus:border-amber-500 bg-white" />
                             <input type="number" placeholder="₹ Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="border p-2 rounded text-sm w-full outline-none focus:border-amber-500 bg-white" />
                             {isAdminOrOfficeStaff ? (
                               <select value={payMode} onChange={e => setPayMode(e.target.value as any)} className="border p-2 rounded text-sm bg-white outline-none focus:border-amber-500">
                                 <option value="office">Office</option>
                                 <option value="petty_cash">Petty Cash</option>
                               </select>
                             ) : (
                               <select disabled value="petty_cash" className="border p-2 rounded text-sm bg-slate-100 text-slate-500 outline-none">
                                 <option value="petty_cash">Petty Cash</option>
                               </select>
                             )}
                             <button onClick={() => handlePay(name)} className="bg-amber-500 text-white font-bold px-4 py-2 rounded text-sm hover:bg-amber-600 whitespace-nowrap shadow-sm transition-colors">Pay</button>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
               );
             })()}
           </div>
         )
      })}
      {machineMap.size === 0 && (
         <div className="p-12 text-center text-slate-500">No approved machinery entries found.</div>
      )}
    </div>
  );
}

function ConsumedMaterialGroupedView({ project, triggerUpload, isAdminOrOfficeStaff }: { project: Project, triggerUpload: (id: string) => void, isAdminOrOfficeStaff: boolean }) {
  const { updateProject, state, addToast, updateUser, confirm, prompt, addToRecycleBin, addApprovalRequest } = useAppContext();
  
  // Grouping logic for consumed material
  const materialMap = new Map<string, { entries: ExpenseEntry[], totalQty: number, unit: string }>();

  const items = project.expenseItems?.filter(i => i.category === 'consumed_material') || [];
  
  items.forEach(item => {
    if (item.status === 'Approved') {
       // Extract base name
       // itemName format: "[Consumed] GSb (Some description)"
       let name = item.itemName.replace('[Consumed]', '').trim();
       // Remove (description) if present
       if (name.includes('(')) {
         name = name.split('(')[0].trim();
       }
       name = name.toUpperCase();
       
       // Extract quantity and unit
       // quantity format: "100 cuft" or "100"
       const qtyMatch = item.quantity.match(/([\d.]+)\s*(.*)/);
       const qtyVal = qtyMatch ? parseFloat(qtyMatch[1]) || 0 : parseFloat(item.quantity) || 0;
       const unitVal = qtyMatch ? qtyMatch[2].trim() : '';
       
       const mapKey = `${name}_${unitVal}`.toUpperCase();
       
       if (!materialMap.has(mapKey)) {
         materialMap.set(mapKey, { entries: [], totalQty: 0, unit: unitVal });
       }
       const group = materialMap.get(mapKey)!;
       group.entries.push(item);
       group.totalQty += qtyVal;
    }
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ quantity: '', rate: '', amount: '' });
  const [bulkRateMap, setBulkRateMap] = useState<Record<string, string>>({});

  const handleSaveExpense = (item: ExpenseEntry) => {
    const amt = Math.round(Number(editForm.amount)) || 0;
    const rate = Number(editForm.rate) || 0;
    const qty = parseFloat(editForm.quantity) || 0;
    
    // adjust amount based on rate and qty
    let finalAmt = amt;
    if (rate > 0 && qty > 0 && String(editForm.amount) === String(item.amount)) {
      // If user just updated rate/qty but didn't touch amount, auto-calc
      finalAmt = Math.round(rate * qty);
    }
    
    if (finalAmt < 0) return addToast('Amount cannot be negative', 'error');

    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...item, amount: finalAmt, quantity: String(qty), rate: rate };
      addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: item.id,
        itemName: item.itemName || 'ExpenseEntry',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit',
        oldData: item, newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingId(null);
      return;
    }

    // Refund logic for petty cash etc. (not super critical for consumed material as it might not be paid, but let's keep it safe)
    if (item.status === 'Approved' && item.paidBy === 'petty_cash' && item.submittedById) {
      const diff = finalAmt - item.amount;
      if (diff !== 0) {
        const user = state.users.find(u => u.id === item.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
        }
      }
    }

    const unitMatch = item.quantity.match(/[\d.\s]+(.*)/);
    const originalUnit = unitMatch ? unitMatch[1].trim() : '';
    const newQuantityStr = originalUnit ? `${qty} ${originalUnit}` : `${qty}`;

    const updated = project.expenseItems!.map(i => 
      i.id === item.id ? { ...i, rate, quantity: String(newQuantityStr), amount: finalAmt } : i
    );
    updateProject(project.id, { expenseItems: updated });
    setEditingId(null);
  };

  const handleApplyBulkRate = (mapKey: string, group: { entries: ExpenseEntry[], unit: string }) => {
    const rateVal = parseFloat(bulkRateMap[mapKey]);
    if (isNaN(rateVal) || rateVal < 0) return addToast('Enter a valid rate', 'error');
    
    let updated = [...(project.expenseItems || [])];
    group.entries.forEach(item => {
       const qtyMatch = item.quantity.match(/([\d.]+)/);
       const qtyVal = qtyMatch ? parseFloat(qtyMatch[1]) || 0 : 0;
       const newAmount = Math.round(qtyVal * rateVal);
       
       updated = updated.map(i => i.id === item.id ? { ...i, rate: rateVal, amount: newAmount } : i);
    });
    
    updateProject(project.id, { expenseItems: updated });
    addToast(`Applied rate ₹${rateVal} to ${group.entries.length} entries`, 'success');
  };

  return (
    <div className="flex flex-col gap-4">
      {Array.from(materialMap.entries()).map(([mapKey, group]) => {
        const name = mapKey.split('_')[0];
        const unit = group.unit;
        const totalValue = group.entries.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        return (
          <div key={mapKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div 
              className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpanded(expanded === mapKey ? null : mapKey)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{name}</h3>
                  <div className="text-sm text-slate-500 font-medium">Total Consumed: <span className="text-slate-700">{group.totalQty} {unit}</span></div>
                </div>
              </div>
              <div className="text-right flex items-center gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">{formatINR(totalValue)}</div>
                  <div className="text-xs text-slate-500">Calculated Value</div>
                </div>
                {expanded === mapKey ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
            </div>
            
            {expanded === mapKey && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-6 animate-in slide-in-from-top-2 duration-200">
                <div className="mb-4 flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Set Bulk Rate for {name}:</label>
                  <input 
                    type="number" 
                    placeholder="Rate per unit" 
                    className="border border-slate-200 rounded p-1.5 text-sm w-32 outline-none focus:border-amber-500"
                    value={bulkRateMap[mapKey] || ''}
                    onChange={e => setBulkRateMap({ ...bulkRateMap, [mapKey]: e.target.value })}
                  />
                  <button 
                    onClick={() => handleApplyBulkRate(mapKey, group)}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded font-bold text-xs transition-colors"
                  >
                    Apply & Calculate Value
                  </button>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-xs">
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-600">Date</th>
                        <th className="px-4 py-3 font-bold text-slate-600">Details</th>
                        <th className="px-4 py-3 font-bold text-slate-600 text-right">Quantity</th>
                        <th className="px-4 py-3 font-bold text-slate-600 text-right">Rate</th>
                        <th className="px-4 py-3 font-bold text-slate-600 text-right">Value</th>
                        {isAdminOrOfficeStaff && <th className="px-4 py-3 font-bold text-slate-600 text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.entries.map(item => {
                        const isEditing = editingId === item.id;
                        const qtyMatch = item.quantity.match(/([\d.]+)/);
                        const qtyValStr = qtyMatch ? qtyMatch[1] : item.quantity;
                        
                        return (
                          <tr key={item.id} className={`${isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                            <td className="px-4 py-3 font-medium text-slate-600">
                              {item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-slate-800">
                              {item.itemName.replace('[Consumed]', '').trim()}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800 text-right flex items-center justify-end gap-1">
                              {isEditing ? (
                                <input type="number" step="any" className="border border-slate-300 p-1 w-20 rounded text-right" value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: e.target.value})} />
                              ) : (
                                qtyValStr
                              )}
                              <span className="text-xs text-slate-500 font-normal">{unit}</span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-600 text-right">
                              {isEditing ? (
                                <input type="number" step="any" className="border border-slate-300 p-1 w-20 rounded text-right" value={editForm.rate} onChange={e => setEditForm({...editForm, rate: e.target.value})} />
                              ) : (
                                item.rate ? formatINR(item.rate) : '-'
                              )}
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-600 text-right">
                              {isEditing ? (
                                <input type="number" step="any" className="border border-slate-300 p-1 w-24 rounded text-right" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} />
                              ) : (
                                formatINR(item.amount)
                              )}
                            </td>
                            {isAdminOrOfficeStaff && (
                              <td className="px-4 py-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => handleSaveExpense(item)} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded" title="Save"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-200 rounded" title="Cancel"><X className="w-4 h-4" /></button>
                                  </div>
                                ) : (
                                  <button onClick={() => {
                                    setEditingId(item.id);
                                    setEditForm({ quantity: qtyValStr, rate: item.rate?.toString() || '', amount: item.amount?.toString() || '0' });
                                  }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Entry">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {materialMap.size === 0 && (
         <div className="p-12 text-center text-slate-500">No approved consumed material entries found.</div>
      )}
    </div>
  );
}

function ShiftingGroupedView({ project, triggerUpload, isAdminOrOfficeStaff }: { project: Project, triggerUpload: (id: string) => void, isAdminOrOfficeStaff: boolean }) {
  const { updateProject, state, addToast, updateUser, confirm, prompt, addToRecycleBin, addApprovalRequest } = useAppContext();
  
  const shiftingMap = new Map<string, { bills: ExpenseEntry[], payments: SupplierPayment[] }>();

  (project.expenseItems || []).forEach(item => {
    if (item.status === 'Approved' && item.category === 'shifting') {
       const parts = item.itemName.split(' - ');
       const name = parts[0] ? parts[0].trim().toUpperCase() : 'UNKNOWN VEHICLE';
       if (!shiftingMap.has(name)) shiftingMap.set(name, { bills: [], payments: [] });
       shiftingMap.get(name)!.bills.push(item);
    }
  });

  (project.supplierPayments || []).forEach(pay => {
    if (pay.status === 'Rejected' || pay.status === 'Pending Approval' || pay.status === 'Deleted') {
      return;
    }
    const vNameUpper = pay.vendorName.trim().toUpperCase();
    if (vNameUpper.startsWith('SHIFTING:')) {
      const name = vNameUpper.replace('SHIFTING:', '').trim();
      if (shiftingMap.has(name)) {
        shiftingMap.get(name)!.payments.push(pay);
      }
    }
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMode, setPayMode] = useState<'office'|'petty_cash'>('office');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', date: '', quantity: '', rate: '' });

  const handleSaveExpense = (item: ExpenseEntry) => {
    const amt = Math.round(Number(editForm.amount)) || 0;
    const qty = parseFloat(editForm.quantity) || 0;
    const rate = Number(editForm.rate) || 0;
    
    if (amt <= 0) return addToast('Amount must be positive', 'error');

    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...item, amount: amt, date: editForm.date, quantity: String(qty), rate: rate };
      addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: item.id,
        itemName: item.itemName || 'ExpenseEntry',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit',
        oldData: item, newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingId(null);
      return;
    }

    // Refund/adjust petty cash balance if needed
    if (item.status === 'Approved' && item.paidBy === 'petty_cash' && item.submittedById) {
      const diff = amt - item.amount;
      if (diff !== 0) {
        const user = state.users.find(u => u.id === item.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
        }
      }
    }

    const updated = (project.expenseItems || []).map(i => 
      i.id === item.id ? { ...i, amount: amt, date: editForm.date, quantity: String(qty), rate: rate } : i
    );
    updateProject(project.id, { expenseItems: updated });
    setEditingId(null);
    addToast('Entry updated successfully', 'success');
  };

  const handleSavePayment = (pay: SupplierPayment) => {
    const amt = Math.round(Number(editForm.amount)) || 0;
    if (amt <= 0) return addToast('Amount must be positive', 'error');

    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...pay, amount: amt, date: editForm.date };
      addApprovalRequest({
        projectId: project.id,
        module: 'SupplierPayment',
        recordId: pay.id,
        itemName: pay.vendorName || 'SupplierPayment',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit',
        oldData: pay, newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingId(null);
      return;
    }

    // Refund/adjust petty cash balance if needed
    if (pay.paidBy === 'petty_cash' && pay.submittedById) {
      const diff = amt - pay.amount;
      if (diff !== 0) {
        const user = state.users.find(u => u.id === pay.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
        }
      }
    }

    const updated = (project.supplierPayments || []).map(p => 
      p.id === pay.id ? { ...p, amount: amt, date: editForm.date } : p
    );
    updateProject(project.id, { supplierPayments: updated });
    setEditingId(null);
    addToast('Payment entry updated successfully', 'success');
  };

  const handleDeleteExpenseShifting = async (item: ExpenseEntry) => {
    if (!await confirm('Are you sure you want to delete this entry?')) return;

    const isOfficeStaff = state.currentRole === 'Office Staff';
    const isAdminOrSuperAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin';
    let reason = '';
    
    if (isOfficeStaff) {
      reason = await prompt("Please provide a reason for deletion:") || '';
      if (!reason) return;
      addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: item.id,
        itemName: item.itemName || 'ExpenseEntry',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: item
      });
      addToast('Deletion request submitted for Admin approval.', 'info');
      return;
    }

    if (!isAdminOrSuperAdmin) {
      const enteredPin = await prompt("Enter your Password to confirm deleting this entry:");
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
    }

    reason = await prompt("Please provide a reason for deleting this entry:") || '';
    if (!reason) return;

    if (item.status === 'Approved' && item.paidBy === 'petty_cash' && item.submittedById) {
      const user = state.users.find(u => u.id === item.submittedById);
      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + item.amount });
      }
    }

    addToRecycleBin({
      projectId: project.id,
      itemType: 'ExpenseEntry',
      itemName: item.itemName || 'Expense',
      itemData: item,
      deletedBy: state.currentUser?.name || 'Unknown',
      deleteReason: reason
    });

    const updated = (project.expenseItems || []).filter(i => i.id !== item.id);
    updateProject(project.id, { expenseItems: updated });
    addToast('Entry deleted successfully', 'success');
  };

  const handleDeletePaymentShifting = async (pay: SupplierPayment) => {
    if (!await confirm('Are you sure you want to delete this payment?')) return;

    const isOfficeStaff = state.currentRole === 'Office Staff';
    const isAdminOrSuperAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin';
    let reason = '';
    
    if (isOfficeStaff) {
      reason = await prompt("Please provide a reason for deletion:") || '';
      if (!reason) return;
      addApprovalRequest({
        projectId: project.id,
        module: 'SupplierPayment',
        recordId: pay.id,
        itemName: pay.vendorName || 'SupplierPayment',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: reason || 'Requested delete',
        oldData: pay
      });
      addToast('Deletion request submitted for Admin approval.', 'info');
      return;
    }

    if (!isAdminOrSuperAdmin) {
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
    }

    reason = await prompt("Please provide a reason for deleting this payment:") || '';
    if (!reason) return;

    if (pay.paidBy === 'petty_cash' && pay.submittedById) {
      const user = state.users.find(u => u.id === pay.submittedById);
      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + pay.amount });
      }
    }

    addToRecycleBin({
      projectId: project.id,
      itemType: 'SupplierPayment',
      itemName: pay.vendorName || 'Payment',
      itemData: pay,
      deletedBy: state.currentUser?.name || 'Unknown',
      deleteReason: reason
    });

    const updated = (project.supplierPayments || []).filter(p => p.id !== pay.id);
    updateProject(project.id, { supplierPayments: updated });
    addToast('Payment entry deleted successfully', 'success');
  };

  const handlePay = (name: string) => {
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) return addToast('Invalid amount', 'error');
    const paymentAmt = Number(payAmount);
    const newPayment: SupplierPayment = {
      id: `spay-${Date.now()}`,
      vendorName: `SHIFTING: ${name}`,
      amount: paymentAmt,
      date: payDate,
      note: 'Payment for shifting',
      paidBy: isAdminOrOfficeStaff ? payMode : 'petty_cash',
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
        updateUser(state.currentUser.id, { pettyCashBalance: currentBal - paymentAmt });
      }
    }
    setPayAmount('');
    setPayDate(new Date().toISOString().split('T')[0]);
    addToast(`Payment of ₹${payAmount} made for ${name}`, 'success');
  };

  return (
    <div className="p-6 flex flex-col gap-4">
      {Array.from(shiftingMap.entries()).map(([name, data]) => {
         const totalBilled = data.bills.reduce((sum, w) => sum + w.amount, 0);
         const totalInitiallyPaid = data.bills.reduce((sum, w) => sum + (w.paidBy !== 'unpaid' ? w.amount : 0), 0);
         const totalPayments = data.payments.reduce((sum, p) => sum + p.amount, 0);
         const balance = totalBilled - totalInitiallyPaid - totalPayments;

         return (
           <div key={name} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
             <div 
               className="bg-slate-50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors"
               onClick={() => setExpanded(expanded === name ? null : name)}
             >
               <div>
                 <div className="flex items-center gap-2 flex-wrap">
                   <h3 className="font-bold text-slate-800 text-lg">{name}</h3>
                   {balance <= 0 && totalBilled > 0 && (
                     <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 shadow-3xs">
                       <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Settled
                     </span>
                   )}
                 </div>
                 <p className="text-sm text-slate-500">{data.bills.length} Entries</p>
               </div>
               <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-left sm:text-right w-full sm:w-auto">
                 <div>
                   <p className="text-xs text-slate-500 uppercase font-bold">Total Billed</p>
                   <p className="font-bold text-slate-800">{formatINR(totalBilled)}</p>
                 </div>
                 <div>
                   <p className="text-xs text-rose-500 uppercase font-bold">Already Paid</p>
                   <p className="font-bold text-rose-600">{formatINR(totalInitiallyPaid + totalPayments)}</p>
                 </div>
                 <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm min-w-[120px]">
                   <p className="text-xs text-slate-500 uppercase font-bold">Balance</p>
                   <p className={`font-bold text-lg ${balance > 0 ? 'text-rose-600' : balance < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                     {formatINR(balance)}
                   </p>
                 </div>
               </div>
             </div>
             {expanded === name && (() => {
               // Calculate FIFO allocation for display
               const allocatedBills = [...data.bills]
                 .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                 .map(w => {
                   let allocatedPaid = 0;
                   let allocatedBalance = w.amount;
                   let isSettled = false;
                   
                   if (w.paidBy !== 'unpaid') {
                     allocatedPaid = w.amount;
                     allocatedBalance = 0;
                     isSettled = true;
                   }
                   
                   return {
                     ...w,
                     allocatedPaid,
                     allocatedBalance,
                     isSettled
                   };
                 });

               let pool = totalPayments;
               allocatedBills.forEach(w => {
                 if (w.paidBy === 'unpaid') {
                   const amtPaid = Math.min(w.allocatedBalance, pool);
                   pool -= amtPaid;
                   w.allocatedPaid += amtPaid;
                   w.allocatedBalance -= amtPaid;
                   w.isSettled = w.allocatedBalance <= 0;
                 }
               });

               const displayBills = allocatedBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

               return (
                 <div className="p-4 bg-white border-t border-slate-200">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                       <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Usage & Bills</h4>
                       <div className="max-h-[400px] overflow-y-auto pr-2 flex flex-col gap-3">
                         {displayBills.map(w => {
                           const isEditing = editingId === w.id;
                           return (
                             <div key={w.id}>
                               {isEditing ? (
                                 <div className="p-3 bg-white rounded-lg border border-slate-300 shadow-sm flex flex-col gap-2.5">
                                   <div className="text-xs font-bold text-slate-500 uppercase">Edit Shifting Entry</div>
                                   <div className="grid grid-cols-2 gap-2">
                                     <div className="flex flex-col gap-1">
                                       <label className="text-[10px] text-slate-400 uppercase">Date</label>
                                       <input 
                                         type="date" 
                                         value={editForm.date} 
                                         onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                         className="border p-1.5 rounded text-xs bg-slate-50 outline-none focus:border-amber-500 bg-white" 
                                       />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                       <label className="text-[10px] text-slate-400 uppercase">Trips / Quantity</label>
                                       <input 
                                         type="text" 
                                         placeholder="e.g. 10 Trips"
                                         value={editForm.quantity} 
                                         onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} 
                                         className="border p-1.5 rounded text-xs bg-slate-50 outline-none focus:border-amber-500 bg-white" 
                                       />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                       <label className="text-[10px] text-slate-400 uppercase">Rate per Trip</label>
                                       <input 
                                         type="number" 
                                         placeholder="Rate"
                                         value={editForm.rate} 
                                         onChange={e => setEditForm({ ...editForm, rate: e.target.value })} 
                                         className="border p-1.5 rounded text-xs bg-slate-50 outline-none focus:border-amber-500 bg-white" 
                                       />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                       <label className="text-[10px] text-slate-400 uppercase">Total Amount</label>
                                       <input 
                                         type="number" 
                                         placeholder="Amount"
                                         value={editForm.amount} 
                                         onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                         className="border p-1.5 rounded text-xs bg-slate-50 outline-none focus:border-amber-500 bg-white" 
                                       />
                                     </div>
                                   </div>
                                   <div className="flex justify-end gap-1.5 mt-1 pt-1.5 border-t">
                                     <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-slate-500 hover:bg-slate-100 rounded text-xs font-semibold">Cancel</button>
                                     <button onClick={() => handleSaveExpense(w)} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-bold shadow-xs">Save</button>
                                   </div>
                                 </div>
                               ) : (
                                 <div className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/60 transition-colors flex flex-col gap-2.5">
                                   <div className="flex justify-between items-start">
                                     <div className="flex flex-col">
                                       <span className="text-slate-800 font-bold text-sm">
                                         {new Date(w.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                       </span>
                                       {w.itemName && (
                                         <span className="text-xs text-slate-500 font-medium mt-0.5">
                                           {w.itemName}
                                         </span>
                                       )}
                                     </div>
                                     
                                     <div>
                                       {w.isSettled ? (
                                         <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-200 shadow-3xs">
                                           <CheckCircle className="w-3 h-3 text-emerald-600" /> Settled
                                         </span>
                                       ) : w.allocatedPaid > 0 ? (
                                         <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 font-bold uppercase px-2 py-0.5 rounded-full border border-amber-200">
                                           Partially Paid
                                         </span>
                                       ) : (
                                         <span className="inline-flex items-center gap-1 text-[10px] bg-rose-100 text-rose-800 font-bold uppercase px-2 py-0.5 rounded-full border border-rose-200">
                                           Pending
                                         </span>
                                       )}
                                     </div>
                                   </div>

                                   {(w.shifterName || w.vendor || w.description) && (
                                     <div className="text-xs text-slate-600 bg-white/70 border border-slate-100 p-2 rounded-md space-y-1">
                                       {(w.shifterName || w.vendor) && (
                                         <p><span className="text-slate-400 font-medium">Shifter:</span> <span className="font-semibold text-slate-700">{w.shifterName || w.vendor}</span></p>
                                       )}
                                       {w.description && (
                                         <p><span className="text-slate-400 font-medium">Note:</span> <span className="text-slate-700 italic">"{w.description}"</span></p>
                                       )}
                                     </div>
                                   )}

                                   <div className="grid grid-cols-4 gap-2 bg-slate-200/45 p-2 rounded-md text-center text-xs border border-slate-200/30">
                                     <div>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trips</p>
                                       <p className="font-semibold text-slate-700 mt-0.5">{w.quantity || '-'}</p>
                                     </div>
                                     <div>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rate</p>
                                       <p className="font-semibold text-slate-700 mt-0.5">{w.rate ? `₹${w.rate}` : '-'}</p>
                                     </div>
                                     <div>
                                       <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Paid</p>
                                       <p className="font-bold text-emerald-600 mt-0.5">{formatINR(w.allocatedPaid)}</p>
                                     </div>
                                     <div>
                                       <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Balance</p>
                                       <p className="font-bold text-rose-600 mt-0.5">{formatINR(w.allocatedBalance)}</p>
                                     </div>
                                   </div>

                                   {isAdminOrOfficeStaff && (
                                      <div className="flex justify-end gap-1.5 mt-1 pt-1.5 border-t border-slate-200/40">
                                        <button 
                                          onClick={() => { setEditingId(w.id); setEditForm({ date: w.date.split('T')[0], amount: String(w.amount), quantity: String(w.quantity), rate: String(w.rate || 0) }); }} 
                                          className="text-slate-400 hover:text-blue-600 p-1 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all shadow-3xs"
                                          title="Edit"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteExpenseShifting(w)} 
                                          className="text-slate-400 hover:text-red-600 p-1 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all shadow-3xs"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                   )}
                                 </div>
                               )}
                             </div>
                           );
                         })}
                       </div>
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Payments Made</h4>
                       <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-2">
                         {data.payments.map(p => {
                           const isEditing = editingId === p.id;
                           return (
                             <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-emerald-50 rounded border border-emerald-100 min-h-[42px]">
                               {isEditing ? (
                                 <div className="flex items-center gap-2 w-full">
                                   <input 
                                     type="date" 
                                     value={editForm.date} 
                                     onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                                     className="border p-1 rounded text-xs w-28 bg-white" 
                                   />
                                   <input 
                                     type="number" 
                                     value={editForm.amount} 
                                     onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                                     className="border p-1 rounded text-xs w-24 bg-white" 
                                   />
                                   <button onClick={() => handleSavePayment(p)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors" title="Save"><Check className="w-4 h-4" /></button>
                                   <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1 rounded transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
                                 </div>
                               ) : (
                                 <>
                                   <span className="text-emerald-600 font-medium">Payment ({new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})</span>
                                   <div className="flex items-center gap-3">
                                     <span className="font-bold text-emerald-700">{formatINR(p.amount)}</span>
                                     {isAdminOrOfficeStaff && (
                                       <div className="flex gap-1 bg-white border border-slate-100 rounded px-1 shadow-2xs">
                                         <button 
                                           onClick={() => { setEditingId(p.id); setEditForm({ date: p.date.split('T')[0], amount: String(p.amount), quantity: '', rate: '' }); }} 
                                           className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                           title="Edit"
                                         >
                                           <Edit2 className="w-3.5 h-3.5" />
                                         </button>
                                         <button 
                                           onClick={() => handleDeletePaymentShifting(p)} 
                                           className="text-slate-400 hover:text-red-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                           title="Delete"
                                         >
                                           <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                 </>
                               )}
                             </div>
                           );
                         })}
                         {data.payments.length === 0 && <p className="text-xs text-slate-400 italic">No separate payments recorded.</p>}
                       </div>
                       
                       {balance > 0 && (
                         <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                           <p className="text-xs font-bold text-slate-600 mb-2 uppercase">Pay Remaining Balance</p>
                           <div className="flex flex-col sm:flex-row gap-2">
                             <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="border p-2 rounded text-sm w-full sm:w-32 outline-none focus:border-amber-500 bg-white" />
                             <input type="number" placeholder="₹ Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="border p-2 rounded text-sm w-full outline-none focus:border-amber-500 bg-white" />
                             {isAdminOrOfficeStaff ? (
                               <select value={payMode} onChange={e => setPayMode(e.target.value as any)} className="border p-2 rounded text-sm bg-white outline-none focus:border-amber-500">
                                 <option value="office">Office</option>
                                 <option value="petty_cash">Petty Cash</option>
                               </select>
                             ) : (
                               <select disabled value="petty_cash" className="border p-2 rounded text-sm bg-slate-100 text-slate-500 outline-none">
                                 <option value="petty_cash">Petty Cash</option>
                               </select>
                             )}
                             <button onClick={() => handlePay(name)} className="bg-amber-500 text-white font-bold px-4 py-2 rounded text-sm hover:bg-amber-600 whitespace-nowrap shadow-sm transition-colors">Pay</button>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
               );
             })()}
           </div>
         )
      })}
      {shiftingMap.size === 0 && (
         <div className="p-12 text-center text-slate-500">No approved shifting entries found.</div>
      )}
    </div>
  );
}


function computeItemPaymentStatus(project: Project) {
  const statuses = new Map<string, { status: string, due: number }>();
  const paymentsPool = new Map<string, number>();
  
  (project.supplierPayments || []).forEach(pay => {
    if (pay && pay.vendorName && typeof pay.vendorName === 'string' && pay.vendorName.trim() !== '') {
      const vName = pay.vendorName.trim().toUpperCase();
      paymentsPool.set(vName, (paymentsPool.get(vName) || 0) + pay.amount);
    }
  });

  const sortedItems = [...(project.expenseItems || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  sortedItems.forEach(item => {
    if (item && item.category === 'material' && item.status === 'Approved' && item.paidBy === 'unpaid' && item.vendor && typeof item.vendor === 'string' && item.vendor.trim() !== '') {
      const vName = item.vendor.trim().toUpperCase();
      const pool = paymentsPool.get(vName) || 0;
      
      if (pool >= (item.amount || 0)) {
        statuses.set(item.id, { status: 'Settled (Vendor)', due: 0 });
        paymentsPool.set(vName, pool - (item.amount || 0));
      } else if (pool > 0) {
        statuses.set(item.id, { status: 'Partially Paid', due: (item.amount || 0) - pool });
        paymentsPool.set(vName, 0);
      } else {
        statuses.set(item.id, { status: 'Unpaid', due: item.amount || 0 });
      }
    }
  });
  
  return statuses;
}

function ExpensesModal({ category, project, onClose }: { category: string, project: Project, onClose: () => void }) {
  const { state, updateProject, addToast, confirm, updateUser, prompt, addToRecycleBin, addApprovalRequest } = useAppContext();
  const isAdminOrOfficeStaff = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';
  const items = project.expenseItems?.filter(i => i.category === category && i.status !== "Rejected" && i.status !== "Pending Approval") || [];
  const itemStatuses = computeItemPaymentStatus(project);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ExpenseEntry>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const handleEdit = (item: ExpenseEntry) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const handleSave = () => {
    if (!editingId) return;
    const originalItem = project.expenseItems?.find(i => i.id === editingId);
    if (!originalItem) return;

    // Determine the new amount, rounded to nearest whole integer
    let amount = Math.round(originalItem.amount);
    
    const editedAmount = Number(editForm.amount);
    if (!isNaN(editedAmount) && Math.round(editedAmount) !== Math.round(originalItem.amount)) {
      // User explicitly changed the amount field
      amount = Math.round(editedAmount);
    } else if (
      editForm.vendorRate !== originalItem.vendorRate || 
      editForm.vendorQuantity !== originalItem.vendorQuantity || 
      editForm.rate !== originalItem.rate || 
      editForm.quantity !== originalItem.quantity
    ) {
      // Recalculate based on vendor values if they exist, else standard
      if (editForm.vendorRate !== undefined && editForm.vendorQuantity !== undefined) {
        amount = Math.round(Number(editForm.vendorQuantity) * Number(editForm.vendorRate));
      } else {
        const standardQtyVal = parseFloat(editForm.quantity || '0') || 0;
        const standardRateVal = Number(editForm.rate) || 0;
        amount = Math.round(standardQtyVal * standardRateVal);
      }
    }

    const isOfficeStaff = state.currentRole === 'Office Staff';
    if (isOfficeStaff) {
      const editedData = { ...originalItem, ...editForm, amount };
      addApprovalRequest({
        projectId: project.id,
        module: 'ExpenseEntry',
        recordId: originalItem.id,
        itemName: originalItem.itemName || 'ExpenseEntry',
        action: 'Edit',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: 'Requested edit',
        oldData: originalItem, newData: editedData
      });
      addToast('Edit request submitted for Admin approval.', 'info');
      setEditingId(null);
      return;
    }
    
    // Auto-adjust submitter's balance if the edited item was already approved and paid from petty cash
    if (originalItem.status === 'Approved' && originalItem.paidBy === 'petty_cash' && originalItem.submittedById) {
      const diff = amount - originalItem.amount;
      if (diff !== 0) {
        const user = state.users.find(u => u.id === originalItem.submittedById);
        if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
          updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
        }
      }
    }

    const updatedItems = project.expenseItems?.map(i => 
      i.id === editingId ? { ...i, ...editForm, amount } : i
    ) || [];
    
    updateProject(project.id, { expenseItems: updatedItems });
    setEditingId(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && uploadTargetId) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        return addToast('File size must be less than 5MB', 'error');
      }
      
      const base64 = await resizeImage(file);
      const updatedItems = project.expenseItems?.map(i => 
        i.id === uploadTargetId ? { ...i, hasInvoice: true, photo: base64 } : i
      ) || [];
      updateProject(project.id, { expenseItems: updatedItems }, `Uploaded Bill for Expense ID: ${uploadTargetId}`);
      addToast(`Uploaded: ${file.name}`, 'success');
      setUploadTargetId(null);
    }
  };

  const triggerUpload = (id: string) => {
    setUploadTargetId(id);
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="Go back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 capitalize flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-500" />
              {category} Log & Bills
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Detailed entries and receipts ledger</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-950 font-bold px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg shadow-xs transition-colors">
          Close Panel
        </button>
      </div>

      <div className="p-6 overflow-auto flex-1 w-full bg-slate-50">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
        {category === 'labor' ? (
           <LaborGroupedView project={project} triggerUpload={triggerUpload} isAdminOrOfficeStaff={isAdminOrOfficeStaff} />
        ) : category === 'machinery' ? (
           <MachineryGroupedView project={project} triggerUpload={triggerUpload} isAdminOrOfficeStaff={isAdminOrOfficeStaff} />
        ) : category === 'shifting' ? (
           <ShiftingGroupedView project={project} triggerUpload={triggerUpload} isAdminOrOfficeStaff={isAdminOrOfficeStaff} />
        ) : category === 'consumed_material' ? (
           <ConsumedMaterialGroupedView project={project} triggerUpload={triggerUpload} isAdminOrOfficeStaff={isAdminOrOfficeStaff} />
        ) : items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center bg-white rounded-xl border border-slate-200 shadow-xs max-w-lg mx-auto mt-8">
            <Box className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No detailed entries found for this category yet.</p>
            <p className="text-sm text-slate-400 mt-1">Munshi entries will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto w-full border border-slate-200 rounded-xl bg-white shadow-sm max-h-[calc(100vh-140px)] scrollbar-thin">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[1300px]">
              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-600" style={{ minWidth: '110px' }}>Date</th>
                <th className="px-6 py-4 font-bold text-slate-600" style={{ minWidth: '220px' }}>Item / Details</th>
                <th className="px-6 py-4 font-bold text-slate-600" style={{ minWidth: '160px' }}>Vendor / Source</th>
                <th className="px-6 py-4 font-bold text-slate-600" style={{ minWidth: '120px' }}>Vehicle No</th>
                <th className="px-6 py-4 font-bold text-slate-600" style={{ minWidth: '140px' }}>Submitted By</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-right" style={{ minWidth: '90px' }}>Quantity</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-right" style={{ minWidth: '90px' }}>Rate</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-right" style={{ minWidth: '100px' }}>Amount</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-center" style={{ minWidth: '110px' }}>Bill / Pay Slip</th>
                {isAdminOrOfficeStaff && <th className="px-6 py-4 font-bold text-slate-600 text-center" style={{ minWidth: '120px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className={`${isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {(() => {
                        if (!item.date) return 'N/A';
                        const d = new Date(item.date);
                        if (isNaN(d.getTime())) return item.date;
                        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      })()}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {isEditing ? <input className="border p-1 w-full rounded" value={editForm.itemName} onChange={e => setEditForm({...editForm, itemName: e.target.value})} /> : (
                        <div className="flex flex-col gap-1 items-start">
                          <span>{item.itemName}</span>
                          {item.description && (
                            <span className="text-xs font-normal text-slate-500 whitespace-pre-wrap">{item.description}</span>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.paidBy === 'unpaid' && (
                              (() => {
                                const itemStat = itemStatuses.get(item.id);
                                if (itemStat) {
                                  if (itemStat.status === 'Settled (Vendor)') {
                                    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 uppercase tracking-wider whitespace-nowrap">Settled (Vendor)</span>;
                                  } else if (itemStat.status === 'Partially Paid') {
                                    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 uppercase tracking-wider whitespace-nowrap">Vendor Due: {formatINR(itemStat.due)}</span>;
                                  }
                                }
                                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 uppercase tracking-wider whitespace-nowrap">Unpaid</span>;
                              })()
                            )}
                            {item.paidBy === 'petty_cash' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 uppercase tracking-wider whitespace-nowrap">Petty Cash</span>}
                            {item.paidBy === 'office' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 uppercase tracking-wider whitespace-nowrap">Paid by Office</span>}
                            {item.paidBy === 'used' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 uppercase tracking-wider whitespace-nowrap">Used</span>}
                            {item.status && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider whitespace-nowrap ${
                              item.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                              item.status === 'Rejected' ? 'bg-rose-50 text-rose-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>{item.status}</span>}
                          </div>
                          {item.status === 'Approved' && (
                             <p className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 mt-1 font-medium flex gap-1">
                               <span className="font-bold">Approved by:</span>
                               <span>{(item as any).approvedBy || item.submittedBy || 'System'}</span>
                             </p>
                          )}
                            {item.status === 'Rejected' && (item as any).rejectionReason && (
                              <p className="text-[10px] text-rose-700 bg-rose-50 px-2 py-1.5 rounded-md border border-rose-100 mt-1.5 font-medium w-full max-w-[200px] flex gap-1">
                                <span className="font-bold">{(item as any).rejectedBy || 'Admin'}:</span>
                                <span>{(item as any).rejectionReason}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {isEditing ? <input className="border p-1 w-full rounded" value={editForm.vendor} onChange={e => setEditForm({...editForm, vendor: e.target.value})} /> : (item.vendor || '-')}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                        {isEditing ? <input className="border p-1 w-full rounded" value={editForm.vehicleNo} onChange={e => setEditForm({...editForm, vehicleNo: e.target.value})} /> : (item.vehicleNo || '-')}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {item.submittedBy ? (
                          <>
                            <span className="font-semibold block">{item.submittedBy}</span>
                            <span className="text-[10px] uppercase tracking-wider">{item.submittedByRole}</span>
                            {item.livePhoto && (
                              <button 
                                onClick={() => {
                                   let mapLink = '';
                                   if (item.entryLatitude && item.entryLongitude) {
                                     mapLink = `<div style="margin-top: 20px; text-align: center;">
                                                  <a href="https://www.google.com/maps/search/?api=1&query=${item.entryLatitude},${item.entryLongitude}" target="_blank" style="display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; color: #2563eb; text-decoration: none; font-weight: bold; padding: 10px 16px; border-radius: 6px;">📍 View Location on Map</a>
                                                </div>`;
                                   }
                                   const customContent = `
                                      <h2 style="color: #334155; text-align: center; width: 100%;">Live Verification</h2>
                                      <img src="${item.livePhoto}" style="max-width:100%; max-height:80vh; object-fit:contain; border-radius:8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 2px solid #e2e8f0;" />
                                      ${mapLink}
                                   `;
                                   openMediaInNewTab(item.livePhoto || '', 'Live Verification', 'image', customContent);
                                }}
                                className="mt-1.5 flex w-fit items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 font-bold uppercase hover:bg-emerald-100 transition-colors shadow-sm"
                                title="Click to view live photo and location"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                              </button>
                            )}
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 font-medium">
                        {isEditing ? (
                          editForm.vendorQuantity !== undefined && editForm.vendorUnit ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1">
                                <input 
                                  type="number"
                                  step="any"
                                  className="border p-1 text-right w-20 rounded font-bold" 
                                  value={editForm.vendorQuantity !== undefined ? editForm.vendorQuantity : ''} 
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    const conv = editForm.conversionFactor || 1;
                                    const stdQty = (val * conv).toFixed(2).replace(/\.00$/, "");
                                    const unitStr = editForm.quantity ? editForm.quantity.split(' ')[1] : '';
                                    setEditForm({
                                      ...editForm, 
                                      vendorQuantity: val,
                                      quantity: `${stdQty} ${unitStr}`
                                    });
                                  }} 
                                />
                                <span className="text-xs text-slate-500 font-semibold">{editForm.vendorUnit}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">Std: {(Number(editForm.vendorQuantity || 0) * (editForm.conversionFactor || 1)).toFixed(2)}</span>
                            </div>
                          ) : (
                            <input className="border p-1 text-right w-24 rounded" value={editForm.quantity || ''} onChange={e => setEditForm({...editForm, quantity: e.target.value})} />
                          )
                        ) : (
                          <div className="flex flex-col items-end">
                            {item.vendorQuantity && item.vendorUnit ? (
                              <>
                                <span className="font-semibold text-slate-800">{item.vendorQuantity} {item.vendorUnit}</span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded mt-1">Std: {item.quantity}</span>
                              </>
                            ) : (
                              <span>{item.quantity}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">
                        {isEditing ? (
                          editForm.vendorRate !== undefined && editForm.vendorUnit ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1">
                                <input 
                                  type="number"
                                  className="border p-1 text-right w-20 rounded font-bold" 
                                  value={editForm.vendorRate !== undefined ? editForm.vendorRate : ''} 
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    const conv = editForm.conversionFactor || 1;
                                    const stdRate = Number((val / (conv || 1)).toFixed(2));
                                    setEditForm({
                                      ...editForm, 
                                      vendorRate: val,
                                      rate: stdRate
                                    });
                                  }} 
                                />
                                <span className="text-xs text-slate-500">/ {editForm.vendorUnit}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">Std: ₹{Number(editForm.rate || 0)}</span>
                            </div>
                          ) : (
                            <input type="number" className="border p-1 text-right w-24 rounded" value={editForm.rate || ''} onChange={e => setEditForm({...editForm, rate: Number(e.target.value)})} />
                          )
                        ) : (
                          <div className="flex flex-col items-end">
                            {item.vendorRate && item.vendorUnit ? (
                              <>
                                <span className="font-semibold text-slate-800">{formatINR(item.vendorRate)} / {item.vendorUnit}</span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded mt-1">Std: {formatINR(item.rate)}</span>
                              </>
                            ) : (
                              <span>{item.rate && item.rate > 0 ? formatINR(item.rate) : '-'}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        {isEditing ? <input type="number" className="border p-1 text-right w-24 rounded" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})} /> : formatINR(item.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.hasInvoice ? (
                          <button 
                            className="flex items-center justify-center gap-1.5 mx-auto text-amber-700 bg-amber-50 px-3 py-1.5 rounded border border-amber-200 hover:bg-amber-100 transition-colors text-xs font-bold shadow-sm"
                            onClick={() => {
                              if (item.photo) {
                                const type = item.photo.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg';
                                openMediaInNewTab(item.photo, `${item.itemName || 'Receipt'}_photo`, type);
                              } else {
                                addToast(`No digital copy available for ${item.itemName}.`, 'info');
                              }
                            }}
                          >
                            <Camera className="w-3 h-3" /> View
                          </button>
                        ) : (
                          isAdminOrOfficeStaff ? (
                            <button 
                              className="flex items-center justify-center gap-1.5 mx-auto text-blue-600 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors text-xs font-bold shadow-sm"
                              onClick={() => triggerUpload(item.id)}
                            >
                              <Upload className="w-3 h-3" /> Upload
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">None</span>
                          )
                        )}
                      </td>
                      {isAdminOrOfficeStaff && (
                        <td className="px-6 py-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={handleSave} className="text-emerald-600 hover:text-emerald-700 p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"><Save className="w-4 h-4" /></button>
                              <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 hover:bg-slate-200 rounded transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleEdit(item)} className="text-slate-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded transition-colors block">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {item.paidBy === 'unpaid' && isAdminOrOfficeStaff && (
                                <button
                                  onClick={async () => {
                                    if (await confirm('Confirm payment made by office?')) {
                                      const updatedItems = project.expenseItems?.map(i => i.id === item.id ? { ...i, paidBy: 'office' as any } : i) || [];
                                      updateProject(project.id, { expenseItems: updatedItems }, `Marked entry ${item.itemName} as Paid by Office`);
                                    }
                                  }}
                                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                                    (itemStatuses.get(item.id)?.status === 'Settled (Vendor)' || itemStatuses.get(item.id)?.status === 'Partially Paid')
                                      ? 'hidden' 
                                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  }`}
                                  title="Mark as paid by office"
                                >
                                  Pay
                                </button>
                              )}
                              {item.paidBy === 'office' && isAdminOrOfficeStaff && (
                                <button
                                  onClick={async () => {
                                    if (await confirm('Revert payment to unpaid?')) {
                                      const updatedItems = project.expenseItems?.map(i => i.id === item.id ? { ...i, paidBy: 'unpaid' as any } : i) || [];
                                      updateProject(project.id, { expenseItems: updatedItems }, `Reverted entry ${item.itemName} to Unpaid`);
                                    }
                                  }}
                                  className="text-[10px] font-bold px-2 py-1 bg-rose-100 text-rose-700 rounded hover:bg-rose-200 transition-colors"
                                  title="Mark as unpaid"
                                >
                                  Unpay
                                </button>
                              )}
                              { isAdminOrOfficeStaff && (
                                <button 
                                  onClick={async () => {
                                    const isOfficeStaff = state.currentRole === 'Office Staff';
                                    const reason = await prompt("Please provide a reason for deletion:");
                                    if (!reason) return;
                                    
                                    if (isOfficeStaff) {
                                      addApprovalRequest({
                                        projectId: project.id,
                                        module: 'ExpenseEntry',
                                        recordId: item.id,
                                        itemName: item.itemName || 'ExpenseEntry',
                                        action: 'Delete',
                                        requestedBy: state.currentUser?.name || 'Office Staff',
                                        requestedById: state.currentUser?.id || '',
                                        reason: reason,
                                        oldData: item
                                      });
                                      addToast('Deletion request submitted for Admin approval.', 'info');
                                      return;
                                    }

                                    // If the deleted item was already approved and paid from petty cash, refund the user's balance
                                    if (item.status === 'Approved' && item.paidBy === 'petty_cash' && item.submittedById) {
                                      const user = state.users.find(u => u.id === item.submittedById);
                                      if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
                                        updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + item.amount });
                                      }
                                    }
                                    addToRecycleBin({
                                      projectId: project.id,
                                      itemType: 'ExpenseEntry',
                                      itemName: item.itemName || 'Expense',
                                      itemData: item,
                                      deletedBy: state.currentUser?.name || 'Unknown',
                                      deleteReason: reason || 'Deleted by Admin'
                                    });
                                    const updatedItems = project.expenseItems?.filter(i => i.id !== item.id) || [];
                                    updateProject(project.id, { expenseItems: updatedItems });
                                  }} 
                                  className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors block"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
  );
}

import { SubcontractorTracker } from './SubcontractorTracker';
import { SupplierLedger } from './SupplierLedger';
import { ProjectMilestones } from './ProjectMilestones';

function GlobalExpenseSearch({ project }: { project: Project }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const { state } = useAppContext();
  const isAdminOrOfficeStaff = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';
  const isSiteStaff = state.currentRole === 'Site Incharge' || state.currentRole === 'Munshi';

  if (!isExpanded) {
    return (
      <div 
        className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors" 
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center gap-3">
           <div className="bg-blue-100 p-2 rounded-lg"><Search className="w-5 h-5 text-blue-600" /></div>
           <h3 className="font-bold text-slate-800">Search All Entries</h3>
        </div>
        <p className="text-sm text-slate-500 font-medium">Filter by name, date, category</p>
      </div>
    );
  }

  const filteredItems = (project.expenseItems || []).filter(item => {
    if (isSiteStaff && item.category === 'material') return false; // Site staff don't see material
    if (item.status === 'Rejected' || item.status === 'Pending Approval') return false; // Hide non-approved items from this view
    
    let match = true;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      match = match && (
        (item.itemName && item.itemName.toLowerCase().includes(term)) ||
        (item.vendor && item.vendor.toLowerCase().includes(term)) ||
        (item.vehicleNo && item.vehicleNo.toLowerCase().includes(term)) ||
        (item.submittedBy && item.submittedBy.toLowerCase().includes(term)) ||
        (item.id && item.id.toLowerCase().includes(term))
      );
    }
    if (category !== 'all') {
      match = match && item.category === category;
    }
    if (dateFrom) {
      match = match && item.date >= dateFrom;
    }
    if (dateTo) {
      match = match && item.date <= dateTo;
    }
    return match;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-500" />
          Global Expense Search
        </h3>
        <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <input 
          type="text" 
          placeholder="Search worker, vendor, vehicle..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-slate-200 rounded-lg p-2 text-sm focus:border-amber-500 outline-none"
        />
        <select 
          value={category} 
          onChange={(e) => setCategory(e.target.value)}
          className="border border-slate-200 rounded-lg p-2 text-sm focus:border-amber-500 outline-none"
        >
          <option value="all">All Categories</option>
          {!isSiteStaff && <option value="material">Material</option>}
          <option value="labor">Labor</option>
          <option value="shifting">Shifting</option>
          <option value="machinery">Machinery</option>
          <option value="misc">Misc</option>
        </select>
        <input 
          type="date" 
          value={dateFrom} 
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-slate-200 rounded-lg p-2 text-sm focus:border-amber-500 outline-none"
        />
        <input 
          type="date" 
          value={dateTo} 
          onChange={(e) => setDateTo(e.target.value)}
          className="border border-slate-200 rounded-lg p-2 text-sm focus:border-amber-500 outline-none"
        />
      </div>

      <div className="max-h-[400px] overflow-auto">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No entries found matching filters.</div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Category</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Details</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Amount</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Submitted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{item.date}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{item.category}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {item.itemName}
                    {item.vendor && <span className="block text-xs text-slate-500">{item.vendor}</span>}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">{formatINR(item.amount || 0)}</td>
                  <td className="px-4 py-3 text-slate-500">{item.submittedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ProjectView() {
  const { state, setView, setEntryTab, updateProject, deleteProject, addToast, confirm, prompt, addToRecycleBin, addApprovalRequest } = useAppContext();
  const [viewingCategory, setViewingCategory] = useState<string | null>(null);
  const [showApprovalQueue, setShowApprovalQueue] = useState(false);
  
  React.useEffect(() => {
    if (state.entryTab && ['material', 'labor', 'machinery', 'shifting', 'petty_cash', 'misc', 'logistics'].includes(state.entryTab)) {
      const mapped = state.entryTab === 'logistics' ? 'shifting' : (state.entryTab === 'petty_cash' ? 'misc' : state.entryTab);
      setViewingCategory(mapped);
      setEntryTab('');
    }
  }, [state.entryTab, setEntryTab]);

  const project = state.projects.find(p => p.id === state.selectedProjectId);

  if (!project) return <div className="p-8">Project not found</div>;

  const isAdminOrOfficeStaff = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';
  const subcontractorExpenses = project.subcontractors?.reduce((sum, sub) => sum + (sub.payments || []).reduce((s, p) => s + p.amount, 0), 0) || 0;
  
  const pendingApprovalsCount = (project.expenseItems?.filter(e => e.status === 'Pending Approval').length || 0) + (project.documents?.filter(d => d.status === 'Pending Approval').length || 0) + (project.labors?.filter(l => l.approvalStatus === 'Pending Approval').length || 0) + (project.sitePhotos?.filter(p => p.status === 'Pending Approval').length || 0);
  const totalExpenses = ((project.expenses?.material || 0) + (project.expenses?.shifting || 0) + (project.expenses?.labor || 0) + (project.expenses?.machinery || 0) + (project.expenses?.misc || 0)) + subcontractorExpenses;
  const currentProfit = project.received - totalExpenses;

  // We use woValue as the total relative scale for dials
  const scaleRef = totalExpenses > 0 ? totalExpenses : 1; 

  const handleExportExcel = () => {
    import('xlsx').then((XLSX) => {
       const itemStatuses = computeItemPaymentStatus(project);
       const wb = XLSX.utils.book_new();

       // Sheet 1: Summary
       const summaryData = [
         ['Project Name', project.name || ''],
         ['Department', project.department || ''],
         ['Location', project.location || ''],
         ['Total Work Order Value', project.woValue || 0],
         ['Total Fund Received', project.received || 0],
         ['Total Project Profit', currentProfit || 0],
         [''],
         ['Expense Category', 'Total Amount (₹)'],
         ['Material Cost', project.expenses?.material || 0],
         ['Consumed Material Value', project.expenses?.consumedMaterial || 0],
         ['Shifting Cost', project.expenses?.shifting || 0],
         ['Labor Cost', project.expenses?.labor || 0],
         ['Machinery & Fuel', project.expenses?.machinery || 0],
         ['Misc / Petty Cash', project.expenses?.misc || 0],
         ['Subcontractors Cost', subcontractorExpenses || 0],
         ['Total Expenses', totalExpenses || 0],
       ];
       const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
       XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

       // Sheets for Expenses
       const expenseHeaders = ['Date', 'Item Description', 'Quantity', 'Rate', 'Amount', 'Vendor/Party', 'Vehicle/Details', 'Paid By', 'Status', 'Submitted By'];
       const mapExpense = (cat: string) => {
         const items = (project.expenseItems || []).filter(i => i.category === cat && i.status === "Approved");
         return items.map(item => {
           let paidByStr = item.paidBy === 'petty_cash' ? 'Petty Cash' : item.paidBy === 'office' ? 'Office' : item.paidBy === 'unpaid' ? 'Unpaid' : item.paidBy === 'used' ? 'Used from Stock' : 'N/A';
           if (item.paidBy === 'unpaid' && item.vendor && item.vendor.trim() !== '') {
             const stat = itemStatuses.get(item.id);
             if (stat?.status === 'Settled (Vendor)') {
               paidByStr = 'Paid (Vendor Settled)';
             } else if (stat?.status === 'Partially Paid') {
               paidByStr = `Vendor Due: ${stat.due}`;
             }
           }
           return [
             item.date || '',
             item.itemName || '',
             (item.vendorQuantity !== undefined && item.vendorQuantity !== null && String(item.vendorQuantity).trim() !== "" && Number(item.vendorQuantity) !== 0 && item.vendorUnit) ? `${item.vendorQuantity} ${item.vendorUnit}` : (item.quantity || 0),
             (item.vendorRate !== undefined && item.vendorRate !== null && String(item.vendorRate).trim() !== "" && Number(item.vendorRate) !== 0 && item.vendorUnit) ? `${item.vendorRate} / ${item.vendorUnit}` : (item.rate || 0),
             item.amount || 0,
             item.vendor || '',
             item.vehicleNo || '',
             paidByStr,
             item.status || 'Approved',
             item.submittedBy || 'Unknown'
           ];
         });
       };

       const addExpenseSheet = (title: string, category: string) => {
         const rows = [expenseHeaders, ...mapExpense(category)];
         XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), title);
       };

       addExpenseSheet("Material", "material");
       addExpenseSheet("Consumed Material", "consumed_material");
       addExpenseSheet("Shifting", "shifting");
       addExpenseSheet("Machinery", "machinery");
       addExpenseSheet("Labor Expenses", "labor");
       addExpenseSheet("Miscellaneous", "misc");

       // Subcontractors Sheet
       const subHeaders = ['Subcontractor', 'Phone', 'Work Description', 'Rate', 'Unit', 'Total Completed', 'Total Earning (₹)', 'Total Paid (₹)', 'Balance Due (₹)'];
       const subRows: any[][] = [subHeaders];
       
       (project.subcontractors || []).forEach(sub => {
         const totalWork = (sub.progress || []).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
         const totalEarning = totalWork * (Number(sub.rate) || 0);
         const totalPaid = (sub.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
         const balance = totalEarning - totalPaid;
         
         subRows.push([
           sub.name,
           sub.phone || '',
           sub.workDescription,
           sub.rate,
           sub.unit,
           totalWork,
           totalEarning,
           totalPaid,
           balance
         ]);
       });
       
       subRows.push([''], ['-- Subcontractor Work Logs --'], ['Subcontractor', 'Date', 'Reported By', 'Quantity Added', 'Unit']);
       (project.subcontractors || []).forEach(sub => {
         sub.progress.forEach(p => {
           subRows.push([sub.name, p.date || '', p.reportedBy || '', p.quantity || 0, sub.unit || '']);
         });
       });

       subRows.push([''], ['-- Subcontractor Payments --'], ['Subcontractor', 'Date', 'Amount Paid', 'Note', 'Paid By']);
       (project.subcontractors || []).forEach(sub => {
         sub.payments.forEach(p => {
           subRows.push([sub.name, p.date || '', p.amount || 0, p.note || '', p.paidBy || '']);
         });
       });

       XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(subRows), "Subcontractors");

       // Sheet: Advances
       const advanceRows: any[][] = [
         ['Date', 'Person Name', 'Amount (₹)', 'Note', 'Paid By'],
         ...(project.advanceHistory || []).map(a => [
           a.date,
           a.userName,
           a.amount || 0,
           a.note || '',
           'Office'
         ])
       ];
       XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(advanceRows), "Advances");

       // Sheet: Vendor Ledger
       const vendorRows: any[][] = [
         ['Vendor Ledger Summary'],
         ['Vendor Name', 'Total Billed (₹)', 'Paid Initially (₹)', 'Extra Payments (₹)', 'Total Paid (₹)', 'Balance Due (₹)'],
       ];
       
       const vendorMap = new Map<string, { totalBilled: number; totalPaidInitially: number; payments: any[] }>();
       (project.expenseItems || []).forEach(item => {
         if (item.status === 'Approved' && item.vendor && item.vendor.trim() !== '') {
           const vName = item.vendor.trim().toUpperCase();
           if (!vendorMap.has(vName)) vendorMap.set(vName, { totalBilled: 0, totalPaidInitially: 0, payments: [] });
           const record = vendorMap.get(vName)!;
           record.totalBilled += item.amount || 0;
           if (item.paidBy && item.paidBy !== 'unpaid') {
             record.totalPaidInitially += item.amount || 0;
           }
         }
       });
     
       (project.supplierPayments || []).forEach(pay => {
         const vName = pay.vendorName.trim().toUpperCase();
         if (!vendorMap.has(vName)) vendorMap.set(vName, { totalBilled: 0, totalPaidInitially: 0, payments: [] });
         const record = vendorMap.get(vName)!;
         record.payments.push(pay);
       });
     
       vendorMap.forEach((data, name) => {
         const totalPaymentsMade = data.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
         const totalPaid = data.totalPaidInitially + totalPaymentsMade;
         const balance = data.totalBilled - totalPaid;
         vendorRows.push([name, data.totalBilled, data.totalPaidInitially, totalPaymentsMade, totalPaid, balance]);
       });

       vendorRows.push([''], ['-- Extra Vendor Payments Detail --'], ['Vendor Name', 'Date', 'Amount Paid', 'Paid By', 'Note', 'Submitted By']);
       (project.supplierPayments || []).forEach(pay => {
         vendorRows.push([pay.vendorName, pay.date || '', pay.amount || 0, pay.paidBy || '', pay.note || '', pay.submittedBy || '']);
       });

       XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vendorRows), "Vendor Ledger");

       XLSX.writeFile(wb, `${project.name.replace(/\s+/g, '_')}_Report.xlsx`);
    });
  };

  const handleExportPDF = async () => {
    try {
      addToast('Generating PDF... Please wait.', 'info');
      
      const html2pdfModule: any = await import('html2pdf.js');
      const html2pdf: any = html2pdfModule.default || html2pdfModule;
      const { PDFReport } = await import('./PDFReport');
      
      const vendorMap = new Map<string, { totalBilled: number; totalPaidInitially: number; payments: any[] }>();
      (project.expenseItems || []).forEach(item => {
        if (item.status === 'Approved' && item.vendor && item.vendor.trim() !== '') {
          const vName = item.vendor.trim().toUpperCase();
          if (!vendorMap.has(vName)) vendorMap.set(vName, { totalBilled: 0, totalPaidInitially: 0, payments: [] });
          const record = vendorMap.get(vName)!;
          record.totalBilled += item.amount || 0;
          if (item.paidBy && item.paidBy !== 'unpaid') {
            record.totalPaidInitially += item.amount || 0;
          }
        }
      });
      (project.supplierPayments || []).forEach(pay => {
        const vName = pay.vendorName.trim().toUpperCase();
        if (!vendorMap.has(vName)) vendorMap.set(vName, { totalBilled: 0, totalPaidInitially: 0, payments: [] });
        const record = vendorMap.get(vName)!;
        record.payments.push(pay);
      });
      const vendorLedgerData = Array.from(vendorMap.entries()).map(([vendorName, data]) => {
        const totalPaymentsMade = data.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
        const totalPaid = data.totalPaidInitially + totalPaymentsMade;
        const balance = data.totalBilled - totalPaid;
        return { vendorName, totalBilled: data.totalBilled, totalPaid, balance };
      });

      const laborData = (project.labors || []).map(labor => {
        const totalPresent = (labor.attendance || []).filter(a => a.status === 'P' || a.status === 'H').length;
        const totalWages = (labor.attendance || []).reduce((sum, a) => {
          if (a.status === 'P') return sum + labor.rate;
          if (a.status === 'H') return sum + (labor.rate / 2);
          return sum;
        }, 0);
        
        const laborAdvances = (project.advanceHistory || []).filter((a: any) => a.userName === labor.name).reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
        return { name: labor.name, type: labor.type || 'General', totalDays: totalPresent, totalWages, advances: laborAdvances, balance: totalWages - laborAdvances };

      });

      const subcontractorData = (project.subcontractors || []).map(sub => {
        const workValue = (sub.progress || []).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0) * (Number(sub.rate) || 0);
        const totalPaid = (sub.payments || []).reduce((sum, p) => sum + p.amount, 0);
        return { name: sub.name, workDescription: sub.workDescription || 'Contract Work', workValue, totalPaid, balance: workValue - totalPaid };
      });

      const miscDocsData = (project.expenseItems || [])
        .filter(e => e.status === 'Approved' && e.category === 'misc')
        .map(e => ({ date: e.date, description: e.itemName, amount: e.amount, paidBy: e.paidBy || 'Unknown' }));

      const pettyCashData = [
        { received: project.received, spent: totalExpenses, balance: project.received - totalExpenses }
      ];

      const advanceData = (project.advanceHistory || []).map(a => ({
        date: a.date,
        personName: a.userName,
        amount: a.amount,
        note: a.note || '',
        paidBy: 'Office'
      }));

      const { renderToString } = await import('react-dom/server');
      const htmlString = renderToString(
        <PDFReport 
          project={project} 
          totalExpenses={totalExpenses} 
          currentProfit={currentProfit}
          vendorLedgerData={vendorLedgerData}
          laborData={laborData}
          subcontractorData={subcontractorData}
          miscDocsData={miscDocsData}
          pettyCashData={pettyCashData}
          advanceData={advanceData}
        />
      );

      const container = document.createElement('div');
      container.innerHTML = htmlString;
      
      const opt = { 
        margin:       [15, 10, 15, 10],
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] },
        filename:     `${project.name.replace(/\s+/g, '_')}_Report.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
        jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(container).save();
      
      addToast('PDF downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      addToast('Failed to generate PDF. Check console for details.', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500 print:p-0 print:max-w-none print:w-full">
      <div className="flex items-center justify-between print:hidden">
        <button 
          onClick={() => {
            if (isAdminOrOfficeStaff) setView('dashboard');
            else setView('mobile_home');
          }}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> {isAdminOrOfficeStaff ? 'Back to List' : 'Back to Home'}
        </button>
        {isAdminOrOfficeStaff && (
          <div className="flex items-center gap-3">
             <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors text-sm"
              >
                <Download className="w-4 h-4 text-rose-500" /> Export PDF
             </button>
             <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors text-sm"
              >
                <FileText className="w-4 h-4" /> Export Excel
             </button>
             {(state.currentRole === 'Super Admin' || state.currentRole === 'Admin') && (
               <button 
                  onClick={async () => {
                    const enteredPin = await prompt("Enter your Admin Password to confirm deleting this project:");
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

                      const reason = await prompt("Please provide a reason for deleting this project:");
                      if (!reason) return;

                      addToRecycleBin({
                        projectId: project.id,
                        itemType: 'Project',
                        itemName: project.name,
                        itemData: project,
                        deletedBy: state.currentUser?.name || 'Unknown',
                        deleteReason: 'Deleted by Admin'
                      });
                      deleteProject(project.id);
                    } catch (err) {
                      addToast("Failed to verify password", "error");
                    }
                  }}
                  className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors text-sm"
                >
                  <Trash2 className="w-4 h-4" /> Delete Project
               </button>
             )}
          </div>
        )}
      </div>

      {/* Header Panel */}
      <div className="bg-slate-900 text-white p-6 lg:p-8 rounded-xl shadow-lg border border-slate-800 flex flex-col lg:flex-row justify-between gap-6 lg:gap-8 relative print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        
        <div className="flex-[1.5] min-w-0 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-amber-500 tracking-widest uppercase print:text-slate-500">{state.language === 'hi' ? 'प्रोजेक्ट विवरण' : 'PROJECT VITAL'}</h2>
            <div className="lg:hidden print:hidden">
              <button 
                onClick={() => setView('munshi_entry')}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 px-3 py-1.5 rounded font-bold shadow-sm transition-colors text-xs sm:text-sm"
              >
                <PlusCircle className="w-4 h-4" /> {state.language === 'hi' ? 'एंट्री जोड़ें' : 'Add Entry'}
              </button>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight print:text-4xl pr-4 break-words">{project.name}</h1>
          <p className="text-slate-400 mt-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1 print:text-slate-600">
            <span>{state.language === 'hi' ? 'विभाग:' : 'Dept:'} {project.department}</span>
            <span className="w-1 h-1 bg-slate-600 rounded-full hidden sm:block print:bg-slate-300"></span>
            <span>{state.language === 'hi' ? 'स्कीम:' : 'Scheme:'} {project.scheme}</span>
            <span className="w-1 h-1 bg-slate-600 rounded-full hidden sm:block print:bg-slate-300"></span>
            <span>{state.language === 'hi' ? 'स्थान:' : 'Location:'} {project.location}</span>
            <span className="w-1 h-1 bg-slate-600 rounded-full hidden sm:block"></span>
            <span>{state.language === 'hi' ? 'प्रभारी:' : 'Assigned:'} {project.incharge || (state.language === 'hi' ? 'लंबित' : 'Pending')}</span>
          </p>
        </div>

        <div className="flex-1 min-w-0 flex flex-col sm:flex-row flex-wrap items-start lg:items-center justify-start lg:justify-end gap-6 text-left lg:text-right lg:border-l lg:border-slate-700 lg:pl-8">
          <div className="hidden lg:block print:hidden">
            <button 
              onClick={() => setView('munshi_entry')}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2 rounded-lg font-bold shadow-md transition-colors text-sm"
            >
              <PlusCircle className="w-4 h-4" /> {state.language === 'hi' ? 'फील्ड एंट्री जोड़ें' : 'Add Field Entry'}
            </button>
          </div>
          <div className="flex gap-8 sm:gap-10 w-full sm:w-auto">
            {isAdminOrOfficeStaff && (
              <>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{state.language === 'hi' ? 'कुल बजट' : 'Work Order'}</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-200">{formatINR(project.woValue)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{state.language === 'hi' ? 'प्राप्त राशि' : 'Received'}</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-400">{formatINR(project.received)}</p>
                </div>
              </>
            )}
          </div>
          
          {isAdminOrOfficeStaff && (
            <div 
              onClick={() => setShowApprovalQueue(true)}
              className="cursor-pointer bg-slate-800 hover:bg-slate-700 p-3 sm:p-4 rounded-xl border border-slate-700 transition-colors group flex items-center gap-4 w-full sm:w-auto"
            >
              <div className="bg-rose-500/20 p-2 sm:p-2.5 rounded-full text-rose-400 group-hover:text-rose-300 shrink-0">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="text-left">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Approval Queue</p>
                <p className="text-lg sm:text-xl font-bold text-rose-400 group-hover:text-rose-300 leading-none">{pendingApprovalsCount} Pending</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showApprovalQueue && <ApprovalQueueModal project={project} onClose={() => setShowApprovalQueue(false)} />}

      {/* Expense Dials Grid */}
      {isAdminOrOfficeStaff && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExpenseDial 
            label="Material Cost" 
            amount={project.expenses.material} 
            total={scaleRef} 
            colorClass="text-amber-500" 
            icon={Box} 
            actionLabel="View Bills" 
            onAction={() => setViewingCategory('material')}
          />
          <ExpenseDial 
            label="Consumed Material Value" 
            amount={project.expenses.consumedMaterial || 0} 
            total={scaleRef} 
            colorClass="text-indigo-500" 
            icon={Activity} 
            actionLabel="View Usage" 
            onAction={() => setViewingCategory('consumed_material' as any)}
          />
          <ExpenseDial 
            label="Shifting Cost" 
            amount={project.expenses.shifting} 
            total={scaleRef} 
            colorClass="text-orange-500" 
            icon={Truck} 
            actionLabel="Trip Logs" 
            onAction={() => setViewingCategory('shifting')}
          />
          <ExpenseDial 
            label="Labor Wages" 
            amount={project.expenses.labor} 
            total={scaleRef} 
            colorClass="text-blue-500" 
            icon={Users} 
            actionLabel="Attendance" 
            onAction={() => setViewingCategory('labor')}
          />
          <ExpenseDial 
            label="Machinery & Fuel" 
            amount={project.expenses.machinery} 
            total={scaleRef} 
            colorClass="text-purple-500" 
            icon={Settings2} 
            actionLabel="Log Book" 
            onAction={() => setViewingCategory('machinery')}
          />
           <ExpenseDial 
            label="Misc / Petty Cash" 
            amount={project.expenses.misc} 
            total={scaleRef} 
            colorClass="text-emerald-500" 
            icon={Receipt} 
            actionLabel="Cash Ledgers" 
            onAction={() => setViewingCategory('misc')}
          />
          {subcontractorExpenses > 0 && (
            <ExpenseDial 
              label="Subcontractor (Paid)" 
              amount={subcontractorExpenses} 
              total={scaleRef} 
              colorClass="text-indigo-500" 
              icon={Hammer} 
              actionLabel="View Contracts" 
              onAction={() => {
                const el = document.getElementById('subcontractor-tracker');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                  // Open the accordion if it's closed
                  const header = el.firstElementChild as HTMLElement;
                  if (header && el.textContent?.includes('Manage Subcontractors')) {
                     header.click();
                  }
                }
              }}
            />
          )}
        </div>
      )}

      {viewingCategory && (
        <ExpensesModal 
          category={viewingCategory} 
          project={project} 
          onClose={() => {
            setViewingCategory(null);
            if (!isAdminOrOfficeStaff) {
              setView('mobile_home');
            }
          }} 
        />
      )}

      {/* Global Expense Search */}
      {isAdminOrOfficeStaff && <GlobalExpenseSearch project={project} />}

      {/* Subcontractor Tracker */}
      {(isAdminOrOfficeStaff || (state.currentRole === 'Site Incharge' && state.currentUser?.canViewSubcontractors)) && <SubcontractorTracker project={project} />}

      {/* Supplier / Vendor Ledger */}
      {isAdminOrOfficeStaff && <SupplierLedger project={project} />}

      {/* New Advance & Site Funds Section */}
      {isAdminOrOfficeStaff && <SiteAdvanceTracker project={project} />}

      {/* Summary Footer */}
      {isAdminOrOfficeStaff && (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 shadow-inner">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Total Booked Expenses</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatINR(totalExpenses)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Current Project Profit</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{formatINR(currentProfit)}</p>
          </div>
        </div>
      )}

      {/* Admin Controls (Payments & Status) */}
      { (state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff') && (
        <div className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-500" />
              Project Management Controls
            </h3>
            <span className={`text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded self-start sm:self-center ${project.status === 'Active' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              Status: {project.status}
            </span>
          </div>
          <div className="p-4 sm:p-6 flex flex-col lg:flex-row gap-6 sm:gap-8">
            <PaymentReceivedForm project={project} />
            <ProjectStatusToggle project={project} />
          </div>
        </div>
      )}

      {/* Site Photos (Accessible to everyone) */}
      <SitePhotoGallery project={project} />

      {/* Digital Vault */}
      {isAdminOrOfficeStaff && (
      <div id="digital-vault" className="mt-8">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Digital Vault (Docs)</h3>
           <label className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-bold uppercase rounded cursor-pointer transition-colors shadow-sm">
             <PlusCircle className="w-4 h-4" />
             Upload Photo / Doc
             <input 
               type="file"
               accept="image/*,application/pdf"
               className="hidden" 
               onChange={async (e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   if (file.size > 5 * 1024 * 1024) {
                     return addToast('File size must be less than 5MB', 'error');
                   }
                   const base64 = await resizeImage(file);
                   const newDoc = {
                     id: `doc-${Date.now()}`,
                     name: file.name,
                     type: file.type,
                     data: base64,
                     uploadedAt: new Date().toISOString()
                   };
                   updateProject(project.id, {
                     documents: [...(project.documents || []), newDoc]
                   }, `Uploaded Document: ${file.name}`);
                 }
               }} 
             />
           </label>
        </div>
        <div className="flex flex-wrap gap-3">
          {project.documents && project.documents.filter(d => d.status !== 'Pending Approval' && d.status !== 'Rejected').length > 0 ? (
            project.documents.filter(d => d.status !== 'Pending Approval' && d.status !== 'Rejected').map(doc => (
              <div 
                key={doc.id} 
                onClick={() => {
                   if (doc.data) {
                     openMediaInNewTab(doc.data, doc.name || 'Document', doc.type || '');
                   }
                }}
                className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all group"
              >
                <FileText className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                <span className="text-sm font-medium text-slate-700">{doc.name}</span>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    const isOfficeStaff = state.currentRole === 'Office Staff';
                    const reason = await prompt("Please provide a reason for deletion:");
                    if (!reason) return;

                    if (isOfficeStaff) {
                      addApprovalRequest({
                        projectId: project.id,
                        module: 'DocumentEntry',
                        recordId: doc.id,
                        itemName: doc.name || 'Document',
                        action: 'Delete',
                        requestedBy: state.currentUser?.name || 'Office Staff',
                        requestedById: state.currentUser?.id || '',
                        reason: reason,
                        oldData: doc
                      });
                      addToast('Deletion request submitted for Admin approval.', 'info');
                      return;
                    }

                    addToRecycleBin({
                      projectId: project.id,
                      itemType: 'DocumentEntry',
                      itemName: doc.name,
                      itemData: doc,
                      deletedBy: state.currentUser?.name || 'Unknown',
                      deleteReason: reason || 'Deleted by Admin'
                    });
                    updateProject(project.id, {
                      documents: project.documents?.filter(d => d.id !== doc.id)
                    }, `Deleted Document: ${doc.name}`);
                  }}
                  className="ml-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  ×
                </button>
              </div>
            ))
          ) : (
             <p className="text-slate-500 text-sm">No documents uploaded yet.</p>
          )}
        </div>
      </div>
      )}

      {/* Project Milestones / Checklist */}
      {isAdminOrOfficeStaff && (
        <ProjectMilestones 
          project={project} 
          updateProject={updateProject} 
          currentUser={state.currentUser} 
        />
      )}
    </div>
  );
}
