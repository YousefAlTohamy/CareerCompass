import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
  Legend,
} from "recharts";
import {
  Briefcase,
  Layers,
  Zap,
  Clock,
  Search,
  TrendingUp,
  Award,
  Target,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Star,
} from "lucide-react";
import { marketIntelligenceAPI } from "../api/endpoints";

/* ─── Constants ─────────────────────────────────────────────────────────── */
const PRIMARY = "#6366f1";
const SECONDARY = "#8b5cf6";
const ACCENT = "#06b6d4";
const SUCCESS = "#10b981";
const WARNING = "#f59e0b";

const CATEGORY_STYLE = {
  essential: {
    label: "Essential",
    bg: "bg-red-50",
    text: "text-red-700",
    bar: "#ef4444",
  },
  important: {
    label: "Important",
    bg: "bg-amber-50",
    text: "text-amber-700",
    bar: "#f59e0b",
  },
  nice_to_have: {
    label: "Nice to Have",
    bg: "bg-blue-50",
    text: "text-blue-700",
    bar: "#6366f1",
  },
};

const SUGGESTED_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Data Scientist",
  "DevOps Engineer",
  "Full Stack",
  "React Developer",
];

/* ─── Skeleton loader ────────────────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
  );
}

/* ─── Custom chart tooltip ────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
      <p className="font-bold mb-1 truncate max-w-[180px]">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: p.color }}
          />
          {p.name}:{" "}
          <span className="font-bold">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  loading,
  delay = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-premium transition-all"
    >
      {loading ? (
        <>
          <Skeleton className="h-10 w-10 rounded-xl mb-4" />
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-32" />
        </>
      ) : (
        <>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}
            style={{ background: `${color}18` }}
          >
            <Icon size={24} style={{ color }} />
          </div>
          <p className="text-3xl font-black text-slate-900 mb-1">{value}</p>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MarketIntelligence() {
  /* ─── State ────────────────────────────────────────────────────────────── */
  const [overview, setOverview] = useState(null);
  const [topSkillsPrev, setTopSkillsPrev] = useState([]); // overview.top_skills
  const [trendingSkills, setTrendingSkills] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all"); // 'all' | 'technical' | 'soft'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Role search
  const [roleInput, setRoleInput] = useState("");
  const [roleData, setRoleData] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState("");

  /* ─── Initial data load ─────────────────────────────────────────────────── */
  const loadMarketData = useCallback(async (type = "all") => {
    try {
      setLoading(true);
      setError("");
      const [overviewRes, skillsRes] = await Promise.all([
        marketIntelligenceAPI.getOverview(),
        marketIntelligenceAPI.getTrendingSkills(
          15,
          type === "all" ? null : type,
        ),
      ]);

      const ov =
        overviewRes.data?.overview ??
        overviewRes.data?.data ??
        overviewRes.data;
      setOverview(ov);
      setTopSkillsPrev(overviewRes.data?.top_skills ?? []);

      const rawSkills = skillsRes.data?.skills ?? skillsRes.data?.data ?? [];
      setTrendingSkills(Array.isArray(rawSkills) ? rawSkills : []);
    } catch (err) {
      console.error("Market data load failed:", err);
      setError(
        err.response?.data?.message ||
          "Failed to load market data. Please ensure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketData(typeFilter);
  }, [typeFilter, loadMarketData]);

  /* ─── Role search ────────────────────────────────────────────────────────── */
  const searchRole = async (role) => {
    const q = (role ?? roleInput).trim();
    if (!q) return;
    try {
      setRoleLoading(true);
      setRoleError("");
      setRoleData(null);
      const res = await marketIntelligenceAPI.getSkillDemand(q);
      setRoleData(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || `No data found for "${q}"`;
      setRoleError(msg);
    } finally {
      setRoleLoading(false);
    }
  };

  /* ─── Derived chart data ─────────────────────────────────────────────────── */
  const trendingChartData = trendingSkills.slice(0, 15).map((s) => ({
    name: s.name,
    demand: s.demand_count,
    importance: Math.round(s.average_importance ?? 0),
    type: s.type,
    category: s.category ?? "nice_to_have",
  }));

  const roleChartData = (roleData?.all_skills ?? []).slice(0, 12).map((s) => ({
    name: s.name,
    percentage: s.percentage,
    category: s.importance_category ?? "nice_to_have",
  }));

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white px-4 pt-10 pb-16">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <TrendingUp size={22} />
              </div>
              <span className="text-indigo-200 font-semibold text-sm uppercase tracking-widest">
                Live Data
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-black mb-2">
              Market Intelligence
            </h1>
            <p className="text-indigo-200 text-lg max-w-xl">
              Real-time job market insights, trending skills, and role-specific
              demand analysis.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-8">
        {/* ── Error Banner ─────────────────────────────────────────────────── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-700"
          >
            <AlertCircle size={20} className="shrink-0" />
            <span className="flex-1 font-medium">{error}</span>
            <button
              onClick={() => loadMarketData(typeFilter)}
              className="flex items-center gap-1 text-xs font-bold hover:underline"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </motion.div>
        )}

        {/* ── Stat Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            loading={loading}
            delay={0.05}
            icon={Briefcase}
            color={PRIMARY}
            label="Total Jobs Analyzed"
            value={(overview?.total_jobs ?? 0).toLocaleString()}
            sub="Across all sources"
          />
          <StatCard
            loading={loading}
            delay={0.1}
            icon={Target}
            color={SECONDARY}
            label="Unique Job Roles"
            value={(overview?.total_roles ?? 0).toLocaleString()}
            sub="Distinct titles"
          />
          <StatCard
            loading={loading}
            delay={0.15}
            icon={Layers}
            color={ACCENT}
            label="Avg Skills / Job"
            value={overview?.average_skills_per_job ?? "—"}
            sub="Required per posting"
          />
          <StatCard
            loading={loading}
            delay={0.2}
            icon={Clock}
            color={SUCCESS}
            label="Data Freshness"
            value={overview?.last_data_update ?? "N/A"}
            sub="Last scrape run"
          />
        </div>

        {/* ── Trending Skills Bar Chart ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-100 p-7 mb-8"
        >
          {/* Chart header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap size={20} className="text-indigo-500" />
                <h2 className="text-2xl font-black text-slate-900">
                  Top Trending Skills
                </h2>
              </div>
              <p className="text-slate-500 text-sm">
                Most demanded skills across all job postings
              </p>
            </div>

            {/* Type filter pills */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              {["all", "technical", "soft"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                    typeFilter === t
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t === "all"
                    ? "All Skills"
                    : t === "technical"
                      ? "💻 Technical"
                      : "🤝 Soft"}
                </button>
              ))}
              <button
                onClick={() => loadMarketData(typeFilter)}
                className="ml-1 p-1.5 text-slate-400 hover:text-indigo-600 transition"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : trendingChartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-slate-400 font-medium">
              No skill data available yet. Run the scraper to collect job data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={trendingChartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  angle={-38}
                  textAnchor="end"
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Job Demand",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    style: { fontSize: 11, fill: "#94a3b8" },
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="demand" name="Job Demand" radius={[6, 6, 0, 0]}>
                  {trendingChartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={idx < 3 ? PRIMARY : idx < 7 ? SECONDARY : "#a5b4fc"}
                      opacity={0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* ── Skill Card Grid ───────────────────────────────────────────────── */}
        {!loading && trendingSkills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-5">
              <Star size={18} className="text-amber-500" />
              <h2 className="text-xl font-black text-slate-900">
                Skill Breakdown
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {trendingSkills.slice(0, 10).map((skill, idx) => {
                const catStyle =
                  CATEGORY_STYLE[skill.category] ?? CATEGORY_STYLE.nice_to_have;
                const maxDemand = trendingSkills[0]?.demand_count || 1;
                const pct = Math.round((skill.demand_count / maxDemand) * 100);
                return (
                  <motion.div
                    key={skill.id ?? idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + idx * 0.04 }}
                    className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-premium transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl font-black text-slate-200 group-hover:text-indigo-100 transition">
                        #{idx + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${catStyle.bg} ${catStyle.text}`}
                      >
                        {catStyle.label}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1">
                      {skill.name}
                    </h3>
                    <p className="text-xs text-slate-400 mb-3 capitalize">
                      {skill.type}
                    </p>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Demand</span>
                        <span className="font-bold text-slate-700">
                          {skill.demand_count} jobs
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            delay: 0.5 + idx * 0.05,
                            duration: 0.8,
                            ease: "easeOut",
                          }}
                          className="h-full rounded-full"
                          style={{ background: catStyle.bar }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Role Search Section ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-100 p-7 mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <Search size={20} className="text-indigo-500" />
            <h2 className="text-2xl font-black text-slate-900">
              Role Skill Demand
            </h2>
          </div>
          <p className="text-slate-500 text-sm mb-6">
            Enter a job role to see which skills are most demanded and their
            relative importance.
          </p>

          {/* Search input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchRole();
            }}
            className="flex gap-3 mb-5"
          >
            <div className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-indigo-400 transition">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                placeholder="e.g. Backend Developer, Data Scientist…"
                className="flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 outline-none"
              />
              {roleInput && (
                <button
                  type="button"
                  onClick={() => {
                    setRoleInput("");
                    setRoleData(null);
                    setRoleError("");
                  }}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={!roleInput.trim() || roleLoading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {roleLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <ChevronRight size={16} />
              )}
              Analyze
            </button>
          </form>

          {/* Suggested roles */}
          <div className="flex flex-wrap gap-2 mb-6">
            {SUGGESTED_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRoleInput(r);
                  searchRole(r);
                }}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition"
              >
                {r}
              </button>
            ))}
          </div>

          {/* Role error */}
          {roleError && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm font-medium mb-4">
              <AlertCircle size={18} />
              {roleError}
            </div>
          )}

          {/* Role loading skeleton */}
          {roleLoading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {/* Role results */}
          <AnimatePresence mode="wait">
            {roleData && !roleLoading && (
              <motion.div
                key={roleData.role_title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Summary stats */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="bg-indigo-50 rounded-2xl px-5 py-3">
                    <p className="text-xs text-indigo-500 font-semibold mb-0.5">
                      Role
                    </p>
                    <p className="font-black text-indigo-900">
                      {roleData.role_title}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl px-5 py-3">
                    <p className="text-xs text-slate-500 font-semibold mb-0.5">
                      Jobs Analyzed
                    </p>
                    <p className="font-black text-slate-900">
                      {(roleData.total_jobs_analyzed ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl px-5 py-3">
                    <p className="text-xs text-slate-500 font-semibold mb-0.5">
                      Unique Skills
                    </p>
                    <p className="font-black text-slate-900">
                      {roleData.total_unique_skills ?? 0}
                    </p>
                  </div>
                </div>

                {/* BarChart for role skills */}
                {roleChartData.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-base font-bold text-slate-700 mb-4">
                      Top Skills by Demand %
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={roleChartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="name"
                          angle={-35}
                          textAnchor="end"
                          tick={{
                            fontSize: 11,
                            fill: "#64748b",
                            fontWeight: 600,
                          }}
                          interval={0}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          formatter={(v) => [`${v}%`, "Demand"]}
                        />
                        <Bar
                          dataKey="percentage"
                          name="Demand %"
                          radius={[6, 6, 0, 0]}
                        >
                          {roleChartData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={
                                CATEGORY_STYLE[entry.category]?.bar ?? PRIMARY
                              }
                              opacity={0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}

                {/* Skills by category */}
                {["essential", "important", "nice_to_have"].map((cat) => {
                  const skills = roleData.skills_by_category?.[cat] ?? [];
                  if (!skills.length) return null;
                  const style = CATEGORY_STYLE[cat];
                  return (
                    <div key={cat} className="mb-5">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide mb-3 ${style.bg} ${style.text}`}
                      >
                        <Award size={12} />
                        {style.label} Skills
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {skills.map((s, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${style.bg} ${style.text} border-current border-opacity-20`}
                          >
                            <span>{s.name}</span>
                            <span className="opacity-60">
                              {s.percentage?.toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Insights Footer ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-8 text-white"
        >
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
            <span className="text-2xl">💡</span> How to Use This Data
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: "🎯",
                title: "Data-Driven Learning",
                desc: "Focus on skills ranked Essential — they appear in 70%+ of job postings for your target role.",
              },
              {
                icon: "📊",
                title: "Live Market Signals",
                desc: "Data is refreshed automatically twice weekly from real job postings across multiple sources.",
              },
              {
                icon: "🚀",
                title: "Gap Analysis",
                desc: "Use Role Skill Demand to compare with your own profile via the Gap Analysis feature.",
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col gap-3">
                <span className="text-3xl">{item.icon}</span>
                <div>
                  <p className="font-bold text-white mb-1">{item.title}</p>
                  <p className="text-indigo-200 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
