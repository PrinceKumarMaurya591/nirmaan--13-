import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RefreshCw, X, ServerCrash } from 'lucide-react';
 // Or however we fetch

export const ErrorLogsViewer = ({ onClose }: { onClose: () => void }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const userPhone = localStorage.getItem('userPhone');
      const userPin = localStorage.getItem('userPin');
      const tenantId = localStorage.getItem('tenantId');
      if (userPhone && userPin) {
        headers['x-user-phone'] = userPhone;
        headers['x-user-pin'] = userPin;
        headers['x-tenant-id'] = tenantId || '';
      }
      const res = await fetch('/api/errors', { headers });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in fade-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-rose-100 p-2 rounded-lg text-rose-600">
              <ServerCrash className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">System Error Logs</h2>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={fetchLogs} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
               <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
             </button>
             <button onClick={onClose} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {loading ? (
             <div className="flex justify-center items-center h-32">
               <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
             </div>
          ) : logs.length === 0 ? (
             <div className="text-center py-12">
               <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
               <h3 className="text-lg font-medium text-slate-700">No Error Logs</h3>
               <p className="text-slate-500 mt-1">Your application is running smoothly with no reported errors.</p>
             </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                 <div key={log.id} className="bg-white border border-rose-100 p-4 rounded-xl shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2">
                          <span className="bg-rose-50 text-rose-700 font-semibold px-2 py-1 rounded text-xs border border-rose-100">
                             {log.component || 'System'}
                          </span>
                          <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">
                             User: {log.user_phone}
                          </span>
                       </div>
                       <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(log.created_at).toLocaleString('en-IN')}
                       </div>
                    </div>
                    <div className="font-mono text-sm text-rose-800 font-medium mb-3 mt-2 break-all">
                       {log.error_message}
                    </div>
                    {log.error_stack && (
                       <details className="mt-2 text-xs bg-slate-900 rounded-lg overflow-hidden group">
                         <summary className="p-3 text-slate-300 cursor-pointer hover:bg-slate-800 transition-colors list-none flex justify-between items-center outline-none">
                            <span className="font-semibold tracking-wide uppercase text-[10px]">View Stack Trace</span>
                            <span className="group-open:rotate-180 transition-transform text-slate-500">▼</span>
                         </summary>
                         <div className="p-3 bg-slate-950 text-slate-400 font-mono whitespace-pre-wrap overflow-x-auto border-t border-slate-800">
                           {log.error_stack}
                         </div>
                       </details>
                    )}
                 </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
