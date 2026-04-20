import React from 'react';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, Server, Database, Globe, Zap, Cpu, RefreshCw } from 'lucide-react';

export default function SystemStatus() {
    const { t } = useTranslation();

    const systems = [
        { name: t('status_page.systems.api'), status: t('status_page.states.operational'), uptime: '99.98%', icon: Server, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
        { name: t('status_page.systems.ai'), status: t('status_page.states.operational'), uptime: '99.95%', icon: Cpu, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
        { name: t('status_page.systems.scraping'), status: t('status_page.states.operational'), uptime: '98.2%', icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
        { name: t('status_page.systems.db'), status: t('status_page.states.operational'), uptime: '100%', icon: Database, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
        { name: t('status_page.systems.analytics'), status: t('status_page.states.operational'), uptime: '99.9%', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
        { name: t('status_page.systems.websockets'), status: t('status_page.states.maintenance'), uptime: '99.8%', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10' }
    ];

  const incidents = [
    { date: t('status_page.incidents.i1_date'), title: t('status_page.incidents.i1_title'), status: t('status_page.states.completed'), type: t('status_page.states.maintenance') },
    { date: t('status_page.incidents.i2_date'), title: t('status_page.incidents.i2_title'), status: t('status_page.states.resolved'), type: t('status_page.states.incident') },
    { date: t('status_page.incidents.i3_date'), title: t('status_page.incidents.i3_title'), status: t('status_page.states.resolved'), type: t('status_page.states.incident') }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-24 pb-20 px-4 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500 p-8 md:p-12 rounded-3xl text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden"
        >
           <Activity className="absolute bottom-[-20%] right-[-5%] w-64 h-64 opacity-10 rotate-12 pointer-events-none" />
           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 text-white font-black uppercase text-[10px] tracking-widest rounded-lg backdrop-blur-md">
                   {t('status_page.live_status')}
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{t('status_page.title')}</h1>
                <p className="text-emerald-50 font-medium">{t('status_page.as_of')}</p>
              </div>
              <button className="bg-white text-emerald-600 font-black px-8 py-3.5 rounded-xl hover:bg-emerald-50 transition-all active:scale-95 shadow-lg flex items-center gap-2 group">
                 <RefreshCw size={18} className="group-active:rotate-180 transition-transform" />
                 {t('status_page.refresh')}
              </button>
           </div>
        </motion.div>

        {/* System Grid */}
        <div className="grid md:grid-cols-2 gap-6">
           {systems.map((s, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.05 }}
               className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between group hover:border-indigo-200 dark:hover:border-indigo-500 transition-all"
             >
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center ${s.color} border border-transparent group-hover:scale-105 transition-transform`}>
                      <s.icon size={22} />
                   </div>
                   <div>
                      <h3 className="font-black text-slate-800 dark:text-white text-sm">{s.name}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('status_page.uptime')} {s.uptime}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <span className={`w-2 h-2 rounded-full ${s.color.replace('text-', 'bg-')} animate-pulse`}></span>
                   <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{s.status}</span>
                </div>
             </motion.div>
           ))}
        </div>

        {/* History Section */}
        <div className="space-y-6">
           <h2 className="text-xl font-black text-slate-800 dark:text-white px-2 uppercase tracking-widest text-sm">{t('status_page.past_events')}</h2>
           <div className="space-y-4">
              {incidents.map((inc, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                   <div className="space-y-1">
                      <div className="flex items-center gap-2">
                         <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${inc.type === 'maintenance' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600'}`}>
                            {inc.type}
                         </span>
                         <span className="text-xs font-bold text-slate-400">{inc.date}</span>
                      </div>
                      <h3 className="font-black text-slate-800 dark:text-white">{inc.title}</h3>
                   </div>
                   <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                      <CheckCircle2 size={16} /> {inc.status}
                   </div>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
}
