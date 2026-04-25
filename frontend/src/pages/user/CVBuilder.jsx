import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  FileText, Download, User, Briefcase, GraduationCap, Code, 
  ChevronRight, Sparkles, Layout, Save, Wand2, Activity, Eye, EyeOff
} from 'lucide-react';
import HUDLayout from '../../components/HUDLayout';

export default function CVBuilder() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [activeTab, setActiveTab] = useState('personal');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [cvData, setCvData] = useState({
    personal: { name: 'Ahmed Al-Tohamy', role: 'Senior Frontend Developer', email: 'ahmed@example.com', phone: '+20 100 123 4567', location: 'Cairo, Egypt', summary: 'Passionate and futuristic frontend developer with 5+ years of experience building scalable and visually stunning web applications.' },
    experience: [
      { id: 1, title: 'Frontend Engineer', company: 'TechCorp', period: '2023 - Present', desc: 'Leading the UI/UX redesign using React and Tailwind CSS. Improved performance by 40%.' },
      { id: 2, title: 'Web Developer', company: 'Creative Solutions', period: '2020 - 2023', desc: 'Developed responsive websites and dashboards. Collaborated with backend teams to integrate RESTful APIs.' }
    ],
    education: [
      { id: 1, degree: 'BSc Computer Science', institution: 'Cairo University', period: '2016 - 2020' }
    ],
    skills: 'React, Node.js, Tailwind CSS, Framer Motion, UI/UX Design, TypeScript'
  });

  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const handleChange = (section, field, value) => {
    setCvData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: 'personal', icon: User, label: t('cv_builder.personal', 'Personal Info') },
    { id: 'experience', icon: Briefcase, label: t('cv_builder.experience', 'Experience') },
    { id: 'education', icon: GraduationCap, label: t('cv_builder.education', 'Education') },
    { id: 'skills', icon: Code, label: t('cv_builder.skills', 'Skills') }
  ];

  return (
    <HUDLayout>
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-8 relative z-10 print-container">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3">
              <Wand2 size={14} className="animate-pulse" /> {t('cv_builder.ai_powered', 'AI-Powered Builder')}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
              {t('cv_builder.title', 'Smart CV Builder')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
              {t('cv_builder.subtitle', 'Design a futuristic, ATS-friendly resume in minutes.')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm"
            >
              {isPreviewMode ? <EyeOff size={16} /> : <Eye size={16} />} 
              {isPreviewMode ? t('cv_builder.edit_mode', 'Edit Mode') : t('cv_builder.preview', 'Preview')}
            </button>
            <button 
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              <Download size={16} /> {t('cv_builder.export_pdf', 'Export PDF')}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* EDITOR SECTION */}
          {!isPreviewMode && (
            <div className="lg:col-span-5 space-y-6 no-print">
              <div className="flex overflow-x-auto hide-scrollbar gap-2 p-1 glass-card !rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${
                      activeTab === tab.id 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-white/5'
                    }`}
                  >
                    <tab.icon size={14} /> {tab.label}
                  </button>
                ))}
              </div>

              <div className="glass-card !rounded-3xl p-6 md:p-8 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm h-[600px] overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6 text-start"
                  >
                    {activeTab === 'personal' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('cv_builder.full_name', 'Full Name')}</label>
                          <input type="text" value={cvData.personal.name} onChange={(e) => handleChange('personal', 'name', e.target.value)} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('cv_builder.job_title', 'Job Title')}</label>
                          <input type="text" value={cvData.personal.role} onChange={(e) => handleChange('personal', 'role', e.target.value)} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('cv_builder.email', 'Email')}</label>
                            <input type="email" value={cvData.personal.email} onChange={(e) => handleChange('personal', 'email', e.target.value)} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('cv_builder.phone', 'Phone')}</label>
                            <input type="text" value={cvData.personal.phone} onChange={(e) => handleChange('personal', 'phone', e.target.value)} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('cv_builder.summary', 'Professional Summary')}</label>
                          <textarea rows="4" value={cvData.personal.summary} onChange={(e) => handleChange('personal', 'summary', e.target.value)} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white resize-none" />
                        </div>
                      </div>
                    )}
                    
                    {activeTab === 'experience' && (
                      <div className="space-y-6">
                        {cvData.experience.map((exp, idx) => (
                          <div key={exp.id} className="p-4 border border-slate-200 dark:border-white/10 rounded-2xl space-y-4 bg-slate-50/50 dark:bg-black/20">
                            <div className="grid grid-cols-2 gap-4">
                              <input type="text" value={exp.title} placeholder={t('cv_builder.job_title')} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white" />
                              <input type="text" value={exp.company} placeholder={t('cv_builder.company')} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white" />
                            </div>
                            <input type="text" value={exp.period} placeholder={t('cv_builder.period')} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white" />
                            <textarea rows="3" value={exp.desc} placeholder={t('cv_builder.description')} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none resize-none text-slate-900 dark:text-white" />
                          </div>
                        ))}
                        <button className="w-full py-3 border-2 border-dashed border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-500/5 transition-all">
                          + {t('cv_builder.add_experience')}
                        </button>
                      </div>
                    )}

                    {activeTab === 'education' && (
                      <div className="space-y-6">
                        {cvData.education.map((edu, idx) => (
                          <div key={edu.id} className="p-4 border border-slate-200 dark:border-white/10 rounded-2xl space-y-4 bg-slate-50/50 dark:bg-black/20">
                            <input type="text" value={edu.degree} placeholder={t('cv_builder.degree')} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white" />
                            <input type="text" value={edu.institution} placeholder={t('cv_builder.institution')} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white" />
                            <input type="text" value={edu.period} placeholder={t('cv_builder.period')} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white" />
                          </div>
                        ))}
                        <button className="w-full py-3 border-2 border-dashed border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-500/5 transition-all">
                          + {t('cv_builder.add_education')}
                        </button>
                      </div>
                    )}

                    {activeTab === 'skills' && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('cv_builder.skills_comma', 'Skills (Comma separated)')}</label>
                        <textarea rows="4" value={cvData.skills} onChange={(e) => setCvData({...cvData, skills: e.target.value})} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white resize-none" />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* PREVIEW SECTION (A4 Canvas) */}
          <div className={`${isPreviewMode ? 'lg:col-span-12 flex justify-center' : 'lg:col-span-7'} transition-all duration-500`}>
            <div className={`cv-preview-canvas bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-200 p-10 md:p-14 relative overflow-hidden text-left ${isPreviewMode ? 'w-full max-w-4xl' : 'w-full h-[660px] overflow-y-auto custom-scrollbar'}`} dir="ltr">
              
              {/* Premium Header Design */}
              <div className="absolute top-0 left-0 w-full h-32 bg-slate-50 border-b border-slate-200 print-bg" />
              <div className="absolute top-0 left-0 w-2 h-32 bg-indigo-600 print-bg" />
              
              <div className="relative z-10 flex justify-between items-start mb-12">
                <div className="space-y-2">
                  <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">{cvData.personal.name}</h1>
                  <p className="text-indigo-600 font-bold text-lg tracking-tight">{cvData.personal.role}</p>
                </div>
                <div className="text-right space-y-1 text-xs font-medium text-slate-500 mt-2">
                  <p>{cvData.personal.email}</p>
                  <p>{cvData.personal.phone}</p>
                  <p>{cvData.personal.location}</p>
                </div>
              </div>

              <div className="relative z-10 space-y-10">
                {/* Summary */}
                <section>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-200 pb-2">Professional Summary</h3>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{cvData.personal.summary}</p>
                </section>

                <div className="grid grid-cols-3 gap-10">
                  <div className="col-span-2 space-y-10">
                    {/* Experience */}
                    <section>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-2">Experience</h3>
                      <div className="space-y-6">
                        {cvData.experience.map(exp => (
                          <div key={exp.id} className="relative pl-4 border-l-2 border-slate-100">
                            <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 print-bg" />
                            <h4 className="text-sm font-bold text-slate-900">{exp.title}</h4>
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2">
                              <span>{exp.company}</span>
                              <span>{exp.period}</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">{exp.desc}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="col-span-1 space-y-10">
                    {/* Skills */}
                    <section>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-2">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {cvData.skills.split(',').map((skill, idx) => (
                          <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded print-bg">
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    </section>

                    {/* Education */}
                    <section>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-2">Education</h3>
                      <div className="space-y-4">
                        {cvData.education.map(edu => (
                          <div key={edu.id}>
                            <h4 className="text-xs font-bold text-slate-900">{edu.degree}</h4>
                            <p className="text-[10px] font-bold text-slate-500 mb-0.5">{edu.institution}</p>
                            <p className="text-[10px] font-medium text-slate-400">{edu.period}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print, nav, header, aside, footer, .hud-overlay { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          .print-container { max-width: 100% !important; pt: 0 !important; padding: 0 !important; }
          .cv-preview-canvas { border: none !important; box-shadow: none !important; width: 100% !important; height: auto !important; overflow: visible !important; padding: 2cm !important; margin: 0 !important; }
          .print-bg { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 4px; }
      `}} />
    </HUDLayout>
  );
}
