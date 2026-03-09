import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import { Building, MapPin, Briefcase, Calendar, Link as LinkIcon, ArrowLeft, Trash2, Clock, DollarSign, Award, AlertCircle } from 'lucide-react';
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
        navigate('/admin/jobs');
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-6 max-w-7xl mx-auto min-h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-600 p-8 rounded-3xl flex flex-col items-center gap-4 border border-red-100 shadow-sm max-w-md text-center">
          <AlertCircle size={64} className="text-red-400" />
          <h2 className="text-2xl font-black">{error || 'Job not found'}</h2>
          <p className="text-sm font-medium text-red-500 mb-2">The requested job details could not be retrieved.</p>
          <button 
            onClick={() => navigate('/admin/jobs')} 
            className="mt-2 bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen pb-20">
      {/* Top Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate('/admin/jobs')}
          className="flex items-center gap-2 text-gray-500 hover:text-primary font-bold transition-colors"
        >
           <ArrowLeft size={20} />
           Back to Jobs Analysis
        </button>
        <button 
          onClick={handleDelete}
          className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-2 rounded-xl font-bold transition-colors border border-red-100"
        >
           <Trash2 size={18} />
           Delete Job
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl shadow-premium border border-slate-100 overflow-hidden">
        
        {/* Header Section */}
        <div className="p-8 md:p-10 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
          {/* Decorative blur */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 rounded-full blur-3xl -mx-20 -my-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                  #{job.id}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 uppercase tracking-wider">
                  <Clock size={12} className="mr-1" /> Active
                </span>
                {(job.job_type || job.work_model) && (
                   <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
                      {job.job_type || job.work_model || 'Full-time'}
                   </span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
                {job.title}
              </h1>
              
              <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6 text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                  <Building className="text-primary" size={20} />
                  <span className="text-lg">{job.company}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="text-secondary" size={20} />
                  <span className="text-lg">{job.location || 'Remote'}</span>
                </div>
              </div>
            </div>

            {/* Application Link */}
            {job.url && (
              <div className="shrink-0 pt-2">
                <a 
                  href={job.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-primary px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg w-full md:w-auto group"
                >
                  View Original Source
                  <LinkIcon size={18} className="group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Body Section */}
        <div className="p-8 md:p-10">
          
          {/* Key Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 pb-10 border-b border-slate-100">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
               <div className="flex items-center gap-2 text-slate-500 font-bold text-sm mb-2 uppercase tracking-wider">
                 <DollarSign size={16} /> Salary Range
               </div>
               <div className="text-lg font-black text-slate-900">
                 {job.salary_range || <span className="text-slate-400 italic font-medium">Not specified</span>}
               </div>
            </div>
            
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
               <div className="flex items-center gap-2 text-slate-500 font-bold text-sm mb-2 uppercase tracking-wider">
                 <Award size={16} /> Experience
               </div>
               <div className="text-lg font-black text-slate-900">
                 {job.experience_level || <span className="text-slate-400 italic font-medium">Not specified</span>}
               </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
               <div className="flex items-center gap-2 text-slate-500 font-bold text-sm mb-2 uppercase tracking-wider">
                 <Calendar size={16} /> Date Scraped
               </div>
               <div className="text-lg font-black text-slate-900">
                 {job.created_at ? new Date(job.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
               </div>
            </div>
          </div>

          {/* Job Description */}
          <div>
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <Briefcase className="text-primary" />
              Full Job Description
            </h3>
            
            {job.description ? (
               <div className="prose prose-slate max-w-none">
                 <div className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-100">
                   {job.description}
                 </div>
               </div>
            ) : (
               <div className="text-slate-400 italic bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center font-medium">
                 No description provided for this job.
               </div>
            )}
          </div>

          {/* Required Skills Section */}
          <div className="mt-12 pt-10 border-t border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <Award className="text-primary" />
              Required Skills
            </h3>
            
            {job.skills && job.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, index) => (
                  <span 
                    key={index} 
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-sm font-bold shadow-sm"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 italic bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center font-medium">
                No skills extracted for this job yet.
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
