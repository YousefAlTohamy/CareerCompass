import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Compass, LayoutDashboard, Briefcase, BarChart3, User, LogOut, Database, Target, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
        { name: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'Jobs', path: '/admin/jobs', icon: Briefcase },
        { name: 'Sources', path: '/admin/sources', icon: Database },
        { name: 'Target Roles', path: '/admin/targets', icon: Target },
      ]
    : [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Discovery', path: '/jobs', icon: Briefcase },
        { name: 'Tracker', path: '/applications', icon: Compass },
        { name: 'Market', path: '/market', icon: BarChart3 },
      ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 font-sans ${scrolled ? 'bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="bg-indigo-600 text-white p-1.5 rounded-xl shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
              <Compass size={24} strokeWidth={2.5} />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-800">
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
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <link.icon size={16} />
                {link.name}
              </Link>
            ))}
          </div>

          {/* DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <Link to="/profile" className="flex items-center gap-2.5 p-1.5 pr-4 rounded-full border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-xs shadow-inner">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                    {user.name.split(' ')[0]}
                  </span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  title="Logout"
                >
                  <LogOut size={18} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors px-2">Sign In</Link>
                <Link to="/register" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95">Start Analysis</Link>
              </div>
            )}
          </div>

          {/* MOBILE TOGGLE BUTTON */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
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
            className="md:hidden overflow-hidden bg-white border-b border-slate-200 shadow-xl absolute top-full left-0 w-full"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {user ? (
                <>
                  <div className="space-y-1 mb-4 pb-4 border-b border-slate-100">
                    {navLinks.map((link) => (
                      <Link
                        key={link.name}
                        to={link.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 p-3 rounded-xl font-bold transition-all text-sm ${
                          location.pathname === link.path 
                            ? 'bg-indigo-50 text-indigo-700' 
                            : 'text-slate-600 hover:bg-slate-50'
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
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <User size={18} />
                      Profile
                    </Link>
                  </div>
                  
                  {/* Mobile User Profile Section */}
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black shadow-inner">
                           {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 block text-sm">{user.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">View Profile</span>
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
                  <Link to="/login" onClick={() => setIsOpen(false)} className="w-full py-3.5 text-center font-bold text-slate-700 bg-slate-50 rounded-xl border border-slate-200">Sign In</Link>
                  <Link to="/register" onClick={() => setIsOpen(false)} className="w-full py-3.5 text-center font-bold text-white bg-slate-900 rounded-xl shadow-md">Start Analysis Free</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
