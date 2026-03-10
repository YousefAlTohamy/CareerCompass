import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar, 
  ArrowLeft, 
  Trash2, 
  DollarSign, 
  Award, 
  AlertCircle,
  ExternalLink,
  AlignLeft,
  Clock
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function AdminJobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await adminAPI.getAdminJobDetails(id);
        if (response.data && response.data.success) {
          setJob(response.data.data);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setError('Job not found.');
        }
      } catch (err) {
        console.error('Failed to fetch job details:', err);
        setError('Failed to load job details. The job may have been deleted.');
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
  }, [id]);

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: 'Delete Job?',
      text: `Are you sure you want to delete "${job.title}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48', // rose-600
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, delete job'
    });

    if (result.isConfirmed) {
      try {
        await adminAPI.deleteJob(id); // Using the standard deleteJob endpoint
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'The job has been deleted.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
        navigate('/admin/jobs');
      } catch (err) {
        console.error('Failed to delete job:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete the job.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    }
  };

  // Consistent Loading State
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-slate-400 font-medium text-sm">Loading job details...</p>
      </div>
    );
  }

  // Consistent Error State
  if (error || !job) {
    return (
      <div className="p-6 max-w-3xl mx-auto min-h-[60vh] flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4 border border-slate-200 shadow-sm text-center w-full">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-2">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">{error || 'Job not found'}</h2>
          <p className="text-slate-500 font-medium mb-4">The job you are looking for does not exist or has been removed.</p>
          <button 
            onClick={() => navigate('/admin/jobs')} 
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm"
          >
            Back to Jobs List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20 space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <button 
          onClick={() => navigate('/admin/jobs')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-3 py-2 rounded-lg font-bold transition-colors w-fit"
        >
           <ArrowLeft size={18} />
           Back to Jobs List
        </button>
        
        <button 
          onClick={handleDelete}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-bold transition-all shadow-sm"
        >
           <Trash2 size={18} />
           Delete Job Posting
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header Banner Section */}
        <div className="bg-slate-50 border-b border-slate-200 relative overflow-hidden">
          {/* Decorative background shape */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mx-20 -my-20 pointer-events-none"></div>
          
          <div className="p-8 md:p-10 relative z-10 flex flex-col lg:flex-row justify-between gap-8">
            
            {/* Job Main Info */}
            <div className="flex-1 flex flex-col items-start">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700">
                  ID: #{job.id}
                </span>
                
                {/* Job Type / Work Model Badge */}
                {(job.job_type || job.work_model) && (
                   <span className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {job.job_type || job.work_model || 'Full-time'}
                   </span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight mb-4 leading-tight">
                {job.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-slate-600 font-medium">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                  <Building2 size={18} className="text-indigo-500" />
                  <span>{job.company || 'Unknown Company'}</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                  <MapPin size={18} className="text-fuchsia-500" />
                  <span>{job.location || 'Remote'}</span>
                </div>
              </div>
            </div>

            {/* Application Link / Source */}
            <div className="shrink-0 flex flex-col gap-3">
              {job.url ? (
                <a 
                  href={job.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-900 px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg w-full sm:w-auto group"
                >
                  View Original Source
                  <ExternalLink size={18} className="group-hover:scale-110 transition-transform" />
                </a>
              ) : (
                 <div className="flex items-center justify-center gap-2 bg-slate-100 text-slate-400 px-6 py-3 rounded-xl font-bold border border-slate-200 w-full sm:w-auto cursor-not-allowed">
                    No Source URL
                 </div>
              )}
              {job.source && (
                 <div className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                   Via {job.source}
                 </div>
              )}
            </div>
          </div>
        </div>

        {/* Body Section */}
        <div className="p-8 md:p-10 space-y-10">
          
          {/* Key Details Grid (Matching UserDetails Grid Style) */}
          <div>
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                <Briefcase size={16} /> Job Specifications
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-emerald-500"><DollarSign size={18} /></div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-500 mb-0.5">Salary Range</p>
                    <p className="font-medium text-slate-800 truncate" title={job.salary_range}>
                       {job.salary_range || <span className="text-slate-400 italic font-normal">Not specified</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-amber-500"><Award size={18} /></div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-500 mb-0.5">Experience Required</p>
                    <p className="font-medium text-slate-800 truncate" title={job.experience_level}>
                       {job.experience_level || <span className="text-slate-400 italic font-normal">Not specified</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-indigo-500"><Calendar size={18} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-0.5">Date Scraped</p>
                    <p className="font-medium text-slate-800">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
             </div>
          </div>

          <div className="border-t border-slate-100"></div>

          {/* Job Description */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
              <AlignLeft size={16} /> Full Job Description
            </h3>
            
            {job.description ? (
               <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-medium whitespace-pre-wrap bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-100 text-sm md:text-base">
                 {job.description}
               </div>
            ) : (
               <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">
                 <AlignLeft className="w-12 h-12 text-slate-300 mb-3 stroke-1" />
                 <p className="text-slate-500 font-medium">No detailed description provided.</p>
               </div>
            )}
          </div>

          <div className="border-t border-slate-100"></div>

          {/* Required Skills Section (Matching UserDetails Skills) */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Award size={16} /> Required Skills
            </h3>
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              {Array.isArray(job.skills) && job.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill, index) => (
                    <span 
                      key={index} 
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-indigo-100"
                    >
                      {typeof skill === 'object' ? skill.name : skill}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Award className="w-10 h-10 text-slate-200 mb-3 stroke-1" />
                  <p className="text-slate-500 font-medium text-sm">No specific skills extracted for this job.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}