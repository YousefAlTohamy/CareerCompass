import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, FileText, EyeOff, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Privacy() {
  const { t } = useTranslation();

  const sections = [
    {
      icon: ShieldCheck,
      title: 'Data Collection',
      content: 'We collect minimal personal data required for account management and resume analysis. This includes your name, email address, and any professional data provided in your uploaded CV.'
    },
    {
      icon: Lock,
      title: 'AI Processing',
      content: 'Your resume data is processed by our secure AI engine to extract skills and match them with job market data. This data is stored securely and never sold to third parties.'
    },
    {
      icon: EyeOff,
      title: 'Third-Party Services',
      content: 'We use trusted third-party providers for infrastructure and AI capabilities. These partners are strictly prohibited from using your data for any other purpose.'
    },
    {
      icon: UserCheck,
      title: 'Your Rights',
      content: 'You have the right to access, export, or delete your personal data at any time through your Profile settings. We believe in complete transparency and data ownership.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-24 pb-20 px-4 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest rounded-lg">
            <FileText size={14} /> Legal Documentation
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white tracking-tight">Privacy Policy</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Last updated: April 6, 2026</p>
        </motion.div>

        <div className="space-y-8">
           {sections.map((s, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, x: -20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               transition={{ delay: i * 0.1 }}
               className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-6 items-start"
             >
               <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600 text-indigo-600 dark:text-indigo-400">
                 <s.icon size={24} />
               </div>
               <div className="space-y-3">
                 <h2 className="text-xl font-black text-slate-800 dark:text-white">{s.title}</h2>
                 <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                   {s.content}
                 </p>
               </div>
             </motion.div>
           ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 p-8 bg-indigo-600 rounded-3xl text-white text-center space-y-6 shadow-xl shadow-indigo-900/20"
        >
           <h2 className="text-2xl font-black">Any questions about your data?</h2>
           <p className="text-indigo-100 font-medium max-w-lg mx-auto">
             Our data protection officer is available to answer any concerns regarding your privacy and how Career Compass handles your professional identity.
           </p>
           <a href="mailto:privacy@careercompass.ai" className="inline-block bg-white text-indigo-600 font-black px-8 py-3.5 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-lg">
             Contact Privacy Team
           </a>
        </motion.div>
      </div>
    </div>
  );
}
