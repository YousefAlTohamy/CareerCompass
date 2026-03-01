import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, ShieldCheck, Zap, BarChart3, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 blur-[120px] rounded-full -z-10" />
        <div className="absolute top-48 left-1/4 w-[300px] h-[300px] bg-secondary/10 blur-[80px] rounded-full -z-10 animate-pulse" />

        <div className="max-w-7xl mx-auto text-center space-y-8 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-capsule shadow-premium text-primary font-bold text-xs uppercase tracking-widest"
          >
            <Zap size={14} className="text-secondary" />
            AI-Powered Career Intelligence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-black text-primary tracking-tighter leading-[0.9]"
          >
            Master Your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent">Professional</span> Destiny.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-2xl mx-auto text-xl text-slate-500 font-medium leading-relaxed"
          >
            CareerCompass uses advanced AI to analyze your resume against real-time market data. Identify gaps, bridge the match, and land your expert role.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            {user ? (
               <Link to="/dashboard" className="btn-primary flex items-center gap-3 px-10 py-5">
                 Enter Talent Cockpit <ArrowRight size={20} />
               </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary px-10 py-5">
                  Analyze Resume Free
                </Link>
                <Link to="/login" className="btn-secondary px-10 py-5 flex items-center gap-2">
                  Sign In <Compass size={18} />
                </Link>
              </>
            )}
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
             <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full -z-10 opacity-20" />
             <div className="glass-card p-4 md:p-8 border-2 border-white/50">
                <div className="aspect-[16/9] bg-gradient-to-br from-primary to-slate-900 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center text-white/10">
                   {/* Placeholder for real app preview image if available, using abstract for now */}
                   <Compass size={120} className="animate-spin-slow" />
                </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-16">
             <div className="space-y-2">
                <h4 className="text-secondary font-black uppercase text-xs tracking-[0.3em]">Core Intelligence</h4>
                <h2 className="text-4xl font-black text-primary tracking-tight">The Expert Toolkit</h2>
             </div>
             <p className="max-w-md text-slate-500 font-medium">Built by career experts for the modern professional. Data-driven, AI-validated.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: ShieldCheck,
                title: 'ATS Validation',
                desc: 'Real-time gap analysis against target job roles using advanced NLP.',
                color: 'text-emerald-500'
              },
              {
                icon: BarChart3,
                title: 'Market Intelligence',
                desc: 'Live tracking of skill demand, salary trends, and hiring shifts.',
                color: 'text-secondary'
              },
              {
                icon: Zap,
                title: 'Bridge the Gap',
                desc: 'Instant course recommendations to rank 90%+ for your dream job.',
                color: 'text-accent'
              }
            ].map((f, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -10 }}
                className="card-premium p-10 group"
              >
                <div className={`w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-primary group-hover:text-white ${f.color}`}>
                   <f.icon size={28} />
                </div>
                <h3 className="text-2xl font-black text-primary mb-4">{f.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-white py-20 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 opacity-50">
           <span className="font-black text-xl tracking-tighter">CareerCompass.ai</span>
           <nav className="flex gap-8 text-xs font-bold uppercase tracking-widest text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Status</a>
              <a href="#" className="hover:text-white transition-colors">© 2026</a>
           </nav>
        </div>
      </footer>
    </div>
  );
}
