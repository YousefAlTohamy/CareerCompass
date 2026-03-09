import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../api/endpoints';
import { Search, Trash2, Briefcase, MapPin, Building, Calendar, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function AdminJobs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page')) || 1;
  const initialSearch = searchParams.get('search') || '';

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAdminJobs(currentPage, activeSearch);
      if (response.data && response.data.success) {
        setJobs(response.data.data.data);
        setTotalPages(response.data.data.last_page);
        setCurrentPage(response.data.data.current_page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Failed to fetch admin jobs:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load jobs list.',
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
      // Only reset page if the search actually changed from initial
      if (searchInput !== activeSearch) {
        setActiveSearch(searchInput);
        setCurrentPage(1); // Reset to page 1 on new search
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
    fetchJobs();
  }, [currentPage, activeSearch, fetchJobs]);

  const handleDelete = async (id, title) => {
    const result = await Swal.fire({
      title: 'Delete Job?',
      text: `Are you sure you want to delete "${title}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await adminAPI.deleteAdminJob(id);
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'The job has been deleted.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
        fetchJobs(); // Refresh current page
      } catch (err) {
        console.error('Failed to delete job:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete job.',
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
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
             <Briefcase className="text-primary" />
             Jobs Management
          </h1>
          <p className="text-gray-500 mt-1 font-medium text-sm">Review, search, and manage all scraped jobs in the system.</p>
        </div>
      </div>

      {/* Search Input Card */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center px-4">
        <Search className="text-gray-400 mr-3" size={20} />
        <input
          type="text"
          placeholder="Search by job title, company, or location..."
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-gray-700 font-medium placeholder-gray-400"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary ml-3"></div>}
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">ID</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Job Details</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Company & Location</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date Scraped</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.length > 0 ? (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 md:table-cell hidden">
                       <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">#{job.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 mb-1 line-clamp-1">{job.title}</div>
                      <div className="lg:hidden mt-2 space-y-1">
                         <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                            <Building size={12} className="text-primary" /> {job.company}
                         </div>
                         <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                            <MapPin size={12} className="text-secondary" /> {job.location || 'Remote'}
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                       <div className="flex items-center gap-2 text-sm text-gray-700 font-semibold mb-1">
                          <Building size={14} className="text-primary" /> {job.company}
                       </div>
                       <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                          <MapPin size={12} className="text-secondary" /> {job.location || 'Remote'}
                       </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                       <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                          <Calendar size={14} />
                          {new Date(job.created_at).toLocaleDateString()}
                       </div>
                    </td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/jobs/${job.id}`)}
                        className="text-gray-400 hover:text-blue-500 p-2 rounded-xl hover:bg-blue-50 transition-colors inline-block"
                        title="View Job Details"
                      >
                        <Eye size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(job.id, job.title)}
                        className="text-gray-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors inline-block"
                        title="Delete Job"
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 font-medium">
                    {loading ? 'Searching jobs...' : 'No jobs found.'}
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
