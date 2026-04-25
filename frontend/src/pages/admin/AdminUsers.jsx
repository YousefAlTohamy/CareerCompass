import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, UserMinus, UserCheck, ShieldAlert, ArrowRight, ArrowLeft } from 'lucide-react';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const AdminUsers = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.dir() === 'rtl';
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
    const result = await Swal.fire({
      title: isCurrentlyBanned ? t('admin.actions.unban_user') : t('admin.actions.ban_user'),
      text: `${t('admin.actions.irreversible')} "${name}"`,
      icon: 'warning',
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: isCurrentlyBanned ? '#10b981' : '#f43f5e',
      cancelButtonColor: '#334155',
      confirmButtonText: isCurrentlyBanned ? t('admin.actions.confirm_unban') : t('admin.actions.confirm_ban'),
      cancelButtonText: t('admin.prev_step') || 'Back'
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-white">{t('admin.stats.users')}</h1>
            <p className="text-slate-500 font-mono text-sm tracking-widest uppercase">// AUTH_DIRECTORY_PULSE</p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-500`} size={18} />
            <input 
              type="text"
              placeholder={t('mentorship.search')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`w-full bg-white/5 border border-white/10 ${isRtl ? 'pr-12 pl-4' : 'ps-12 pe-4'} py-3 rounded-2xl text-white font-medium outline-none focus:border-[var(--cc-primary)] transition-all`}
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="glass-card overflow-hidden border-white/5 rounded-3xl">
          <div className="overflow-x-auto">
            <table className={`w-full text-start border-collapse`}>
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4 text-start">{t('cv_builder.full_name')}</th>
                  <th className="px-6 py-4 text-start">{t('hud_labels.email_endpoint')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.status')}</th>
                  <th className="px-6 py-4 text-end">{t('admin.operations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode='popLayout'>
                {users.map((user, idx) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={user.id} 
                    className="hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/10 shadow-lg">
                          {getInitials(user.name)}
                        </div>
                        <span className="font-bold text-white group-hover:text-[var(--cc-primary)] transition-colors">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-slate-400">{user.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${user.is_banned ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${user.is_banned ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {user.is_banned ? t('admin.system.offline') : t('admin.system.online')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/admin/users/${user.id}`)}
                          className="p-2 bg-white/5 hover:bg-[var(--cc-primary)]/20 text-slate-400 hover:text-[var(--cc-primary)] rounded-lg transition-all"
                        >
                          <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
                        </button>
                        <button 
                          onClick={() => handleToggleBan(user.id, user.name, user.is_banned)}
                          className={`p-2 rounded-lg transition-all ${user.is_banned ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}
                        >
                          {user.is_banned ? <UserCheck size={18} /> : <UserMinus size={18} />}
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
            <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-between">
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

      </div>
    </HUDLayout>
  );
};

export default AdminUsers;