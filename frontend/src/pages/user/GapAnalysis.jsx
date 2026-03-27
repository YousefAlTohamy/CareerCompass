import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, Cell
} from 'recharts';
import {
  CheckCircle2, AlertCircle, ChevronRight, Sparkles, Zap,
  ChevronLeft, ExternalLink, GraduationCap, Briefcase, Library, Printer, Activity,
  Lightbulb, AlertTriangle, FileText, Upload
} from 'lucide-react';
import TypingEffect from '../../components/TypingEffect';
import { gapAnalysisAPI } from '../../api/endpoints';
import applicationsAPI from '../../api/applications';
import { useScrapingStatus } from '../../hooks/useScrapingStatus';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

// --- BULLETPROOF HELPERS (CRITICAL TO PREVENT CRASHES) ---
export const getSkillName = (skill) => {
  if (!skill) return '';
  if (typeof skill === 'string') return skill;
  return String(skill.name || skill.keyword || skill.title || '');
};

export const getSkillScore = (skill) => {
  if (!skill || typeof skill !== 'object') return 80;
  return Number(skill.importance_score || skill.score || 80);
};

export const getRecText = (rec) => {
  if (!rec) return '';
  if (typeof rec === 'string') return rec;
  return String(rec.text || rec.message || rec.recommendation || JSON.stringify(rec) || '');
};

// --- RECHARTS MATCH GAUGE ---
const PremiumMatchGauge = ({ percentage, t }) => {
  const safePercentage = Number(percentage) || 0;
  const data = [{ name: 'Match', value: safePercentage }];
  const color = safePercentage >= 75 ? '#10b981' : safePercentage >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
          barSize={15} data={data} startAngle={90} endAngle={90 - (3.6 * safePercentage)}
        >
          <RadialBar background dataKey="value" cornerRadius={10}>
            <Cell fill={color} />
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{Math.round(safePercentage)}%</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">{t('gap_analysis.match_score')}</span>
      </div>
    </div>
  );
};

// --- CV Completeness Circular Progress Ring ---
const CompletenessRing = ({ score, t }) => {
  const safeScore = Math.min(100, Math.max(0, Number(score) || 0));
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;
  const color = safeScore >= 75 ? 'stroke-emerald-500' : safeScore >= 50 ? 'stroke-amber-500' : 'stroke-rose-500';

  return (
    <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-200"
        />
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${color} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{Math.round(safeScore)}%</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('dashboard.complete', 'Complete')}</span>
      </div>
    </div>
  );
};

// --- Learning Resource Card ---
const LearningResource = ({ skill }) => {
  const skillName = getSkillName(skill);
  if (!skillName) return null;

  const providers = [
    { name: 'Udemy', color: 'bg-[#A435F0]', icon: 'U', url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skillName)}` },
    { name: 'Coursera', color: 'bg-[#0056D2]', icon: 'C', url: `https://www.coursera.org/courses?query=${encodeURIComponent(skillName)}` }
  ];

  return (
    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 hover:shadow-sm transition-all group">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
        <Library size={20} />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 dark:text-white text-sm">{skillName}</h4>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">Master this skill</p>
      </div>
      <div className="flex gap-2">
        {providers.map(p => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-8 h-8 ${p.color} text-white rounded-lg flex items-center justify-center text-xs font-black hover:scale-110 transition-transform`}
            title={`Search on ${p.name}`}
          >
            {p.icon}
          </a>
        ))}
      </div>
    </div>
  );
};

// --- General CV Health / AI Resume Analysis Section ---
const GeneralCvHealthSection = ({ cvAnalysis, user, t, onNavigateToProfile = () => window.location.assign('/profile') }) => {
  const cvData = cvAnalysis ?? user?.cv_analysis ?? null;
  const strengths = cvData?.strengths ?? [];
  const gaps = cvData?.gaps ?? [];
  const redFlags = cvData?.red_flags ?? [];
  const completenessScore = cvData?.completeness_score;
  const hasCvAnalysis = cvData != null;

  if (!hasCvAnalysis) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800/50 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 border-dashed"
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">{t('gap_analysis.ai_resume_analysis')}</h3>
          <p className="text-slate-500 text-sm max-w-md mb-6">
            {t('gap_analysis.upload_prompt_full', 'Please upload your CV in your Profile to unlock deep AI analysis. Get insights on your strengths, gaps, and resume completeness.')}
          </p>
          <button
            onClick={onNavigateToProfile}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors"
          >
            <Upload size={16} /> {t('dashboard.go_to_profile')}
          </button>
        </div>
      </motion.div>
    );
  }

  const safeStrengths = Array.isArray(strengths) ? strengths : [];
  const safeGaps = Array.isArray(gaps) ? gaps : [];
  const safeRedFlags = Array.isArray(redFlags) ? redFlags : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white dark:bg-slate-800/50 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="relative z-10">
        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight mb-6 flex items-center gap-2">
          <Sparkles size={22} className="text-indigo-500" /> {t('gap_analysis.ai_resume_analysis')}
        </h3>

        <div className="flex flex-col md:flex-row gap-8 mb-8">
          <CompletenessRing score={completenessScore} t={t} />
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
              {t('gap_analysis.cv_health_desc')}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Strengths - Green Theme */}
          <div className="bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-800">
            <h4 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" /> {t('gap_analysis.strengths')}
            </h4>
            {safeStrengths.length > 0 ? (
              <ul className="space-y-2">
                {safeStrengths.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-800 font-medium">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                    <span>{typeof item === 'string' ? item : String(item)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-emerald-600/80 text-sm italic">{t('gap_analysis.no_strengths')}</p>
            )}
          </div>

          {/* Gaps - Amber Theme */}
          <div className="bg-amber-50/80 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-100 dark:border-amber-800">
            <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lightbulb size={18} className="text-amber-600" /> {t('gap_analysis.gaps')}
            </h4>
            {safeGaps.length > 0 ? (
              <ul className="space-y-2">
                {safeGaps.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800 font-medium">
                    <Lightbulb size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <span>{typeof item === 'string' ? item : String(item)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-amber-600/80 text-sm italic">{t('gap_analysis.no_gaps')}</p>
            )}
          </div>

          {/* Red Flags - Rose Theme (only render if not empty) */}
          {safeRedFlags.length > 0 && (
            <div className="bg-rose-50/80 dark:bg-rose-900/20 rounded-2xl p-5 border border-rose-100 dark:border-rose-800">
              <h4 className="text-xs font-black text-rose-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" /> {t('gap_analysis.red_flags')}
              </h4>
              <ul className="space-y-2">
                {safeRedFlags.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-rose-800 font-medium">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{typeof item === 'string' ? item : String(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default function GapAnalysis() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scrapingJobId, setScrapingJobId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      const response = await gapAnalysisAPI.analyzeJob(jobId);
      const data = response?.data?.data ?? response?.data ?? response;

      if (data?.status === 'processing' && data?.scraping_job_id) {
        setScrapingJobId(data.scraping_job_id);
        setLoading(false);
        return;
      }

      setAnalysis(data);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Gap analysis failed');
      setLoading(false);
    }
  };

  const { status, progress } = useScrapingStatus(scrapingJobId, {
    pollInterval: 3000,
    enabled: !!scrapingJobId,
    onCompleted: () => {
      setScrapingJobId(null);
      loadAnalysis();
    },
    onFailed: () => setScrapingJobId(null)
  });

  const handleSaveToTracker = async () => {
    try {
      setSaving(true);
      await applicationsAPI.saveJob({ job_id: jobId, status: 'saved' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Could not save to tracker. It might already be there.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { loadAnalysis(); }, [jobId]);

  // --- SKELETON LOADING STATE ---
  if (loading || (status === 'processing' && !analysis)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg mb-8" />
          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-6">
              <div className="h-64 bg-white rounded-3xl shadow-sm border border-slate-200 animate-pulse" />
              <div className="h-80 bg-white rounded-3xl shadow-sm border border-slate-200 animate-pulse" />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <div className="h-48 bg-white rounded-3xl shadow-sm border border-slate-200 animate-pulse" />
              <div className="h-64 bg-white rounded-3xl shadow-sm border border-slate-200 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SCRAPING TERMINAL STATE (DARK) ---
  if (scrapingJobId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center relative overflow-hidden font-sans">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} className="space-y-8 max-w-md">
          <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto">
            <Activity className="text-indigo-400 animate-pulse" size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight">{t('gap_analysis.scanning_market')}</h2>
            <p className="text-slate-400 font-medium">{t('gap_analysis.ai_scanning_desc')}</p>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <motion.div className="bg-indigo-50 h-full" animate={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">{progress}% {t('gap_analysis.scanned')}</span>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Library className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <p className="text-slate-600 font-bold">{error || 'No analysis data available.'}</p>
      </div>
    );
  }

  const matchPct = Number(analysis?.match_percentage) ?? 0;
  const safeMatched = Array.isArray(analysis?.matched_skills) ? analysis.matched_skills : [];
  const safeCritical = Array.isArray(analysis?.critical_skills) ? analysis.critical_skills : [];
  const safeRecs = Array.isArray(analysis?.recommendations) ? analysis.recommendations : [];
  const safeRecommendedJobs = Array.isArray(analysis?.recommended_jobs) ? analysis.recommended_jobs : [];
  const jobTitle = analysis?.job?.title || 'Job Title';
  const companyName = analysis?.job?.company || 'Company Name';
  const jobUrl = analysis?.job?.url || '#';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 font-sans pb-24 transition-colors duration-300">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">

        {/* TOP BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print mb-4">
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-colors group text-sm bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
          >
            <ChevronLeft size={16} className="rtl-flip" /> {t('gap_analysis.back_to_jobs')}
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500 rounded-xl font-bold flex items-center gap-2 text-sm shadow-sm transition-all"
          >
            <Printer size={16} /> {t('gap_analysis.export_report')}
          </button>
        </div>

        {/* GENERAL CV HEALTH / AI RESUME ANALYSIS - TOP SECTION */}
        <GeneralCvHealthSection
          cvAnalysis={analysis?.cv_analysis}
          user={user}
          t={t}
          onNavigateToProfile={() => navigate('/profile')}
        />

        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN - Job-Specific Gap Analysis */}
          <div className="lg:col-span-8 space-y-6">

            {/* OVERVIEW CARD */}
            <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <PremiumMatchGauge percentage={matchPct} t={t} />
                <div className="flex-1 space-y-6 text-center md:text-left w-full">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white">{jobTitle}</h1>
                    <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">{companyName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-black uppercase text-emerald-600">{t('gap_analysis.matched_skills')}</p>
                      <p className="text-3xl font-black text-emerald-700">{safeMatched.length}</p>
                    </div>
                    <div className="bg-rose-50/50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800">
                      <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">{t('gap_analysis.missing_gaps')}</p>
                      <p className="text-3xl font-black text-rose-700 dark:text-rose-300">{safeCritical.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COMPETENCY BREAKDOWN (STRENGTHS & GAPS AS CARDS) */}
            <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight mb-6">{t('gap_analysis.competency_breakdown')}</h3>

              <div className="space-y-8">
                {/* GREEN CHIPS FOR MATCHED SKILLS */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" /> {t('gap_analysis.matching_expertise')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {safeMatched.map((skill, i) => {
                      const skillName = getSkillName(skill);
                      if (!skillName) return null;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 font-bold text-sm shadow-sm"
                        >
                          {skillName}
                        </div>
                      );
                    })}
                    {safeMatched.length === 0 && (
                      <p className="text-slate-400 text-sm">{t('gap_analysis.no_matched_skills')}</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700"></div>

                {/* GRID OF CARDS FOR CRITICAL GAPS */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-500" /> {t('gap_analysis.priority_gaps')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {safeCritical.map((skill, i) => {
                      const skillName = getSkillName(skill);
                      const score = getSkillScore(skill);
                      if (!skillName) return null;
                      return (
                        <div
                          key={i}
                          className="flex flex-col p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:border-rose-200 dark:hover:border-rose-900 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{skillName}</span>
                            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-100/50 dark:bg-rose-900/40 px-2 py-0.5 rounded-md">{score}%</span>
                          </div>
                          <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden mt-auto">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} className="bg-rose-500 h-full" />
                          </div>
                        </div>
                      );
                    })}
                    {safeCritical.length === 0 && (
                      <p className="text-slate-400 text-sm col-span-full">{t('gap_analysis.no_priority_gaps')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <aside className="lg:col-span-4 space-y-6">

            {/* DARK ACTION CARD */}
            <div className="bg-slate-900 dark:bg-black p-8 rounded-3xl shadow-lg border border-slate-800 dark:border-slate-900 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Briefcase size={80} className="rtl-flip" />
              </div>
              <h3 className="text-xl font-black text-white mb-2 relative z-10">{t('gap_analysis.strategy_execution')}</h3>
              <p className="text-slate-400 text-sm mb-6 font-medium relative z-10">
                {t('gap_analysis.match_pct_ready', { percent: matchPct })}
              </p>
              <div className="space-y-3 relative z-10">
                <a
                  href={jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 font-black py-4 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                >
                  {t('gap_analysis.apply_now')} <ExternalLink size={16} className="rtl-flip" />
                </a>
                <button
                  onClick={handleSaveToTracker}
                  disabled={saving || saveSuccess}
                  className={`w-full py-4 rounded-xl font-bold text-sm transition-all border-2 ${
                    saveSuccess
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-transparent border-slate-600 text-white hover:bg-slate-800'
                  }`}
                >
                  {saving ? t('gap_analysis.processing') : saveSuccess ? `✓ ${t('gap_analysis.saved_to_tracker')}` : t('gap_analysis.save_for_later')}
                </button>
              </div>
            </div>

            {/* LEARNING BRIDGE */}
            <div className="bg-white dark:bg-slate-800/50 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6">{t('gap_analysis.bridge_the_gap')}</h3>

              {/* RECOMMENDATIONS WITH TYPING EFFECT */}
              <div className="space-y-4 mb-8">
                {safeRecs.map((rec, idx) => {
                  const recText = getRecText(rec);
                  if (!recText) return null;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all"
                    >
                      <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                        <Zap size={16} className="rtl-flip" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        <TypingEffect text={recText} speed={20} />
                      </p>
                    </motion.div>
                  );
                })}
                {safeRecs.length === 0 && (
                  <p className="text-slate-400 text-sm">No recommendations available.</p>
                )}
              </div>

              {/* SUGGESTED LEARNING PATHS */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400">{t('gap_analysis.suggested_learning')}</h4>
                {safeCritical.slice(0, 4).map((skill, i) => (
                  <LearningResource key={i} skill={skill} />
                ))}
                {safeCritical.length === 0 && (
                  <p className="text-slate-400 text-sm">{t('gap_analysis.no_learning_paths')}</p>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* SYMMETRY CAREERS - RECOMMENDED JOBS */}
        {safeRecommendedJobs.length > 0 && (
          <section className="mt-20">
            <div className="flex items-center justify-between mb-10">
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{t('gap_analysis.symmetry_careers')}</h2>
                <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">{t('gap_analysis.jobs_similar_skills')}</p>
              </div>
              <ChevronRight className="text-slate-300 rtl-flip" size={24} />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {safeRecommendedJobs.map((job, idx) => (
                <motion.div
                  key={job?.id ?? idx}
                  whileHover={{ y: -5 }}
                  className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500 transition-all cursor-pointer"
                  onClick={() => job?.id && navigate(`/gap-analysis/${job.id}`)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md tracking-wider">
                      {job?.source || t('jobs.source.direct')}
                    </span>
                    <Sparkles size={16} className="text-indigo-500" />
                  </div>
                  <h4 className="font-black text-slate-800 dark:text-white text-lg mb-1 leading-tight line-clamp-1">{job?.title || 'Job'}</h4>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-4">{job?.company || ''}</p>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span>📍 {job?.location || 'Remote'}</span>
                    <span className="text-emerald-500 dark:text-emerald-400">{job?.job_type || ''}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </motion.div>
    </div>
  );
}
