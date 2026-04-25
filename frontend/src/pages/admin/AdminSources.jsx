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
import { useTranslation } from 'react-i18next';

const getErrorMessage = (error, defaultMessage = "An unexpected error occurred.") => {
  if (error.response?.data?.errors) return Object.values(error.response.data.errors).flat().join("\n");
  if (error.response?.data?.message) return error.response.data.message;
  return defaultMessage;
};

const AdminSources = () => {
  const { t } = useTranslation();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  
  const [testResult, setTestResult] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

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

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const sourcesRes = await getAllSources(currentPage, activeSearch);
      if (sourcesRes.data) {
          setSources(sourcesRes.data);
          setTotalPages(sourcesRes.meta?.last_page || sourcesRes.last_page || 1);
          setCurrentPage(sourcesRes.meta?.current_page || sourcesRes.current_page || 1);
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

  const handleTestAll = async () => {
    setTesting(true);
    setTestResult(null);
    setIsTestModalOpen(true);
    
    try {
      const result = await testSources();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        output: error.response?.data?.output || error.message || "Unknown diagnostic failure.",
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
      title: "Initiate Global Scraping?",
      text: "Start background neural extraction? This will ingest data across all active nodes.",
      title: t('sources.swal_run_title'),
      text: t('sources.swal_run_text'),
      icon: "question",
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: "#00D2FF",
      cancelButtonColor: "#334155",
      confirmButtonText: "EXECUTE_EXTRACTION",
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#cbd5e1",
      confirmButtonText: t('sources.swal_run_confirm'),
    });

    if (!result.isConfirmed) return;

    try {
      await runFullScraping();
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: "success",
        title: "Extraction Process Initialized",
        showConfirmButton: false,
        timer: 3000
      });
    } catch (error) {
      console.error(error);
        title: t('sources.swal_run_success_title'),
        text: t('sources.swal_run_success_text'),
        confirmButtonColor: "#6366f1",
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
      title: "Sever Node Connection?",
      text: "Permanent deletion of source record will disrupt the data stream.",
      title: t('sources.swal_delete_title'),
      text: t('sources.swal_delete_text'),
      icon: "warning",
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#334155",
      confirmButtonText: "SEVER_NODE",
      cancelButtonColor: "#cbd5e1",
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
      // Validate regex pattern if in discovery mode
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
        headers: JSON.parse(formData.headers),
        params: JSON.parse(formData.params),
      };

      if (editingSource) {
        const response = await updateSource(editingSource.id, payload);
        const updated = response.data || response;
        setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setSources((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
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
    }
  };

      Swal.fire({
        icon: "error",
        title: t('sources.swal_save_failed'),
        text: getErrorMessage(
          error,
          t('sources.swal_save_error'),
        ),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "api": return "bg-blue-100 text-blue-700";
      case "html": return "bg-fuchsia-100 text-fuchsia-700";
      case "spa": return "bg-orange-100 text-orange-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getModeColor = (mode) => {
    return mode === "discovery"
      ? "bg-violet-100 text-violet-700"
      : "bg-cyan-100 text-cyan-700";
  };

  const getModeIcon = (mode) => {
    return mode === "discovery"
      ? <Radar size={12} className="inline-block mr-1" />
      : <BookmarkMinus size={12} className="inline-block mr-1" />;
  };

  const getHealthColor = (score) => {
    if (score > 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
    if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' };
    return { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50' };
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
               <i className="ph-fill ph-play text-lg" />
               Run Extractions
             </button>
             <button
               onClick={handleTestAll}
               className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-premium text-[11px] font-black uppercase tracking-widest shrink-0"
             >
               <i className="ph-bold ph-terminal-window text-lg" />
               Diagnostics
             </button>
             <button
               onClick={() => handleOpenModal()}
               className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-premium text-[11px] font-black uppercase tracking-widest shrink-0"
             >
               <i className="ph-bold ph-plus text-lg" />
               Node
             </button>
          </div>
        </motion.div>

        {/* Toolbar & Search */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative group max-w-2xl"
        >
          <div className="absolute inset-0 bg-fuchsia-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl px-5 py-3">
            <i className="ph-thin ph-magnifying-glass text-slate-400 text-xl mr-3" />
            <input
              type="text"
              placeholder="Filter ingestion sources by name, URL, or type..."
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 dark:text-white font-medium placeholder-slate-400 text-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
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
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/10">
                  <th className="p-6">{t('admin.node_config', 'Node Config')}</th>
                  <th className="p-6">{t('admin.protocols', 'Protocols')}</th>
                  <th className="p-6">{t('admin.endpoint_access', 'Endpoint Access')}</th>
                  <th className="p-6 text-center">{t('admin.neural_state', 'Neural State')}</th>
                  <th className="p-6 text-right">{t('admin.operations', 'Operations')}</th>
          {t('sources.title')}
        </h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          {t('sources.subtitle')}
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-2 border border-slate-200 rounded-2xl shadow-sm flex flex-col lg:flex-row justify-between items-stretch gap-2">
        {/* Search */}
        <div className="relative flex-1 flex items-center bg-slate-50 rounded-xl px-4 py-3">
          <Search className="text-slate-400 mr-3" size={20} />
          <input
            type="text"
            placeholder={t('sources.search_placeholder')}
            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 font-medium placeholder-slate-400"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 ml-3"></div>}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-shrink-0 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          <button
            onClick={handleRunScraping}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition-all shadow-sm shadow-fuchsia-200 font-bold text-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            <span className="hidden sm:inline">{t('sources.run_scraping')}</span>
          </button>
          
          <button
            onClick={handleTestAll}
            disabled={testing}
            className={`flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl transition-all font-bold text-sm shadow-sm ${
              testing
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span className="hidden sm:inline">{t('sources.test_endpoints')}</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 font-bold text-sm"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">{t('sources.add_source')}</span>
          </button>
        </div>
      </div>

      {/* Sources Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-5 w-16">{t('sources.col_method')}</th>
                <th className="p-5">{t('sources.col_source_name')}</th>
                <th className="p-5 w-24">{t('sources.col_type')}</th>
                <th className="p-5 w-28">{t('sources.col_mode')}</th>
                <th className="p-5">{t('sources.col_endpoint')}</th>
                <th className="p-5 text-center w-32">{t('sources.col_status')}</th>
                <th className="p-5 w-28">{t('sources.col_health')}</th>
                <th className="p-5 text-right w-32">{t('sources.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && sources.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      <p className="font-medium text-sm">{t('sources.loading')}</p>
                    </div>
                  </td>
                </tr>
              ) : sources.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <LinkIcon className="w-12 h-12 text-slate-300 stroke-1" />
                      <p className="font-medium text-sm text-slate-500">{t('sources.no_sources')}</p>
                      {activeSearch && <p className="text-xs">{t('sources.clear_search')}</p>}
                    </div>
                  </td>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {sources.map((source, idx) => (
                    <motion.tr 
                      key={source.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group hover:bg-white/40 dark:hover:bg-white/5 transition-all duration-300"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${source.is_active ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-500' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400'}`}>
                             <i className={`ph-thin ${source.type === 'api' ? 'ph-database' : 'ph-code'} text-2xl`} />
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-white text-sm">{source.name}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{source.type}_PROTOCOL</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                          source.method === 'GET' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>
                          {source.method}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 truncate max-w-[200px]" title={source.endpoint}>
                          {source.endpoint}
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <button
                        <p className="font-bold text-slate-800 text-sm">{source.name}</p>
                      </div>
                    </td>

                    <td className="p-5">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${getTypeColor(source.type)}`}
                      >
                        {source.type}
                      </span>
                    </td>

                    <td className="p-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${getModeColor(source.mode)}`}
                      >
                        {getModeIcon(source.mode)}
                        {source.mode || 'static'}
                      </span>
                    </td>

                    <td className="p-5">
                       <p className="text-slate-500 text-sm max-w-[200px] lg:max-w-xs truncate font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100" title={source.endpoint}>
                        {source.endpoint}
                       </p>
                    </td>

                    <td className="p-5 text-center">
                       {/* Custom Modern Toggle Switch */}
                       <button
                          onClick={() => handleToggleStatus(source.id)}
                          className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            source.is_active ? 'bg-fuchsia-600' : 'bg-slate-300 dark:bg-slate-800'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                              source.is_active ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleOpenModal(source)}
                            className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-fuchsia-500 transition-all"
                          >
                            <i className="ph-thin ph-pencil-simple text-xl" />
                          </button>
                          <button
                            onClick={() => handleDelete(source.id)}
                            className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-all"
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
               Page {currentPage} of {totalPages}
             </div>
             <div className="flex items-center gap-3">
               <button
                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                 disabled={currentPage <= 1 || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-fuchsia-500 disabled:opacity-30 transition-all"
               >
                 <i className="ph-bold ph-caret-left" /> Back
               </button>
               <button
                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                 disabled={currentPage >= totalPages || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-fuchsia-500 disabled:opacity-30 transition-all"
               >
                 Next <i className="ph-bold ph-caret-right" />
               </button>
             </div>
                    <td className="p-5">
                      {(() => {
                        const score = source.health_score ?? null;
                        if (score === null) return <span className="text-xs text-slate-400">{t('sources.health_na')}</span>;
                        const colors = source.is_active ? getHealthColor(score) : { bar: 'bg-slate-300', text: 'text-slate-400', bg: 'bg-slate-50' };
                        return (
                          <div className="flex items-center gap-2">
                            <div className={`flex-1 h-1.5 rounded-full ${colors.bg} max-w-[60px]`}>
                              <div
                                className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-black ${colors.text}`}>
                              {score}%
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenModal(source)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title={t('sources.edit_source')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(source.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title={t('sources.delete_source')}
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

        {/* Server-Side Pagination Controls */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <span className="text-sm font-semibold text-slate-500">
            {t('sources.page_of', { current: currentPage, total: totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || loading}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all disabled:opacity-40 disabled:hover:bg-white flex items-center gap-1 bg-white shadow-sm"
            >
               <ChevronLeft size={16} /> {t('sources.prev')}
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages || loading}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all disabled:opacity-40 disabled:hover:bg-white flex items-center gap-1 bg-white shadow-sm"
            >
               {t('sources.next')} <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Futuristic Modal for Add/Edit */}
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
                     <i className="ph-bold ph-x text-xl" />
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
                      <div className="flex items-end pb-3">
                         <button
                           type="button"
                           onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                           className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all border border-transparent dark:border-white/5"
                         >
                            <div className={`w-3 h-3 rounded-full ${formData.is_active ? 'bg-fuchsia-500 animate-pulse shadow-[0_0_8px_rgba(217,70,239,0.5)]' : 'bg-slate-400'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Active Link</span>
                         </button>
                      </div>
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
      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingSource ? t('sources.modal_edit_title') : t('sources.modal_add_title')}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      {t('sources.label_name')}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                      placeholder="e.g. Wuzzuf API"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      {t('sources.label_type')}
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                    >
                      <option value="api">{t('sources.type_api')}</option>
                      <option value="html">{t('sources.type_html')}</option>
                      <option value="spa">{t('sources.type_spa')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    {t('sources.label_endpoint')}
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.endpoint}
                    onChange={(e) =>
                      setFormData({ ...formData, endpoint: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-mono"
                    placeholder="https://api.example.com/v1/jobs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      {t('sources.label_method')}
                    </label>
                    <select
                      value={formData.method}
                      onChange={(e) =>
                        setFormData({ ...formData, method: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-7">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                            formData.is_active ? 'bg-indigo-600' : 'bg-slate-200'
                          }`}
                          role="switch"
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                      <span className="text-sm font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                        {t('sources.active_source')}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Discovery Mode Section */}
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      {t('sources.label_mode')}
                    </label>
                    <select
                      value={formData.mode}
                      onChange={(e) =>
                        setFormData({ ...formData, mode: e.target.value, pattern: e.target.value === 'static' ? '' : formData.pattern })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                    >
                      <option value="static">{t('sources.mode_static')}</option>
                      <option value="discovery">{t('sources.mode_discovery')}</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-400">
                      {formData.mode === 'discovery'
                        ? t('sources.mode_hint_discovery')
                        : t('sources.mode_hint_static')}
                    </p>
                  </div>

                  {formData.mode === 'discovery' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        {t('sources.label_pattern')}
                      </label>
                      <input
                        type="text"
                        value={formData.pattern}
                        onChange={(e) =>
                          setFormData({ ...formData, pattern: e.target.value })
                        }
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-mono"
                        placeholder="e.g. /jobs/\\d+"
                        spellCheck="false"
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        {t('sources.pattern_hint')}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 flex justify-between">
                    <span>{t('sources.label_headers')}</span>
                    <span className="text-xs font-normal text-slate-400">{t('sources.json_format')}</span>
                  </label>
                  <textarea
                    rows="3"
                    value={formData.headers}
                    onChange={(e) =>
                      setFormData({ ...formData, headers: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs font-mono"
                    placeholder='{"Authorization": "Bearer token"}'
                    spellCheck="false"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 flex justify-between">
                    <span>{t('sources.label_params')}</span>
                    <span className="text-xs font-normal text-slate-400">{t('sources.json_format')}</span>
                  </label>
                  <textarea
                    rows="3"
                    value={formData.params}
                    onChange={(e) =>
                      setFormData({ ...formData, params: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs font-mono"
                    placeholder='{"q": "developer"}'
                    spellCheck="false"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition-colors text-sm"
                >
                  {t('sources.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 font-bold text-sm"
                >
                  <Save className="w-4 h-4" />
                  {t('sources.save_source')}
                </button>
              </div>
            </form>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 Diagnostic Terminal Modal */}
      <AnimatePresence>
        {isTestModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[110]">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
               onClick={() => !testing && setIsTestModalOpen(false)}
             />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
               className="relative w-full max-w-4xl bg-[#030712] rounded-[32px] shadow-2xl border border-white/10 flex flex-col overflow-hidden"
             >
                {/* Terminal Header */}
                <div className="bg-slate-900/50 px-6 py-4 border-b border-white/10 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-rose-500" />
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      </div>
                      <div className="h-4 w-px bg-white/10 mx-2" />
                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px] uppercase tracking-widest">
                         <i className="ph-bold ph-terminal" /> diagnostics_protocol.log
                      </div>
                   </div>
                   {!testing && (
                     <button onClick={() => setIsTestModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                        <i className="ph-bold ph-x text-xl" />
                     </button>
                   )}
                </div>

                {/* Terminal Content */}
                <div className="p-8 h-[500px] overflow-y-auto font-mono text-xs leading-relaxed custom-scrollbar bg-slate-950/50">
                   {testing ? (
                     <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <div className="relative">
                           <div className="absolute inset-0 bg-emerald-500/20 blur-2xl animate-pulse" />
                           <i className="ph-thin ph-broadcast text-6xl text-emerald-500 animate-pulse" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                           <div className="text-emerald-500 font-black tracking-widest uppercase">SCANNING_ACTIVE_NODES...</div>
                           <div className="text-slate-500 text-[10px]">Pinging endpoints and verifying extraction layers</div>
                        </div>
                     </div>
                   ) : testResult ? (
                     <pre className={`whitespace-pre-wrap ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {testResult.output}
                     </pre>
                   ) : null}
            {/* Terminal Body */}
            <div className="p-5 overflow-y-auto flex-1 bg-[#0f172a] text-slate-300 font-mono text-sm leading-relaxed">
              {testing ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
                  <p className="text-emerald-400 animate-pulse">{t('sources.test_running')}</p>
                </div>

                {/* Terminal Footer */}
                {!testing && testResult && (
                   <div className="px-8 py-4 bg-slate-900/50 border-t border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DIAGNOSTIC_STATE:</span>
                         <span className={`px-2 py-0.5 rounded text-[10px] font-black ${testResult.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                           {testResult.success ? 'PASS' : 'CRITICAL_ERROR'}
                         </span>
                      </div>
                      <button 
                        onClick={() => setIsTestModalOpen(false)}
                        className="px-6 py-2 rounded-xl bg-white/5 dark:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10"
                      >
                        Exit Diagnostic
                      </button>
                   </div>
                )}
             </motion.div>
            {/* Terminal Footer */}
            {!testing && testResult && (
               <div className="bg-[#1e293b] px-5 py-3 border-t border-slate-700 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-500">{t('sources.test_status')}:</span>
                    {testResult.success ? (
                      <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded">{t('sources.test_pass')}</span>
                    ) : (
                      <span className="text-rose-400 font-bold bg-rose-400/10 px-2 py-0.5 rounded">{t('sources.test_fail')}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsTestModalOpen(false)}
                    className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('sources.test_close')}
                  </button>
               </div>
            )}
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </HUDLayout>
  );
};

export default AdminSources;