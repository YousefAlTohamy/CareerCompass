import React, { useState, useEffect, useCallback } from "react";
import {
  getAllSources,
  createSource,
  updateSource,
  deleteSource,
  toggleSourceStatus,
  testSources,
  runFullScraping,
} from "../../api/scrapingSources";
import {
  Plus,
  Play,
  Trash2,
  Edit,
  Activity,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
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

const AdminSources = () => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);

  // Pagination & Search State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    type: "api",
    endpoint: "",
    method: "GET",
    headers: "{}",
    params: "{}",
    is_active: true,
  });

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const sourcesRes = await getAllSources(currentPage, activeSearch);
      if (sourcesRes.data) {
          setSources(sourcesRes.data);
          setTotalPages(sourcesRes.meta?.last_page || 1);
          setCurrentPage(sourcesRes.meta?.current_page || 1);
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

  // Debounced search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setActiveSearch(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => {
    fetchAllData();
  }, [currentPage, activeSearch, fetchAllData]);

  const handleTestAll = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testSources();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        output:
          error.response?.data?.output ||
          error.message ||
          "Unknown error occurred",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRunScraping = async () => {
    const result = await Swal.fire({
      title: "Run Full Scraping?",
      text: "Start full background scraping? This may take a while.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#f43f5e",
      confirmButtonText: "Yes, start now!",
    });

    if (!result.isConfirmed) return;

    try {
      await runFullScraping();
      Swal.fire({
        icon: "success",
        title: "Started",
        text: "Background scraping has started successfully.",
        confirmButtonColor: "#6366f1",
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: getErrorMessage(error, "Failed to start scraping."),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const response = await toggleSourceStatus(id);
      const updated = response.data || response;
      setSources((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: getErrorMessage(error, "Failed to toggle status"),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete Source?",
      text: "Are you sure you want to delete this source?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#f43f5e",
      confirmButtonText: "Yes, delete it",
    });

    if (!result.isConfirmed) return;

    try {
      await deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Source deleted",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
      fetchAllData();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: getErrorMessage(error, "Failed to delete source"),
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
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        headers: JSON.parse(formData.headers),
        params: JSON.parse(formData.params),
      };

      if (editingSource) {
        const response = await updateSource(editingSource.id, payload);
        const updated = response.data || response;
        setSources((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
      } else {
        const response = await createSource(payload);
        const created = response.data || response;
        setSources((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Save error:", error);
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: getErrorMessage(
          error,
          "Failed to save source. Check console for details (likely JSON parse error).",
        ),
        confirmButtonColor: "#6366f1",
      });
    }
  };

  const getTypeColor = (type) => {
    return type === "api"
      ? "bg-blue-100 text-blue-800"
      : "bg-purple-100 text-purple-800";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-600" />
          Scraping Sources
        </h1>
        <div className="flex gap-3">
          <button
            onClick={handleRunScraping}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            Run Full Scraping
          </button>
          <button
            onClick={handleTestAll}
            disabled={testing}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${
              testing
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 shadow-sm"
            }`}
          >
            <Activity className="w-4 h-4" />
            {testing ? "Running Tests..." : "Test All Sources"}
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Source
          </button>
        </div>
      </div>

      {/* Test Results Output */}
      {testResult && (
        <div
          className={`mb-8 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-x-auto max-h-96 border ${
            testResult.success
              ? "bg-gray-900 text-green-400 border-gray-800"
              : "bg-gray-900 text-red-400 border-red-900"
          }`}
        >
          {testResult.output}
        </div>
      )}

      {/* Search Input Card */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex items-center px-4">
        <Search className="text-slate-400 mr-3" size={20} />
        <input
          type="text"
          placeholder="Search sources by name, URL, or type..."
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 font-medium placeholder-slate-400"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 ml-3"></div>}
      </div>

      {/* Sources Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">

          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
            <tr>
              <th className="p-4 border-b">Method</th>
              <th className="p-4 border-b">Name</th>
              <th className="p-4 border-b">Type</th>
              <th className="p-4 border-b">Endpoint</th>
              <th className="p-4 border-b text-center">Status</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  Loading sources...
                </td>
              </tr>
            ) : sources.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  No scraping sources found.
                </td>
              </tr>
            ) : (
              sources.map((source) => (
                <tr
                  key={source.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="p-4">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-mono font-bold ${
                        source.method === "GET"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {source.method}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-gray-900">
                    {source.name}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(source.type)}`}
                    >
                      {source.type.toUpperCase()}
                    </span>
                  </td>
                  <td
                    className="p-4 text-gray-500 text-sm max-w-xs truncate font-mono"
                    title={source.endpoint}
                  >
                    {source.endpoint}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(source.id)}
                      className={`transition-colors ${source.is_active ? "text-green-500 hover:text-green-600" : "text-gray-400 hover:text-gray-500"}`}
                      title="Toggle Status"
                    >
                      {source.is_active ? (
                        <ToggleRight className="w-8 h-8" />
                      ) : (
                        <ToggleLeft className="w-8 h-8" />
                      )}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(source)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingSource ? "Edit Source" : "Add New Source"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="e.g. Wuzzuf Laravel Jobs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="api">API</option>
                      <option value="html">HTML</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.endpoint}
                    onChange={(e) =>
                      setFormData({ ...formData, endpoint: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    placeholder="https://api.example.com/v1/jobs..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Method
                    </label>
                    <select
                      value={formData.method}
                      onChange={(e) =>
                        setFormData({ ...formData, method: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_active: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Active
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Headers (JSON)
                  </label>
                  <textarea
                    rows="3"
                    value={formData.headers}
                    onChange={(e) =>
                      setFormData({ ...formData, headers: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Params (JSON)
                  </label>
                  <textarea
                    rows="3"
                    value={formData.params}
                    onChange={(e) =>
                      setFormData({ ...formData, params: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                    placeholder='{"q": "developer"}'
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSources;
