import React from 'react';
import { useAppContext } from '../store';
import { SitePhotoGallery } from './SitePhotoGallery';
import { ArrowLeft } from 'lucide-react';

export function MobileSitePhotosView() {
  const { state, setView } = useAppContext();
  const project = state.projects.find(p => p.id === state.selectedProjectId);

  if (!project) return <div className="p-8 text-center text-slate-500">Project not found</div>;

  return (
    <div className="bg-slate-50 min-h-screen pb-20 animate-in fade-in duration-300">
      <div className="bg-slate-900 px-4 py-4 text-white shadow-md flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setView('mobile_home')} className="p-2 -ml-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-bold text-lg leading-tight">{state.language === 'hi' ? 'साइट फोटो गैलरी' : 'Site Photo Gallery'}</h2>
          <p className="text-[10px] text-slate-400 font-medium">{project.name}</p>
        </div>
      </div>
      
      <div className="p-2">
        <SitePhotoGallery project={project} />
      </div>
    </div>
  );
}
