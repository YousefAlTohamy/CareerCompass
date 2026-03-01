import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI, gapAnalysisAPI } from '../api/endpoints';
import applicationsAPI from '../api/applications';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Jobs() {
  const navigate = useNavigate();

  // All jobs
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Recommended jobs
  const [recommended, setRecommended] = useState([]);
  const [recMeta, setRecMeta] = useState(null);      // { based_on, total }
  const [recLoading, setRecLoading] = useState(true);

  // Selected job + gap analysis
  const [selectedJob, setSelectedJob] = useState(null);
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadJobs();
    loadRecommended();
  }, []);

  /* ─── Data fetching ────────────────────────────────────────────── */

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await jobsAPI.getJobs();
      const jobsData = Array.isArray(response.data)
        ? response.data
        : response.data.data || [];
      setJobs(jobsData);
      if (jobsData.length === 0) {
        setError('No jobs available at the moment. Please check back later.');
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
      setGapAnalysis(response.data.data || response.data);
    } catch (err) {
      console.error('Failed to analyze job gap:', err);
      setError(err.response?.data?.message || 'Failed to analyze job gap. Please try again.');
      setGapAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  };

  /* ─── Handlers ─────────────────────────────────────────────────── */

  const handleJobSelect = (job) => {
    setSelectedJob(job);
    setSaveSuccess(false);
    analyzeJobGap(job.id);
  };
  
  const handleSaveToTracker = async () => {
    if (!selectedJob) return;
    try {
      setSaving(true);
      await applicationsAPI.saveJob({ job_id: selectedJob.id, status: 'saved' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save to tracker:', err);
      setError('Could not save to tracker. It might already be there.');
    } finally {
      setSaving(false);
    }
  };

  const handleViewFullAnalysis = (jobId) => {
    navigate(`/gap-analysis/${jobId}`);
  };

  /* ─── Loading ──────────────────────────────────────────────────── */

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading job opportunities..." />;
  }

  /* ─── Render ───────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-light py-12 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Job Opportunities</h1>
          <p className="text-gray-600">Browse jobs and analyze skill gaps</p>
        </div>

        {/* Error Alert */}
        {error && (
          <ErrorAlert title="Error" message={error} onClose={() => setError('')} />
        )}

        {/* ── Recommended For You ─────────────────────────────────────── */}
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
                <button
                  key={job.id}
                  onClick={() => handleJobSelect(job)}
                  className={`snap-start shrink-0 w-64 text-left bg-white rounded-2xl shadow-md hover:shadow-lg border-2 transition-all duration-200 p-5 flex flex-col justify-between hover:-translate-y-0.5 ${
                    selectedJob?.id === job.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent'
                  }`}
                >
                  {/* Source badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-primary/10 to-secondary/10 text-primary uppercase tracking-wide">
                      {job.source || 'job'}
                    </span>
                    {selectedJob?.id === job.id && (
                      <span className="text-primary text-xs font-bold">Selected ✓</span>
                    )}
                  </div>

                  {/* Title + Company */}
                  <div className="mb-3">
                    <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">
                      {job.title}
                    </p>
                    <p className="text-xs text-gray-600 font-medium">{job.company}</p>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-1">
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

        {/* ── Main Grid: Jobs List + Detail Panel ─────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Jobs List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4 pb-3 border-b border-gray-200">
                Available Jobs ({jobs.length})
              </h2>
              {jobs.length === 0 ? (
                <p className="text-gray-600 py-8 text-center">No jobs available</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => handleJobSelect(job)}
                      className={`w-full text-left p-4 rounded-lg transition border-2 ${
                        selectedJob?.id === job.id
                          ? 'border-primary bg-accent'
                          : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-semibold text-gray-900 text-sm">{job.title}</p>
                      <p className="text-xs text-gray-600">{job.company}</p>
                      {job.salary_range && (
                        <p className="text-xs text-primary mt-1">{job.salary_range}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={loadJobs}
                className="w-full mt-4 text-sm text-primary hover:text-secondary font-semibold"
              >
                Refresh Jobs
              </button>
            </div>
          </div>

          {/* Job Details & Gap Analysis */}
          <div className="lg:col-span-2">
            {selectedJob ? (
              <div className="space-y-6">
                {/* Job Details */}
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900">{selectedJob.title}</h3>
                      <p className="text-xl text-primary mt-1">{selectedJob.company}</p>
                    </div>
                    <button
                      onClick={handleSaveToTracker}
                      disabled={saving || saveSuccess}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                        saveSuccess 
                          ? 'bg-green-500 text-white shadow-green-200' 
                          : 'bg-primary text-white hover:bg-secondary shadow-indigo-100 hover:shadow-premium'
                      } disabled:opacity-70`}
                    >
                       {saving ? 'Saving...' : saveSuccess ? '✓ Saved' : 'Save to Tracker'}
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
                  <LoadingSpinner message="Analyzing skill gaps..." />
                ) : gapAnalysis ? (
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Gap Analysis</h3>

                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                      <div className="p-6 bg-green-50 border-2 border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 font-semibold mb-2">Matched Skills</p>
                        <p className="text-3xl font-bold text-green-600">
                          {gapAnalysis.analysis?.matched_skills_count || gapAnalysis.matched_skills?.length || 0}
                        </p>
                      </div>
                      <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-700 font-semibold mb-2">Missing Skills</p>
                        <p className="text-3xl font-bold text-amber-600">
                          {gapAnalysis.analysis?.missing_skills_count || gapAnalysis.missing_skills?.length || 0}
                        </p>
                      </div>
                      <div className="p-6 bg-accent border-2 border-secondary rounded-lg">
                        <p className="text-sm text-secondary font-semibold mb-2">Match %</p>
                        <p className="text-3xl font-bold text-secondary">
                          {gapAnalysis.analysis?.match_percentage || gapAnalysis.match_percentage || '0'}%
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
                <p className="text-gray-400 text-lg">Select a job to view details and gap analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
