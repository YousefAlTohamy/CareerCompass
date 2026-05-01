import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Search, MapPin, Briefcase, Clock, DollarSign, Filter, 
  ChevronRight, Bookmark, CheckCircle2, Star, Zap, Info,
  ExternalLink, ArrowLeft, Target, Cpu, Database, Activity, RefreshCw, XCircle,
  AlertCircle, Sparkles, TrendingUp, LayoutGrid, List, Layers, ShieldCheck, Globe
} from 'lucide-react';
import { jobsAPI, gapAnalysisAPI } from '../../api/endpoints';
import applicationsAPI from '../../api/applications';
import { useTranslation } from 'react-i18next';
import HUDEmptyState from '../../components/HUDEmptyState';
import HUDLayout from '../../components/HUDLayout';
import TypingEffect from '../../components/TypingEffect';

// --- HELPER: FORMAT STRINGS ---
const formatValue = (val) => {
  if (!val) return '';
  return val.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

// --- COMPONENT: SCAN LINE ---
const ScanLine = () => (
  <motion.div 
    initial={{ top: '-10%' }}
    animate={{ top: '110%' }}
    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
    className="absolute left-0 right-0 h-[2px] bg-indigo-500/30 z-10 pointer-events-none"
    style={{ boxShadow: '0 0 10px 1px rgba(99, 102, 241, 0.4)' }}
  />
);

// --- COMPONENT: MATCH GAUGE ---
const MatchGauge = ({ score }) => {
  const color = score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-rose-500';
  
  return (
    <div className="relative group flex items-center gap-2">
      <div className="flex items-end gap-0.5">
        {[...Array(10)].map((_, i) => (
          <motion.div 
            key={i}
            initial={{ height: 2 }}
            animate={{ height: i < Math.ceil(score / 10) ? (i + 1) * 2 : 2 }}
            className={`w-0.5 rounded-full ${i < Math.ceil(score / 10) ? (score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-slate-200 dark:bg-white/5'}`}
          />
        ))}
      </div>
      <span className={`text-[8px] font-black tracking-tighter ${color} uppercase`}>{score}% SYNC</span>
    </div>
  );
};

// --- TOAST COMPONENT ---
const Toast = ({ toast, onClose }) => (
  <AnimatePresence>
    {toast.show && (
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl shadow-xl backdrop-blur-3xl border font-black text-[9px] uppercase tracking-widest flex items-center gap-2
        ${toast.type === 'error' ? 'bg-rose-500/90 text-white border-rose-400' : 'bg-slate-900/90 text-white border-white/10'}`}
      >
        {toast.type === 'error' ? <XCircle size={14} /> : <ShieldCheck size={14} className="text-emerald-400" />}
        {toast.message}
      </motion.div>
    )}
  </AnimatePresence>
);

export default function Jobs() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [gapData, setGapData] = useState(null);
  const [trackedIds, setTrackedIds] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    fetchJobs();
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [searchQuery, isRtl]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params = searchQuery ? { search: searchQuery } : { recommended: 1 };
      const response = await jobsAPI.getJobs(params);
      const data = response.data?.data || response.data || [];
      setJobs(Array.isArray(data) ? data : []);
      if (data.length > 0 && !selectedJob) handleJobSelect(data[0]);
    } catch (err) {
      console.error(err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const analyzeJobGap = async (jobId) => {
    try {
      setAnalyzing(true);
      setGapData(null);
      const response = await gapAnalysisAPI.analyzeJob(jobId);
      setGapData(response.data?.data || response.data || response);
    } catch (err) {
      console.error(err);
    } finally { 
      setAnalyzing(false); 
    }
  };

  const handleJobSelect = (job) => { 
    setSelectedJob(job); 
    analyzeJobGap(job.id); 
  };

  const handleTrackJob = async (e, job) => {
    e.stopPropagation();
    if (trackedIds.has(job.id)) return;
    try {
      await applicationsAPI.trackApplication(job.id);
      setTrackedIds((prev) => new Set(prev).add(job.id));
      showToast(`${t('jobs.already_tracked')} 📌`);
    } catch (err) { 
      showToast(t('jobs.error_save'), 'error'); 
    }
  };

  const jobSourceLabel = useMemo(() => (source) => {
    if (!source) return 'CORE_SYS';
    const cleanSource = source.toLowerCase().includes('linkedin') ? 'linkedin' : source;
    return t(`jobs.source_label.${cleanSource}`, { defaultValue: formatValue(source) });
  }, [t]);

  return (
    <HUDLayout loading={loading} loadingType="standard">
      <Toast toast={toast} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-12 relative z-10">
        
        {/* --- CONSISTENT HERO HEADER --- */}
        <div className="relative">
          <div className="absolute -top-16 -left-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
             <div className="space-y-4 text-start flex-1">
                <div className="flex items-center gap-3">
                   <div className="flex -space-x-1.5">
                      {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />)}
                   </div>
                   <span className="micro-typography text-indigo-600 dark:text-indigo-400 font-black tracking-[0.2em] uppercase text-[9px]">Market Scan // active_sync</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white uppercase italic">
                   {t('nav.jobs')} <span className="text-indigo-600 dark:text-indigo-400">Command</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-base font-medium max-w-lg leading-relaxed">
                   {t('jobs.subtitle', 'Scanning global job market with advanced neural matching algorithms.')}
                </p>

                <form onSubmit={(e) => { e.preventDefault(); setSearchQuery(inputValue); }} className="relative group max-w-xl">
                   <div className="absolute inset-y-0 start-6 flex items-center pointer-events-none">
                      <Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                   </div>
                   <input 
                      type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                      placeholder={t('jobs.search_placeholder', 'Search roles, skills...')}
                      className="w-full bg-white/60 dark:bg-slate-900/40 border-2 border-slate-200 dark:border-white/5 ps-16 pe-32 py-4 rounded-2xl font-bold text-sm placeholder:text-slate-400 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all shadow-lg text-start"
                   />
                   <button type="submit" className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-indigo-500/20`}>
                      {t('jobs.search_button', 'Scan')}
                   </button>
                </form>
             </div>

             <div className="hidden lg:block w-48 h-48 relative">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-3xl rotate-6 border border-indigo-500/20 animate-pulse" />
                <div className="relative h-full w-full glass-card !rounded-3xl border-white/10 flex flex-col items-center justify-center gap-2 text-center bg-white/30 dark:bg-white/5 backdrop-blur-xl">
                   <Activity className="text-indigo-500" size={32} />
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Global Flow</p>
                   <p className="text-xl font-black text-slate-800 dark:text-white leading-none tabular-nums">12.4k</p>
                </div>
             </div>
          </div>
        </div>

        {/* --- MAIN INTERFACE --- */}
        <div className="grid lg:grid-cols-12 gap-8 items-start min-h-[800px]">
            
            {/* MANIFEST (Left) */}
            <div className="lg:col-span-4 space-y-4">
               <div className="flex items-center justify-between px-2">
                  <h3 className="micro-typography text-slate-500 font-black tracking-[0.2em] uppercase text-[9px]">{t('jobs.manifest', 'MANIFEST')} [{jobs.length}]</h3>
                  <Filter size={14} className="text-slate-400" />
               </div>

               <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {jobs.length === 0 ? (
                      <HUDEmptyState 
                        icon={Search}
                        title={t('jobs.no_results_criteria', 'No Signals Detected')}
                        description={t('common.no_data_desc')}
                      />
                    ) : jobs.map((job, idx) => (
                      <motion.div 
                        key={job.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => handleJobSelect(job)} 
                        className={`group p-4 glass-card border-2 cursor-pointer transition-all relative overflow-hidden flex flex-col gap-3
                        ${selectedJob?.id === job.id 
                          ? 'bg-indigo-50/40 dark:bg-indigo-500/5 border-indigo-500 shadow-md shadow-indigo-500/5' 
                          : 'bg-white/50 dark:bg-slate-900/30 border-slate-100 dark:border-white/5 hover:border-indigo-500/30 hover:bg-white/80 dark:hover:bg-slate-800/40'}`}
                      >
                         {selectedJob?.id === job.id && <ScanLine />}
                         <div className="flex justify-between items-start text-start">
                            <div className="space-y-1 flex-1">
                               <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">{jobSourceLabel(job.source)}</span>
                               <h3 className="text-sm font-black tracking-tight uppercase leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">{job.title}</h3>
                               <p className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] tracking-tight">{job.company}</p>
                            </div>
                         </div>
                         <div className="flex flex-wrap items-center gap-3 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                            <span className="flex items-center gap-1"><MapPin size={10} className="text-indigo-500" /> {job.location || 'Remote'}</span>
                            <span className="flex items-center gap-1"><Clock size={10} className="text-fuchsia-500" /> {job.job_type ? formatValue(job.job_type).slice(0,4) : 'SYNC'}</span>
                         </div>
                         <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                            <MatchGauge score={job.match_score || 0} />
                         </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
               </div>
            </div>

            {/* DATA CORE (Right - Sticky & Taller) */}
            <div className="lg:col-span-8 sticky top-32">
               <AnimatePresence mode="wait">
                  {selectedJob ? (
                    <motion.div 
                      key={selectedJob.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="glass-card border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-3xl overflow-hidden flex flex-col shadow-2xl !rounded-[2.5rem] border-2 h-[calc(100vh-160px)] min-h-[700px]"
                    >
                       {/* Slim Header */}
                       <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-indigo-500/5 shrink-0">
                          <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
                             <div className="text-start space-y-3 flex-1">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center border border-slate-100 dark:border-white/10 font-black text-indigo-600 dark:text-indigo-400 text-lg">
                                      {selectedJob.company.charAt(0)}
                                   </div>
                                   <div>
                                      <h4 className="text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-tight">{selectedJob.company}</h4>
                                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">ID: {String(selectedJob.id).slice(0,10)}</p>
                                   </div>
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-none uppercase italic tracking-tighter">{selectedJob.title}</h2>
                                <div className="flex flex-wrap gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                   <span className="flex items-center gap-1.5"><MapPin size={12} className="text-indigo-500" /> {selectedJob.location || 'Remote'}</span>
                                   <span className="flex items-center gap-1.5"><Briefcase size={12} className="text-fuchsia-500" /> {formatValue(selectedJob.job_type)}</span>
                                   {selectedJob.work_type && <span className="flex items-center gap-1.5"><Layers size={12} className="text-amber-500" /> {formatValue(selectedJob.work_type)}</span>}
                                   {selectedJob.experience && <span className="flex items-center gap-1.5"><TrendingUp size={12} className="text-rose-500" /> {selectedJob.experience}</span>}
                                   <span className="flex items-center gap-1.5 text-emerald-500"><DollarSign size={12} /> {selectedJob.salary_range || selectedJob.salary || 'Competitive'}</span>
                                </div>
                             </div>
                             <div className="flex md:flex-col gap-3 shrink-0">
                                {selectedJob.url && (
                                  <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2">
                                     <ExternalLink size={14} /> {t('jobs.apply_button', 'Apply')}
                                  </a>
                                )}
                                <button 
                                  onClick={(e) => handleTrackJob(e, selectedJob)}
                                  className={`px-6 py-3 border-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${trackedIds.has(selectedJob.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 dark:border-white/10 text-slate-400 hover:text-indigo-500'}`}
                                >
                                   {trackedIds.has(selectedJob.id) ? <CheckCircle2 size={14} /> : <Bookmark size={14} />}
                                   {trackedIds.has(selectedJob.id) ? t('jobs.already_tracked') : t('jobs.save_button')}
                                </button>
                             </div>
                          </div>
                       </div>

                       {/* Content Area */}
                       <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar text-start bg-white/30 dark:bg-transparent">
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                             <div className="md:col-span-3 glass-card !rounded-2xl p-6 border-indigo-500/10 bg-indigo-500/5 dark:bg-indigo-900/5 flex items-center gap-6 shadow-sm">
                                <div className="relative w-16 h-16 shrink-0">
                                   <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-white/5" />
                                      <motion.circle 
                                        initial={{ strokeDashoffset: 283 }}
                                        animate={{ strokeDashoffset: 283 - (selectedJob.match_score / 100) * 283 }}
                                        cx="50" cy="50" r="45" fill="none" strokeWidth="12" strokeLinecap="round" 
                                        strokeDasharray="283" className="stroke-indigo-500"
                                      />
                                   </svg>
                                   <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-slate-900 dark:text-white">
                                      {selectedJob.match_score}%
                                   </div>
                                </div>
                                <div className="space-y-1">
                                   <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('gap_analysis.neural_alignment')}</h4>
                                   <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Synced with your neural profile data.</p>
                                </div>
                             </div>
                             <div className="glass-card !rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm">
                                <TrendingUp size={24} className="text-fuchsia-500" />
                                <p className="text-xs font-black uppercase italic">Hot_Opp</p>
                             </div>
                          </div>

                          <div className="space-y-4">
                             <div className="flex items-center gap-2">
                                <Sparkles className="text-indigo-500" size={16} />
                                <h4 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em]">AI_SYNTHESIS</h4>
                                <div className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
                             </div>

                             {analyzing ? (
                               <div className="p-8 glass-card !rounded-2xl bg-slate-50 dark:bg-white/5 animate-pulse h-24" />
                             ) : gapData && (
                               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                  <div className="p-6 glass-card !rounded-2xl border-indigo-500/20 bg-indigo-500/5 text-sm text-slate-700 dark:text-indigo-100 leading-relaxed italic font-medium">
                                     <TypingEffect text={gapData.summary || 'Summary loading...'} speed={5} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-6">
                                     <div className="space-y-3">
                                        <h5 className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1.5"><ShieldCheck size={16} /> Matched</h5>
                                        <div className="flex flex-wrap gap-1.5">
                                           {(gapData.matched_skills || []).map((s, i) => (
                                             <span key={i} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-lg uppercase">{s}</span>
                                           ))}
                                        </div>
                                     </div>
                                     <div className="space-y-3">
                                        <h5 className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-1.5"><AlertCircle size={16} /> Gaps</h5>
                                        <div className="flex flex-wrap gap-1.5">
                                           {(gapData.critical_skills || []).map((s, i) => (
                                             <span key={i} className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[8px] font-black rounded-lg uppercase">{s}</span>
                                           ))}
                                        </div>
                                     </div>
                                  </div>
                                  <button onClick={() => navigate(`/gap-analysis/${selectedJob.id}`)} className="w-full py-4 glass-card !rounded-2xl border-indigo-500/40 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                     {t('jobs.view_detailed_report', 'View Detailed Neural Report')} <ChevronRight size={16} />
                                  </button>
                               </motion.div>
                             )}
                          </div>

                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                             <div className="flex items-center gap-2">
                                <Cpu className="text-indigo-500" size={16} />
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">EXTRACTED_SKILLS</h4>
                             </div>
                             {selectedJob.skills && selectedJob.skills.length > 0 ? (
                               <div className="flex flex-wrap gap-2">
                                  {selectedJob.skills.map((skill, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-xl uppercase tracking-wider shadow-sm">
                                      {skill.name}
                                    </span>
                                  ))}
                               </div>
                             ) : (
                               <p className="text-xs text-slate-500 font-medium">No explicit skills mapped yet.</p>
                             )}
                          </div>

                          {selectedJob.requirements && (
                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                             <div className="flex items-center gap-2">
                                <Target className="text-fuchsia-500" size={16} />
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">REQUIREMENTS</h4>
                             </div>
                             <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium bg-fuchsia-50/50 dark:bg-fuchsia-900/5 p-6 rounded-3xl border border-fuchsia-100 dark:border-fuchsia-500/10">
                                {selectedJob.requirements}
                             </div>
                          </div>
                          )}

                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                             <div className="flex items-center gap-2">
                                <Info className="text-slate-400" size={16} />
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">INTEL_DESCRIPTION</h4>
                             </div>
                             <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                                {selectedJob.description}
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  ) : (
                    <div className="glass-card border-2 border-dashed border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-center p-20 !rounded-[2.5rem] opacity-40 h-[700px]">
                       <Database size={48} className="text-indigo-500 mb-4" strokeWidth={1} />
                       <h3 className="text-sm font-black uppercase tracking-tighter mb-1">Initialization Required</h3>
                       <p className="max-w-xs text-[10px] font-medium text-slate-500">Select an entry from the manifest to begin.</p>
                    </div>
                  )}
               </AnimatePresence>
            </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
        .ltr { direction: ltr !important; }
      `}} />
    </HUDLayout>
  );
}