import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative pt-32 pb-12 overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      {/* Background HUD Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" 
           style={{ backgroundImage: 'radial-gradient(var(--cc-primary) 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
          
          <div className="col-span-1 md:col-span-1 space-y-10">
            <Link to="/" className="flex items-center gap-3 group w-fit">
              <div className="relative">
                <div className="absolute inset-0 bg-[var(--cc-primary)] blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative bg-[var(--cc-primary)] text-slate-900 p-2.5 rounded-xl shadow-xl shadow-cyan-500/20 group-hover:scale-110 transition-transform">
                  <Compass size={22} strokeWidth={2.5} />
                </div>
              </div>
              <span className="text-2xl tracking-tighter text-slate-900 dark:text-white font-light">
                Career<span className="text-[var(--cc-primary)] font-black">Compass</span>
              </span>
            </Link>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed max-w-xs">
              {t('home.footer.brand_desc')}
            </p>

            <div className="flex items-center gap-4">
              {[Twitter, Linkedin, Github].map((Icon, i) => (
                <a 
                  key={i} 
                  href="#" 
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:border-[var(--cc-primary)] hover:bg-cyan-500/10 transition-all text-slate-400 hover:text-[var(--cc-primary)] shadow-sm"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-[var(--cc-primary)] opacity-80">{t('nav.tracker')}</h4>
            <ul className="space-y-4">
              {[ {n: t('nav.jobs'), p: '/jobs'}, {n: t('nav.market'), p: '/market'}, {n: t('nav.tracker'), p: '/applications'} ].map(l => (
                <li key={l.p}>
                  <Link to={l.p} className="text-slate-500 dark:text-slate-400 hover:text-[var(--cc-primary)] text-sm font-semibold transition-all">
                    {l.n}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-[var(--cc-primary)] opacity-80">{t('home.footer.resources')}</h4>
            <ul className="space-y-4">
              <li><Link to="/about" className="text-slate-500 dark:text-slate-400 hover:text-[var(--cc-primary)] text-sm font-semibold transition-all">{t('home.footer.about')}</Link></li>
              <li><Link to="/status" className="text-slate-500 dark:text-slate-400 hover:text-[var(--cc-primary)] text-sm font-semibold transition-all">{t('home.footer.status')}</Link></li>
              <li>
                <a href="mailto:support@careercompass.ai" className="text-[var(--cc-primary)] text-sm font-black flex items-center gap-2 group">
                  <Mail size={14} className="group-hover:translate-x-1 transition-transform" /> 
                  {t('home.footer.support')}
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-[var(--cc-primary)] opacity-80">{t('home.footer.legal')}</h4>
            <ul className="space-y-4">
              <li><Link to="/privacy" className="text-slate-500 dark:text-slate-400 hover:text-[var(--cc-primary)] text-sm font-semibold transition-all">{t('home.footer.privacy')}</Link></li>
              <li><Link to="/terms" className="text-slate-500 dark:text-slate-400 hover:text-[var(--cc-primary)] text-sm font-semibold transition-all">{t('home.footer.terms')}</Link></li>
            </ul>
          </div>

        </div>

        {/* HUD Scanner Divider */}
        <div className="relative h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--cc-primary)] to-transparent opacity-30 blur-sm" />
        </div>

        <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black">
            &copy; {currentYear} <span className="text-[var(--cc-primary)]">Career Compass</span>. 
            <span className="font-medium ml-2 opacity-50">{t('home.footer.rights')}</span>
          </p>
          
          <div className="flex items-center gap-4 px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 shadow-sm backdrop-blur-md">
             <div className="relative flex items-center justify-center">
               <span className="absolute w-3 h-3 rounded-full bg-emerald-500/20 animate-ping"></span>
               <span className="relative w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
               {t('home.footer.operational')}
             </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

