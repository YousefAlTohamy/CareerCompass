import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadialBarChart, RadialBar, Cell
} from 'recharts';
import {
  CheckCircle2, AlertCircle, ChevronRight, Sparkles, Zap,
  ChevronLeft, ExternalLink, Library, Printer, Activity,
  Lightbulb, AlertTriangle, FileText, Upload, Briefcase,
  Download, Target, Layers, Cpu, Database, Info, Share2, ArrowLeft, MapPin, TrendingUp
} from 'lucide-react';
import TypingEffect from '../../components/TypingEffect';
import RoadmapTimeline from '../../components/RoadmapTimeline';
import { gapAnalysisAPI, targetRolesAPI } from '../../api/endpoints';
import applicationsAPI from '../../api/applications';
import { useScrapingStatus } from '../../hooks/useScrapingStatus';
import { useTranslation } from 'react-i18next';
import HUDLayout from '../../components/HUDLayout';
import HUDSkeleton from '../../components/HUDSkeleton';

// --- BULLETPROOF HELPERS ---
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
  const safePercentage = Math.min(100, Math.max(0, Number(percentage) || 0));
  const data = [{ name: 'Match', value: safePercentage }];
  const color = safePercentage >= 75 ? '#10b981' : safePercentage >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="relative w-40 h-40 min-w-40 min-h-40 flex items-center justify-center shrink-0">
      <RadialBarChart
        width={160}
        height={160}
        cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
        barSize={10} data={data} startAngle={90} endAngle={90 - (3.6 * safePercentage)}
      >
        <RadialBar background dataKey="value" cornerRadius={10}>
          <Cell fill={color} />
        </RadialBar>
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center ltr">
        <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{Math.round(safePercentage)}%</span>
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mt-0.5">{t('gap_analysis.match_score')}</span>
      </div>
    </div>
  );
};

// --- Learning Resource Card ---
const LearningResource = ({ skill, t }) => {
  const skillName = getSkillName(skill);
  if (!skillName) return null;

  const providers = [
    { name: 'Udemy', color: 'bg-indigo-600', icon: 'U', url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skillName)}` },
    { name: 'Coursera', color: 'bg-blue-600', icon: 'C', url: `https://www.coursera.org/courses?query=${encodeURIComponent(skillName)}` }
  ];

  return (
    <div className="flex items-center gap-4 glass-card p-4 rounded-2xl hover:bg-white dark:hover:bg-slate-800/80 hover:translate-y-[-4px] transition-all group border-slate-100 dark:border-white/5 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
        <Library size={18} />
      </div>
      <div className="flex-1 min-w-0 text-start">
        <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate uppercase tracking-tight">{skillName}</h4>
        <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">{t('gap_analysis.bridging_path', 'BRIDGING_PATH')}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {providers.map(p => (
          <a
            key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
            className={`w-8 h-8 ${p.color} text-white rounded-lg flex items-center justify-center text-[10px] font-black hover:brightness-110 shadow-sm transition-all`}
            title={p.name}
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
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scrapingJobId, setScrapingJobId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [targetRoles, setTargetRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    targetRolesAPI.getTargetRoles().then(res => {
      const payload = res?.data?.data ?? res?.data ?? [];
      setTargetRoles(Array.isArray(payload) ? payload : []);
    }).catch(console.error);
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [t, isRtl]);

  const loadAnalysis = async (roleIdOverride = null) => {
    try {
      setLoading(true);
      setError('');
      let response;
      const roleIdToUse = roleIdOverride || selectedRole;
      if (roleIdToUse) response = await gapAnalysisAPI.analyzeRole(roleIdToUse);
      else if (jobId) response = await gapAnalysisAPI.analyzeJob(jobId);
      else { setLoading(false); return; }
      
      const data = response?.data?.data ?? response?.data ?? response;
      if (data?.status === 'processing' && data?.scraping_job_id) {
        setScrapingJobId(data.scraping_job_id);
        setLoading(false);
        return;
      }
      setAnalysis(data);
    } catch (err) {
      setError(err.response?.data?.message || t('gap_analysis.error_failed'));
    } finally { setLoading(false); }
  };

  const { progress } = useScrapingStatus(scrapingJobId, {
    pollInterval: 3000,
    enabled: !!scrapingJobId,
    onCompleted: () => { setScrapingJobId(null); loadAnalysis(); },
    onFailed: () => setScrapingJobId(null)
  });

  const handleSaveToTracker = async () => {
    try {
      setSaving(true);
      await applicationsAPI.saveJob({ job_id: jobId, status: 'saved' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(t('jobs.error_save'));
    } finally { setSaving(false); }
  };

  useEffect(() => { loadAnalysis(); }, [jobId]);

  if (loading) {
    return (
      <HUDLayout loading={true} loadingType="standard">
        <div className="max-w-7xl mx-auto px-4 pt-32 space-y-10 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-white/5">
             <div className="space-y-4">
                <HUDSkeleton variant="rect" className="h-4 w-32" />
                <HUDSkeleton variant="rect" className="h-10 w-64" />
                <HUDSkeleton variant="rect" className="h-4 w-96" />
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {[1,2,3,4].map(i => <HUDSkeleton key={i} variant="rect" className="h-32 rounded-3xl" />)}
          </div>

          <div className="grid lg:grid-cols-12 gap-8">
             <div className="lg:col-span-8 space-y-6">
                <HUDSkeleton variant="rect" className="h-[500px] rounded-[2rem]" />
             </div>
             <div className="lg:col-span-4 space-y-6">
                <HUDSkeleton variant="rect" className="h-[500px] rounded-[2rem]" />
             </div>
          </div>
        </div>
      </HUDLayout>
    );
  }

  if (scrapingJobId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center relative overflow-hidden font-sans transition-colors duration-500">
        <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/10 blur-[150px] rounded-full -translate-y-1/2" />
        <motion.div animate={{ opacity: [0.7, 1, 0.7] }} className="space-y-10 max-w-lg relative z-10">
          <div className="w-28 h-28 bg-white dark:bg-indigo-500/10 border border-slate-200 dark:border-indigo-500/20 rounded-full flex items-center justify-center mx-auto shadow-xl dark:shadow-[0_0_50px_rgba(99,102,241,0.2)]">
            <Activity className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={48} />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white px-2 uppercase tracking-tighter leading-none">{t('gap_analysis.scanning_market')}</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium px-4">{t('gap_analysis.ai_scanning_desc')}</p>
          </div>
          <div className="px-8 space-y-4">
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
              <motion.div className="bg-indigo-500 h-full shadow-[0_0_15px_#6366f1]" animate={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">{progress}% {t('gap_analysis.scanned')}</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!analysis) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-bold text-slate-500">{error || 'SYNTHESIS_FAILED'}</div>;

  const matchPct = Number(analysis?.match_percentage || analysis?.match_score || 0);
  const safeMatched = Array.isArray(analysis?.matched_skills) ? analysis.matched_skills : [];
  const safeCritical = Array.isArray(analysis?.critical_skills) ? analysis.critical_skills : (Array.isArray(analysis?.missing_skills) ? analysis.missing_skills : []);
  const safeRecs = Array.isArray(analysis?.recommendations) ? analysis.recommendations : [];
  const safeRoadmap = Array.isArray(analysis?.roadmap) ? analysis.roadmap : [];
  const jobTitle = analysis?.target_role || analysis?.job?.title || t('gap_analysis.untitled_analysis');
  const companyName = !analysis?.target_role ? (analysis?.job?.company || t('gap_analysis.market_source', 'Market Source')) : t('gap_analysis.market_baseline');

  return (
    <HUDLayout loading={saving} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-8 relative z-10 print-container">
        
        {/* --- HEADER NAV (Consistent with Market Intelligence) --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3">
              <Activity size={14} className="animate-pulse" /> {t('gap_analysis.dossier_active', 'Gap Analysis Active')}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
              <ArrowLeft onClick={() => navigate('/jobs')} size={28} className="cursor-pointer hover:text-indigo-500 transition-colors md:hidden" />
              {jobTitle}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{companyName} // {t('gap_analysis.market_baseline')}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group hidden md:block">
              <select 
                value={selectedRole} onChange={(e) => { setSelectedRole(e.target.value); loadAnalysis(e.target.value); }}
                className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl px-4 py-2 font-bold text-sm focus:outline-none shadow-sm backdrop-blur-md cursor-pointer"
              >
                <option value="">{t('gap_analysis.analyze_specific_job', 'Switch Context')}</option>
                {targetRoles.map(role => <option key={role.id} value={role.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{(role.name || '').toUpperCase()}</option>)}
              </select>
            </div>
            <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
              <Download size={16} /> {t('gap_analysis.export_report')}
            </button>
          </div>
        </div>

        {/* --- STATS ROW (Market Intelligence Style) --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group backdrop-blur-md flex flex-col justify-center items-center text-center">
              <div className="mb-4"><PremiumMatchGauge percentage={matchPct} t={t} /></div>
           </div>

           <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group backdrop-blur-md">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl"><CheckCircle2 size={20} /></div>
              </div>
              <h3 className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{t('gap_analysis.matched_skills')}</h3>
              <p className="text-3xl font-black text-slate-800 dark:text-white">{safeMatched.length}</p>
           </div>

           <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group backdrop-blur-md">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl"><AlertTriangle size={20} /></div>
              </div>
              <h3 className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{t('gap_analysis.missing_gaps')}</h3>
              <p className="text-3xl font-black text-slate-800 dark:text-white">{safeCritical.length}</p>
           </div>

           <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group backdrop-blur-md">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl"><TrendingUp size={20} className="rtl-flip" /></div>
              </div>
              <h3 className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{t('hud_labels.market_pulse')}</h3>
              <p className="text-3xl font-black text-slate-800 dark:text-white">98.2</p>
           </div>
        </div>

        {/* --- MAIN CONTENT GRID --- */}
        <div className="grid lg:grid-cols-12 gap-8">
           
           {/* COMPETENCY BREAKDOWN (Left) */}
           <div className="lg:col-span-8 space-y-8">
              <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 md:p-10 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl"><Cpu size={20} /></div>
                    <div>
                      <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{t('gap_analysis.competency_breakdown')}</h2>
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('gap_analysis.matching_expertise')}</p>
                    </div>
                 </div>

                 <div className="space-y-12">
                    {/* MATCHED SKILLS */}
                    <section>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500" /> {t('gap_analysis.matching_expertise')}
                       </h4>
                       <div className="flex flex-wrap gap-2">
                          {safeMatched.map((skill, i) => (
                             <span key={i} className="px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl uppercase tracking-tight">
                                {getSkillName(skill)}
                             </span>
                          ))}
                       </div>
                    </section>

                    {/* PRIORITY GAPS */}
                    <section>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <AlertTriangle size={14} className="text-rose-500" /> {t('gap_analysis.priority_gaps')}
                       </h4>
                       <div className="grid sm:grid-cols-2 gap-4">
                          {safeCritical.map((skill, i) => {
                             const score = getSkillScore(skill);
                             return (
                                <div key={i} className="p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 group hover:border-rose-500/20 transition-all shadow-sm">
                                   <div className="flex justify-between items-center mb-4">
                                      <span className="font-bold text-slate-800 dark:text-white text-sm uppercase truncate pr-4">{getSkillName(skill)}</span>
                                      <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10 tabular-nums">{score}%</span>
                                   </div>
                                   <div className="w-full bg-slate-200/50 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, delay: i * 0.1 }} className="bg-rose-500 h-full shadow-[0_0_8px_#f43f5e]" />
                                   </div>
                                </div>
                             )
                          })}
                       </div>
                    </section>
                 </div>
              </div>

              {/* ROADMAP SECTION */}
              {safeRoadmap.length > 0 && (
                 <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 md:p-10 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-8">
                       <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20"><Zap size={20} /></div>
                       <div>
                          <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{t('gap_analysis.roadmap_strategy', 'ROADMAP_STRATEGY')}</h2>
                          <p className="text-xs font-bold text-slate-400 dark:text-slate-500">System generated skill acquisition timeline.</p>
                       </div>
                    </div>
                    <RoadmapTimeline roadmap={safeRoadmap} />
                 </div>
              )}
           </div>

           {/* AI SUMMARY & LEARNING (Right) */}
           <div className="lg:col-span-4 space-y-8">
              
              {/* ACTION TERMINAL */}
              <div className="bg-slate-900 dark:bg-black rounded-3xl p-8 shadow-lg border border-slate-800 dark:border-slate-900 relative overflow-hidden group">
                 <div className="absolute -right-10 -top-10 opacity-5 group-hover:rotate-12 transition-transform duration-1000"><Target size={180} /></div>
                 <div className="relative z-10 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 rounded-lg text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                       <Activity size={12} /> terminal_active
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{t('gap_analysis.strategy_execution')}</h3>
                    <p className="text-slate-400 font-medium text-sm leading-relaxed">
                       {t('gap_analysis.match_pct_ready', { percent: matchPct })} System recommends deployment of bridging strategies.
                    </p>
                    <div className="space-y-3">
                       {analysis?.job?.url && (
                          <a href={analysis.job.url} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-indigo-600 hover:bg-white text-white hover:text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all hover:translate-y-[-2px]">
                             <ExternalLink size={16} /> {t('gap_analysis.apply_now')}
                          </a>
                       )}
                       <button onClick={handleSaveToTracker} disabled={saving || saveSuccess} className={`w-full py-4 border-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${saveSuccess ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'}`}>
                          {saving ? 'PROCESSING...' : saveSuccess ? 'SAVED_SUCCESS' : t('gap_analysis.save_for_later')}
                       </button>
                    </div>
                 </div>
              </div>

              {/* BRIDGE TIPS & RESOURCES */}
              <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md space-y-8">
                 <div className="flex items-center gap-3">
                    <Lightbulb className="text-amber-500" size={20} />
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{t('gap_analysis.bridge_the_gap')}</h3>
                 </div>
                 
                 <div className="space-y-4">
                    {safeRecs.map((rec, i) => (
                       <div key={i} className="p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl font-medium text-sm text-slate-600 dark:text-slate-400 leading-relaxed border border-slate-100 dark:border-white/5">
                          <TypingEffect text={getRecText(rec)} speed={15} />
                       </div>
                    ))}
                 </div>

                 <div className="pt-8 border-t border-slate-100 dark:border-white/5 space-y-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t('gap_analysis.suggested_learning')}</span>
                    <div className="space-y-3">
                       {safeCritical.slice(0, 4).map((s, i) => <LearningResource key={i} skill={s} t={t} />)}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print, nav, header, aside button, .hud-overlay { display: none !important; }
          body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; }
          .print-container { max-width: 100% !important; pt: 0 !important; padding: 20px !important; }
          .glass-card { background: white !important; border: 1px solid #eee !important; box-shadow: none !important; color: black !important; border-radius: 12px !important; }
          .dark .glass-card { background: white !important; color: black !important; border: 1px solid #eee !important; }
          .text-slate-800, .text-white, .text-slate-900, .dark .text-white { color: black !important; }
          .bg-indigo-600, .bg-indigo-500 { background-color: #4f46e5 !important; -webkit-print-color-adjust: exact; }
          .bg-rose-500 { background-color: #f43f5e !important; -webkit-print-color-adjust: exact; }
          .bg-emerald-500 { background-color: #10b981 !important; -webkit-print-color-adjust: exact; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .grid { display: block !important; }
          .lg\\:col-span-8, .lg\\:col-span-4 { width: 100% !important; margin-bottom: 20px; }
          .sticky { position: relative !important; top: 0 !important; }
        }
        .ltr { direction: ltr !important; }
        .rtl-flip { transform: scaleX(-1); }
      `}} />
    </HUDLayout>
  );
}
