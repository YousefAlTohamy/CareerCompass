import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion'; // <--- تم إضافة هذا السطر لحل الكراش الأساسي
import { 
  Search, Target, Briefcase, MapPin, DollarSign, 
  ExternalLink, BookmarkPlus, CheckCircle2, AlertCircle, 
  ChevronRight, X, Sparkles, RefreshCw
} from 'lucide-react';
import { jobsAPI, gapAnalysisAPI } from '../../api/endpoints';
import applicationsAPI from '../../api/applications';
import ErrorAlert from '../../components/ErrorAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useTranslation } from 'react-i18next';

/* ─── Simple toast (premium design) ──────────────────────────────── */
function Toast({ toast, onClose }) {
  if (!toast.show) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl font-bold text-sm transition-all duration-300 animate-in slide-in-from-right-4 ${
        toast.type === 'error'
          ? 'bg-rose-500 text-white'
          : 'bg-emerald-500 text-white'
      }`}
    >
      <span>{toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}</span>
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded-full p-1 leading-none transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

export default function Jobs() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // ── All Jobs ────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Search ──────────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Recommended Jobs ────────────────────────────────────────────────
  const [recommended, setRecommended] = useState([]);
  const [recMeta, setRecMeta] = useState(null);
  const [recLoading, setRecLoading] = useState(true);

  // ── Job Detail + Gap Analysis ───────────────────────────────────────
  const [selectedJob, setSelectedJob] = useState(null);
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Tracker state ───────────────────────────────────────────────────
  const [trackedIds, setTrackedIds] = useState(new Set());
  const [trackingId, setTrackingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Toast ────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }, []);

  /* ─── Initial load ───────────────────────────────────────────────── */
  useEffect(() => {
    loadJobs(searchQuery);
    loadRecommended();
  }, []);

  /* ─── Re-fetch when search changes ──────────────────────────────── */
  useEffect(() => {
    loadJobs(searchQuery);
  }, [searchQuery]);

  /* ─── Data fetching ──────────────────────────────────────────────── */
  const loadJobs = async (query = '') => {
    try {
      setLoading(true);
      setError('');
      const params = query ? { search: query } : {};
      const response = await jobsAPI.getJobs(params);
      const jobsData = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
        
      const jobsArray = Array.isArray(jobsData) ? jobsData : (jobsData?.data || []);
      
      const sortedJobs = [...jobsArray].sort((a, b) => {
        const scoreA = parseFloat(a.match_percentage ?? a.match_score) || 0;
        const scoreB = parseFloat(b.match_percentage ?? b.match_score) || 0;
        return scoreB - scoreA;
      });
        
      setJobs(sortedJobs);
      if (jobsArray.length === 0) {
        setError(
          query
            ? `${t('jobs.no_results')} "${query}". ${t('jobs.try_different')}`
            : t('jobs.no_available')
        );
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setError(err.response?.data?.message || t('jobs.error_load'));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommended = async () => {
    try {
      setRecLoading(true);
      const response = await jobsAPI.getRecommendedJobs();
      const data = response.data?.data || [];
      const recommendedJobs = Array.isArray(data) ? data : [];
      
      const sortedRecommended = [...recommendedJobs].sort((a, b) => {
        const scoreA = parseFloat(a.match_percentage ?? a.match_score) || 0;
        const scoreB = parseFloat(b.match_percentage ?? b.match_score) || 0;
        return scoreB - scoreA;
      });

      setRecommended(sortedRecommended);
      setRecMeta(response.data?.meta || null);
    } catch (err) {
      console.error('Failed to load recommended jobs:', err);
      setRecommended([]);
    } finally {
      setRecLoading(false);
    }
  };

  const analyzeJobGap = async (jobId) => {
    try {
      setAnalyzing(true);
      setError('');
      const response = await gapAnalysisAPI.analyzeJob(jobId);
      setGapAnalysis(response.data?.data || response.data);
    } catch (err) {
      console.error('Failed to analyze job gap:', err);
      setError(err.response?.data?.message || t('jobs.error_analyze'));
      setGapAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  };

  /* ─── Search handlers ────────────────────────────────────────────── */
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(inputValue.trim());
    setSelectedJob(null);
    setGapAnalysis(null);
  };

  const handleClearSearch = () => {
    setInputValue('');
    setSearchQuery('');
  };

  /* ─── Job selection ──────────────────────────────────────────────── */
  const handleJobSelect = (job) => {
    setSelectedJob(job);
    setSaveSuccess(false);
    analyzeJobGap(job.id);
    // Smooth scroll to top of job details on mobile
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  };

  /* ─── Per-card Track button ──────────────────────────────────────── */
    const handleTrackJob = async (e, job) => {
    e.stopPropagation();
    if (trackedIds.has(job.id) || trackingId === job.id) return;
    try {
      setTrackingId(job.id);
      await applicationsAPI.trackApplication(job.id);
      setTrackedIds((prev) => new Set(prev).add(job.id));
      showToast(`"${job.title}" ${t('jobs.saved_tracker')} 📌`);
    } catch (err) {
      const status = err.response?.status;
      if (status === 422 || status === 409) {
        setTrackedIds((prev) => new Set(prev).add(job.id));
        showToast(t('jobs.already_tracked'));
      } else {
        showToast(t('jobs.error_save'), 'error');
      }
    } finally {
      setTrackingId(null);
    }
  };

  /* ─── Detail panel save button ───────────────────────────────────── */
  const handleSaveToTracker = async () => {
    if (!selectedJob) return;
    try {
      setSaving(true);
      await applicationsAPI.saveJob({ job_id: selectedJob.id, status: 'saved' });
      setSaveSuccess(true);
      setTrackedIds((prev) => new Set(prev).add(selectedJob.id));
      showToast(`"${selectedJob.title}" ${t('jobs.saved_tracker')} 📌`);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const status = err.response?.status;
      if (status === 422 || status === 409) {
        setSaveSuccess(true);
        setTrackedIds((prev) => new Set(prev).add(selectedJob.id));
        showToast(t('jobs.already_tracked'));
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(t('jobs.error_save'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleViewFullAnalysis = (jobId) => navigate(`/gap-analysis/${jobId}`);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 font-sans pb-24 transition-colors duration-300">
      <Toast toast={toast} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Briefcase size={28} />
              </div>
              {t('jobs.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">{t('jobs.subtitle')}</p>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative max-w-3xl">
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 px-2 py-2 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 dark:focus-within:border-indigo-500/50">
              <div className="pl-3 text-slate-400 dark:text-slate-500">
                <Search size={20} />
              </div>
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('jobs.search_placeholder')} 
                className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-2 mr-1 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-100 dark:shadow-none"
              >
                {t('jobs.search_button')}
              </button>
            </div>
          </form>
          {searchQuery && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
              <span>{t('jobs.showing_results_for')}: <span className="text-indigo-600">"{searchQuery}"</span></span>
              <button onClick={handleClearSearch} className="text-rose-500 hover:underline">{t('jobs.clear')}</button>
            </div>
          )}
        </div>

        {/* ERROR ALERT */}
        {error && (
          <ErrorAlert title="Notice" message={error} onClose={() => setError('')} />
        )}

        {/* RECOMMENDED SECTION (CONDITIONAL) */}
        {!searchQuery && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-500 rounded-lg">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{t('jobs.recommended_title')}</h2>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">
                    {recMeta?.based_on || t('jobs.tailored_desc')}
                  </p>
                </div>
              </div>
              <button 
                onClick={loadRecommended}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-colors"
                disabled={recLoading}
              >
                <RefreshCw size={14} className={recLoading ? 'animate-spin' : ''} /> 
                {recLoading ? t('jobs.refreshing') : t('jobs.refresh')}
              </button>
            </div>

            {/* HORIZONTAL SCROLL RECOMMENDED JOBS */}
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth hide-scrollbar">
              {recLoading ? (
                [1, 2, 3, 4].map(k => (
                  <div key={k} className="shrink-0 w-72 h-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl animate-pulse" />
                ))
              ) : recommended.length > 0 ? (
                recommended.map(job => (
                  <div 
                    key={job.id}
                    onClick={() => handleJobSelect(job)}
                    className={`snap-start shrink-0 w-72 bg-white dark:bg-slate-800 rounded-3xl shadow-sm hover:shadow-md border transition-all p-6 flex flex-col justify-between group relative cursor-pointer ${
                      selectedJob?.id === job.id ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {(() => {
                      const matchVal = job.match_percentage ?? job.match_score;
                      if (!matchVal) return null;
                      const isHigh = matchVal >= 80;
                      const isMed = matchVal >= 50;
                      const colorClass = isHigh ? 'bg-emerald-500' : isMed ? 'bg-indigo-500' : 'bg-orange-500';
                      return (
                        <div className={`absolute -top-3 -right-1 text-white font-black text-[10px] px-3 py-1 rounded-full border-2 border-white dark:border-slate-800 shadow-md flex items-center gap-1 ${colorClass}`}>
                          <Target size={12}/> {matchVal}% {t('jobs.match')}
                        </div>
                      );
                    })()}
                    
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-600/50">
                        {job.source || t('jobs.direct_source')}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1 mb-4">
                      <h3 className="font-black text-slate-800 dark:text-white text-base leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {job.title}
                      </h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 italic">{job.company}</p>
                      
                      {/* Compatibility logic */}
                      {job.skills?.length > 0 && (
                        <div className="mt-1 text-[9px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider flex items-center gap-1 opacity-90">
                           <Sparkles size={10} className="shrink-0" /> Requires: {job.skills.slice(0,3).map(s => s.name).join(', ')}{job.skills.length > 3 && '...'}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-5">
                      {job.location && (
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-md flex items-center gap-1.5">
                          <MapPin size={10} className="text-slate-400 dark:text-slate-500"/> {job.location}
                        </span>
                      )}
                      {job.salary_range && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-2 py-1 rounded-md flex items-center gap-1.5">
                          <DollarSign size={10}/> {job.salary_range}
                        </span>
                      )}
                    </div>

                    <button 
                      onClick={(e) => handleTrackJob(e, job)}
                      disabled={trackedIds.has(job.id) || trackingId === job.id}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        trackedIds.has(job.id)
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 cursor-default'
                          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white border border-indigo-100 dark:border-indigo-800'
                      }`}
                    >
                      {trackedIds.has(job.id) ? (
                        <><CheckCircle2 size={14} /> {t('jobs.already_tracked_btn')}</>
                      ) : (
                        <><BookmarkPlus size={14} /> {trackingId === job.id ? t('jobs.tracking') : t('jobs.track_btn')}</>
                      )}
                    </button>
                  </div>
                ))
              ) : recMeta && recMeta.based_on && recMeta.based_on.includes('upload your CV') ? (
                <div className="w-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 rounded-3xl p-10 text-center text-white shadow-lg overflow-hidden relative transition-colors duration-300">
                  <div className="absolute top-0 right-0 p-8 opacity-10 blur-xl pointer-events-none">
                    <Target size={180} className="text-white" />
                  </div>
                  <div className="relative z-10">
                    <Sparkles size={40} className="mx-auto text-indigo-200 mb-4" />
                    <h3 className="text-2xl font-black mb-2 tracking-tight">Unlock Your AI Job Matches</h3>
                    <p className="text-indigo-100 font-medium max-w-md mx-auto mb-6 leading-relaxed">
                      Upload your CV to see exactly how your skillset scores against market requirements using our AI semantic engine.
                    </p>
                    <button 
                      onClick={() => navigate('/profile')} 
                      className="bg-white text-indigo-600 font-black tracking-widest uppercase px-6 py-3 rounded-xl text-xs shadow-md hover:scale-105 hover:bg-slate-50 hover:shadow-xl transition-all"
                    >
                      Upload CV Now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-10 text-center transition-colors duration-300">
                  <Sparkles size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 font-bold">{t('jobs.no_rec_title')}</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{t('jobs.no_rec_desc')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAIN GRID */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* JOBS LIST (LEFT) */}
          <div className="lg:col-span-4 lg:sticky lg:top-6">
            <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                  {searchQuery ? t('jobs.search_results') : t('jobs.all_listings')}
                </h2>
                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {jobs.length} {t('jobs.found')}
                </span>
              </div>
              
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                  [1, 2, 3, 4, 5].map(k => (
                    <div key={k} className="h-20 bg-slate-50 dark:bg-slate-900 rounded-2xl animate-pulse" />
                  ))
                ) : jobs.length > 0 ? (
                  jobs.map(job => (
                    <div 
                      key={job.id}
                      onClick={() => handleJobSelect(job)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
                        selectedJob?.id === job.id 
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm' 
                          : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`font-black text-sm pr-12 transition-colors line-clamp-1 ${
                          selectedJob?.id === job.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-white'
                        }`}>
                          {job.title}
                        </h3>
                        {job.match_score > 0 && (
                          <div className="absolute top-4 right-4 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-black text-[9px] px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                            {job.match_score}%
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">{job.company}</p>
                      
                      <button 
                        onClick={(e) => handleTrackJob(e, job)}
                        disabled={trackedIds.has(job.id) || trackingId === job.id}
                        className={`w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          trackedIds.has(job.id)
                            ? 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm'
                        }`}
                      >
                        {trackedIds.has(job.id) ? (
                          <><CheckCircle2 size={12} /> {t('jobs.tracked')}</>
                        ) : (
                          <><BookmarkPlus size={12} /> {trackingId === job.id ? '...' : t('jobs.track_short')}</>
                        )}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <AlertCircle size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-2" />
                    <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">{t('jobs.no_results_criteria')}</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => searchQuery ? loadJobs(searchQuery) : loadJobs()}
                className="w-full mt-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
              >
                {t('jobs.refresh_board')}
              </button>
            </div>
          </div>

          {/* DETAILS & GAP ANALYSIS (RIGHT) */}
          <div className="lg:col-span-8 space-y-6 min-h-[500px]">
            
            {!selectedJob ? (
              <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 border-dashed p-20 text-center flex flex-col items-center justify-center transition-colors duration-300">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center text-slate-200 dark:text-slate-700 mb-5">
                  <Briefcase size={40} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{t('jobs.detail_empty_title')}</h3>
                <p className="text-slate-400 dark:text-slate-500 font-medium max-w-xs mt-2">{t('jobs.detail_empty_desc')}</p>
              </div>
            ) : (
              <>
                {/* JOB DETAILS CARD */}
                <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-8 md:p-10 relative overflow-hidden transition-colors duration-300">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl -mx-20 -my-20 pointer-events-none"></div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-8 mb-10">
                    <div className="max-w-xl">
                      <div className="flex items-center gap-2 mb-3">
                        {selectedJob.job_type && (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-600/50">
                            {selectedJob.job_type}
                          </span>
                        )}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight leading-tight mb-2">
                        {selectedJob.title}
                      </h2>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{selectedJob.company}</p>
                    </div>
                    
                    <button 
                      onClick={handleSaveToTracker}
                      disabled={saving || saveSuccess || trackedIds.has(selectedJob.id)}
                      className={`shrink-0 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none transition-all text-sm w-full md:w-auto ${
                        saveSuccess || trackedIds.has(selectedJob.id)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600'
                      } disabled:opacity-80`}
                    >
                      {saving ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : saveSuccess || trackedIds.has(selectedJob.id) ? (
                        <><CheckCircle2 size={18}/> {t('jobs.already_tracked_detail')}</>
                      ) : (
                        <><BookmarkPlus size={18}/> {t('jobs.track_detailed')}</>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 relative z-10">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 tracking-widest">{t('profile.location')}</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5 truncate">
                        <MapPin size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0"/> {selectedJob.location || t('jobs.remote')}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 tracking-widest">{t('jobs.compensation')}</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5 truncate">
                        <DollarSign size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0"/> {selectedJob.salary_range || t('jobs.competitive')}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 tracking-widest">{t('profile.experience')}</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5 truncate">
                        <Target size={14} className="text-fuchsia-500 dark:text-fuchsia-400 shrink-0"/> {selectedJob.experience || t('jobs.not_specified')}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 tracking-widest">{t('jobs.source')}</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5 truncate uppercase">
                        <ExternalLink size={14} className="text-slate-400 dark:text-slate-500 shrink-0"/> {selectedJob.source || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {selectedJob.url && (
                    <a 
                      href={selectedJob.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-10 bg-indigo-50 dark:bg-indigo-900/30 px-5 py-3 rounded-2xl transition-all hover:bg-indigo-100 group"
                    >
                      {t('jobs.view_original')} <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-700 pt-8">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      {t('jobs.description')}
                    </h4>
                    <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap text-sm">
                      {selectedJob.description || t('jobs.desc_not_provided')}
                    </div>
                  </div>
                </div>

                {/* GAP ANALYSIS SECTION */}
                <div className="space-y-6">
                  {analyzing ? (
                    <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center transition-colors duration-300">
                       <LoadingSpinner message={t('jobs.analyzing_msg')} />
                    </div>
                  ) : gapAnalysis ? (
                    <motion.div 
                      key={selectedJob.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-8 md:p-10 transition-colors duration-300"
                    >
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                          <div className="w-2 h-6 bg-fuchsia-500 rounded-full" />
                          {t('jobs.ai_insight')}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] font-black bg-slate-900 dark:bg-black text-white px-3 py-1.5 rounded-lg uppercase tracking-widest">
                          <Sparkles size={12} className="text-fuchsia-400" /> {t('jobs.realtime_analysis')}
                        </div>
                      </div>
                      
                      {/* SCORE CARDS */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl group hover:border-emerald-200 transition-all">
                          <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-2 tracking-widest">{t('jobs.matched_skills')}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-emerald-700 dark:text-emerald-300 tracking-tighter transition-transform group-hover:scale-110 origin-left inline-block">
                              {gapAnalysis.analysis?.matched_skills_count ?? gapAnalysis.matched_skills?.length ?? 0}
                            </span>
                            <span className="text-emerald-500 dark:text-emerald-600 font-bold text-xs uppercase">{t('jobs.items')}</span>
                          </div>
                        </div>
                        <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl group hover:border-rose-200 transition-all">
                          <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 mb-2 tracking-widest">{t('jobs.missing_skills')}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-rose-700 dark:text-rose-300 tracking-tighter transition-transform group-hover:scale-110 origin-left inline-block">
                              {gapAnalysis.analysis?.missing_skills_count ?? gapAnalysis.missing_skills?.length ?? 0}
                            </span>
                            <span className="text-rose-500 dark:text-rose-600 font-bold text-xs uppercase">{t('jobs.needs_attention')}</span>
                          </div>
                        </div>
                        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl relative overflow-hidden group hover:border-indigo-200 transition-all">
                          <div className="absolute right-0 bottom-0 text-indigo-400/10 dark:text-indigo-400/5 -mr-4 -mb-4 group-hover:scale-125 transition-transform"><Target size={100}/></div>
                          <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 mb-2 tracking-widest relative z-10">{t('jobs.market_match_score')}</p>
                          <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-4xl font-black text-indigo-700 dark:text-indigo-300 tracking-tighter">
                              {gapAnalysis.analysis?.match_percentage ?? gapAnalysis.match_percentage ?? '0'}%
                            </span>
                            <span className="text-indigo-500 dark:text-indigo-600 font-bold text-xs uppercase">{t('jobs.suitability')}</span>
                          </div>
                        </div>
                      </div>

                      {/* SKILLS LISTS */}
                      <div className="space-y-8">
                        {/* Matched Skills - Added safety check || [] */}
                        {(gapAnalysis.analysis?.matched_skills || gapAnalysis.matched_skills || [])?.length > 0 && (
                          <div>
                            <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-emerald-500" />
                              {t('jobs.matching_expertise')}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {(gapAnalysis.analysis?.matched_skills || gapAnalysis.matched_skills || []).map((skill, idx) => (
                                <span
                                  key={idx}
                                  className="px-3.5 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
                                >
                                  {typeof skill === 'object' ? skill.name : skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Missing Skills - Added safety check || [] */}
                        {(gapAnalysis.analysis?.missing_skills || gapAnalysis.missing_skills || [])?.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                            <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Target size={14} className="text-rose-500" />
                              {t('jobs.rec_skills')}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {(gapAnalysis.analysis?.missing_skills || gapAnalysis.missing_skills || []).map((skill, idx) => (
                                <a
                                  key={idx}
                                  href={`https://www.coursera.org/search?query=${encodeURIComponent(typeof skill === 'object' ? skill.name : skill)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3.5 py-2 bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl text-xs font-bold border border-rose-100 dark:border-rose-800 shadow-sm transition-all flex items-center gap-2 group/skill"
                                  title="Search courses for this skill"
                                >
                                  {typeof skill === 'object' ? skill.name : skill}
                                  <ExternalLink size={12} className="text-rose-400 dark:text-rose-600 group-hover/skill:text-rose-600 transition-colors" />
                                </a>
                              ))}
                            </div>
                            <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1.5 uppercase tracking-wider">
                              <Sparkles size={12} className="text-indigo-400" /> {t('jobs.learn_paths_msg')}
                            </p>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleViewFullAnalysis(selectedJob.id)}
                        className="w-full mt-10 bg-slate-900 dark:bg-black hover:bg-slate-800 dark:hover:bg-slate-900 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-3 group uppercase tracking-widest text-xs"
                      >
                        {t('jobs.launch_gap_analysis')} 
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform rtl-flip" />
                      </button>
                    </motion.div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 dark:text-slate-500 font-bold border-dashed transition-colors duration-300">
                      {t('jobs.select_prompt')}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}