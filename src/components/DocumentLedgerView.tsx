import React, { useState } from 'react';
import { useAppContext } from '../store';
import { 
  FileText, Camera, Receipt, ShieldAlert, ArrowLeft, Search, Filter, 
  Eye, Download, Trash2, Calendar, User as UserIcon, Building2, CheckCircle, Clock 
} from 'lucide-react';
import { Project, ExpenseEntry, DocumentEntry, SitePhoto, AdvanceEntry } from '../types';

interface LedgerItem {
  id: string;
  projectId: string;
  projectName: string;
  type: 'site_photo' | 'official_doc' | 'receipt' | 'advance_proof';
  name: string;
  fileType: string;
  data: string; // Base64 or URL
  uploadedAt: string;
  uploadedBy: string;
  description: string;
  amount?: number;
  category?: string;
  refItem?: any;
}

export function DocumentLedgerView() {
  const { state, setView, updateProject, deleteUser, addToast, confirm, prompt, addToRecycleBin } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [previewItem, setPreviewItem] = useState<LedgerItem | null>(null);

  const currentUser = state.currentUser;
  const currentRole = state.currentRole;
  const isAdminOrOfficeStaff = currentRole === 'Super Admin' || currentRole === 'Admin' || currentRole === 'Office Staff';
  const isOfficeStaff = currentRole === 'Office Staff';

  // Consolidate all files and photos across projects
  const ledgerItems: LedgerItem[] = [];

  const visibleProjects = state.projects.filter(p => {
    // If it's site staff, they can only see files from their assigned projects
    if (currentRole === 'Munshi' || currentRole === 'Site Incharge') {
      return currentUser?.assignedProjects?.includes(p.id) || false;
    }
    return true;
  });

  visibleProjects.forEach((proj: Project) => {
    // 1. Site Photos
    if (proj.sitePhotos) {
      proj.sitePhotos.forEach((sp: SitePhoto) => {
        if (sp.status === 'Rejected') return;
        ledgerItems.push({
          id: sp.id,
          projectId: proj.id,
          projectName: proj.name,
          type: 'site_photo',
          name: sp.name || 'Site Photo',
          fileType: sp.type || 'image/jpeg',
          data: sp.data,
          uploadedAt: sp.uploadedAt,
          uploadedBy: sp.uploadedBy || 'Field Staff',
          description: sp.description || '',
          refItem: sp
        });
      });
    }

    // 2. Official Documents (Digital Vault Docs)
    if (proj.documents) {
      proj.documents.forEach((doc: DocumentEntry) => {
        if ((doc as any).status === 'Rejected') return;
        ledgerItems.push({
          id: doc.id,
          projectId: proj.id,
          projectName: proj.name,
          type: 'official_doc',
          name: doc.name,
          fileType: doc.type,
          data: doc.data,
          uploadedAt: doc.uploadedAt,
          uploadedBy: doc.uploadedBy || 'Admin/Office',
          description: doc.description || '',
          refItem: doc
        });
      });
    }

    // 3. Expense Receipts (Expense entries)
    if (proj.expenseItems) {
      proj.expenseItems.forEach((exp: ExpenseEntry) => {
        if (exp.status === 'Rejected') return;
        if (exp.photo) {
          ledgerItems.push({
            id: exp.id,
            projectId: proj.id,
            projectName: proj.name,
            type: 'receipt',
            name: `${exp.itemName || exp.category} Receipt`,
            fileType: 'image/jpeg',
            data: exp.photo,
            uploadedAt: exp.date,
            uploadedBy: exp.submittedBy || 'Field Staff',
            description: `Expense receipt for ${exp.itemName}. Amount: ₹${exp.amount}. Status: ${exp.status}`,
            amount: exp.amount,
            category: exp.category,
            refItem: exp
          });
        }
        if (exp.livePhoto) {
          ledgerItems.push({
            id: `${exp.id}-live`,
            projectId: proj.id,
            projectName: proj.name,
            type: 'site_photo',
            name: `GPS Stamped: ${exp.itemName || exp.category}`,
            fileType: 'image/jpeg',
            data: exp.livePhoto,
            uploadedAt: exp.date,
            uploadedBy: exp.submittedBy || 'Field Staff',
            description: `Live work photo at site. GPS Coordinates: ${exp.entryLatitude || ''}, ${exp.entryLongitude || ''}`,
            refItem: exp
          });
        }
      });
    }

    // 4. Advance Entry Proofs
    if (proj.advanceHistory) {
      proj.advanceHistory.forEach((adv: AdvanceEntry) => {
        if ((adv as any).status === 'Rejected') return;
        if (adv.proofPhoto) {
          ledgerItems.push({
            id: adv.id,
            projectId: proj.id,
            projectName: proj.name,
            type: 'advance_proof',
            name: `Advance Payment Proof (User: ${adv.userName})`,
            fileType: 'image/jpeg',
            data: adv.proofPhoto,
            uploadedAt: adv.date,
            uploadedBy: 'Admin/Office',
            description: `Proof of advance of ₹${adv.amount} given to ${adv.userName}. Note: ${adv.note || 'None'}`,
            amount: adv.amount,
            refItem: adv
          });
        }
      });
    }
  });

  // Sort items by date descending
  const sortedItems = ledgerItems.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  // Apply filters
  const filteredItems = sortedItems.filter(item => {
    const matchesProject = selectedProjectId === 'all' || item.projectId === selectedProjectId;
    const matchesType = selectedType === 'all' || item.type === selectedType;
    
    const searchString = `${item.name} ${item.projectName} ${item.uploadedBy} ${item.description} ${item.amount || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());

    return matchesProject && matchesType && matchesSearch;
  });

  const handleDeleteItem = async (item: LedgerItem) => {
    if (!isAdminOrOfficeStaff) {
      addToast(state.language === 'hi' ? 'आपके पास इसे हटाने की अनुमति नहीं है।' : 'You do not have permission to delete this file.', 'error');
      return;
    }

    const confirmMsg = state.language === 'hi' 
      ? `क्या आप वाकई "${item.name}" को हटाना चाहते हैं?` 
      : `Are you sure you want to delete "${item.name}"?`;
    
    if (!await confirm(confirmMsg)) return;

    const reason = await prompt(state.language === 'hi' ? "हटाने का कारण प्रदान करें:" : "Provide reason for deletion:");
    if (!reason) return;

    const isOfficeStaffDeletion = isOfficeStaff;

    if (isOfficeStaffDeletion) {
      // 1. Office Staff Deletion triggers pending approval instead of actual immediate deletion
      // We flag the original item as pending deletion
      const proj = state.projects.find(p => p.id === item.projectId);
      if (!proj) return;

      if (item.type === 'site_photo') {
        const updatedPhotos = (proj.sitePhotos || []).map(p => 
          p.id === item.id ? { ...p, status: 'Pending Approval' as const } : p
        );
        updateProject(proj.id, { sitePhotos: updatedPhotos });
      } else if (item.type === 'official_doc') {
        const updatedDocs = (proj.documents || []).map(d => 
          d.id === item.id ? { ...d, status: 'Pending Approval' as const } : d
        );
        updateProject(proj.id, { documents: updatedDocs });
      } else if (item.type === 'receipt') {
        const updatedExp = (proj.expenseItems || []).map(e => 
          e.id === item.id ? { ...e, status: 'Pending Approval' as const } : e
        );
        updateProject(proj.id, { expenseItems: updatedExp });
      }

      // Add to Recycle Bin with custom status
      addToRecycleBin({
        projectId: proj.id,
        itemType: `Pending_Deletion_${item.type}`,
        itemName: `${item.name} (Pending Approval Deletion)`,
        itemData: { ...item.refItem, originalType: item.type },
        deletedBy: currentUser?.name || 'Office Staff',
        deleteReason: `${reason} [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]`
      });

      addToast(state.language === 'hi' ? 'हटाने का अनुरोध एडमिन अनुमोदन के लिए भेज दिया गया है।' : 'Deletion request sent for Admin approval.', 'info');
      setPreviewItem(null);
      return;
    }

    // 2. Admin Deletion completes immediately
    const proj = state.projects.find(p => p.id === item.projectId);
    if (!proj) return;

    if (item.type === 'site_photo') {
      const updatedPhotos = (proj.sitePhotos || []).filter(p => p.id !== item.id);
      updateProject(proj.id, { sitePhotos: updatedPhotos });
      addToRecycleBin({
        projectId: proj.id,
        itemType: 'SitePhoto',
        itemName: item.name,
        itemData: item.refItem,
        deletedBy: currentUser?.name || 'Admin',
        deleteReason: reason
      });
    } else if (item.type === 'official_doc') {
      const updatedDocs = (proj.documents || []).filter(d => d.id !== item.id);
      updateProject(proj.id, { documents: updatedDocs });
      addToRecycleBin({
        projectId: proj.id,
        itemType: 'DocumentEntry',
        itemName: item.name,
        itemData: item.refItem,
        deletedBy: currentUser?.name || 'Admin',
        deleteReason: reason
      });
    } else if (item.type === 'receipt') {
      // Clear photo field from expense item
      const updatedExpenses = (proj.expenseItems || []).map(e => {
        if (e.id === item.id) {
          return { ...e, photo: '', hasInvoice: false };
        }
        return e;
      });
      updateProject(proj.id, { expenseItems: updatedExpenses });
      addToRecycleBin({
        projectId: proj.id,
        itemType: 'ExpensePhoto',
        itemName: item.name,
        itemData: { expenseId: item.id, photo: item.data },
        deletedBy: currentUser?.name || 'Admin',
        deleteReason: reason
      });
    } else if (item.type === 'advance_proof') {
      const updatedAdvances = (proj.advanceHistory || []).map(a => {
        if (a.id === item.id) {
          return { ...a, proofPhoto: '' };
        }
        return a;
      });
      updateProject(proj.id, { advanceHistory: updatedAdvances });
      addToRecycleBin({
        projectId: proj.id,
        itemType: 'AdvanceProofPhoto',
        itemName: item.name,
        itemData: { advanceId: item.id, photo: item.data },
        deletedBy: currentUser?.name || 'Admin',
        deleteReason: reason
      });
    }

    addToast(state.language === 'hi' ? 'फ़ाइल को सफलतापूर्वक हटा दिया गया और रीसायकल बिन में भेज दिया गया।' : 'File deleted and moved to Recycle Bin successfully.', 'success');
    setPreviewItem(null);
  };

  const downloadFile = (item: LedgerItem) => {
    try {
      const link = document.createElement('a');
      link.href = item.data;
      link.download = item.name.replace(/\s+/g, '_') + (item.fileType.includes('pdf') ? '.pdf' : '.jpg');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(state.language === 'hi' ? 'डाउनलोड शुरू हो रहा है...' : 'Download starting...', 'success');
    } catch (e) {
      addToast('Download failed. You can right click the preview to save.', 'error');
    }
  };

  const getLabelAndColor = (type: string) => {
    switch(type) {
      case 'site_photo':
        return { label: state.language === 'hi' ? 'साइट फोटो' : 'Site Photo', color: 'bg-indigo-100 text-indigo-800' };
      case 'official_doc':
        return { label: state.language === 'hi' ? 'सरकारी दस्तावेज़' : 'Official Doc', color: 'bg-emerald-100 text-emerald-800' };
      case 'receipt':
        return { label: state.language === 'hi' ? 'बिल / रसीद' : 'Bill / Receipt', color: 'bg-amber-100 text-amber-800' };
      case 'advance_proof':
        return { label: state.language === 'hi' ? 'पेमेंट प्रूफ' : 'Payment Proof', color: 'bg-purple-100 text-purple-800' };
      default:
        return { label: 'File', color: 'bg-slate-100 text-slate-800' };
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24 md:pb-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setView(currentUser?.role === 'Munshi' || currentUser?.role === 'Site Incharge' ? 'mobile_home' : 'dashboard')} 
            className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Camera className="w-6 h-6 text-amber-500" />
              {state.language === 'hi' ? 'दस्तावेज़ और फोटो लेज़र' : 'Documents & Photos Ledger'}
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              {state.language === 'hi' 
                ? 'साइट की तस्वीरें, बिल की रसीदें और आधिकारिक दस्तावेज़ एक ही स्थान पर देखें।' 
                : 'All site photos, official documents, and transaction receipts in one unified ledger.'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder={state.language === 'hi' ? 'खोजें (नाम, प्रोजेक्ट, अपलोडर)...' : 'Search by name, project, uploaded by...'} 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-amber-500 text-slate-800"
          />
        </div>

        {/* Project Filter */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <select 
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-amber-500 text-slate-800"
          >
            <option value="all">{state.language === 'hi' ? 'सभी प्रोजेक्ट्स' : 'All Projects'}</option>
            {state.projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select 
            value={selectedType} 
            onChange={e => setSelectedType(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-amber-500 text-slate-800"
          >
            <option value="all">{state.language === 'hi' ? 'सभी फ़ाइल श्रेणियां' : 'All File Types'}</option>
            <option value="site_photo">{state.language === 'hi' ? 'साइट तस्वीरें' : 'Site Photos'}</option>
            <option value="official_doc">{state.language === 'hi' ? 'सरकारी दस्तावेज़' : 'Official Documents'}</option>
            <option value="receipt">{state.language === 'hi' ? 'खर्च के बिल / रसीदें' : 'Expense Bills & Receipts'}</option>
            <option value="advance_proof">{state.language === 'hi' ? 'भुगतान प्रमाण पत्र' : 'Advance Payment Proofs'}</option>
          </select>
        </div>

      </div>

      {/* Grid of Documents */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs max-w-md mx-auto">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-bold">{state.language === 'hi' ? 'कोई फ़ाइल नहीं मिली' : 'No Files Found'}</p>
          <p className="text-xs text-slate-400 mt-1">
            {state.language === 'hi' 
              ? 'चयनित फ़िल्टर के लिए कोई दस्तावेज़ या फोटो अपलोड नहीं है।' 
              : 'Try searching with a different keyword or check your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredItems.map(item => {
            const { label, color } = getLabelAndColor(item.type);
            const isPdf = item.fileType.includes('pdf') || item.data.startsWith('data:application/pdf');

            return (
              <div 
                key={item.id} 
                onClick={() => setPreviewItem(item)}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group flex flex-col h-full"
              >
                {/* Thumbnail */}
                <div className="aspect-video w-full bg-slate-100 flex items-center justify-center relative border-b border-slate-100 overflow-hidden shrink-0">
                  {isPdf ? (
                    <div className="flex flex-col items-center gap-1">
                      <FileText className="w-10 h-10 text-rose-500" />
                      <span className="text-[10px] font-bold text-slate-500">PDF Document</span>
                    </div>
                  ) : (
                    <img 
                      src={item.data} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs ${color}`}>
                    {label}
                  </span>
                </div>

                {/* Info */}
                <div className="p-3 md:p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs md:text-sm line-clamp-1 group-hover:text-amber-600 transition-colors" title={item.name}>
                      {item.name}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1 truncate" title={item.projectName}>
                      📍 {item.projectName}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] md:text-[10px] text-slate-500 font-medium">
                    <span className="truncate max-w-[80px]" title={item.uploadedBy}>👤 {item.uploadedBy}</span>
                    <span>📅 {new Date(item.uploadedAt).toLocaleDateString()}</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-slate-950/80 z-[110] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${getLabelAndColor(previewItem.type).color}`}>
                  {getLabelAndColor(previewItem.type).label}
                </span>
                <h3 className="font-bold text-sm md:text-base truncate max-w-[200px] md:max-w-md" title={previewItem.name}>
                  {previewItem.name}
                </h3>
              </div>
              <button 
                onClick={() => setPreviewItem(null)} 
                className="text-white hover:text-slate-300 bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto flex flex-col md:flex-row bg-slate-50">
              
              {/* Media Preview Box */}
              <div className="flex-1 min-h-[300px] bg-slate-900 flex items-center justify-center p-4 relative">
                {previewItem.fileType.includes('pdf') || previewItem.data.startsWith('data:application/pdf') ? (
                  <iframe 
                    src={previewItem.data} 
                    className="w-full h-full min-h-[400px] rounded border-0" 
                    title={previewItem.name} 
                  />
                ) : (
                  <img 
                    src={previewItem.data} 
                    alt={previewItem.name} 
                    className="max-h-[60vh] max-w-full object-contain rounded shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Sidebar Metadata */}
              <div className="w-full md:w-80 bg-white p-5 border-l border-slate-200 flex flex-col justify-between shrink-0">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Location</h4>
                    <p className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      📍 {previewItem.projectName}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uploaded By</h4>
                    <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      {previewItem.uploadedBy}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uploaded Date</h4>
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {new Date(previewItem.uploadedAt).toLocaleString()}
                    </p>
                  </div>

                  {previewItem.amount && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transaction Amount</h4>
                      <p className="text-base font-extrabold text-emerald-600 mt-0.5">
                        ₹{previewItem.amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                  )}

                  {previewItem.description && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description / Notes</h4>
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1 whitespace-pre-wrap leading-relaxed">
                        {previewItem.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 mt-6">
                  <button 
                    onClick={() => downloadFile(previewItem)}
                    className="flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-2 px-3 rounded-lg text-xs shadow-sm transition-all border border-amber-500/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>

                  {isAdminOrOfficeStaff && (
                    <button 
                      onClick={() => handleDeleteItem(previewItem)}
                      className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2 px-3 rounded-lg text-xs transition-all border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
