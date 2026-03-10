import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Briefcase, DollarSign, Activity, Target, BarChart3, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { marketIntelligenceAPI } from '../../api/endpoints';

// --- BULLETPROOF HELPERS ---
export const safeArray = (arr) => Array.isArray(arr) ? arr : [];
export const formatNumber = (num) => (Number(num) || 0).toLocaleString();

// --- BUILD TREND DATA (API may not provide time-series; fallback to empty or derived) ---
function buildTrendData(overview, topSkillsFromOverview) {
  const arr = safeArray(topSkillsFromOverview);
  if (arr.length === 0) return [];
  // Use top skills as proxy for "trend" - one point per skill (or empty)
  return arr.slice(0, 7).map((s, i) => ({
    date: s?.name ?? `Day ${i + 1}`,
    count: Number(s?.count ?? s?.demand_count ?? 0) || 0,
  }));
}

export default function MarketIntelligence() {
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
        err.response?.data?.message ??
          'Failed to load market data. Please ensure the backend is running.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData(typeFilter);
  }, [typeFilter, fetchMarketData]);

  // --- Derived data (crash-proof) ---
  const totalJobs = Number(overview?.total_jobs) || 0;
  const totalRoles = Number(overview?.total_roles) || 0;
  const avgSkillsPerJob = overview?.average_skills_per_job ?? '—';
  const lastUpdate = overview?.last_data_update ?? 'N/A';
  const topSkillName = topSkillsOverview[0]?.name ?? trendingSkills[0]?.name ?? 'N/A';

  // Trend chart: use top skills count as proxy when no time-series exists
  const trendChartData = buildTrendData(overview, topSkillsOverview);
  const hasTrendData = trendChartData.length > 0 && trendChartData.some((d) => d.count > 0);

  // Skills bar chart: vertical, need { name, value }
  const skillsBarData = safeArray(trendingSkills).slice(0, 8).map((s) => ({
    name: String(s?.name ?? ''),
    value: Number(s?.demand_count ?? s?.count ?? 0) || 0,
  })).filter((d) => d.name);

  // AI summary text (dynamic from overview)
  const aiSummary = overview
    ? `Based on ${formatNumber(totalJobs)} analyzed job listings across ${formatNumber(totalRoles)} unique roles, the market shows strong demand for skills like ${safeArray(topSkillsOverview).slice(0, 3).map((s) => s?.name).filter(Boolean).join(', ') || 'various technical skills'}. On average, each job requires ${avgSkillsPerJob} skills. ${lastUpdate !== 'N/A' ? `Data last updated ${lastUpdate}.` : ''}`
    : 'Loading market insights...';

  // --- SKELETON LOADING STATE ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8 font-sans pb-24">
        <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
          <div className="flex justify-between items-end gap-4">
            <div className="h-20 w-64 bg-slate-200 rounded-2xl" />
            <div className="h-10 w-32 bg-slate-200 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-white rounded-3xl border border-slate-200" />
            ))}
          </div>
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 h-[340px] bg-white rounded-3xl border border-slate-200" />
            <div className="lg:col-span-4 h-[340px] bg-white rounded-3xl border border-slate-200" />
          </div>
          <div className="h-48 bg-slate-200 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">
              <Activity size={14} className="animate-pulse" /> Live Market Data
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
              Market Intelligence
            </h1>
            <p className="text-slate-500 font-medium mt-1">Real-time insights on skill demand, salaries, and hiring trends.</p>
          </div>
          <button
            onClick={() => fetchMarketData(typeFilter)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-sm transition-all"
          >
            <RefreshCw size={16} /> Refresh Data
          </button>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl flex items-center gap-3 border border-rose-100 font-bold text-sm">
            <AlertCircle size={18} />
            <span className="flex-1">{error}</span>
            <button onClick={() => fetchMarketData(typeFilter)} className="flex items-center gap-1 text-xs underline hover:no-underline">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* TYPE FILTER (all | technical | soft) */}
          <div className="flex items-center gap-2 flex-wrap">
            {['all', 'technical', 'soft'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  typeFilter === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {t === 'all' ? 'All Skills' : t === 'technical' ? 'Technical' : 'Soft'}
              </button>
            ))}
          </div>

          {/* QUICK STATS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Briefcase size={20} /></div>
              </div>
              <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1">Active Listings</h3>
              <p className="text-3xl font-black text-slate-800">{formatNumber(totalJobs)}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={20} /></div>
              </div>
              <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1">Unique Roles</h3>
              <p className="text-3xl font-black text-slate-800">{formatNumber(totalRoles)}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-fuchsia-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-2xl"><DollarSign size={20} /></div>
              </div>
              <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1">Avg Skills / Job</h3>
              <p className="text-3xl font-black text-slate-800">{avgSkillsPerJob}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Target size={20} /></div>
              </div>
              <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1">Top Skill Demand</h3>
              <p className="text-3xl font-black text-slate-800 truncate" title={topSkillName}>{topSkillName}</p>
            </div>
          </div>

          {/* CHARTS ROW */}
          <div className="grid lg:grid-cols-12 gap-8">
            {/* LEFT CHART: DEMAND TREND (AREA CHART) */}
            <div className="lg:col-span-8 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Activity size={20} /></div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Market Demand Trend</h2>
                    <p className="text-xs font-bold text-slate-400">Top skills by demand (proxy)</p>
                  </div>
                </div>
              </div>

              <div className="h-[300px] w-full">
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
                  <div className="h-full flex items-center justify-center text-slate-400 font-medium text-sm">
                    No trend data available yet. Run the scraper to collect job data.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT CHART: TOP SKILLS (BAR CHART) */}
            <div className="lg:col-span-4 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-fuchsia-50 text-fuchsia-600 rounded-xl"><BarChart3 size={20} /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">Top Skills</h2>
                  <p className="text-xs font-bold text-slate-400">Most requested by employers</p>
                </div>
              </div>

              <div className="h-[300px] w-full">
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
                  <div className="h-full flex items-center justify-center text-slate-400 font-medium text-sm">
                    No skill data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* INSIGHTS / AI SUMMARY SECTION */}
          <div className="bg-slate-900 rounded-3xl p-8 shadow-lg border border-slate-800 relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
              <Sparkles size={150} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3 relative z-10">
              <Sparkles className="text-indigo-400" size={24} /> AI Market Summary
            </h3>
            <div className="text-slate-300 font-medium leading-relaxed max-w-3xl relative z-10 space-y-4">
              <p>{aiSummary}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
