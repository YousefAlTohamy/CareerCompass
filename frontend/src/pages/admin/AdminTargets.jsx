import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from 'react-router-dom';
import {
  getTargetRoles,
  addTargetRole,
  toggleTargetRole,
  deleteTargetRole,
} from "../../api/scrapingSources";
import {
  Plus,
  Trash2,
  Target,
  ChevronLeft,
  ChevronRight,
  Search,
  Activity,
  ArchiveX
} from "lucide-react";
import Swal from "sweetalert2";

const getErrorMessage = (
  error,
  defaultMessage = "An unexpected error occurred.",
) => {
  if (error.response?.data?.errors) {
    return Object.values(error.response.data.errors).flat().join("\n");
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  return defaultMessage;
};

const AdminTargets = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState("");

  // Pagination & Search State
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Debounced search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchInput !== activeSearch) {
        setActiveSearch(searchInput);
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput, activeSearch]);

  // URL Synchronization
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
      const result = await addTargetRole({
        name: newRoleName.trim(),
        is_active: true,
      });
      const created = result.data || result;
      setRoles((prev) => [created, ...prev]); // Add to top of list
      setNewRoleName("");
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Role added successfully",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: getErrorMessage(error, "Failed to add role"),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const handleToggleRole = async (id) => {
    // Optimistic UI Update for snappier feel
    setRoles((prev) => prev.map((r) => r.id === id ? { ...r, is_active: !r.is_active } : r));
    try {
      const result = await toggleTargetRole(id);
      const updated = result.data || result;
      // Ensure backend state matches
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (error) {
      console.error(error);
      // Revert if failed
      setRoles((prev) => prev.map((r) => r.id === id ? { ...r, is_active: !r.is_active } : r));
      Swal.fire({
        icon: "error",
        title: "Error",
        text: getErrorMessage(error, "Failed to toggle role"),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const handleDeleteRole = async (id) => {
    const result = await Swal.fire({
      title: "Delete Role?",
      text: "Are you sure you want to remove this role from the system?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#cbd5e1",
      confirmButtonText: "Yes, delete it",
    });

    if (!result.isConfirmed) return;

    try {
      await deleteTargetRole(id);
      setRoles((prev) => prev.filter((r) => r.id !== id));
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Role deleted",
        showConfirmButton: false,
        timer: 2000,
      });
      // Fetch roles if the page becomes empty
      if (roles.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
      } else {
          fetchRoles();
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: getErrorMessage(error, "Failed to delete role"),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
            <Target className="w-7 h-7" />
          </div>
          Target Job Roles
        </h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          Manage dynamically tracked professions. Active roles are prioritized in scraping pipelines.
        </p>
      </div>

      {/* Toolbar: Search & Add Form */}
      <div className="bg-white p-2 border border-slate-200 rounded-2xl shadow-sm flex flex-col lg:flex-row justify-between items-stretch gap-2">
        {/* Search */}
        <div className="relative flex-1 flex items-center bg-slate-50 rounded-xl px-4 py-3">
          <Search className="text-slate-400 mr-3" size={20} />
          <input
            type="text"
            placeholder="Search roles (e.g., Backend Developer)..."
            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 font-medium placeholder-slate-400"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 ml-3"></div>}
        </div>

        {/* Add Form */}
        <form onSubmit={handleAddRole} className="flex gap-2 flex-shrink-0 w-full lg:w-auto">
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="New role name"
            className="w-full lg:w-64 px-4 py-3 text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!newRoleName.trim()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm shadow-indigo-200"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-5 w-1/2">Role Details</th>
                <th className="p-5 text-center">Scraping Status</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && roles.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      <p className="font-medium text-sm">Loading roles...</p>
                    </div>
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <Target className="w-12 h-12 text-slate-300 stroke-1" />
                      <p className="font-medium text-sm text-slate-500">No target roles found.</p>
                      {activeSearch && <p className="text-xs">Try clearing your search.</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr
                    key={role.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${role.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {role.is_active ? <Activity size={18} strokeWidth={2.5} /> : <ArchiveX size={18} strokeWidth={2.5} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{role.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5 font-medium">Added: {new Date(role.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-5 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                          role.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </span>
                        
                        {/* Custom Modern Toggle Switch */}
                        <button
                          onClick={() => handleToggleRole(role.id)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                            role.is_active ? 'bg-indigo-600' : 'bg-slate-200'
                          }`}
                          role="switch"
                          aria-checked={role.is_active}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              role.is_active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </td>

                    <td className="p-5 text-right">
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all inline-flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete Role"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
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

export default AdminTargets;