import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from 'react-router-dom';
import {
  getTargetRoles,
  addTargetRole,
  toggleTargetRole,
  deleteTargetRole,
} from "../../api/scrapingSources";
import HUDLayout from "../../components/HUDLayout";
import Swal from "sweetalert2";
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const AdminTargets = () => {
  const { t, i18n } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page')) || 1;
  const initialSearch = searchParams.get('search') || '';

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [activeSearch, setActiveSearch] = useState(initialSearch);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const rolesRes = await getTargetRoles(currentPage, activeSearch);
      if (rolesRes.data) {
        setRoles(rolesRes.data);
        setTotalPages(rolesRes.meta?.last_page || rolesRes.last_page || 1);
        setCurrentPage(rolesRes.meta?.current_page || rolesRes.current_page || 1);
      } else {
        setRoles([]);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      setRoles([]);
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
    fetchRoles();
  }, [currentPage, activeSearch, fetchRoles]);

  const handleAddRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      const result = await addTargetRole({ name: newRoleName.trim(), is_active: true });
      const created = result.data || result;
      setRoles((prev) => [created, ...prev]);
      setNewRoleName("");
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: t('sources.swal_added'), showConfirmButton: false, timer: 2000 });
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleRole = async (id) => {
    setRoles((prev) => prev.map((r) => r.id === id ? { ...r, is_active: !r.is_active } : r));
    try {
      const result = await toggleTargetRole(id);
      const updated = result.data || result;
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (error) {
      console.error(error);
      setRoles((prev) => prev.map((r) => r.id === id ? { ...r, is_active: !r.is_active } : r));
    }
  };

  const handleDeleteRole = async (id) => {
    const result = await Swal.fire({
      title: t('admin.decommission_target'),
      text: t('admin.decommission_text'),
      icon: "warning",
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#334155",
      confirmButtonText: t('admin.decommission_btn'),
      cancelButtonText: t('sources.cancel')
    });

    if (!result.isConfirmed) return;

    try {
      await deleteTargetRole(id);
      setRoles((prev) => prev.filter((r) => r.id !== id));
      if (roles.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
      } else {
          fetchRoles();
      }
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: t('sources.swal_deleted'), showConfirmButton: false, timer: 2000 });
    } catch (error) {
      console.error(error);
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
              <div className="h-px w-8 bg-indigo-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500">{t('admin.neural_performance')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
              {t('nav.admin_targets')} <span className="text-indigo-600 dark:text-indigo-400">{t('admin.neural_matrix')}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm font-medium max-w-lg">
              {t('dashboard.market')}
            </p>
          </div>

          <form onSubmit={handleAddRole} className="relative group w-full md:w-96">
            <div className="absolute inset-0 bg-indigo-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative flex items-center bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl px-5 py-3">
              <i className="ph-fill ph-plus-circle text-indigo-500 text-xl mr-3" />
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder={t('dashboard.target_role')}
                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 dark:text-white font-black placeholder-slate-400 text-[10px] uppercase tracking-widest"
              />
              {newRoleName.trim() && (
                <button type="submit" className="ml-2 text-[10px] font-black text-indigo-500 animate-pulse">EXECUTE</button>
              )}
            </div>
          </form>
        </motion.div>

        {/* Search Toolbar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative group max-w-lg"
        >
          <div className="absolute inset-0 bg-indigo-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl px-5 py-3">
            <i className="ph-thin ph-magnifying-glass text-slate-400 text-xl mr-3" />
            <input
              type="text"
              placeholder={t('admin.filter_nodes')}
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
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/10">
                  <th className="p-6">{t('admin.target_identity')}</th>
                  <th className="p-6">{t('admin.neural_status')}</th>
                  <th className="p-6 text-center">{t('admin.protocol_state')}</th>
                  <th className="p-6 text-right">{t('admin.operations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {roles.map((role, idx) => (
                    <motion.tr 
                      key={role.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group hover:bg-white/40 dark:hover:bg-white/5 transition-all duration-300"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${role.is_active ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400'}`}>
                             <i className="ph-thin ph-target text-2xl" />
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">{role.name}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Ref_ID: {role.id.toString().padStart(4, '0')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                           <span className={`text-[9px] font-black uppercase tracking-widest ${role.is_active ? 'text-emerald-500' : 'text-slate-400'}`}>
                             {role.is_active ? t('admin.priority_active') : t('admin.node_standby')}
                           </span>
                           <div className="w-20 h-1 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: role.is_active ? '100%' : '10%' }}
                                className={`h-full ${role.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`}
                              />
                           </div>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <button
                          onClick={() => handleToggleRole(role.id)}
                          className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            role.is_active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                              role.is_active ? (i18n.dir() === 'rtl' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="p-6 text-right">
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <i className="ph-thin ph-trash text-xl" />
                        </button>
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
               {t('admin.data_stream')} {currentPage} of {totalPages}
             </div>
             <div className="flex items-center gap-3">
               <button
                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                 disabled={currentPage <= 1 || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-indigo-500 disabled:opacity-30 transition-all"
               >
                 <i className={`ph-bold ${i18n.dir() === 'rtl' ? 'ph-caret-right' : 'ph-caret-left'}`} /> {t('sources.prev')}
               </button>
               <button
                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                 disabled={currentPage >= totalPages || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-indigo-500 disabled:opacity-30 transition-all"
               >
                 {t('sources.next')} <i className={`ph-bold ${i18n.dir() === 'rtl' ? 'ph-caret-left' : 'ph-caret-right'}`} />
               </button>
             </div>
          </div>
        </motion.div>
      </div>
    </HUDLayout>
  );
};

export default AdminTargets;
