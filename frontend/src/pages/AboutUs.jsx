import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Target, Zap, Users, ShieldCheck, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AboutUs() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-6xl mx-auto text-center space-y-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest"
          >
            <Compass size={14} className="text-fuchsia-500" />
            Our Mission
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black text-slate-800 dark:text-white tracking-tighter leading-tight"
          >
            Engineering the future of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-indigo-600">professional growth.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-3xl mx-auto text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed"
          >
            Career Compass was born from a simple observation: the gap between academic preparation and market demand is widening. Our mission is to provide every professional with a high-precision navigation system powered by AI to master their destiny.
          </motion.p>
        </div>
      </section>

      {/* Values Grid */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Target,
                title: 'Precision Insights',
                desc: 'We don\'t just show jobs; we map your unique skill DNA against the entire market.',
                color: 'text-indigo-600',
                bg: 'bg-indigo-50 dark:bg-indigo-900/20'
              },
              {
                icon: ShieldCheck,
                title: 'Unbiased Analysis',
                desc: 'Our AI provides objective feedback on your resume, mimicking the most advanced ATS systems.',
                color: 'text-emerald-600',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20'
              },
              {
                icon: Globe,
                title: 'Market Intelligence',
                desc: 'Real-time data from thousands of sources to keep you ahead of hiring trends.',
                color: 'text-fuchsia-600',
                bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20'
              }
            ].map((v, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"
              >
                <div className={`w-14 h-14 ${v.bg} rounded-2xl flex items-center justify-center mb-6`}>
                  <v.icon size={28} className={v.color} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-3">{v.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-sm">
                  {v.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-24 px-4 bg-white dark:bg-slate-800/50 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-12">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white">Why Career Compass?</h2>
            <div className="space-y-6 text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-left md:text-center">
              <p>
                The modern job market operates at light speed. Skills that were relevant two years ago are now foundational, and new domains emerge every season. Professionals are often left guessing what to learn next.
              </p>
              <p>
                We built Career Compass to remove the guesswork. By leveraging state-of-the-art NLP and market-scraping technologies, we provide a live roadmap for your career. Whether you're a junior dev or a senior architect, we help you identify exactly what's missing and how to get there.
              </p>
            </div>
            
            <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-8">
               <div className="space-y-1">
                  <div className="text-3xl font-black text-indigo-600">50k+</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Jobs Analyzed</div>
               </div>
               <div className="space-y-1">
                  <div className="text-3xl font-black text-fuchsia-500">120+</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Target Roles</div>
               </div>
               <div className="space-y-1">
                  <div className="text-3xl font-black text-indigo-600">95%</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Match Accuracy</div>
               </div>
               <div className="space-y-1">
                  <div className="text-3xl font-black text-fuchsia-500">24/7</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Updates</div>
               </div>
            </div>
        </div>
      </section>

    </div>
  );
}
