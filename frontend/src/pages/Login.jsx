import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle, Compass, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      
      {/* Left Column - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900 items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-slate-900 to-emerald-900/50 z-0"></div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        <div className="absolute top-10 left-10 z-10 flex items-center gap-3">
          <Compass className="text-[var(--cc-primary)]" size={32} />
          <span className="text-xl font-black tracking-tight text-white">CareerCompass</span>
        </div>

        <div className="relative z-10 p-12 max-w-xl">
          <div className="space-y-6">
            <h2 className="text-4xl lg:text-5xl font-black leading-tight text-white">
              Welcome back to your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--cc-primary)] to-[var(--cc-secondary)]">professional journey.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Log in to access your AI-powered career dashboard, continue your skills analysis, and explore new opportunities.
            </p>
          </div>
          
          <div className="mt-12 flex items-center gap-4 text-slate-500 text-sm font-semibold">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-indigo-500"></div>
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-emerald-500"></div>
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-fuchsia-500 flex items-center justify-center text-white text-xs">+2k</div>
            </div>
            <span>Professionals joined this week</span>
          </div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.05]" 
             style={{ backgroundImage: 'radial-gradient(var(--cc-primary) 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
        
        <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="text-center lg:text-start space-y-2 mb-10">
            <div className="lg:hidden w-16 h-16 bg-slate-900 dark:bg-white/5 rounded-2xl mx-auto mb-6 flex items-center justify-center text-[var(--cc-primary)] shadow-xl">
              <Compass size={32} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t('login.title')}</h1>
            <p className="text-slate-500 font-medium">Please enter your credentials to proceed.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden">
            
            {error && (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-4 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex gap-3 items-center mb-6">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('hud_labels.email_endpoint')}</label>
                    <div className="relative">
                        <Mail className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            required
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-[var(--cc-primary)]/50 ps-12 pe-4 py-4 rounded-xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all focus:bg-white dark:focus:bg-slate-800 shadow-sm"
                            placeholder="mail@example.com"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('hud_labels.access_key')}</label>
                      <Link to="#" className="text-xs font-bold text-[var(--cc-primary)] hover:underline">Forgot Password?</Link>
                    </div>
                    <div className="relative">
                        <Lock className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="password" 
                            name="password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            required
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-[var(--cc-primary)]/50 ps-12 pe-4 py-4 rounded-xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all focus:bg-white dark:focus:bg-slate-800 shadow-sm"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button 
                    disabled={loading}
                    className="w-full py-4 mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 transition-all"
                >
                    {loading ? (t('login.signingIn')) : <>{t('login.signInBtn')} <ArrowRight size={18} /></>}
                </button>
            </form>
            
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
              <p className="text-center text-slate-500 font-medium text-sm">
                  {t('login.noAccount')} <Link to="/register" className="text-[var(--cc-primary)] hover:underline font-bold ml-1">{t('login.createAccount')}</Link>
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-600 mt-8">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-black tracking-widest uppercase">Secure Connection</span>
          </div>

        </div>
      </div>
    </div>
  );
}