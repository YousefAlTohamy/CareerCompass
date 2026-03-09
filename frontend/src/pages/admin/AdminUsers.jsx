import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../api/endpoints';
import { Search, ChevronLeft, ChevronRight, Eye, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAdminUsers(currentPage, activeSearch);
      if (response.data && response.data.success) {
        setUsers(response.data.data.data);
        setTotalPages(response.data.data.last_page);
        setCurrentPage(response.data.data.current_page);
      }
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load users list.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, activeSearch]);

  // Debounced search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setActiveSearch(searchInput);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, activeSearch, fetchUsers]);

  const handleToggleBan = async (id, name, isBanned) => {
    const actionText = isBanned ? 'unban' : 'ban';
    const actionColor = isBanned ? '#10b981' : '#ef4444'; // Green for unban, Red for ban
    const iconType = isBanned ? 'question' : 'warning';

    const result = await Swal.fire({
      title: `${isBanned ? 'Unban' : 'Ban'} User?`,
      text: `Are you sure you want to ${actionText} "${name}"?`,
      icon: iconType,
      showCancelButton: true,
      confirmButtonColor: actionColor,
      cancelButtonColor: '#94a3b8',
      confirmButtonText: `Yes, ${actionText} them!`
    });

    if (result.isConfirmed) {
      try {
        const response = await adminAPI.toggleUserBan(id);
        if (response.data && response.data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: response.data.message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
          });
          // Optimistically update the user state
          setUsers((prevUsers) =>
            prevUsers.map((user) =>
              user.id === id ? { ...user, is_banned: response.data.data.is_banned } : user
            )
          );
        }
      } catch (err) {
        console.error('Failed to toggle ban status:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || `Failed to ${actionText} user.`,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <Users className="text-primary" />
             Users Management
          </h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Review, manage, and moderate all users in the system.</p>
        </div>
      </div>

      {/* Search Input Card */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex items-center px-4">
        <Search className="text-slate-400 mr-3" size={20} />
        <input
          type="text"
          placeholder="Search by user name or email..."
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 font-medium placeholder-slate-400"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary ml-3"></div>}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User Basics</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Job Title</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 md:table-cell hidden">
                       <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">#{user.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 mb-1">{user.name}</div>
                      <div className="text-xs text-slate-500 font-medium">{user.email}</div>
                      <div className="lg:hidden mt-1 text-xs text-slate-400">{user.job_title || 'No title set'}</div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                       <span className="text-sm font-medium text-slate-700">{user.job_title || <span className="text-slate-400 italic">Not set</span>}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       {user.is_banned ? (
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                               Banned
                           </span>
                       ) : (
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                               Active
                           </span>
                       )}
                    </td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/users/${user.id}`)}
                        className="text-slate-400 hover:text-blue-500 p-2 rounded-xl hover:bg-blue-50 transition-colors inline-block"
                        title="View Profile"
                      >
                        <Eye size={20} />
                      </button>
                      <button
                        onClick={() => handleToggleBan(user.id, user.name, user.is_banned)}
                        className={`p-2 rounded-xl transition-colors inline-block ${
                            user.is_banned 
                            ? 'text-slate-400 hover:text-green-500 hover:bg-green-50' 
                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                        title={user.is_banned ? 'Unban User' : 'Ban User'}
                      >
                        {user.is_banned ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">
                    {loading ? 'Searching users...' : 'No users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Controls */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-sm font-semibold text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || loading}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-1 bg-white"
            >
               <ChevronLeft size={16} /> Prev
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages || loading}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-1 bg-white"
            >
               Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
