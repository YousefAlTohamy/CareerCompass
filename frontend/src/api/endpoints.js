import apiClient from './client';
import applicationsAPI from './applications';

export const authAPI = {
  register: (data) => apiClient.post('/register', data),
  login: (data) => apiClient.post('/login', data),
  logout: () => apiClient.post('/logout'),
  getUser: () => apiClient.get('/user'),
  updateProfile: (data) => apiClient.put('/user/profile', data),
};

export const jobsAPI = {
  /**
   * Fetch jobs, optionally with search/filter params.
   * @param {Object} params - e.g. { search: 'React' } or { recommended: 1 }
   */
  getJobs: (params = {}) => apiClient.get('/jobs', { params }),
  getJobById: (id) => apiClient.get(`/jobs/${id}`),
  getRecommendedJobs: () => apiClient.get('/jobs/recommended'),
  scrapeJobs: () => apiClient.post('/jobs/scrape'),
  // On-Demand Scraping
  scrapeJobIfMissing: (jobTitle, maxResults = 30) =>
    apiClient.post('/jobs/scrape-if-missing', { job_title: jobTitle, max_results: maxResults }),
  checkScrapingStatus: (jobId) => apiClient.get(`/scraping-status/${jobId}`),
};

export const cvAPI = {
  uploadCV: (formData) => apiClient.post('/upload-cv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getUserSkills: () => apiClient.get('/user/skills'),
  removeSkill: (skillId) => apiClient.delete(`/user/skills/${skillId}`),
};

export const gapAnalysisAPI = {
  analyzeJob: (jobId) => apiClient.get(`/gap-analysis/job/${jobId}`),
  analyzeMultipleJobs: (jobIds) => apiClient.post('/gap-analysis/batch', { job_ids: jobIds }),
  getRecommendations: () => apiClient.get('/gap-analysis/recommendations'),
};

// Market Intelligence API
export const marketIntelligenceAPI = {
  getOverview: () => apiClient.get('/market/overview'),
  getRoleStatistics: (roleTitle) => apiClient.get(`/market/role-statistics/${encodeURIComponent(roleTitle)}`),
  getTrendingSkills: (limit = 20, type = null) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (type) params.append('type', type);
    return apiClient.get(`/market/trending-skills?${params.toString()}`);
  },
  getSkillDemand: (roleTitle) => apiClient.get(`/market/skill-demand/${encodeURIComponent(roleTitle)}`),
};

// ── Application Tracker convenience re-exports ──────────────────────────────
// These named exports allow other files to import directly from 'endpoints.js'
export const getApplications = () => applicationsAPI.getApplications();
export const trackApplication = (jobId) => applicationsAPI.trackApplication(jobId);
export const updateApplicationStatus = (id, status) => applicationsAPI.updateApplicationStatus(id, status);
export const deleteApplication = (id) => applicationsAPI.deleteApplication(id);

// Admin API
export const adminAPI = {
  getAdminDashboardStats: () => apiClient.get('/admin/dashboard/stats'),
};
