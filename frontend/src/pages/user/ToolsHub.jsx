import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FileText, Video, BookOpen, MapPin, Users, 
  ArrowRight, Sparkles, ChevronRight, Zap
} from 'lucide-react';
import HUDLayout from '../../components/HUDLayout';

export default function ToolsHub() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  
  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const tools = [
    {
      id: 'cv-builder',
      title: t('tools.cv_builder', 'Smart CV Builder'),
      desc: t('tools.cv_builder_desc', 'AI-powered resume generator with real-time ATS scoring.'),
      icon: FileText,
      color: 'indigo',
      path: '/cv-builder'
    },
    {
      id: 'mock-interview',
      title: t('tools.mock_interview', 'Mock Interview AI'),
      desc: t('tools.mock_interview_desc', 'Hyper-realistic AI interviewer with real-time feedback.'),
      icon: Video,
      color: 'fuchsia',
      path: '/mock-interview'
    },
    {
      id: 'learning',
      title: t('tools.learning', 'Learning Paths'),
      desc: t('tools.learning_desc', 'Track your bridging progress with recommended courses.'),
      icon: BookOpen,
      color: 'emerald',
      path: '/learning'
    },
    {
      id: 'career-planner',
      title: t('tools.career_planner', 'Career Planner'),
      desc: t('tools.career_planner_desc', 'Visualize your 5-year career trajectory and milestones.'),
      icon: MapPin,
      color: 'amber',
      path: '/career-planner'
    },
    {
      id: 'mentorship',
      title: t('tools.mentorship', 'Mentorship'),
      desc: t('tools.mentorship_desc', 'Connect 1-on-1 with industry leaders and experts.'),
      icon: Users,
      color: 'blue',
      path: '/mentorship'
    }
  ];

  return (
    <HUDLayout loading={false} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-10 relative z-10 text-start">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3">
              <Zap size={14} className="animate-pulse" /> {t('tools.dev_suite', 'Development Suite')}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
              {t('tools.title', 'Professional Tools')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 max-w-xl">
              {t('tools.subtitle', 'A comprehensive suite of AI-powered tools designed to accelerate your career growth and bridge the gap to your dream role.')}
            </p>
          </div>
        </div>

        {/* TOOLS GRID */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, idx) => (
            <motion.div 
              key={tool.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link to={tool.path} className="block h-full">
                <div className="glass-card !rounded-3xl p-8 border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 hover:-translate-y-2 transition-all duration-300 group flex flex-col h-full relative overflow-hidden">
                  <div className={`absolute -right-10 -top-10 w-32 h-32 bg-${tool.color}-500/10 rounded-full blur-2xl group-hover:bg-${tool.color}-500/20 transition-colors duration-500`} />
                  
                  <div className={`w-14 h-14 rounded-2xl bg-${tool.color}-500/10 flex items-center justify-center text-${tool.color}-500 mb-6 group-hover:scale-110 transition-transform relative z-10`}>
                    <tool.icon size={28} />
                  </div>
                  
                  <div className="flex-1 relative z-10">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed">
                      {tool.desc}
                    </p>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 relative z-10 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-colors">
                      {t('tools.launch', 'Launch Tool')}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <ArrowRight size={14} className={isRtl ? 'rotate-180' : ''} />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

      </div>
    </HUDLayout>
  );
}
