import React, { useEffect } from 'react';
import { useAppContext } from '../store';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export function ToastManager() {
  const { state, removeToast } = useAppContext();

  if (!state.toasts || state.toasts.length === 0) return null;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none">
      {state.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { key?: React.Key; toast: any; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${bgColors[toast.type as keyof typeof bgColors] || bgColors.info} animate-in slide-in-from-top-5 fade-in duration-300 min-w-[280px] w-full mx-auto pointer-events-auto`}>
      {icons[toast.type as keyof typeof icons] || icons.info}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button onClick={onRemove} className="text-slate-400 hover:text-slate-600 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
