import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../../api/endpoints';
import Swal from 'sweetalert2';
import { 
  MapPin, 
  Briefcase, 
  Mail, 
  Linkedin, 
  Github, 
  Phone,
  User as UserIcon,
  Calendar,
  LogOut,
  Edit2,
  Save,
  X,
  Link as LinkIcon,
  Award,
  Plus,
  GraduationCap,
  Target,
  TrendingUp,
  Info
} from 'lucide-react';
import { TechBadges } from '../../components/AiInsights';

// Safe Helper function to get user initials
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const cleanName = name.trim();
  if (!cleanName) return '?';
  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts[0]) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return '?';
};

// Format date for display (handles Y-m-d strings)
const formatDate = (dateStr, language) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Format experience date range
const formatExperienceRange = (startDate, endDate, isCurrent, t, language) => {
  const start = formatDate(startDate, language) || 'N/A';
  if (isCurrent) return `${start} – ${t('profile.present')}`;
  const end = formatDate(endDate, language) || 'N/A';
  return `${start} – ${end}`;
};

// Get confidence badge color based on score (0.0–1.0)
const getConfidenceColor = (score) => {
  if (score == null || score === undefined) return { bg: 'bg-slate-100 dark:bg-slate-800/50', text: 'text-slate-600 dark:text-slate-400', bar: 'bg-slate-400' };
  const s = parseFloat(score);
  if (s >= 0.8) return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' };
  if (s >= 0.6) return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500' };
  if (s >= 0.4) return { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', bar: 'bg-orange-500' };
  return { bg: 'bg-slate-100 dark:bg-slate-800/50', text: 'text-slate-600 dark:text-slate-400', bar: 'bg-slate-400' };
};

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getUser();
      const data = response?.data?.data ?? response?.data ?? response;
      setProfile(data);
      setFormData(data || {});
      setError('');
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(t('profile.failed_load'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    if(e) e.preventDefault();
    try {
      setSaving(true);
      setError('');
      
      const response = await authAPI.updateProfile(formData);
      const updated = response?.data?.data ?? response?.data ?? response;
      setProfile((prev) => prev ? { ...prev, ...updated } : updated);
      
      await refreshUser();
      
      setEditing(false);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: t('profile.save_success'),
        showConfirmButton: false,
        timer: 3000,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error saving profile:', err);
      if (err.response?.data?.errors?.email) {
        setError(err.response.data.errors.email[0]);
      } else {
        setError(err.response?.data?.message || 'Failed to save profile changes.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: t('nav.logout') + '?',
      text: t('tracker.logout_confirm', 'Are you sure you want to sign out of your account?'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: t('tracker.logout_yes', 'Yes, logout'),
      cancelButtonText: t('profile.cancel')
    });

    if (result.isConfirmed) {
      await logout();
      navigate('/login');
    }
  };

  // Unified data source: prefer profile from loadProfile, fallback to user from AuthContext
  const data = profile ?? user;
  const headline = data?.headline ?? data?.job_title ?? data?.profile?.headline ?? data?.profile?.job_title;
  const totalYears = data?.total_experience_years ?? data?.profile?.total_experience_years;
  const seniority = data?.seniority ?? data?.profile?.seniority;
  const primaryDomain = data?.primary_domain ?? data?.profile?.primary_domain;
  const experiences = Array.isArray(data?.experiences) ? data.experiences : [];
  const skills = Array.isArray(data?.skills) ? data.skills : (Array.isArray(data?.profile?.skills) ? data.profile.skills : []);
  const hasExperiences = experiences.length > 0;
  const hasSkills = skills.length > 0;

  // Contact info: prioritise the nested contact_info JSON object from the profile
  const contactInfo = profile?.contact_info || data?.profile?.contact_info || {};
  const userPhone = contactInfo.phone || profile?.phone || user?.phone;
  const userLinkedin = contactInfo.linkedin_url || profile?.linkedin_url || user?.linkedin_url;
  const userGithub = contactInfo.github_url || profile?.github_url || user?.github_url;

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center items-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-slate-400 font-medium text-sm">{t('market.loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-300">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
           {t('nav.profile')}
        </h1>
        <button 
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl font-bold transition-all border border-rose-100 dark:border-rose-800 shadow-sm w-fit"
        >
           <LogOut size={18} />
           {t('nav.logout')}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
          <X size={18} className="cursor-pointer" onClick={() => setError('')}/>
          {error}
        </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        {/* Header Banner & Avatar Section */}
        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl -mx-20 -my-20 pointer-events-none"></div>
          
          <div className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="w-32 h-32 rounded-full bg-white dark:bg-slate-800 border-4 border-indigo-50 dark:border-slate-700 shadow-md text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-4xl shrink-0">
              {getInitials(profile?.name ?? user?.name)}
            </div>
            
            {/* Main Info & Rich Profile Summary */}
            <div className="flex-1 text-center md:text-left flex flex-col items-center md:items-start w-full">
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                {profile?.name ?? user?.name ?? 'Your Name'}
              </h2>
              
              {/* Prominent: Headline / Job Title */}
              {(headline || user?.role !== 'admin') && (
                <p className="text-lg text-slate-600 dark:text-slate-400 font-semibold flex items-center justify-center md:justify-start gap-2 mb-3 w-fit">
                  <Briefcase size={18} className="text-indigo-500 shrink-0" /> 
                  {headline || 'No Target Role Provided'}
                </p>
              )}

              {/* Rich Profile Pills: Experience, Seniority, Domain */}
              {(totalYears != null || seniority || primaryDomain) && user?.role !== 'admin' && (
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
                  {totalYears != null && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-bold border border-indigo-100 dark:border-indigo-800">
                      <Calendar size={14} /> {Number(totalYears) === totalYears ? `${totalYears} ${t('dashboard.years')}` : totalYears} {t('dashboard.total_experience')}
                    </span>
                  )}
                  {seniority && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-bold border border-violet-100 dark:border-violet-800">
                      <TrendingUp size={14} className="rtl-flip" /> {seniority}
                    </span>
                  )}
                  {primaryDomain && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg text-sm font-bold border border-teal-100 dark:border-teal-800">
                      <Target size={14} /> {primaryDomain}
                    </span>
                  )}
                </div>
              )}

              {/* Toggle Edit Mode Button */}
              {!editing && (
                 <button
                   onClick={() => {
                     setEditing(true);
                     const rawSkills = profile?.skills ?? data?.skills ?? [];
                     setFormData({
                       ...(profile ?? data),
                       skills: Array.isArray(rawSkills) ? rawSkills.map(s => s?.name ?? s) : []
                     });
                   }}
                   className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition shadow-sm font-bold text-sm w-full md:w-auto justify-center"
                 >
                   <Edit2 size={16} /> {t('profile.edit')}
                 </button>
              )}
            </div>
          </div>
        </div>

        {/* Details Body Section */}
        <div className="p-8 md:p-10">
          
          {editing ? (
             /* EDIT MODE FORM */
              <form onSubmit={handleSave} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                   <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('profile.personal_info')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">{t('register.nameLabel')}</label>
                    <input
                      type="text"
                      name="name"
                      required
                       value={formData?.name ?? ''}
                       onChange={handleChange}
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
                     />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">{t('login.emailLabel')}</label>
                    <input
                      type="email"
                      name="email"
                      required
                       value={formData?.email ?? ''}
                       onChange={handleChange}
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
                     />
                  </div>

                  {user?.role !== 'admin' && (
                    <>
                      {/* Phone */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">{t('profile.phone')}</label>
                        <input
                          type="text"
                          name="phone"
                          value={formData?.phone ?? ''}
                          onChange={handleChange}
                          placeholder="+20 123 456 7890"
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      {/* Location */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">{t('profile.location')}</label>
                        <input
                          type="text"
                          name="location"
                          value={formData?.location ?? ''}
                          onChange={handleChange}
                          placeholder="e.g. Cairo, Egypt"
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      {/* Job Title */}
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">{t('profile.headline')}</label>
                        <input
                          type="text"
                          name="job_title"
                          value={formData?.job_title ?? formData?.headline ?? ''}
                          onChange={handleChange}
                          placeholder="e.g. Backend Developer"
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      {/* LinkedIn */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">{t('profile.linkedin_url')}</label>
                        <input
                          type="url"
                          name="linkedin_url"
                          value={formData?.linkedin_url ?? ''}
                          onChange={handleChange}
                          placeholder="https://linkedin.com/in/..."
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      {/* GitHub */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">{t('profile.github_url')}</label>
                        <input
                          type="url"
                          name="github_url"
                          value={formData?.github_url ?? ''}
                          onChange={handleChange}
                          placeholder="https://github.com/..."
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </>
                  )}
                  {/* Skills (Edit Mode) */}
                  {user?.role !== 'admin' && (
                    <div className="space-y-3 md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">{t('profile.skills')}</label>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                        {(Array.isArray(formData?.skills) ? formData.skills : []).map((skill, index) => (
                            <span 
                            key={index} 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold uppercase tracking-wider border border-indigo-100 dark:border-indigo-800 group"
                            >
                            {typeof skill === 'string' ? skill : skill?.name ?? skill}
                            <button
                                type="button"
                                onClick={() => {
                                const updatedSkills = (formData?.skills ?? []).filter((_, i) => i !== index);
                                setFormData({ ...formData, skills: updatedSkills });
                                }}
                                className="text-indigo-400 hover:text-rose-500 hover:bg-rose-50 rounded-full p-0.5 transition-colors"
                            >
                                <X size={12} />
                            </button>
                            </span>
                        ))}
                        {(!formData?.skills || formData.skills.length === 0) && (
                            <span className="text-sm font-medium text-slate-400 italic py-1">{t('tracker.no_apps')}</span>
                        )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                                onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (newSkill.trim()) {
                                    const existing = formData?.skills ?? [];
                                    const trimmed = newSkill.trim();
                                    if (!existing.some(s => (typeof s === 'string' ? s : s?.name) === trimmed)) {
                                        setFormData({
                                        ...formData,
                                        skills: [...existing, trimmed]
                                        });
                                    }
                                    setNewSkill('');
                                    }
                                }
                                }}
                                placeholder={t('dashboard.upload_prompt')}
                                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                if (newSkill.trim()) {
                                    const existing = formData?.skills ?? [];
                                    const trimmed = newSkill.trim();
                                    if (!existing.some(s => (typeof s === 'string' ? s : s?.name) === trimmed)) {
                                    setFormData({
                                        ...formData,
                                        skills: [...existing, trimmed]
                                    });
                                    }
                                    setNewSkill('');
                                }
                                }}
                                className="flex items-center justify-center gap-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-200 dark:border-slate-700"
                            >
                                <Plus size={16} /> {t('profile.add_skill')}
                            </button>
                        </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 transition shadow-sm font-bold disabled:opacity-50"
                  >
                    {saving ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> {t('cv_analyzer.processing')}</>
                    ) : (
                      <><Save size={18} /> {t('profile.save')}</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setFormData(profile ?? data ?? {});
                      setError('');
                    }}
                    disabled={saving}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-8 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition font-bold disabled:opacity-50 border border-slate-200 dark:border-slate-700"
                  >
                    <X size={18} /> {t('profile.cancel')}
                  </button>
                </div>
             </form>

          ) : (
             /* VIEW MODE */
             <div className="space-y-10 animate-in fade-in duration-300">
                
                {/* Contact & Personal Details Grid */}
                <div>
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                      <UserIcon size={16} /> {t('profile.personal_info')}
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm text-slate-400"><Mail size={18} /></div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">{t('profile.email')}</p>
                          <p className="font-medium text-slate-800 dark:text-slate-200 truncate" title={profile?.email ?? user?.email}>{profile?.email ?? user?.email}</p>
                        </div>
                      </div>

                      {user?.role !== 'admin' && (
                        <>
                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm text-slate-400"><Phone size={18} /></div>
                            <div>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">{t('profile.phone')}</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200">{userPhone ?? <span className="text-slate-400 italic">{t('profile.not_provided')}</span>}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm text-slate-400"><MapPin size={18} /></div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">{t('profile.location')}</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 truncate" title={profile?.location ?? user?.location ?? data?.profile?.location}>{profile?.location ?? user?.location ?? data?.profile?.location ?? <span className="text-slate-400 italic">{t('profile.not_provided', 'Not provided')}</span>}</p>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm text-slate-400"><Calendar size={18} /></div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">{t('tracker.member_since', 'Member Since')}</p>
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {(profile?.created_at ?? user?.created_at) ? new Date(profile?.created_at ?? user?.created_at).toLocaleDateString(t('tracker.lang_code', 'en-US')) : 'N/A'}
                          </p>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Professional Links */}
                {user?.role !== 'admin' && (
                   <div>
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                       <LinkIcon size={16} /> {t('profile.professional_links', 'Professional Links')}
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       
                       {/* LinkedIn Card */}
                       {userLinkedin ? (
                         <a href={userLinkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-500 transition-colors group">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-lg text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                              <Linkedin size={20} />
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-slate-800 dark:text-white font-bold">LinkedIn Profile</div>
                              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">{userLinkedin}</div>
                            </div>
                         </a>
                       ) : (
                         <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 opacity-70">
                            <div className="bg-slate-200 dark:bg-slate-800 p-2.5 rounded-lg text-slate-400 dark:text-slate-500"><Linkedin size={20} /></div>
                            <div>
                              <div className="text-slate-600 dark:text-slate-400 font-bold text-sm">LinkedIn Profile</div>
                              <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">Not added yet</div>
                            </div>
                         </div>
                       )}

                       {/* GitHub Card */}
                       {userGithub ? (
                         <a href={userGithub} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors group">
                            <div className="bg-slate-200 dark:bg-slate-700 p-2.5 rounded-lg text-slate-700 dark:text-slate-200 group-hover:scale-110 transition-transform">
                              <Github size={20} />
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-slate-800 dark:text-white font-bold">GitHub Profile</div>
                              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">{userGithub}</div>
                            </div>
                         </a>
                       ) : (
                         <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 opacity-70">
                            <div className="bg-slate-200 dark:bg-slate-800 p-2.5 rounded-lg text-slate-400 dark:text-slate-500"><Github size={20} /></div>
                            <div>
                              <div className="text-slate-600 dark:text-slate-400 font-bold text-sm">GitHub Profile</div>
                              <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">Not added yet</div>
                            </div>
                         </div>
                       )}
                       
                     </div>
                   </div>
                )}

                {/* Experiences Timeline Section */}
                {user?.role !== 'admin' && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                      <GraduationCap size={16} /> {t('profile.experience')}
                    </h3>
                    
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                      {hasExperiences ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                          {(experiences || [])
                            .sort((a, b) => {
                              const dateA = a?.end_date ? new Date(a.end_date) : new Date();
                              const dateB = b?.end_date ? new Date(b.end_date) : new Date();
                              return dateB - dateA;
                            })
                            .map((exp, index) => (
                              <div key={exp?.id ?? index} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                  <div className="flex flex-col">
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white">{exp?.title ?? t('profile.untitled_role')}</h4>
                                    <p className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm mt-0.5">{exp?.company ?? '—'}</p>
                                    {exp?.location && (
                                      <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1 mt-1">
                                        <MapPin size={14} /> {exp.location}
                                      </p>
                                    )}
                                    <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-2 uppercase tracking-wide">
                                      {formatExperienceRange(exp?.start_date, exp?.end_date, exp?.is_current, t, i18n.language)}
                                    </p>
                                    {exp?.description && (
                                      <p className="text-slate-600 dark:text-slate-400 text-sm mt-3 leading-relaxed whitespace-pre-wrap border-s-2 border-slate-100 dark:border-slate-700 ps-4">{exp.description}</p>
                                    )}
                                    {/* Per-job technologies from Phase 2 Temporal Logic */}
                                    {exp?.technologies && exp.technologies.length > 0 && (
                                      <div className="mt-3">
                                        <TechBadges technologies={exp.technologies} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                          <GraduationCap className="w-14 h-14 text-slate-200 dark:text-slate-700 mb-4 stroke-1" />
                          <p className="text-slate-600 dark:text-slate-400 font-semibold">{t('profile.no_experience', 'No work experience listed yet')}</p>
                          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 max-w-sm">
                            {t('profile.experience_instruction', 'Upload your CV to populate your experiences automatically, or add them when editing your profile.')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Skills with Confidence & Evidence */}
                {user?.role !== 'admin' && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                      <Award size={16} /> {t('profile.skills')}
                    </h3>
                    
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                      {hasSkills ? (
                        <div className="flex flex-wrap gap-3">
                          {(skills || []).map((skill, index) => {
                            const name = skill?.name ?? skill;
                            const confidence = skill?.confidence_score;
                            const evidence = skill?.evidence;
                            const colors = getConfidenceColor(confidence);
                            const percent = confidence != null ? Math.round(parseFloat(confidence) * 100) : null;

                            return (
                              <div
                                key={skill?.id ?? index}
                                className={`relative group flex flex-col rounded-xl border ${colors.bg} dark:bg-slate-900/50 ${colors.text} border-slate-200/60 dark:border-slate-700 overflow-hidden min-w-[160px] max-w-[220px]`}
                              >
                                <div className="p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-sm uppercase tracking-wider truncate">
                                      {name}
                                    </span>
                                     {evidence && (
                                       <span
                                         className="shrink-0 p-0.5 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 cursor-help"
                                         title={evidence}
                                       >
                                         <Info size={14} className="opacity-70" />
                                       </span>
                                     )}
                                  </div>
                                  {percent != null && (
                                    <div className="mt-2">
                                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${colors.bar}`}
                                          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                                        />
                                      </div>
                                       <p className="text-xs font-medium mt-1 opacity-80">{t('profile.ai_confidence', 'AI confidence')}: {percent}%</p>
                                    </div>
                                  )}
                                  {evidence && (
                                    <p className="text-xs opacity-75 mt-1 truncate" title={evidence}>
                                      {evidence}
                                    </p>
                                  )}
                                </div>
                                {/* Tooltip on hover for full evidence */}
                                {evidence && (
                                  <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                                    {evidence}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                         <div className="flex flex-col items-center justify-center py-6 text-center">
                          <Award className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3 stroke-1" />
                          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('profile.no_skills_message', 'No skills extracted for your profile yet.')}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('profile.skills_instruction', 'Upload your CV to populate your skills automatically, or add them manually by editing your profile.')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
