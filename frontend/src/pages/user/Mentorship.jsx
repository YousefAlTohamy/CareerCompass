import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Users, Star, Calendar, Clock, MapPin, Search, 
  MessageCircle, Video, CheckCircle2, Award, Zap
} from 'lucide-react';
import HUDLayout from '../../components/HUDLayout';

export default function Mentorship() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [activeCategory, setActiveCategory] = useState('All');
  
  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const categories = ['All', 'Frontend', 'Backend', 'UI/UX Design', 'Career Advice'];

  const mentors = [
    { id: 1, name: 'Sarah Jenkins', role: 'Senior UX Engineer', company: 'Google', rating: 4.9, reviews: 124, price: '$50/hr', category: 'UI/UX Design', img: 'SJ' },
    { id: 2, name: 'David Chen', role: 'Staff Frontend Dev', company: 'Meta', rating: 5.0, reviews: 89, price: '$80/hr', category: 'Frontend', img: 'DC' },
    { id: 3, name: 'Amira Hassan', role: 'Engineering Manager', company: 'Netflix', rating: 4.8, reviews: 210, price: '$100/hr', category: 'Career Advice', img: 'AH' },
    { id: 4, name: 'Omar Tariq', role: 'Backend Architect', company: 'Amazon', rating: 4.9, reviews: 156, price: '$70/hr', category: 'Backend', img: 'OT' }
  ];

  const filteredMentors = activeCategory === 'All' ? mentors : mentors.filter(m => m.category === activeCategory);

  return (
    <HUDLayout loading={false} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-10 relative z-10 text-start">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3">
              <Users size={14} className="animate-pulse" /> {t('mentorship.expert_network', 'Expert Network')}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
              {t('mentorship.title', 'Career Mentorship')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 max-w-xl">
              {t('mentorship.subtitle', 'Connect 1-on-1 with industry leaders to accelerate your career growth, review your portfolio, or prepare for interviews.')}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="glass-card !rounded-2xl p-4 border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('mentorship.upcoming', 'Upcoming Sessions')}</p>
                <p className="font-bold text-slate-900 dark:text-white">None Scheduled</p>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/40 dark:bg-slate-900/40 p-2 rounded-3xl backdrop-blur-xl border border-slate-200 dark:border-white/10">
          <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto p-1">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${
                  activeCategory === cat 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-white dark:hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-auto p-1 shrink-0 md:min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={t('mentorship.search', 'Search mentors by name, role, or company...')}
              className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* MENTORS GRID */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredMentors.map((mentor, idx) => (
              <motion.div 
                key={mentor.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card !rounded-3xl p-6 border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 hover:-translate-y-2 transition-all duration-300 group flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-xl shadow-lg border-2 border-white dark:border-slate-800 shrink-0">
                    {mentor.img}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg text-[10px] font-black">
                      <Star size={12} className="fill-amber-400" /> {mentor.rating}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">{mentor.reviews} reviews</span>
                  </div>
                </div>

                <div className="space-y-1 mb-6 flex-1">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-1">{mentor.name}</h3>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 line-clamp-1">{mentor.role}</p>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1 mt-2">
                    <Award size={12} /> {mentor.company}
                  </p>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-white/5 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">{t('mentorship.rate', 'Rate')}</span>
                    <span className="text-emerald-500 text-sm">{mentor.price}</span>
                  </div>
                  <button className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg flex items-center justify-center gap-2">
                    <Video size={16} /> {t('mentorship.book_session', 'Book Session')}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </HUDLayout>
  );
}
