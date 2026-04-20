import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Terms() {
  const { t } = useTranslation();

  const sections = [
    {
      title: t('terms_page.s1_title'),
      content: t('terms_page.s1_desc')
    },
    {
      title: t('terms_page.s2_title'),
      content: t('terms_page.s2_desc')
    },
    {
      title: t('terms_page.s3_title'),
      content: t('terms_page.s3_desc')
    },
    {
      title: t('terms_page.s4_title'),
      content: t('terms_page.s4_desc')
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-lg border border-slate-200 dark:border-slate-700">
            <Scale size={14} /> {t('terms_page.badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white tracking-tight">{t('terms_page.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('terms_page.last_updated')}</p>
        </motion.div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
           {sections.map((s, i) => (
             <div key={i} className="space-y-4">
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{s.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  {s.content}
                </p>
             </div>
           ))}
           <div className="pt-8 border-t border-slate-100 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={24} />
                 </div>
                 <div className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('terms_page.agree')}</div>
              </div>
              <a href="mailto:legal@careercompass.ai" className="text-sm font-black text-indigo-600 dark:text-indigo-400 hover:underline">legal@careercompass.ai</a>
           </div>
        </div>

        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           whileInView={{ opacity: 1, scale: 1 }}
           viewport={{ once: true }}
           className="mt-12 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900 p-6 rounded-2xl flex items-start gap-4"
        >
           <AlertCircle className="text-amber-600 shrink-0" />
           <div className="text-sm font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>{t('terms_page.notice_title')}</strong> {t('terms_page.notice_desc')}
           </div>
        </motion.div>
      </div>
    </div>
  );
}
