import React, { useState, useRef, useEffect } from "react";
import { Search, Bell, Wifi, MapPin, Menu, Clock, Globe, Cloud, CloudOff, RefreshCw, HelpCircle, Check } from "lucide-react";
import { useAppContext } from "../store";
import { resizeImage } from "../lib/utils";

export function TopNav({ onMenuClick }: { onMenuClick?: () => void }) {
  const { state, markNotificationsRead, updateUser, setSearchQuery, setLanguage, setView, isSyncing, triggerSync } = useAppContext();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const unreadCount = state.notifications?.filter(n => !n.read).length || 0;
  
  const notificationsRef = useRef<HTMLDivElement>(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showNotifications || showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications, showProfileMenu]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-4 md:gap-6">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="font-bold text-lg md:hidden text-slate-900 mr-2 tracking-tight">
          NIRMAAN
        </h1>
        <h2 className="font-semibold text-slate-800 hidden md:block">
          {state.language === 'hi' ? (
            (() => {
              switch(state.currentRole) {
                case 'Super Admin': return 'सुपर एडमिन व्यू';
                case 'Admin': return 'एडमिन व्यू';
                case 'Office Staff': return 'ऑफिस स्टाफ व्यू';
                case 'Site Incharge': return 'साइट इंचार्ज व्यू';
                case 'Munshi': return 'मुंशी व्यू';
                default: return `${state.currentRole} व्यू`;
              }
            })()
          ) : `${state.currentRole} View`}
        </h2>
        {state.currentRole === "Munshi" && (
          <div className="flex items-center gap-4">
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-4 relative">
        <button 
          onClick={() => triggerSync()}
          disabled={isSyncing}
          className={`flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all hover:bg-slate-50 active:scale-95 cursor-pointer shadow-sm select-none shrink-0 ${
            !isOnline ? 'bg-rose-50 text-rose-600 border-rose-200' : 
            isSyncing ? 'bg-blue-50 text-blue-600 border-blue-200' : 
            'bg-emerald-50 text-emerald-600 border-emerald-200 hover:border-emerald-300'
          }`}
          title={state.language === 'hi' ? 'मैन्युअल रूप से सिंक करने के लिए दबाएं' : 'Click to sync manually'}
        >
          {!isOnline ? (
            <CloudOff className="w-3.5 h-3.5 text-rose-500" />
          ) : isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <span className="hidden sm:inline">
            {!isOnline ? (state.language === 'hi' ? 'ऑफ़लाइन' : 'Offline') : isSyncing ? (state.language === 'hi' ? 'सिंक हो रहा है...' : 'Syncing...') : (state.language === 'hi' ? 'सिंक किया हुआ' : 'Synced')}
          </span>
          <span className="sm:hidden">
            {!isOnline ? 'Off' : isSyncing ? 'Sync' : 'Synced'}
          </span>
        </button>

        <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 rounded-full p-1 border border-slate-200">
          <button 
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${state.language !== 'hi' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
          >
            EN
          </button>
          <button 
            onClick={() => setLanguage('hi')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${state.language === 'hi' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
          >
            हिंदी
          </button>
        </div>
        
        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (unreadCount > 0) markNotificationsRead();
            }}
            className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
          </button>

          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-slate-800 flex justify-between items-center">
                {state.language === 'hi' ? 'सूचनाएं' : 'Notifications'}
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {(!state.notifications || state.notifications.length === 0) ? (
                  <p className="p-4 text-sm text-slate-500 text-center">
                    {state.language === 'hi' ? 'कोई नई सूचना नहीं है' : 'No new notifications'}
                  </p>
                ) : (
                  state.notifications.map((notif: any) => (
                    <div key={notif.id} onClick={() => {
                      setShowNotifications(false);
                      // Try to find if this notification is about a specific project
                      if (notif.projectId) {
                        setView('project', notif.projectId);
                      } else {
                        const projMatch = state.projects.find((p: any) => notif.message.includes(p.name));
                        if (projMatch) {
                          setView('project', projMatch.id);
                        }
                      }
                    }} className={`p-4 border-b border-slate-50 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${notif.read ? 'opacity-75' : 'bg-blue-50/50'}`}>
                      <p className="text-slate-800 font-medium">{notif.message}</p>
                      <div className="flex items-center gap-1 mt-1 text-slate-400 text-xs text-right w-full justify-end">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileMenuRef}>
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm border border-slate-300 hover:ring-2 hover:ring-blue-100 transition-all overflow-hidden"
          >
            {state.currentUser?.photo ? (
              <img src={state.currentUser.photo} className="w-full h-full object-cover" />
            ) : (
              state.currentUser?.name?.charAt(0).toUpperCase() || state.currentRole.charAt(0)
            )}
          </button>
          
          {showProfileMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 py-1">
              <label className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors w-full">
                <div className="w-4 h-4 flex items-center justify-center"><Cloud className="w-4 h-4 text-slate-400" /></div>
                <span>{state.language === 'hi' ? 'फ़ोटो बदलें' : 'Change Photo'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && state.currentUser) {
                    const base64 = await resizeImage(file);
                    updateUser(state.currentUser!.id, { photo: base64 });
                    setShowProfileMenu(false);
                  }
                }} />
              </label>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
