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
import { cvAPI, gapAnalysisAPI } from "../../api/endpoints";
import ProcessingAnimation from "../../components/ProcessingAnimation";
import Swal from "sweetalert2";

// --- NEW UI FOR SkillChip ---
const SkillChip = ({ skill, onRemove }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -2 }}
    className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow hover:border-indigo-200 transition-all group cursor-default shrink-0"
  >
    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">{skill.name}</span>
    <button 
      onClick={() => onRemove(skill.id)} 
      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 p-0.5"
    >
      <X size={14} strokeWidth={2.5} />
    </button>
  </motion.div>
);

const ReadinessScore = ({ score }) => {
  const data = [
    { name: "Readiness", value: score, color: "#4f46e5" }, // Indigo 600
    { name: "Remaining", value: 100 - score, color: "#f1f5f9" },
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
        <span className="text-sm font-black text-slate-900">{score}%</span>
      </div>
    </div>
  );
};

const SkillRadar = ({ skills }) => {
  // Categorize skills for the radar chart
  const categories = {
    Technical: [
      "javascript", "react", "node", "python", "java", "c++", "backend", "frontend", "sql", "nosql", "api",
    ],
    Tools: [
      "git", "docker", "kubernetes", "aws", "azure", "jenkins", "linux", "figma", "jira",
    ],
    Industry: [
      "agile", "scrum", "fintech", "healthcare", "e-commerce", "security",
    ],
    "Soft Skills": [
      "communication", "leadership", "teamwork", "problem solving", "management", "mentoring",
    ],
  };

  const getScore = (keywords) => {
    const count = skills.filter((s) =>
      keywords.some((k) => s.name.toLowerCase().includes(k))
    ).length;
    return Math.min(count * 25 + 10, 100);
  };

  const data = [
    { subject: "Technical", A: getScore(categories["Technical"]), fullMark: 100 },
    { subject: "Soft Skills", A: getScore(categories["Soft Skills"]), fullMark: 100 },
    { subject: "Industry", A: getScore(categories["Industry"]), fullMark: 100 },
    { subject: "Tools", A: getScore(categories["Tools"]), fullMark: 100 },
    { subject: "Legacy", A: 30, fullMark: 100 },
  ];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
          />
          <Radar
            name="Skills"
            dataKey="A"
            stroke="#4f46e5"
            fill="#4f46e5"
            fillOpacity={0.2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [marketReadiness, setMarketReadiness] = useState(0);

  useEffect(() => {
    loadSkills();
    loadRecommendations();
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const response = await cvAPI.getUserSkills();
      const skillsData = response.data.data?.skills || response.data.data || [];
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
      const responseData = response.data.data || {};
      
      setRecommendations(responseData.missing_skills || []);
      setMarketReadiness(responseData.market_readiness_score || 0);
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
        icon: 'error',
        title: 'File size must be less than 5MB',
        showConfirmButton: false,
        timer: 3000
      });
      return;
    }

    const formData = new FormData();
    formData.append("cv", file);

    try {
      setUploading(true);
      const response = await cvAPI.uploadCV(formData);
      const responseData = response?.data?.data || response?.data || {};
      const isNewRole =
        response?.is_new_role ||
        response?.data?.is_new_role ||
        responseData?.is_new_role ||
        false;
      const updatedUser = responseData?.user;

      if (updatedUser) {
        await refreshUser();
      }

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
        position: 'top-end',
        icon: 'success',
        title: 'CV Optimized!',
        text: 'Skills extracted and profile updated.',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      await loadSkills();
      await loadRecommendations();
      setUploading(false);
    } catch (error) {
      console.error("CV upload error:", error);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Upload Failed',
        text: error.response?.data?.message || 'Failed to analyze CV',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } finally {
      if (!isDiscovering) {
        setUploading(false);
      }
    }
  };

  const removeSkill = async (skillId) => {
    try {
      await cvAPI.removeSkill(skillId);
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Skill removed",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Error',
        text: 'Failed to remove skill',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }
  };

  const hasSkills = skills.length > 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-20 space-y-8 font-sans bg-slate-50 min-h-screen">
      <ProcessingAnimation isVisible={uploading} />
      <ProcessingAnimation
        isVisible={isDiscovering}
        message="Discovering new market opportunities for your unique profile..."
      />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3"
          >
             Welcome back, {user?.name?.split(' ')[0] || 'Talent'} <span className="animate-bounce origin-bottom-right">👋</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-slate-500 mt-2 text-sm font-medium"
          >
            Here is your personal career intelligence overview.
          </motion.p>
        </div>
      </div>

      <div className="space-y-6">
        {/* HERO ACTION CARD (DARK) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-xl border border-slate-800 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
          <div className="text-center md:text-left flex-1 space-y-4 relative z-10 w-full">
             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-white/10 text-indigo-300 border border-white/10">
               <Zap size={12} className="text-fuchsia-400" /> Next Best Action
             </span>
             
             {hasSkills ? (
               <>
                 <h2 className="text-3xl md:text-4xl font-black text-white">Ready to bridge the gap?</h2>
                 <p className="text-slate-400 font-medium">Run a gap analysis against the live market.</p>
                 <Link to="/jobs" className="inline-flex bg-indigo-500 hover:bg-indigo-600 transition-colors text-white font-bold py-3.5 px-8 rounded-xl items-center justify-center gap-2">
                   Start Gap Analysis
                 </Link>
               </>
             ) : (
               <>
                 <h2 className="text-3xl md:text-4xl font-black text-white">Upload your CV to start</h2>
                 <p className="text-slate-400 font-medium">Extract skills and generate your custom roadmap.</p>
                 <label className="cursor-pointer inline-block w-full sm:w-auto">
                   <input type="file" accept=".pdf" className="hidden" onChange={handleCVUpload} disabled={uploading} /> 
                   <div className="bg-fuchsia-600 hover:bg-fuchsia-700 transition-colors text-white font-bold py-3.5 px-8 rounded-xl flex justify-center items-center gap-2">
                     <Upload size={18} /> {uploading ? "Uploading..." : "Upload Resume Now"}
                   </div>
                 </label>
               </>
             )}
          </div>
          <div className="hidden lg:flex relative z-10">
            <Compass size={100} className="text-indigo-400/80 animate-pulse" strokeWidth={1} />
          </div>
        </motion.div>

        {/* 3 STAT CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CARD 1: SKILLS */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Award size={24} /></div>
              <h3 className="text-sm font-bold text-slate-400 uppercase">Your Skillset</h3>
              <div className="text-2xl font-black text-slate-800 mt-1">{loading ? '...' : `${skills.length} Skills Detected`}</div>
            </div>
            
            {/* MINI UPLOAD BUTTON */}
            <div className="absolute top-6 right-6 z-10">
               <label className="cursor-pointer group/btn" title="Update Resume">
                  <input type="file" accept=".pdf" className="hidden" onChange={handleCVUpload} disabled={uploading} />
                  <div className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors border border-slate-100 group-hover/btn:border-indigo-200">
                    <Upload size={16} />
                  </div>
               </label>
            </div>
          </motion.div>
          
          {/* CARD 2: READINESS PIE CHART */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-6">
             <ReadinessScore score={marketReadiness} />
             <div>
               <h3 className="text-sm font-bold text-slate-400 uppercase mb-1">Career Readiness</h3>
               <div className="text-xl font-black text-slate-800">Market Match</div>
               {marketReadiness > 0 && <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block border border-emerald-100">Analyzed</span>}
             </div>
          </motion.div>

          {/* CARD 3: TARGET ROLE */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center mb-4"><Target size={24} /></div>
              <h3 className="text-sm font-bold text-slate-400 uppercase">Target Role</h3>
              <div className="text-2xl font-black text-slate-800 line-clamp-1 mt-1" title={user?.job_title || 'Unset'}>
                {user?.job_title ? user.job_title : <span className="text-slate-300 italic">Not set</span>}
              </div>
            </div>
          </motion.div>
        </div>

        {/* MAIN SPLIT AREA */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* LEFT: SKILLS & RADAR */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
               <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center justify-between">
                 <span>Extracted Expertise</span>
                 <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-md">{skills.length} tracked</span>
               </h3>
               
               {loading ? (
                 <div className="flex flex-wrap gap-2 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map(k => <div key={k} className="h-8 w-24 bg-slate-200 rounded-lg" />)}
                 </div>
               ) : hasSkills ? (
                 <>
                   <div className="flex flex-wrap gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-8 min-h-[100px]">
                     {skills.map(skill => (
                       <SkillChip key={skill.id} skill={skill} onRemove={removeSkill} />
                     ))}
                   </div>

                   <hr className="border-slate-100 mb-8" />

                   <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 mb-6">
                     <Award size={16} className="text-indigo-500" />
                     Skill Matrix Analysis
                   </h4>
                   <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                     <div className="w-full md:w-1/2">
                       <SkillRadar skills={skills} />
                     </div>
                     <div className="w-full md:w-1/2 space-y-4">
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter mb-1">Focus Area</p>
                          <p className="font-bold text-slate-800">{skills.length > 5 ? "Technical Depth & Architecture" : "Foundational Growth"}</p>
                          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            {skills.length > 5 ? "Your profile shows strong mastery in core engineering tools." : "Focus on expanding your core technical stack to match top-tier roles."}
                          </p>
                        </div>
                     </div>
                   </div>
                 </>
               ) : (
                 <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                    <Award size={48} className="text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold mb-2">No expertise data available</p>
                    <p className="text-sm text-slate-400">Upload your resume above to extract your skills.</p>
                 </div>
               )}
            </div>
          </motion.div>

          {/* RIGHT: GAPS & QUICK LINKS */}
          <aside className="lg:col-span-4 space-y-6">
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800">
              <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                <Target className="text-fuchsia-400" size={20} /> Prioritized Gaps
              </h3>
              
              <div className="space-y-4">
                {recommendations?.length > 0 ? (
                  <>
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-fuchsia-400 tracking-[.2em] mb-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" /> Global Gap Focus
                    </h4>
                    <div className="space-y-3">
                      {recommendations.slice(0, 5).map((rec, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-colors">
                          <p className="font-bold text-white text-sm mb-2">{rec.name || rec}</p>
                          <div className="flex items-center gap-2">
                            <TrendingUp size={12} className="text-fuchsia-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              {rec.importance_category ? rec.importance_category.replace(/_/g, ' ') : 'Market Gap'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-sm">
                    {loading ? "Analyzing gaps..." : hasSkills ? "All caught up! Excellent profile match." : "Upload CV to view personalized gaps."}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Quick Links</h4>
              <nav className="space-y-2">
                <Link to="/jobs" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group">
                  <span className="font-bold text-slate-700 group-hover:text-indigo-700 text-sm">Browse Jobs Matrix</span>
                  <div className="bg-white p-1.5 rounded-lg shadow-sm text-slate-400 group-hover:text-indigo-600 transition-colors">
                    <Search size={16} />
                  </div>
                </Link>
                <Link to="/market" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group">
                  <span className="font-bold text-slate-700 group-hover:text-indigo-700 text-sm">Market Intelligence</span>
                  <div className="bg-white p-1.5 rounded-lg shadow-sm text-slate-400 group-hover:text-indigo-600 transition-colors">
                    <TrendingUp size={16} />
                  </div>
                </Link>
              </nav>
            </motion.div>

          </aside>
        </div>
      </div>
    </div>
  );
}
