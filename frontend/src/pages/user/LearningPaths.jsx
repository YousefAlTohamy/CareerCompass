import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  BookOpen, PlayCircle, CheckCircle2, Clock, Trophy, 
  Target, ChevronRight, Zap, GraduationCap, Compass
} from 'lucide-react';
import HUDLayout from '../../components/HUDLayout';
import GraduationDemoPreview from '../../components/GraduationDemoPreview';

export default function LearningPaths() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [activeTab, setActiveTab] = useState('recommended'); // recommended, progress
  
  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const paths = [
    { id: 1, title: 'Advanced React Patterns', provider: 'Frontend Masters', duration: '6h 30m', level: 'Senior', progress: 45, match: 98 },
    { id: 2, title: 'System Design for Web', provider: 'Udacity', duration: '12h 00m', level: 'Lead', progress: 0, match: 92 },
    { id: 3, title: 'GraphQL Mastery', provider: 'Apollo', duration: '4h 15m', level: 'Mid', progress: 100, match: 85 },
  ];

  const stats = [
    { label: t('learning.active_courses', 'Active Courses'), value: '—', icon: PlayCircle, color: 'indigo' },
    { label: t('learning.hours_learned', 'Hours Learned'), value: '—', icon: Clock, color: 'fuchsia' },
    { label: t('learning.skills_gained', 'Skills Bridged'), value: '—', icon: Target, color: 'emerald' },
    { label: t('learning.certificates', 'Certificates'), value: '—', icon: Trophy, color: 'amber' },
  ];

  return (
    <HUDLayout loading={false} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-10 relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-3">
              <Compass size={14} className="animate-pulse" /> {t('learning.skill_tracker', 'Skill Bridging Tracker')}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
              {t('learning.title', 'Learning Hub')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 max-w-xl">
              {t('learning.subtitle', 'Preview how skill gaps can become learning paths after CV analysis and job market data are connected.')}
            </p>
          </div>
        </div>

        <GraduationDemoPreview>
          {t('learning.preview_note', 'Course progress and certificates are not tracked yet. Cards below are sample recommendations for demo navigation.')}
        </GraduationDemoPreview>

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className={`glass-card !rounded-3xl p-6 border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 flex items-center gap-4 group hover:border-${s.color}-500/30 transition-all`}>
              <div className={`w-12 h-12 rounded-2xl bg-${s.color}-500/10 flex items-center justify-center text-${s.color}-500 group-hover:scale-110 transition-transform`}>
                <s.icon size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</h3>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* TABS & CONTENT */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-4">
            <button 
              onClick={() => setActiveTab('recommended')} 
              className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'recommended' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              {t('learning.recommended', 'Recommended Paths')}
            </button>
            <button 
              onClick={() => setActiveTab('progress')} 
              className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'progress' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              {t('learning.my_progress', 'My Progress')}
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {paths.map((path) => (
              <motion.div 
                key={path.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card !rounded-3xl p-6 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 hover:-translate-y-1 transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <BookOpen size={24} />
                  </div>
                  {path.match && (
                    <div className="px-2 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-black rounded uppercase tracking-widest border border-indigo-500/20">
                      Sample {path.match}% Match
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 mb-6">
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white line-clamp-2 leading-tight">
                    {path.title}
                  </h3>
                  <p className="text-sm font-medium text-slate-500">{path.provider}</p>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">
                  <span className="flex items-center gap-1"><Clock size={12} /> {path.duration}</span>
                  <span className="flex items-center gap-1"><GraduationCap size={12} /> {path.level}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                    <span>{t('learning.progress', 'Progress')}</span>
                    <span className={path.progress === 100 ? 'text-emerald-500' : 'text-indigo-500'}>{path.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${path.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                      style={{ width: `${path.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                  {path.progress === 100 ? (
                    <div className="flex items-center gap-2 text-emerald-500 font-black text-xs uppercase tracking-widest">
                      <CheckCircle2 size={16} /> {t('learning.completed', 'Completed')}
                    </div>
                  ) : (
                    <button disabled className="text-slate-400 font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-not-allowed">
                      {path.progress > 0 ? t('learning.continue', 'Continue') : t('learning.start', 'Start Path')} · Planned <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </HUDLayout>
  );
}
