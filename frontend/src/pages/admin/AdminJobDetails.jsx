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
  Briefcase, 
  Trash2, 
  Link as LinkIcon, 
  ShieldCheck,
  Target,
  FileText,
  Clock,
  Database,
  ArrowLeft,
  BadgeDollarSign,
  Layers,
  Tags
} from 'lucide-react';

const unwrapJobPayload = (response) => {
  const payload = response?.data;
  return payload?.data?.data ?? payload?.data ?? payload ?? null;
};

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const listFrom = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to delimiter parsing.
    }
    return trimmed.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'object') return Object.values(value).filter(Boolean);
  return [value];
};

const itemLabel = (item) => {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return String(item || '');
  return item.name || item.title || item.skill || item.label || item.requirement || '';
};

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

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
        const payload = unwrapJobPayload(response);
        if (payload?.id || payload?.title) {
          setJob(payload);
        } else {
          setError(t('admin.system.node_not_found', 'Job was not found or the response was empty.'));
        }
      } catch (err) {
        console.error('Failed to fetch job details:', err);
        setError(err.response?.status === 404
          ? t('admin.system.node_not_found', 'Job was not found.')
          : t('admin.system.health_check_failed'));
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
        await Swal.fire({
          title: t('common.error', 'Action failed'),
          text: err.response?.data?.message || 'The job could not be deleted. Please try again.',
          icon: 'error',
          background: 'rgba(15, 23, 42, 0.95)',
          color: '#fff',
        });
      }
    }
  };

  if (loading) {
    return (
      <HUDLayout loading={true} loadingType="standard">
        <div className="p-6 max-w-6xl mx-auto min-h-[80vh] pt-28" />
      </HUDLayout>
    );
  }

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

  const jobType = job.job_type || job.type || 'Not specified';
  const workType = job.work_type || 'Not specified';
  const salaryRange = job.salary_range || job.salary || null;
  const sourceLabel = job.scraping_source?.name || job.scrapingSource?.name || job.source || 'Unknown source';
  const sourceType = job.scraping_source?.type || job.source_type || null;
  const skills = [
    ...listFrom(job.required_skills || job.requiredSkills),
    ...listFrom(job.skills),
  ].map(itemLabel).filter(Boolean);
  const uniqueSkills = [...new Set(skills)];
  const requirements = listFrom(job.requirements).map(itemLabel).filter(Boolean);
  const description = stripHtml(job.description) || 'No description was stored for this job.';
  const jobUrl = job.url || job.apply_url || job.external_url || null;

  return (
    <HUDLayout loading={false}>
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
            <div className="glass-card p-10 border-slate-200 dark:border-white/10 rounded-[32px] space-y-8 bg-white/70 dark:bg-slate-900/50">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] uppercase tracking-widest">
                  <Briefcase size={12} />
                  {jobType}
                  <span className="text-slate-400">/</span>
                  {workType}
                </div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white leading-tight">{job.title || 'Untitled job'}</h1>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-white/5 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
                  <Building2 size={18} className="text-indigo-500" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Company</p>
                    <p className="font-bold">{job.company || 'Unknown company'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-white/5 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
                  <MapPin size={18} className="text-indigo-500" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Location</p>
                    <p className="font-bold">{job.location || 'Not specified'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-white/5 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
                  <Layers size={18} className="text-indigo-500" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Work model</p>
                    <p className="font-bold">{workType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-white/5 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
                  <BadgeDollarSign size={18} className="text-emerald-500" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Salary</p>
                    <p className="font-bold">{salaryRange || 'Not published'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  <FileText size={14} />
                  {t('jobs.description')}
                </div>
                <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-line bg-white/60 dark:bg-white/5 p-6 rounded-2xl border border-slate-200 dark:border-white/5">
                  {description}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest">
                    <Tags size={14} /> Skills
                  </div>
                  {uniqueSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {uniqueSkills.map((skill) => (
                        <span key={skill} className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No explicit skill tags were stored for this job.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest">
                    <Target size={14} /> Requirements
                  </div>
                  {requirements.length > 0 ? (
                    <ul className="space-y-2">
                      {requirements.map((requirement, index) => (
                        <li key={`${requirement}-${index}`} className="text-sm text-slate-600 dark:text-slate-300 flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                          <span>{requirement}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No structured requirements were stored separately.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass-card p-6 border-white/10 rounded-3xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/5 pb-4">{t('admin.metadata', 'Metadata')}</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold">
                    <Clock size={14} />
                    Created
                  </div>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300">{formatDate(job.created_at)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold">
                    <Database size={14} />
                    Source
                  </div>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300 text-end">{sourceLabel}</span>
                </div>
                {sourceType && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold">
                      <Layers size={14} />
                      Source type
                    </div>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 text-end">{sourceType}</span>
                  </div>
                )}
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold">
                    <LinkIcon size={14} />
                    Job URL
                  </div>
                  {jobUrl ? (
                    <a href={jobUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-mono truncate max-w-[160px]">{t('admin.link', 'Open link')}</a>
                  ) : (
                    <span className="text-xs text-slate-400">Not available</span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </HUDLayout>
  );
}
