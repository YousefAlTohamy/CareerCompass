import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import { 
  Search, 
  Trash2, 
  MapPin, 
  AlertTriangle,
  Info,
  X,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';

const sourceLabel = (job) => (
  job?.scraping_source?.name
  || job?.scrapingSource?.name
  || job?.source_label
  || job?.source
  || 'Unknown source'
);

const displayValue = (value, fallback = 'Not recorded') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const AdminJobs = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.dir() === 'rtl';
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // DLQ Modal State
  const [dlqOpen, setDlqOpen] = useState(false);

  // Pagination & Search State (URL Synced)
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page')) || 1;
  const initialSearch = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAdminJobs(currentPage, activeSearch);
      if (response.data && response.data.success) {
        const data = response.data.data?.data || response.data.data || [];
        setJobs(Array.isArray(data) ? data : []);
        setTotalPages(response.data.data?.last_page || 1);
        setCurrentPage(response.data.data?.current_page || 1);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error('Failed to fetch admin jobs:', err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, activeSearch]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchInput !== activeSearch) {
        setActiveSearch(searchInput);
        setCurrentPage(1);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput, activeSearch]);

  useEffect(() => {
    const params = {};
    if (currentPage > 1) params.page = currentPage;
    if (activeSearch) params.search = activeSearch;
    setSearchParams(params, { replace: true });
  }, [currentPage, activeSearch, setSearchParams]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: t('admin.actions.purge_job'),
      text: t('admin.actions.irreversible'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#334155',
      confirmButtonText: t('admin.actions.confirm_purge'),
      cancelButtonText: t('sources.cancel')
    });

    if (result.isConfirmed) {
      try {
        await adminAPI.deleteAdminJob(id);
        setJobs(prev => prev.filter(j => j.id !== id));
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: t('sources.swal_deleted'),
          showConfirmButton: false,
          timer: 2000
        });
      } catch (err) {
        console.error('Failed to delete job:', err);
      }
    }
  };

  const fetchDLQ = () => {
    setDlqOpen(true);
  };

  return (
    <HUDLayout loading={loading}>
      <div className="p-6 max-w-7xl mx-auto pb-20 space-y-10 pt-28">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">{t('admin.stats.jobs')}</h1>
            <p className="text-slate-500 font-mono text-sm tracking-widest uppercase">// IMPORTED_JOB_INDEX</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
              <input 
                type="text"
                placeholder={t('mentorship.search')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 ${isRtl ? 'pr-12 pl-4' : 'ps-12 pe-4'} py-3.5 rounded-2xl text-slate-900 dark:text-white outline-none focus:border-indigo-500 dark:focus:border-[var(--cc-primary)] shadow-sm transition-all`}
              />
            </div>
            <button 
              onClick={fetchDLQ}
              className="w-full sm:w-auto px-6 py-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-2xl transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest"
            >
              <AlertTriangle size={14} />
              DLQ Monitor
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="glass-card overflow-hidden border-slate-200 dark:border-white/5 rounded-3xl shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4 text-start">{t('admin.stats.jobs')}</th>
                  <th className="px-6 py-4 text-start">{t('jobs.company')}</th>
                  <th className="px-6 py-4 text-start">{t('jobs.location')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.status')}</th>
                  <th className="px-6 py-4 text-end">{t('admin.operations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode='popLayout'>
                  {jobs.map((job) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={job.id} 
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-[var(--cc-primary)] transition-colors">{displayValue(job.title, 'Untitled job')}</span>
                          <span className="text-[10px] font-mono text-slate-500 mt-0.5">{sourceLabel(job)} • {String(job.id).substring(0, 13)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm font-medium">{displayValue(job.company, 'Unknown company')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                          <MapPin size={12} className="text-indigo-500 dark:text-[var(--cc-primary)]" />
                          {displayValue(job.location, 'Not specified')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                           <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">INDEXED</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => navigate(`/admin/jobs/${job.id}`)}
                            className="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/10 dark:hover:bg-[var(--cc-primary)]/20 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-[var(--cc-primary)] rounded-lg transition-all"
                          >
                            <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
                          </button>
                          <button 
                            onClick={() => handleDelete(job.id)}
                            className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                {t('common.page')} {currentPage} / {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ArrowLeft size={18} className={isRtl ? 'rotate-180' : ''} />
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DLQ Modal */}
        {dlqOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
              onClick={() => setDlqOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-500">
                    <AlertTriangle size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('admin.stats.dlq_monitor')}</h2>
                </div>
                <button onClick={() => setDlqOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-500">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                    <div className="flex items-center gap-2 mb-3 text-amber-500">
                      <Info size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{t('admin.demo_safe_note', 'Demo-safe note')}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {t(
                        'admin.jobs_dlq_unavailable',
                        'Failed URL retry is scoped to scraping batches from the Admin Sources diagnostics screen. Use Admin Sources to inspect failed source URLs during the graduation demo.'
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setDlqOpen(false);
                      navigate('/admin/sources');
                    }}
                    className="w-full py-4 bg-white text-slate-950 font-black uppercase tracking-widest rounded-2xl shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3"
                  >
                    {t('admin.stats.sources')}
                    <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </HUDLayout>
  );
};

export default AdminJobs;
