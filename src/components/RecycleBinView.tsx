import React, { useState } from 'react';
import { useAppContext } from '../store';
import { 
  Trash2, AlertTriangle, ArrowLeft, XCircle, CheckCircle, X, 
  User, HardHat, FileText, Camera, Receipt, Clock, RefreshCcw 
} from 'lucide-react';

export function RecycleBinView() {
  const { 
    state, setView, removeFromRecycleBin, updateProject, 
    deleteProject, deleteUser, updateUser, addToRecycleBin, confirm, addToast,
    addProject, addUser
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'deleted' | 'pending_approval'>('deleted');

  const currentUser = state.currentUser;
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin';

  const binItems = state.recycleBin || [];

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 text-center mt-2 max-w-md">
          {state.language === 'hi' ? 'रीसायकल बिन केवल एडमिन के लिए उपलब्ध है।' : 'Recycle Bin is only available for Admins.'}
        </p>
      </div>
    );
  }

  // Filter items
  const deletedItems = binItems.filter(item => !item.itemType.startsWith('Pending_Deletion_'));
  const pendingDeletions = binItems.filter(item => item.itemType.startsWith('Pending_Deletion_'));

  const handlePermanentDelete = async (id: string) => {
    if (await confirm(state.language === 'hi' ? "क्या आप वाकई इस आइटम को स्थायी रूप से हटाना चाहते हैं?" : "Are you sure you want to permanently delete this item? This action cannot be undone.")) {
      removeFromRecycleBin(id);
      addToast(state.language === 'hi' ? 'आइटम स्थायी रूप से हटा दिया गया।' : 'Item permanently deleted.', 'success');
    }
  };

  const handleRestoreItem = async (item: any) => {
    if (!isAdmin) {
      addToast(state.language === 'hi' ? 'केवल एडमिन ही रीस्टोर कर सकते हैं।' : 'Only admins can restore items.', 'error');
      return;
    }

    if (!await confirm(state.language === 'hi' ? "क्या आप इस आइटम को रीस्टोर करना चाहते हैं?" : "Are you sure you want to restore this item?")) {
      return;
    }

    try {
      const data = item.itemData;
      if (item.itemType === 'Project') {
        const existing = state.projects.find(p => p.id === data.id);
        if (!existing) addProject(data);
      } else if (item.itemType === 'User') {
        const existing = state.users.find(u => u.id === data.id);
        if (!existing) addUser(data);
      } else if (item.projectId) {
        const proj = state.projects.find(p => p.id === item.projectId);
        if (proj) {
          if (item.itemType === 'ExpenseEntry') {
            const updatedExpenses = [...(proj.expenseItems || []), data];
            updateProject(proj.id, { expenseItems: updatedExpenses });
            if (data.status === 'Approved' && data.paidBy === 'petty_cash' && data.submittedById) {
              const user = state.users.find(u => u.id === data.submittedById);
              if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
                updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - data.amount });
              }
            }
          } else if (item.itemType === 'SupplierPayment') {
            const updatedPayments = [...(proj.supplierPayments || []), data];
            updateProject(proj.id, { supplierPayments: updatedPayments });
            if (data.paidBy === 'petty_cash' && data.submittedById) {
              const user = state.users.find(u => u.id === data.submittedById);
              if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
                updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - data.amount });
              }
            }
          } else if (item.itemType === 'AdvanceEntry') {
            const updatedAdvances = [...(proj.advanceHistory || []), data];
            updateProject(proj.id, { advanceHistory: updatedAdvances });
            const user = state.users.find(u => u.id === data.userId);
            if (user) {
              updateUser(data.userId, { pettyCashBalance: (user.pettyCashBalance || 0) + data.amount });
            }
          } else if (item.itemType === 'SitePhoto') {
            const updatedPhotos = [...(proj.sitePhotos || []), data];
            updateProject(proj.id, { sitePhotos: updatedPhotos });
          } else if (item.itemType === 'DocumentEntry') {
            const updatedDocs = [...(proj.documents || []), data];
            updateProject(proj.id, { documents: updatedDocs });
          }
        }
      }
      
      removeFromRecycleBin(item.id);
      addToast(state.language === 'hi' ? 'आइटम को सफलतापूर्वक रीस्टोर कर दिया गया है।' : 'Item restored successfully.', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to restore item', 'error');
    }
  };

  const handleApproveRequest = async (item: any) => {
    if (!isAdmin) {
      addToast(state.language === 'hi' ? 'केवल एडमिन ही अनुमति दे सकते हैं।' : 'Only admins can approve requests.', 'error');
      return;
    }

    const isEdit = item.itemType.startsWith('Pending_Edit_');
    const originalType = item.itemType.replace('Pending_Deletion_', '').replace('Pending_Edit_', '');
    
    if (!await confirm(state.language === 'hi' 
      ? `क्या आप इस ${isEdit ? 'संशोधन' : 'हटाने'} के अनुरोध को स्वीकृत करना चाहते हैं?` 
      : `Are you sure you want to approve this ${isEdit ? 'edit' : 'deletion'} request?`)) {
      return;
    }

    const data = item.itemData;
    const projectId = item.projectId;

    try {
      if (isEdit) {
        const { original, edited } = data;
        const proj = state.projects.find(p => p.id === projectId);
        if (proj) {
          if (originalType === 'ExpenseEntry') {
            const diff = edited.amount - original.amount;
            if (original.status === 'Approved' && original.paidBy === 'petty_cash' && original.submittedById && diff !== 0) {
              const user = state.users.find(u => u.id === original.submittedById);
              if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
                updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
              }
            }
            const updatedExpenses = (proj.expenseItems || []).map(e => e.id === original.id ? edited : e);
            updateProject(proj.id, { expenseItems: updatedExpenses });
          } else if (originalType === 'SupplierPayment') {
            const diff = edited.amount - original.amount;
            if (original.paidBy === 'petty_cash' && original.submittedById && diff !== 0) {
              const user = state.users.find(u => u.id === original.submittedById);
              if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
                updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) - diff });
              }
            }
            const updatedPayments = (proj.supplierPayments || []).map(p => p.id === original.id ? edited : p);
            updateProject(proj.id, { supplierPayments: updatedPayments });
          } else if (originalType === 'AdvanceEntry') {
            const diff = edited.amount - original.amount;
            const user = state.users.find(u => u.id === original.userId);
            if (user && diff !== 0) {
              updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + diff });
            }
            const updatedAdvances = (proj.advanceHistory || []).map(a => a.id === original.id ? edited : a);
            updateProject(proj.id, { advanceHistory: updatedAdvances });
          }
        }
        removeFromRecycleBin(item.id);
        addToast(state.language === 'hi' ? 'संशोधन अनुरोध स्वीकृत हो गया है।' : 'Edit request approved successfully.', 'success');
        return;
      }

      // 1. Perform actual deletion from the active state
      if (originalType === 'User') {
        deleteUser(data.id);
      } else if (originalType === 'Project') {
        deleteProject(projectId);
      } else {
        const proj = state.projects.find(p => p.id === projectId);
        if (proj) {
          if (originalType === 'site_photo') {
            const updatedPhotos = (proj.sitePhotos || []).filter(p => p.id !== data.id);
            updateProject(proj.id, { sitePhotos: updatedPhotos });
          } else if (originalType === 'official_doc') {
            const updatedDocs = (proj.documents || []).filter(d => d.id !== data.id);
            updateProject(proj.id, { documents: updatedDocs });
          } else if (originalType === 'receipt') {
            const updatedExpenses = (proj.expenseItems || []).map(e => {
              if (e.id === data.id) {
                return { ...e, photo: '', hasInvoice: false };
              }
              return e;
            });
            updateProject(proj.id, { expenseItems: updatedExpenses });
          } else if (originalType === 'ExpenseEntry') {
            if (data.status === 'Approved' && data.paidBy === 'petty_cash' && data.submittedById) {
              const user = state.users.find(u => u.id === data.submittedById);
              if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
                updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + data.amount });
              }
            }
            const updatedExpenses = (proj.expenseItems || []).filter(e => e.id !== data.id);
            updateProject(proj.id, { expenseItems: updatedExpenses });
          } else if (originalType === 'SupplierPayment') {
            if (data.paidBy === 'petty_cash' && data.submittedById) {
              const user = state.users.find(u => u.id === data.submittedById);
              if (user && user.role !== 'Admin' && user.role !== 'Super Admin') {
                updateUser(user.id, { pettyCashBalance: (user.pettyCashBalance || 0) + data.amount });
              }
            }
            const updatedPayments = (proj.supplierPayments || []).filter(p => p.id !== data.id);
            updateProject(proj.id, { supplierPayments: updatedPayments });
          } else if (originalType === 'AdvanceEntry') {
            const user = state.users.find(u => u.id === data.userId);
            if (user) {
              updateUser(data.userId, { pettyCashBalance: (user.pettyCashBalance || 0) - data.amount });
            }
            const updatedAdvances = (proj.advanceHistory || []).filter(a => a.id !== data.id);
            updateProject(proj.id, { advanceHistory: updatedAdvances });
          }
        }
      }

      // 2. Convert this recycle bin item into a standard deleted item
      // We'll remove the pending request, and add a standard deleted record
      removeFromRecycleBin(item.id);

      // Add as fully deleted item
      addToRecycleBin({
        projectId: projectId,
        itemType: originalType === 'site_photo' ? 'SitePhoto' : originalType === 'official_doc' ? 'DocumentEntry' : originalType,
        itemName: item.itemName.replace(' (Pending Deletion Approval)', ''),
        itemData: data,
        deletedBy: item.deletedBy,
        deleteReason: `${item.deleteReason.replace(' [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]', '')} [APPROVED BY ADMIN]`
      });

      addToast(state.language === 'hi' ? 'हटाने का अनुरोध स्वीकृत हो गया है।' : 'Deletion request approved successfully.', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to approve deletion', 'error');
    }
  };

  const handleRejectRequest = async (item: any) => {
    if (!isAdmin) {
      addToast(state.language === 'hi' ? 'केवल एडमिन ही अस्वीकृत कर सकते हैं।' : 'Only admins can reject requests.', 'error');
      return;
    }

    const isEdit = item.itemType.startsWith('Pending_Edit_');

    if (!await confirm(state.language === 'hi' 
      ? `क्या आप इस ${isEdit ? 'संशोधन' : 'हटाने'} के अनुरोध को अस्वीकार करना चाहते हैं?` 
      : `Are you sure you want to reject this ${isEdit ? 'edit' : 'deletion'} request? The item will remain unchanged.`)) {
      return;
    }

    removeFromRecycleBin(item.id);
    addToast(state.language === 'hi' ? 'अनुरोध अस्वीकृत कर दिया गया है।' : 'Request rejected. Item is kept safe.', 'info');
  };

  const getItemIcon = (type: string) => {
    if (type.includes('User')) return <User className="w-4 h-4 text-slate-500" />;
    if (type.includes('Project')) return <HardHat className="w-4 h-4 text-slate-500" />;
    if (type.includes('Doc') || type.includes('doc')) return <FileText className="w-4 h-4 text-slate-500" />;
    if (type.includes('Photo') || type.includes('photo')) return <Camera className="w-4 h-4 text-slate-500" />;
    return <Receipt className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24 md:pb-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('dashboard')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-500" /> 
              {state.language === 'hi' ? 'रीसायकल बिन और अनुमतियां' : 'Recycle Bin & Approvals'}
            </h1>
            <p className="text-slate-500 mt-1">
              {state.language === 'hi' 
                ? 'हटाए गए आइटमों की समीक्षा करें और ऑफिस स्टाफ के डिलीट अनुरोधों को स्वीकृत करें।' 
                : 'Review deleted items and manage deletion approval requests from office staff.'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('deleted')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'deleted' 
              ? 'border-amber-500 text-amber-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          {state.language === 'hi' ? 'हटाए गए आइटम' : 'Deleted Items'} ({deletedItems.length})
        </button>
        <button
          onClick={() => setActiveTab('pending_approval')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'pending_approval' 
              ? 'border-amber-500 text-amber-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          {state.language === 'hi' ? 'हटाने की स्वीकृति कतार' : 'Deletion Approvals'} ({pendingDeletions.length})
          {pendingDeletions.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {pendingDeletions.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {activeTab === 'deleted' ? (
          deletedItems.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <Trash2 className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                {state.language === 'hi' ? 'रीसायकल बिन खाली है' : 'Recycle Bin is Empty'}
              </h3>
              <p className="text-slate-500 mt-1 max-w-sm">
                {state.language === 'hi' ? 'हटाए गए आइटम एडमिन समीक्षा के लिए यहाँ दिखाई देंगे।' : 'Items deleted by Admin will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Item Name</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Type</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Deleted By</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Reason</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Date</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deletedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          {getItemIcon(item.itemType)}
                          {item.itemName}
                        </div>
                        {item.projectId && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            Project: {state.projects.find(p => p.id === item.projectId)?.name || item.projectId}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-full border border-slate-200 uppercase tracking-wider">
                          {item.itemType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">
                        {item.deletedBy}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-xs text-slate-700 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{item.deleteReason}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button 
                          onClick={() => handleRestoreItem(item)}
                          className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-100"
                          title="Restore Item"
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handlePermanentDelete(item.id)}
                          className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100"
                          title="Delete Permanently"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          pendingDeletions.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <Clock className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                {state.language === 'hi' ? 'कोई लंबित अनुरोध नहीं' : 'No Pending Requests'}
              </h3>
              <p className="text-slate-500 mt-1 max-w-sm">
                {state.language === 'hi' ? 'ऑफिस स्टाफ द्वारा हटाए जाने के अनुरोध यहाँ दिखाई देंगे।' : 'Deletions requested by Office Staff will appear here for Admin approval.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Requested Item</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Category</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Requested By</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Deletion Reason</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">Request Date</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingDeletions.map((item) => {
                    const cleanType = item.itemType.replace('Pending_Deletion_', '');
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-extrabold text-slate-800 flex items-center gap-2">
                            {getItemIcon(cleanType)}
                            {item.itemName.replace(' (Pending Deletion Approval)', '')}
                          </div>
                          {item.projectId && (
                            <div className="text-xs text-slate-500 mt-0.5 font-medium">
                              📍 Project: {state.projects.find(p => p.id === item.projectId)?.name || item.projectId}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold rounded-full border border-amber-200 uppercase tracking-wider">
                            {cleanType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-extrabold text-slate-700">
                          {item.deletedBy}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="text-xs text-rose-700 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 flex items-start gap-2 leading-relaxed font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span>{item.deleteReason.replace(' [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]', '')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                          {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button 
                            onClick={() => handleApproveRequest(item)}
                            className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shadow-xs"
                            title="Approve Request"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleRejectRequest(item)}
                            className="p-2 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 shadow-xs"
                            title="Reject Request"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

      </div>

    </div>
  );
}
