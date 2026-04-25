import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const cleanName = name.trim();
  if (!cleanName) return '?';
  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0] ? parts[0].substring(0, 2).toUpperCase() : '?';
};

export default function AdminUserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminAPI.getAdminUserDetails(id);
      if (response.data && response.data.success) {
        setUser(response.data.data);
      } else {
        setError('User not found.');
      }
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      setError('Failed to load user details.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async () => {
    const isBanned = user.is_banned;
    const actionText = isBanned ? 'unban' : 'ban';
    const result = await Swal.fire({
      title: `${isBanned ? 'Authorize' : 'Restrict'} User?`,
      text: `Confirm state transition for user node: "${user.name}"`,
      icon: isBanned ? 'question' : 'warning',
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: isBanned ? '#10b981' : '#f43f5e',
      cancelButtonColor: '#334155',
      confirmButtonText: `YES_EXECUTE`
    });

    if (result.isConfirmed) {
      try {
        const response = await adminAPI.toggleUserBan(id);
        if (response.data && response.data.success) {
          setUser((prev) => ({ ...prev, is_banned: !isBanned }));
        }
      } catch (err) {
        console.error('Failed to toggle ban status:', err);
      }
    }
  };

  if (error || (!loading && !user)) {
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
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{error || 'Node Not Found'}</h2>
            <button 
              onClick={() => navigate('/admin/users')} 
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-premium"
            >
              Return to Registry
            </button>
          </motion.div>
        </div>
      </HUDLayout>
    );
  }

  return (
    <HUDLayout loading={loading} loadingType="standard">
      <div className="p-6 max-w-6xl mx-auto pb-20 space-y-10 pt-28">
        
        {/* Navigation Bar */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between"
        >
          <button 
            onClick={() => navigate('/admin/users')}
            className="group flex items-center gap-3 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
          >
             <div className="w-10 h-10 rounded-full bg-white/40 dark:bg-white/5 flex items-center justify-center border border-white/40 dark:border-white/10 group-hover:border-indigo-500 transition-all">
                <i className="ph-bold ph-caret-left" />
             </div>
             <span className="text-[11px] font-black uppercase tracking-widest ps-1">Back to Registry</span>
          </button>
          
          <button 
            onClick={handleToggleBan}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-premium border ${
              user?.is_banned 
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
            }`}
          >
             <i className={`ph-bold ${user?.is_banned ? 'ph-shield-check' : 'ph-shield-warning'} text-lg`} />
             {user?.is_banned ? 'Restore Authorization' : 'Restrict Account'}
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Core Profile */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 space-y-8"
          >
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-8 text-center relative overflow-hidden group shadow-premium">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-indigo-500/10 transition-all" />
              
              <div className="relative inline-block mb-6">
                <div className="w-32 h-32 rounded-full bg-white dark:bg-slate-900 border-8 border-indigo-500/10 dark:border-white/5 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-4xl shadow-xl">
                  {getInitials(user?.name)}
                </div>
                {user?.is_banned && (
                  <div className="absolute -top-1 -right-1 w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center border-4 border-white dark:border-slate-950">
                    <i className="ph-fill ph-prohibit" />
                  </div>
                )}
              </div>

              <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
                {user?.name || 'UNKNOWN_NODE'}
              </h1>
              <div className="mt-4 flex flex-col items-center gap-3">
                 <span className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest">
                   <i className="ph-fill ph-briefcase" /> {user?.job_title || 'SECTOR_NOT_DEFINED'}
                 </span>
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Node_ID: #{user?.id.toString().padStart(6, '0')}</span>
              </div>
            </div>

            {/* Vital Stats */}
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-8 space-y-6 shadow-premium">
               <div className="flex items-center gap-3 mb-2">
                 <div className="h-4 w-1 bg-indigo-500 rounded-full" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Vitals</span>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                     <div className="text-[9px] font-black text-slate-400 uppercase mb-1">State</div>
                     <div className={`text-xs font-black uppercase ${user?.is_banned ? 'text-rose-500' : 'text-emerald-500'}`}>{user?.is_banned ? 'Banned' : 'Authorized'}</div>
                  </div>
                  <div className="bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                     <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Verified</div>
                     <div className="text-xs font-black text-indigo-500 uppercase">Lvl_2</div>
                  </div>
               </div>

               <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                    <i className="ph-thin ph-calendar-blank text-2xl" />
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-tighter opacity-60">Registration_Epoch</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                    <i className="ph-thin ph-map-pin text-2xl" />
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-tighter opacity-60">Geo_Locator</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{user?.location || 'NODE_GLOBAL'}</div>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>

          {/* Right Column: Detailed Data */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8 space-y-8"
          >
            {/* Communication Protocols */}
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-10 shadow-premium">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-8">Access Protocols</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-5 p-6 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl group hover:border-indigo-500 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                    <i className="ph-thin ph-envelope text-2xl" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Electronic_Mail</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={user?.email}>{user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-5 p-6 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl group hover:border-indigo-500 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <i className="ph-thin ph-phone text-2xl" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Direct_Link</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.phone || 'UNCONNECTED'}</p>
                  </div>
                </div>
              </div>

              {(user?.linkedin_url || user?.github_url) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {user?.linkedin_url && (
                    <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-5 p-6 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl hover:border-blue-500 transition-all group">
                       <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                         <i className="ph-fill ph-linkedin-logo text-2xl" />
                       </div>
                       <div className="overflow-hidden">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Social_Neural_Net</p>
                         <p className="text-sm font-bold text-slate-900 dark:text-white truncate">LinkedIn_Protocol</p>
                       </div>
                    </a>
                  )}
                  {user?.github_url && (
                    <a href={user.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-5 p-6 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl hover:border-slate-400 transition-all group">
                       <div className="w-12 h-12 rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                         <i className="ph-fill ph-github-logo text-2xl" />
                       </div>
                       <div className="overflow-hidden">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Central_Repo_Auth</p>
                         <p className="text-sm font-bold text-slate-900 dark:text-white truncate">GitHub_Origin</p>
                       </div>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Neural Matrix: Skills */}
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-10 shadow-premium">
               <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-8">Neural Matrix / Skill Extraction</h3>
               
               <div className="flex flex-wrap gap-3">
                  {Array.isArray(user?.skills) && user.skills.length > 0 ? (
                    user.skills.map((skill, idx) => (
                      <motion.span 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + (idx * 0.05) }}
                        className="px-4 py-2 bg-indigo-500/5 dark:bg-white/5 border border-indigo-500/10 dark:border-white/10 rounded-xl text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter"
                      >
                        {skill.name || skill}
                      </motion.span>
                    ))
                  ) : (
                    <div className="w-full flex flex-col items-center justify-center py-12 text-center opacity-40">
                      <i className="ph-thin ph-mask-unhappy text-6xl mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">No Extraction Data Found</p>
                    </div>
                  )}
               </div>
            </div>

          </motion.div>
        </div>
      </div>
    </HUDLayout>
  );
}