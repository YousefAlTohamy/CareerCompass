import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Briefcase, MapPin, Calendar, Trash2, Activity,
  BookmarkPlus, Send, Users, CheckCircle2, XCircle, Target, Globe, Archive,
  ArrowRight, Sparkles, Filter, ChevronRight, LayoutGrid, List
} from 'lucide-react';
import applicationsAPI from '../../api/applications';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import HUDLayout from '../../components/HUDLayout';

// --- STATUS CONFIGURATION ---
export const getStatusConfig = (t) => ({
  saved:        { label: t('tracker.status.saved'),        color: 'indigo',  icon: BookmarkPlus,  progress: 20 },
  applied:      { label: t('tracker.status.applied'),      color: 'blue',    icon: Send,          progress: 40 },
  interviewing: { label: t('tracker.status.interviewing'), color: 'amber',   icon: Users,         progress: 70 },
  offered:      { label: t('tracker.status.offered'),      color: 'emerald', icon: CheckCircle2,  progress: 100 },
  rejected:     { label: t('tracker.status.rejected'),     color: 'rose',    icon: XCircle,       progress: 100 },
  archived:     { label: t('tracker.status.archived', 'Archived'), color: 'slate', icon: Archive, progress: 100 },
});

function getRelativeDate(dateStr, t) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t('tracker.today', 'Today');
  if (diffDays === 1) return t('tracker.yesterday', 'Yesterday');
  return date.toLocaleDateString();
}

export default function Applications() {
  const { t } = useTranslation();
  const statusConfig = getStatusConfig(t);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = async () => {
    try { 
      setLoading(true); 
      const response = await applicationsAPI.getApplications(); 
      setApplications(response.data?.data ?? []); 
    }
    catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const handleStatusChange = async (id, newStatus) => {
    setApplications((prev) => prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app)));
    try { await applicationsAPI.updateApplicationStatus(id, newStatus); }
    catch (err) { loadApplications(); }
  };

  const handleDelete = async (id) => {
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
      title: t('tracker.delete_confirm'), 
      icon: 'warning', 
      showCancelButton: true, 
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#f43f5e',
      background: isDark ? '#1e293b' : '#fff',
      color: isDark ? '#fff' : '#000',
    });
    if (result.isConfirmed) {
      setApplications((prev) => prev.filter((app) => app.id !== id));
      try { await applicationsAPI.deleteApplication(id); } catch (err) { loadApplications(); }
    }
  };

  const filteredApps = activeTab === 'all' ? applications : applications.filter((app) => app.status === activeTab);
  
  const stats = {
    total: applications.length,
    interviews: applications.filter(a => a.status === 'interviewing').length,
    active: applications.filter(a => !['rejected', 'archived', 'saved'].includes(a.status)).length,
    success: applications.filter(a => a.status === 'offered').length
  };

  return (
    <HUDLayout loading={loading} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-10 relative z-10">
        
        {/* --- HERO HEADER SECTION --- */}
        <div className="relative">
          <div className="absolute -top-16 -left-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
            <div className="space-y-3 text-start">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-1.5">
                  {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />)}
                </div>
                <span className="micro-typography text-indigo-600 dark:text-indigo-400 font-black tracking-[0.2em] uppercase text-[9px]">Mission Tracker // active_nodes</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white">
                {t('tracker.title')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-base font-medium max-w-lg leading-relaxed">
                {t('tracker.subtitle')}
              </p>
            </div>

            {/* BENTO STATS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              {[
                { label: t('hud_labels.total_roles'), val: stats.total, color: 'indigo' },
                { label: t('tracker.status.interviewing'), val: stats.interviews, color: 'amber' },
                { label: 'Active', val: stats.active, color: 'blue' },
                { label: 'Offers', val: stats.success, color: 'emerald' }
              ].map((s, i) => (
                <div key={i} className="glass-card !rounded-[2rem] p-5 flex flex-col items-center justify-center border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-xl min-w-[120px] shadow-lg">
                  <span className="micro-typography text-slate-400 mb-0.5 text-[7px] font-black">{s.label.toUpperCase()}</span>
                  <span className={`text-3xl font-black text-${s.color}-600 dark:text-${s.color}-400 tabular-nums`}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- CONTROLS & TABS --- */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('all')} 
              className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 translate-y-[-1px]' : 'glass-card border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'}`}
            >
              {t('tracker.all_roles')}
            </button>
            {Object.entries(statusConfig).map(([key, config]) => (
              <button 
                key={key} 
                onClick={() => setActiveTab(key)} 
                className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === key ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-lg translate-y-[-1px]' : 'glass-card border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'}`}
              >
                <config.icon size={10} /> {config.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 glass-card !rounded-xl p-1 border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 shrink-0">
             <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><List size={16} /></button>
             <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={16} /></button>
          </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className={viewMode === 'list' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'}>
          <AnimatePresence mode="popLayout">
            {filteredApps.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="col-span-full glass-card p-24 text-center border-dashed border-slate-200 dark:border-white/10 opacity-60 flex flex-col items-center justify-center space-y-6"
              >
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400"><Briefcase size={32} /></div>
                <div className="space-y-1">
                   <h3 className="text-xl font-black uppercase tracking-tight">{t('tracker.no_jobs', 'NO_DATA_NODES')}</h3>
                   <p className="text-sm font-medium text-slate-400">{t('tracker.no_jobs_subtitle', 'Start by saving interesting opportunities from the hub.')}</p>
                </div>
                <Link to="/jobs" className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 transition-all">{t('tracker.find_jobs')}</Link>
              </motion.div>
            ) : filteredApps.map((app, idx) => (
              <motion.div
                layout
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className={`glass-card border-slate-200 dark:border-white/5 bg-white/60 dark:bg-white/5 backdrop-blur-xl group overflow-hidden ${viewMode === 'list' ? 'flex flex-col md:flex-row md:items-center p-5 gap-6' : 'p-6 flex flex-col space-y-6'}`}
              >
                {/* Job Info */}
                <div className={`flex-1 flex gap-5 items-start text-start ${viewMode === 'grid' ? 'flex-col' : ''}`}>
                  <div className={`w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg font-black text-xl`}>
                    {app.job?.company?.charAt(0) || 'C'}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-[8px] font-black text-slate-500 uppercase">{app.job?.source || 'PORTAL'}</span>
                       <span className="text-[8px] font-black text-slate-400">#NODE_{String(app.id).slice(0,6)}</span>
                    </div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase truncate group-hover:text-indigo-600 transition-colors">
                      {app.job?.title || 'Unknown Role'}
                    </h3>
                    <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 uppercase">
                      <span className="flex items-center gap-1"><Globe size={10} className="text-indigo-500" /> {app.job?.company}</span>
                      <span className="flex items-center gap-1"><MapPin size={10} className="text-fuchsia-500" /> {app.job?.location || 'Remote'}</span>
                    </div>
                  </div>
                </div>

                {/* Status Controls */}
                <div className={`flex items-center gap-4 ${viewMode === 'grid' ? 'w-full justify-between pt-4 border-t border-slate-100 dark:border-white/5' : 'md:w-auto w-full justify-end'}`}>
                   <div className="flex flex-col items-end gap-1">
                      <span className="text-[7px] font-black text-slate-400 uppercase">{t('tracker.last_update')}</span>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1"><Calendar size={10} /> {getRelativeDate(app.updated_at, t)}</span>
                   </div>
                   
                   <div className="h-8 w-[1px] bg-slate-100 dark:bg-white/10" />

                   <select 
                    value={app.status} 
                    onChange={(e) => handleStatusChange(app.id, e.target.value)}
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-[9px] font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-${statusConfig[app.status]?.color}-600 dark:text-${statusConfig[app.status]?.color}-400`}
                   >
                     {Object.entries(statusConfig).map(([key, config]) => (
                       <option key={key} value={key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{config.label}</option>
                     ))}
                   </select>

                   <button 
                    onClick={() => handleDelete(app.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </HUDLayout>
  );
}
