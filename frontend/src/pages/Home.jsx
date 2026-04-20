import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, PenTool, Users, ArrowRight, CheckCircle2, Zap, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen relative overflow-hidden font-sans hud-scanner">
      {/* ── 2026 Global Design Layer ────────────────────────────────────────── */}
      <div className="fluid-bg-container">
        <div className="fluid-blob w-[500px] h-[500px] bg-indigo-500 top-[-10%] left-[-10%]" />
        <div className="fluid-blob w-[400px] h-[400px] bg-purple-500 bottom-[20%] right-[-5%] animation-delay-2000" />
        <div className="fluid-blob w-[600px] h-[600px] bg-teal-400 top-[40%] left-[30%] opacity-10" />
      </div>
      {/* Blueprint grid replaced with a CSS-based subtle grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] -z-10" 
           style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* ── Hero Section ────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-40 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-12 relative z-10">
          
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-1.5 glass-card !rounded-full text-[10px] uppercase tracking-[0.3em] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
          >
            {t('home.hero.badge')}
          </motion.div>

          <div className="space-y-6 max-w-5xl">
            <motion.h1
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter"
              dangerouslySetInnerHTML={{ __html: t('home.hero.headline') }}
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed"
            >
              {t('home.hero.subtitle')}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-6"
          >
            {user ? (
               <Link to={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'} className="btn-primary !px-10 !py-5 !rounded-2xl text-lg">
                 {user.role === 'admin' ? t('home.hero.enterAdmin') : t('home.hero.enterTalent')}
                 <ArrowRight size={22} />
               </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary !px-10 !py-5 !rounded-2xl text-lg backdrop-blur-md bg-indigo-600/90 border border-white/20">
                  {t('home.hero.analyzeResumeBtn')}
                  <ArrowRight size={20} className="rtl-flip" />
                </Link>
                <Link to="/login" className="px-10 py-5 rounded-2xl glass-card font-bold text-slate-700 dark:text-white hover:bg-white/20 transition-all border border-white/10">
                  {t('home.hero.signInBtn')}
                </Link>
              </>
            )}
          </motion.div>

          {/* Placeholder for 3D Asset - Using a CSS glass sphere for now */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 50, delay: 0.5 }}
            className="mt-16 w-64 h-64 md:w-96 md:h-96 relative group flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full scale-150 animate-pulse -z-10" />
            <div className="w-full h-full rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl flex items-center justify-center animate-float overflow-hidden">
               <Compass size={120} className="text-indigo-500 opacity-20 animate-spin-slow" strokeWidth={0.5} />
               <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-white/20"></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Services Bento Grid ─────────────────────────────────────────────── */}
      <section className="py-24 px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white -tracking-wider">
                {t('home.features.title')}
              </h2>
              <div className="h-1 w-24 bg-indigo-600 rounded-full" />
            </div>
            <p className="max-w-md text-slate-500 dark:text-slate-400 text-lg font-light leading-relaxed">
              {t('home.features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Job Matching - Main Block 2x2 */}
            <motion.div 
              whileHover={{ scale: 1.02, z: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="md:col-span-2 md:row-span-2 glass-card p-10 flex flex-col justify-between border-indigo-500/10 hover:border-indigo-500/30 transition-all relative overflow-hidden group"
            >
              <div className="noise-overlay"></div>
              <div className="absolute top-0 right-0 p-8 text-indigo-500/10 group-hover:text-indigo-500/20 transition-colors">
                <Search size={180} strokeWidth={1} />
              </div>
              <div className="relative z-10 space-y-8">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <Search size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">{t('home.features.marketIntelligence.title')}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">{t('home.features.marketIntelligence.desc')}</p>
                </div>
              </div>
            </motion.div>

            {/* CV Building - Side Block 2x1 */}
            <motion.div 
              whileHover={{ scale: 1.02, z: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="md:col-span-2 glass-card p-8 flex items-center gap-8 border-emerald-500/10 hover:border-emerald-500/30 relative overflow-hidden"
            >
              <div className="noise-overlay"></div>
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                <PenTool size={36} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t('home.features.atsValidation.title')}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed truncate-2-lines">{t('home.features.atsValidation.desc')}</p>
              </div>
            </motion.div>

            {/* Coaching - Small Block 1x1 */}
            <motion.div 
              whileHover={{ scale: 1.02, z: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="glass-card p-8 flex flex-col justify-between border-fuchsia-500/10 hover:border-fuchsia-500/30 relative overflow-hidden"
            >
              <div className="noise-overlay"></div>
              <Users size={32} className="text-fuchsia-600" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-4">{t('home.features.bridgeTheGap.title')}</h3>
            </motion.div>

            {/* Data Driven - Small Block 1x1 */}
            <motion.div 
              whileHover={{ scale: 1.02, z: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="glass-card p-8 flex flex-col justify-between border-slate-500/10 bg-slate-900/5 dark:bg-white/5 relative overflow-hidden"
            >
              <div className="noise-overlay"></div>
              <Zap size={32} className="text-amber-500" />
              <div className="space-y-4">
                <div className="text-xs font-black tracking-widest uppercase opacity-50">{t('home.features.badge')}</div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                  <CheckCircle2 size={16} className="text-indigo-500" /> {t('home.features.dataDriven')}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Floating Elements CSS Custom Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}} />
    </div>
  );
}