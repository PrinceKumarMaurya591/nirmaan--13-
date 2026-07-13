import React, { useMemo } from 'react';
import { Project, SitePhoto } from '../types';
import { Camera, Calendar, Trash2 } from 'lucide-react';
import { useAppContext } from '../store';
import { openMediaInNewTab } from '../lib/utils';

export function SitePhotoGallery({ project }: { project: Project }) {
  const { state, updateProject, addToRecycleBin, prompt, addToast } = useAppContext();
  
  const isAdmin = state.currentRole === 'Super Admin' || state.currentRole === 'Admin';

  // Group photos by date
  const groupedPhotos = useMemo(() => {
    const approvedPhotos = (project.sitePhotos || []).filter(p => !p.status || p.status === 'Approved');
    
    const groups: { [date: string]: SitePhoto[] } = {};
    
    approvedPhotos.forEach(photo => {
      let dateKey = 'Unknown Date';
      if (photo.dateTaken) {
        dateKey = new Date(photo.dateTaken).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      } else if (photo.uploadedAt) {
        dateKey = new Date(photo.uploadedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
      
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(photo);
    });
    
    // Sort dates descending
    return Object.keys(groups)
      .sort((a, b) => {
        const timeA = new Date(a).getTime();
        const timeB = new Date(b).getTime();
        if (isNaN(timeA) && isNaN(timeB)) return a.localeCompare(b);
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      })
      .map(date => ({
        date,
        photos: groups[date]
      }));
  }, [project.sitePhotos]);

  const openPhoto = (photo: SitePhoto) => {
    if (photo.data) {
      openMediaInNewTab(photo.data, photo.name || 'Site Photo', 'image');
    }
  };

  if (groupedPhotos.length === 0) {
    return (
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Site Progress Gallery</h3>
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-slate-500">
          <Camera className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-center">No approved site photos available yet.<br/>Upload them from the Entry module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Site Progress Gallery</h3>
      
      {groupedPhotos.map((group) => (
        <div key={group.date} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              {group.date}
            </h4>
            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
              {group.photos.length} Photo{group.photos.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {group.photos.map(photo => (
              <div 
                key={photo.id}
                onClick={() => openPhoto(photo)}
                className="group relative aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-amber-400 hover:shadow-md transition-all"
              >
                {photo.data && photo.data.startsWith('data:image') ? (
                  <img src={photo.data} alt={photo.category || photo.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                    <Camera className="w-8 h-8" />
                  </div>
                )}
                
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3 translate-y-2 group-hover:translate-y-0 transition-transform">
                  <p className="text-xs font-bold text-white truncate shadow-sm mb-0.5">{photo.category || 'Progress Photo'}</p>
                  <p className="text-[10px] text-slate-300 truncate shadow-sm">{photo.remarks || photo.name}</p>
                </div>

                {isAdmin && (
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      const reason = await prompt("Please provide a reason for deletion:");
                      if (!reason) return;
                      addToRecycleBin({
                        projectId: project.id,
                        itemType: 'SitePhoto',
                        itemName: photo.name,
                        itemData: photo,
                        deletedBy: state.currentUser?.name || 'Unknown',
                        deleteReason: reason
                      });
                      updateProject(project.id, {
                        sitePhotos: project.sitePhotos?.filter(d => d.id !== photo.id)
                      }, `Deleted Site Photo: ${photo.name}`);
                      addToast("Photo deleted", "success");
                    }}
                    className="absolute top-2 right-2 bg-rose-500/90 hover:bg-rose-600 text-white p-2 rounded-full shadow-md transition-opacity"
                    title="Delete Photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
