import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Briefcase, MapPin, Calendar, ChevronRight, Trash2, ExternalLink, Activity,
  BookmarkPlus, Send, Users, CheckCircle2, XCircle, Target, AlertCircle, Archive
} from 'lucide-react';
import applicationsAPI from '../../api/applications';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';

// --- STATUS CONFIGURATION (API uses: saved, applied, interviewing, offered, rejected, archived) ---
export const getStatusConfig = (t) => ({
  saved:        { label: t('tracker.status.saved'),        color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700', icon: BookmarkPlus },
  applied:      { label: t('tracker.status.applied'),      color: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800', icon: Send },
  interviewing: { label: t('tracker.status.interviewing'), color: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: Users },
  offered:      { label: t('tracker.status.offered'),      color: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  rejected:     { label: t('tracker.status.rejected'),     color: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800', icon: XCircle },
  archived:     { label: t('tracker.status.archived', 'Archived'), color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700', icon: Archive },
});

// --- RELATIVE DATE HELPER ---
function getRelativeDate(dateStr, t) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t('tracker.today', 'Today');
  if (diffDays === 1) return t('tracker.yesterday', 'Yesterday');
  if (diffDays < 7) return `${diffDays} ${t('tracker.days_ago', 'days ago')}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t('tracker.weeks_ago', 'weeks ago')}`;
  return date.toLocaleDateString();
}

export default function Applications() {
  const { t } = useTranslation();
  const statusConfig = getStatusConfig(t);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadApplications();
  }, []);

  /* ─── Data fetching ──────────────────────────────────────────────── */
  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await applicationsAPI.getApplications();
      setApplications(response.data?.data ?? []);
    } catch (err) {
      console.error('Failed to load applications:', err);
      setError('Failed to load applications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Status update ──────────────────────────────────────────────── */
  const handleStatusChange = async (id, newStatus) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    );
    try {
      await applicationsAPI.updateApplicationStatus(id, newStatus);
      const statusConfig = getStatusConfig(t);
      const statusLabel = statusConfig[newStatus]?.label || newStatus;
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `${t('tracker.status_updated')} ${statusLabel}`,
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error('Failed to update status:', err);
      loadApplications();
      setError(t('tracker.error_update'));
    }
  };

  /* ─── Delete ─────────────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: t('tracker.delete_confirm'),
      text: t('tracker.delete_desc', 'Remove this job from your tracker?'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: t('tracker.delete_yes', 'Yes, remove it!'),
      cancelButtonText: t('profile.cancel'),
      background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
      color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#1e293b',
      borderRadius: '1.25rem',
      customClass: {
        title: 'font-black text-slate-800 dark:text-white',
        htmlContainer: 'font-medium text-slate-600 dark:text-slate-400',
        confirmButton: 'rounded-xl font-bold px-6 py-3',
        cancelButton: 'rounded-xl font-bold px-6 py-3',
      },
    });

    if (!result.isConfirmed) return;

    setApplications((prev) => prev.filter((app) => app.id !== id));
    try {
      await applicationsAPI.deleteApplication(id);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: t('tracker.removed_success'),
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error('Failed to delete application:', err);
      loadApplications();
      Swal.fire({
        icon: 'error',
        title: t('profile.error'),
        text: t('tracker.error_delete'),
        confirmButtonColor: '#6363f1',
      });
    }
  };

  /* ─── Derived state ──────────────────────────────────────────────── */
  const filteredApps =
    activeTab === 'all'
      ? applications
      : applications.filter((app) => app.status === activeTab);

  const interviewCount = applications.filter((a) => a.status === 'interviewing').length;

  /* ─── SKELETON LOADING STATE ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-sans pb-24 transition-colors duration-300">
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
          <div className="h-32 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700" />
          <div className="flex gap-2 pb-2">
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-10 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-10 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-sans pb-24 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* HEADER SECTION */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden transition-colors duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="relative z-10 w-full">
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Activity size={24} strokeWidth={2.5} />
              </div>
              {t('tracker.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('tracker.subtitle', 'Manage your saved opportunities and track your interview progress.')}</p>
          </div>

          {/* QUICK STATS */}
          <div className="flex gap-4 relative z-10 w-full md:w-auto">
            <div className="flex-1 md:flex-none bg-slate-50 dark:bg-slate-900/50 px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
              <p className="text-2xl font-black text-slate-800 dark:text-white">{applications.length}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('tracker.total_tracked', 'Total Tracked')}</p>
            </div>
            <div className="flex-1 md:flex-none bg-indigo-50 dark:bg-indigo-900/30 px-5 py-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 text-center">
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{interviewCount}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 dark:text-indigo-500">{t('tracker.interviews', 'Interviews')}</p>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400 font-medium">
            <AlertCircle size={20} />
            <span className="flex-1">{error}</span>
            <button onClick={loadApplications} className="text-xs font-bold underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* TABS (FILTERS) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'all' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {t('tracker.all_roles', 'All Roles')}
          </button>
          {Object.entries(getStatusConfig(t)).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setActiveTab(activeTab === key ? 'all' : key)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === key ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>

        {/* APPLICATIONS LIST */}
        <div className="space-y-4">
          {/* EMPTY STATE */}
          {filteredApps.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-16 text-center border border-slate-200 dark:border-slate-700 border-dashed shadow-sm transition-colors duration-300"
            >
              <Briefcase size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2">
                {activeTab === 'all' ? t('tracker.empty_title', 'Your tracker is empty') : `${t('tracker.no_apps_for')} "${getStatusConfig(t)[activeTab]?.label}"`}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
                {activeTab === 'all'
                  ? t('tracker.empty_desc', 'Start browsing jobs and save them to track your progress.')
                  : t('tracker.filter_empty', 'Try selecting a different filter above.')}
              </p>
              {activeTab === 'all' ? (
                <Link
                  to="/jobs"
                  className="inline-flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm"
                >
                  {t('tracker.explore_jobs', 'Explore Jobs')} <ChevronRight size={18} className="rtl-flip" />
                </Link>
              ) : (
                <button
                  onClick={() => setActiveTab('all')}
                  className="inline-flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm"
                >
                  {t('tracker.show_all', 'Show All')} <ChevronRight size={18} className="rtl-flip" />
                </button>
              )}
            </motion.div>
          )}

          {/* APPLICATION CARDS */}
          <AnimatePresence mode="popLayout">
            {filteredApps.map((app, index) => {
              const StatusIcon = statusConfig[app.status]?.icon ?? BookmarkPlus;
              return (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500 transition-all group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    {/* Left: Job Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span
                          className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${
                            getStatusConfig(t)[app.status]?.color ?? getStatusConfig(t).saved.color
                          } ${document.documentElement.classList.contains('dark') ? 'brightness-110 contrast-125' : ''}`}
                        >
                          <StatusIcon size={12} /> {getStatusConfig(t)[app.status]?.label ?? app.status}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <Calendar size={12} /> {t('tracker.added', 'Added')} {getRelativeDate(app.created_at, t)}
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {app.job?.title ?? t('jobs.untitled_job', 'Untitled Role')}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                        <span className="text-slate-700 dark:text-slate-300">{app.job?.company ?? '—'}</span>
                        {app.job?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={14} /> {app.job.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions & Status Update */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 md:pl-6 md:border-l border-slate-100 dark:border-slate-700 shrink-0">
                      {/* Status Updater Dropdown */}
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                        className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none"
                      >
                        {Object.entries(getStatusConfig(t)).map(([key, config]) => (
                          <option key={key} value={key}>
                            {config.label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Link
                          to={`/gap-analysis/${app.job?.id}`}
                          className="flex-1 sm:flex-none flex items-center justify-center p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white rounded-xl transition-colors"
                          title={t('jobs.analyze')}
                        >
                          <Target size={18} />
                        </Link>

                        {app.job?.url && (
                          <a
                            href={app.job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-black hover:text-white rounded-xl transition-colors"
                            title={t('jobs.apply')}
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}

                        <button
                          onClick={() => handleDelete(app.id)}
                          className="flex-1 sm:flex-none flex items-center justify-center p-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 hover:bg-rose-500 dark:hover:bg-rose-600 hover:text-white rounded-xl transition-colors"
                          title={t('tracker.delete')}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
