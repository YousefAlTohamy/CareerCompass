import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Upload,
  X,
  Target,
  Search,
  Award,
  Zap,
  Compass,
  TrendingUp,
  Sparkles,
  FileText,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import { cvAPI, gapAnalysisAPI } from "../../api/endpoints";
import ProcessingAnimation from "../../components/ProcessingAnimation";
import Swal from "sweetalert2";
import {
  CareerIdentityCard,
  InsightsAlertsCard,
  SkillProficiencyCard,
} from "../../components/AiInsights";

// --- Format total experience years nicely ---
const formatExperienceYears = (years, t) => {
  if (years == null || years === undefined) return null;
  const n = Number(years);
  if (isNaN(n)) return null;
  if (n === 1) return `1 ${t('dashboard.year')}`;
  return `${n} ${t('dashboard.years')}`;
};

// --- Profile Completeness Ring (0-100) ---
const ProfileCompletenessRing = ({ score }) => {
  const safeScore = Math.min(100, Math.max(0, Number(score) || 0));
  const circumference = 2 * Math.PI * 32;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;
  const color = safeScore >= 75 ? "stroke-emerald-500" : safeScore >= 50 ? "stroke-amber-500" : "stroke-slate-300 dark:stroke-slate-600";

  return (
    <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="32" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100 dark:text-slate-800" />
        <circle
          cx="36"
          cy="36"
          r="32"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${color} transition-all duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-black text-slate-800 dark:text-white">{Math.round(safeScore)}%</span>
      </div>
    </div>
  );
};

// --- SkillChip ---
const SkillChip = ({ skill, onRemove }) => {
  const name = typeof skill === 'string' ? skill : (skill?.name ?? skill?.label ?? "Skill");
  if (!name || typeof name !== 'string') return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow hover:border-indigo-200 dark:hover:border-indigo-500 transition-all group cursor-default shrink-0"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
      <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-wider">{name}</span>
      {onRemove && skill?.id && (
        <button
          onClick={() => onRemove(skill.id)}
          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 p-0.5"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </motion.div>
  );
};

const ReadinessScore = ({ score, theme }) => {
  const safeScore = Number(score) || 0;
  const isDark = theme === 'dark';
  const data = [
    { name: "Readiness", value: safeScore, color: "#4f46e5" },
    { name: "Remaining", value: 100 - safeScore, color: isDark ? "#1e293b" : "#f1f5f9" },
  ];

  return (
    <div className="relative w-20 h-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={25}
            outerRadius={40}
            paddingAngle={0}
            dataKey="value"
            startAngle={90}
            endAngle={450}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black text-slate-900 dark:text-white">{safeScore}%</span>
      </div>
    </div>
  );
};

const SkillRadar = ({ skills, t }) => {
  const categories = {
    Technical: ["javascript", "react", "node", "python", "java", "c++", "backend", "frontend", "sql", "nosql", "api"],
    Tools: ["git", "docker", "kubernetes", "aws", "azure", "jenkins", "linux", "figma", "jira"],
    Industry: ["agile", "scrum", "fintech", "healthcare", "e-commerce", "security"],
    "Soft Skills": ["communication", "leadership", "teamwork", "problem solving", "management", "mentoring"],
  };

  const getScore = (keywords) => {
    const count = (skills ?? []).filter((s) =>
      keywords.some((k) => String(s?.name ?? s).toLowerCase().includes(k))
    ).length;
    return Math.min(count * 25 + 10, 100);
  };

  const data = [
    { subject: t('dashboard.technical', 'Technical'), A: getScore(categories["Technical"]), fullMark: 100 },
    { subject: t('dashboard.soft_skills', 'Soft Skills'), A: getScore(categories["Soft Skills"]), fullMark: 100 },
    { subject: t('dashboard.industry', 'Industry'), A: getScore(categories["Industry"]), fullMark: 100 },
    { subject: t('dashboard.tools', 'Tools'), A: getScore(categories["Tools"]), fullMark: 100 },
    { subject: t('dashboard.legacy', 'Legacy'), A: 30, fullMark: 100 },
  ];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "currentColor", fontSize: 11, fontWeight: 700 }} className="text-slate-400 dark:text-slate-500" />
          <Radar name="Skills" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Welcome Banner (when no cv_analysis) ---
const WelcomeBanner = ({ onUpload, uploading, t }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 shadow-xl border border-indigo-500/30 p-8 md:p-12"
  >
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
    <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
      <div className="flex-1 text-center md:text-left space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/15 text-indigo-100 text-xs font-bold uppercase tracking-wider">
          <Sparkles size={14} /> {t('dashboard.unlock_potential', 'Unlock Potential')}
        </div>
        <h2 className="text-2xl md:text-4xl font-black text-white leading-tight">
          {t('cv_analyzer.title')}
        </h2>
        <p className="text-indigo-100/90 text-sm md:text-base font-medium max-w-xl">
          {t('cv_analyzer.upload')}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-3.5 px-6 rounded-xl transition-colors shadow-lg"
          >
            <FileText size={18} /> {t('dashboard.go_to_profile', 'Go to Profile')}
          </Link>
          <label className="cursor-pointer inline-block">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onUpload} disabled={uploading} />
            <span className="inline-flex items-center gap-2 bg-indigo-500/80 hover:bg-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl transition-colors border border-white/20">
              <Upload size={18} /> {uploading ? t('jobs.loading', 'Uploading...') : t('cv_analyzer.analyze')}
            </span>
          </label>
        </div>
      </div>
      <div className="hidden lg:flex">
        <Compass size={100} className="text-white/20" strokeWidth={1} />
      </div>
    </div>
  </motion.div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [marketReadiness, setMarketReadiness] = useState(0);

  useEffect(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  useEffect(() => {
    loadSkills();
    loadRecommendations();
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const response = await cvAPI.getUserSkills();
      const skillsData = response?.data?.data?.skills ?? response?.data?.data ?? [];
      setSkills(Array.isArray(skillsData) ? skillsData : []);
    } catch (error) {
      console.error("Error loading skills:", error);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const response = await gapAnalysisAPI.getRecommendations();
      const responseData = response?.data?.data ?? {};
      setRecommendations(responseData?.missing_skills ?? []);
      setMarketReadiness(responseData?.market_readiness_score ?? 0);
    } catch (error) {
      console.error("Failed to load recommendations:", error);
    }
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        toast: true,
        icon: "error",
        title: t('cv_analyzer.size_error', 'File size must be less than 5MB'),
        showConfirmButton: false,
        timer: 3000,
      });
      return;
    }

    const formData = new FormData();
    formData.append("cv", file);

    try {
      setUploading(true);
      const response = await cvAPI.uploadCV(formData);
      const responseData = response?.data?.data ?? response?.data ?? {};
      const isNewRole = response?.is_new_role ?? response?.data?.is_new_role ?? responseData?.is_new_role ?? false;

      await refreshUser();

      if (isNewRole) {
        setUploading(false);
        setIsDiscovering(true);
        setTimeout(() => {
          setIsDiscovering(false);
          navigate("/jobs");
        }, 5000);
        return;
      }

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: t('cv_analyzer.optimized', 'CV Optimized!'),
        text: t('cv_analyzer.optimized_desc', 'Skills extracted and profile updated.'),
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      await loadSkills();
      await loadRecommendations();
    } catch (error) {
      console.error("CV upload error:", error);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: t('cv_analyzer.upload_failed', 'Upload Failed'),
        text: error.response?.data?.message ?? t('cv_analyzer.error_analyze', 'Failed to analyze CV'),
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } finally {
      setUploading(false);
    }
  };

  const removeSkill = async (skillId) => {
    try {
      await cvAPI.removeSkill(skillId);
      setSkills((prev) => prev.filter((s) => s?.id !== skillId));
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: t('profile.remove_skill_success', 'Skill removed'),
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: t('profile.error', 'Error'),
        text: t('profile.remove_skill_error', 'Failed to remove skill'),
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }
  };

  const hasSkills = (skills?.length ?? 0) > 0;
  const hasCvAnalysis = user?.cv_analysis != null;
  const completenessScore = Number(user?.cv_analysis?.completeness_score) || 0;
  const totalExperience = user?.profile?.total_experience_years ?? user?.total_experience_years;
  const headline = user?.headline ?? user?.job_title ?? user?.profile?.headline ?? user?.profile?.job_title;
  const userSkills = Array.isArray(user?.skills) ? user.skills : [];
  const skillsCount = userSkills?.length ?? skills?.length ?? 0;

  const displaySkills = hasSkills ? (Array.isArray(skills) ? skills : []) : userSkills;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-20 space-y-8 font-sans bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <ProcessingAnimation isVisible={uploading} />
      <ProcessingAnimation
        isVisible={isDiscovering}
        message={t('cv_analyzer.discovering')}
      />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3"
          >
            {t('dashboard.welcome', { name: user?.name?.split?.(" ")?.[0] ?? "Talent" })}{" "}
            <span className="animate-bounce origin-bottom-right">👋</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium"
          >
            {t('dashboard.market')}
          </motion.p>
        </div>
      </div>

      <div className="space-y-6">
        {!hasCvAnalysis ? (
          <WelcomeBanner onUpload={handleCVUpload} uploading={uploading} t={t} />
        ) : (
          <>
            {/* HERO ACTION CARD (when cv_analysis exists) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-xl border border-slate-800 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8"
            >
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
              <div className="text-center md:text-left flex-1 space-y-4 relative z-10 w-full">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-white/10 text-indigo-300 border border-white/10">
                  <Zap size={12} className="text-fuchsia-400" /> {t('dashboard.next_action')}
                </span>
                {loading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-4 w-24 bg-white/10 rounded" />
                    <div className="h-10 w-2/3 bg-white/10 rounded-xl" />
                    <div className="h-4 w-1/2 bg-white/10 rounded" />
                    <div className="h-12 w-40 bg-white/10 rounded-xl" />
                  </div>
                ) : hasSkills ? (
                  <>
                    <h2 className="text-3xl md:text-4xl font-black text-white">{t('dashboard.ready_bridge')}</h2>
                    <p className="text-slate-400 font-medium">{t('dashboard.run_gap')}</p>
                    <Link
                      to="/jobs"
                      className="inline-flex bg-indigo-500 hover:bg-indigo-600 transition-colors text-white font-bold py-3.5 px-8 rounded-xl items-center justify-center gap-2"
                    >
                      {t('dashboard.start_gap')}
                    </Link>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl md:text-4xl font-black text-white">{t('dashboard.upload_start')}</h2>
                    <p className="text-slate-400 font-medium">{t('dashboard.extract_roadmap')}</p>
                    <label className="cursor-pointer inline-block w-full sm:w-auto">
                      <input type="file" accept=".pdf" className="hidden" onChange={handleCVUpload} disabled={uploading} />
                      <div className="bg-fuchsia-600 hover:bg-fuchsia-700 transition-colors text-white font-bold py-3.5 px-8 rounded-xl flex justify-center items-center gap-2">
                        <Upload size={18} /> {uploading ? t('jobs.loading') : t('dashboard.upload_now')}
                      </div>
                    </label>
                  </>
                )}
              </div>
              <div className="hidden lg:flex relative z-10">
                <Compass size={100} className="text-indigo-400/80 animate-pulse" strokeWidth={1} />
              </div>
            </motion.div>

            {/* AI CAREER IDENTITY CARD (Phase 4 upgrade) */}
            <CareerIdentityCard cvAnalysis={user?.cv_analysis} />

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group"
              >
                <ProfileCompletenessRing score={completenessScore} />
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.profile_completeness')}</h3>
                  <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">
                    {Math.round(completenessScore) || 0}%
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Compass size={24} />
                </div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.total_experience')}</h3>
                <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">
                  {formatExperienceYears(totalExperience, t) ?? <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group"
              >
                <div className="absolute top-6 right-6 z-10">
                  <label className="cursor-pointer group/btn" title="Update Resume">
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleCVUpload} disabled={uploading} />
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors border border-slate-100 dark:border-slate-700 group-hover/btn:border-indigo-200">
                      <Upload size={16} />
                    </div>
                  </label>
                </div>
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Award size={24} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.top_skills')}</h3>
                  <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">
                    {loading ? "…" : t('dashboard.tracked_count', { count: skillsCount })}
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Target size={24} />
                </div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.target_role')}</h3>
                <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5 line-clamp-1" title={headline ?? "Unset"}>
                  {headline ?? <span className="text-slate-300 dark:text-slate-600 italic">{t('dashboard.not_set')}</span>}
                </p>
              </motion.div>
            </div>

            {/* MAIN SPLIT AREA */}
            <div className="grid lg:grid-cols-12 gap-8">
              {/* LEFT: SKILLS & RADAR */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="lg:col-span-8 space-y-8"
              >
                <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center justify-between">
                    <span>{t('dashboard.skills')}</span>
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-md">
                      {t('dashboard.tracked_count', { count: displaySkills?.length ?? 0 })}
                    </span>
                  </h3>

                  {loading ? (
                    <div className="flex flex-wrap gap-2 animate-pulse">
                      {[1, 2, 3, 4, 5, 6].map((k) => (
                        <div key={k} className="h-8 w-24 bg-slate-200 rounded-lg" />
                      ))}
                    </div>
                  ) : (displaySkills?.length ?? 0) > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mb-8 min-h-[100px]">
                        {(displaySkills || []).map((skill, idx) => (
                          <SkillChip
                            key={skill?.id ?? idx}
                            skill={skill}
                            onRemove={displaySkills === skills ? removeSkill : undefined}
                          />
                        ))}
                      </div>
                      <hr className="border-slate-100 mb-8" />
                      <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 mb-6">
                        <Award size={16} className="text-indigo-500" />
                        {t('dashboard.matrix_analysis')}
                      </h4>
                      <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <div className="w-full md:w-1/2">
                          <SkillRadar skills={displaySkills} t={t} />
                        </div>
                        <div className="w-full md:w-1/2 space-y-4">
                          <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter mb-1">{t('dashboard.focus_area')}</p>
                            <p className="font-bold text-slate-800 dark:text-white">
                              {(displaySkills?.length ?? 0) > 5 ? t('dashboard.technical_depth') : t('dashboard.foundational_growth')}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                              {(displaySkills?.length ?? 0) > 5
                                ? t('dashboard.mastery_desc')
                                : t('dashboard.expand_desc')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 border-dashed transition-colors">
                      <Award size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
                      <p className="text-slate-500 dark:text-slate-400 font-bold mb-2">{t('dashboard.no_skills')}</p>
                      <p className="text-sm text-slate-400 dark:text-slate-500">{t('dashboard.upload_prompt')}</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* RIGHT: INSIGHTS + GAPS + SKILL PROFICIENCY + QUICK LINKS */}
              <aside className="lg:col-span-4 space-y-6">
                {/* Career Health Insights & Alerts */}
                <InsightsAlertsCard cvAnalysis={user?.cv_analysis} />

                {/* Skill Proficiency (duration-based) */}
                <SkillProficiencyCard cvAnalysis={user?.cv_analysis} />

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800"
                >
                  <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                    <Target className="text-fuchsia-400" size={20} /> {t('dashboard.prioritized_gaps')}
                  </h3>
                  <div className="space-y-4">
                    {(recommendations?.length ?? 0) > 0 ? (
                      <>
                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-fuchsia-400 tracking-[.2em] mb-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" /> {t('dashboard.global_gap_focus')}
                        </h4>
                        <div className="space-y-3">
                          {recommendations.slice(0, 5).map((rec, idx) => (
                            <div
                              key={idx}
                              className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-colors"
                            >
                              <p className="font-bold text-white text-sm mb-2">
                                {typeof rec === 'string' ? rec : (rec?.name ?? rec?.label ?? "Skill")}
                              </p>
                              <div className="flex items-center gap-2">
                                <TrendingUp size={12} className="text-fuchsia-400" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  {rec?.importance_category ? rec.importance_category.replace(/_/g, " ") : "Market Gap"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-slate-400 text-sm italic">
                        {loading
                          ? t('dashboard.analyzing_gaps')
                          : hasSkills
                            ? t('dashboard.all_caught_up')
                            : t('dashboard.upload_for_gaps')}
                      </div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
                >
                  <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-4">{t('dashboard.quick_links')}</h4>
                  <nav className="space-y-2">
                    <Link
                      to="/jobs"
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all group"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 text-sm">{t('dashboard.browse_matrix')}</span>
                      <div className="bg-white dark:bg-slate-700 p-1.5 rounded-lg shadow-sm text-slate-400 group-hover:text-indigo-600 transition-colors">
                        <Search size={16} />
                      </div>
                    </Link>
                    <Link
                      to="/market"
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all group"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 text-sm">{t('dashboard.market_intel')}</span>
                      <div className="bg-white dark:bg-slate-700 p-1.5 rounded-lg shadow-sm text-slate-400 group-hover:text-indigo-600 transition-colors">
                        <TrendingUp size={16} />
                      </div>
                    </Link>
                  </nav>
                </motion.div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
