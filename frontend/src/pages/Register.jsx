import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, ArrowRight, ArrowLeft, AlertCircle, Compass, ShieldCheck, CheckCircle2 } from 'lucide-react';
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

export default function Register() {
  const [step, setStep] = useState(1);
  const totalSteps = 2;
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.dir() === 'rtl';

  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!formData.name || !formData.email) {
        setError(t('auth.fill_all_fields'));
        return;
      }
      setError('');
      setStep(2);
    }
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.password_confirmation) {
      setError(t('register.errorMismatch')); return;
    }
    setLoading(true);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, t('auth.registration_failed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans flex items-center justify-center py-12 px-4 transition-colors duration-500">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" 
           style={{ backgroundImage: 'radial-gradient(var(--cc-primary) 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
      
      <div className="fluid-bg-container">
        <div className="fluid-blob w-[600px] h-[600px] bg-indigo-500/10 top-[-10%] left-[-10%] opacity-20" />
        <div className="fluid-blob w-[500px] h-[500px] bg-emerald-500/10 bottom-[-10%] right-[-5%] opacity-20" />
      </div>

      <div className="w-full max-w-[480px] relative z-10 space-y-8 animate-in fade-in duration-700">
        
        <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl mx-auto flex items-center justify-center text-[var(--cc-primary)] border border-slate-200 dark:border-slate-800 shadow-xl shadow-[var(--cc-primary)]/10">
                <Compass size={44} strokeWidth={1.5} className="animate-spin-slow" />
            </div>
            <div className="space-y-1">
                <h1 className="text-3xl font-black tracking-tight">{t('auth.register_title')}</h1>
                <p className="text-slate-500 text-sm font-medium">{t('auth.register_subtitle')}</p>
            </div>
        </div>

        <div className="glass-card p-10 border-slate-200 dark:border-slate-800 relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl rounded-3xl">
            
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cc-primary)]">
                  {t('auth.step', { current: step, total: totalSteps })}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {step === 1 ? t('auth.identity') : t('auth.security')}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full bg-[var(--cc-primary)] transition-all duration-500 ease-out`} 
                  style={{ width: `${(step / totalSteps) * 100}%` }} 
                />
              </div>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex gap-3 items-center mb-6">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                </div>
            )}

            <form onSubmit={step === 1 ? nextStep : handleSubmit} className="space-y-6 text-start">
                
                {/* Step 1: Basic Info */}
                {step === 1 && (
                  <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('hud_labels.operator_identity')}</label>
                        <div className="relative">
                            <User className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                            <input 
                                name="name" 
                                value={formData.name} 
                                onChange={handleChange} 
                                className={`w-full bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-[var(--cc-primary)]/50 ${isRtl ? 'pr-12 pl-4' : 'ps-12 pe-4'} py-4 rounded-xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all`} 
                                placeholder={t('cv_builder.full_name')} 
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('hud_labels.email_endpoint')}</label>
                        <div className="relative">
                            <Mail className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                            <input 
                                type="email" 
                                name="email" 
                                value={formData.email} 
                                onChange={handleChange} 
                                className={`w-full bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-[var(--cc-primary)]/50 ${isRtl ? 'pr-12 pl-4' : 'ps-12 pe-4'} py-4 rounded-xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all`} 
                                placeholder="mail@example.com" 
                            />
                        </div>
                    </div>
                    
                    <button 
                        type="submit"
                        className="w-full py-4 mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 transition-all"
                    >
                        {t('auth.next_step')} <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
                    </button>
                  </div>
                )}

                {/* Step 2: Security */}
                {step === 2 && (
                  <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('hud_labels.access_key')}</label>
                        <div className="relative">
                            <Lock className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                            <input 
                                type="password" 
                                name="password" 
                                value={formData.password} 
                                onChange={handleChange} 
                                required 
                                className={`w-full bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-[var(--cc-primary)]/50 ${isRtl ? 'pr-12 pl-4' : 'ps-12 pe-4'} py-4 rounded-xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all`} 
                                placeholder="••••••••" 
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('hud_labels.confirm')}</label>
                        <div className="relative">
                            <ShieldCheck className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                            <input 
                                type="password" 
                                name="password_confirmation" 
                                value={formData.password_confirmation} 
                                onChange={handleChange} 
                                required 
                                className={`w-full bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-[var(--cc-primary)]/50 ${isRtl ? 'pr-12 pl-4' : 'ps-12 pe-4'} py-4 rounded-xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all`} 
                                placeholder="••••••••" 
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-3 mt-4">
                      <button 
                          type="button"
                          onClick={prevStep}
                          className="py-4 px-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center"
                      >
                          <ArrowLeft size={18} className={isRtl ? 'rotate-180' : ''} />
                      </button>
                      <button 
                          type="submit"
                          disabled={loading} 
                          className="flex-1 py-4 bg-[var(--cc-primary)] text-slate-900 font-black uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(0,210,255,0.3)] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 transition-all"
                      >
                          {loading ? t('register.creatingAccount') : <>{t('register.createAccountBtn')} <CheckCircle2 size={18} /></>}
                      </button>
                    </div>
                  </div>
                )}
            </form>
        </div>

        <div className="text-center space-y-4">
            <p className="text-slate-500 font-medium text-sm">
                {t('register.haveAccount')} <Link to="/login" className="text-[var(--cc-primary)] hover:underline font-bold mx-1">{t('register.signIn')}</Link>
            </p>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.animate-spin-slow { animation: spin-slow 20s linear infinite; } @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}} />
    </div>
  );
}
