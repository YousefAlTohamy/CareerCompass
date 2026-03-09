import React from 'react';
import { motion } from 'framer-motion';
import { Users, Briefcase, Database, Target, TrendingUp, Activity } from 'lucide-react';

export default function AdminDashboard() {
  // Dummy data for now
  const stats = [
    {
      title: 'Total Users',
      value: '150',
      icon: Users,
      trend: '+12% this month',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Total Scraped Jobs',
      value: '3,420',
      icon: Briefcase,
      trend: '+340 this week',
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      title: 'Active Sources',
      value: '8',
      icon: Database,
      trend: 'All systems operational',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Target Roles',
      value: '12',
      icon: Target,
      trend: '2 new roles tracking',
      color: 'bg-orange-100 text-orange-600',
    },
  ];

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
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-premium transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon size={24} strokeWidth={2.5} />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <TrendingUp size={12} className={stat.color.split(' ')[1]} />
                Pulse
              </span>
            </div>
            
            <div>
              <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">{stat.title}</h3>
              <div className="text-3xl font-black text-gray-900 mb-2">{stat.value}</div>
              <div className="text-sm font-medium text-gray-400">
                {stat.trend}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions or Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[400px]"
        >
           <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
             <Activity size={20} className="text-primary" />
             System Activity
           </h3>
           <div className="w-full h-[300px] flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
             <span className="text-gray-400 font-medium">Activity Chart Visualization (Coming Soon)</span>
           </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
           <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h3>
           <div className="space-y-3">
             <a href="/admin/sources" className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <Database size={18} className="text-gray-400 group-hover:text-primary transition-colors" />
                  <span className="font-medium text-gray-700 group-hover:text-gray-900">Manage Sources</span>
                </div>
             </a>
             <a href="/admin/targets" className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <Target size={18} className="text-gray-400 group-hover:text-primary transition-colors" />
                  <span className="font-medium text-gray-700 group-hover:text-gray-900">Manage Taraget Roles</span>
                </div>
             </a>
           </div>
        </motion.div>
      </div>
    </div>
  );
}
