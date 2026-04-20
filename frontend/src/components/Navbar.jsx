import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Compass, LayoutDashboard, Briefcase, BarChart3, User, LogOut, Database, Target, Users, Sun, Moon, Languages } from 'lucide-react';
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

  const displayName = user?.name?.trim();
  const userInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U';
  const userFirstName = displayName ? displayName.split(/\s+/)[0] : 'User';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    navigate('/login');
  };

  const navLinks = user?.role === 'admin'
    ? [
        { name: t('nav.dashboard'), path: '/admin/dashboard', icon: LayoutDashboard },
        { name: t('nav.admin_users'), path: '/admin/users', icon: Users },
        { name: t('nav.jobs'), path: '/admin/jobs', icon: Briefcase },
        { name: t('nav.admin_sources'), path: '/admin/sources', icon: Database },
        { name: t('nav.admin_targets'), path: '/admin/targets', icon: Target },
      ]
    : [
        { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
        { name: t('nav.jobs'), path: '/jobs', icon: Briefcase },
        { name: t('nav.tracker'), path: '/applications', icon: Compass },
        { name: t('nav.market'), path: '/market', icon: BarChart3 },
      ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 font-sans ${scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="bg-indigo-600 text-white p-1.5 rounded-xl shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform shrink-0">
              <Compass size={24} strokeWidth={2.5} />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-800 dark:text-white truncate">
              Career<span className="text-indigo-600">Compass</span>
            </span>
          </Link>

          {/* DESKTOP LINKS */}
          <div className="hidden md:flex items-center gap-1.5">
            {user && navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  location.pathname === link.path 
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <link.icon size={16} />
                {link.name}
              </Link>
            ))}
          </div>

          {/* DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
              title={theme === 'light' ? t('settings.dark') : t('settings.light')}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => changeLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
              title={language === 'en' ? t('settings.arabic') : t('settings.english')}
            >
              <Languages size={18} />
              <span className="text-xs font-bold uppercase">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>

            {user ? (
              <div className="flex items-center gap-3 ps-4 border-s border-slate-200 dark:border-slate-700">
                <Link to="/profile" className="flex items-center gap-2.5 p-1.5 pe-4 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-500 hover:shadow-sm transition-all group">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-xs shadow-inner shrink-0">
                    {userInitial}
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate max-w-[120px]">
                    {userFirstName}
                  </span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all rtl-flip"
                  title={t('nav.logout')}
                >
                  <LogOut size={18} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2">{t('nav.signin')}</Link>
                <Link to="/register" className="bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95">{t('nav.start_free')}</Link>
              </div>
            )}
          </div>

          {/* MOBILE TOGGLE BUTTON */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }} 
            className="md:hidden overflow-hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl absolute top-full left-0 w-full"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {user ? (
                <>
                  <div className="space-y-1 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    {navLinks.map((link) => (
                      <Link
                        key={link.name}
                        to={link.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 p-3 rounded-xl font-bold transition-all text-sm ${
                          location.pathname === link.path 
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <link.icon size={18} />
                        {link.name}
                      </Link>
                    ))}
                    <Link
                      to="/profile"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 p-3 rounded-xl font-bold transition-all text-sm ${
                        location.pathname === '/profile' 
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <User size={18} />
                      {t('nav.profile')}
                    </Link>
                  </div>

                  {/* Mobile Theme & Language Toggles */}
                  <div className="grid grid-cols-2 gap-3 pb-4">
                    <button
                      onClick={toggleTheme}
                      className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700"
                    >
                      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                      {theme === 'light' ? t('settings.dark') : t('settings.light')}
                    </button>
                    <button
                      onClick={() => changeLanguage(language === 'en' ? 'ar' : 'en')}
                      className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700"
                    >
                      <Languages size={18} />
                      {language === 'en' ? 'العربية' : 'English'}
                    </button>
                  </div>
                  
                  {/* Mobile User Profile Section */}
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                     <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black shadow-inner">
                           {userInitial}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-white block text-sm">{displayName ?? 'User'}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('dashboard.view_profile')}</span>
                        </div>
                     </Link>
                     <button 
                        onClick={handleLogout}
                        className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                     >
                        <LogOut size={20} />
                     </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-3 pt-4">
                  <Link to="/login" onClick={() => setIsOpen(false)} className="w-full py-3.5 text-center font-bold text-slate-700 bg-slate-50 rounded-xl border border-slate-200">{t('nav.signin')}</Link>
                  <Link to="/register" onClick={() => setIsOpen(false)} className="w-full py-3.5 text-center font-bold text-white bg-slate-900 rounded-xl shadow-md">{t('nav.start_free')}</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
