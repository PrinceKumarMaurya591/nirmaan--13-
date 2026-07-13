import React from "react";
import { useAppContext } from "../store";
import { Role } from "../types";
import {
  ShieldAlert,
  LogOut,
  User,
  KeyRound,
  CheckCircle2,
  BookOpen,
  XCircle,
  ArrowLeft,
  Trash2
} from "lucide-react";

export function MobileSettings() {
  const { state, logout, resetPin, updateUser, setView, setLanguage, updateProject } = useAppContext();

  const [isChangingPin, setIsChangingPin] = React.useState(false);
  const [oldPin, setOldPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const [isViewingRejections, setIsViewingRejections] = React.useState(false);

  const rejectedItems = state.projects.flatMap(p => {
    const expenses = (p.expenseItems || [])
       .filter(e => (e.submittedById === state.currentUser?.id || e.submittedBy === state.currentUser?.name) && e.status === 'Rejected')
       .map(e => ({
         id: e.id,
         type: 'expense',
         category: e.category,
         date: e.date,
         name: e.itemName,
         reason: e.rejectionReason || e.rejectionReason || 'No reason provided',
         projectId: p.id,
         projectName: p.name
       }));
    
    const photos = (p.sitePhotos || [])
       .filter(photo => (photo.uploadedBy === state.currentUser?.name) && photo.status === 'Rejected')
       .map(photo => ({
         id: photo.id,
         type: 'photo',
         category: 'Photo',
         date: photo.uploadedAt,
         name: photo.name,
         reason: photo.rejectionReason || photo.remarks || 'No reason provided',
         projectId: p.id,
         projectName: p.name
       }));

    const documents = (p.documents || [])
       .filter(doc => (doc.uploadedBy === state.currentUser?.name) && doc.status === 'Rejected')
       .map(doc => ({
         id: doc.id,
         type: 'document',
         category: 'Document',
         date: doc.uploadedAt,
         name: doc.name,
         reason: doc.rejectionReason || 'No reason provided',
         projectId: p.id,
         projectName: p.name
       }));

    const labors = (p.labors || [])
       .filter(l => (l.createdBy === state.currentUser?.name) && l.approvalStatus === 'Rejected')
       .map(l => ({
         id: l.id,
         type: 'labor',
         category: 'Labor',
         date: new Date().toISOString(),
         name: `Labor: ${l.name}`,
         reason: (l as any).rejectionReason || 'No reason provided',
         projectId: p.id,
         projectName: p.name
       }));

    return [...expenses, ...photos, ...documents, ...labors];
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [isDeletingCompany, setIsDeletingCompany] = React.useState(false);
  const [deletePin, setDeletePin] = React.useState("");
  const [deleteOtp, setDeleteOtp] = React.useState("");
  const [deleteStep, setDeleteStep] = React.useState(1); // 1 = Pin, 2 = OTP
  const [deleteError, setDeleteError] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = React.useState(false);


  const handleDeleteCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.currentUser) return;
    setDeleteError("");

    if (deleteStep === 1) {
      if (deletePin.length < 4) {
        setDeleteError("Password must be at least 4 characters.");
        return;
      }
      setDeleteStep(2);
      return;
    }

    if (deleteStep === 2) {
      if (deleteOtp !== "123456") {
        setDeleteError("Invalid OTP. Enter 123456.");
        return;
      }
      setIsDeleting(true);
      try {
        const res = await window.fetch(`/api/companies/${state.currentTenantId}`, {
          method: "DELETE",
          headers: {
             "Content-Type": "application/json",
             "Authorization": `Bearer ${localStorage.getItem("thikedar_auth") ? JSON.parse(localStorage.getItem("thikedar_auth") as string).token : ""}`
          },
          body: JSON.stringify({ pin: deletePin, otp: deleteOtp })
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || "Failed to delete company.");
        }
        
        logout();
      } catch (err: any) {
        setDeleteError(err.message || "An unexpected error occurred.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.currentUser) return;

    if (newPin.length < 4) {
      setError("New password must be at least 4 characters");
      return;
    }

    try {
      // Verify old pin securely against the backend
      const res = await window.fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: state.currentUser.phone, pin: oldPin })
      });
      const data = await res.json();

      if (!res.ok) {
        setError("Incorrect old password");
        return;
      }

      await updateUser(state.currentUser.id, { pin: newPin });

      setSuccess(true);
      setTimeout(() => {
        setIsChangingPin(false);
        setSuccess(false);
        setOldPin("");
        setNewPin("");
      }, 2000);
    } catch (err) {
      setError("Failed to verify old password");
    }
  };

  if (isDeletingCompany) {
    return (
      <div className="px-5 space-y-6 animate-in slide-in-from-right-4 duration-300 py-6">
        <h2 className="text-xl font-bold text-red-600 mb-2">
          {state.language === 'hi' ? 'कंपनी डिलीट करें (Delete Company)' : 'Delete Company'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {state.language === 'hi' ? 'चेतावनी: यह क्रिया स्थायी रूप से इस कंपनी से जुड़े सभी प्रोजेक्ट्स, यूज़र्स और रिकॉर्ड्स को हटा देगी। इसे वापस नहीं लिया जा सकता।' : 'Warning: This action will permanently delete all projects, users, and logs associated with this company. This cannot be undone.'}
        </p>

        <form
          onSubmit={handleDeleteCompanySubmit}
          className="space-y-4 bg-white p-5 rounded-2xl border border-red-200 shadow-sm"
        >
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <input
              type="checkbox"
              id="confirmDelete"
              checked={deleteConfirmed}
              onChange={(e) => setDeleteConfirmed(e.target.checked)}
              className="mt-1 w-5 h-5 text-red-600 bg-white border-red-300 rounded focus:ring-red-500 cursor-pointer"
            />
            <label htmlFor="confirmDelete" className="text-sm font-medium text-red-800 cursor-pointer">
              {state.language === 'hi' ? 'मैं समझता हूँ कि कंपनी का सारा डेटा हमेशा के लिए नष्ट हो जाएगा और इसे वापस नहीं पाया जा सकेगा।' : 'I understand that all company data will be permanently lost and cannot be recovered.'}
            </label>
          </div>

          {deleteConfirmed && (
            <>
              {deleteStep === 1 ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    {state.language === 'hi' ? 'पुष्टि करने के लिए अपना पासवर्ड (पिन) दर्ज करें' : 'Enter your Password to confirm'}
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePin}
                    onChange={(e) => {
                      setDeletePin(e.target.value);
                      setDeleteError("");
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-red-500 tracking-widest text-lg text-center"
                  />
                </div>
              ) : (
                 <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    {state.language === 'hi' ? 'ओटीपी दर्ज करें (आपके फोन पर भेजा गया)' : 'Enter OTP (Sent to your phone)'}
                  </label>
                  <p className="text-xs text-slate-400">{state.language === 'hi' ? 'परीक्षण के लिए, उपयोग करें: 123456' : 'For testing, use: 123456'}</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={deleteOtp}
                    onChange={(e) => {
                      setDeleteOtp(e.target.value);
                      setDeleteError("");
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-red-500 tracking-widest text-lg text-center"
                  />
                </div>
              )}
            </>
          )}

          {deleteError && (
            <p className="text-sm text-red-600 text-center font-medium">
              {deleteError}
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsDeletingCompany(false);
                setDeleteStep(1);
                setDeletePin("");
                setDeleteOtp("");
                setDeleteError("");
              }}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
            >
              {state.language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!deleteConfirmed || isDeleting}
              className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 disabled:opacity-50"
            >
              {deleteStep === 1 ? (state.language === 'hi' ? "आगे बढ़ें" : "Next") : isDeleting ? (state.language === 'hi' ? "डिलीट हो रहा है..." : "Deleting...") : (state.language === 'hi' ? "स्थायी रूप से डिलीट करें" : "Permanently Delete")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (isViewingRejections) {
    return (
      <div className="px-5 space-y-6 animate-in slide-in-from-right-4 duration-300 py-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsViewingRejections(false)}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {state.language === 'hi' ? 'अस्वीकृत प्रविष्टियाँ' : 'Rejected Entries'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {state.language === 'hi' 
                ? 'आपके द्वारा दर्ज की गई वे प्रविष्टियाँ जो अस्वीकृत की गई हैं।' 
                : 'Entries entered by you that were rejected.'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {rejectedItems.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
              <p className="text-slate-500 text-sm">
                {state.language === 'hi' ? 'कोई अस्वीकृत प्रविष्टि नहीं।' : 'No rejected entries.'}
              </p>
            </div>
          ) : (
            rejectedItems.map((item, idx) => (
              <div key={idx} className="bg-white border border-rose-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-bold text-slate-800 leading-snug break-words">{item.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{item.projectName}</p>
                    <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                      {item.type === 'expense' ? item.category : item.type}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {item.date && (
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    )}
                    <button 
                      onClick={() => {
                        const project = state.projects.find(p => p.id === item.projectId);
                        if (!project) return;
                        if (item.type === 'expense') {
                          updateProject(project.id, { expenseItems: (project.expenseItems || []).filter(e => e.id !== item.id) });
                        } else if (item.type === 'photo') {
                          updateProject(project.id, { sitePhotos: (project.sitePhotos || []).filter(p => p.id !== item.id) });
                        } else if (item.type === 'document') {
                          updateProject(project.id, { documents: (project.documents || []).filter(d => d.id !== item.id) });
                        } else if (item.type === 'labor') {
                          updateProject(project.id, { labors: (project.labors || []).filter(l => l.id !== item.id) });
                        }
                      }}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors"
                    >
                      {state.language === 'hi' ? 'हटाएं' : 'Clear'}
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-rose-700 bg-rose-50/80 p-2.5 rounded-lg border border-rose-100 flex gap-2">
                  <span className="font-bold shrink-0">
                    {state.language === 'hi' ? 'कारण:' : 'Reason:'}
                  </span>
                  <span className="break-words">{item.reason}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (isChangingPin) {
    return (
      <div className="px-5 space-y-6 animate-in slide-in-from-right-4 duration-300 py-6">
        <h2 className="text-xl font-bold text-slate-800 mb-6">
          {state.language === 'hi' ? 'पासवर्ड बदलें' : 'Change Password'}
        </h2>

        {success ? (
          <div className="bg-green-50 p-6 rounded-2xl flex flex-col items-center text-center border border-green-200">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
            <h3 className="text-lg font-bold text-green-800">
              {state.language === 'hi' ? 'पासवर्ड अपडेट हो गया' : 'Password Updated'}
            </h3>
            <p className="text-sm text-green-600">
              {state.language === 'hi' ? 'आपका नया पासवर्ड सफलतापूर्वक सुरक्षित कर लिया गया है।' : 'Your new password has been saved successfully.'}
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleChangePin}
            className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">
                {state.language === 'hi' ? 'वर्तमान पासवर्ड (पुराना पिन)' : 'Current Password'}
              </label>
              <input
                type="password"
                required
                value={oldPin}
                onChange={(e) => {
                  setOldPin(e.target.value);
                  setError("");
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-amber-500 tracking-widest text-lg text-center"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">
                {state.language === 'hi' ? 'नया पासवर्ड (नया पिन)' : 'New Password'}
              </label>
              <input
                type="password"
                required
                value={newPin}
                onChange={(e) => {
                  setNewPin(e.target.value);
                  setError("");
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-amber-500 tracking-widest text-lg text-center"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center font-medium">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsChangingPin(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
              >
                {state.language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-amber-500 text-slate-900 font-bold rounded-xl shadow-md hover:bg-amber-600"
              >
                {state.language === 'hi' ? 'पासवर्ड सुरक्षित करें' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="px-5 space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col items-center justify-center py-6">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-md">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">
          {state.currentUser?.name}
        </h2>
        <p className="text-sm font-semibold text-slate-500 mt-1 uppercase tracking-widest">
          {state.language === 'hi' ? (() => {
            switch(state.currentUser?.role) {
              case 'Super Admin': return 'सुपर एडमिन';
              case 'Admin': return 'एडमिन';
              case 'Office Staff': return 'ऑफिस स्टाफ';
              case 'Site Incharge': return 'साइट इंचार्ज';
              case 'Munshi': return 'मुंशी';
              default: return state.currentUser?.role;
            }
          })() : state.currentUser?.role}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {state.currentUser?.phone}
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {state.language === 'hi' ? 'खाता सुरक्षा' : 'Account Security'}
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Your account is secured with a password. Do not share your password
          with anyone. If you forget your password, contact the Office Staff or
          Admin.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setIsViewingRejections(true)}
          className="w-full flex items-center gap-3 bg-white p-4 justify-between border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-rose-500" />
            <span className="font-semibold text-slate-700">
              {state.language === 'hi' ? 'अस्वीकृत प्रविष्टियाँ' : 'Rejected Entries'}
            </span>
          </div>
          {rejectedItems.length > 0 && (
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full animate-pulse">
              {rejectedItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsChangingPin(true)}
          className="w-full flex items-center gap-3 bg-white p-4 justify-between border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-slate-500" />
            <span className="font-semibold text-slate-700">
              {state.language === 'hi' ? 'पासवर्ड बदलें (Change PIN)' : 'Change Password'}
            </span>
          </div>
        </button>

        <button
          onClick={() => setView('user_manual')}
          className="w-full flex items-center gap-3 bg-white p-4 justify-between border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-slate-700">
              {state.language === 'hi' ? 'उपयोगकर्ता नियमावली' : 'User Manual'}
            </span>
          </div>
        </button>

<div className="w-full flex items-center justify-between bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌐</span>
            <span className="font-semibold text-slate-700">
              {state.language === 'hi' ? 'भाषा (Language)' : 'Language'}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 border border-slate-200">
            <button 
              onClick={() => setLanguage('en')}
              className={`px-4 py-1 text-sm font-bold rounded-full transition-colors ${state.language !== 'hi' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('hi')}
              className={`px-4 py-1 text-sm font-bold rounded-full transition-colors ${state.language === 'hi' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              हिंदी
            </button>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 bg-slate-100 p-4 rounded-xl justify-center shadow-sm active:scale-95 transition-transform hover:bg-slate-200 text-slate-700"
        >
          <LogOut className="w-5 h-5 text-slate-600" />
          <span className="font-bold">
            {state.language === 'hi' ? 'लॉगआउट करें (Logout)' : 'Logout Safely'}
          </span>
        </button>
      </div>

      {(state.currentUser?.role === 'Admin' || state.currentUser?.role === 'Super Admin') && (
        <div className="bg-red-50 p-4 rounded-2xl border border-red-200 mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider">
              {state.language === 'hi' ? 'प्रशासनिक विकल्प (Admin Actions)' : 'Admin Actions'}
            </h4>
          </div>
          
          <button
            onClick={() => setView('recycle_bin')}
            className="w-full flex items-center gap-3 bg-white text-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 active:scale-95 transition-transform font-bold text-sm hover:bg-slate-50"
          >
            <Trash2 className="w-5 h-5 text-amber-500" />
            <div className="flex flex-col items-start">
              <span>{state.language === 'hi' ? 'रीसायकल बिन' : 'Recycle Bin'}</span>
              <span className="text-xs font-normal text-slate-500">{state.language === 'hi' ? 'डिलीट की गई एंट्रीज देखें और मैनेज करें' : 'View and manage deleted entries'}</span>
            </div>
          </button>

          {state.currentUser?.role === 'Super Admin' && (
            <button
              onClick={() => setIsDeletingCompany(true)}
              className="w-full flex items-center gap-3 bg-red-600 text-white p-3 rounded-xl shadow-sm active:scale-95 transition-transform font-bold text-sm hover:bg-red-700"
            >
              <ShieldAlert className="w-5 h-5" />
              <div className="flex flex-col items-start">
                <span>{state.language === 'hi' ? 'कंपनी डिलीट करें' : 'Delete Company'}</span>
                <span className="text-xs font-normal text-red-200">{state.language === 'hi' ? 'अपरिवर्तनीय क्रिया (Irreversible)' : 'Irreversible action'}</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
