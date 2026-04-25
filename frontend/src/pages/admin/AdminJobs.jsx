import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const AdminJobs = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

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
  );
};

export default AdminJobs;