import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative pt-24 pb-12 overflow-hidden">
      <div className="blueprint-overlay opacity-[0.02]" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
          
          <div className="col-span-1 md:col-span-1 space-y-8">
            <Link to="/" className="flex items-center gap-3 group w-fit">
              <div className="bg-indigo-600 text-white p-2 rounded-2xl shadow-xl shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                <Compass size={24} strokeWidth={2} />
              </div>
              <span className="text-2xl tracking-tighter text-slate-900 dark:text-white text-ultra-thin">
                Career<span className="text-indigo-600 font-bold">Compass</span>
              </span>
            </Link>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-light leading-relaxed max-w-xs">
              {t('home.footer.brand_desc')}
            </p>
            <div className="flex items-center gap-4">
              {[Twitter, Linkedin, Github].map((Icon, i) => (
                <a key={i} href="#" className="p-3 rounded-2xl glass-card hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all text-slate-400 hover:text-indigo-500">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('nav.tracker')}</h4>
            <ul className="space-y-4">
              {[ {n: t('nav.jobs'), p: '/jobs'}, {n: t('nav.market'), p: '/market'}, {n: t('nav.tracker'), p: '/applications'} ].map(l => (
                <li key={l.p}><Link to={l.p} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 text-sm font-light transition-all">{l.n}</Link></li>
              ))}
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('home.footer.resources')}</h4>
            <ul className="space-y-4">
              <li><Link to="/about" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 text-sm font-light transition-all">{t('home.footer.about')}</Link></li>
              <li><Link to="/status" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 text-sm font-light transition-all">{t('home.footer.status')}</Link></li>
              <li><a href="mailto:support@careercompass.ai" className="text-indigo-600 text-sm font-bold flex items-center gap-2 group"><Mail size={14} className="group-hover:translate-x-1 transition-transform" /> {t('home.footer.support')}</a></li>
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('home.footer.legal')}</h4>
            <ul className="space-y-4">
              <li><Link to="/privacy" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 text-sm font-light transition-all">{t('home.footer.privacy')}</Link></li>
              <li><Link to="/terms" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 text-sm font-light transition-all">{t('home.footer.terms')}</Link></li>
            </ul>
          </div>

        </div>

        <div className="pt-12 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black">
            &copy; {currentYear} Career Compass. <span className="font-light opacity-50">{t('home.footer.rights')}</span>
          </p>
          <div className="flex items-center gap-3 px-4 py-2 glass-card !rounded-full">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('home.footer.operational')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
