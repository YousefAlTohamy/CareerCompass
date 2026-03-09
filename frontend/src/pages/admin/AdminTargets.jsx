import React, { useState, useEffect } from "react";
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const rolesRes = await getTargetRoles();
      const fetchedData = rolesRes?.data || rolesRes;
      setRoles(Array.isArray(fetchedData) ? fetchedData : []);
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

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
      
      // Adjust page if we deleted the last item on current page
      if (currentRoles.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
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

  // Search Logic
  const filteredRoles = Array.isArray(roles)
    ? roles.filter((role) =>
        role.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRoles = filteredRoles.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRoles.length / itemsPerPage);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Target className="w-6 h-6 text-indigo-600" />
          Target Job Roles
        </h1>
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
        
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="relative max-w-md">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
             </div>
             <input
               type="text"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder="Search roles..."
               className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
             />
          </div>
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
            ) : currentRoles.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-8 text-center text-gray-500">
                  No target roles defined.
                </td>
              </tr>
            ) : (
              currentRoles.map((role) => (
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
        
        {/* Pagination Controls */}
        {!loading && filteredRoles.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(indexOfLastItem, filteredRoles.length)}
              </span>{" "}
              of <span className="font-medium">{filteredRoles.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTargets;
