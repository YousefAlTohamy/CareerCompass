import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../../api/endpoints';
import Swal from 'sweetalert2';
import { 
  MapPin, Briefcase, Mail, Linkedin, Github, Phone, User as UserIcon,
  Calendar, LogOut, Edit2, Save, X, Link as LinkIcon, Award, Plus,
  GraduationCap, Target, TrendingUp, Info, Activity, Globe,
  ShieldCheck, Cpu, Database, Zap, ArrowLeft, Settings, ExternalLink,
  ChevronRight, Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TechBadges } from '../../components/AiInsights';
import HUDLayout from '../../components/HUDLayout';

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0][0] || '?').toUpperCase();
};

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try { 
        setLoading(true); 
        const response = await authAPI.getUser(); 
        const data = response?.data?.data ?? response?.data ?? response; 
        setProfile(data); 
    }
    catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
      title: t('nav.logout') + '?', icon: 'question', showCancelButton: true, confirmButtonColor: '#f43f5e',
      background: isDark ? '#1e293b' : '#fff',
      color: isDark ? '#fff' : '#000',
    });
    if (result.isConfirmed) { await logout(); navigate('/login'); }
  };

  const data = profile ?? user;
  const experiences = Array.isArray(data?.experiences) ? data.experiences : [];
  const skills = Array.isArray(data?.skills) ? data.skills : (Array.isArray(data?.profile?.skills) ? data.profile.skills : []);

  return (
    <HUDLayout loading={loading} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-8 relative z-10">
        
        {/* --- COMPACT PROFILE HERO --- */}
        <div className="relative glass-card !rounded-[2.5rem] p-8 md:p-12 border-slate-200 dark:border-white/5 bg-white/60 dark:bg-white/5 backdrop-blur-3xl shadow-xl overflow-hidden group">
           <div className={`absolute top-0 ${isRtl ? 'left-0' : 'right-0'} w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 ${isRtl ? '-translate-x-1/2' : 'translate-x-1/2'} pointer-events-none`} />
           
           <div className="flex flex-col lg:flex-row items-center gap-10 relative z-10">
              {/* Avatar Section */}
              <div className="relative shrink-0">
                 <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-5xl font-black text-white shadow-xl border-4 border-white/20 uppercase relative z-10">
                    {getInitials(data?.name)}
                 </div>
                 <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 shadow-lg z-20">
                    <ShieldCheck size={20} />
                 </div>
              </div>

              {/* Identity Section */}
              <div className="flex-1 text-center lg:text-start space-y-4">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-center lg:justify-start">
                       <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                          ID // {String(data?.id || '0').slice(0,8)}
                       </span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none uppercase italic text-slate-900 dark:text-white">
                       {data?.name}
                    </h1>
                    <p className="text-base md:text-lg font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                       {data?.headline || t('profile.headline')}
                    </p>
                 </div>

                 <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 bg-white/50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm"><Mail size={12} className="text-indigo-500" /> {data?.email}</span>
                    <span className="flex items-center gap-1.5 bg-white/50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm"><MapPin size={12} className="text-emerald-500" /> {data?.location || 'NEURAL_NODE_01'}</span>
                    <span className="flex items-center gap-1.5 bg-white/50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm"><Activity size={12} className="text-fuchsia-500" /> STATUS: ACTIVE</span>
                 </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 w-full lg:w-auto shrink-0">
                 <button onClick={() => navigate('/settings')} className="px-8 py-3 bg-indigo-600 hover:bg-slate-900 dark:hover:bg-white text-white dark:hover:text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Settings size={14} /> {t('profile.edit')}
                 </button>
                 <button onClick={handleLogout} className="px-8 py-3 glass-card !rounded-xl border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                    <LogOut size={14} /> {t('nav.logout')}
                 </button>
              </div>
           </div>
        </div>

        {/* --- COMPACT STATS ROW --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[
              { label: t('hud_labels.exp_units', 'EXPERIENCE'), val: data?.total_experience_years || 0, unit: 'YEARS', icon: Calendar, color: 'indigo' },
              { label: t('hud_labels.seniority', 'SENIORITY'), val: data?.seniority || 'MID', unit: 'SYNC', icon: Target, color: 'fuchsia' },
              { label: t('dashboard.skills', 'SKILLS'), val: skills.length, unit: 'NODES', icon: Cpu, color: 'emerald' },
              { label: t('hud_labels.market_pulse', 'MATCH'), val: '94.2%', unit: 'INDEX', icon: TrendingUp, color: 'amber' }
           ].map((stat, i) => (
              <div key={i} className="bg-white/50 dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md flex flex-col items-center justify-center text-center group hover:border-indigo-500/20 transition-all">
                 <div className={`p-3 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-600 dark:text-${stat.color}-400 mb-3 group-hover:scale-110 transition-transform`}><stat.icon size={20} /></div>
                 <div>
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white uppercase italic leading-none">{stat.val}</p>
                    <p className="text-[7px] font-black text-slate-300 dark:text-slate-600 tracking-widest mt-1">{stat.unit}</p>
                 </div>
              </div>
           ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
           {/* LEFT COLUMN */}
           <aside className="lg:col-span-4 space-y-8">
              {/* CONTACTS PANEL */}
              <div className="bg-white/60 dark:bg-slate-900/50 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md">
                 <h3 className="text-sm font-black mb-6 flex items-center gap-2 uppercase tracking-tighter">
                    <Database size={16} className="text-indigo-500" /> {t('hud_labels.contact_points', 'Data Nodes')}
                 </h3>
                 <div className="space-y-4">
                    {[
                       { icon: Mail, label: 'Mail', val: data?.email, color: 'indigo' },
                       { icon: Linkedin, label: 'LinkedIn', val: data?.profile?.linkedin_url || 'UNDEFINED', color: 'blue' },
                       { icon: Github, label: 'GitHub', val: data?.profile?.github_url || 'UNDEFINED', color: 'slate' }
                    ].map((item, i) => (
                       <div key={i} className="flex items-center gap-3 group">
                          <div className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 text-slate-400 group-hover:text-indigo-500 transition-colors"><item.icon size={14} /></div>
                          <div className="overflow-hidden text-start">
                             <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest">{item.label}</p>
                             <p className="font-bold text-xs truncate uppercase text-slate-900 dark:text-slate-200">{item.val}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

              {/* NEURAL SKILLS PANEL */}
              <div className="bg-white/60 dark:bg-slate-900/50 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-6 opacity-5 -z-10"><Zap size={80} /></div>
                 <h3 className="text-sm font-black mb-6 flex items-center gap-2 uppercase tracking-tighter">
                    <Cpu size={16} className="text-emerald-500" /> {t('profile.skills')}
                 </h3>
                 <div className="flex flex-wrap gap-2">
                    {skills.map((s, i) => ( 
                       <span key={i} className="px-3 py-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 rounded-lg hover:scale-105 transition-all cursor-default">
                          {s.name || s}
                       </span> 
                    ))}
                 </div>
              </div>
           </aside>

           {/* RIGHT COLUMN */}
           <div className="lg:col-span-8 bg-white/60 dark:bg-slate-900/50 rounded-3xl p-8 md:p-10 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md">
              <div className="flex items-center gap-4 mb-10">
                 <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl"><Activity size={20} /></div>
                 <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex-1 text-start">
                    {t('hud_labels.professional_timeline', 'Professional Timeline')}
                 </h3>
                 <div className="h-px bg-slate-100 dark:bg-white/10 grow hidden md:block" />
                 <Bookmark size={16} className="text-slate-300" />
              </div>

              <div className="space-y-10 relative">
                 <div className={`absolute top-0 ${isRtl ? 'right-5' : 'left-5'} w-0.5 h-full bg-slate-100 dark:bg-white/5 rounded-full`} />
                 
                 {experiences.length === 0 ? (
                    <div className="text-center py-16 opacity-30">
                       <Briefcase size={48} className="mx-auto mb-3" />
                       <p className="font-black text-[10px] uppercase tracking-widest">{t('dashboard.no_experience', 'NO_DATA_NODES')}</p>
                    </div>
                 ) : experiences.map((exp, i) => (
                    <motion.div 
                       key={i} 
                       initial={{ opacity: 0, y: 10 }}
                       whileInView={{ opacity: 1, y: 0 }}
                       viewport={{ once: true }}
                       className={`relative ${isRtl ? 'pr-12' : 'ps-12'} space-y-4 group text-start`}
                    >
                       <div className={`absolute w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border-2 border-indigo-500/30 ${isRtl ? 'right-0' : 'left-0'} top-0 flex items-center justify-center text-indigo-500 shadow-md z-10 group-hover:bg-indigo-600 group-hover:text-white transition-all`}>
                          <Briefcase size={16} />
                       </div>
                       
                       <div className="space-y-3">
                          <div className="flex flex-col md:flex-row justify-between items-start gap-2">
                             <div>
                                <h4 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{exp.title}</h4>
                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">{exp.company}</p>
                             </div>
                             <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-white/5 whitespace-nowrap">
                                {exp.start_date} // {exp.is_current ? t('profile.present', 'PRESENT') : exp.end_date}
                             </span>
                          </div>
                          
                          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                             {exp.description}
                          </p>
                          
                          {exp.technologies && (
                             <div className="pt-1">
                                <TechBadges technologies={exp.technologies} />
                             </div>
                          )}
                       </div>
                    </motion.div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </HUDLayout>
  );
}
