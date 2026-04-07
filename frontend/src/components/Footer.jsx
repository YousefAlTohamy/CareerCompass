import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-16 pb-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          
          {/* Brand section */}
          <div className="col-span-1 md:col-span-1 space-y-6">
            <Link to="/" className="flex items-center gap-2.5 group w-fit">
              <div className="bg-indigo-600 text-white p-1.5 rounded-xl shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                <Compass size={24} strokeWidth={2.5} />
              </div>
              <span className="font-black text-xl tracking-tight text-slate-800 dark:text-white">
                Career<span className="text-indigo-600">Compass</span>
              </span>
            </Link>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
              Empowering professionals to navigate the modern job market with AI-driven insights and skill-gap analysis.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-slate-200 dark:border-slate-700">
                <Twitter size={18} />
              </a>
              <a href="#" className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-slate-200 dark:border-slate-700">
                <Linkedin size={18} />
              </a>
              <a href="#" className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-slate-200 dark:border-slate-700">
                <Github size={18} />
              </a>
            </div>
          </div>

          {/* Platform Links */}
          <div className="space-y-6">
            <h4 className="text-slate-800 dark:text-white font-black text-sm uppercase tracking-widest">{t('nav.tracker')}</h4>
            <ul className="space-y-3">
              <li><Link to="/jobs" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold transition-colors">{t('nav.jobs')}</Link></li>
              <li><Link to="/market" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold transition-colors">{t('nav.market')}</Link></li>
              <li><Link to="/applications" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold transition-colors">{t('nav.tracker')}</Link></li>
            </ul>
          </div>

          {/* Resources Links */}
          <div className="space-y-6">
            <h4 className="text-slate-800 dark:text-white font-black text-sm uppercase tracking-widest">{t('home.footer.resources')}</h4>
            <ul className="space-y-3">
              <li><Link to="/about" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold transition-colors">{t('home.footer.about')}</Link></li>
              <li><Link to="/status" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold transition-colors">{t('home.footer.status')}</Link></li>
              <li><a href="mailto:support@careercompass.ai" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold transition-colors flex items-center gap-2"><Mail size={14} /> Support</a></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-6">
            <h4 className="text-slate-800 dark:text-white font-black text-sm uppercase tracking-widest">{t('home.footer.legal')}</h4>
            <ul className="space-y-3">
              <li><Link to="/privacy" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold transition-colors">{t('home.footer.privacy')}</Link></li>
              <li><Link to="/terms" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold transition-colors">{t('home.footer.terms')}</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Section */}
        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 dark:text-slate-500 text-xs font-bold leading-relaxed">
            &copy; {currentYear} Career Compass. {t('home.footer.rights')}
          </p>
          <div className="flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
