import React, { useState } from 'react';
import { useAppContext } from '../store';
import { formatINR, normalizeVendorName } from '../lib/utils';
import { CheckCircle, AlertCircle, Clock, Wallet, Search } from 'lucide-react';

export function PaymentDashboard() {
  const { state, setView, updateProject, addToast } = useAppContext();
  
  const isAdminOrOfficeStaff = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';
  const isSiteStaff = state.currentRole === 'Site Incharge' || state.currentRole === 'Munshi';

  if (isSiteStaff) {
    return <div className="p-8 text-center text-rose-600 font-bold">Access Denied</div>;
  }

  // Aggregate vendor balances across all projects
  const supplierBalances = new Map<string, {
    totalBilled: number;
    totalPaid: number;
    balance: number;
    projects: {
      projectId: string;
      projectName: string;
      billed: number;
      paid: number;
      balance: number;
    }[];
  }>();

  state.projects.forEach(project => {
    const projectVendorMap = new Map<string, { billed: number, paid: number }>();
    
    // Calculate bills
    (project.expenseItems || []).forEach(item => {
      if (isSiteStaff && item.category === 'material') return; // Hide material from site staff
      
      if (item.status === 'Approved' && item.vendor && item.vendor.trim() !== '') {
        const vName = normalizeVendorName(item.vendor);
        if (!projectVendorMap.has(vName)) projectVendorMap.set(vName, { billed: 0, paid: 0 });
        projectVendorMap.get(vName)!.billed += item.amount;
        if (item.paidBy !== 'unpaid') {
           projectVendorMap.get(vName)!.paid += item.amount;
        }
      }
    });

    // Subcontractor bills
    if (!isSiteStaff) {
      (project.subcontractors || []).forEach(sub => {
        let totalBilled = 0;
        let totalPaid = 0;
        sub.progress.forEach(p => {
          totalBilled += p.quantity * sub.rate;
        });
        sub.payments.forEach(p => {
          totalPaid += p.amount;
        });
        const vName = normalizeVendorName(`SUBCONTRACTOR: ${sub.name}`);
        if (!projectVendorMap.has(vName)) projectVendorMap.set(vName, { billed: 0, paid: 0 });
        projectVendorMap.get(vName)!.billed += totalBilled;
        projectVendorMap.get(vName)!.paid += totalPaid;
      });
    }

    // Labor bills
    (project.expenseItems || []).forEach(item => {
      if (item.status === 'Approved' && item.category === 'labor') {
         const parts = item.itemName.split(' (');
         const name = parts[0] ? parts[0].trim() : 'UNKNOWN LABOR';
         const vName = normalizeVendorName(`LABOR: ${name}`);
         if (!projectVendorMap.has(vName)) projectVendorMap.set(vName, { billed: 0, paid: 0 });
         projectVendorMap.get(vName)!.billed += item.amount;
         if (item.paidBy !== 'unpaid') {
           projectVendorMap.get(vName)!.paid += item.amount;
         }
      }
    });

    // Labor advances
    (project.expenseItems || []).forEach(item => {
      if (item.status === 'Approved' && item.category === 'misc' && item.itemName.startsWith('Advance to ')) {
         const name = item.itemName.replace('Advance to ', '').trim();
         const vName = normalizeVendorName(`LABOR: ${name}`);
         if (!projectVendorMap.has(vName)) projectVendorMap.set(vName, { billed: 0, paid: 0 });
         // Advances reduce outstanding balance, so we treat them as paid
         projectVendorMap.get(vName)!.paid += item.amount;
      }
    });

    // Shifting bills
    (project.expenseItems || []).forEach(item => {
      if (item.status === 'Approved' && item.category === 'shifting') {
         const parts = item.itemName.split(' - ');
         const vName = normalizeVendorName(`SHIFTING: ${parts[0] ? parts[0].trim() : 'UNKNOWN VEHICLE'}`);
         if (!projectVendorMap.has(vName)) projectVendorMap.set(vName, { billed: 0, paid: 0 });
         projectVendorMap.get(vName)!.billed += item.amount;
         if (item.paidBy !== 'unpaid') {
           projectVendorMap.get(vName)!.paid += item.amount;
         }
      }
    });

    // Machinery bills
    (project.expenseItems || []).forEach(item => {
      if (item.status === 'Approved' && item.category === 'machinery') {
         const match = item.itemName.match(/Machinery:\s*(.*?)(?:\s*(?:\+|\[)Fuel.*)?$/i);
         const rawName = match ? match[1].replace(/\]$/, '').trim() : 'UNKNOWN MACHINE';
         const name = rawName.split(' - ')[0].trim();
         const vName = normalizeVendorName(`MACHINE: ${name}`);
         if (!projectVendorMap.has(vName)) projectVendorMap.set(vName, { billed: 0, paid: 0 });
         projectVendorMap.get(vName)!.billed += item.amount;
         if (item.paidBy !== 'unpaid') {
           projectVendorMap.get(vName)!.paid += item.amount;
         }
      }
    });

    // Calculate separate payments
    (project.supplierPayments || []).forEach(pay => {
      if (pay.status === 'Rejected' || pay.status === 'Pending Approval' || pay.status === 'Deleted') {
        return;
      }
      const vName = normalizeVendorName(pay.vendorName);
      // Only include it if we care about it (if site staff, ignore general material vendors)
      // Since it's hard to tell if a payment was for material or not from the vendorName alone,
      // we just filter out non-prefixed vendors for SiteStaff if they don't look like site-vendors.
      // But actually, just include them if they exist in the map already, or if they have a prefix.
      if (isSiteStaff && !vName.includes(':') && !projectVendorMap.has(vName)) return;

      if (!projectVendorMap.has(vName)) projectVendorMap.set(vName, { billed: 0, paid: 0 });
      projectVendorMap.get(vName)!.paid += pay.amount;
    });

    // Add to global map
    Array.from(projectVendorMap.entries()).forEach(([vName, { billed, paid }]) => {
      const roundedBilled = Math.round(billed);
      const roundedPaid = Math.round(paid);
      const balance = roundedBilled - roundedPaid;

      if (roundedBilled === 0 && roundedPaid === 0) return; // Skip if no activity

      if (!supplierBalances.has(vName)) {
        supplierBalances.set(vName, { totalBilled: 0, totalPaid: 0, balance: 0, projects: [] });
      }
      
      const glb = supplierBalances.get(vName)!;
      glb.totalBilled = Math.round(glb.totalBilled + roundedBilled);
      glb.totalPaid = Math.round(glb.totalPaid + roundedPaid);
      glb.balance = glb.totalBilled - glb.totalPaid;

      glb.projects.push({
        projectId: project.id,
        projectName: project.name,
        billed: roundedBilled,
        paid: roundedPaid,
        balance
      });
    });
  });

  const sortedBalances = Array.from(supplierBalances.entries()).sort((a, b) => b[1].balance - a[1].balance);

  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [payDate, setPayDate] = useState<Record<string, string>>({});
  const [payMode, setPayMode] = useState<Record<string, 'office'|'petty_cash'>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBalances = sortedBalances.filter(([vName]) => {
    if (!searchTerm) return true;
    return vName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handlePay = (projectId: string, vName: string) => {
    const key = `${projectId}_${vName}`;
    const amount = Number(payAmount[key]);
    if (!amount || amount <= 0) return addToast('Invalid amount', 'error');

    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    const mode = payMode[key] || (isAdminOrOfficeStaff ? 'office' : 'petty_cash');
    const newPayment = {
      id: `spay-${Date.now()}`,
      vendorName: vName,
      amount: amount,
      date: payDate[key] || new Date().toISOString().split('T')[0],
      note: 'Payment made from dashboard',
      paidBy: isAdminOrOfficeStaff ? mode : 'petty_cash',
      submittedBy: state.currentUser?.name
    };

    updateProject(projectId, {
      supplierPayments: [...(project.supplierPayments || []), newPayment]
    });
    
    setPayAmount(prev => ({...prev, [key]: ''}));
    setPayDate(prev => ({...prev, [key]: new Date().toISOString().split('T')[0]}));
    addToast(`Payment of ₹${amount} made to ${vName}`, 'success');
  };

  const totalOutstanding = filteredBalances.reduce((sum, [, data]) => sum + Math.max(0, data.balance), 0);

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Payment Dashboard</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Global view of all outstanding balances across projects</p>
        </div>
        
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl shadow-sm text-right w-full md:w-auto">
          <p className="text-[10px] sm:text-xs font-bold text-rose-500 uppercase tracking-wider">Filtered Outstanding Pending</p>
          <p className="text-2xl sm:text-3xl font-bold text-rose-700 mt-1">{formatINR(totalOutstanding)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-slate-500" />
            Vendor / Subcontractor Balances
          </h3>

          <div className="relative w-full sm:w-64">
             <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
             <input 
               type="text" 
               placeholder="Search vendor, labor, machinery..." 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-amber-500 outline-none transition-shadow"
             />
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {filteredBalances.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-slate-500">No payment data available.</div>
          ) : (
            filteredBalances.map(([vName, data]) => (
              <div key={vName} className="flex flex-col">
                <div 
                  className={`p-4 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${expandedVendor === vName ? 'bg-slate-50' : ''}`}
                  onClick={() => setExpandedVendor(expandedVendor === vName ? null : vName)}
                >
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-base sm:text-lg flex flex-wrap items-center gap-2">
                      {vName}
                      {data.balance > 0 ? (
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold uppercase">Pending</span>
                      ) : data.balance < 0 ? (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase">Advance</span>
                      ) : (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Settled</span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">Across {data.projects.length} project(s)</p>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 text-sm text-right mt-2 sm:mt-0">
                    <div className="hidden md:block">
                      <p className="text-slate-500 mb-1">Total Billed</p>
                      <p className="font-semibold text-slate-800">{formatINR(data.totalBilled)}</p>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-slate-500 mb-1">Total Paid</p>
                      <p className="font-semibold text-emerald-600">{formatINR(data.totalPaid)}</p>
                    </div>
                    <div className="bg-white px-3 sm:px-4 py-2 rounded-lg border border-slate-200 shadow-sm min-w-[100px] sm:min-w-[120px]">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Balance</p>
                      <p className={`font-bold text-base sm:text-lg ${data.balance > 0 ? 'text-rose-600' : data.balance < 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {formatINR(data.balance)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {expandedVendor === vName && (
                  <div className="bg-slate-100 p-3 sm:p-6 border-t border-slate-200 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {data.projects.map(proj => {
                       const key = `${proj.projectId}_${vName}`;
                       return (
                         <div key={proj.projectId} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-3">
                           <div className="flex justify-between items-start">
                             <h5 className="font-bold text-slate-700">{proj.projectName}</h5>
                             <span className={`text-xs font-bold px-2 py-1 rounded ${proj.balance > 0 ? 'bg-rose-50 text-rose-600' : proj.balance < 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                               Bal: {formatINR(proj.balance)}
                             </span>
                           </div>
                           <div className="flex justify-between text-xs sm:text-sm text-slate-600 bg-slate-50 p-2 rounded">
                             <span>Billed: <span className="font-semibold">{formatINR(proj.billed)}</span></span>
                             <span>Paid: <span className="font-semibold text-emerald-600">{formatINR(proj.paid)}</span></span>
                           </div>
                           
                           {proj.balance > 0 && (
                             <div className="mt-2 pt-3 border-t border-slate-100">
                               <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase">Make Payment</p>
                               <div className="flex flex-col sm:flex-row gap-2">
                                 <input 
                                   type="date" 
                                   value={payDate[key] || new Date().toISOString().split('T')[0]} 
                                   onChange={e => setPayDate(prev => ({...prev, [key]: e.target.value}))} 
                                   className="border border-slate-200 p-2 rounded text-sm w-full sm:w-32 outline-none focus:border-amber-500 transition-colors bg-white" 
                                 />
                                 <input 
                                   type="number" 
                                   placeholder="₹ Amount" 
                                   value={payAmount[key] || ''} 
                                   onChange={e => setPayAmount(prev => ({...prev, [key]: e.target.value}))} 
                                   className="border border-slate-200 p-2 rounded text-sm w-full outline-none focus:border-amber-500 transition-colors" 
                                 />
                                 {isAdminOrOfficeStaff ? (
                                   <select 
                                     value={payMode[key] || 'office'} 
                                     onChange={e => setPayMode(prev => ({...prev, [key]: e.target.value as any}))} 
                                     className="border border-slate-200 p-2 rounded text-sm bg-white outline-none focus:border-amber-500 transition-colors"
                                   >
                                     <option value="office">Office</option>
                                     <option value="petty_cash">Petty Cash</option>
                                   </select>
                                 ) : (
                                   <select disabled value="petty_cash" className="border border-slate-200 p-2 rounded text-sm bg-slate-50 text-slate-500 outline-none">
                                     <option value="petty_cash">Petty Cash</option>
                                   </select>
                                 )}
                                 <button 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handlePay(proj.projectId, vName);
                                   }} 
                                   className="bg-amber-500 text-white font-bold px-4 py-2 rounded text-sm hover:bg-amber-600 whitespace-nowrap shadow-sm transition-colors"
                                 >
                                   Pay
                                 </button>
                               </div>
                             </div>
                           )}
                         </div>
                       );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

