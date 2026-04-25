import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Users, 
  Briefcase, 
  Database, 
  Target, 
  TrendingUp, 
  Activity, 
  AlertCircle,
  Server,
  RefreshCw,
  LayoutDashboard,
  HeartPulse,
  Zap,
  Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminAPI } from '../../api/endpoints';
import HUDLayout from '../../components/HUDLayout';
import { useTranslation } from 'react-i18next';

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

  useEffect(() => {
    fetchDashboardStats();
    checkSystemHealth();
    const healthInterval = setInterval(checkSystemHealth, 30000);
    
    // Initial batch progress check
    checkBatchProgress();
    // Poll batch progress every 5 seconds
    const batchInterval = setInterval(checkBatchProgress, 5000);
    
    return () => {
      clearInterval(healthInterval);
      clearInterval(batchInterval);
    };
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminAPI.getAdminDashboardStats();
      if (response.data && response.data.success) {
        setStats(response.data.data);
      } else {
        setError('Invalid response from server.');
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
      setError('Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  const checkSystemHealth = async () => {
    try {
      const response = await adminAPI.getAdminSystemHealth();
      if (response.data && response.data.success) {
        setHealthData(response.data.data);
      }
    } catch (err) {
      console.error('Health check failed:', err);
      setHealthData({
        status: 'critical',
        services: { 'Database': 'offline', 'Cache & Queue': 'offline', 'AI Services': 'offline' }
      });
    }
  };

  const statCards = [
    {
      title: t('admin.stats.users'),
      value: stats?.total_students?.toLocaleString() || '0',
      icon: 'ph-users',
      color: 'from-blue-500/20 to-indigo-500/20',
      accent: 'text-blue-400',
    },
    {
      title: t('admin.stats.jobs'),
      value: stats?.total_jobs?.toLocaleString() || '0',
      icon: 'ph-briefcase',
      color: 'from-emerald-500/20 to-teal-500/20',
      accent: 'text-emerald-400',
    },
    {
      title: t('admin.stats.sources'),
      value: stats?.total_sources?.toLocaleString() || '0',
      icon: 'ph-database',
      color: 'from-fuchsia-500/20 to-purple-500/20',
      accent: 'text-fuchsia-400',
    },
    {
      title: t('admin.stats.targets'),
      value: stats?.total_targets?.toLocaleString() || '0',
      icon: 'ph-target',
      color: 'from-amber-500/20 to-orange-500/20',
      accent: 'text-amber-400',
    },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-xl p-4 border border-indigo-500/30 shadow-2xl rounded-2xl">
          <p className="text-slate-400 font-black mb-1 text-[10px] uppercase tracking-widest">{label}</p>
          <p className="text-white font-black text-xl flex items-center gap-2">
            <i className="ph-fill ph-briefcase text-indigo-400 text-lg"/> 
            {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <HUDLayout loading={loading}>
      <div className="p-6 max-w-7xl mx-auto pb-20 space-y-10 pt-28">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-indigo-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500">{t('admin.title')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
              {t('admin.diagnostics')} <span className="text-indigo-600 dark:text-indigo-400">{t('admin.neural_performance')}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm font-medium max-w-lg">
              {t('dashboard.market')}
            </p>
          </div>

          <div className="flex items-center gap-4">
             <button 
               onClick={fetchDashboardStats}
               className="p-3 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-all active:scale-90"
             >
               <i className="ph-bold ph-arrows-clockwise text-xl" />
             </button>
          </div>
        </motion.div>

        {/* Error Alert */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4 text-rose-500"
          >
            <i className="ph-fill ph-warning-circle text-2xl" />
            <div className="text-sm font-bold">{error}</div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-20 blur-xl group-hover:opacity-40 transition-opacity rounded-3xl`} />
              <div className="relative bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-3xl p-6 shadow-sm overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-premium ${stat.accent}`}>
                    <i className={`ph-thin ${stat.icon} text-3xl`} />
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white/50 dark:bg-white/5 rounded-lg border border-white/20">
                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                     <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Live</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{stat.title}</h3>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{stat.value}</div>
                </div>
                {/* Decorative scanning line */}
                <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-700" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Scraping Activity Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-3xl p-8 shadow-premium"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                  <i className="ph-thin ph-chart-bar text-indigo-500 text-2xl" />
                  {t('admin.inbound_flow')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Daily job scraping activity volume</p>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">7-Day Matrix</span>
              </div>
            </div>
            
            <div className="h-[350px] w-full">
              {stats?.jobs_chart_data && stats.jobs_chart_data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.jobs_chart_data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00D2FF" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#9D50BB" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--cc-text-tertiary)', fontSize: 10, fontWeight: 900 }}
                      dy={15}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--cc-text-tertiary)', fontSize: 10, fontWeight: 900 }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar 
                      dataKey="count" 
                      fill="url(#barGrad)" 
                      radius={[12, 12, 4, 4]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                  <i className="ph-thin ph-cloud-slash text-5xl text-slate-300 dark:text-slate-700 mb-4" />
                  <p className="text-slate-400 font-bold text-sm">// NO_DATA_STREAM_DETECTED</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* System Health Sidebar */}
          <div className="space-y-6">
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.5 }}
               className="bg-slate-900 rounded-[32px] p-8 border border-white/10 shadow-2xl relative overflow-hidden group"
             >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[60px] group-hover:bg-emerald-500/40 transition-all duration-700" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black text-white flex items-center gap-3">
                      <i className="ph-thin ph-shield-check text-emerald-400 text-2xl" />
                      {t('admin.diagnostics')}
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      healthData.status === 'operational' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      healthData.status === 'checking' ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}>
                      {t(`admin.health.${healthData.status}`)}
                    </div>
                  </div>

                  <div className="space-y-5">
                    {Object.entries(healthData.services).map(([serviceName, serviceStatus]) => (
                      <div key={serviceName} className="bg-white/5 border border-white/5 p-4 rounded-2xl group/item hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300 group-hover/item:text-white transition-colors">{serviceName}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              {serviceStatus === 'online' ? t('admin.health.operational') : serviceStatus === 'offline' ? t('admin.health.degraded') : t('admin.health.checking')}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${
                              serviceStatus === 'online' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] animate-pulse' :
                              serviceStatus === 'checking' ? 'bg-slate-500' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                            }`}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5">
                     <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">LAST_SYNC</div>
                     <div className="text-xs font-mono text-emerald-400/70">{new Date().toLocaleTimeString()} :: NODE_OS_STABLE</div>
                  </div>
                </div>
             </motion.div>

             {/* Quick Actions */}
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.6 }}
               className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[32px] p-8 shadow-premium"
             >
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-6">Internal Links</h3>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { name: 'User Directory', path: '/admin/users', icon: 'ph-users', color: 'text-blue-500' },
                    { name: 'Job Index', path: '/admin/jobs', icon: 'ph-briefcase', color: 'text-emerald-500' },
                    { name: 'Data Sources', path: '/admin/sources', icon: 'ph-database', color: 'text-fuchsia-500' },
                  ].map((link) => (
                    <a 
                      key={link.name} 
                      href={link.path}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-indigo-500/50 hover:bg-white dark:hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-900 ${link.color} shadow-sm group-hover:scale-110 transition-transform`}>
                          <i className={`ph-bold ${link.icon} text-lg`} />
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{link.name}</span>
                      </div>
                      <i className="ph-bold ph-caret-right text-slate-300 dark:text-slate-700 group-hover:text-indigo-500 transition-colors" />
                    </a>
                  ))}
                </div>
             </motion.div>
          </div>

        </div>
      </div>
    </HUDLayout>
  );
}