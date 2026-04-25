import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Briefcase, 
  Trash2, 
  ChevronLeft, 
  Link as LinkIcon, 
  ShieldCheck,
  Target,
  FileText,
  Clock,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

export default function AdminJobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
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
          setError(t('admin.system.failed_stats'));
        }
      } catch (err) {
        console.error('Failed to fetch job details:', err);
        setError(t('admin.system.health_check_failed'));
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
  }, [id, t]);

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: t('admin.actions.decommission_record'),
      text: `${t('admin.actions.irreversible')} "${job.title}"`,
      icon: 'warning',
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#fff',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#334155',
      confirmButtonText: t('admin.actions.confirm_purge'),
      cancelButtonText: t('sources.cancel')
    });

    if (result.isConfirmed) {
      try {
        await adminAPI.deleteAdminJob(id);
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
              <ShieldCheck size={48} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{error || t('admin.system.node_not_found', 'Job Node Not Found')}</h2>
            <button 
              onClick={() => navigate('/admin/jobs')} 
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-premium flex items-center gap-2"
            >
              <ArrowLeft size={16} className={isRtl ? 'rotate-180' : ''} />
              {t('sources.back')}
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
                <ArrowLeft size={18} className={isRtl ? 'rotate-180' : ''} />
             </div>
             <span className="font-bold text-sm uppercase tracking-widest">{t('sources.back')}</span>
          </button>

          <button 
            onClick={handleDelete}
            className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl border border-rose-500/20 transition-all flex items-center gap-2"
          >
            <Trash2 size={20} />
            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">{t('admin.actions.purge_job')}</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card p-10 border-white/10 rounded-[32px] space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-mono text-[10px] uppercase tracking-widest">
                  <Briefcase size={12} />
                  {job.type || 'SIGNAL_RECORD'}
                </div>
                <h1 className="text-4xl font-black text-white leading-tight">{job.title}</h1>
              </div>

              <div className="flex flex-wrap gap-6 items-center pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-slate-400">
                  <Building2 size={18} className="text-indigo-400" />
                  <span className="font-bold">{job.company}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin size={18} className="text-indigo-400" />
                  <span className="font-bold">{job.location}</span>
                </div>
                {job.salary && (
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-black">
                    <Target size={18} />
                    {job.salary}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                  <FileText size={14} />
                  {t('jobs.description')}
                </div>
                <div className="text-slate-400 leading-relaxed text-sm whitespace-pre-line bg-white/5 p-6 rounded-2xl border border-white/5">
                  {job.description}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass-card p-6 border-white/10 rounded-3xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white border-b border-white/5 pb-4">{t('admin.metadata', 'Metadata')}</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                    <Clock size={14} />
                    {t('admin.health.last_checked')}
                  </div>
                  <span className="text-xs font-mono text-slate-300">{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                    <LinkIcon size={14} />
                    {t('admin.source', 'Source')}
                  </div>
                  <a href={job.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline text-xs font-mono truncate max-w-[100px]">{t('admin.link', 'Link')}</a>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </HUDLayout>
  );
}