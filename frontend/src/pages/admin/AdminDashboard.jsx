import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Briefcase, Database, Target, TrendingUp, Activity, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminAPI } from '../../api/endpoints';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [randomLinks] = useState(() => {
    const links = [
      { name: 'Manage Users', href: '/admin/users', icon: Users },
      { name: 'Manage Jobs', href: '/admin/jobs', icon: Briefcase },
      { name: 'Manage Sources', href: '/admin/sources', icon: Database },
      { name: 'Manage Target Roles', href: '/admin/targets', icon: Target },
    ];
    return links.sort(() => 0.5 - Math.random()).slice(0, 2);
  });

  useEffect(() => {
    fetchDashboardStats();
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto min-h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl flex flex-col items-center gap-4 border border-red-100 shadow-sm">
          <AlertCircle size={48} className="text-red-400" />
          <h2 className="text-xl font-bold">Error Loading Dashboard</h2>
          <p className="text-sm font-medium">{error}</p>
          <button 
            onClick={fetchDashboardStats} 
            className="mt-2 bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700 transition"
          >
            Try Again
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
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Total Scraped Jobs',
      value: stats?.total_jobs?.toLocaleString() || '0',
      icon: Briefcase,
      trend: 'Total in database',
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      title: 'Active Sources',
      value: stats?.total_sources?.toLocaleString() || '0',
      icon: Database,
      trend: 'Registered domains',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Target Roles',
      value: stats?.total_targets?.toLocaleString() || '0',
      icon: Target,
      trend: 'Currently monitoring',
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  // Helper for tooltip styling
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-slate-100 shadow-premium rounded-xl">
          <p className="text-slate-500 font-bold mb-1">{`Date: ${label}`}</p>
          <p className="text-primary font-black text-lg">{`Jobs: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Admin Overview</h1>
          <p className="text-gray-500 mt-1 font-medium text-sm">Welcome back to the Career Compass command center.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-premium transition-all duration-300 relative overflow-hidden group"
          >
            {/* Background blur effect */}
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-500 ${stat.color.split(' ')[0]}`}></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon size={24} strokeWidth={2.5} />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                <TrendingUp size={12} className={stat.color.split(' ')[1]} />
                Live
              </span>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">{stat.title}</h3>
              <div className="text-3xl font-black text-gray-900 mb-2">{stat.value}</div>
              <div className="text-sm font-medium text-gray-400">
                {stat.trend}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recharts BarChart container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[400px] flex flex-col"
        >
           <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
               <Activity size={20} className="text-primary" />
               Scraping Activity (Last 7 Days)
             </h3>
             <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">Jobs Scraped</span>
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
                      tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar 
                      dataKey="count" 
                      fill="#4f46e5" 
                      radius={[6, 6, 0, 0]} 
                      barSize={40}
                      animationDuration={1500}
                    />
                  </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 mt-4">
                 <Activity size={32} className="text-gray-300 mb-2" />
                 <span className="text-gray-400 font-medium tracking-tight">No scraping data available for the last 7 days.</span>
               </div>
             )}
           </div>
        </motion.div>
        
        {/* Quick Links Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col"
        >
           <h3 className="text-lg font-black text-gray-900 mb-6">Quick Links</h3>
           <div className="space-y-3 flex-1">
             {randomLinks.map((link, idx) => {
               const Icon = link.icon;
               return (
                 <a key={idx} href={link.href} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/30 hover:bg-indigo-50/30 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white shadow-sm text-gray-400 group-hover:text-primary transition-colors">
                        <Icon size={20} />
                      </div>
                      <span className="font-bold text-gray-700 group-hover:text-primary transition-colors">{link.name}</span>
                    </div>
                 </a>
               );
             })}
           </div>
           
           <div className="mt-6 pt-6 border-t border-gray-100">
             <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex items-start gap-3">
               <div className="mt-1">
                 <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
               </div>
               <div>
                 <p className="text-sm font-bold text-indigo-900 tracking-tight">System Status</p>
                 <p className="text-xs font-medium text-indigo-600 mt-0.5">All services are operating normally.</p>
               </div>
             </div>
           </div>
        </motion.div>
      </div>
    </div>
  );
}
