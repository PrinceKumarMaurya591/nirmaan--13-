import React, { useState } from 'react';
import { useAppContext } from '../store';
import { formatINR } from '../lib/utils';
import { TrendingUp, TrendingDown, Building, CheckCircle2, Factory, PlusCircle, ArrowRight, Search, Trash2, Camera } from 'lucide-react';
import { Project } from '../types';

export function AdminDashboard() {
  const { state, setView } = useAppContext();
  const [filter, setFilter] = useState<'All' | 'Active' | 'Completed' | 'Receipts'>('All');
  const [localSearch, setLocalSearch] = useState('');

  // Aggregate calculations
  const totalActiveSites = state.projects.filter(p => p.status === 'Active').length;
  const completedSites = state.projects.filter(p => p.status === 'Completed').length;
  const totalRevenue = state.projects.reduce((sum, p) => sum + p.received, 0);
  
  const calculateTotalExpenses = (p: Project): number => {
    return p.expenses.material + p.expenses.shifting + p.expenses.labor + p.expenses.machinery + p.expenses.misc;
  };
  const totalSpends = state.projects.reduce((sum, p) => sum + calculateTotalExpenses(p), 0);
  
  const companyProfit = totalRevenue - totalSpends;

  const searchTerm = localSearch.toLowerCase();
  const filteredProjects = state.projects.filter(p => {
    if (filter !== 'All' && filter !== 'Receipts' && p.status !== filter) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm) && !p.location.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Company Overview</h1>
        <p className="text-slate-500 mt-1">High-level financial and operational summary across all sites.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        <button 
          onClick={() => setFilter(filter === 'Active' ? 'All' : 'Active')}
          className={`text-left p-4 md:p-6 rounded-xl border shadow-sm flex flex-col justify-between transition-all ${filter === 'Active' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20' : 'bg-white border-slate-200 hover:border-amber-300'}`}
        >
          <div className="flex items-start justify-between w-full gap-2">
            <span className="text-sm md:text-base font-medium text-slate-500 line-clamp-2">{state.language === 'hi' ? 'सक्रिय साइटें' : 'Active Sites'}</span>
            <Building className="w-4 h-4 md:w-5 md:h-5 text-amber-500 shrink-0" />
          </div>
          <div className="mt-4 md:mt-6 w-full overflow-hidden">
            <span className="text-3xl md:text-4xl font-bold text-slate-800 block truncate" title={String(totalActiveSites)}>{totalActiveSites}</span>
          </div>
        </button>
        <button 
          onClick={() => setFilter(filter === 'Completed' ? 'All' : 'Completed')}
          className={`text-left p-4 md:p-6 rounded-xl border shadow-sm flex flex-col justify-between transition-all ${filter === 'Completed' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-white border-slate-200 hover:border-emerald-300'}`}
        >
          <div className="flex items-start justify-between w-full gap-2">
            <span className="text-sm md:text-base font-medium text-slate-500 line-clamp-2">{state.language === 'hi' ? 'पूरे हो चुके प्रोजेक्ट्स' : 'Completed Projects'}</span>
            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-4 md:mt-6 w-full overflow-hidden">
            <span className="text-3xl md:text-4xl font-bold text-slate-800 block truncate" title={String(completedSites)}>{completedSites}</span>
          </div>
        </button>
        <button 
          onClick={() => setFilter(filter === 'Receipts' ? 'All' : 'Receipts')}
          className={`text-left p-4 md:p-6 rounded-xl border shadow-sm flex flex-col justify-between transition-all ${filter === 'Receipts' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-blue-300'}`}
        >
          <div className="flex items-start justify-between w-full gap-2">
            <span className="text-sm md:text-base font-medium text-slate-500 line-clamp-2">{state.language === 'hi' ? 'कुल प्राप्त राशि (रसीदें)' : 'Gross Receipts (Received)'}</span>
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-500 shrink-0" />
          </div>
          <div className="mt-4 md:mt-6 w-full overflow-hidden">
            <span className="text-2xl md:text-3xl xl:text-2xl 2xl:text-3xl font-bold text-slate-800 block truncate" title={formatINR(totalRevenue)}>{formatINR(totalRevenue)}</span>
          </div>
        </button>
        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="text-sm md:text-base font-medium text-emerald-700 line-clamp-2">{state.language === 'hi' ? 'शुद्ध लाभ (सभी साइटों पर)' : 'Net Profit (Across Portfolio)'}</span>
          </div>
          <div className="relative z-10 mt-4 md:mt-6 w-full overflow-hidden">
            <span className="text-2xl md:text-3xl xl:text-2xl 2xl:text-3xl font-bold text-emerald-600 block truncate" title={formatINR(companyProfit)}>{formatINR(companyProfit)}</span>
          </div>
        </div>
      </div>

      {/* Project Master List / Receipts View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-semibold text-slate-800">
            {filter === 'Receipts' ? (state.language === 'hi' ? 'प्राप्तियों का विवरण' : 'Gross Receipts Breakdown') : (state.language === 'hi' ? 'सक्रिय टेंडर एवं चालू साइटें' : 'Active Tenders & Working Sites')}
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder={state.language === 'hi' ? 'प्रोजेक्ट खोजें...' : 'Search projects...'} 
                value={localSearch} 
                onChange={e => setLocalSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-amber-500 outline-none transition-shadow"
              />
            </div>
            {filter !== 'Receipts' && (
              <div className="flex flex-wrap w-full sm:w-auto gap-2">
                <button 
                  onClick={() => setView('create_project')}
                  className="w-full sm:w-auto flex justify-center items-center gap-2 text-sm font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 px-4 py-2 rounded-lg transition-colors shadow-sm whitespace-nowrap"
                >
                  <PlusCircle className="w-4 h-4" /> {state.language === 'hi' ? 'नया प्रोजेक्ट' : 'New Project'}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {filter === 'Receipts' ? (
            filteredProjects.filter(p => p.received > 0).map(project => (
              <div key={project.id} className="p-4 md:p-6 flex flex-col hover:bg-slate-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0">
                  <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 w-12 h-12 rounded-lg items-center justify-center border border-slate-200 shrink-0">
                      <TrendingUp className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="flex-1 md:hidden">
                      <h4 
                        onClick={() => setView('project', project.id)}
                        className="font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                      >
                        {project.name}
                      </h4>
                    </div>
                  </div>
                  <div className="md:ml-4 flex-1 hidden md:block">
                    <div className="flex items-center gap-3">
                      <h4 
                        onClick={() => setView('project', project.id)}
                        className="font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                      >
                        {project.name}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">{state.language === 'hi' ? 'विभाग:' : 'Dept:'}</span> {project.department} &bull; 
                      <span className="font-medium text-slate-700">{state.language === 'hi' ? 'स्कीम:' : 'Scheme:'}</span> {project.scheme}
                    </p>
                  </div>
                  {/* Mobile Dept info */}
                  <div className="md:hidden">
                    <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">{state.language === 'hi' ? 'विभाग:' : 'Dept:'}</span> {project.department} &bull; 
                      <span className="font-medium text-slate-700">{state.language === 'hi' ? 'स्कीम:' : 'Scheme:'}</span> {project.scheme}
                    </p>
                  </div>
                  <div className="md:text-right flex items-center justify-between md:block">
                    <p className="text-lg md:text-xl font-bold text-emerald-600 md:mb-0">{state.language === 'hi' ? 'कुल:' : 'Total:'} {formatINR(project.received)}</p>
                    <p className="text-xs text-slate-500 mt-1 bg-slate-200/50 inline-block px-2 py-0.5 rounded md:mt-1">{state.language === 'hi' ? 'प्राप्त भुगतान' : 'Payments Received'}</p>
                  </div>
                  <div className="md:ml-6 flex items-center md:h-full mt-2 md:mt-0">
                    <button 
                      onClick={() => setView('project', project.id)}
                      className="w-full md:w-auto text-sm font-medium text-slate-600 hover:text-blue-600 px-4 py-2 border border-slate-200 rounded-lg bg-white hover:border-blue-200 transition-all shadow-sm"
                    >
                      {state.language === 'hi' ? 'प्रोजेक्ट देखें' : 'View Project'}
                    </button>
                  </div>
                </div>

                {project.receiptsHistory && project.receiptsHistory.length > 0 && (
                  <div className="mt-4 md:ml-16 border-l-2 border-slate-100 pl-4 space-y-2">
                    {project.receiptsHistory.map(receipt => (
                      <div key={receipt.id} className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-emerald-600">+{formatINR(receipt.amount)}</p>
                          {receipt.note && <p className="text-xs text-slate-500">{receipt.note}</p>}
                        </div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">
                          {new Date(receipt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            filteredProjects.map(project => {
              const exp = calculateTotalExpenses(project);
              const statusColor = project.status === 'Active' ? 'text-amber-600 bg-amber-50 rounded-full px-2.5 py-0.5 text-xs font-medium border border-amber-200' : 'text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 text-xs font-medium border border-emerald-200';
              const pendingCount = (project.expenseItems || []).filter(e => e.status === 'Pending Approval').length;
              return (
                <div key={project.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center hover:bg-slate-50 transition-colors gap-4 md:gap-0">
                  <div className="flex items-center gap-4 md:gap-0">
                    <div className="flex bg-slate-100 w-12 h-12 rounded-lg items-center justify-center border border-slate-200 shrink-0 relative">
                      <Factory className="w-6 h-6 text-slate-500" />
                      {pendingCount > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white"></span></span>}
                    </div>
                    <div className="ml-4 flex-1 md:hidden">
                      <div className="flex items-center gap-3">
                        <h4 
                          onClick={() => setView('project', project.id)}
                          className="font-semibold text-slate-900 cursor-pointer hover:text-amber-600 transition-colors line-clamp-1 flex items-center gap-2"
                        >
                          {project.name}
                        </h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`${statusColor} inline-block`}>{project.status === 'Active' ? (state.language === 'hi' ? 'सक्रिय' : 'Active') : (state.language === 'hi' ? 'पूरा हुआ' : 'Completed')}</span>
                        {pendingCount > 0 && <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">{pendingCount} {state.language === 'hi' ? 'लंबित' : 'Pending'}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="md:ml-4 flex-1 hidden md:block">
                    <div className="flex items-center gap-3">
                      <h4 
                        onClick={() => setView('project', project.id)}
                        className="font-semibold text-slate-900 cursor-pointer hover:text-amber-600 transition-colors"
                      >
                        {project.name}
                      </h4>
                      <span className={statusColor}>{project.status === 'Active' ? (state.language === 'hi' ? 'सक्रिय' : 'Active') : (state.language === 'hi' ? 'पूरा हुआ' : 'Completed')}</span>
                      {pendingCount > 0 && <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">{pendingCount} {state.language === 'hi' ? 'लंबित' : 'Pending'}</span>}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{state.language === 'hi' ? 'प्रभारी:' : 'Incharge:'} {project.incharge || (state.language === 'hi' ? 'लंबित' : 'Pending')}</span>
                      <span>&bull;</span>
                      <span>{state.language === 'hi' ? 'कुल बजट:' : 'BOQ:'} {formatINR(project.woValue)}</span>
                    </p>
                  </div>
                  <div className="md:hidden">
                    <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>{state.language === 'hi' ? 'प्रभारी:' : 'Incharge:'} {project.incharge || (state.language === 'hi' ? 'लंबित' : 'Pending')}</span>
                      <span>&bull;</span>
                      <span>{state.language === 'hi' ? 'कुल बजट:' : 'BOQ:'} {formatINR(project.woValue)}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between md:block text-left md:text-right bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg">
                    <p className="text-sm font-medium text-slate-900">{state.language === 'hi' ? 'खर्च:' : 'Spends:'} {formatINR(exp)}</p>
                    <p className="text-sm text-slate-500 md:mt-1">{state.language === 'hi' ? 'प्राप्त:' : 'Received:'} {formatINR(project.received)}</p>
                  </div>
                  <div className="md:ml-6 mt-2 md:mt-0">
                    <button 
                      onClick={() => setView('project', project.id)}
                      className="w-full md:w-auto text-sm font-medium text-slate-600 hover:text-amber-600 px-4 py-2 border border-slate-200 rounded-lg bg-white hover:border-amber-200 transition-all shadow-sm text-center"
                    >
                      {state.language === 'hi' ? 'विवरण देखें' : 'View Drilldown'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}
