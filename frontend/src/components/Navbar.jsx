import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, language, changeLanguage } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Bulletproof name handling
  const displayName = (user?.name || "").trim();
  const userInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U';
  const userFirstName = displayName ? displayName.split(/\s+/)[0] || 'User' : 'User';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Synchronize document direction with language
  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    document.dir = dir;
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language]);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    navigate('/login');
  };

  const navLinks = user?.role === 'admin'
    ? [
        { name: t('nav.dashboard'), path: '/admin/dashboard', icon: 'ph-squares-four' },
        { name: t('nav.admin_users'), path: '/admin/users', icon: 'ph-users' },
        { name: t('nav.jobs'), path: '/admin/jobs', icon: 'ph-briefcase' },
        { name: t('nav.admin_sources'), path: '/admin/sources', icon: 'ph-database' },
        { name: t('nav.admin_targets'), path: '/admin/targets', icon: 'ph-target' },
      ]
    : [
        { name: t('nav.dashboard'), path: '/dashboard', icon: 'ph-squares-four' },
        { name: t('nav.jobs'), path: '/jobs', icon: 'ph-briefcase' },
        { name: t('nav.tracker'), path: '/applications', icon: 'ph-compass' },
        { name: t('nav.market'), path: '/market', icon: 'ph-chart-line-up' },
        { name: t('nav.tools', 'Tools'), path: '/tools', icon: 'ph-lightning' },
      ];

  return (
    <nav className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 font-sans w-[95%] max-w-6xl rounded-2xl md:rounded-full border shadow-premium ${scrolled ? 'top-2 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-3xl border-slate-200/80 dark:border-indigo-500/30 py-2.5' : 'top-4 bg-white/40 dark:bg-[#030712]/40 backdrop-blur-xl border-white/40 dark:border-white/10 py-3.5 hover:bg-white/60 dark:hover:bg-[#030712]/60'}`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="bg-gradient-to-br from-[#00D2FF] to-[#9D50BB] text-white p-2 rounded-full shadow-md shadow-[#00D2FF]/20 group-hover:scale-105 transition-transform shrink-0">
              <i className="ph-thin ph-compass text-2xl" />
            </div>
            <span className="text-xl tracking-tighter text-slate-900 dark:text-white text-ultra-thin">
              Career<span className="text-[#00D2FF] font-bold">Compass</span>
            </span>
          </Link>

          {/* DESKTOP LINKS */}
          <div className="hidden md:flex items-center gap-1.5">
            {user && navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                  location.pathname === link.path 
                    ? 'bg-[#00D2FF]/10 dark:bg-[#00D2FF]/10 text-[#007f99] dark:text-[#00D2FF] shadow-sm border border-[#00D2FF]/20 dark:border-[#00D2FF]/30' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <i className={`ph-thin ${link.icon} text-lg`} />
                {link.name}
              </Link>
            ))}
          </div>

          {/* DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:text-[#00D2FF] dark:hover:text-[#00D2FF] transition-all border border-slate-200/50 dark:border-white/10 hover:border-[#00D2FF]/30 dark:hover:border-[#00D2FF]/30 shadow-sm"
              title={theme === 'light' ? t('settings.dark') : t('settings.light')}
            >
              <i className={`ph-thin ${theme === 'light' ? 'ph-moon' : 'ph-sun'} text-xl`} />
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => changeLanguage(language === 'en' ? 'ar' : 'en')}
              className="h-10 px-3 flex items-center gap-2 rounded-full bg-slate-100/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:text-[#00D2FF] dark:hover:text-[#00D2FF] transition-all border border-slate-200/50 dark:border-white/10 hover:border-[#00D2FF]/30 dark:hover:border-[#00D2FF]/30 shadow-sm"
              title={language === 'en' ? t('settings.arabic') : t('settings.english')}
            >
              <i className="ph-thin ph-translate text-xl" />
              <span className="text-[11px] font-black uppercase tracking-widest">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>

            {user ? (
              <div className="flex items-center gap-3 ps-4 border-s border-slate-200/50 dark:border-slate-700/50">
                <Link to="/profile" className="flex items-center gap-2.5 p-1.5 pe-4 rounded-full border border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-[#00D2FF]/50 dark:hover:border-[#00D2FF]/50 hover:shadow-sm transition-all group backdrop-blur-md">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D2FF] to-[#9D50BB] flex items-center justify-center text-white font-black text-xs shadow-inner shrink-0">
                    {userInitial}
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-[#00D2FF] dark:group-hover:text-[#00D2FF] transition-colors truncate max-w-[120px]">
                    {userFirstName}
                  </span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all rtl:rotate-180"
                  title={t('nav.logout')}
                >
                  <i className="ph-thin ph-sign-out text-xl" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-[#00D2FF] dark:hover:text-[#00D2FF] transition-colors px-2">{t('nav.signin')}</Link>
                <Link to="/register" className="bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95">{t('nav.start_free')}</Link>
              </div>
            )}
          </div>

          {/* MOBILE TOGGLE BUTTON */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200/50 dark:border-white/10"
            >
              <i className={`ph-thin ${isOpen ? 'ph-x' : 'ph-list'} text-2xl`} />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -20, scale: 0.95 }} 
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden bg-white/90 dark:bg-[#030712]/95 backdrop-blur-3xl border border-slate-200/50 dark:border-indigo-500/20 shadow-2xl absolute top-[calc(100%+10px)] left-0 w-full rounded-2xl"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {user ? (
                <>
                  <div className="space-y-1 mb-4 pb-4 border-b border-slate-100/10 dark:border-white/5">
                    {navLinks.map((link) => (
                      <Link
                        key={link.name}
                        to={link.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 p-3 rounded-full font-bold transition-all text-sm ${
                          location.pathname === link.path 
                            ? 'bg-[#00D2FF]/10 text-[#00D2FF] dark:bg-[#00D2FF]/10 dark:text-[#00D2FF] border border-[#00D2FF]/20' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <i className={`ph-thin ${link.icon} text-xl`} />
                        {link.name}
                      </Link>
                    ))}
                    <Link
                      to="/profile"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 p-3 rounded-full font-bold transition-all text-sm ${
                        location.pathname === '/profile' 
                          ? 'bg-[#00D2FF]/10 text-[#00D2FF] dark:bg-[#00D2FF]/10 dark:text-[#00D2FF] border border-[#00D2FF]/20' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <i className="ph-thin ph-user text-xl" />
                      {t('nav.profile')}
                    </Link>
                  </div>

                  {/* Mobile Theme & Language Toggles */}
                  <div className="grid grid-cols-2 gap-3 pb-4">
                    <button
                      onClick={toggleTheme}
                      className="flex items-center justify-center gap-2 p-3 rounded-full bg-slate-50/50 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border border-slate-200/50 dark:border-white/10"
                    >
                      <i className={`ph-thin ${theme === 'light' ? 'ph-moon' : 'ph-sun'} text-xl`} />
                      {theme === 'light' ? t('settings.dark') : t('settings.light')}
                    </button>
                    <button
                      onClick={() => changeLanguage(language === 'en' ? 'ar' : 'en')}
                      className="flex items-center justify-center gap-2 p-3 rounded-full bg-slate-50/50 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border border-slate-200/50 dark:border-white/10"
                    >
                      <i className="ph-thin ph-translate text-xl" />
                      {language === 'en' ? 'العربية' : 'English'}
                    </button>
                  </div>
                  
                  {/* Mobile User Profile Section */}
                  <div className="flex items-center justify-between bg-slate-50/50 dark:bg-white/5 p-4 rounded-3xl border border-slate-100/50 dark:border-white/10">
                     <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00D2FF] to-[#9D50BB] flex items-center justify-center text-white font-black shadow-inner">
                           {userInitial}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-white block text-sm">{displayName || 'User'}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('dashboard.view_profile')}</span>
                        </div>
                     </Link>
                     <button 
                        onClick={handleLogout}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50"
                     >
                        <i className="ph-thin ph-sign-out text-xl" />
                     </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-3 pt-4">
                  <Link to="/login" onClick={() => setIsOpen(false)} className="w-full py-3.5 text-center font-bold text-slate-700 bg-slate-50/50 dark:bg-white/5 rounded-full border border-slate-200/50 dark:border-white/10 dark:text-white">{t('nav.signin')}</Link>
                  <Link to="/register" onClick={() => setIsOpen(false)} className="w-full py-3.5 text-center font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-full shadow-md">{t('nav.start_free')}</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
