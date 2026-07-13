import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      return;
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show prompt if not previously dismissed
      if (localStorage.getItem('pwa_prompt_dismissed') !== 'true') {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-slate-200 p-4 rounded-xl shadow-xl z-[100] flex items-start gap-4 animate-in slide-in-from-bottom-5">
      <div className="bg-amber-100 p-2 rounded-lg text-amber-700 mt-1">
        <Download className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-slate-800">Install Nirmaan App</h3>
        <p className="text-sm text-slate-500 mt-1 mb-3">Install our app on your device for quick access and offline capabilities.</p>
        <div className="flex gap-2">
          <button 
            onClick={handleInstallClick}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            Install Now
          </button>
          <button 
            onClick={handleDismiss}
            className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            Not Now
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 mt-1">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
