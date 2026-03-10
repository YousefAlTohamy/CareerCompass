import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, Cell
} from 'recharts';
import {
  CheckCircle2, AlertCircle, ChevronRight, Sparkles, Zap,
  ChevronLeft, ExternalLink, GraduationCap, Briefcase, Library, Printer, Activity
} from 'lucide-react';
import TypingEffect from '../../components/TypingEffect';
import { gapAnalysisAPI } from '../../api/endpoints';
import applicationsAPI from '../../api/applications';
import { useScrapingStatus } from '../../hooks/useScrapingStatus';

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
const PremiumMatchGauge = ({ percentage }) => {
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
        <span className="text-4xl font-black text-slate-800 tracking-tighter">{Math.round(safePercentage)}%</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Match Score</span>
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
    <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all group">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
        <Library size={20} />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 text-sm">{skillName}</h4>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Master this skill</p>
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

export default function GapAnalysis() {
  const { jobId } = useParams();
  const navigate = useNavigate();
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
      const data = response.data.data || response.data;

      if (data.status === 'processing' && data.scraping_job_id) {
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
      <div className="min-h-screen bg-[#f8fafc] py-12 px-4 sm:px-6 lg:px-8">
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
            <h2 className="text-3xl font-black text-white tracking-tight">Scanning Market Data</h2>
            <p className="text-slate-400 font-medium">Our AI is scanning live listings to benchmark your profile...</p>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <motion.div className="bg-indigo-500 h-full" animate={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">{progress}% Scanned</span>
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

  const matchPct = Number(analysis?.match_percentage) || 0;
  const safeMatched = Array.isArray(analysis?.matched_skills) ? analysis.matched_skills : [];
  const safeCritical = Array.isArray(analysis?.critical_skills) ? analysis.critical_skills : [];
  const safeRecs = Array.isArray(analysis?.recommendations) ? analysis.recommendations : [];
  const safeRecommendedJobs = Array.isArray(analysis?.recommended_jobs) ? analysis.recommended_jobs : [];
  const jobTitle = analysis?.job?.title || 'Job Title';
  const companyName = analysis?.job?.company || 'Company Name';
  const jobUrl = analysis?.job?.url || '#';

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8 font-sans pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">

        {/* TOP BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print mb-4">
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors group text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200"
          >
            <ChevronLeft size={16} /> Back to Opportunities
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 rounded-xl font-bold flex items-center gap-2 text-sm shadow-sm transition-all"
          >
            <Printer size={16} /> Export Report
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-6">

            {/* OVERVIEW CARD */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <PremiumMatchGauge percentage={matchPct} />
                <div className="flex-1 space-y-6 text-center md:text-left w-full">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800">{jobTitle}</h1>
                    <p className="text-base font-bold text-indigo-600">{companyName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-black uppercase text-emerald-600">Matched Skills</p>
                      <p className="text-3xl font-black text-emerald-700">{safeMatched.length}</p>
                    </div>
                    <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                      <p className="text-[10px] font-black uppercase text-rose-600">Missing Gaps</p>
                      <p className="text-3xl font-black text-rose-700">{safeCritical.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COMPETENCY BREAKDOWN (STRENGTHS & GAPS AS CARDS) */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 tracking-tight mb-6">Competency Breakdown</h3>

              <div className="space-y-8">
                {/* GREEN CHIPS FOR MATCHED SKILLS */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" /> Your Matching Expertise
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {safeMatched.map((skill, i) => {
                      const skillName = getSkillName(skill);
                      if (!skillName) return null;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 font-bold text-sm shadow-sm"
                        >
                          {skillName}
                        </div>
                      );
                    })}
                    {safeMatched.length === 0 && (
                      <p className="text-slate-400 text-sm">No matched skills identified.</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100"></div>

                {/* GRID OF CARDS FOR CRITICAL GAPS */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-500" /> Priority Gaps to Fill
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {safeCritical.map((skill, i) => {
                      const skillName = getSkillName(skill);
                      const score = getSkillScore(skill);
                      if (!skillName) return null;
                      return (
                        <div
                          key={i}
                          className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-rose-200 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-slate-700 text-sm truncate">{skillName}</span>
                            <span className="text-[10px] font-black text-rose-600 bg-rose-100/50 px-2 py-0.5 rounded-md">{score}%</span>
                          </div>
                          <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden mt-auto">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} className="bg-rose-500 h-full" />
                          </div>
                        </div>
                      );
                    })}
                    {safeCritical.length === 0 && (
                      <p className="text-slate-400 text-sm col-span-full">No priority gaps identified.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <aside className="lg:col-span-4 space-y-6">

            {/* DARK ACTION CARD */}
            <div className="bg-slate-900 p-8 rounded-3xl shadow-lg border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Briefcase size={80} />
              </div>
              <h3 className="text-xl font-black text-white mb-2 relative z-10">Strategy Execution</h3>
              <p className="text-slate-400 text-sm mb-6 font-medium relative z-10">
                Your profile is {matchPct}% ready for this role.
              </p>
              <div className="space-y-3 relative z-10">
                <a
                  href={jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 font-black py-4 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors"
                >
                  Apply Now <ExternalLink size={16} />
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
                  {saving ? 'Processing...' : saveSuccess ? '✓ Saved to Tracker' : 'Save for Later'}
                </button>
              </div>
            </div>

            {/* LEARNING BRIDGE */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 mb-6">Bridge the Gap</h3>

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
                      className="flex items-start gap-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
                        <Zap size={16} />
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed">
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
                <h4 className="text-[10px] font-black uppercase text-slate-400">Suggested Learning Paths</h4>
                {safeCritical.slice(0, 4).map((skill, i) => (
                  <LearningResource key={i} skill={skill} />
                ))}
                {safeCritical.length === 0 && (
                  <p className="text-slate-400 text-sm">No learning paths suggested.</p>
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
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Symmetry Careers</h2>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Jobs with similar skill structures</p>
              </div>
              <ChevronRight className="text-slate-300" size={24} />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {safeRecommendedJobs.map((job, idx) => (
                <motion.div
                  key={job?.id ?? idx}
                  whileHover={{ y: -5 }}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all cursor-pointer"
                  onClick={() => job?.id && navigate(`/gap-analysis/${job.id}`)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-md tracking-wider">
                      {job?.source || 'Direct'}
                    </span>
                    <Sparkles size={16} className="text-indigo-500" />
                  </div>
                  <h4 className="font-black text-slate-800 text-lg mb-1 leading-tight line-clamp-1">{job?.title || 'Job'}</h4>
                  <p className="text-sm font-bold text-slate-400 mb-4">{job?.company || ''}</p>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                    <span>📍 {job?.location || 'Remote'}</span>
                    <span className="text-emerald-500">{job?.job_type || ''}</span>
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
