import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI, gapAnalysisAPI } from '../../api/endpoints';
import applicationsAPI from '../../api/applications';
import ErrorAlert from '../../components/ErrorAlert';
import LoadingSpinner from '../../components/LoadingSpinner';

/* ─── Simple toast (no external lib needed) ──────────────────────────────── */
function Toast({ toast, onClose }) {
  if (!toast.show) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-premium font-semibold text-sm transition-all duration-300 ${
        toast.type === 'error'
          ? 'bg-red-500 text-white'
          : 'bg-emerald-500 text-white'
      }`}
    >
      <span>{toast.type === 'error' ? '✕' : '✓'}</span>
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

export default function Jobs() {
  const navigate = useNavigate();

  // ── All Jobs ────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Search ──────────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');   // committed on submit

  // ── Recommended Jobs ────────────────────────────────────────────────
  const [recommended, setRecommended] = useState([]);
  const [recMeta, setRecMeta] = useState(null);
  const [recLoading, setRecLoading] = useState(true);

  // ── Job Detail + Gap Analysis ───────────────────────────────────────
  const [selectedJob, setSelectedJob] = useState(null);
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Tracker state ───────────────────────────────────────────────────
  // trackedIds: Set of job IDs the user has already tracked this session
  const [trackedIds, setTrackedIds] = useState(new Set());
  const [trackingId, setTrackingId] = useState(null); // job currently being tracked
  // Legacy "Save to Tracker" from the detail panel
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Re-fetch when search changes ──────────────────────────────── */
  useEffect(() => {
    loadJobs(searchQuery);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setJobs(jobsData);
      if (jobsData.length === 0) {
        setError(
          query
            ? `No jobs found for "${query}". Try a different search term.`
            : 'No jobs available at the moment. Please check back later.'
        );
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setError(err.response?.data?.message || 'Failed to load jobs. Please ensure the backend is running.');
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
      setRecommended(Array.isArray(data) ? data : []);
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
      setError(err.response?.data?.message || 'Failed to analyze job gap. Please try again.');
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
  };

  /* ─── Per-card Track button ──────────────────────────────────────── */
  const handleTrackJob = async (e, job) => {
    e.stopPropagation(); // don't also select the job
    if (trackedIds.has(job.id) || trackingId === job.id) return;
    try {
      setTrackingId(job.id);
      await applicationsAPI.trackApplication(job.id);
      setTrackedIds((prev) => new Set(prev).add(job.id));
      showToast(`"${job.title}" saved to your tracker! 📌`);
    } catch (err) {
      const status = err.response?.status;
      if (status === 422 || status === 409) {
        // Already tracked – treat as success
        setTrackedIds((prev) => new Set(prev).add(job.id));
        showToast('Already in your tracker ✓');
      } else {
        showToast('Could not save to tracker. Please try again.', 'error');
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
      showToast(`"${selectedJob.title}" saved to your tracker! 📌`);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const status = err.response?.status;
      if (status === 422 || status === 409) {
        setSaveSuccess(true);
        setTrackedIds((prev) => new Set(prev).add(selectedJob.id));
        showToast('Already in your tracker ✓');
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError('Could not save to tracker. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleViewFullAnalysis = (jobId) => navigate(`/gap-analysis/${jobId}`);

  /* ─── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-light py-12 px-4">
      <Toast toast={toast} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      <div className="max-w-7xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Job Opportunities</h1>
          <p className="text-gray-600">Browse jobs, search by title or company, and track applications.</p>
        </div>

        {/* ── Search Bar ──────────────────────────────────────────── */}
        <form onSubmit={handleSearchSubmit} className="mb-8">
          <div className="flex items-center gap-3 bg-white rounded-2xl shadow-md border border-gray-100 px-4 py-3">
            <span className="text-xl select-none">🔍</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search by job title, company, or keyword…"
              className="flex-1 text-gray-800 placeholder-gray-400 text-sm font-medium bg-transparent outline-none"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none transition"
                title="Clear search"
              >
                ×
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-secondary transition-all shadow-sm"
            >
              Search
            </button>
          </div>
          {searchQuery && (
            <p className="text-xs text-gray-500 mt-2 ml-1">
              Showing results for <span className="font-semibold text-primary">"{searchQuery}"</span>
              {' · '}
              <button type="button" onClick={handleClearSearch} className="text-secondary hover:underline">
                Clear
              </button>
            </p>
          )}
        </form>

        {/* Error Alert */}
        {error && (
          <ErrorAlert title="Notice" message={error} onClose={() => setError('')} />
        )}

        {/* ── Recommended For You (hidden during search) ─────────── */}
        {!searchQuery && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Recommended For You</h2>
                  {recMeta?.based_on && (
                    <p className="text-xs text-gray-500 mt-0.5">{recMeta.based_on}</p>
                  )}
                </div>
              </div>
              <button
                onClick={loadRecommended}
                className="text-xs text-primary hover:text-secondary font-semibold transition"
              >
                ↺ Refresh
              </button>
            </div>

            {recLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="shrink-0 w-64 h-40 bg-white rounded-2xl shadow animate-pulse" />
                ))}
              </div>
            ) : recommended.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                {recommended.map((job) => (
                  <div
                    key={job.id}
                    className={`snap-start shrink-0 w-64 text-left bg-white rounded-2xl shadow-md hover:shadow-lg border-2 transition-all duration-200 p-5 flex flex-col justify-between hover:-translate-y-0.5 ${
                      selectedJob?.id === job.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent'
                    }`}
                  >
                    <button className="text-left" onClick={() => handleJobSelect(job)}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-primary/10 to-secondary/10 text-primary uppercase tracking-wide">
                          {job.source || 'job'}
                        </span>
                        {selectedJob?.id === job.id && (
                          <span className="text-primary text-xs font-bold">Selected ✓</span>
                        )}
                      </div>
                      <div className="mb-3">
                        <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">{job.title}</p>
                        <p className="text-xs text-gray-600 font-medium">{job.company}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {job.location && (
                          <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            📍 {job.location}
                          </span>
                        )}
                        {job.salary_range && (
                          <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            💰 {job.salary_range}
                          </span>
                        )}
                      </div>
                    </button>
                    {/* Track button on recommended card */}
                    <button
                      onClick={(e) => handleTrackJob(e, job)}
                      disabled={trackedIds.has(job.id) || trackingId === job.id}
                      className={`w-full text-xs font-bold py-1.5 rounded-lg transition-all ${
                        trackedIds.has(job.id)
                          ? 'bg-emerald-50 text-emerald-600 cursor-default'
                          : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                      }`}
                    >
                      {trackedIds.has(job.id)
                        ? '✓ Tracked'
                        : trackingId === job.id
                        ? 'Saving…'
                        : '📌 Track'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                <p className="text-2xl mb-2">📄</p>
                <p className="text-gray-600 font-semibold text-sm">Upload your CV to get personalized recommendations</p>
                <p className="text-gray-400 text-xs mt-1">We'll match jobs to your detected job title automatically.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Main Grid: Jobs List + Detail Panel ─────────────────── */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Jobs List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4 pb-3 border-b border-gray-200">
                {searchQuery ? `Results (${jobs.length})` : `All Jobs (${jobs.length})`}
              </h2>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <p className="text-gray-500 py-8 text-center text-sm">
                  {searchQuery ? `No results for "${searchQuery}"` : 'No jobs available'}
                </p>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className={`group w-full text-left p-4 rounded-xl transition border-2 ${
                        selectedJob?.id === job.id
                          ? 'border-primary bg-accent'
                          : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      {/* Clickable area = select the job */}
                      <button
                        className="w-full text-left"
                        onClick={() => handleJobSelect(job)}
                      >
                        <p className="font-semibold text-gray-900 text-sm">{job.title}</p>
                        <p className="text-xs text-gray-600">{job.company}</p>
                        {job.location && (
                          <p className="text-xs text-gray-400 mt-0.5">📍 {job.location}</p>
                        )}
                        {job.salary_range && (
                          <p className="text-xs text-primary mt-1">{job.salary_range}</p>
                        )}
                      </button>

                      {/* Per-card Track button */}
                      <button
                        onClick={(e) => handleTrackJob(e, job)}
                        disabled={trackedIds.has(job.id) || trackingId === job.id}
                        className={`mt-2 w-full text-[11px] font-bold py-1 rounded-lg transition-all ${
                          trackedIds.has(job.id)
                            ? 'bg-emerald-50 text-emerald-600 cursor-default'
                            : 'bg-gray-100 text-gray-500 hover:bg-primary hover:text-white group-hover:opacity-100'
                        }`}
                      >
                        {trackedIds.has(job.id)
                          ? '✓ Tracked'
                          : trackingId === job.id
                          ? 'Saving…'
                          : '📌 Track'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => loadJobs(searchQuery)}
                className="w-full mt-4 text-sm text-primary hover:text-secondary font-semibold"
              >
                ↺ Refresh Jobs
              </button>
            </div>
          </div>

          {/* Job Details & Gap Analysis */}
          <div className="lg:col-span-2">
            {selectedJob ? (
              <div className="space-y-6">
                {/* Job Details Card */}
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex items-start justify-between mb-6 gap-4">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900">{selectedJob.title}</h3>
                      <p className="text-xl text-primary mt-1">{selectedJob.company}</p>
                    </div>
                    <button
                      onClick={handleSaveToTracker}
                      disabled={saving || saveSuccess || trackedIds.has(selectedJob.id)}
                      className={`shrink-0 flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                        saveSuccess || trackedIds.has(selectedJob.id)
                          ? 'bg-emerald-500 text-white shadow-green-200'
                          : 'bg-primary text-white hover:bg-secondary shadow-indigo-100'
                      } disabled:opacity-70`}
                    >
                      {saving
                        ? 'Saving…'
                        : saveSuccess || trackedIds.has(selectedJob.id)
                        ? '✓ Tracked'
                        : '📌 Save to Tracker'}
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {selectedJob.location && (
                      <div className="p-4 bg-light rounded-lg">
                        <p className="text-sm text-gray-600">Location</p>
                        <p className="font-semibold">{selectedJob.location}</p>
                      </div>
                    )}
                    {selectedJob.salary_range && (
                      <div className="p-4 bg-accent rounded-lg">
                        <p className="text-sm text-gray-600">Salary Range</p>
                        <p className="font-semibold">{selectedJob.salary_range}</p>
                      </div>
                    )}
                    {selectedJob.job_type && (
                      <div className="p-4 bg-secondary rounded-lg">
                        <p className="text-sm text-white">Job Type</p>
                        <p className="font-semibold text-white">{selectedJob.job_type}</p>
                      </div>
                    )}
                    {selectedJob.experience && (
                      <div className="p-4 bg-gray-100 rounded-lg">
                        <p className="text-sm text-gray-600">Experience</p>
                        <p className="font-semibold">{selectedJob.experience}</p>
                      </div>
                    )}
                  </div>

                  {selectedJob.url && (
                    <a
                      href={selectedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mb-4 text-sm text-primary hover:text-secondary font-semibold transition"
                    >
                      🔗 View Original Job Posting ↗
                    </a>
                  )}

                  {selectedJob.description && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Description</h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {selectedJob.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Gap Analysis */}
                {analyzing ? (
                  <LoadingSpinner message="Analyzing skill gaps…" />
                ) : gapAnalysis ? (
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Gap Analysis</h3>

                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                      <div className="p-6 bg-green-50 border-2 border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 font-semibold mb-2">Matched Skills</p>
                        <p className="text-3xl font-bold text-green-600">
                          {gapAnalysis.analysis?.matched_skills_count ?? gapAnalysis.matched_skills?.length ?? 0}
                        </p>
                      </div>
                      <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-700 font-semibold mb-2">Missing Skills</p>
                        <p className="text-3xl font-bold text-amber-600">
                          {gapAnalysis.analysis?.missing_skills_count ?? gapAnalysis.missing_skills?.length ?? 0}
                        </p>
                      </div>
                      <div className="p-6 bg-accent border-2 border-secondary rounded-lg">
                        <p className="text-sm text-secondary font-semibold mb-2">Match %</p>
                        <p className="text-3xl font-bold text-secondary">
                          {gapAnalysis.analysis?.match_percentage ?? gapAnalysis.match_percentage ?? '0'}%
                        </p>
                      </div>
                    </div>

                    {(gapAnalysis.analysis?.matched_skills || gapAnalysis.matched_skills)?.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-semibold text-gray-900 mb-3">Your Matching Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {(gapAnalysis.analysis?.matched_skills || gapAnalysis.matched_skills).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium"
                            >
                              {typeof skill === 'object' ? skill.name : skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(gapAnalysis.analysis?.missing_skills || gapAnalysis.missing_skills)?.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-semibold text-gray-900 mb-3">Skills to Acquire</h4>
                        <div className="flex flex-wrap gap-2">
                          {(gapAnalysis.analysis?.missing_skills || gapAnalysis.missing_skills).map((skill, idx) => (
                            <a
                              key={idx}
                              href={`https://www.coursera.org/search?query=${encodeURIComponent(typeof skill === 'object' ? skill.name : skill)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium hover:bg-amber-200 transition flex items-center gap-1"
                              title="Search courses for this skill"
                            >
                              {typeof skill === 'object' ? skill.name : skill}
                              <span className="text-[10px]">↗</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleViewFullAnalysis(selectedJob.id)}
                      className="w-full mt-6 bg-primary text-white py-2 rounded-lg hover:bg-secondary transition font-semibold"
                    >
                      View Full Analysis
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-16 text-center">
                <p className="text-4xl mb-4">💼</p>
                <p className="text-gray-400 text-lg font-medium">Select a job to view details and gap analysis</p>
                <p className="text-gray-300 text-sm mt-2">Click any job card on the left to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
