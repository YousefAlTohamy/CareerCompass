import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle2, TrendingUp, Target, Plus, Search, Award, Sparkles } from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cvAPI, gapAnalysisAPI } from '../../api/endpoints';
import ProcessingAnimation from '../../components/ProcessingAnimation';
import Swal from 'sweetalert2';

const SkillChip = ({ skill, onRemove }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -2, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className="flex items-center gap-3 bg-white border border-slate-100 px-4 py-2.5 rounded-xl shadow-premium hover:shadow-premium-hover transition-all group cursor-default"
  >
    <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_#6366f1]" />
    <span className="font-semibold text-slate-700 text-sm">{skill.name}</span>
    <button
      onClick={() => onRemove(skill.id)}
      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-1"
    >
      <X size={14} />
    </button>
  </motion.div>
);

const ReadinessScore = ({ skills, recommendations }) => {
  // Calculate a "Market Readiness" score
  // Ratio of existing skills to total skills (existing + gaps)
  const totalGaps = (recommendations.critical?.length || 0) + (recommendations.important?.length || 0);
  const totalSkills = skills.length + totalGaps;
  const score = totalSkills > 0 ? Math.round((skills.length / totalSkills) * 100) : 0;

  const data = [
    { name: 'Readiness', value: score, color: '#6366f1' },
    { name: 'Remaining', value: 100 - score, color: '#f1f5f9' },
  ];

  return (
    <div className="relative w-32 h-32 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={40}
            outerRadius={55}
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
        <span className="text-2xl font-black text-slate-900">{score}%</span>
        <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Ready</span>
      </div>
    </div>
  );
};

const SkillRadar = ({ skills }) => {
  // Categorize skills for the radar chart
  const categories = {
    'Technical': ['javascript', 'react', 'node', 'python', 'java', 'c++', 'backend', 'frontend', 'sql', 'nosql', 'api'],
    'Tools': ['git', 'docker', 'kubernetes', 'aws', 'azure', 'jenkins', 'linux', 'figma', 'jira'],
    'Industry': ['agile', 'scrum', 'fintech', 'healthcare', 'e-commerce', 'security'],
    'Soft Skills': ['communication', 'leadership', 'teamwork', 'problem solving', 'management', 'mentoring'],
  };

  const getScore = (keywords) => {
    const count = skills.filter(s => 
      keywords.some(k => s.name.toLowerCase().includes(k))
    ).length;
    // Map count to a 100-point scale (simple demo logic)
    return Math.min(count * 25 + 10, 100); 
  };

  const data = [
    { subject: 'Technical', A: getScore(categories['Technical']), fullMark: 100 },
    { subject: 'Soft Skills', A: getScore(categories['Soft Skills']), fullMark: 100 },
    { subject: 'Industry', A: getScore(categories['Industry']), fullMark: 100 },
    { subject: 'Tools', A: getScore(categories['Tools']), fullMark: 100 },
    { subject: 'Legacy', A: 30, fullMark: 100 }, // Mock static category for balance
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
          <Radar
            name="Skills"
            dataKey="A"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.15}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { login } = useAuth(); // We'll use this to update user context silently
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [recommendations, setRecommendations] = useState({
    critical: [],
    important: [],
    nice_to_have: []
  });

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
      console.error('Error loading skills:', error);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const response = await gapAnalysisAPI.getRecommendations();
      const data = response.data.data?.recommendations || response.data.data || {};
      setRecommendations({
        critical: data.critical || [],
        important: data.important || [],
        nice_to_have: data.nice_to_have || []
      });
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }

    const formData = new FormData();
    formData.append('cv', file);

    try {
      setUploading(true);
      setMessage({ type: '', text: '' });
      const response = await cvAPI.uploadCV(formData);
      const responseData = response?.data?.data || response?.data || {};
      const isNewRole = response?.is_new_role || response?.data?.is_new_role || responseData?.is_new_role || false;
      const updatedUser = responseData?.user;
      
      // Update the global auth context with new job title and contact info
      if (updatedUser) {
          login(updatedUser, localStorage.getItem('token'));
      }

      if (isNewRole) {
        setUploading(false);
        setIsDiscovering(true);
        setTimeout(() => {
          setIsDiscovering(false);
          navigate('/jobs');
        }, 5000);
        return; // Skip normal success toast
      }

      Swal.fire({
        icon: 'success',
        title: 'CV Optimized!',
        text: 'Skills extracted and profile updated.',
        confirmButtonColor: '#6366f1',
      });
      await loadSkills();
      await loadRecommendations();
      setUploading(false);
    } catch (error) {
      console.error('CV upload error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: error.response?.data?.message || 'Failed to analyze CV',
        confirmButtonColor: '#6366f1',
      });
    } finally {
      if (!isDiscovering) {
        setUploading(false);
      }
    }
  };

  const removeSkill = async (skillId) => {
    const result = await Swal.fire({
      title: 'Remove skill?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Yes, remove it',
    });

    if (!result.isConfirmed) return;

    try {
      await cvAPI.removeSkill(skillId);
      setSkills(prev => prev.filter(s => s.id !== skillId));
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Skill removed',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to remove skill',
        confirmButtonColor: '#6366f1',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ProcessingAnimation isVisible={uploading} />
      <ProcessingAnimation 
        isVisible={isDiscovering} 
        message="Discovering new market opportunities for your unique profile..." 
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm text-secondary font-black text-[10px] uppercase tracking-wider mb-3"
            >
              <Sparkles size={12} />
              AI Career Intelligence Active
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl md:text-5xl font-black text-primary tracking-tight"
            >
              Your Talent <span className="text-secondary font-medium italic">Cockpit</span>
            </motion.h1>
            <p className="text-slate-500 mt-2 text-lg font-medium">Analyze, optimize, and track your career growth with AI.</p>
          </div>

          {skills.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-4 rounded-3xl shadow-premium border border-slate-100 flex items-center gap-6"
            >
              <ReadinessScore skills={skills} recommendations={recommendations} />
              <div className="pr-4">
                <h4 className="text-sm font-black text-slate-900 leading-tight">Career Readiness</h4>
                <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tighter">Market Match Score</p>
                <div className="flex items-center gap-1 mt-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase">
                    Top {Math.max(5, 100 - (skills.length * 5))}% in Role
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </header>

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            {/* Action Card: CV Upload */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`card-premium p-8 bg-gradient-to-br from-white to-slate-50 border-2 ${
                skills.length > 0 ? 'border-emerald-100/50' : 'border-transparent'
              }`}
            >
              {skills.length > 0 ? (
                /* Compact Active State */
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">Resume Data Active</h2>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-md tracking-wider">Scanned</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Your profile is synced with your latest professional data.</p>
                    </div>
                  </div>
                  
                  <label className="shrink-0 cursor-pointer group">
                    <input type="file" accept=".pdf" onChange={handleCVUpload} disabled={uploading} className="hidden" />
                    <div className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:border-primary hover:text-primary transition-all shadow-sm">
                      <Upload size={16} />
                      Update Resume
                    </div>
                  </label>
                </div>
              ) : (
                /* Full Upload State */
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                      <Upload size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Optimize Your Resume</h2>
                      <p className="text-sm text-slate-500 font-medium">Extract skills and identify hidden potential.</p>
                    </div>
                  </div>

                  <label className="group block relative cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleCVUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center group-hover:border-primary group-hover:bg-white transition-all duration-300">
                      <div className="w-16 h-16 bg-slate-50 group-hover:bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                        <Upload className="text-slate-400 group-hover:text-primary transition-colors" size={28} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700">Drop your resume here or <span className="text-primary underline decoration-primary/30 underline-offset-4">browse</span></h3>
                      <p className="text-slate-400 text-sm mt-2">Maximum file size: 5MB (PDF only)</p>
                    </div>
                  </label>
                </>
              )}
            </motion.div>

            {/* Skills Dashboard */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-secondary rounded-full" />
                  <h3 className="text-2xl font-bold text-slate-900">Extracted Expertise</h3>
                </div>
                <div className="flex items-center gap-4">
                   <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">{skills.length} Skills</span>
                </div>
              </div>
              
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-12">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                       [...Array(6)].map((_, i) => (
                        <div key={i} className="h-[52px] bg-slate-200 animate-pulse rounded-xl" />
                      ))
                    ) : skills.length === 0 ? (
                      <div className="col-span-full border-2 border-dashed border-slate-200 py-16 text-center rounded-2xl bg-white/50">
                        <p className="text-slate-400 font-bold">No skills detected yet. Upload your CV to start.</p>
                      </div>
                    ) : (
                      skills.map((skill) => (
                        <SkillChip key={skill.id} skill={skill} onRemove={removeSkill} />
                      ))
                    )}
                  </div>
                </div>
                
                {skills.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-12 card-premium p-6 bg-white"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Award size={14} className="text-secondary" />
                        Skill Matrix Analysis
                      </h4>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      <div className="w-full md:w-1/2">
                        <SkillRadar skills={skills} />
                      </div>
                      <div className="w-full md:w-1/2 space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter mb-1">Focus Area</p>
                           <p className="font-bold text-slate-900">
                             {skills.length > 5 ? 'Technical Depth & Architecture' : 'Foundational Growth'}
                           </p>
                           <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                             {skills.length > 5 
                               ? 'Your profile shows strong mastery in core engineering tools.' 
                               : 'Focus on expanding your core technical stack to match top-tier roles.'}
                           </p>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                           <p className="text-xs font-bold text-emerald-600 uppercase tracking-tighter mb-1">Market Standout</p>
                           <p className="font-bold text-emerald-900">
                             {skills.find(s => s.name.toLowerCase().includes('react')) ? 'Modern Frontend' : 'Applied Intelligence'}
                           </p>
                           <p className="text-[11px] text-emerald-600/70 mt-1 leading-relaxed">
                             You perform exceptionally well in {skills.length > 0 ? skills[0].name : 'analytical'} domains.
                           </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:col-span-4 space-y-8">
            {/* Recommendations Widget */}
            <div className="card-premium p-8 bg-primary">
              <div className="flex items-center gap-3 mb-6">
                <Target className="text-accent" size={24} />
                <h3 className="text-xl font-bold text-white">Smart Skill Path</h3>
              </div>

              <div className="space-y-6">
                {recommendations.critical?.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-accent tracking-[.2em] mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      Critical Demand
                    </h4>
                    <div className="space-y-2">
                      {recommendations.critical.slice(0, 3).map((rec, idx) => (
                        <div key={idx} className="bg-white/10 border border-white/10 p-4 rounded-xl hover:bg-white/20 transition-all cursor-default">
                          <p className="font-bold text-white text-sm">{rec.name || rec}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <TrendingUp size={12} className="text-accent" />
                            <span className="text-[10px] text-slate-300 font-bold">High Market Gap</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recommendations.important?.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-[.2em] mb-3">
                      Important
                    </h4>
                    <div className="space-y-2">
                      {recommendations.important.slice(0, 3).map((rec, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-xl text-slate-200 hover:text-white transition-all">
                          <p className="font-semibold text-sm">{rec.name || rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {skills.length === 0 && (
                   <div className="text-center py-6">
                      <p className="text-slate-400 text-xs italic">Personalized roadmap appears after CV analysis.</p>
                   </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card-premium p-6">
               <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Quick Links</h4>
               <nav className="space-y-2">
                  <a href="/jobs" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all group">
                    <span className="font-bold text-slate-700 group-hover:text-primary">Browse Jobs</span>
                    <Search size={16} className="text-slate-400 group-hover:text-primary" />
                  </a>
                  <a href="/market" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all group">
                    <span className="font-bold text-slate-700 group-hover:text-primary">Market Trends</span>
                    <TrendingUp size={16} className="text-slate-400 group-hover:text-primary" />
                  </a>
               </nav>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
