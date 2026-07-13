import React, { useState } from 'react';
import { 
  Home, 
  PlusCircle, 
  Settings, 
  Wifi, 
  Battery, 
  RefreshCw, 
  Maximize2, 
  Minimize2,
  Menu,
  X,
  LayoutDashboard,
  CreditCard,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  BookOpen,
  Trash2,
  LogOut,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAppContext } from '../store';

export function MobileLayout({ children }: { children: React.ReactNode }) {
  const { state, setView, isSyncing, triggerSync, logout } = useAppContext();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [isFullScreen, setIsFullScreen] = React.useState(() => {
    return localStorage.getItem('nirmaan_mobile_fullscreen') === 'true';
  });

  const toggleFullScreen = () => {
    const next = !isFullScreen;
    setIsFullScreen(next);
    localStorage.setItem('nirmaan_mobile_fullscreen', String(next));
  };

  return (
    <div className={`flex items-center justify-center min-h-screen font-sans transition-colors duration-300 ${isFullScreen ? 'bg-slate-50' : 'bg-slate-900 md:p-8 overflow-hidden'}`}>
      <div className={`flex flex-col bg-slate-50 relative shadow-2xl overflow-hidden transition-all duration-300 ${
        isFullScreen 
          ? 'w-full h-[100dvh]' 
          : 'w-full max-w-[400px] h-[100dvh] md:h-[850px] md:rounded-[2.5rem] md:border-[8px] border-slate-800'
      }`}>

        {/* iOS Status Bar Mock - Hidden when in Full Screen mode to feel like a real web app */}
        {!isFullScreen && (
          <div className="h-7 w-full bg-slate-900 text-white flex items-center justify-between px-5 text-[11px] font-medium shrink-0 pt-1">
             <span>9:41</span>
             <div className="flex items-center gap-1.5">
               <Wifi className="w-3 h-3" />
               <Battery className="w-4 h-4" />
             </div>
          </div>
        )}

        {/* App Header */}
        <div className="bg-amber-500 text-slate-900 p-4 pb-5 rounded-b-3xl shrink-0 shadow-sm relative z-10 transition-all">
          <div className="max-w-md mx-auto w-full flex justify-between items-center mb-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 rounded-xl text-slate-950 bg-slate-900/10 hover:bg-slate-900/20 active:scale-95 transition-all"
                title="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-extrabold text-xl tracking-tight leading-none text-slate-950">NIRMAAN</h1>
                <p className="text-[10px] font-bold text-amber-950/80 mt-1 uppercase tracking-widest">
                  {state.currentUser?.name || state.currentRole}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Force Manual Sync Button */}
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="p-2 rounded-full bg-slate-900/10 hover:bg-slate-900/25 active:scale-95 text-slate-950 transition-all flex items-center justify-center disabled:opacity-50"
                title={state.language === 'hi' ? 'डेटा सिंक करें' : 'Sync Data'}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-950' : ''}`} />
              </button>

              {/* Desktop Only: Toggle Mobile Frame */}
              <button
                onClick={toggleFullScreen}
                className="hidden md:flex p-2 rounded-full bg-slate-900/10 hover:bg-slate-900/25 active:scale-95 text-slate-950 transition-all items-center justify-center"
                title={isFullScreen ? 'View inside Mobile Frame' : 'View Full Screen'}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm text-sm border-2 border-amber-400 select-none shrink-0">
                {state.currentUser?.name?.charAt(0).toUpperCase() || state.currentRole.charAt(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Sliding Drawer Menu Overlay */}
        {isDrawerOpen && (
          <div 
            className="absolute inset-0 bg-slate-950/60 z-[999] backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsDrawerOpen(false)}
          />
        )}
        
        {/* Sliding Drawer Panel */}
        <div className={`absolute top-0 left-0 h-full w-[280px] bg-slate-900 text-white shadow-2xl z-[1000] flex flex-col transition-transform duration-300 ease-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          {/* Drawer Header */}
          <div className="bg-slate-950 p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="bg-amber-500 text-slate-950 font-black px-2 py-1 rounded text-xs tracking-tight">NM</div>
              <h2 className="font-extrabold text-base tracking-tight text-white uppercase">NIRMAAN Menu</h2>
            </div>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info Section */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-base border-2 border-amber-400">
              {state.currentUser?.name?.charAt(0).toUpperCase() || state.currentRole.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <h3 className="font-bold text-sm text-slate-100 truncate">{state.currentUser?.name || 'User'}</h3>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full mt-0.5">
                <ShieldCheck className="w-3 h-3" />
                {state.currentRole}
              </span>
            </div>
          </div>

          {/* Drawer Scrollable Navigation Links */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1 no-scrollbar">
{/* Admin and Office Staff Exclusive Views */}
            {(state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff') && (
              <>

                <button
                  onClick={() => { setView('dashboard'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${
                    state.currentView === 'dashboard' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    <span>{state.language === 'hi' ? 'पोर्टफोलियो डैशबोर्ड' : 'Portfolio Dashboard'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => { setView('payment_dashboard'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${
                    state.currentView === 'payment_dashboard' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>{state.language === 'hi' ? 'भुगतान खाता' : 'Payment Ledger'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => { setView('user_management'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${
                    state.currentView === 'user_management' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>{state.language === 'hi' ? 'स्टाफ और अनुमतियां' : 'Staff Management'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => { setView('document_ledger'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${
                    state.currentView === 'document_ledger' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    <span>{state.language === 'hi' ? 'दस्तावेज एवं तस्वीरें' : 'Documents & Photos'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
              </>
            )}

<button
              onClick={() => { setView('user_manual'); setIsDrawerOpen(false); }}
              className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${
                state.currentView === 'user_manual' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>{state.language === 'hi' ? 'उपयोगकर्ता नियमावली' : 'User Manual'}</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>

            {(state.currentRole === 'Super Admin' || state.currentRole === 'Admin') && (
              <button
                onClick={() => { setView('recycle_bin'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${
                  state.currentView === 'recycle_bin' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>{state.language === 'hi' ? 'रद्दी टोकरी' : 'Recycle Bin'}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            )}
          </div>

          {/* Drawer Footer with logout */}
          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <button 
              onClick={() => { logout(); setIsDrawerOpen(false); }}
              className="w-full flex items-center gap-3 justify-center py-2.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>{state.language === 'hi' ? 'लॉगआउट' : 'Logout'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Container (perfectly responsive & centered) */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-32 pt-4 relative bg-slate-50">
          <div className="max-w-md mx-auto w-full px-4">
            {children}
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 py-2 pb-safe box-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 h-[72px]">
          <div className="max-w-md mx-auto w-full px-8 flex justify-between items-center">
            <button
              onClick={() => setView(state.currentRole === 'Munshi' || state.currentRole === 'Site Incharge' ? 'mobile_home' : 'dashboard')}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${(state.currentView === 'mobile_home' || state.currentView === 'dashboard') ? 'text-amber-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">{state.language === 'hi' ? 'होम' : 'Home'}</span>
            </button>
            
            <button
              onClick={() => setView('munshi_entry')}
              className="flex flex-col items-center justify-center -mt-8 relative group"
            >
              <div className={`p-4 rounded-full shadow-lg transition-all active:scale-90 flex items-center justify-center ${state.currentView === 'munshi_entry' ? 'bg-amber-600 border-4 border-amber-100/50 scale-105' : 'bg-amber-500 text-slate-900 border-4 border-slate-50 hover:bg-amber-600'}`}>
                <PlusCircle className="w-7 h-7 text-white" />
              </div>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider mt-1 absolute -bottom-4 transition-colors ${state.currentView === 'munshi_entry' ? 'text-amber-600' : 'text-slate-400'}`}>
                {state.language === 'hi' ? 'एंट्री' : 'Entry'}
              </span>
            </button>
            
            <button
              onClick={() => setView('mobile_settings')}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${state.currentView === 'mobile_settings' ? 'text-amber-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">{state.language === 'hi' ? 'सेटिंग्स' : 'Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
