import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const AdminUsers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page')) || 1;
  const initialSearch = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAdminUsers(currentPage, activeSearch);
      if (response.data && response.data.success) {
        setUsers(response.data.data.data);
        setTotalPages(response.data.data.last_page || 1);
        setCurrentPage(response.data.data.current_page || 1);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
      setUsers([]);
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
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleBan = async (id, name, isCurrentlyBanned) => {
    const actionText = isCurrentlyBanned ? 'unban' : 'ban';
    const result = await Swal.fire({
      title: `${isCurrentlyBanned ? 'Unban' : 'Ban'} User?`,
      text: `Are you sure you want to ${actionText} "${name}"?`,
      icon: 'warning',
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: isCurrentlyBanned ? '#10b981' : '#f43f5e',
      cancelButtonColor: '#334155',
      confirmButtonText: `Yes, ${actionText} user`
    });

    if (result.isConfirmed) {
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_banned: !isCurrentlyBanned } : u));
      try {
        await adminAPI.toggleUserBan(id);
      } catch (err) {
        console.error('Failed to toggle user ban status:', err);
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_banned: isCurrentlyBanned } : u));
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
              <div className="h-px w-8 bg-indigo-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500">{t('admin.access_protocols')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
              {t('nav.admin_users')} <span className="text-indigo-600 dark:text-indigo-400">{t('admin.neural_matrix')}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm font-medium max-w-lg">
              {t('dashboard.market')}
            </p>
          </div>

          <div className="relative group w-full md:w-96">
            <div className="absolute inset-0 bg-indigo-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative flex items-center bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl px-5 py-3">
              <i className="ph-thin ph-magnifying-glass text-slate-400 text-xl mr-3" />
              <input
                type="text"
                placeholder="Search by name, email, or role..."
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
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/10">
                  <th className="p-6">{t('hud_labels.operator_identity')}</th>
                  <th className="p-6">{t('dashboard.target_role')}</th>
                  <th className="p-6">{t('admin.ingestion_epoch')}</th>
                  <th className="p-6 text-center">{t('admin.status', 'Status')}</th>
                  <th className="p-6 text-right">{t('admin.access_protocols')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {users.map((user, idx) => (
                    <motion.tr 
                      key={user.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group hover:bg-white/40 dark:hover:bg-white/5 transition-all duration-300"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-black text-sm relative group-hover:scale-110 transition-transform">
                             {getInitials(user.name)}
                             <div className="absolute inset-0 bg-indigo-500/10 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-white text-sm">{user.name}</div>
                            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 tracking-tighter uppercase">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-sm font-bold text-slate-600 dark:text-slate-400">
                        {user.job_title || <span className="opacity-30 italic">NONE_SET</span>}
                      </td>
                      <td className="p-6 text-[10px] font-mono text-slate-400">
                        {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          !user.is_banned 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          {!user.is_banned ? t('dashboard.active') : t('admin.restrict')}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => navigate(`/admin/users/${user.id}`)}
                            className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-all"
                            title={t('dashboard.view_profile')}
                          >
                            <i className="ph-thin ph-eye text-xl" />
                          </button>
                          <button
                            onClick={() => handleToggleBan(user.id, user.name, user.is_banned)}
                            className={`p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 transition-all ${
                              user.is_banned ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-rose-500 hover:bg-rose-500/10'
                            }`}
                            title={user.is_banned ? t('admin.authorize') : t('admin.restrict')}
                          >
                            <i className={`ph-thin ${user.is_banned ? 'ph-user-circle-plus' : 'ph-user-circle-minus'} text-xl`} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-20 text-center">
                       <i className="ph-thin ph-user-focus text-6xl text-slate-200 dark:text-slate-800 mb-4 block" />
                       <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">// ZERO_RECORDS_MATCHED</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-6 border-t border-white/5 flex items-center justify-between bg-slate-100/30 dark:bg-white/5 backdrop-blur-xl">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
               Matrix Sector {currentPage} of {totalPages}
             </div>
             <div className="flex items-center gap-3">
               <button
                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                 disabled={currentPage <= 1 || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-indigo-500 disabled:opacity-30 transition-all"
               >
                 <i className="ph-bold ph-caret-left" /> Prev
               </button>
               <button
                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                 disabled={currentPage >= totalPages || loading}
                 className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-indigo-500 disabled:opacity-30 transition-all"
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

export default AdminUsers;