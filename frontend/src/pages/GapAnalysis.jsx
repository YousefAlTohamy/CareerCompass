import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RadialBarChart, RadialBar, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell 
} from 'recharts';
import { 
  ChevronLeft, ExternalLink, GraduationCap, 
  AlertCircle, CheckCircle2, Briefcase, 
  Library, Sparkles, ArrowRight
} from 'lucide-react';
import { gapAnalysisAPI } from '../api/endpoints';
import applicationsAPI from '../api/applications';
import { useScrapingStatus } from '../hooks/useScrapingStatus';

// ── Premium Match Gauge with Recharts ──────────────────────────────────────
const PremiumMatchGauge = ({ percentage }) => {
  const data = [{ name: 'Match', value: percentage, fill: '#6366f1' }];
  const color = percentage >= 75 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart 
          cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" 
          barSize={15} data={data} startAngle={90} endAngle={90 - (3.6 * percentage)}
        >
          <RadialBar background dataKey="value" cornerRadius={10}>
             <Cell fill={color} />
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-slate-800">{Math.round(percentage)}%</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Match Rank</span>
      </div>
    </div>
  );
};

// ── Learning Resource Card ──────────────────────────────────────────────────
const LearningResource = ({ skill }) => {
  const providers = [
    { name: 'Udemy', color: 'bg-[#A435F0]', icon: 'U' },
    { name: 'Coursera', color: 'bg-[#0056D2]', icon: 'C' }
  ];
  
  return (
    <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl hover:bg-white hover:shadow-premium transition-all group">
      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
        <Library size={20} />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 text-sm">{skill}</h4>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Master this skill</p>
      </div>
      <div className="flex gap-2">
        {providers.map(p => (
          <a
            key={p.name}
            href={`https://www.udemy.com/courses/search/?q=${encodeURIComponent(skill)}`}
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

  if (scrapingJobId) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6 text-center">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} className="space-y-8 max-w-md">
          <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,212,255,0.3)]">
            <Sparkles className="text-accent animate-pulse" size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white italic">Digging into the Market</h2>
            <p className="text-slate-400 font-medium">Our AI is scanning live listings to benchmark your profile...</p>
          </div>
          <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
             <motion.div className="bg-accent h-full shadow-[0_0_10px_#00d4ff]" animate={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-black text-accent uppercase tracking-widest">{progress}% Scanned</span>
        </motion.div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Library className="animate-spin text-primary" /></div>;

  const matchPct = analysis?.match_percentage || 0;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <button 
          onClick={() => navigate('/jobs')}
          className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold mb-8 transition-colors group"
        >
          <ChevronLeft className="group-hover:-translate-x-1 transition-transform" />
          Back to Career Map
        </button>

        <div className="grid lg:grid-cols-12 gap-10">
          {/* Dashboard Left: Score & Overview */}
          <div className="lg:col-span-8 space-y-10">
            <div className="card-premium p-10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
               
               <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                  <PremiumMatchGauge percentage={matchPct} />
                  <div className="flex-1 space-y-6">
                    <div>
                      <h1 className="text-4xl font-black text-primary tracking-tight leading-none mb-2">
                        {analysis.job?.title}
                      </h1>
                      <p className="text-xl font-bold text-slate-400 italic font-serif">{analysis.job?.company}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100/50">
                          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Your Edge</p>
                          <p className="text-2xl font-black text-emerald-700 leading-none">{analysis.matched_skills?.length || 0} Skills</p>
                       </div>
                       <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100/50">
                          <p className="text-[10px] font-black uppercase text-rose-600 tracking-widest mb-1">Gap Focus</p>
                          <p className="text-2xl font-black text-rose-700 leading-none">{analysis.critical_skills?.length || 0} Skills</p>
                       </div>
                    </div>
                  </div>
               </div>
            </div>

            {/* Skill Visualizer: Strengths vs Gaps */}
            <div className="grid md:grid-cols-2 gap-10">
               {/* Strengths */}
               <section className="space-y-6">
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                     <h3 className="text-xl font-bold text-slate-800 tracking-tight">Your Expertise Market</h3>
                  </div>
                  <div className="space-y-3">
                    {analysis.matched_skills?.map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-premium group">
                         <span className="font-bold text-slate-700">{s.name}</span>
                         <CheckCircle2 className="text-emerald-500" size={18} />
                      </div>
                    ))}
                  </div>
               </section>

               {/* Critical Gaps */}
               <section className="space-y-6">
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-6 bg-rose-500 rounded-full" />
                     <h3 className="text-xl font-bold text-slate-800 tracking-tight">Priority Gaps</h3>
                  </div>
                  <div className="space-y-3">
                    {analysis.critical_skills?.map((s, i) => (
                      <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-premium relative group overflow-hidden">
                         <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-400" />
                         <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700">{s.name}</span>
                            <AlertCircle className="text-rose-400" size={18} />
                         </div>
                         <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-rose-400 h-full" style={{ width: `${s.importance_score}%` }} />
                         </div>
                         <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Market Demand: {s.importance_score}%</p>
                      </div>
                    ))}
                  </div>
               </section>
            </div>
          </div>

          {/* Sidebar: Learning & Action */}
          <aside className="lg:col-span-4 space-y-8">
             {/* Learning Bridge Section */}
             <div className="card-premium p-8 bg-white border-2 border-primary/5">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 bg-primary rounded-lg text-white">
                      <GraduationCap size={20} />
                   </div>
                   <h3 className="text-xl font-bold text-primary">Bridge the Gap</h3>
                </div>
                <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                  Our AI matched these courses to help you rank <b>90%+</b> for this specific role.
                </p>
                <div className="space-y-4">
                   {analysis.critical_skills?.slice(0, 4).map((s, i) => (
                      <LearningResource key={i} skill={s.name} />
                   ))}
                </div>
             </div>

             {/* Apply Widget */}
             <div className="card-premium p-8 bg-primary overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                   <Briefcase size={80} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Ready to Apply?</h3>
                <p className="text-slate-400 text-sm mb-6 font-medium">Your profile is {matchPct}% ready for this role.</p>
                <div className="space-y-3">
                   <a 
                     href={analysis.job?.url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="btn-primary w-full bg-accent text-primary hover:bg-white flex items-center justify-center gap-2 font-black py-4"
                   >
                     Go to Job Post <ExternalLink size={16} />
                   </a>
                   <button
                     onClick={handleSaveToTracker}
                     disabled={saving || saveSuccess}
                     className={`w-full py-4 rounded-xl font-black text-sm transition-all border-2 ${
                       saveSuccess 
                         ? 'bg-green-500 border-green-500 text-white' 
                         : 'bg-transparent border-white/20 text-white hover:bg-white/10'
                     }`}
                   >
                     {saving ? 'Processing...' : saveSuccess ? '✓ Saved to Tracker' : 'Save for Later'}
                   </button>
                 </div>
              </div>
          </aside>
        </div>

        {/* Bottom Section: Recommended Careers */}
        <section className="mt-20">
           <div className="flex items-center justify-between mb-10">
              <div className="space-y-1">
                 <h2 className="text-3xl font-black text-primary tracking-tight">Symmetry Careers</h2>
                 <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Jobs with similar skill structures</p>
              </div>
              <ArrowRight className="text-slate-300" />
           </div>
           
           <div className="grid md:grid-cols-3 gap-6">
              {analysis.recommended_jobs?.map((job, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ y: -5 }}
                  className="card-premium p-6 hover:border-primary/20 transition-all cursor-pointer"
                  onClick={() => navigate(`/gap-analysis/job/${job.id}`)}
                >
                   <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-md tracking-wider">
                         {job.source || 'Direct'}
                      </span>
                      <Sparkles size={16} className="text-accent" />
                   </div>
                   <h4 className="font-black text-primary text-lg mb-1 leading-tight line-clamp-1">{job.title}</h4>
                   <p className="text-sm font-bold text-slate-400 mb-4">{job.company}</p>
                   <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                      <span>📍 {job.location || 'Remote'}</span>
                      <span className="text-emerald-500">{job.job_type}</span>
                   </div>
                </motion.div>
              ))}
           </div>
        </section>
      </motion.div>
    </div>
  );
}
