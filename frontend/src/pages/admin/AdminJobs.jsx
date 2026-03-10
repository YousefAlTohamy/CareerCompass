import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import { 
  Briefcase, 
  Search, 
  Trash2, 
  Eye, 
  MapPin, 
  Building2,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon
} from 'lucide-react';
import Swal from 'sweetalert2';

const AdminJobs = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search State (URL Synced)
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page')) || 1;
  const initialSearch = searchParams.get('search') || '';

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
        setTotalPages(response.data.data.last_page || 1);
        setCurrentPage(response.data.data.current_page || 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error('Failed to fetch admin jobs:', err);
      setJobs([]);
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
    fetchJobs();
  }, [fetchJobs]);

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Job?',
      text: "You won't be able to revert this! All related skills will be kept, but the job will be deleted.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, delete it'
    });

    if (result.isConfirmed) {
      try {
        await adminAPI.deleteJob(id);
        setJobs((prev) => prev.filter((j) => j.id !== id));
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Job deleted successfully',
          showConfirmButton: false,
          timer: 2000
        });
        
        if (jobs.length === 1 && currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        } else {
            fetchJobs();
        }
      } catch (err) {
        console.error('Failed to delete job:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || 'Failed to delete the job.',
          confirmButtonColor: '#6366f1'
        });
      }
    }
  };

  // handleToggleStatus removed as per user request

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
            <Briefcase className="w-7 h-7" />
          </div>
          Job Market
        </h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          Manage and monitor all jobs scraped from connected sources.
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-2 border border-slate-200 rounded-2xl shadow-sm flex flex-col lg:flex-row justify-between items-stretch gap-2">
        <div className="relative flex-1 flex items-center bg-slate-50 rounded-xl px-4 py-3">
          <Search className="text-slate-400 mr-3" size={20} />
          <input
            type="text"
            placeholder="Search by job title, company, or location..."
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
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-5 w-1/3">Job Details</th>
                <th className="p-5 w-1/4">Source</th>
                <th className="p-5 w-1/3">Required Skills</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && jobs.length === 0 ? (
                 <tr>
                 <td colSpan="4" className="p-12 text-center">
                   <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                     <p className="font-medium text-sm">Loading jobs...</p>
                   </div>
                 </td>
               </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <Briefcase className="w-12 h-12 text-slate-300 stroke-1" />
                      <p className="font-medium text-sm text-slate-500">No jobs found in the database.</p>
                      {activeSearch && <p className="text-xs">Try adjusting your search criteria.</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                    
                    {/* Job Details Column */}
                    <td className="p-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm line-clamp-1" title={job.title}>
                          {job.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5 font-medium">
                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <Building2 size={12} className="text-slate-400"/> 
                            <span className="max-w-[120px] truncate">{job.company || 'N/A'}</span>
                          </span>
                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <MapPin size={12} className="text-slate-400"/> 
                            <span className="max-w-[100px] truncate">{job.location || 'Remote'}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Source Column */}
                    <td className="p-5">
                       <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                           <LinkIcon size={12} />
                         </div>
                         <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                           {job.source || 'Unknown'}
                         </span>
                       </div>
                    </td>

                    {/* Skills Column (Compact Chips) */}
                    <td className="p-5">
                      <div className="flex flex-wrap gap-1.5">
                        {job.skills && job.skills.length > 0 ? (
                          <>
                            {job.skills.slice(0, 3).map((skill, index) => (
                              <span 
                                key={index} 
                                className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold uppercase tracking-wider border border-indigo-100"
                              >
                                {skill.name}
                              </span>
                            ))}
                            {job.skills.length > 3 && (
                              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold border border-slate-200">
                                +{job.skills.length - 3}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No skills extracted</span>
                        )}
                      </div>
                    </td>

                    {/* Status Column Removed */}

                    {/* Actions Column */}
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/admin/jobs/${job.id}`)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Job"
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

export default AdminJobs;