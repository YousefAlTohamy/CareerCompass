import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Milestone, ArrowRight, CheckCircle2, Lock, Unlock, 
  MapPin, Star, TrendingUp, Compass, Target
} from 'lucide-react';
import HUDLayout from '../../components/HUDLayout';

export default function CareerPlanner() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  
  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const milestones = [
    { 
      id: 1, 
      year: 'Current', 
      role: 'Frontend Developer', 
      status: 'completed', 
      requirements: ['React Mastery', 'Tailwind CSS', 'API Integration'] 
    },
    { 
      id: 2, 
      year: 'Year 1-2', 
      role: 'Senior Frontend Engineer', 
      status: 'active', 
      progress: 65,
      requirements: ['System Design', 'Performance Optimization', 'Mentoring Juniors', 'Advanced State Management'] 
    },
    { 
      id: 3, 
      year: 'Year 3-5', 
      role: 'Frontend Tech Lead', 
      status: 'locked', 
      requirements: ['Architecture Planning', 'Cross-team Leadership', 'Agile Management', 'Scalability Solutions'] 
    }
  ];

  return (
    <HUDLayout loading={false} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-10 relative z-10 text-start">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-amber-500 mb-3">
              <MapPin size={14} className="animate-pulse" /> {t('career_planner.pathing_engine', 'Neural Pathing Engine')}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
              {t('career_planner.title', 'Career Planner')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 max-w-xl">
              {t('career_planner.subtitle', 'Visualize your 5-year career trajectory and the exact milestones required to achieve your ultimate goals.')}
            </p>
          </div>
        </div>

        {/* TIMELINE */}
        <div className="relative pt-10">
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1 bg-slate-200 dark:bg-white/5 -translate-x-1/2 rounded-full hidden md:block" />
          
          <div className="space-y-12">
            {milestones.map((ms, idx) => (
              <motion.div 
                key={ms.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`relative flex flex-col md:flex-row gap-8 items-center ${idx % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Node */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-16 h-16 rounded-full glass-card border-4 border-slate-50 dark:border-slate-950 items-center justify-center shadow-xl z-10 bg-white dark:bg-slate-900">
                  {ms.status === 'completed' && <CheckCircle2 className="text-emerald-500" size={24} />}
                  {ms.status === 'active' && <TrendingUp className="text-indigo-500 animate-pulse" size={24} />}
                  {ms.status === 'locked' && <Lock className="text-slate-400" size={24} />}
                </div>

                {/* Content */}
                <div className={`w-full md:w-1/2 ${idx % 2 === 0 ? 'md:pl-16' : 'md:pr-16 text-left md:text-right'} ${isRtl ? (idx % 2 === 0 ? 'md:pr-16 md:pl-0 text-right' : 'md:pl-16 md:pr-0 text-right md:text-left') : ''}`}>
                  <div className={`glass-card !rounded-3xl p-8 border-2 transition-all ${
                    ms.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' : 
                    ms.status === 'active' ? 'border-indigo-500/30 bg-indigo-500/5 shadow-lg shadow-indigo-500/10' : 
                    'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 opacity-80'
                  }`}>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest mb-4 ${
                      ms.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 
                      ms.status === 'active' ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 
                      'bg-slate-200 dark:bg-white/10 text-slate-500'
                    }`}>
                      {ms.year}
                    </div>
                    
                    <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-6">
                      {ms.role}
                    </h3>

                    {ms.status === 'active' && ms.progress !== undefined && (
                      <div className="mb-6 space-y-2">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
                          <span>{t('career_planner.progress', 'Progress to Next Level')}</span>
                          <span className="text-indigo-500">{ms.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }} 
                            whileInView={{ width: `${ms.progress}%` }} 
                            className="h-full bg-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-white/10 pb-2">
                        {t('career_planner.requirements', 'Key Requirements')}
                      </h4>
                      <ul className="space-y-2">
                        {ms.requirements.map((req, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                            {ms.status === 'completed' ? (
                              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                            ) : ms.status === 'active' && i < 2 ? (
                              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-700 shrink-0" />
                            )}
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </HUDLayout>
  );
}
