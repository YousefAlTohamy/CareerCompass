import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle, Compass, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const getApiErrorMessage = (error, fallback) => {
  const errors = error.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const firstField = Object.values(errors)[0];
    if (Array.isArray(firstField) && firstField[0]) {
      return firstField[0];
    }
  }

  return error.response?.data?.message || fallback;
};

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.dir() === 'rtl';

  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

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
      setError(getApiErrorMessage(err, t('auth.login_failed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      
      {/* Left Column - Branding (Hidden on mobile) */}
      <div className={`hidden lg:flex lg:w-1/2 lg:min-h-screen relative overflow-hidden bg-slate-900 items-center justify-center ${isRtl ? 'order-last' : ''}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-slate-900 to-emerald-900/50 z-0"></div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        <div className={`absolute top-28 z-10 flex items-center gap-3 ${isRtl ? 'right-10' : 'left-10'}`}>
          <Compass className="text-[var(--cc-primary)]" size={32} />
          <span className="text-xl font-black tracking-tight text-white">CareerCompass</span>
        </div>

        <div className="relative z-10 p-12 max-w-xl text-start">
          <div className="space-y-6">
            <h2 className="text-4xl lg:text-5xl font-black leading-tight text-white">
              {t('auth.login_welcome_part1', 'Welcome back to your')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--cc-primary)] to-[var(--cc-secondary)]">{t('auth.login_welcome_part2', 'professional journey.')}</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              {t('auth.login_desc')}
            </p>
          </div>
          
          <div className="mt-12 flex items-center gap-4 text-slate-500 text-sm font-semibold">
            <div className={`flex ${isRtl ? 'space-x-reverse -space-x-3' : '-space-x-3'}`}>
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-indigo-500"></div>
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-emerald-500"></div>
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-fuchsia-500 flex items-center justify-center text-white text-[10px] font-black">Demo</div>
            </div>
            <span>{t('auth.professionals_joined')}</span>
          </div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:py-24 relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.05]" 
             style={{ backgroundImage: 'radial-gradient(var(--cc-primary) 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
        
        <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="text-center lg:text-start space-y-2 mb-10">
            <div className="lg:hidden w-16 h-16 bg-slate-900 dark:bg-white/5 rounded-2xl mx-auto mb-6 flex items-center justify-center text-[var(--cc-primary)] shadow-xl">
              <Compass size={32} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t('login.signInBtn')}</h1>
            <p className="text-slate-500 font-medium">{t('auth.enter_credentials')}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden">
            
            {error && (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-4 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex gap-3 items-center mb-6">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 text-start">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('hud_labels.email_endpoint')}</label>
                    <div className="relative">
                        <Mail className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                        <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            required
                            className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-[var(--cc-primary)]/50 ${isRtl ? 'pr-12 pl-4' : 'ps-12 pe-4'} py-4 rounded-xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all focus:bg-white dark:focus:bg-slate-800 shadow-sm`}
                            placeholder="mail@example.com"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('hud_labels.access_key')}</label>
                      <Link to="#" className="text-xs font-bold text-[var(--cc-primary)] hover:underline">{t('auth.forgot_password')}</Link>
                    </div>
                    <div className="relative">
                        <Lock className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                        <input 
                            type="password" 
                            name="password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            required
                            className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-[var(--cc-primary)]/50 ${isRtl ? 'pr-12 pl-4' : 'ps-12 pe-4'} py-4 rounded-xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all focus:bg-white dark:focus:bg-slate-800 shadow-sm`}
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button 
                    disabled={loading}
                    className="w-full py-4 mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 transition-all"
                >
                    {loading ? (t('login.signingIn')) : <>{t('login.signInBtn')} <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} /></>}
                </button>
            </form>
            
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
              <p className="text-center text-slate-500 font-medium text-sm">
                  {t('login.noAccount')} <Link to="/register" className="text-[var(--cc-primary)] hover:underline font-bold mx-1">{t('login.createAccount')}</Link>
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-600 mt-8">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-black tracking-widest uppercase">{t('auth.secure_connection')}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
