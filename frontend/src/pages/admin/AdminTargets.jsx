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
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Search
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
      setRoles((prev) => [...prev, created]);
      setNewRoleName("");
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
    try {
      const result = await toggleTargetRole(id);
      const updated = result.data || result;
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (error) {
      console.error(error);
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
      text: "Are you sure you want to delete this role?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#f43f5e",
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
        timerProgressBar: true,
      });
      fetchRoles();
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Target className="w-6 h-6 text-indigo-600" />
          Target Job Roles
        </h1>
      </div>

      {/* Search Input Card */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex items-center px-4">
        <Search className="text-slate-400 mr-3" size={20} />
        <input
          type="text"
          placeholder="Search roles..."
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 font-medium placeholder-slate-400"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 ml-3"></div>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              Manage Roles
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage dynamically tracked professions. Active roles are prioritized in scraping.
            </p>
          </div>
          <form onSubmit={handleAddRole} className="flex gap-2">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Lawyer, Backend Dev"
              className="w-64 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
            />
            <button
              type="submit"
              disabled={!newRoleName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Role
            </button>
          </form>
        </div>
        

        <table className="w-full text-left border-collapse">

          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
            <tr>
              <th className="p-4 border-b">Role Name</th>
              <th className="p-4 border-b text-center">Status</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="3" className="p-8 text-center text-gray-500">
                  Loading roles...
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-8 text-center text-gray-500">
                  No target roles defined.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr
                  key={role.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="p-4 font-medium text-gray-900">{role.name}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleRole(role.id)}
                      className={`transition-colors ${role.is_active ? "text-green-500 hover:text-green-600" : "text-gray-400 hover:text-gray-500"}`}
                      title="Toggle Status"
                    >
                      {role.is_active ? (
                        <ToggleRight className="w-8 h-8" />
                      ) : (
                        <ToggleLeft className="w-8 h-8" />
                      )}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-block"
                      title="Delete Role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
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
};

export default AdminTargets;
