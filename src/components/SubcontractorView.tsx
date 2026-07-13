import React from 'react';
import { useAppContext } from '../store';
import { SubcontractorTracker } from './SubcontractorTracker';
import { ArrowLeft } from 'lucide-react';

export const SubcontractorView = () => {
  const { state, setView, updateProject } = useAppContext();
  const project = state.projects.find(p => p.id === state.selectedProjectId);

  if (!project) return <div className="p-8">Project not found</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setView('mobile_home')}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-2">{project.name}</h2>
        <p className="text-slate-400 font-medium">Subcontractor Management</p>
      </div>

      <SubcontractorTracker 
        project={project} 
         
      />
    </div>
  );
};
