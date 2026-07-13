import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Attempt to log the error to the backend
    try {
      const userPhone = localStorage.getItem('userPhone') || 'unknown';
      const userPin = localStorage.getItem('userPin') || '';
      const tenantId = localStorage.getItem('tenantId') || '';
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userPhone && userPin) {
         headers['x-user-phone'] = userPhone;
         headers['x-user-pin'] = userPin;
         headers['x-tenant-id'] = tenantId;
      }
      
      const token = localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      fetch('/api/errors', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          errorMessage: error.message || String(error),
          errorStack: error.stack || errorInfo.componentStack,
          component: 'ReactUIErrorBoundary',
          url: window.location.href,
          browserInfo: navigator.userAgent
        })
      }).catch(e => console.error("Failed to send error log:", e));
    } catch (e) {
       console.error("Failed to execute error logging:", e);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl max-w-lg w-full text-center space-y-6">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h2>
              <p className="text-slate-600">
                An unexpected error occurred in the application. Our team has been notified.
              </p>
            </div>
            
            <div className="bg-slate-100 p-4 rounded-lg text-left overflow-auto max-h-32 text-xs font-mono text-slate-700">
              {this.state.error?.message || "Unknown Error"}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              <RefreshCw className="w-5 h-5" /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
