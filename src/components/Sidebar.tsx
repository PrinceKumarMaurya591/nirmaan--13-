import React, { useState } from "react";
import {
  Building2,
  LayoutDashboard,
  HardHat,
  FileSpreadsheet,
  PlusCircle,
  Settings,
  ShieldAlert,
  Users,
  LogOut,
  User,
  X,
  ChevronDown,
  Camera,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { useAppContext } from "../store";
import { ErrorLogsViewer } from "./ErrorLogsViewer";
import { cn } from "../lib/utils";
import { Role } from "../types";

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const { state, setView, logout } = useAppContext();
  const [showErrorLogs, setShowErrorLogs] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  

  const isAdminOrOffice =
    state.currentRole === "Super Admin" || state.currentRole === "Admin" || state.currentRole === "Office Staff";

  return (
    <div
      className={cn(
        "w-64 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300 h-[100dvh] top-0 shrink-0",
        "fixed md:relative z-50 transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="p-6 flex items-center justify-between gap-3 text-white border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-slate-900" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-100">
              NIRMAAN
            </h1>
            <p className="text-[10px] text-amber-500 font-mono tracking-wider">
              DEVELOPED BY DSR CONSTRUCTION PVT LTD.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1 text-slate-400 hover:text-white -mr-2"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
        {/* User Profile */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                {state.currentUser?.name}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                {state.currentUser?.role}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-400 p-1.5 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          <button
            onClick={() => {
              setView("dashboard");
              onClose?.();
            }}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-sm font-medium",
              state.currentView === "dashboard"
                ? "bg-amber-500/10 text-amber-400"
                : "hover:bg-slate-800 hover:text-white",
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            {state.language === 'hi' ? 'डैशबोर्ड' : 'Dashboard'}
          </button>

          {isAdminOrOffice && (
            <button
              onClick={() => {
                setView("payment_dashboard");
                onClose?.();
              }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-sm font-medium",
                state.currentView === "payment_dashboard"
                  ? "bg-amber-500/10 text-amber-400"
                  : "hover:bg-slate-800 hover:text-white",
              )}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {state.language === 'hi' ? 'भुगतान डैशबोर्ड' : 'Payment Dashboard'}
            </button>
          )}

          {isAdminOrOffice && (
            <button
              onClick={() => {
                setView("user_management");
                onClose?.();
              }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-sm font-medium",
                state.currentView === "user_management"
                  ? "bg-amber-500/10 text-amber-400"
                  : "hover:bg-slate-800 hover:text-white",
              )}
            >
              <Users className="w-4 h-4" />
              {state.language === 'hi' ? 'स्टाफ और अनुमतियां' : 'Staff & Permissions'}
            </button>
          )}



          <div className="pt-4 pb-0 space-y-1">
            <div
              className="flex items-center justify-between px-3 group cursor-pointer py-1"
              onClick={() => setProjectsOpen(!projectsOpen)}
            >
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                  {state.language === 'hi' ? 'सक्रिय प्रोजेक्ट' : 'Active Projects'}
                </p>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 text-slate-500 transition-transform duration-300",
                    projectsOpen ? "rotate-180" : "rotate-0",
                  )}
                />
              </div>
              {(state.currentRole === "Admin" || state.currentRole === "Super Admin") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setView("create_project");
                    onClose?.();
                  }}
                  className="text-slate-400 hover:text-amber-500 transition-colors"
                  title="Create New Project"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              )}
            </div>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                projectsOpen
                  ? "max-h-[500px] opacity-100"
                  : "max-h-0 opacity-0",
              )}
            >
              <div className="space-y-1 pt-1">
                {state.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setView("project", p.id);
                      onClose?.();
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-left text-sm font-medium",
                      state.currentView === "project" &&
                        state.selectedProjectId === p.id
                        ? "bg-amber-500/10 text-amber-400"
                        : "hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <FileSpreadsheet className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {state.language === 'hi' ? 'फील्ड ऑपरेशंस' : 'Field Operations'}
            </p>
          </div>
          <button
            onClick={() => {
              setView("munshi_entry");
              onClose?.();
            }}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-sm font-medium",
              state.currentView === "munshi_entry"
                ? "bg-amber-500/10 text-amber-400"
                : "hover:bg-slate-800 hover:text-white",
            )}
          >
            <HardHat className="w-4 h-4" />
            {state.language === 'hi' ? 'फील्ड इनपुट' : 'Field Input'}
          </button>
          {isAdminOrOffice ? (
            <button
              onClick={() => {
                setView("document_ledger");
                onClose?.();
              }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-sm font-medium",
                state.currentView === "document_ledger"
                  ? "bg-amber-500/10 text-amber-400"
                  : "hover:bg-slate-800 hover:text-white",
              )}
            >
              <Camera className="w-4 h-4" />
              {state.language === 'hi' ? 'दस्तावेज़ और फोटो लेज़र' : 'Documents & Photos'}
            </button>
          ) : (
            <button
              onClick={() => {
                setView("site_photos");
                onClose?.();
              }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-sm font-medium",
                state.currentView === "site_photos"
                  ? "bg-amber-500/10 text-amber-400"
                  : "hover:bg-slate-800 hover:text-white",
              )}
            >
              <Camera className="w-4 h-4" />
              {state.language === 'hi' ? 'साइट फोटो गैलरी' : 'Site Photo Gallery'}
            </button>
          )}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="space-y-1">
          <div 
            className="flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-300"
            onClick={(e) => {
              const el = e.currentTarget.nextElementSibling;
              el?.classList.toggle('hidden');
            }}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4" />
              {state.language === 'hi' ? 'सेटिंग्स और सहायता' : 'Settings & Help'}
            </div>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
          <div className="hidden pl-8 space-y-1 mt-1">
            {(state.currentRole === 'Super Admin' || state.currentRole === 'Admin') && (
              <button
                onClick={() => {
                  setShowErrorLogs(true);
                  onClose?.();
                }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors hover:bg-slate-800 text-sm font-medium text-slate-300"
              >
                System Errors
              </button>
            )}
            <button
              onClick={() => {
                setView("mobile_settings");
                onClose?.();
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors hover:bg-slate-800 text-sm font-medium text-slate-300"
            >
              {state.language === 'hi' ? 'सेटिंग्स' : 'Settings View'}
            </button>
            <button
              onClick={() => {
                setView("user_manual");
                onClose?.();
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors hover:bg-slate-800 text-sm font-medium text-slate-300"
            >
              {state.language === 'hi' ? 'उपयोगकर्ता नियमावली' : 'User Manual'}
            </button>


          </div>
        </div>
      </div>
      {showErrorLogs && <ErrorLogsViewer onClose={() => setShowErrorLogs(false)} />}
    </div>
  );
}
