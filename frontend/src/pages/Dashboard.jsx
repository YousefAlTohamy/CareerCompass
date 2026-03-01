import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle2, TrendingUp, Target, Plus, Search } from 'lucide-react';
import { cvAPI, gapAnalysisAPI } from '../api/endpoints';
import ProcessingAnimation from '../components/ProcessingAnimation';

const SkillChip = ({ skill, onRemove }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -2 }}
    className="flex items-center gap-3 bg-white border border-slate-100 px-4 py-2.5 rounded-xl shadow-premium hover:shadow-premium-hover transition-all group"
  >
    <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_#6366f1]" />
    <span className="font-semibold text-slate-700 text-sm">{skill.name}</span>
    <button
      onClick={() => onRemove(skill.id)}
      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
    >
      <X size={14} />
    </button>
  </motion.div>
);

export default function Dashboard() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
      await cvAPI.uploadCV(formData);
      setMessage({ type: 'success', text: 'CV optimized! Skills extracted and profile updated.' });
      await loadSkills();
      await loadRecommendations();
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('CV upload error:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to analyze CV' 
      });
    } finally {
      setUploading(false);
    }
  };

  const removeSkill = async (skillId) => {
    try {
      await cvAPI.removeSkill(skillId);
      setSkills(prev => prev.filter(s => s.id !== skillId));
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove skill' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ProcessingAnimation isVisible={uploading} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Header */}
        <header className="mb-12">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-black text-primary tracking-tight"
          >
            Your Talent <span className="text-secondary font-medium italic">Cockpit</span>
          </motion.h1>
          <p className="text-slate-500 mt-2 text-lg">Analyze, optimize, and track your career growth with AI.</p>
        </header>

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            {/* Action Card: CV Upload */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-premium p-10 bg-gradient-to-br from-white to-slate-50"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                  <Upload size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Optimize Your Resume</h2>
                  <p className="text-sm text-slate-500 font-medium">Extract skills and identify hidden potential.</p>
                </div>
              </div>

              {message.text && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
                    message.type === 'error' 
                      ? 'bg-red-50 border-red-100 text-red-700' 
                      : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}
                >
                  <CheckCircle2 size={18} />
                  <span className="font-semibold text-sm">{message.text}</span>
                </motion.div>
              )}

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
            </motion.div>

            {/* Skills Dashboard */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-secondary rounded-full" />
                  <h3 className="text-2xl font-bold text-slate-900">Extracted Expertise</h3>
                </div>
                <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">{skills.length} Total Skills</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                   [...Array(6)].map((_, i) => (
                    <div key={i} className="h-[52px] bg-slate-200 animate-pulse rounded-xl" />
                  ))
                ) : skills.length === 0 ? (
                  <div className="col-span-full border-2 border-dashed border-slate-200 py-16 text-center rounded-2xl">
                    <p className="text-slate-400 font-bold">No skills detected yet. Upload your CV to start.</p>
                  </div>
                ) : (
                  skills.map((skill) => (
                    <SkillChip key={skill.id} skill={skill} onRemove={removeSkill} />
                  ))
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
                  <a href="/market-intelligence" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all group">
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
