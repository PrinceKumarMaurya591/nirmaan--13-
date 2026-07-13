import React, { useState } from 'react';
import { CheckCircle2, PlusCircle, Check, Trash2, Edit2, X, Save } from 'lucide-react';
import { Project, Milestone } from '../types';
import { useAppContext } from '../store';

interface ProjectMilestonesProps {
  project: Project;
  updateProject: (id: string, updates: Partial<Project>, logDetails?: string) => void;
  currentUser: any;
}

export const ProjectMilestones: React.FC<ProjectMilestonesProps> = ({ project, updateProject, currentUser }) => {
  const { addToRecycleBin } = useAppContext();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const milestonesLogs = (project.activityLogs || []).filter(log => log.isMilestone && log.milestoneData);

  const handleAdd = () => {
    if (!newTitle.trim()) return;

    const newMilestone: Milestone = {
      id: `ms_${Date.now()}`,
      title: newTitle.trim(),
      completed: false,
    };

    const logEntry = {
      id: `log_ms_${Date.now()}`,
      userId: currentUser?.id || '',
      userName: currentUser?.name || '',
      action: "Milestone Added",
      details: newMilestone.title,
      timestamp: new Date().toISOString(),
      isMilestone: true,
      milestoneData: newMilestone
    };

    updateProject(project.id, {
      activityLogs: [...(project.activityLogs || []), logEntry]
    }, `Added milestone: ${newMilestone.title}`);

    setNewTitle('');
    setIsAdding(false);
  };

  const handleDelete = (msId: string) => {
    if (!window.confirm("Delete this milestone?")) return;
    
    const targetLog = (project.activityLogs || []).find(l => l.isMilestone && l.milestoneData && l.milestoneData.id === msId);
    if (targetLog && targetLog.milestoneData) {
      addToRecycleBin({
        projectId: project.id,
        itemType: 'Milestone',
        itemName: `${targetLog.milestoneData.title} (Milestone)`,
        itemData: targetLog.milestoneData,
        deletedBy: currentUser?.name || 'Unknown',
        deleteReason: 'User Deleted Milestone'
      });
    }

    // Some old milestones might not have an id, we'll delete by comparing exactly or by id
    const updatedLogs = (project.activityLogs || []).filter(l => {
      if (l.isMilestone && l.milestoneData) {
        return l.milestoneData.id !== msId;
      }
      return true;
    });

    updateProject(project.id, {
      activityLogs: updatedLogs
    }, "Deleted milestone");
  };

  const handleToggle = (ms: Milestone) => {
    const updatedLogs = (project.activityLogs || []).map(l => {
      if (l.isMilestone && l.milestoneData && l.milestoneData.id === ms.id) {
        return {
          ...l,
          milestoneData: {
            ...l.milestoneData,
            completed: !l.milestoneData.completed,
            completedAt: !l.milestoneData.completed ? new Date().toISOString() : undefined
          }
        };
      }
      return l;
    });
    updateProject(project.id, { activityLogs: updatedLogs }, `Marked milestone as ${!ms.completed ? 'completed' : 'incomplete'}`);
  };

  const handleSaveEdit = (msId: string) => {
    if (!editTitle.trim()) return;

    const updatedLogs = (project.activityLogs || []).map(l => {
      if (l.isMilestone && l.milestoneData && l.milestoneData.id === msId) {
        return {
          ...l,
          milestoneData: {
            ...l.milestoneData,
            title: String(editTitle.trim())
          }
        };
      }
      return l;
    });

    updateProject(project.id, { activityLogs: updatedLogs }, `Updated milestone title`);
    setEditingId(null);
  };

  return (
    <div className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm print:hidden">
      <div className="bg-slate-50 px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-amber-500" />
          Project Milestones & Tasks
        </h3>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors w-full sm:w-auto justify-center"
          >
            <PlusCircle className="w-4 h-4" />
            Add Task / Milestone
          </button>
        )}
      </div>
      
      <div className="p-4 sm:p-6">
        {isAdding && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row gap-3">
            <input 
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter milestone or task description..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
            />
            <div className="flex gap-2 justify-end sm:justify-start">
              <button 
                onClick={handleAdd}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {milestonesLogs.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-medium text-slate-700">No tasks yet</h4>
              <p className="text-xs text-slate-500 mt-1">Add tasks and milestones to track project progress.</p>
            </div>
          ) : (
            milestonesLogs.map(log => {
              const ms = log.milestoneData;
              if (!ms) return null;
              const isEditing = editingId === ms.id;
              
              return (
                <div key={log.id} className={`flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl border ${ms.completed ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-white'} transition-all`}>
                  <div className="flex items-start gap-4 flex-1 w-full">
                    <button
                      onClick={() => handleToggle(ms)}
                      className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${ms.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent hover:border-amber-400'}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input 
                            type="text"
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 px-2 py-1 text-base border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(ms.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => handleSaveEdit(ms.id)} className="p-1.5 text-green-600 hover:bg-green-100 rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className={`text-base font-medium ${ms.completed ? 'text-green-800 line-through' : 'text-slate-800'}`}>
                            {String(ms.title || '')}
                          </p>
                          {ms.completed && ms.completedAt && (
                            <p className="text-xs text-green-600 mt-1">Completed on {new Date(ms.completedAt).toLocaleDateString()}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex gap-1 justify-end w-full sm:w-auto ml-10 sm:ml-0 border-t sm:border-t-0 pt-2 sm:pt-0 mt-2 sm:mt-0 border-slate-100">
                      <button
                        onClick={() => {
                          setEditingId(ms.id);
                          setEditTitle(String(ms.title || ''));
                        }}
                        className="text-slate-400 hover:text-amber-600 p-2 transition-colors flex items-center gap-1 text-xs sm:text-sm font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="sm:hidden">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(ms.id)}
                        className="text-slate-400 hover:text-red-500 p-2 transition-colors flex items-center gap-1 text-xs sm:text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:hidden">Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
