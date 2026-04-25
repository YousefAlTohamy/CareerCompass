import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import { 
  Briefcase, 
  Search, 
  Trash2, 
  Eye, 
  MapPin, 
  Building2,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Timer,
  AlertTriangle,
  Info,
  X,
  RefreshCw
} from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const AdminJobs = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // DLQ Modal State
  const [dlqOpen, setDlqOpen] = useState(false);
  const [dlqData, setDlqData] = useState(null);
  const [dlqLoading, setDlqLoading] = useState(false);
  const [dlqRetrying, setDlqRetrying] = useState(false);

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
        setJobs(response.data.data.data);
        setTotalPages(response.data.data.last_page || 1);
        setCurrentPage(response.data.data.current_page || 1);
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
      title: 'Decommission Job Record?',
      text: "This operation will purge the job from the neural index. This action is irreversible.",
      icon: 'warning',
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#334155',
      confirmButtonText: 'Confirm Purge'
    });

    if (result.isConfirmed) {
      try {
        await adminAPI.deleteJob(id);
        setJobs((prev) => prev.filter((j) => j.id !== id));
        if (jobs.length === 1 && currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        } else {
            fetchJobs();
        }
      } catch (err) {
        console.error('Failed to delete job:', err);
      }
    }
  };

  return (
    <HUDLayout loading={loading}>
      <div className="p-6 max-w-7xl mx-auto pb-20 space-y-10 pt-28">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-emerald-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-500">{t('admin.market_feed')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
              {t('nav.jobs')} <span className="text-emerald-600 dark:text-emerald-400">{t('admin.inbound_flow')}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm font-medium max-w-lg">
              {t('dashboard.market')}
            </p>
    <>
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
            <Briefcase className="w-7 h-7" />
          </div>

          <div className="relative group w-full md:w-96">
            <div className="absolute inset-0 bg-emerald-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative flex items-center bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl px-5 py-3">
              <i className="ph-thin ph-magnifying-glass text-slate-400 text-xl mr-3" />
              <input
                type="text"
                placeholder={t('jobs.search_placeholder')}
                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 dark:text-white font-medium placeholder-slate-400 text-sm"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
        </motion.div>

        {/* Table Container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] shadow-premium overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/10">
                  <th className="p-6">{t('admin.occupational_stream')}</th>
                  <th className="p-6">{t('jobs.source')}</th>
                  <th className="p-6">{t('admin.skill_chips')}</th>
                  <th className="p-6 text-right">{t('admin.access_protocols')}</th>
      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-5 w-1/3">Job Details</th>
                <th className="p-5">Source</th>
                <th className="p-5">{t('admin_jobs.col_discovered')}</th>
                <th className="p-5">{t('admin_jobs.col_failed')}</th>
                <th className="p-5">{t('admin_jobs.col_duration')}</th>
                <th className="p-5">{t('admin_jobs.col_success_rate')}</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && jobs.length === 0 ? (
                 <tr>
                 <td colSpan="7" className="p-12 text-center">
                   <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                     <p className="font-medium text-sm">Loading jobs...</p>
                   </div>
                 </td>
               </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <Briefcase className="w-12 h-12 text-slate-300 stroke-1" />
                      <p className="font-medium text-sm text-slate-500">No jobs found in the database.</p>
                      {activeSearch && <p className="text-xs">Try adjusting your search criteria.</p>}
                    </div>
                  </td>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {jobs.map((job, idx) => (
                    <motion.tr 
                      key={job.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group hover:bg-white/40 dark:hover:bg-white/5 transition-all duration-300"
                    >
                      <td className="p-6">
                        <div className="flex flex-col">
                          <div className="font-black text-slate-900 dark:text-white text-sm group-hover:text-emerald-500 transition-colors line-clamp-1">{job.title}</div>
                          <div className="flex items-center gap-3 mt-2">
                             <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                               <i className="ph-fill ph-buildings" /> {job.company || 'UNKNOWN_CORP'}
                             </span>
                             <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                             <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                               <i className="ph-fill ph-map-pin" /> {job.location || 'REMOTE_NODE'}
                             </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm">
                          <i className="ph-fill ph-link-simple text-indigo-500 text-xs" />
                          <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{job.source || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                          {job.skills && job.skills.length > 0 ? (
                            <>
                              {job.skills.slice(0, 3).map((skill, sIdx) => (
                                <span 
                                  key={sIdx} 
                                  className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md text-[9px] font-black uppercase tracking-tighter"
                                >
                                  {skill.name}
                                </span>
                              ))}
                              {job.skills.length > 3 && (
                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-400 rounded-md text-[9px] font-black">
                                  +{job.skills.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[9px] font-mono text-slate-400 opacity-50 uppercase tracking-widest">// NO_SKILLS_EXTRACTED</span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => navigate(`/admin/jobs/${job.id}`)}
                            className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-all"
                            title="Inspect Opportunity"
                          >
                            <i className="ph-thin ph-eye text-xl" />
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-all"
                            title="Purge Record"
                          >
                            <i className="ph-thin ph-trash text-xl" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
                      </div>
                    </td>

                    {/* Source Column */}
                    <td className="p-5">
                       <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                           <LinkIcon size={12} />
                         </div>
                         <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                           {job.source || 'Unknown'}
                         </span>
                       </div>
                    </td>

                    {/* Metrics Columns */}
                    <td className="p-5">
                      <span className="text-sm font-bold text-slate-700">
                        {job.discovered_count ?? 0}
                      </span>
                    </td>

                    <td className="p-5">
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-bold ${(job.failed_count ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {(job.failed_count ?? 0) > 0 && <AlertTriangle size={12} className="inline-block mr-1" />}
                          {job.failed_count ?? 0}
                        </span>
                        {(job.failed_count ?? 0) > 0 && (
                          <button
                            onClick={async () => {
                              setDlqOpen(true);
                              setDlqLoading(true);
                              setDlqData(null);
                              try {
                                const res = await adminAPI.getFailedUrls(job.id);
                                if (res.data && res.data.success) {
                                  setDlqData(res.data.data);
                                }
                              } catch (err) {
                                console.error('Failed to fetch DLQ:', err);
                              } finally {
                                setDlqLoading(false);
                              }
                            }}
                            className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title={t('admin_jobs.view_failures')}
                          >
                            <Info size={14} />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="p-5">
                      <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
                        <Timer size={12} className="text-slate-400" />
                        {job.processing_time_ms ? `${(job.processing_time_ms / 1000).toFixed(1)}s` : '—'}
                      </span>
                    </td>

                    <td className="p-5">
                      {(() => {
                        const discovered = job.discovered_count ?? 0;
                        const failed = job.failed_count ?? 0;
                        const total = discovered + failed;
                        if (total === 0) return <span className="text-xs text-slate-400">—</span>;
                        const rate = Math.round((discovered / total) * 100);
                        const color = rate > 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-black ${color}`}>
                            {rate}%
                          </span>
                        );
                      })()}
                    </td>

                    {/* Status Column Removed */}

                    {/* Actions Column */}
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/admin/jobs/${job.id}`)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

          {/* Pagination */}
          <div className="p-6 border-t border-white/5 flex items-center justify-between bg-slate-100/30 dark:bg-white/5 backdrop-blur-xl">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
               Data Stream {currentPage} of {totalPages}
             </div>
             <div className="flex items-center gap-3">
               <button
                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                 disabled={currentPage <= 1 || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-emerald-500 disabled:opacity-30 transition-all"
               >
                 <i className="ph-bold ph-caret-left" /> Back
               </button>
               <button
                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                 disabled={currentPage >= totalPages || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-emerald-500 disabled:opacity-30 transition-all"
               >
                 Next <i className="ph-bold ph-caret-right" />
               </button>
             </div>
          </div>
        </motion.div>
      </div>
    </HUDLayout>
    </div>

    {/* DLQ Modal */}
    {dlqOpen && (
      <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden border border-slate-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
            <h2 className="text-lg font-bold text-slate-800">
              {t('admin_jobs.dlq_title')}
            </h2>
            <button
              onClick={() => setDlqOpen(false)}
              className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {dlqLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : dlqData && dlqData.failed_urls && dlqData.failed_urls.length > 0 ? (
              <div className="space-y-3">
                {dlqData.failed_urls.map((item) => (
                  <div key={item.id} className={`p-4 rounded-xl border ${item.retried ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-rose-50/50 border-rose-100'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-slate-700 truncate" title={item.url}>
                          {item.url}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">
                            <AlertTriangle size={10} />
                            {item.reason}
                          </span>
                          {item.source_name && (
                            <span className="text-[11px] font-medium text-slate-500">
                              {t('admin_jobs.dlq_source')}: {item.source_name}
                            </span>
                          )}
                          {item.retried && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {t('admin_jobs.dlq_retried')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                <AlertTriangle size={32} className="text-slate-300" />
                <p className="text-sm font-medium">{t('admin_jobs.dlq_no_failures')}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <button
              onClick={() => setDlqOpen(false)}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition-colors text-sm"
            >
              {t('admin_jobs.dlq_close')}
            </button>
            {dlqData && dlqData.failed_urls && dlqData.failed_urls.filter(u => !u.retried).length > 0 && (
              <button
                disabled={dlqRetrying}
                onClick={async () => {
                  setDlqRetrying(true);
                  try {
                    const ids = dlqData.failed_urls.filter(u => !u.retried).map(u => u.id);
                    await adminAPI.retryFailedUrls(ids);
                    // Update local state
                    setDlqData(prev => ({
                      ...prev,
                      failed_urls: prev.failed_urls.map(u => ({ ...u, retried: true }))
                    }));
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: t('admin_jobs.dlq_retry_success'), showConfirmButton: false, timer: 2000 });
                  } catch (err) {
                    Swal.fire({ icon: 'error', title: t('admin_jobs.dlq_retry_error'), confirmButtonColor: '#6366f1' });
                  } finally {
                    setDlqRetrying(false);
                  }
                }}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                  dlqRetrying
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                }`}
              >
                <RefreshCw size={14} className={dlqRetrying ? 'animate-spin' : ''} />
                {t('admin_jobs.dlq_retry_all')}
              </button>
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default AdminJobs;