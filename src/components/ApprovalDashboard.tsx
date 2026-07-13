import React from 'react';
import { useAppContext } from '../store';
import { Check, X } from 'lucide-react';

export function ApprovalDashboard() {
  const { state, updateApprovalRequest, updateProject, updateUser, addAuditLog, addToRecycleBin, prompt } = useAppContext();
  
  const rawPendingRequests = (state.approvalRequests || []).filter(r => r.status === 'Pending');

  // Pull all pending items from projects dynamically to unify the dashboards
  const dynamicPendingRequests: import('../types').ApprovalRequest[] = [];
  state.projects.forEach(project => {
    (project.sitePhotos || []).forEach(p => {
      if (p.status === 'Pending Approval') {
        dynamicPendingRequests.push({
          id: p.id,
          projectId: project.id,
          module: 'SitePhoto',
          recordId: p.id,
          itemName: p.name || 'Photo',
          action: 'Create',
          newData: p,
          reason: 'New Photo Upload: ' + p.category,
          requestedBy: p.uploadedBy || 'Field Staff',
          requestedById: 'unknown',
          requestedAt: p.uploadedAt || new Date().toISOString(),
          status: 'Pending'
        });
      }
    });
    (project.expenseItems || []).forEach(e => {
      if (e.status === 'Pending Approval') {
        dynamicPendingRequests.push({
          id: e.id,
          projectId: project.id,
          module: 'ExpenseEntry',
          recordId: e.id,
          itemName: e.itemName || 'Expense',
          action: 'Create',
          newData: e,
          reason: 'New Expense Entry',
          requestedBy: e.submittedBy || e.submittedByRole || 'Field Staff',
          requestedById: e.submittedById || 'unknown',
          requestedAt: e.date || new Date().toISOString(),
          status: 'Pending'
        });
      }
    });
    (project.documents || []).forEach(d => {
      if (d.status === 'Pending Approval') {
        dynamicPendingRequests.push({
          id: d.id,
          projectId: project.id,
          module: 'DocumentEntry',
          recordId: d.id,
          itemName: d.name || 'Document',
          action: 'Create',
          newData: d,
          reason: 'New Document Upload',
          requestedBy: d.uploadedBy || 'Field Staff',
          requestedById: d.uploadedById || 'unknown',
          requestedAt: d.uploadedAt || new Date().toISOString(),
          status: 'Pending'
        });
      }
    });
    (project.labors || []).forEach(l => {
      if (l.approvalStatus === 'Pending Approval') {
        dynamicPendingRequests.push({
          id: l.id,
          projectId: project.id,
          module: 'LaborEntry',
          recordId: l.id,
          itemName: l.name || 'Labor',
          action: 'Create',
          newData: l,
          reason: 'New Labor Registration',
          requestedBy: l.createdBy || 'Field Staff',
          requestedById: 'unknown',
          requestedAt: new Date().toISOString(),
          status: 'Pending'
        });
      }
    });
  });

  const pendingRequests = [...rawPendingRequests, ...dynamicPendingRequests].filter(req => {
    if (state.currentRole === 'Super Admin' || state.currentRole === 'Admin') {
      // Hide stale edit/delete requests that were accidentally created by Admin/Super Admin before the fix
      if (req.action !== 'Create') {
        const requester = state.users.find(u => u.id === req.requestedById);
        if (requester && (requester.role === 'Super Admin' || requester.role === 'Admin')) {
          return false;
        }
      }
      return true;
    }
    
    if (state.currentRole === 'Office Staff') {
      if (req.requestedById === state.currentUser?.id || req.requestedBy === state.currentUser?.name) {
        return false;
      }
      
      const requester = state.users.find(u => u.id === req.requestedById);
      if (requester && (requester.role === 'Super Admin' || requester.role === 'Admin' || requester.role === 'Office Staff')) {
        return false;
      }
      
      if (req.reason?.includes('REQUESTED BY OFFICE STAFF')) {
        return false;
      }
      
      return true;
    }
    
    return false;
  });

  const handleApprove = (req: import('../types').ApprovalRequest) => {
    updateApprovalRequest(req.id, { status: 'Approved' });
    addAuditLog({
      projectId: req.projectId,
      module: req.module,
      recordId: req.recordId,
      action: req.action === 'Delete' ? 'Delete Approved' : (req.action === 'Create' ? 'Create Approved' : 'Update Approved'),
      user: state.currentUser?.name || 'Admin',
      role: state.currentRole,
      reason: req.reason
    });

    if (req.projectId) {
      const project = state.projects.find(p => p.id === req.projectId);
      if (project) {
        if (req.action === 'Delete') {
          // Soft delete logic for project module entities
          const listName = getProjectListName(req.module);
          if (listName && project[listName as keyof typeof project]) {
            const list = project[listName as keyof typeof project] as any[];
            const item = list.find(i => i.id === req.recordId);
            if (item) {
              const updatedList = list.map(i => i.id === req.recordId ? { ...i, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: state.currentUser?.id } : i);
              updateProject(project.id, { [listName]: updatedList }, `Approved delete of ${req.itemName}`);
              
              // Also add to RecycleBin for actual archival
              addToRecycleBin({
                projectId: project.id,
                itemType: req.module,
                itemName: req.itemName,
                itemData: item,
                deletedBy: state.currentUser?.name || 'Admin',
                deleteReason: req.reason || 'Approved Delete Request'
              });
            }
          }
        } else if (req.action === 'Edit') {
          const listName = getProjectListName(req.module);
          if (listName && project[listName as keyof typeof project]) {
            const list = project[listName as keyof typeof project] as any[];
            const updatedList = list.map(i => i.id === req.recordId ? { ...i, ...req.newData, approvedBy: state.currentUser?.name, approvedById: state.currentUser?.id } : i);
            updateProject(project.id, { [listName]: updatedList }, `Approved edit of ${req.itemName}`);
          }
        } else if (req.action === 'Create') {
          const listName = getProjectListName(req.module);
          if (listName) {
            const list = project[listName as keyof typeof project] as any[] || [];
            const newRecord = { ...req.newData, status: 'Approved', approvalStatus: 'Approved', approvedBy: state.currentUser?.name, approvedById: state.currentUser?.id };
            const existingIndex = list.findIndex(i => i.id === req.recordId);
            let updatedList;
            if (existingIndex >= 0) {
              updatedList = list.map(i => i.id === req.recordId ? newRecord : i);
            } else {
              updatedList = [...list, newRecord];
            }
            updateProject(project.id, { [listName]: updatedList }, `Approved creation of ${req.itemName}`);
          }
        }
      }
    } else if (req.module === 'User') {
      if (req.action === 'Delete') {
        updateUser(req.recordId, { status: 'Deleted', isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: state.currentUser?.id });
        addToRecycleBin({
          itemType: 'User',
          itemName: req.itemName,
          itemData: req.oldData,
          deletedBy: state.currentUser?.name || 'Admin',
          deleteReason: req.reason || 'Approved Delete Request'
        });
      } else if (req.action === 'Edit') {
        updateUser(req.recordId, req.newData);
      }
    }
  };

  const handleReject = async (req: import('../types').ApprovalRequest) => {
    // If it's a dynamic request (creation), rejecting it means updating its status in the project array
    if (req.action === 'Create' && req.projectId) {
      const project = state.projects.find(p => p.id === req.projectId);
      if (project) {
        const listName = getProjectListName(req.module);
        if (listName && project[listName as keyof typeof project]) {
          const list = project[listName as keyof typeof project] as any[];
          const itemExists = list.find(i => i.id === req.recordId);
          if (itemExists) {
            const reason = await prompt('Reason for rejection:');
            const updatedList = list.map(i => i.id === req.recordId ? { ...i, status: 'Rejected', approvalStatus: 'Rejected', rejectionReason: reason || 'Rejected by Admin', rejectedBy: state.currentUser?.name, rejectedById: state.currentUser?.id } : i);
            updateProject(project.id, { [listName]: updatedList }, `Rejected ${req.itemName}`);

            // Refund petty cash balance if the entry was paid via petty cash
            if (itemExists.paidBy === 'petty_cash' && itemExists.submittedById) {
              const userToRefund = state.users.find(u => u.id === itemExists.submittedById);
              if (userToRefund) {
                updateUser(userToRefund.id, {
                  pettyCashBalance: (userToRefund.pettyCashBalance || 0) + Number(itemExists.amount || 0)
                });
              }
            }
          }
        }
      }
    }
    
    // Always attempt to update standard approval request as well
    updateApprovalRequest(req.id, { status: 'Rejected' });
    
    addAuditLog({
      projectId: req.projectId,
      module: req.module,
      recordId: req.recordId,
      action: req.action === 'Delete' ? 'Delete Rejected' : (req.action === 'Create' ? 'Create Rejected' : 'Update Rejected'),
      user: state.currentUser?.name || 'Admin',
      role: state.currentRole,
      reason: req.reason
    });
  };

  const getProjectListName = (module: string) => {
    switch(module) {
      case 'ExpenseEntry': return 'expenseItems';
      case 'SupplierPayment': return 'supplierPayments';
      case 'AdvanceEntry': return 'advanceHistory';
      case 'DocumentEntry': return 'documents';
      case 'SitePhoto': return 'sitePhotos';
      case 'LaborEntry': 
      case 'Labor': return 'labors';
      case 'Subcontractor': return 'subcontractors';
      default: return null;
    }
  };

  const renderDetails = (data: any) => {
    if (!data) return null;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-2">
        {Object.entries(data).map(([key, value]) => {
          if (['id', 'status', 'approvalStatus', 'createdBy', 'submittedBy', 'submittedById'].includes(key)) return null;
          if (key.toLowerCase().includes('photo') || key === 'data') {
            return value ? (
              <div key={key} className="col-span-1 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <div className="mt-1">
                  <img src={value as string} alt={key} className="h-24 w-24 object-cover rounded-lg border border-slate-200" />
                </div>
              </div>
            ) : null;
          }
          return (
            <div key={key} className="flex flex-col">
              <span className="text-xs font-semibold text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="text-sm font-medium text-slate-800 break-words">{String(value || '-')}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">
        {state.language === 'hi' ? 'लंबित स्वीकृतियाँ' : 'Pending Approvals'}
      </h1>
      
      {pendingRequests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
          {state.language === 'hi' ? 'कोई लंबित अनुरोध नहीं है।' : 'No pending edit or delete requests.'}
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingRequests.map(req => {
            const project = req.projectId ? state.projects.find(p => p.id === req.projectId) : null;
            return (
              <div key={req.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${req.action === 'Delete' ? 'bg-red-100 text-red-700' : (req.action === 'Create' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}`}>
                        {req.action} {state.language === 'hi' ? 'अनुरोध' : 'REQUEST'}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded">
                        {req.module}
                      </span>
                      {project && (
                        <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded">
                          📂 {project.name}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-base">{req.itemName}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {state.language === 'hi' ? 'द्वारा अनुरोधित:' : 'Requested by:'} <span className="font-medium text-slate-700">{req.requestedBy}</span> {state.language === 'hi' ? 'को' : 'on'} {new Date(req.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handleApprove(req)} className="flex items-center gap-1 bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                      <Check className="w-4 h-4" /> {state.language === 'hi' ? 'स्वीकृत करें' : 'Approve'}
                    </button>
                    <button onClick={() => handleReject(req)} className="flex items-center gap-1 bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                      <X className="w-4 h-4" /> {state.language === 'hi' ? 'अस्वीकृत करें' : 'Reject'}
                    </button>
                  </div>
                </div>
              
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div className="mb-2"><span className="font-semibold text-slate-700">{state.language === 'hi' ? 'कारण:' : 'Reason:'}</span> {req.reason}</div>
                {req.action === 'Edit' && req.oldData && req.newData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200">
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <h4 className="font-semibold text-slate-500 text-xs uppercase mb-2 border-b border-slate-100 pb-2">{state.language === 'hi' ? 'मूल विवरण' : 'Original Values'}</h4>
                      {renderDetails(req.oldData)}
                    </div>
                    <div className="bg-white border border-blue-200 rounded-lg p-3">
                      <h4 className="font-semibold text-blue-500 text-xs uppercase mb-2 border-b border-slate-100 pb-2">{state.language === 'hi' ? 'प्रस्तावित बदलाव' : 'Proposed Changes'}</h4>
                      {renderDetails(req.newData)}
                    </div>
                  </div>
                )}
                {req.action === 'Create' && req.newData && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="bg-white border border-green-200 rounded-lg p-3">
                      <h4 className="font-semibold text-green-600 text-xs uppercase mb-2 border-b border-slate-100 pb-2">New Record Details</h4>
                      {renderDetails(req.newData)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
