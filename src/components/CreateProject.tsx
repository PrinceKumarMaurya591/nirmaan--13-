import React, { useState } from 'react';
import { useAppContext } from '../store';
import { ArrowLeft, PlusCircle, Building } from 'lucide-react';
import { resizeImage } from '../lib/utils';

export function CreateProject() {
  const { state, setView, addProject, addToast } = useAppContext();
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    scheme: '',
    location: '',
    incharge: '',
    woValue: ''
  });
  const [initialDocs, setInitialDocs] = useState<{name: string, data: string, type: string}[]>([]);

  const eligibleUsers = state.users.filter(u => u.role === 'Site Incharge' || u.role === 'Munshi');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.department || !formData.scheme || !formData.location || !formData.woValue) return;

    addProject({
      name: formData.name,
      department: formData.department,
      scheme: formData.scheme,
      location: formData.location,
      incharge: formData.incharge,
      woValue: Number(formData.woValue),
      documents: initialDocs.map(doc => ({
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: doc.name,
        type: doc.type,
        data: doc.data,
        uploadedAt: new Date().toISOString()
      }))
    });
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <button 
        onClick={() => setView('dashboard')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 p-6 text-white border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Create New Project</h2>
            <p className="text-slate-400 mt-1 text-sm">Add a new site or tender to the monitoring system.</p>
          </div>
          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
            <Building className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Project / Work Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. LUCKNOW ROAD WORK" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Department</label>
              <input 
                type="text" 
                required
                value={formData.department}
                onChange={e => setFormData({...formData, department: e.target.value})}
                placeholder="e.g. PWD, Jal Nigam" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Scheme (Yojana)</label>
              <input 
                type="text" 
                required
                value={formData.scheme}
                onChange={e => setFormData({...formData, scheme: e.target.value})}
                placeholder="e.g. Road Expansion, Smart City" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 font-hindi">लोकेशन / ड्रॉप पॉइंट (Location / Drop Point)</label>
              <input 
                type="text" 
                required
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                placeholder="e.g. Lucknow South Sector" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Work Order Value (BOQ) ₹</label>
              <input 
                type="number" 
                required
                value={formData.woValue}
                onChange={e => setFormData({...formData, woValue: e.target.value})}
                placeholder="8000000" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex justify-between items-center">
                Assign Site Incharge / Mate
                {eligibleUsers.length === 0 && (
                   <button type="button" onClick={() => setView('user_management')} className="text-amber-600 text-xs font-bold hover:underline">
                      + Create User First
                   </button>
                )}
              </label>
              {eligibleUsers.length > 0 ? (
                <select 
                  value={formData.incharge}
                  onChange={e => setFormData({...formData, incharge: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500 appearance-none" 
                >
                  <option value="">-- Select Site Incharge (Optional) --</option>
                  {eligibleUsers.map(u => (
                    <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-orange-50 border border-orange-200 rounded-lg p-3 text-orange-800 text-sm flex items-center justify-between">
                  <span>No Incharge/Munshi found.</span>
                  <button type="button" onClick={() => setView('user_management')} className="font-bold bg-white px-2 py-1 rounded shadow-sm border border-orange-200 text-xs text-orange-600 hover:bg-orange-100">Create</button>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
               <label className="text-sm font-bold text-slate-700">Initial Project Documents (Optional)</label>
               <label className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded cursor-pointer transition-colors shadow-sm">
                  + Add Document
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                           return addToast('File size must be less than 5MB', 'error');
                        }
                        const base64 = await resizeImage(file);
                        setInitialDocs([...initialDocs, { name: file.name, type: file.type, data: base64 }]);
                      }
                    }} 
                  />
               </label>
            </div>
            {initialDocs.length > 0 ? (
               <div className="flex flex-wrap gap-2">
                  {initialDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-sm text-slate-700">
                      <span className="truncate max-w-[150px]">{doc.name}</span>
                      <button type="button" onClick={() => setInitialDocs(initialDocs.filter((_, i) => i !== idx))} className="text-red-500 font-bold ml-1 hover:opacity-75">×</button>
                    </div>
                  ))}
               </div>
            ) : (
               <p className="text-xs text-slate-500 italic">No documents added yet (e.g., Tender.pdf, BOQ.xlsx).</p>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-end">
            <button 
              type="submit"
              className="flex justify-center items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 transition-colors shadow-sm w-full sm:w-auto"
            >
              <PlusCircle className="w-5 h-5" /> Initialize Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
