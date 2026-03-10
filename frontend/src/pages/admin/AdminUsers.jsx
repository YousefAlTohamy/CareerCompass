import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import { 
  Users, 
  Search, 
  Trash2, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import Swal from 'sweetalert2';

// Helper function to get user initials for the avatar
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search State (URL Synced)
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Debounce logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchInput !== activeSearch) {
        setActiveSearch(searchInput);
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput, activeSearch]);

  // URL Sync logic
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
      showCancelButton: true,
      confirmButtonColor: isCurrentlyBanned ? '#10b981' : '#f43f5e',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: `Yes, ${actionText} user`
    });

    if (result.isConfirmed) {
      // Optimistic UI Update: We flip the is_banned status
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_banned: !isCurrentlyBanned } : u));
      try {
        await adminAPI.toggleUserBan(id);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `User ${isCurrentlyBanned ? 'unbanned' : 'banned'} successfully`,
          showConfirmButton: false,
          timer: 2000
        });
      } catch (err) {
        console.error('Failed to toggle user ban status:', err);
        // Revert if failed
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_banned: isCurrentlyBanned } : u));
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || `Failed to ${actionText} user.`,
          confirmButtonColor: '#6366f1'
        });
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
            <Users className="w-7 h-7" />
          </div>
          User Management
        </h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          View, manage, and moderate user accounts registered on Career Compass.
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-2 border border-slate-200 rounded-2xl shadow-sm flex flex-col lg:flex-row justify-between items-stretch gap-2">
        <div className="relative flex-1 flex items-center bg-slate-50 rounded-xl px-4 py-3">
          <Search className="text-slate-400 mr-3" size={20} />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 font-medium placeholder-slate-400"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 ml-3"></div>}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-5 w-2/5">User Details</th>
                <th className="p-5">Profession</th>
                <th className="p-5 text-center">Account Status</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                 <tr>
                 <td colSpan="4" className="p-12 text-center">
                   <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                     <p className="font-medium text-sm">Loading users...</p>
                   </div>
                 </td>
               </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <ShieldAlert className="w-12 h-12 text-slate-300 stroke-1" />
                      <p className="font-medium text-sm text-slate-500">No users found.</p>
                      {activeSearch && <p className="text-xs">Try adjusting your search criteria.</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    
                    {/* User Details Column */}
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                          {getInitials(user.name)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm">{user.name}</span>
                          <span className="text-xs text-slate-500 mt-0.5 font-medium">{user.email}</span>
                        </div>
                      </div>
                    </td>

                    {/*Profession Column */}
                    <td className="p-5">
                       <div className="flex flex-col items-start gap-2">
                          
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            <UserIcon size={12} className="text-slate-400" />
                            {user.job_title || 'No Job Title'}
                          </span>
                       </div>
                    </td>

                    {/* Status Column */}
                    <td className="p-5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                            !user.is_banned ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {!user.is_banned ? 'Active' : 'Banned'}
                          </span>
                        </div>
                    </td>

                    {/* Actions Column */}
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/admin/users/${user.id}`)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleBan(user.id, user.name, user.is_banned)}
                          className={`p-2 rounded-xl transition-all ${
                            user.is_banned 
                              ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50' 
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title={user.is_banned ? 'Unban User' : 'Ban User'}
                        >
                          {user.is_banned ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Unified Server-Side Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <span className="text-sm font-semibold text-slate-500">
            Page <span className="text-slate-800">{currentPage}</span> of <span className="text-slate-800">{totalPages}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || loading}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all disabled:opacity-40 disabled:hover:bg-white flex items-center gap-1 bg-white shadow-sm"
            >
               <ChevronLeft size={16} /> Prev
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages || loading}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all disabled:opacity-40 disabled:hover:bg-white flex items-center gap-1 bg-white shadow-sm"
            >
               Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;