import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Target, Zap, Users, ShieldCheck, Globe, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import HUDLayout from '../components/HUDLayout';

export default function AboutUs() {
  const { t } = useTranslation();

  return (
    <HUDLayout>
      <div className="relative overflow-hidden text-slate-900 dark:text-white selection:bg-indigo-500/30 transition-colors duration-500">
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] -z-10" 
             style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Hero Section */}
        <section className="relative pt-48 pb-32 px-4">
          <div className="max-w-6xl mx-auto text-center space-y-12 relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-3 px-6 py-2 glass-card !rounded-full border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em]"
            >
              <Compass size={14} className="text-indigo-500 animate-spin-slow" />
              {t('about_us.mission')}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-6xl md:text-8xl font-black tracking-tight leading-[0.9] max-w-5xl mx-auto"
              dangerouslySetInnerHTML={{ __html: t('about_us.headline') }}
            />

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-3xl mx-auto text-xl text-slate-600 dark:text-slate-400 font-medium leading-relaxed"
            >
              {t('about_us.desc_p1')}
            </motion.p>
            
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="pt-12 text-slate-400 dark:text-slate-600 flex justify-center"
            >
              <ArrowDown size={32} strokeWidth={1} />
            </motion.div>
          </div>
        </section>

        {/* Values Grid - Spatial Bento Transformation */}
        <section className="py-32 px-4 relative">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Target,
                  title: t('about_us.v1_title'),
                  desc: t('about_us.v1_desc'),
                  color: 'text-indigo-600 dark:text-indigo-400',
                  glow: 'shadow-[0_0_30px_rgba(79,70,229,0.2)]'
                },
                {
                  icon: ShieldCheck,
                  title: t('about_us.v2_title'),
                  desc: t('about_us.v2_desc'),
                  color: 'text-emerald-600 dark:text-emerald-400',
                  glow: 'shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                },
                {
                  icon: Globe,
                  title: t('about_us.v3_title'),
                  desc: t('about_us.v3_desc'),
                  color: 'text-purple-600 dark:text-purple-400',
                  glow: 'shadow-[0_0_30_rgba(168,85,247,0.2)]'
                }
              ].map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -10, scale: 1.02 }}
                  className="glass-card p-10 relative overflow-hidden group border-slate-200 dark:border-white/10"
                >
                  <div className={`w-16 h-16 glass-card !rounded-2xl flex items-center justify-center mb-8 ${v.color} ${v.glow} group-hover:scale-110 transition-transform bg-white dark:bg-white/5`}>
                    <v.icon size={32} strokeWidth={2} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4">{v.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    {v.desc}
                  </p>
                  <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
                      <v.icon size={160} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Story Section - HUD Cinematic Style */}
        <section className="py-40 px-4 bg-slate-100/50 dark:bg-white/5 relative overflow-hidden">
          <div className="max-w-4xl mx-auto relative z-10 text-center space-y-16">
              <div className="space-y-4">
                  <span className="micro-typography text-indigo-600 dark:text-indigo-400 font-black">ENGINEERING TRUTH</span>
                  <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter">{t('about_us.why_title')}</h2>
              </div>
              
              <div className="space-y-8 text-slate-600 dark:text-slate-400 font-medium text-lg md:text-xl leading-relaxed text-left md:text-center">
                <p>{t('about_us.why_p1')}</p>
                <p>{t('about_us.why_p2')}</p>
              </div>
              
              <div className="pt-24 grid grid-cols-2 md:grid-cols-4 gap-12">
                 {[
                   { val: "50k+", lbl: t('about_us.stats_jobs'), col: 'text-indigo-600 dark:text-indigo-400' },
                   { val: "120+", lbl: t('about_us.stats_roles'), col: 'text-purple-600 dark:text-purple-400' },
                   { val: "95%", lbl: t('about_us.stats_accuracy'), col: 'text-emerald-600 dark:text-emerald-400' },
                   { val: "24/7", lbl: t('about_us.stats_updates'), col: 'text-amber-600 dark:text-amber-400' }
                 ].map((s, i) => (
                   <div key={i} className="space-y-3">
                      <div className={`text-4xl font-black ${s.col} tracking-tighter`}>{s.val}</div>
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{s.lbl}</div>
                   </div>
                 ))}
              </div>
          </div>
        </section>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
          }
          .animate-spin-slow {
              animation: spin-slow 15s linear infinite;
          }
        `}} />

      </div>
    </HUDLayout>
  );
}
