import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, ShieldCheck, Zap, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden font-sans">
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-4 overflow-hidden">
        {/* Background Glows (Matching Login/Register style) */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />
        <div className="absolute top-48 left-1/4 w-[300px] h-[300px] bg-fuchsia-500/10 blur-[80px] rounded-full -z-10 animate-pulse" />

        <div className="max-w-6xl mx-auto text-center space-y-8 relative z-10">
          
          {/* Top Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm text-indigo-600 font-bold text-xs uppercase tracking-widest"
          >
            <Zap size={14} className="text-fuchsia-500" />
            AI-Powered Career Intelligence
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-800 tracking-tighter leading-[1.05]"
          >
            Master Your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-indigo-600"> Professional</span> Destiny.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 font-medium leading-relaxed"
          >
            Career Compass uses advanced AI to analyze your resume against real-time market data. Identify gaps, bridge the match, and land your expert role.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            {user ? (
               <Link 
                 to={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'} 
                 className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-3 group"
               >
                 {user.role === 'admin' ? 'Enter Admin Dashboard' : 'Enter Talent Cockpit'} 
                 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
               </Link>
            ) : (
              <>
                <Link 
                  to="/register" 
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 group"
                >
                  Analyze Resume Free
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  to="/login" 
                  className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-4 px-8 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  Sign In <Compass size={18} className="text-slate-400" />
                </Link>
              </>
            )}
          </motion.div>

          {/* Hero Visual (Glassmorphism Card) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-24 relative max-w-4xl mx-auto"
          >
             <div className="absolute inset-0 bg-indigo-600/10 blur-3xl rounded-full -z-10" />
             <div className="bg-white/60 backdrop-blur-md p-4 md:p-6 border border-white rounded-3xl shadow-2xl shadow-indigo-900/5">
                <div className="aspect-[16/9] bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center text-white relative">
                   {/* Abstract Tech Background inside the visual */}
                   <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-slate-900 to-slate-900"></div>
                   
                   <Compass size={80} className="animate-spin-slow text-indigo-400 mb-6 opacity-80" strokeWidth={1.5} />
                   <h3 className="text-2xl font-bold tracking-tight text-white/90 z-10">AI Analysis Engine</h3>
                   <div className="flex gap-2 mt-4 z-10">
                     <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                     <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-75"></span>
                     <span className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse delay-150"></span>
                   </div>
                </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="py-24 px-4 bg-white relative">
        <div className="max-w-7xl mx-auto relative z-10">
          
          {/* Section Header */}
          <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-16 text-center md:text-left">
             <div className="space-y-3 mx-auto md:mx-0">
                <h4 className="text-indigo-600 font-black uppercase text-xs tracking-widest bg-indigo-50 px-3 py-1 rounded-lg w-fit mx-auto md:mx-0">
                  Core Intelligence
                </h4>
                <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">The Expert Toolkit</h2>
             </div>
             <p className="max-w-md text-slate-500 font-medium text-center md:text-right">
               Built by career experts for the modern professional. Data-driven, AI-validated, and market-ready.
             </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: 'ATS Validation',
                desc: 'Real-time gap analysis against target job roles using advanced Natural Language Processing (NLP).',
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                border: 'group-hover:border-emerald-200'
              },
              {
                icon: BarChart3,
                title: 'Market Intelligence',
                desc: 'Live tracking of skill demand, salary trends, and hiring shifts across multiple scraping sources.',
                color: 'text-indigo-600',
                bg: 'bg-indigo-50',
                border: 'group-hover:border-indigo-200'
              },
              {
                icon: Zap,
                title: 'Bridge the Gap',
                desc: 'Instant, actionable course recommendations to help you rank 90%+ for your dream job.',
                color: 'text-fuchsia-600',
                bg: 'bg-fuchsia-50',
                border: 'group-hover:border-fuchsia-200'
              }
            ].map((f, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -8 }}
                className={`bg-white border border-slate-100 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 group ${f.border}`}
              >
                <div className={`w-14 h-14 ${f.bg} rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110`}>
                   <f.icon size={28} className={f.color} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-3">{f.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed text-sm">
                  {f.desc}
                </p>
                <ul className="mt-6 space-y-2">
                   <li className="flex items-center gap-2 text-xs font-bold text-slate-400">
                     <CheckCircle2 size={14} className={f.color} /> Automated Insights
                   </li>
                   <li className="flex items-center gap-2 text-xs font-bold text-slate-400">
                     <CheckCircle2 size={14} className={f.color} /> Data-Driven
                   </li>
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-16 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-2 text-white">
             <Compass size={24} className="text-indigo-500" />
             <span className="font-black text-xl tracking-tight">Career Compass</span>
           </div>
           
           <nav className="flex gap-8 text-xs font-bold uppercase tracking-widest text-slate-500">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">System Status</a>
           </nav>

           <div className="text-slate-600 text-sm font-medium">
              &copy; {new Date().getFullYear()} All rights reserved.
           </div>
        </div>
      </footer>
    </div>
  );
}