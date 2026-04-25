import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';

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
      title: 'Decommission Entry?',
      text: `Permanent removal of job entry: "${job.title}"`,
      icon: 'warning',
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#334155',
      confirmButtonText: 'DECOMMISSION'
    });

    if (result.isConfirmed) {
      try {
        await adminAPI.deleteJob(id);
        navigate('/admin/jobs');
      } catch (err) {
        console.error('Failed to delete job:', err);
      }
    }
  };

  if (error || (!loading && !job)) {
    return (
      <HUDLayout>
        <div className="p-6 max-w-3xl mx-auto min-h-[80vh] flex items-center justify-center pt-28">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl p-10 rounded-[32px] border border-white/20 dark:border-white/5 flex flex-col items-center gap-6 text-center w-full"
          >
            <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center">
              <i className="ph-thin ph-warning-circle text-5xl" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{error || 'Job Node Not Found'}</h2>
            <button 
              onClick={() => navigate('/admin/jobs')} 
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-premium"
            >
              Return to Market Feed
            </button>
          </motion.div>
        </div>
      </HUDLayout>
    );
  }

  return (
    <HUDLayout loading={loading}>
      <div className="p-6 max-w-6xl mx-auto pb-20 space-y-10 pt-28">
        
        {/* Top Navigation */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between"
        >
          <button 
            onClick={() => navigate('/admin/jobs')}
            className="group flex items-center gap-3 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
          >
             <div className="w-10 h-10 rounded-full bg-white/40 dark:bg-white/5 flex items-center justify-center border border-white/40 dark:border-white/10 group-hover:border-indigo-500 transition-all">
                <i className="ph-bold ph-caret-left" />
             </div>
             <span className="text-[11px] font-black uppercase tracking-widest ps-1">Back to Market Feed</span>
          </button>
          
          <button 
            onClick={handleDelete}
            className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-500/20 transition-all shadow-premium"
          >
             <i className="ph-bold ph-trash text-lg" />
             Decommission Node
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Info Pane */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-8 space-y-8"
          >
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-10 shadow-premium relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-3xl -mr-24 -mt-24 pointer-events-none group-hover:bg-indigo-500/10 transition-all" />
               
               <div className="flex flex-wrap items-center gap-2 mb-6">
                 <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">
                   ID: #{job?.id}
                 </span>
                 <span className="px-3 py-1 bg-white/40 dark:bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500">
                   Source: {job?.source || 'EXTERNAL_NODE'}
                 </span>
               </div>

               <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-6 leading-none">
                 {job?.title}
               </h1>

               <div className="flex flex-wrap items-center gap-6">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                     <i className="ph-thin ph-buildings text-2xl" />
                   </div>
                   <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Corporation</p>
                     <p className="text-sm font-bold text-slate-900 dark:text-white">{job?.company || 'UNIDENTIFIED'}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 text-fuchsia-500 flex items-center justify-center">
                     <i className="ph-thin ph-map-pin text-2xl" />
                   </div>
                   <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Geolocation</p>
                     <p className="text-sm font-bold text-slate-900 dark:text-white">{job?.location || 'REMOTE_NODE'}</p>
                   </div>
                 </div>
               </div>
            </div>

            {/* Description Pane */}
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-10 shadow-premium">
               <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-8 flex items-center gap-2">
                 <i className="ph-bold ph-list-bullets" /> Occupational Data Stream
               </h3>
               
               {job?.description ? (
                  <div className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap text-sm md:text-base opacity-80">
                    {job.description}
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <i className="ph-thin ph-read-cv-logo text-6xl mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No Stream Data Available</p>
                  </div>
               )}
            </div>
          </motion.div>

          {/* Sidebar Info */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-4 space-y-8"
          >
            {/* Meta Stats */}
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-8 space-y-6 shadow-premium">
               <div className="flex items-center gap-3 mb-2">
                 <div className="h-4 w-1 bg-indigo-500 rounded-full" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entry Vitals</span>
               </div>

               <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <i className="ph-thin ph-currency-circle-dollar text-2xl" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Remuneration</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{job?.salary_range || 'NOT_DISCLOSED'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <i className="ph-thin ph-briefcase text-2xl" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exp_Threshold</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{job?.experience_level || 'ENTRY_LVL'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                      <i className="ph-thin ph-calendar-blank text-2xl" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingestion_Epoch</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{job?.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
               </div>

               <div className="pt-4">
                  {job?.url && (
                    <a 
                      href={job.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-95 transition-all shadow-premium"
                    >
                      Access Origin <i className="ph-bold ph-arrow-square-out" />
                    </a>
                  )}
               </div>
            </div>

            {/* Matrix Chips */}
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-8 shadow-premium">
               <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-6">Neural Skill Chips</h3>
               <div className="flex flex-wrap gap-2">
                  {Array.isArray(job?.skills) && job.skills.length > 0 ? (
                    job.skills.map((skill, idx) => (
                      <span 
                        key={idx}
                        className="px-3 py-1.5 bg-indigo-500/5 dark:bg-white/5 border border-indigo-500/10 dark:border-white/10 rounded-lg text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter"
                      >
                        {typeof skill === 'object' ? skill.name : skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-[10px] font-black text-slate-400 uppercase">No Matrix Data Found</p>
                  )}
               </div>
            </div>
          </motion.div>
        </div>
      </div>
    </HUDLayout>
  );
}