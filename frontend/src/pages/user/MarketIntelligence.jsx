import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, Briefcase, DollarSign, Activity, Target, BarChart3, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { marketIntelligenceAPI } from '../../api/endpoints';
import { useTranslation } from 'react-i18next';
import HUDLayout from '../../components/HUDLayout';
import HUDSkeleton from '../../components/HUDSkeleton';

// --- BULLETPROOF HELPERS ---
const safeArray = (arr) => Array.isArray(arr) ? arr : [];
const formatNumber = (num) => (Number(num) || 0).toLocaleString();

// --- BUILD TREND DATA (API may not provide time-series; fallback to empty or derived) ---
function buildTrendData(topSkillsFromOverview) {
  const arr = safeArray(topSkillsFromOverview);
  if (arr.length === 0) return [];
  // Use top skills as proxy for "trend" - one point per skill (or empty)
  return arr.slice(0, 7).map((s, i) => ({
    date: s?.name ?? `Day ${i + 1}`,
    count: Number(s?.count ?? s?.demand_count ?? 0) || 0,
  }));
}

export default function MarketIntelligence() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState(null);
  const [topSkillsOverview, setTopSkillsOverview] = useState([]);
  const [trendingSkills, setTrendingSkills] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMarketData = useCallback(async (type = 'all') => {
    try {
      setLoading(true);
      setError('');
      const [overviewRes, skillsRes] = await Promise.all([
        marketIntelligenceAPI.getOverview(),
        marketIntelligenceAPI.getTrendingSkills(15, type === 'all' ? null : type),
      ]);

      const ov = overviewRes.data?.overview ?? overviewRes.data?.data ?? overviewRes.data ?? null;
      setOverview(ov);
      setTopSkillsOverview(safeArray(overviewRes.data?.top_skills ?? []));

      const rawSkills = skillsRes.data?.skills ?? skillsRes.data?.data ?? [];
      setTrendingSkills(safeArray(rawSkills));
    } catch (err) {
      console.error('Market data load failed:', err);
      setError(
        err.response?.data?.message ?? t('market.error_load')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMarketData(typeFilter);
  }, [typeFilter, fetchMarketData]);

  // --- Derived data (crash-proof) ---
  const totalJobs = Number(overview?.total_jobs) || 0;
  const totalRoles = Number(overview?.total_roles) || 0;
  const avgSkillsPerJob = overview?.average_skills_per_job ?? 'N/A';
  const lastUpdate = overview?.last_data_update ?? 'N/A';
  const topSkillName = topSkillsOverview[0]?.name ?? trendingSkills[0]?.name ?? 'N/A';

  // Trend chart: use top skills count as proxy when no time-series exists
  const trendChartData = buildTrendData(topSkillsOverview);
  const hasTrendData = trendChartData.length > 0 && trendChartData.some((d) => d.count > 0);

  // Skills bar chart: vertical, need { name, value }
  const skillsBarData = safeArray(trendingSkills).slice(0, 8).map((s) => ({
    name: String(s?.name ?? ''),
    value: Number(s?.demand_count ?? s?.count ?? 0) || 0,
  })).filter((d) => d.name);

  // AI summary text (dynamic from overview)
  const aiSummary = overview
    ? t('market.ai_summary_template', {
        jobs: formatNumber(totalJobs),
        roles: formatNumber(totalRoles),
        skills: safeArray(topSkillsOverview).slice(0, 3).map((s) => s?.name).filter(Boolean).join(', ') || t('market.all_skills'),
        avg: avgSkillsPerJob,
        updated: lastUpdate !== 'N/A' ? `${t('market.last_updated')} ${lastUpdate}.` : ''
      })
    : t('market.loading');

  // --- SKELETON LOADING STATE ---
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
                <HUDSkeleton variant="rect" className="h-[400px] rounded-3xl" />
             </div>
             <div className="lg:col-span-4 space-y-6">
                <HUDSkeleton variant="rect" className="h-[400px] rounded-3xl" />
             </div>
          </div>
        </div>
      </HUDLayout>
    );
  }

  return (
    <HUDLayout loading={loading} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3">
              <Activity size={14} className="animate-pulse" /> Imported job data
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
              Market Data
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 max-w-2xl">
              What do imported active-source jobs currently ask for, and how should that shape your next CV, skills, and gap analysis?
            </p>
          </div>
          <button
            onClick={() => fetchMarketData(typeFilter)}
            className="px-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-sm transition-all backdrop-blur-md"
          >
            <RefreshCw size={16} /> {t('market.refresh')}
          </button>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 p-4 rounded-2xl flex items-center gap-3 border border-rose-500/20 font-bold text-sm backdrop-blur-md">
            <AlertCircle size={18} />
            <span className="flex-1">{error}</span>
            <button onClick={() => fetchMarketData(typeFilter)} className="flex items-center gap-1 text-xs underline hover:no-underline">
              <RefreshCw size={14} /> {t('market.retry')}
            </button>
          </div>
        )}

        <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-5 text-sm font-medium text-indigo-800 dark:text-indigo-200">
          These charts are derived from jobs stored in CareerCompass by active scraping sources. Source coverage can be limited by missing credentials, blocked public pages, empty public results, and data quality rejections. If the page is empty, upload a CV for personalization or ask an admin to run scraping diagnostics/extractions.
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* TYPE FILTER (all | technical | soft) */}
          <div className="flex items-center gap-2 flex-wrap">
            {['all', 'technical', 'soft'].map((tKey) => (
              <button
                key={tKey}
                onClick={() => setTypeFilter(tKey)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                  typeFilter === tKey 
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-500/20' 
                    : 'bg-white dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {tKey === 'all' ? t('market.all_skills') : tKey === 'technical' ? t('market.technical') : t('market.soft')}
              </button>
            ))}
          </div>

          {/* QUICK STATS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group backdrop-blur-md">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl"><Briefcase size={20} /></div>
              </div>
              <h3 className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{t('market.active_listings')}</h3>
              <p className="text-3xl font-black text-slate-800 dark:text-white">{formatNumber(totalJobs)}</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group backdrop-blur-md">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl"><TrendingUp size={20} className="rtl-flip" /></div>
              </div>
              <h3 className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{t('market.unique_roles')}</h3>
              <p className="text-3xl font-black text-slate-800 dark:text-white">{formatNumber(totalRoles)}</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group backdrop-blur-md">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-fuchsia-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 rounded-2xl"><DollarSign size={20} /></div>
              </div>
              <h3 className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{t('market.avg_skills')}</h3>
              <p className="text-3xl font-black text-slate-800 dark:text-white">{avgSkillsPerJob}</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group backdrop-blur-md">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl"><Target size={20} /></div>
              </div>
              <h3 className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{t('market.top_skill_demand')}</h3>
              <p className="text-3xl font-black text-slate-800 dark:text-white truncate" title={topSkillName}>{topSkillName}</p>
            </div>
          </div>

          {/* CHARTS ROW */}
          <div className="grid lg:grid-cols-12 gap-8">
            {/* LEFT CHART: DEMAND TREND (AREA CHART) */}
            <div className="lg:col-span-8 min-w-0 bg-white dark:bg-slate-900/50 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl"><Activity size={20} /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-white">{t('market.demand_trend')}</h2>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Derived from top requested skills, not a historical time-series.</p>
                  </div>
                </div>
              </div>

              <div className="h-[300px] min-h-[300px] min-w-0 w-full">
                {hasTrendData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontWeight: 'bold' }}
                        itemStyle={{ color: '#818cf8' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-slate-400 dark:text-slate-500 font-medium text-sm px-6">
                    <p>{t('market.no_trend')}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link to="/dashboard" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">Upload CV</Link>
                      <Link to="/jobs" className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-widest">View jobs</Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT CHART: TOP SKILLS (BAR CHART) */}
            <div className="lg:col-span-4 min-w-0 bg-white dark:bg-slate-900/50 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 rounded-xl"><BarChart3 size={20} /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-white">{t('market.top_skills')}</h2>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Most common skill labels in imported jobs.</p>
                </div>
              </div>

              <div className="h-[300px] min-h-[300px] min-w-0 w-full">
                {skillsBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={skillsBarData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} width={90} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} fill="#c026d3">
                        {safeArray(skillsBarData).map((_, i) => (
                          <Cell key={i} fill="#c026d3" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-slate-400 dark:text-slate-500 font-medium text-sm px-6">
                    <p>{t('market.no_skills')}</p>
                    <Link to="/jobs" className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-widest">Browse imported jobs</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* INSIGHTS / AI SUMMARY SECTION */}
          <div className="bg-slate-900 dark:bg-black rounded-3xl p-8 shadow-lg border border-slate-800 dark:border-slate-900 relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
              <Sparkles size={150} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3 relative z-10">
              <Sparkles className="text-indigo-400" size={24} /> Market summary
            </h3>
            <div className="text-slate-300 font-medium leading-relaxed max-w-3xl relative z-10 space-y-4">
              <p>{aiSummary}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </HUDLayout>
  );
}
