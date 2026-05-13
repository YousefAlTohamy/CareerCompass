import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getAllSources,
  createSource,
  updateSource,
  deleteSource,
  toggleSourceStatus,
  testSources,
  runFullScraping,
  getScrapingStatuses,
  testSingleSource
} from "../../api/scrapingSources";
import HUDLayout from "../../components/HUDLayout";
import {
  Plus,
  Play,
  Trash2,
  Edit,
  Activity,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Search,
  Link as LinkIcon,
  ArchiveX,
  Terminal,
  Radar,
  BookmarkMinus,
  HeartPulse,
} from "lucide-react";
import Swal from "sweetalert2";
import { motion, AnimatePresence } from 'framer-motion';

const getErrorMessage = (error, defaultMessage = "An unexpected error occurred.") => {
  if (error.response?.data?.errors) return Object.values(error.response.data.errors).flat().join("\n");
  if (error.response?.data?.message) return error.response.data.message;
  return defaultMessage;
};

const AdminSources = () => {
  const { t, i18n } = useTranslation();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  
  const [testResult, setTestResult] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [statuses, setStatuses] = useState({});

  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page')) || 1;
  const initialSearch = searchParams.get('search') || '';

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [activeSearch, setActiveSearch] = useState(initialSearch);

  const [formData, setFormData] = useState({
    name: "",
    type: "api",
    endpoint: "",
    method: "GET",
    headers: "{}",
    params: "{}",
    is_active: true,
    mode: "static",
    pattern: "",
  });

  useEffect(() => {
    const isAnyModalOpen = isModalOpen || isTestModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '8px';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    };
  }, [isModalOpen, isTestModalOpen]);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const sourcesRes = await getAllSources(currentPage, activeSearch);
      if (sourcesRes.data) {
          const data = sourcesRes.data.data || sourcesRes.data || [];
          const meta = sourcesRes.data.meta || sourcesRes.meta || {};
          
          setSources(Array.isArray(data) ? data : []);
          setTotalPages(meta.last_page || sourcesRes.last_page || 1);
          setCurrentPage(meta.current_page || sourcesRes.current_page || 1);
      } else {
          setSources([]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setSources([]);
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
    fetchAllData();
  }, [currentPage, activeSearch, fetchAllData]);

  useEffect(() => {
    let interval;
    const fetchStatuses = async () => {
      try {
        const res = await getScrapingStatuses();
        if (res.data) {
           setStatuses(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch statuses:", err);
      }
    };

    fetchStatuses();
    interval = setInterval(fetchStatuses, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleTestAll = async () => {
    setTesting(true);
    setTestResult(null);
    setIsTestModalOpen(true);
    
    try {
      const result = await testSources();
      setTestResult(result.data || result);
    } catch (error) {
      setTestResult({
        success: false,
        output:
          error.response?.data?.output ||
          error.message ||
          t('sources.test_unknown_error'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestSingle = async (id) => {
    setTesting(true);
    setTestResult(null);
    setIsTestModalOpen(true);
    
    try {
      const result = await testSingleSource(id);
      setTestResult(result.data || result);
    } catch (error) {
      setTestResult({
        success: false,
        output:
          error.response?.data?.output ||
          error.message ||
          t('sources.test_unknown_error'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRunScraping = async () => {
    const result = await Swal.fire({
      title: t('sources.swal_run_title'),
      text: t('sources.swal_run_text'),
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#334155",
      confirmButtonText: t('sources.swal_run_confirm'),
    });

    if (!result.isConfirmed) return;

    try {
      await runFullScraping();
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: "success",
        title: t('sources.swal_run_success_title'),
        showConfirmButton: false,
        timer: 3000
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: t('sources.swal_error'),
        text: getErrorMessage(error, t('sources.swal_run_error')),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const handleToggleStatus = async (id) => {
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !s.is_active } : s));
    try {
      const response = await toggleSourceStatus(id);
      const updated = response.data || response;
      setSources((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (error) {
      console.error(error);
      setSources((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !s.is_active } : s));
      Swal.fire({
        icon: "error",
        title: t('sources.swal_error'),
        text: getErrorMessage(error, t('sources.swal_toggle_error')),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: t('sources.swal_delete_title'),
      text: t('sources.swal_delete_text'),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#334155",
      confirmButtonText: t('sources.swal_delete_confirm'),
    });

    if (!result.isConfirmed) return;

    try {
      await deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: t('sources.swal_deleted'),
        showConfirmButton: false,
        timer: 2000,
      });
      if (sources.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
      } else {
          fetchAllData();
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: t('sources.swal_error'),
        text: getErrorMessage(error, t('sources.swal_delete_error')),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const handleOpenModal = (source = null) => {
    if (source) {
      setEditingSource(source);
      setFormData({
        name: source.name,
        type: source.type,
        endpoint: source.endpoint,
        method: source.method,
        headers: JSON.stringify(source.headers || {}, null, 2),
        params: JSON.stringify(source.params || {}, null, 2),
        is_active: source.is_active,
        mode: source.mode || "static",
        pattern: source.pattern || "",
      });
    } else {
      setEditingSource(null);
      setFormData({
        name: "",
        type: "api",
        endpoint: "",
        method: "GET",
        headers: "{}",
        params: "{}",
        is_active: true,
        mode: "static",
        pattern: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let parsedHeaders = {};
      let parsedParams = {};
      try {
        parsedHeaders = JSON.parse(formData.headers);
        parsedParams = JSON.parse(formData.params);
      } catch (jsonErr) {
        Swal.fire({ icon: "error", title: "Invalid JSON", text: "Please ensure headers and parameters are valid JSON." });
        return;
      }

      if (formData.mode === "discovery" && formData.pattern) {
        try {
          new RegExp(formData.pattern);
        } catch (regexError) {
          Swal.fire({
            icon: "error",
            title: t('sources.swal_invalid_pattern_title'),
            text: t('sources.swal_invalid_pattern_text', { message: regexError.message }),
            confirmButtonColor: "#6366f1",
          });
          return;
        }
      }

      const payload = {
        ...formData,
        headers: parsedHeaders,
        params: parsedParams,
      };

      if (editingSource) {
        const response = await updateSource(editingSource.id, payload);
        const updated = response.data || response;
        setSources((prev) => prev.map((s) => (s.id === editingSource.id ? updated : s)));
        Swal.fire({ toast: true, position: "top-end", icon: "success", title: t('sources.swal_updated'), showConfirmButton: false, timer: 2000 });
      } else {
        const response = await createSource(payload);
        const created = response.data || response;
        setSources((prev) => [created, ...prev]);
        Swal.fire({ toast: true, position: "top-end", icon: "success", title: t('sources.swal_added'), showConfirmButton: false, timer: 2000 });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Save error:", error);
      Swal.fire({
        icon: "error",
        title: t('sources.swal_save_failed'),
        text: getErrorMessage(error, t('sources.swal_save_error')),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const getModeColor = (mode) => {
    return mode === "discovery"
      ? "bg-violet-100 text-violet-700"
      : "bg-cyan-100 text-cyan-700";
  };

  const getHealthColor = (score) => {
    if (score > 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
    if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' };
    return { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50' };
  };

  return (
    <HUDLayout loading={loading}>
      <div className="p-6 max-w-7xl mx-auto pb-20 space-y-10 pt-28">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-fuchsia-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-500">{t('admin.inbound_flow')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
              {t('nav.admin_sources')} <span className="text-fuchsia-600 dark:text-fuchsia-400">{t('admin.neural_matrix')}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm font-medium max-w-lg">
              {t('dashboard.market')}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
             <button
               onClick={handleRunScraping}
               className="flex items-center gap-2 px-6 py-3 bg-fuchsia-600 text-white rounded-2xl hover:bg-fuchsia-700 transition-all shadow-premium text-[11px] font-black uppercase tracking-widest shrink-0"
             >
               <Play size={16} />
               Run Extractions
             </button>
             <button
               onClick={handleTestAll}
               className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-premium text-[11px] font-black uppercase tracking-widest shrink-0"
             >
               <Terminal size={16} />
               Diagnostics
             </button>
             <button
               onClick={() => handleOpenModal()}
               className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-premium text-[11px] font-black uppercase tracking-widest shrink-0"
             >
               <Plus size={16} />
               Node
             </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative group max-w-2xl"
        >
          <div className="absolute inset-0 bg-fuchsia-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-white dark:bg-slate-950/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 shadow-sm">
            <Search className="text-slate-400 mr-3" size={20} />
            <input
              type="text"
              placeholder="Filter ingestion sources by name, URL, or type..."
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-800 dark:text-white font-medium placeholder-slate-400 text-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-950/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[32px] shadow-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-200 dark:border-white/10">
                  <th className="p-6">{t('admin.node_config', 'Node Config')}</th>
                  <th className="p-6">{t('admin.protocols', 'Protocols')}</th>
                  <th className="p-6">{t('admin.endpoint_access', 'Endpoint Access')}</th>
                  <th className="p-6">{t('sources.col_health', 'Ingestion Health')}</th>
                  <th className="p-6 text-center">{t('admin.neural_state', 'Neural State')}</th>
                  <th className="p-6 text-right">{t('admin.operations', 'Operations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {sources.length === 0 ? (
                    <motion.tr key="empty">
                      <td colSpan="6" className="p-20 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 space-y-4">
                          <Activity className="text-6xl opacity-20" size={64} />
                          <p className="font-bold uppercase tracking-widest text-xs">{t('sources.no_sources')}</p>
                        </div>
                      </td>
                    </motion.tr>
                  ) : (
                    sources.map((source, idx) => (
                      <motion.tr 
                        key={source.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-white/40 dark:hover:bg-white/5 transition-all duration-300"
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            {statuses[source.id]?.is_scraping ? (
                              <div className="relative flex items-center justify-center w-10 h-10">
                                 <div className="absolute inset-0 rounded-xl bg-fuchsia-500/20 animate-ping" />
                                 <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)] z-10">
                                    <Activity size={20} className="animate-pulse" />
                                 </div>
                              </div>
                            ) : (
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${source.is_active ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-500' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400'}`}>
                                 <Activity size={24} />
                              </div>
                            )}
                            <div>
                              <div className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                {source.name}
                                {statuses[source.id]?.is_scraping && (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-fuchsia-500 text-white animate-pulse">
                                    {statuses[source.id]?.count || 0} JOBS
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{source.type}_PROTOCOL</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-6">
                          <div className="flex flex-col gap-2">
                            <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-black border ${
                              source.method === 'GET' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {source.method}
                            </span>
                            <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-black border ${getModeColor(source.mode)}`}>
                              {source.mode || 'static'}
                            </span>
                          </div>
                        </td>

                        <td className="p-6">
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 truncate max-w-[200px]" title={source.endpoint}>
                            {source.endpoint}
                          </div>
                        </td>

                        <td className="p-6">
                           {(() => {
                            const score = source.health_score ?? null;
                            if (score === null) return <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('sources.health_na', 'N/A')}</span>;
                            const colors = source.is_active ? getHealthColor(score) : { bar: 'bg-slate-300', text: 'text-slate-400', bg: 'bg-slate-50/10' };
                            return (
                              <div className="flex items-center gap-2">
                                <div className={`flex-1 h-1 rounded-full ${colors.bg} max-w-[60px] overflow-hidden`}>
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(score, 100)}%` }}
                                    className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                                  />
                                </div>
                                <span className={`text-[10px] font-black font-mono ${colors.text}`}>
                                  {score}%
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="p-6 text-center">
                           <button
                                onClick={() => handleToggleStatus(source.id)}
                                className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  source.is_active ? 'bg-fuchsia-600 shadow-[0_0_10px_rgba(192,38,211,0.4)]' : 'bg-slate-300 dark:bg-slate-800'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                    source.is_active ? (i18n.dir() === 'rtl' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                                  }`}
                                />
                              </button>
                        </td>

                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => handleTestSingle(source.id)}
                              className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-all"
                              title="Test Source"
                            >
                              <Terminal size={18} />
                            </button>
                            <button
                              onClick={() => handleOpenModal(source)}
                              className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-fuchsia-500 transition-all"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(source.id)}
                              className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-white/5 flex items-center justify-between bg-slate-100/30 dark:bg-white/5 backdrop-blur-xl">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
               {t('common.page')} {currentPage} of {totalPages}
             </div>
             <div className="flex items-center gap-3">
               <button
                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                 disabled={currentPage <= 1 || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-fuchsia-500 disabled:opacity-30 transition-all"
               >
                 <ChevronLeft size={14} /> {t('sources.prev', 'Back')}
               </button>
               <button
                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                 disabled={currentPage >= totalPages || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-fuchsia-500 disabled:opacity-30 transition-all"
               >
                 {t('sources.next', 'Next')} <ChevronRight size={14} />
               </button>
             </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/10"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                   <div>
                     <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                       {editingSource ? "Edit Node" : "Register Node"}
                     </h2>
                     <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-widest mt-1">Source Authentication & Config</p>
                   </div>
                   <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                     <X size={20} />
                   </button>
                </div>

                <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ps-1">Node Identity</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:border-fuchsia-500 outline-none transition-all text-sm font-bold"
                          placeholder="Node Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ps-1">Data Protocol</label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:border-fuchsia-500 outline-none transition-all text-sm font-bold"
                        >
                          <option value="api">API Endpoint</option>
                          <option value="html">HTML Extraction</option>
                          <option value="spa">SPA (Playwright)</option>
                        </select>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ps-1">Network Endpoint</label>
                      <input
                        type="url"
                        required
                        value={formData.endpoint}
                        onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                        className="w-full px-5 py-3 bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:border-fuchsia-500 outline-none transition-all text-sm font-mono"
                        placeholder="https://ext.api.node/v1/..."
                      />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ps-1">Data Mode</label>
                        <select
                          value={formData.mode}
                          onChange={(e) => setFormData({ ...formData, mode: e.target.value, pattern: e.target.value === 'static' ? '' : formData.pattern })}
                          className="w-full px-5 py-3 bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:border-fuchsia-500 outline-none transition-all text-sm font-bold"
                        >
                          <option value="static">Static Endpoint</option>
                          <option value="discovery">Neural Discovery</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ps-1">Request Method</label>
                        <select
                          value={formData.method}
                          onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:border-fuchsia-500 outline-none transition-all text-sm font-bold"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                        </select>
                      </div>
                   </div>

                   {formData.mode === 'discovery' && (
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ps-1">Discovery Pattern (Regex)</label>
                        <input
                          type="text"
                          value={formData.pattern}
                          onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:border-fuchsia-500 outline-none transition-all text-sm font-mono"
                          placeholder="e.g. /jobs/\\d+"
                        />
                        <p className="text-[9px] text-slate-500 font-medium px-1">Define the URI segment pattern for link harvesting</p>
                     </div>
                   )}

                   <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all border border-transparent dark:border-white/5"
                      >
                         <div className={`w-3 h-3 rounded-full ${formData.is_active ? 'bg-fuchsia-500 animate-pulse shadow-[0_0_8px_rgba(217,70,239,0.5)]' : 'bg-slate-400'}`} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Active Link</span>
                      </button>
                   </div>

                   <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ps-1">Access Headers (JSON)</label>
                        <textarea
                          rows="3"
                          value={formData.headers}
                          onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                          className="w-full px-5 py-4 bg-slate-900 text-fuchsia-400 border border-white/5 rounded-2xl outline-none font-mono text-xs custom-scrollbar"
                          placeholder='{"Authorization": "Bearer NODE_KEY"}'
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ps-1">Query Parameters (JSON)</label>
                        <textarea
                          rows="3"
                          value={formData.params}
                          onChange={(e) => setFormData({ ...formData, params: e.target.value })}
                          className="w-full px-5 py-4 bg-slate-900 text-indigo-400 border border-white/5 rounded-2xl outline-none font-mono text-xs custom-scrollbar"
                          placeholder='{"sector": "dev", "limit": 100}'
                        />
                      </div>
                   </div>
                </div>

                <div className="p-8 bg-slate-50 dark:bg-white/5 border-t border-white/5 flex justify-end gap-4">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-white/5 transition-all">Cancel</button>
                   <button type="submit" className="px-8 py-3 bg-fuchsia-600 text-white rounded-2xl hover:bg-fuchsia-700 shadow-premium text-[11px] font-black uppercase tracking-widest transition-all">Synchronize Node</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTestModalOpen && (
          <div className="fixed inset-0 z-[110] overflow-y-auto custom-scrollbar">
            <div className="min-h-screen px-4 pt-32 pb-20 flex items-start justify-center">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-200/60 dark:bg-slate-950/80 backdrop-blur-xl"
                onClick={() => !testing && setIsTestModalOpen(false)}
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-4xl bg-white dark:bg-[#030712] rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden"
              >
                <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md shrink-0">
                   <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                        <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      </div>
                      <div className="h-5 w-px bg-slate-300 dark:bg-white/10 mx-2" />
                      <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 font-mono text-[10px] font-black uppercase tracking-widest">
                         <Terminal size={14} className="text-indigo-600 dark:text-indigo-400" /> 
                         <span>diagnostics_engine_v1.0.sh</span>
                      </div>
                   </div>
                   {!testing && (
                     <button onClick={() => setIsTestModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                     </button>
                   )}
                </div>

                <div className="p-8 md:p-10 min-h-[300px] overflow-y-auto font-mono text-[13px] leading-relaxed custom-scrollbar bg-slate-50 dark:bg-[#020617]">
                   <div className="mb-4 text-slate-400 dark:text-slate-500 select-none"># CC-DIAG-PROTOCOL-INITIATED</div>
                   {testing ? (
                     <div className="flex flex-col items-center justify-center py-20 space-y-6">
                        <div className="relative">
                           <div className="absolute inset-0 bg-emerald-500/20 blur-2xl animate-pulse" />
                           <Radar size={64} className="text-emerald-500 animate-pulse" />
                        </div>
                        <div className="flex flex-col items-center gap-2 text-center">
                           <div className="text-emerald-600 dark:text-emerald-500 font-black tracking-widest uppercase">SCANNING_ACTIVE_NODES...</div>
                           <div className="text-slate-500 dark:text-slate-400 text-[10px]">Pinging endpoints and verifying extraction layers</div>
                        </div>
                     </div>
                   ) : testResult ? (
                     <pre className={`whitespace-pre-wrap font-mono ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        <span className="block mb-4 p-4 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                           {testResult.output}
                        </span>
                     </pre>
                   ) : null}
                </div>

                {!testing && testResult && (
                   <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md shrink-0">
                      <div className="flex items-center gap-6">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Diagnostic Report</span>
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${testResult.success ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'}`} />
                              <span className={`text-base font-black tracking-widest ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {testResult.success ? 'SYSTEMS_OPTIMAL' : 'INTEGRITY_COMPROMISED'}
                              </span>
                            </div>
                         </div>
                      </div>
                      <button 
                        onClick={() => setIsTestModalOpen(false)}
                        className="px-10 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl"
                      >
                        Terminate Session
                      </button>
                   </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </HUDLayout>
  );
};

export default AdminSources;
