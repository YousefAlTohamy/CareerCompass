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
        setError(t('admin.system.invalid_response'));
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
      setError(t('admin.system.failed_stats'));
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
        services: { 
            [t('admin.health.database')]: 'offline', 
            [t('admin.health.cache')]: 'offline', 
            [t('admin.health.ai')]: 'offline' 
        }
      });
    }
  };

  const checkBatchProgress = async () => {
    try {
      const response = await adminAPI.getAdminBatchProgress();
      if (response.data && response.data.success) {
        setBatchProgress(response.data.data);
      }
    } catch (err) {
      console.error('Batch progress check failed:', err);
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
      color: 'from-purple-500/20 to-fuchsia-500/20',
      accent: 'text-purple-400',
    },
    {
      title: t('admin.stats.targets'),
      value: stats?.total_targets?.toLocaleString() || '0',
      icon: 'ph-target',
      color: 'from-orange-500/20 to-amber-500/20',
      accent: 'text-orange-400',
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <LayoutDashboard className="text-[var(--cc-primary)]" />
              {t('admin.title')}
            </h1>
            <p className="text-slate-500 font-mono text-sm mt-1">
              // UNIT_ID: CC-ADMIN-ALPHA-01 // STATUS: {healthData.status.toUpperCase()}
            </p>
          </div>
          <button 
            onClick={fetchDashboardStats}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-xs font-bold uppercase tracking-widest text-[var(--cc-primary)]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
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
              className={`relative overflow-hidden p-6 rounded-3xl border border-white/5 bg-gradient-to-br ${card.color} group hover:border-[var(--cc-primary)]/30 transition-all`}
            >
              <div className="relative z-10">
                <div className={`p-3 rounded-2xl bg-black/20 w-fit mb-4 ${card.accent}`}>
                  <i className={`${card.icon} text-2xl`} />
                </div>
                <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{card.title}</div>
                <div className="text-3xl font-black text-white tracking-tight">{card.value}</div>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                <i className={`${card.icon} text-8xl -mr-4 -mt-4`} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart */}
          <div className="lg:col-span-2 glass-card p-8 border-white/5 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('admin.neural_performance')}</h3>
                  <p className="text-xs text-slate-500 font-mono">SIGNAL_STRENGTH: OPTIMAL</p>
                </div>
              </div>
            </div>

            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fontFamily: 'var(--cc-mono)' }}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fontFamily: 'var(--cc-mono)' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#00D2FF' }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D2FF" />
                      <stop offset="100%" stopColor="#9D50BB" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* System Health Sidebar */}
          <div className="space-y-6">
            
            <div className="glass-card p-6 border-white/5 rounded-3xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Activity size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">{t('admin.health.status')}</h3>
              </div>

              <div className="space-y-4">
                {Object.entries(healthData.services).map(([service, status]) => (
                  <div key={service} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <Server size={14} className="text-slate-500" />
                      <span className="text-sm font-medium text-slate-300">{service}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : status === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${status === 'online' ? 'text-emerald-400' : status === 'checking' ? 'text-amber-400' : 'text-rose-400'}`}>
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
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Signal Ingestion</span>
                     </div>
                     {batchProgress?.status === 'running' && <Loader2 size={14} className="text-amber-400 animate-spin" />}
                  </div>
                  
                  <div className="space-y-1">
                     <div className="flex justify-between text-[10px] font-mono mb-1">
                        <span className="text-slate-500">EPOCH_BATCH_01</span>
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
                     // THREAD_STATE: {batchProgress?.status?.toUpperCase() || 'STANDBY'} <br/>
                     // LAST_PULSE: {batchProgress?.last_run || 'N/A'}
                  </p>
               </div>
            </div>

          </div>
        </div>
      </div>
    </HUDLayout>
  );
}