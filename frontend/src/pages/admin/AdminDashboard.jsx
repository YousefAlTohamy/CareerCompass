import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Activity,
  AlertCircle,
  Server,
  RefreshCw,
  LayoutDashboard,
  Zap,
  Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [healthData, setHealthData] = useState({
    status: 'checking',
    services: {
      [t('admin.health.database')]: 'checking',
      [t('admin.health.cache')]: 'checking',
      [t('admin.health.ai')]: 'checking'
    }
  });

  // Batch Progress State
  const [batchProgress, setBatchProgress] = useState(null);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminAPI.getAdminDashboardStats();
      if (response.data && response.data.success) {
        setStats(response.data.data);
      } else {
        setError(t('admin.system.invalid_response'));
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
      setError(t('admin.system.failed_stats'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const checkSystemHealth = useCallback(async () => {
    try {
      const response = await adminAPI.getAdminSystemHealth();
      if (response.data && response.data.success) {
        setHealthData(response.data.data);
      }
    } catch (err) {
      console.error('Health check failed:', err);
      setHealthData({
        status: 'critical',
        services: {
            [t('admin.health.database')]: 'offline',
            [t('admin.health.cache')]: 'offline',
            [t('admin.health.ai')]: 'offline'
        }
      });
    }
  }, [t]);

  const checkBatchProgress = useCallback(async () => {
    try {
      const response = await adminAPI.getAdminBatchProgress();
      if (response.data && response.data.success) {
        setBatchProgress(response.data.data);
      }
    } catch (err) {
      console.error('Batch progress check failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    checkSystemHealth();
    const healthInterval = setInterval(checkSystemHealth, 30000);

    checkBatchProgress();
    const batchInterval = setInterval(checkBatchProgress, 5000);

    return () => {
      clearInterval(healthInterval);
      clearInterval(batchInterval);
    };
  }, [fetchDashboardStats, checkSystemHealth, checkBatchProgress]);

  const statCards = [
    {
      title: t('admin.stats.users'),
      value: stats?.total_students?.toLocaleString() || '0',
      icon: 'ph-users',
      color: 'from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20',
      accent: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      title: t('admin.stats.jobs'),
      value: stats?.total_jobs?.toLocaleString() || '0',
      icon: 'ph-briefcase',
      color: 'from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20',
      accent: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      title: t('admin.stats.sources'),
      value: stats?.total_sources?.toLocaleString() || '0',
      icon: 'ph-database',
      color: 'from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20',
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: t('admin.stats.targets'),
      value: stats?.total_targets?.toLocaleString() || '0',
      icon: 'ph-target',
      color: 'from-rose-500/10 to-pink-500/10 dark:from-rose-500/20 dark:to-pink-500/20',
      accent: 'text-rose-600 dark:text-rose-400',
    },
  ];

  const chartData = stats?.jobs_by_month?.map(item => ({
    name: item.month,
    count: item.count
  })) || [];

  return (
    <HUDLayout>
      <div className="p-6 max-w-7xl mx-auto pb-20 space-y-8 pt-28">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <LayoutDashboard className="text-indigo-600 dark:text-[var(--cc-primary)]" size={32} />
              {t('admin.title')}
            </h1>
            <p className="text-slate-500 font-mono text-sm tracking-widest uppercase">
              Operations dashboard // current health: {healthData.status.toUpperCase()}
            </p>
          </div>
          <button
            onClick={fetchDashboardStats}
            className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm transition-all text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-[var(--cc-primary)]"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl text-rose-400 text-xs font-bold flex gap-3 items-center">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative overflow-hidden p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/5 bg-gradient-to-br ${card.color} group hover:border-indigo-500/30 dark:hover:border-[var(--cc-primary)]/30 transition-all shadow-md`}
            >
              <div className="relative z-10">
                <div className={`p-3 rounded-2xl bg-white/50 dark:bg-black/20 w-fit mb-4 ${card.accent} shadow-sm`}>
                  <i className={`${card.icon} text-2xl`} />
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{card.title}</div>
                <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{card.value}</div>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                <i className={`${card.icon} text-[10rem] -mr-8 -mt-8`} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Chart */}
          <div className="lg:col-span-2 min-w-0 glass-card p-8 border-white/5 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Imported jobs by month</h3>
                  <p className="text-xs text-slate-500 font-mono tracking-widest">Based on stored jobs from active scraping sources and imports.</p>
                </div>
              </div>
            </div>

            <div className="h-[300px] min-h-[300px] min-w-0 w-full mt-4 flex items-center justify-center">
              {chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      className="text-slate-200 dark:text-white/5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="currentColor"
                      className="text-slate-400 dark:text-slate-500"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontFamily: 'var(--cc-mono)' }}
                    />
                    <YAxis
                      stroke="currentColor"
                      className="text-slate-400 dark:text-slate-500"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontFamily: 'var(--cc-mono)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--cc-bg-card)',
                        border: '1px solid var(--cc-border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--cc-text-primary)'
                      }}
                      itemStyle={{ color: '#6366f1' }}
                      cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    />
                    <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4 opacity-40">
                   <div className="p-4 rounded-full bg-slate-100 dark:bg-white/5">
                      <TrendingUp size={32} className="text-slate-400" />
                   </div>
                   <div className="text-center">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{t('admin.no_performance_data', 'No imported job history yet')}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Run scraping diagnostics or manual extractions to populate this chart.</p>
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* System Health Sidebar */}
          <div className="space-y-6">

            <div className="glass-card p-8 border-slate-200/60 dark:border-white/5 rounded-3xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Activity size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('admin.health.status')}</h3>
              </div>

              <div className="space-y-4">
                {Object.entries(healthData.services).map(([service, status]) => (
                  <div key={service} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm">
                    <div className="flex items-center gap-4">
                      <Server size={18} className="text-slate-400" />
                      <span className="text-base font-bold text-slate-700 dark:text-slate-300">{service}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${status === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : status === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${status === 'online' ? 'text-emerald-600 dark:text-emerald-400' : status === 'checking' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {status === 'online' ? t('admin.system.online') : status === 'checking' ? t('admin.system.checking') : t('admin.system.offline')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('admin.health.last_checked')}</span>
                <span className="text-xs font-mono text-slate-400">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Ingestion Monitor Card */}
            <div className="glass-card p-6 border-white/5 rounded-3xl bg-gradient-to-br from-indigo-500/5 to-transparent relative overflow-hidden group">
               <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Zap size={16} className="text-amber-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Manual scraping batch</span>
                     </div>
                     {batchProgress?.status === 'running' && <Loader2 size={14} className="text-amber-400 animate-spin" />}
                  </div>

                  <div className="space-y-1">
                     <div className="flex justify-between text-[10px] font-mono mb-1">
                        <span className="text-slate-500">Latest run progress</span>
                        <span className="text-[var(--cc-primary)]">{batchProgress?.progress || 0}%</span>
                     </div>
                     <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                           initial={{ width: 0 }}
                           animate={{ width: `${batchProgress?.progress || 0}%` }}
                           className="h-full bg-gradient-to-r from-[var(--cc-primary)] to-indigo-500"
                        />
                     </div>
                  </div>

                  <p className="text-[10px] text-slate-500 font-mono leading-tight">
                     STATUS: {batchProgress?.status?.toUpperCase() || 'IDLE'} <br/>
                     LAST UPDATE: {batchProgress?.last_run || 'N/A'}
                  </p>
               </div>
            </div>

          </div>
        </div>
      </div>
    </HUDLayout>
  );
}
