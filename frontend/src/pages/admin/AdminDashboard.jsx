import React, { useState, useEffect } from 'react';
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
  LayoutDashboard
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminAPI } from '../../api/endpoints';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dynamic Health Check State
  const [healthData, setHealthData] = useState({
    status: 'checking',
    services: { 'Database': 'checking', 'Cache & Queue': 'checking', 'AI Services': 'checking' }
  });

  const [randomLinks] = useState(() => {
    const links = [
      { name: 'Manage Users', href: '/admin/users', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
      { name: 'Manage Jobs', href: '/admin/jobs', icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { name: 'Manage Sources', href: '/admin/sources', icon: Database, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
      { name: 'Manage Target Roles', href: '/admin/targets', icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
    ];
    return links.sort(() => 0.5 - Math.random()).slice(0, 3); // Show 3 links instead of 2 for better layout
  });

  useEffect(() => {
    fetchDashboardStats();
    
    // Initial Health Check
    checkSystemHealth();
    // Set up polling every 30 seconds for health check (background)
    const healthInterval = setInterval(checkSystemHealth, 30000);
    
    return () => clearInterval(healthInterval);
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
      // Assuming you added getAdminSystemHealth to endpoints.js as discussed previously
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

  // Unified Loading State
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[80vh] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-slate-400 font-medium text-sm">Loading command center...</p>
      </div>
    );
  }

  // Unified Error State
  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto min-h-[80vh] flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4 border border-slate-200 shadow-sm text-center w-full">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-2">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Error Loading Dashboard</h2>
          <p className="text-slate-500 font-medium mb-4">{error}</p>
          <button 
            onClick={fetchDashboardStats} 
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
          >
            <RefreshCw size={18} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.total_students?.toLocaleString() || '0',
      icon: Users,
      trend: 'Registered on platform',
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      iconBg: 'bg-white',
    },
    {
      title: 'Scraped Jobs',
      value: stats?.total_jobs?.toLocaleString() || '0',
      icon: Briefcase,
      trend: 'Total in database',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      iconBg: 'bg-white',
    },
    {
      title: 'Active Sources',
      value: stats?.total_sources?.toLocaleString() || '0',
      icon: Database,
      trend: 'Registered domains',
      color: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
      iconBg: 'bg-white',
    },
    {
      title: 'Target Roles',
      value: stats?.total_targets?.toLocaleString() || '0',
      icon: Target,
      trend: 'Currently monitoring',
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      iconBg: 'bg-white',
    },
  ];

  // Refined Tooltip Styling
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 p-4 border border-slate-700 shadow-xl rounded-xl">
          <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-wider">{label}</p>
          <p className="text-white font-black text-lg flex items-center gap-2">
            <Briefcase size={16} className="text-indigo-400"/> {payload[0].value} Jobs
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto pb-20 space-y-8">
      
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
            <LayoutDashboard className="w-7 h-7" />
          </div>
          Admin Overview
        </h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          Welcome back. Here's a summary of the Career Compass ecosystem.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`rounded-3xl p-6 border ${stat.color} relative overflow-hidden group shadow-sm`}
          >
            {/* Background Decoration */}
            <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 bg-white blur-2xl`}></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 rounded-2xl shadow-sm ${stat.iconBg} ${stat.color.split(' ')[1]}`}>
                <stat.icon size={24} strokeWidth={2.5} />
              </div>
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white/60 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/50 shadow-sm">
                <TrendingUp size={12} className={stat.color.split(' ')[1]} />
                Live
              </span>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-slate-600/80 text-xs font-bold uppercase tracking-wider mb-1">{stat.title}</h3>
              <div className="text-3xl font-black text-slate-900 mb-1 tracking-tight">{stat.value}</div>
              <div className="text-xs font-bold text-slate-500/80">
                {stat.trend}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts & System Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recharts Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 min-h-[400px] flex flex-col"
        >
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
               <Activity size={20} className="text-indigo-600" />
               Scraping Activity (Last 7 Days)
             </h3>
             <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md border border-indigo-100">
               Jobs Scraped
             </span>
           </div>
           
           <div className="flex-1 w-full min-h-[300px]">
             {stats?.jobs_chart_data && stats.jobs_chart_data.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.jobs_chart_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar 
                      dataKey="count" 
                      fill="#4f46e5" 
                      radius={[8, 8, 0, 0]} 
                      barSize={45}
                      animationDuration={1500}
                    />
                  </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 mt-4">
                 <Activity size={32} className="text-slate-300 mb-3" />
                 <span className="text-slate-500 font-bold">No scraping data available for the last 7 days.</span>
               </div>
             )}
           </div>
        </motion.div>
        
        {/* Right Sidebar: Quick Links & Health Status */}
        <div className="space-y-6 flex flex-col">
            
            {/* Real-time Health Check Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-lg border border-slate-800 flex-1 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Server size={20} className="text-emerald-400" />
                  System Status
                </h3>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  healthData.status === 'operational' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  healthData.status === 'checking' ? 'bg-slate-700/50 text-slate-300 border border-slate-600' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {healthData.status}
                </span>
              </div>

              <div className="space-y-4 bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 flex-1">
                {Object.entries(healthData.services).map(([serviceName, serviceStatus]) => (
                  <div key={serviceName} className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-300">{serviceName}</span>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{serviceStatus}</span>
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        serviceStatus === 'online' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] animate-pulse' :
                        serviceStatus === 'checking' ? 'bg-slate-500' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                      }`}></div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Links Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 shrink-0"
            >
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {randomLinks.map((link, idx) => {
                  const Icon = link.icon;
                  return (
                    <a key={idx} href={link.href} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${link.bg} ${link.color} shadow-sm group-hover:scale-110 transition-transform`}>
                            <Icon size={18} strokeWidth={2.5} />
                          </div>
                          <span className="font-bold text-slate-700 group-hover:text-indigo-700 transition-colors text-sm">{link.name}</span>
                        </div>
                    </a>
                  );
                })}
              </div>
            </motion.div>

        </div>
      </div>
    </div>
  );
}