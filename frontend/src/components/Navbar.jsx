import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Compass, LayoutDashboard, Briefcase, BarChart3, Settings, User, LogOut } from 'lucide-react';
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

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Discovery', path: '/jobs', icon: Briefcase },
    { name: 'Tracker', path: '/applications', icon: Compass },
    { name: 'Market', path: '/market', icon: BarChart3 },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
      scrolled ? 'bg-white/80 backdrop-blur-md shadow-premium border-b border-slate-100 py-3' : 'bg-transparent py-5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <div className={`p-2 rounded-xl transition-colors ${scrolled ? 'bg-primary text-white' : 'bg-white text-primary'}`}>
               <Compass className="group-hover:rotate-45 transition-transform duration-500" />
            </div>
            <span className={`text-xl font-black tracking-tighter transition-colors ${scrolled ? 'text-primary' : 'text-primary'}`}>
              Career<span className="text-secondary italic">Compass</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {user ? (
              <>
                <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-capsule border border-slate-200/50">
                  {navLinks.map((link) => (
                    <Link
                      key={link.name}
                      to={link.path}
                      className={`flex items-center gap-2 px-5 py-2 rounded-capsule text-sm font-bold transition-all ${
                        location.pathname === link.path 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-slate-500 hover:text-primary'
                      }`}
                    >
                      <link.icon size={16} />
                      {link.name}
                    </Link>
                  ))}
                </div>

                <div className="flex items-center gap-4 pl-4 border-l border-slate-200">
                  {user.role === 'admin' && (
                    <Link to="/admin/scraping-sources" className="p-2 text-slate-400 hover:text-primary transition-colors">
                      <Settings size={20} />
                    </Link>
                  )}
                  <div className="group relative">
                    <button className="flex items-center gap-3 p-1 pr-4 bg-white border border-slate-100 rounded-capsule shadow-sm hover:shadow-premium transition-all">
                       <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white font-black text-xs">
                          {user.name.charAt(0).toUpperCase()}
                       </div>
                       <span className="text-sm font-bold text-slate-700">{user.name}</span>
                    </button>
                    {/* Dropdown would go here if needed, keeping it simple for now */}
                    <button 
                       onClick={handleLogout}
                       className="absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto bg-white border border-slate-100 shadow-premium-hover rounded-xl p-2 min-w-[120px]"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold w-full transition-colors">
                        <LogOut size={14} />
                        Logout
                      </div>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-slate-600 hover:text-primary font-bold transition-colors">
                  Login
                </Link>
                <Link to="/register" className="btn-primary">
                  Start Analysis
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-primary"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-full left-0 right-0 bg-white border-b border-slate-100 p-4 md:hidden shadow-premium"
          >
            <div className="space-y-2">
              {user ? (
                <>
                  {navLinks.map((link) => (
                    <Link
                      key={link.name}
                      to={link.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 p-4 rounded-xl font-bold transition-all ${
                        location.pathname === link.path ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      <link.icon size={20} />
                      {link.name}
                    </Link>
                  ))}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white font-black">
                           {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{user.name}</span>
                     </div>
                     <button onClick={handleLogout} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                        <LogOut size={20} />
                     </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/login" onClick={() => setIsOpen(false)} className="p-4 text-center font-bold text-slate-600">Login</Link>
                  <Link to="/register" onClick={() => setIsOpen(false)} className="btn-primary">Start Analysis</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
