import React from 'react';
import { useAppContext } from '../store';
import { getUserProjectBalance } from '../lib/utils';
import { formatINR } from '../lib/utils';
import { ShieldAlert, CloudOff, FileCheck2, Box, Truck, Users, Settings2, Receipt, Wallet, ChevronRight, Camera, Hammer } from 'lucide-react';

export function MobileHome() {
   const { state, setView, setEntryTab, addToast, updateProject } = useAppContext();
   const availableProjects = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff'
    ? state.projects
    : state.projects.filter(p => state.currentUser?.assignedProjects.includes(p.id));

   // Auto-select first project if nothing selected
   React.useEffect(() => {
     if (!state.selectedProjectId && availableProjects.length > 0) {
       setView(state.currentView, availableProjects[0].id);
     }
   }, [state.selectedProjectId, state.currentView, availableProjects, setView]);

   const project = state.projects.find(p => p.id === state.selectedProjectId) || availableProjects[0];
   const isSiteStaff = state.currentRole === 'Site Incharge' || state.currentRole === 'Munshi';
   const subcontractorPaid = project?.subcontractors?.reduce((sum, sub) => sum + sub.payments.reduce((s, p) => s + p.amount, 0), 0) || 0;
   const totalExpenses = project ? (project.expenses.material + project.expenses.shifting + project.expenses.labor + project.expenses.machinery + project.expenses.misc + subcontractorPaid) : 0;

   const [isOnline, setIsOnline] = React.useState(navigator.onLine);
   const [showBalanceModal, setShowBalanceModal] = React.useState(false);
   const [showExpenseModal, setShowExpenseModal] = React.useState(false);

   const munshiBalance = project ? getUserProjectBalance(state.currentUser?.id || "", project.id, state.projects) : 0;
   const munshiAdvances = state.projects.flatMap(p => 
      (p.advanceHistory || [])
      .filter(a => a.userId === state.currentUser?.id || a.userName === state.currentUser?.name)
      .map(a => ({ ...a, projectName: p.name }))
   ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

   const munshiExpenses = state.projects.flatMap(p => {
      const expenses = (p.expenseItems || [])
         .filter(e => (e.submittedById === state.currentUser?.id || e.submittedBy === state.currentUser?.name) && e.paidBy === 'petty_cash' && e.status !== 'Rejected')
         .map(e => ({ 
            id: e.id,
            category: e.category,
            date: e.date,
            itemName: e.itemName,
            amount: e.amount,
            vendor: e.vendor || 'Misc',
            projectName: p.name,
            status: e.status || 'Approved'
         }));

      const supplierPays = (p.supplierPayments || [])
         .filter(s => s.submittedBy === state.currentUser?.name && s.paidBy === 'petty_cash')
         .map(s => ({
            id: s.id,
            category: 'supplier_payment' as any,
            date: s.date,
            itemName: `Supplier Payment: ${s.vendorName}`,
            amount: s.amount,
            vendor: s.vendorName,
            projectName: p.name,
            status: 'Approved'
         }));

      return [...expenses, ...supplierPays];
   }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

   const totalMunshiExpenses = munshiExpenses.reduce((sum, item) => sum + item.amount, 0);

    const rejectedItems = state.projects.flatMap(p => {
      const expenses = (p.expenseItems || [])
         .filter(e => (e.submittedById === state.currentUser?.id || e.submittedBy === state.currentUser?.name) && e.status === 'Rejected')
         .map(e => ({ id: e.id, type: e.category, date: e.date, name: e.itemName, reason: e.rejectionReason || e.rejectionReason || 'No reason provided', projectId: p.id, projectName: p.name }));
      
      const photos = (p.sitePhotos || [])
         .filter(photo => (photo.uploadedBy === state.currentUser?.name) && photo.status === 'Rejected')
         .map(photo => ({ id: photo.id, type: 'photo', date: photo.uploadedAt, name: photo.name, reason: photo.rejectionReason || photo.remarks || 'No reason provided', projectId: p.id, projectName: p.name }));

      const documents = (p.documents || [])
         .filter(doc => (doc.uploadedBy === state.currentUser?.name) && doc.status === 'Rejected')
         .map(doc => ({ id: doc.id, type: 'document', date: doc.uploadedAt, name: doc.name, reason: doc.rejectionReason || 'No reason provided', projectId: p.id, projectName: p.name }));

      const labors = (p.labors || [])
         .filter(l => (l.createdBy === state.currentUser?.name) && l.approvalStatus === 'Rejected')
         .map(l => ({ id: l.id, type: 'labor', date: new Date().toISOString(), name: `Labor: ${l.name}`, reason: (l as any).rejectionReason || 'No reason provided', projectId: p.id, projectName: p.name }));

      return [...expenses, ...photos, ...documents, ...labors];
   }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


   React.useEffect(() => {
     if (rejectedItems.length > 0 && addToast) {
       addToast(
         state.language === 'hi'
           ? `ध्यान दें: आपकी ${rejectedItems.length} प्रविष्टियाँ अस्वीकृत की गई हैं! लाल बॉक्स दबाकर कारण देखें।`
           : `Attention: You have ${rejectedItems.length} rejected entries! Tap the red box to see reasons.`,
         'error'
       );
     }
   }, [rejectedItems.length, state.language]);

   React.useEffect(() => {
     const handleOnline = () => setIsOnline(true);
     const handleOffline = () => setIsOnline(false);
     window.addEventListener('online', handleOnline);
     window.addEventListener('offline', handleOffline);
     return () => {
       window.removeEventListener('online', handleOnline);
       window.removeEventListener('offline', handleOffline);
     };
   }, []);

   const quickActions = [
     { icon: Users, label: 'Attendance', labelHi: 'हाजिरी', color: 'bg-blue-50 text-blue-600 border-blue-200' },
     { icon: Box, label: 'Material', labelHi: 'मटेरियल', color: 'bg-amber-50 text-amber-600 border-amber-200' },
     { icon: Truck, label: 'Shifting', labelHi: 'लॉजिस्टिक्स', color: 'bg-orange-50 text-orange-600 border-orange-200' },
     { icon: Settings2, label: 'Machinery', labelHi: 'मशीनरी', color: 'bg-purple-50 text-purple-600 border-purple-200' },
     { icon: Receipt, label: 'Misc Exp', labelHi: 'नकद खर्च', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
     { icon: Camera, label: 'Photos', labelHi: 'फ़ोटो', color: 'bg-rose-50 text-rose-600 border-rose-200' }
   ];

   return (
     <div className="px-5 space-y-6 animate-in fade-in duration-300">
      {rejectedItems.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <div>
              <h3 className="font-bold text-rose-800">{state.language === 'hi' ? 'अस्वीकृत प्रविष्टियाँ' : 'Rejected Entries'}</h3>
              <p className="text-[10px] text-rose-600 font-semibold">{state.language === 'hi' ? 'आपके द्वारा दर्ज किए गए वे आइटम जिन्हें अस्वीकृत कर दिया गया है' : 'Items you entered that were rejected'}</p>
            </div>
          </div>
          <div className="space-y-3">
            {rejectedItems.map((item, idx) => (
              <div key={idx} className="flex flex-col p-3 bg-white border border-rose-200 rounded-xl gap-2 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-bold text-slate-800 leading-snug break-words">{item.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{item.projectName} • {new Date(item.date).toLocaleDateString()}</p>
                    <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                      {item.type}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      const project = state.projects.find(p => p.id === item.projectId);
                      if (!project) return;
                      if (item.type === 'expense' || ['material', 'machinery', 'misc', 'logistics', 'labor', 'site_photo', 'document'].includes(item.type)) {
                        if (['material', 'machinery', 'misc', 'logistics'].includes(item.type) || item.type === 'expense') {
                          updateProject(project.id, { expenseItems: (project.expenseItems || []).filter(e => e.id !== item.id) });
                        } else if (item.type === 'photo') {
                          updateProject(project.id, { sitePhotos: (project.sitePhotos || []).filter(p => p.id !== item.id) });
                        } else if (item.type === 'document') {
                          updateProject(project.id, { documents: (project.documents || []).filter(d => d.id !== item.id) });
                        } else if (item.type === 'labor') {
                          updateProject(project.id, { labors: (project.labors || []).filter(l => l.id !== item.id) });
                        }
                      }
                    }}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors shrink-0 font-bold"
                  >
                    {state.language === 'hi' ? 'हटाएं' : 'Clear'}
                  </button>
                </div>
                <div className="mt-1 bg-rose-50 p-2 rounded border border-rose-100">
                  <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-0.5">{state.language === 'hi' ? 'अस्वीकृत होने का कारण:' : 'Rejection Reason:'}</p>
                  <p className="text-xs text-rose-800">{item.reason || (state.language === 'hi' ? 'कोई कारण नहीं बताया गया' : 'No reason provided')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
       <div className="bg-slate-800 text-white p-5 rounded-2xl shadow-lg border border-slate-700 relative overflow-hidden">
         <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-700 rounded-full opacity-50 blur-2xl"></div>
         <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
           {state.language === 'hi' ? 'आवंटित साइट' : 'Assigned Site'}
         </p>
         
         {availableProjects.length > 1 ? (
           <select 
             value={project?.id || ''} 
             onChange={(e) => setView(state.currentView, e.target.value)}
             className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-lg font-bold text-white outline-none mb-2"
           >
             {availableProjects.map(p => (
               <option key={p.id} value={p.id}>{p.name}</option>
             ))}
           </select>
         ) : (
           <h2 className="text-xl font-bold leading-tight relative mb-2">
             {project?.name || (state.language === 'hi' ? 'कोई साइट आवंटित नहीं है' : 'No Project Assigned')}
           </h2>
         )}
         
         <div className="flex flex-wrap gap-2 mt-2 relative">
           <span className="bg-slate-900/50 text-[11px] font-medium px-2.5 py-1 rounded border border-slate-700/50 text-slate-300">
             {state.language === 'hi' ? 'स्थान: ' : 'Loc: '} {project?.location?.substring(0, 15) || 'N/A'}...
           </span>
         </div>
       </div>

       {!isOnline && (
         <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-900 shadow-sm">
           <CloudOff className="w-6 h-6 shrink-0 mt-0.5" />
           <div>
             <p className="text-sm font-bold">
               {state.language === 'hi' ? 'ऑफ़लाइन मोड सक्रिय' : 'Offline Mode Active'}
             </p>
             <p className="text-xs opacity-80 mt-1 leading-snug">
               {state.language === 'hi' ? 'नेटवर्क वापस आने पर डेटा अपने आप सिंक हो जाएगा।' : 'Data will sync automatically when network returns.'}
             </p>
           </div>
         </div>
       )}

       <div className="flex flex-col gap-6">
         {state.currentRole !== 'Munshi' && project && (
           <div>
             <h3 className="font-bold text-slate-800 mb-3 px-1 text-sm uppercase tracking-wider">{state.language === 'hi' ? 'प्रोजेक्ट खर्च बुकिंग' : 'Project Expense Bookings'}</h3>
             <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
               {state.currentRole !== 'Site Incharge' && (
                 <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                   <div>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{state.language === 'hi' ? 'कुल प्राप्त राशि' : 'Total Received'}</p>
                     <p className="text-xl font-bold text-emerald-600 mt-1">{formatINR(project.received || 0)}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{state.language === 'hi' ? 'शेष राशि (बैलेंस)' : 'Balance'}</p>
                      {(() => {
                         const bal = (project.received || 0) - totalExpenses;
                         return <p className={`text-xl font-bold mt-1 ${bal < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatINR(bal)}</p>;
                      })()}
                   </div>
                 </div>
               )}
             <div className="flex justify-between items-end border-b border-slate-100 pb-3">
               <div>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{state.language === 'hi' ? 'कुल बुक किया गया खर्च (आज तक)' : 'Total Booked (Till Date)'}</p>
                 <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{formatINR(totalExpenses)}</p>
               </div>
               <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-lg border border-amber-200">{state.language === 'hi' ? 'लाइव' : 'LIVE'}</span>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
               <div onClick={() => { setEntryTab('material'); setView('project', project.id); }} className="bg-slate-50 p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                 <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><Box className="w-3 h-3"/> {state.language === 'hi' ? 'सामग्री (Material)' : 'Material'}</p>
                 <p className="text-sm font-bold text-amber-600 mt-1">{formatINR(project.expenses.material)}</p>
               </div>
               <div onClick={() => { setEntryTab('labor'); setView('project', project.id); }} className="bg-slate-50 p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                 <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><Users className="w-3 h-3"/> {state.language === 'hi' ? 'मजदूरी (Labor)' : 'Labor'}</p>
                 <p className="text-sm font-bold text-blue-600 mt-1">{formatINR(project.expenses.labor)}</p>
               </div>
               <div onClick={() => { setEntryTab('machinery'); setView('project', project.id); }} className="bg-slate-50 p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                 <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><Settings2 className="w-3 h-3"/> {state.language === 'hi' ? 'मशीनरी (Machinery)' : 'Machinery'}</p>
                 <p className="text-sm font-bold text-purple-600 mt-1">{formatINR(project.expenses.machinery)}</p>
               </div>
               <div onClick={() => { setEntryTab('shifting'); setView('project', project.id); }} className="bg-slate-50 p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                 <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><Truck className="w-3 h-3"/> {state.language === 'hi' ? 'शिफ्टिंग (Shifting)' : 'Shifting'}</p>
                 <p className="text-sm font-bold text-orange-600 mt-1">{formatINR(project.expenses.shifting)}</p>
               </div>
               <div onClick={() => { setEntryTab('petty_cash'); setView('project', project.id); }} className="bg-slate-50 p-3 rounded-lg border border-slate-100 col-span-2 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors">
                 <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><Receipt className="w-3 h-3"/> {state.language === 'hi' ? 'पेटी कैश (Petty Cash)' : 'Petty Cash'}</p>
                 <p className="text-base font-bold text-emerald-600">{formatINR(project.expenses.misc)}</p>
               </div>
               {(state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff' || (state.currentRole === 'Site Incharge' && state.currentUser?.canViewSubcontractors)) && (
                   <div onClick={() => { setView('subcontractor_view', project.id); }} className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 col-span-2 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition-colors">
                     <p className="text-[10px] font-bold text-indigo-700 flex items-center gap-1.5"><Hammer className="w-3 h-3"/> {state.language === 'hi' ? 'सब-कांट्रेक्टर (Paid)' : 'Subcontractor (Paid)'}</p>
                     <p className="text-base font-bold text-indigo-700">{formatINR(subcontractorPaid)}</p>
                   </div>
               )}
             </div>
           </div>
           </div>
         )}
       </div>

       <div>
         {(state.currentRole === 'Munshi' || state.currentRole === 'Site Incharge') && (
            <div className="mb-6">
              <h3 className="font-bold text-slate-800 mb-3 px-1 text-sm uppercase tracking-wider">{state.language === 'hi' ? 'मेरा सारांश' : 'My Summary'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div 
                  onClick={() => setShowBalanceModal(true)}
                  className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer shadow-sm hover:bg-emerald-100 transition-colors"
                >
                  <Wallet className="w-8 h-8 text-emerald-600 mb-2" />
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">{state.language === 'hi' ? 'प्राप्त बैलेंस (पेटी कैश)' : 'Received Balance'}</p>
                  <p className="text-xl font-bold text-emerald-900 leading-none">{formatINR(munshiBalance)}</p>
                </div>
                
                <div 
                  onClick={() => setShowExpenseModal(true)}
                  className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer shadow-sm hover:bg-rose-100 transition-colors"
                >
                  <Receipt className="w-8 h-8 text-rose-600 mb-2" />
                  <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                     {state.language === 'hi' ? 'मेरे द्वारा कुल खर्च' : 'My Bookings (Total Paid)'}
                  </p>
                  <p className="text-xl font-bold text-rose-900 leading-none">{formatINR(totalMunshiExpenses)}</p>
                </div>
              </div>
            </div>
          )}
         <h3 className="font-bold text-slate-800 mb-3 px-1 text-sm uppercase tracking-wider">{state.language === 'hi' ? 'त्वरित विकल्प' : 'Quick Actions'}</h3>
         <div className="grid grid-cols-5 gap-2">
           {quickActions.map((action, i) => (
             <button 
               key={i} 
               onClick={() => {
                 let tab: 'material'|'logistics'|'labor'|'machinery'|'misc'|'photos' = 'material';
                 if (action.label === 'Photos') tab = 'photos';
                 if (action.label === 'Attendance') tab = 'labor';
                 if (action.label === 'Shifting') tab = 'logistics';
                 if (action.label === 'Machinery') tab = 'machinery';
                 if (action.label === 'Misc Exp') tab = 'misc';
                 setEntryTab(tab as any);
                 setView('munshi_entry');
               }}
               className="flex flex-col items-center gap-2 group"
             >
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${action.color} group-active:scale-95 transition-transform`}>
                 <action.icon className="w-5 h-5" />
               </div>
               <span className="text-[9px] font-bold text-slate-600 text-center leading-tight whitespace-nowrap">{state.language === 'hi' && action.labelHi ? action.labelHi : action.label}</span>
             </button>
           ))}
         </div>

         {isSiteStaff && project && (
           <button
             onClick={() => setView('site_photos')}
             className="w-full mt-4 flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm active:scale-95 transition-transform"
           >
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100">
                 <Camera className="w-5 h-5 text-amber-600" />
               </div>
               <div className="text-left">
                 <p className="font-bold text-slate-800">{state.language === 'hi' ? 'साइट फोटो गैलरी' : 'Site Photo Gallery'}</p>
                 <p className="text-[10px] text-slate-500 font-medium">{state.language === 'hi' ? 'सभी अपलोड की गई तस्वीरें देखें' : 'View all uploaded photos'}</p>
               </div>
             </div>
             <ChevronRight className="w-5 h-5 text-slate-400" />
           </button>
         )}

         {!isSiteStaff && (
           <button
             onClick={() => setView('payment_dashboard')}
             className="w-full mt-4 flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm active:scale-95 transition-transform"
           >
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                 <Wallet className="w-5 h-5" />
               </div>
               <div className="text-left">
                 <p className="text-sm font-bold text-slate-800">{state.language === 'hi' ? 'लंबित भुगतान' : 'Pending Payments'}</p>
                 <p className="text-[10px] text-slate-500 font-medium">{state.language === 'hi' ? 'विक्रेता/कर्मचारी बिलों का भुगतान करें' : 'Clear Vendor/Staff bills'}</p>
               </div>
             </div>
             <ChevronRight className="w-5 h-5 text-slate-400" />
           </button>
         )}
       </div>

       <div>
         <h3 className="font-bold text-slate-800 mb-3 px-1 text-sm uppercase tracking-wider mt-2">{state.language === 'hi' ? 'हाल के रिकॉर्ड (Logs)' : 'Recent Logs'}</h3>
         <div className="space-y-3">
            {project?.expenseItems && project.expenseItems.length > 0 ? (
              [...project.expenseItems]
                .filter(e => e.submittedBy === state.currentUser?.name)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((log, i) => {
                let Icon = FileCheck2;
                if (log.category === 'material') Icon = Box;
                if (log.category === 'shifting') Icon = Truck;
                if (log.category === 'labor') Icon = Users;
                if (log.category === 'machinery') Icon = Settings2;
                if (log.category === 'misc') Icon = Receipt;

                return (
                  <div key={i} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm gap-2">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{log.itemName}</p>
                        <p className="text-xs text-slate-500 font-medium truncate">{log.quantity} {log.amount ? `• ${formatINR(log.amount)}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 mb-1 rounded border text-emerald-600 bg-emerald-50 border-emerald-100 whitespace-nowrap">
                        {state.language === 'hi' ? 'सिंक हो गया' : 'Synced'}
                      </span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm border border-dashed rounded-xl">{state.language === 'hi' ? 'इस प्रोजेक्ट के लिए अभी तक कोई रिकॉर्ड नहीं मिला।' : 'No logs found for this project yet.'}</div>
            )}
         </div>
       </div>

       {showBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col animate-in zoom-in-95">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800">{state.language === 'hi' ? 'प्राप्त राशि (एडवांस)' : 'Received Money (Advances)'}</h3>
              <button onClick={() => setShowBalanceModal(false)} className="text-slate-500 hover:text-slate-800 bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {munshiAdvances.length === 0 ? (
                <p className="text-center text-slate-500 text-sm">{state.language === 'hi' ? 'अभी तक कोई एडवांस प्राप्त नहीं हुआ है।' : 'No advances received yet.'}</p>
              ) : (
                munshiAdvances.map((adv, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{new Date(adv.date).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate" title={adv.note}>{adv.note || (state.language === 'hi' ? 'एडवांस' : 'Advance')}</p>
                    </div>
                    <p className="font-bold text-emerald-600">+{formatINR(adv.amount)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col animate-in zoom-in-95">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-800">{state.language === 'hi' ? 'मेरे द्वारा खर्च (सभी बुकिंग्स)' : 'My Spendings (All Bookings)'}</h3>
                <p className="text-[10px] text-slate-500 font-semibold">{state.language === 'hi' ? 'बैलेंस से किए गए सभी भुगतान' : 'All payments made using pocket balance'}</p>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-500 hover:text-slate-800 bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {munshiExpenses.length === 0 ? (
                <p className="text-center text-slate-500 text-sm">{state.language === 'hi' ? 'अभी तक कोई खर्च दर्ज नहीं किया गया है।' : 'No expenses booked yet.'}</p>
              ) : (
                munshiExpenses.map((exp, idx) => {
                  const displayCategory = exp.category === 'supplier_payment' 
                    ? (state.language === 'hi' ? 'सप्लायर भुगतान' : 'Supplier Payment')
                    : exp.category 
                      ? (exp.category.charAt(0).toUpperCase() + exp.category.slice(1)) 
                      : 'Expense';

                  return (
                    <div key={idx} className="flex justify-between items-start p-3 bg-slate-50 border border-slate-100 rounded-xl gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 leading-snug break-words" title={exp.itemName || exp.category}>{exp.itemName || exp.category}</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-none truncate">
                          {new Date(exp.date).toLocaleDateString()} • {exp.projectName}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 capitalize">
                            {displayCategory}
                          </span>
                          {exp.vendor && exp.vendor !== 'Misc' && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[120px]" title={exp.vendor}>
                              {exp.vendor}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <p className="font-bold text-rose-600 text-sm leading-none">-{formatINR(exp.amount)}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-2 uppercase tracking-wider ${
                          exp.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          exp.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {exp.status === 'Approved' ? (state.language === 'hi' ? 'स्वीकृत' : 'Approved') : exp.status === 'Rejected' ? (state.language === 'hi' ? 'अस्वीकृत' : 'Rejected') : (state.language === 'hi' ? 'लंबित' : 'Pending')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

     </div>
   );
}
