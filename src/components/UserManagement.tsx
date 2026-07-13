import React, { useState } from 'react';
import { useAppContext } from '../store';
import { getUserTotalBalance, getUserProjectBalance } from '../lib/utils';
import { Users, Shield, PlusCircle, Lock, Edit3, Trash2, Power, Key, Clock, CheckCircle2, XCircle, Wallet, ArrowRightLeft } from 'lucide-react';
import { Role } from '../types';

import { resizeImage } from '../lib/utils';

export function UserManagement() {
  const { state, addUser, toggleUserStatus, deleteUser, updateUser, addToast, confirm, prompt, addToRecycleBin, addApprovalRequest, updateProject } = useAppContext();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pin: '',
    role: 'Munshi' as Role,
    assignedProjectId: 'all',
    addressProof: ''
  });

  const [walletModal, setWalletModal] = useState<{isOpen: boolean, userId: string | null, userName: string, amount: string, action: 'add' | 'transfer', targetProjectId: string, sourceProjectId: string}>({ isOpen: false, userId: null, userName: '', amount: '', action: 'add', targetProjectId: '', sourceProjectId: '' });
  const [projectModal, setProjectModal] = useState<{isOpen: boolean, userId: string | null, userName: string, assignedProjects: string[]}>({ isOpen: false, userId: null, userName: '', assignedProjects: [] });
  const [ledgerModal, setLedgerModal] = useState<{isOpen: boolean, userId: string | null, userName: string}>({ isOpen: false, userId: null, userName: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.pin) return;

    addUser({
      name: formData.name,
      phone: formData.phone,
      pin: formData.pin,
      role: formData.role,
      assignedProjects: formData.assignedProjectId === 'all' ? [] : [formData.assignedProjectId],
      status: 'Active',
      addressProof: formData.addressProof
    });

    setFormData({ name: '', phone: '', pin: '', role: 'Munshi', assignedProjectId: 'all', addressProof: '' });
  };

  const permissionsMatrix = [
    { role: 'Admin', access: 'Web + Mobile', desc: 'Full Access. Manage users, projects, budgets, and approve modification requests.', lock: 'Unrestricted. Can approve/reject edits.' },
    { role: 'Office Staff', access: 'Web Only', desc: 'Monitor multi-sites, review data, cross-checking.', lock: 'Strict Lock. Modifications require Admin Approval.' },
    { role: 'Site Incharge', access: 'Web + Mobile', desc: 'Site progress, bill verifications, review field data.', lock: 'Strict Lock. Modifications require Admin Approval.' },
    { role: 'Munshi', access: 'Mobile Only', desc: 'Field entry (attendance, material, petty cash, advances).', lock: 'Strict Lock. Modifications require Admin Approval.' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Staff & Permissions</h1>
        <p className="text-slate-500 mt-1">Manage platform access, assigned projects, and system roles.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Users List & Creation Form */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 p-5 text-white border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><PlusCircle className="w-5 h-5 text-amber-500" /> Onboard New User</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start bg-slate-50">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Full Name / पूरा नाम</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Ramesh Singh" className="w-full bg-white border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Mobile / मोबाइल</label>
                <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="10-digit number" className="w-full bg-white border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Password / पासवर्ड</label>
                <input required type="text" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} placeholder="Password" className="w-full bg-white border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Role / भूमिका</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as Role})} className="w-full bg-white border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-amber-500">
                  <option value="Munshi">Munshi / Mate</option>
                  <option value="Site Incharge">Site Incharge</option>
                  <option value="Office Staff">Office Staff</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              {(formData.role === 'Munshi' || formData.role === 'Site Incharge') && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase">Assign Project / प्रोजेक्ट</label>
                  <select value={formData.assignedProjectId} onChange={e => setFormData({...formData, assignedProjectId: e.target.value})} className="w-full bg-white border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-amber-500">
                    <option value="all">Unassigned / Default</option>
                    {state.projects.filter(p => p.status === 'Active').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-bold text-slate-600 uppercase">Address Proof / आईडी (Optional)</label>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*,.pdf" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const base64 = await resizeImage(file);
                      setFormData({...formData, addressProof: base64});
                    }
                  }} className="text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  {formData.addressProof && <span className="text-xs text-emerald-600 font-bold shrink-0">Attached ✓</span>}
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end items-end pt-2">
                <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded shadow-sm text-sm transition-colors border border-amber-500/50">
                  + Create User / यूजर बनाएं
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{state.language === 'hi' ? 'सक्रिय उपयोगकर्ता (Active Users)' : 'Active Users'} ({state.users.length})</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto no-scrollbar">
              {state.users.map(user => {
                const isFieldRole = user.role === 'Munshi' || user.role === 'Site Incharge';
                const activeAssignedProjects = user.assignedProjects.filter(id => state.projects.some(p => p.id === id));
                const assignedCount = activeAssignedProjects.length;
                return (
                  <div key={user.id} className="p-4 px-4 sm:px-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200 shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">
                          {user.phone} 
                          {user.addressProof && <a href={user.addressProof} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline ml-2">ID Proof</a>}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:gap-6 flex-1 w-full xl:w-auto xl:justify-end">
                      
                      <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 mr-auto xl:mr-0">
                        <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1.5 uppercase tracking-wider rounded ${user.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : user.role === 'Office Staff' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                          {user.role}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {user.status}
                        </span>
                      </div>

                      {user.role === 'Site Incharge' && (
                        <div className="flex flex-col items-start border-l-0 sm:border-l border-slate-200 pl-0 sm:pl-4">
                          <label className="text-[10px] text-slate-500 font-bold uppercase cursor-pointer flex items-center gap-1.5 hover:text-slate-800 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={!!user.canViewSubcontractors}
                              onChange={(e) => updateUser(user.id, { canViewSubcontractors: e.target.checked })}
                              className="w-3 h-3 accent-indigo-600 rounded cursor-pointer"
                            />
                            {state.language === 'hi' ? 'सब-कांट्रेक्टर की अनुमति' : 'Subcontractor Allowed'}
                          </label>
                        </div>
                      )}

                      <div className="text-xs text-slate-500 min-w-[120px] max-w-[180px]">
                        {isFieldRole ? (
                          <button
                            onClick={() => setProjectModal({ isOpen: true, userId: user.id, userName: user.name, assignedProjects: [...user.assignedProjects] })}
                            className={`w-full bg-white border p-1.5 rounded text-xs outline-none hover:bg-slate-50 ${assignedCount > 0 ? 'border-amber-400 font-medium text-amber-700' : 'border-slate-200'}`}
                          >
                            {assignedCount === 0 ? 'Unassigned' : assignedCount === 1 ? state.projects.find(p => p.id === activeAssignedProjects[0])?.name || '1 Site' : `${assignedCount} Sites Assigned`}
                          </button>
                        ) : (
                          <span className="font-medium bg-slate-100 px-2 py-1.5 rounded block text-center border border-slate-200">All Sites</span>
                        )}
                      </div>

                      {isFieldRole && (
                        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-3">
                          <div 
                            className="text-left cursor-pointer hover:opacity-80"
                            onClick={() => setLedgerModal({ isOpen: true, userId: user.id, userName: user.name })}
                          >
                            <div className="flex items-center gap-2"><p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider hover:text-amber-600 transition-colors">{state.language === 'hi' ? 'नकद बैलेंस (Cash Balance)' : 'Cash Balance'}</p><button onClick={(e) => { e.stopPropagation(); setWalletModal({ isOpen: true, userId: user.id, userName: user.name, amount: '', action: 'add', targetProjectId: '', sourceProjectId: '' }); }} className="p-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200" title="Manage Wallet"><Wallet className="w-3 h-3" /></button></div>
                            <p className={`text-sm font-bold ${getUserTotalBalance(user.id, state.projects) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
     ₹ {getUserTotalBalance(user.id, state.projects).toLocaleString()} (Total)
   </p>
                          </div>
                        </div>
                      )}

                      {user.role !== 'Super Admin' && (
                        <div className="flex items-center gap-1 border-l-0 sm:border-l border-slate-200 pl-0 sm:pl-4 ml-0 sm:ml-1 mt-2 sm:mt-0">
                          <button 
                            onClick={() => toggleUserStatus(user.id)}
                            className={`p-1.5 rounded-md transition-colors ${user.status === 'Active' ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                            title={user.status === 'Active' ? 'Deactivate User' : 'Activate User'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              const newPin = await prompt(`Enter new Password for ${user.name}:`);
                              if (newPin && newPin.length >= 4) {
                                updateUser(user.id, { pin: newPin });
                                addToast('Password has been reset successfully.', 'success');
                              } else if (newPin !== null) {
                                addToast("Password must be at least 4 characters.", "error");
                              }
                            }}
                            className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          {(() => {
                            const isUserPendingDeletion = state.approvalRequests?.some(
                              (req) => req.module === 'User' && req.recordId === user.id && req.action === 'Delete' && req.status === 'Pending'
                            );
                            const isOfficeStaff = state.currentUser?.role === 'Office Staff';

                            if (isUserPendingDeletion) {
                              return (
                                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1.5 rounded-full border border-rose-100 flex items-center gap-1 animate-pulse ml-2 whitespace-nowrap">
                                  ⚠️ Deletion Approval Pending
                                </span>
                              );
                            }

                            return (
                              <button 
                                onClick={async () => {
                                  const reason = await prompt(`Please provide a reason for deleting ${user.name}:`);
                                  if (!reason) return;
                                  
                                  if (isOfficeStaff) {
                                    addApprovalRequest({
        
        module: 'User',
        recordId: user.id,
        itemName: user.name || 'User',
        action: 'Delete',
        requestedBy: state.currentUser?.name || 'Office Staff',
        requestedById: state.currentUser?.id || '',
        reason: `${reason} [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]`,
        oldData: user
      });
                                    addToast('Deletion request submitted for Admin approval.', 'info');
                                  } else {
                                    addToRecycleBin({
                                      itemType: 'User',
                                      itemName: user.name,
                                      itemData: user,
                                      deletedBy: state.currentUser?.name || 'Unknown',
                                      deleteReason: reason
                                    });
                                    deleteUser(user.id);
                                    addToast('User deleted successfully.', 'success');
                                  }
                                }}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            );
                          })()}
                        </div>
                      )}

                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Matrix Helper Card */}
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-indigo-900">Permission Matrix</h3>
            </div>
            <div className="space-y-4">
              {permissionsMatrix.map((matrix, idx) => (
                <div key={idx} className="bg-white border border-indigo-50 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                     <span className="font-bold text-slate-800 text-sm">{matrix.role}</span>
                     <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider">{matrix.access}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">{matrix.desc}</p>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-xs text-red-600 font-medium">
                     <Lock className="w-3.5 h-3.5 shrink-0" />
                     {matrix.lock}
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-indigo-200/50">
                <p className="text-[10px] font-bold text-indigo-900 mb-2 uppercase tracking-wider">Modification Approval Statuses</p>
                <div className="flex flex-col gap-2">
                  <span className="px-2 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Pending Approval</span>
                  <span className="px-2 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Approved (Visible on site)</span>
                  <span className="px-2 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded flex items-center gap-2"><XCircle className="w-3.5 h-3.5" /> Rejected (Will not apply)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Wallet Management Modal */}
      {walletModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Manage Wallet</h3>
                <p className="text-sm text-slate-500">Wallet for <span className="font-semibold text-slate-700">{walletModal.userName}</span></p>
              </div>
              <button onClick={() => setWalletModal({ ...walletModal, isOpen: false })} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-lg">
              <button 
                type="button"
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${walletModal.action === 'add' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                onClick={() => setWalletModal({...walletModal, action: 'add'})}
              >
                Add / Withdraw Cash
              </button>
              <button 
                type="button"
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${walletModal.action === 'transfer' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                onClick={() => setWalletModal({...walletModal, action: 'transfer'})}
              >
                Transfer Balance
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!walletModal.amount || isNaN(Number(walletModal.amount)) || (walletModal.action === "transfer" && Number(walletModal.amount) <= 0)) {
                 addToast("Please enter a valid amount", "error");
                 return;
              }
              const amount = Number(walletModal.amount);
              
              if (walletModal.action === 'add') {
                if (!walletModal.targetProjectId) {
                  addToast("Please select a project", "error");
                  return;
                }
                const project = state.projects.find(p => p.id === walletModal.targetProjectId);
                if (project) {
                  const newHistory = [...(project.advanceHistory || []), {
                    id: crypto.randomUUID(),
                    date: new Date().toISOString(),
                    amount: amount,
                    reason: "Added to Wallet",
                    userId: walletModal.userId!,
                    userName: walletModal.userName,
                    userRole: state.users.find(u => u.id === walletModal.userId)?.role || 'Munshi',
                    note: ''
                  }];
                  updateProject(project.id, { advanceHistory: newHistory });
                  addToast(`Added ₹${amount} to ${walletModal.userName} for ${project.name}`, 'success');
                }
              } else {
                // Transfer
                if (!walletModal.sourceProjectId || !walletModal.targetProjectId || walletModal.sourceProjectId === walletModal.targetProjectId) {
                  addToast("Please select valid source and target projects", "error");
                  return;
                }
                const sourceProj = state.projects.find(p => p.id === walletModal.sourceProjectId);
                const targetProj = state.projects.find(p => p.id === walletModal.targetProjectId);
                
                const currentBalance = getUserProjectBalance(walletModal.userId!, sourceProj!.id, state.projects);
                if (amount > currentBalance) {
                   addToast(`Insufficient balance in ${sourceProj!.name} (Available: ₹${currentBalance})`, "error");
                   return;
                }
                
                if (sourceProj && targetProj) {
                   // Deduct from source
                   const sourceHistory = [...(sourceProj.advanceHistory || []), {
                     id: crypto.randomUUID(),
                     date: new Date().toISOString(),
                     amount: -amount,
                     reason: `Transferred to ${targetProj.name}`,
                     userId: walletModal.userId!,
                     userName: walletModal.userName,
                    userRole: state.users.find(u => u.id === walletModal.userId)?.role || 'Munshi',
                    note: ''
                   }];
                   updateProject(sourceProj.id, { advanceHistory: sourceHistory });
                   
                   // Add to target
                   const targetHistory = [...(targetProj.advanceHistory || []), {
                     id: crypto.randomUUID(),
                     date: new Date().toISOString(),
                     amount: amount,
                     reason: `Transferred from ${sourceProj.name}`,
                     userId: walletModal.userId!,
                     userName: walletModal.userName,
                    userRole: state.users.find(u => u.id === walletModal.userId)?.role || 'Munshi',
                    note: ''
                   }];
                   updateProject(targetProj.id, { advanceHistory: targetHistory });
                   addToast(`Transferred ₹${amount} from ${sourceProj.name} to ${targetProj.name}`, 'success');
                }
              }
              
              setWalletModal({ isOpen: false, userId: null, userName: '', amount: '', action: 'add', targetProjectId: '', sourceProjectId: '' });
            }}>
              
              {walletModal.action === 'add' ? (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Select Project</label>
                    <select
                      required
                      value={walletModal.targetProjectId}
                      onChange={e => setWalletModal({...walletModal, targetProjectId: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded p-2 outline-none focus:border-indigo-500 mt-1 text-sm"
                    >
                      <option value="">-- Select Project --</option>
                      {state.projects.filter(p => p.status === 'Active').map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Bal: ₹{getUserProjectBalance(walletModal.userId!, p.id, state.projects)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Amount (₹)</label>
                    <input 
                      autoFocus
                      required 
                      type="number" 
                      value={walletModal.amount} 
                      onChange={e => setWalletModal({...walletModal, amount: e.target.value})} 
                      placeholder="e.g. 5000" 
                      className="w-full bg-white border border-slate-300 rounded p-2.5 outline-none focus:border-indigo-500 mt-1" 
                    />
                    <p className="text-xs text-slate-400 mt-1">To withdraw, go to project ledger and add negative advance or expense.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">From Project</label>
                    <select
                      required
                      value={walletModal.sourceProjectId}
                      onChange={e => setWalletModal({...walletModal, sourceProjectId: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded p-2 outline-none focus:border-indigo-500 mt-1 text-sm"
                    >
                      <option value="">-- Select Source Project --</option>
                      {state.projects.filter(p => p.status === 'Active' && getUserProjectBalance(walletModal.userId!, p.id, state.projects) > 0).map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Bal: ₹{getUserProjectBalance(walletModal.userId!, p.id, state.projects)})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-slate-100 p-1.5 rounded-full text-slate-500 border border-slate-200">
                      <ArrowRightLeft className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">To Project</label>
                    <select
                      required
                      value={walletModal.targetProjectId}
                      onChange={e => setWalletModal({...walletModal, targetProjectId: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded p-2 outline-none focus:border-indigo-500 mt-1 text-sm"
                    >
                      <option value="">-- Select Target Project --</option>
                      {state.projects.filter(p => p.status === 'Active' && p.id !== walletModal.sourceProjectId).map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Bal: ₹{getUserProjectBalance(walletModal.userId!, p.id, state.projects)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Amount to Transfer (₹)</label>
                    <input 
                      required 
                      type="number" 
                      min="1"
                      value={walletModal.amount} 
                      onChange={e => setWalletModal({...walletModal, amount: e.target.value})} 
                      placeholder="e.g. 5000" 
                      className="w-full bg-white border border-slate-300 rounded p-2.5 outline-none focus:border-indigo-500 mt-1" 
                    />
                  </div>
                </div>
              )}
              
              <div className="flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setWalletModal({ isOpen: false, userId: null, userName: '', amount: '', action: 'add', targetProjectId: '', sourceProjectId: '' })}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                >
                  {walletModal.action === 'add' ? 'Confirm Addition' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Petty Cash Ledger Modal */}
      {ledgerModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Petty Cash Ledger</h3>
                <p className="text-xs text-slate-500 font-medium">History for {ledgerModal.userName}</p>
              </div>
              <button onClick={() => setLedgerModal({ isOpen: false, userId: null, userName: '' })} className="text-slate-500 hover:text-slate-800 bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold">×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto w-full no-scrollbar p-0">
              {(() => {
                const expenses = state.projects.flatMap(p => 
                  (p.expenseItems || [])
                  .filter(e => 
                    (e.submittedById === ledgerModal.userId || e.submittedBy === ledgerModal.userName) && 
                    (e.paidBy === 'petty_cash' || e.category === 'misc') &&
                    e.status !== 'Rejected'
                  )
                  .map(e => ({ ...e, type: 'expense' as const, projectName: p.name }))
                );
                const advances = state.projects.flatMap(p => 
                  (p.advanceHistory || [])
                  .filter(a => 
                    (a.userId === ledgerModal.userId || a.userName === ledgerModal.userName) &&
                    (a as any).status !== 'Rejected'
                  )
                  .map(a => ({ ...a, type: 'advance' as const, projectName: p.name }))
                );
                
                const combined = [...expenses, ...advances].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const runningBal = state.users.find(u => u.id === ledgerModal.userId)?.pettyCashBalance || 0;

                if (combined.length === 0) {
                  return <div className="p-8 text-center text-slate-500 text-sm">No transaction history found for this user.</div>;
                }

                return (
                  <div className="divide-y divide-slate-100 p-2">
                    {combined.map((item, idx) => {
                       const isAdvance = item.type === 'advance';
                       return (
                         <div key={item.id || idx} className="p-3">
                           <div className="flex justify-between items-start mb-1">
                             <div>
                               <p className="font-bold text-sm text-slate-800">{isAdvance ? 'Advance Received' : (item as any).itemName}</p>
                               <p className="text-[11px] text-slate-500 font-medium truncate w-48" title={isAdvance ? (item as any).note : (item as any).vendor || (item as any).category}>
                                  {item.projectName} • {isAdvance ? (item as any).note : (item as any).vendor || (item as any).category}
                               </p>
                             </div>
                             <p className={`font-bold text-sm whitespace-nowrap ${isAdvance ? 'text-emerald-600' : 'text-slate-700'}`}>
                               {isAdvance ? '+' : '-'} ₹{item.amount.toLocaleString()}
                             </p>
                           </div>
                           <p className="text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString()}</p>
                         </div>
                       );
                    })}
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Current Balance</span>
              <span className={`text-lg font-bold ${getUserTotalBalance(ledgerModal.userId || "", state.projects) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
     ₹ {getUserTotalBalance(ledgerModal.userId || "", state.projects).toLocaleString()}
   </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
