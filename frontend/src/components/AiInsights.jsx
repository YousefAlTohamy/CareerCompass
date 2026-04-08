import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Clock,
  CalendarX,
  Repeat,
  PenTool,
  ChevronRight,
  Sparkles,
  Eye,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Seniority Badge Configuration
// ─────────────────────────────────────────────────────────────────────────────
const SENIORITY_CONFIG = {
  intern: {
    label: "Intern",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
  },
  junior: {
    label: "Junior",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  mid: {
    label: "Mid-Level",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-500/30",
    dot: "bg-blue-500",
  },
  senior: {
    label: "Senior",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-500/30",
    dot: "bg-violet-500",
  },
  lead: {
    label: "Lead",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-500/30",
    dot: "bg-amber-500",
  },
  principal: {
    label: "Principal",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-500/30",
    dot: "bg-rose-500",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Seniority Badge
// ─────────────────────────────────────────────────────────────────────────────
export const SeniorityBadge = ({ seniority }) => {
  if (!seniority) return null;
  const config = SENIORITY_CONFIG[seniority.toLowerCase()] ?? SENIORITY_CONFIG.mid;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
      {config.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. OCR Indicator
// ─────────────────────────────────────────────────────────────────────────────
export const OcrIndicator = ({ parsingStatus }) => {
  if (parsingStatus !== "ocr_fallback") return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-bold">
      <Eye size={14} />
      <span>OCR Processed — formatting may vary slightly</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Career Identity Card
// ─────────────────────────────────────────────────────────────────────────────
export const CareerIdentityCard = ({ cvAnalysis }) => {
  if (!cvAnalysis) return null;
  const { predicted_role, seniority, parsing_status, confidence_score } = cvAnalysis;

  if (!predicted_role && !seniority) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="relative z-10">
        <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Shield size={16} className="text-indigo-500" />
          Career Identity
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 space-y-3">
            {predicted_role && (
              <p className="text-xl md:text-2xl font-black text-slate-800 dark:text-white">
                {predicted_role}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <SeniorityBadge seniority={seniority} />
              {confidence_score != null && (
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  {Math.round(confidence_score * 100)}% confidence
                </span>
              )}
            </div>
          </div>
        </div>

        <OcrIndicator parsingStatus={parsing_status} />
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Writing Quality (Action Verb Score)
// ─────────────────────────────────────────────────────────────────────────────
const ActionVerbScore = ({ score }) => {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const label =
    pct >= 70 ? "Strong" : pct >= 40 ? "Average" : "Needs Improvement";
  const barColor =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 40
      ? "bg-amber-500"
      : "bg-rose-400";
  const labelColor =
    pct >= 70
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 40
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PenTool size={14} className="text-indigo-500" />
          <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
            Writing Quality
          </span>
        </div>
        <span className={`text-xs font-black ${labelColor}`}>{label}</span>
      </div>
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        Based on action verbs like "Led", "Architected", "Optimized" in your job descriptions
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Insights & Alerts Card (Gaps + Red Flags + Action Verbs)
// ─────────────────────────────────────────────────────────────────────────────
export const InsightsAlertsCard = ({ cvAnalysis }) => {
  if (!cvAnalysis) return null;

  const gaps = cvAnalysis.gaps ?? [];
  const redFlags = cvAnalysis.red_flags ?? [];
  const metadata = cvAnalysis.metadata ?? {};
  const actionVerbScore = metadata.action_verb_score;
  const strengths = cvAnalysis.strengths ?? [];

  const hasContent =
    gaps.length > 0 || redFlags.length > 0 || actionVerbScore != null || strengths.length > 0;

  if (!hasContent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800"
    >
      <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Sparkles size={16} className="text-indigo-500" />
        Insights & Alerts
      </h3>

      <div className="space-y-5">
        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="space-y-2">
            {strengths.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-xl"
              >
                <Sparkles
                  size={14}
                  className="text-emerald-500 mt-0.5 shrink-0"
                />
                <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                  {s}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Employment Gaps */}
        {gaps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <CalendarX size={13} className="text-amber-500" />
              Employment Gaps
            </h4>
            {gaps.map((gap, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl"
              >
                <Clock
                  size={14}
                  className="text-amber-500 mt-0.5 shrink-0"
                />
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  {gap}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Red Flags */}
        {redFlags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <AlertTriangle size={13} className="text-rose-500" />
              Attention Required
            </h4>
            {redFlags.map((flag, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/20 rounded-xl"
              >
                {flag.toLowerCase().includes("overlap") ? (
                  <Repeat
                    size={14}
                    className="text-rose-500 mt-0.5 shrink-0"
                  />
                ) : (
                  <AlertTriangle
                    size={14}
                    className="text-rose-500 mt-0.5 shrink-0"
                  />
                )}
                <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">
                  {flag}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Action Verb Score */}
        <ActionVerbScore score={actionVerbScore} />
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Skill Proficiency (Duration-based bars)
// ─────────────────────────────────────────────────────────────────────────────
export const SkillProficiencyCard = ({ cvAnalysis }) => {
  if (!cvAnalysis) return null;

  const metadata = cvAnalysis.metadata ?? {};
  const skillDurations = metadata.skill_durations ?? {};
  const entries = Object.entries(skillDurations)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (entries.length === 0) return null;

  const maxYears = Math.max(...entries.map(([, y]) => y), 1);

  const BAR_COLORS = [
    "bg-indigo-500",
    "bg-violet-500",
    "bg-fuchsia-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-400",
    "bg-teal-500",
    "bg-sky-500",
    "bg-orange-500",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800"
    >
      <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
        <ChevronRight size={16} className="text-indigo-500" />
        Skill Proficiency
      </h3>

      <div className="space-y-4">
        {entries.map(([skill, years], i) => {
          const pct = Math.round((years / maxYears) * 100);
          return (
            <div key={skill} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {skill}
                </span>
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 tabular-nums">
                  {Number(years).toFixed(1)} yrs
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
                  className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-4">
        Based on overlap-aware date analysis from your experience timeline
      </p>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Technology Badges (for experience items)
// ─────────────────────────────────────────────────────────────────────────────
export const TechBadges = ({ technologies }) => {
  if (!technologies || !Array.isArray(technologies) || technologies.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {technologies.map((tech, i) => (
        <span
          key={i}
          className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-md border border-indigo-100 dark:border-indigo-500/20"
        >
          {tech}
        </span>
      ))}
    </div>
  );
};
