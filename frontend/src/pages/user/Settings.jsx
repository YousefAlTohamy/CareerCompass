import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, MapPin, Briefcase, Cpu, ShieldCheck, 
  Save, ArrowLeft, Plus, Trash2, Globe, Database,
  Settings as SettingsIcon, Layers, Target, Info, CheckCircle2, AlertCircle
} from 'lucide-react';
import { authAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import HUDLayout from '../../components/HUDLayout';
import Swal from 'sweetalert2';

const skillName = (skill) => {
  if (typeof skill === 'string') return skill;
  return skill?.name || skill?.title || skill?.skill || '';
};

const normalizeSkillPayload = (skills) => (
  Array.isArray(skills)
    ? skills.map(skillName).filter(Boolean)
    : []
);

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    headline: '',
    location: '',
    bio: '',
  });
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [experiences, setExperiences] = useState([]);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        headline: user.headline || '',
        location: user.location || '',
        bio: user.bio || '',
      });
      setSkills(Array.isArray(user.skills) ? user.skills : (Array.isArray(user.profile?.skills) ? user.profile.skills : []));
      setExperiences(Array.isArray(user.experiences) ? user.experiences : []);
    }
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [user, isRtl]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await authAPI.updateProfile({
        ...profileData,
        email: user?.email,
        job_title: profileData.headline,
      });
      await refreshUser();
      Swal.fire({
        icon: 'success',
        title: t('settings.success_update', 'Profile Updated'),
        timer: 2000,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.error'), text: err.response?.data?.message || 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = (e) => {
    if (e.key === 'Enter' && newSkill.trim()) {
      e.preventDefault();
      if (!normalizeSkillPayload(skills).includes(newSkill.trim())) {
        const updatedSkills = [...skills, newSkill.trim()];
        setSkills(updatedSkills);
        updateProfileSkills(updatedSkills);
      }
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove) => {
    const skillToRemoveName = skillName(skillToRemove);
    const updatedSkills = skills.filter(s => skillName(s) !== skillToRemoveName);
    setSkills(updatedSkills);
    updateProfileSkills(updatedSkills);
  };

  const updateProfileSkills = async (updatedSkills) => {
    try {
      await authAPI.updateProfile({
        ...profileData,
        email: user?.email,
        job_title: profileData.headline,
        skills: normalizeSkillPayload(updatedSkills),
      });
      await refreshUser();
    } catch (err) { console.error(err); }
  };

  const addExperience = () => {
    setExperiences([...experiences, { title: '', company: '', start_date: '', end_date: '', description: '', is_current: false }]);
  };

  const updateExperience = (index, field, value) => {
    const newExps = [...experiences];
    newExps[index][field] = value;
    setExperiences(newExps);
  };

  const removeExperience = (index) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    try {
      setLoading(true);
      await authAPI.updateProfile({
        ...profileData,
        email: user?.email,
        job_title: profileData.headline,
        skills: normalizeSkillPayload(skills),
        experiences
      });
      await refreshUser();
      Swal.fire({
        icon: 'success',
        title: t('settings.success_save_all', 'All changes saved'),
        timer: 1500,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.error'), text: 'Failed to save all changes' });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: t('nav.profile'), icon: User },
    { id: 'experience', label: t('hud_labels.exp_units', 'Experience'), icon: Briefcase },
    { id: 'skills', label: t('dashboard.skills', 'Skills'), icon: Cpu },
  ];

  return (
    <HUDLayout loading={loading} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-8 relative z-10">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/profile')} className="p-3 glass-card !rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
              <ArrowLeft size={20} className={isRtl ? 'rotate-180' : ''} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">
                {t('settings.title', 'DATA_ADJUSTMENT')}
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">System Node // Identity Configuration</p>
            </div>
          </div>
          <button 
            onClick={handleSaveAll}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
          >
            <Save size={18} /> {t('settings.save_all', 'Commit All Changes')}
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* SIDE NAVIGATION */}
            <div className="lg:col-span-3 space-y-2 sticky top-32">
               {tabs.map(tab => (
                 <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/50 dark:bg-white/5 text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:text-indigo-500 border border-transparent'}`}
                 >
                    <tab.icon size={18} />
                    {tab.label}
                 </button>
               ))}
               <div className="p-6 glass-card !rounded-2xl border-dashed border-slate-200 dark:border-white/5 mt-8 text-center space-y-2 opacity-50">
                  <Database size={24} className="mx-auto text-indigo-500" />
                  <p className="text-[8px] font-black uppercase leading-tight">Neural synchronization active. All changes are encrypted.</p>
               </div>
            </div>

            {/* MAIN FORM AREA */}
            <div className="lg:col-span-9">
               <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white/60 dark:bg-slate-900/50 rounded-3xl p-8 md:p-10 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md"
                  >
                     {activeTab === 'profile' && (
                        <form onSubmit={handleProfileUpdate} className="space-y-8 text-start">
                           <div className="grid md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('hud_labels.full_name')}</label>
                                 <div className="relative">
                                    <User className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                       type="text" value={profileData.name} 
                                       onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                                       className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 ps-12 pe-4 py-3 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                                    />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('profile.headline')}</label>
                                 <div className="relative">
                                    <Target className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                       type="text" value={profileData.headline} 
                                       onChange={(e) => setProfileData({...profileData, headline: e.target.value})}
                                       className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 ps-12 pe-4 py-3 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                                    />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                                 <div className="relative">
                                    <MapPin className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                       type="text" value={profileData.location} 
                                       onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                                       className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 ps-12 pe-4 py-3 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                                    />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Node (Read Only)</label>
                                 <div className="relative">
                                    <Mail className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    <input 
                                       type="email" value={user?.email || ''} readOnly
                                       className="w-full bg-slate-100/50 dark:bg-white/5 border border-transparent ps-12 pe-4 py-3 rounded-xl font-bold text-sm text-slate-400 cursor-not-allowed"
                                    />
                                 </div>
                              </div>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Bio / Data Summary</label>
                              <textarea 
                                 rows={4} value={profileData.bio} 
                                 onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                                 className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-4 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all text-slate-900 dark:text-white resize-none"
                                 placeholder="Summarize your professional identity..."
                              />
                           </div>
                           <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-white/5">
                              <button type="submit" className="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95">
                                 {t('settings.update_profile', 'Update Profile Data')}
                              </button>
                           </div>
                        </form>
                     )}

                     {activeTab === 'experience' && (
                        <div className="space-y-8 text-start">
                           <div className="flex items-center justify-between">
                              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Timeline Management</h2>
                              <button onClick={addExperience} className="px-4 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-[9px] uppercase tracking-widest border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                                 <Plus size={14} /> Add Entry
                              </button>
                           </div>

                           <div className="space-y-6">
                              {experiences.map((exp, idx) => (
                                 <div key={idx} className="p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4 relative group">
                                    <button onClick={() => removeExperience(idx)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                                       <Trash2 size={16} />
                                    </button>
                                    <div className="grid md:grid-cols-2 gap-4">
                                       <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Position</label>
                                          <input 
                                             type="text" value={exp.title} onChange={(e) => updateExperience(idx, 'title', e.target.value)}
                                             className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg font-bold text-xs"
                                          />
                                       </div>
                                       <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Organization</label>
                                          <input 
                                             type="text" value={exp.company} onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                                             className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg font-bold text-xs"
                                          />
                                       </div>
                                       <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Start Date</label>
                                          <input 
                                             type="text" value={exp.start_date} onChange={(e) => updateExperience(idx, 'start_date', e.target.value)}
                                             className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg font-bold text-xs"
                                             placeholder="e.g. Jan 2022"
                                          />
                                       </div>
                                       <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">End Date / Present</label>
                                          <input 
                                             type="text" value={exp.end_date} onChange={(e) => updateExperience(idx, 'end_date', e.target.value)}
                                             className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg font-bold text-xs"
                                             placeholder="e.g. Dec 2023 or Present"
                                          />
                                       </div>
                                    </div>
                                    <div className="space-y-1">
                                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Contribution Summary</label>
                                       <textarea 
                                          rows={3} value={exp.description} onChange={(e) => updateExperience(idx, 'description', e.target.value)}
                                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-4 rounded-lg font-bold text-xs resize-none"
                                       />
                                    </div>
                                 </div>
                              ))}
                              {experiences.length === 0 && (
                                 <div className="py-12 text-center opacity-30 border-2 border-dashed border-slate-200 rounded-3xl">
                                    <Briefcase size={32} className="mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase">No experience nodes found. Add your first entry.</p>
                                 </div>
                              )}
                           </div>
                        </div>
                     )}

                     {activeTab === 'skills' && (
                        <div className="space-y-8 text-start">
                           <div className="space-y-2">
                              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Neural Skills Matrix</h2>
                              <p className="text-xs font-medium text-slate-500">Add or remove competencies from your core sync profile.</p>
                           </div>

                           <div className="space-y-6">
                              <div className="relative group">
                                 <Cpu className="absolute start-5 top-1/2 -translate-y-1/2 text-indigo-500" size={20} />
                                 <input 
                                    type="text" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={handleAddSkill}
                                    placeholder="Type skill and press Enter..."
                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/10 ps-14 pe-6 py-5 rounded-2xl font-bold text-base outline-none focus:border-indigo-500 transition-all shadow-sm"
                                 />
                                 <div className="absolute end-6 top-1/2 -translate-y-1/2">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-2 py-1 rounded">ENTER_TO_ADD</span>
                                 </div>
                              </div>

                              <div className="flex flex-wrap gap-3">
                                 <AnimatePresence>
                                    {skills.map((skill, i) => (
                                        <motion.span
                                           key={`${skillName(skill)}-${i}`}
                                           initial={{ opacity: 0, scale: 0.8 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.8 }}
                                          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-[10px] uppercase tracking-widest group shadow-sm"
                                        >
                                           {skillName(skill)}
                                           <button onClick={() => removeSkill(skill)} className="opacity-40 hover:opacity-100 hover:text-rose-500 transition-all">
                                             <X size={14} />
                                          </button>
                                       </motion.span>
                                    ))}
                                 </AnimatePresence>
                              </div>
                           </div>
                        </div>
                     )}
                  </motion.div>
               </AnimatePresence>
            </div>
        </div>
      </div>
    </HUDLayout>
  );
}

// Reuse X icon from lucide-react if not imported
function X({ size }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}
