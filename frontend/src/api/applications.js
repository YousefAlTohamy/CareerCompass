import client from './client';

const applicationsAPI = {
  /**
   * Get all user applications
   */
  getApplications: () => client.get('/applications'),

  /**
   * Get a single application
   */
  getApplication: (id) => client.get(`/applications/${id}`),

  /**
   * Create application (Save / Track a job by job_id)
   */
  saveJob: (data) => client.post('/applications', data),

  /**
   * Convenience alias: track a job by its ID with default status 'saved'.
   * Calls saveJob so the backend's updateOrCreate deduplicates safely.
   */
  trackApplication: (jobId) =>
    client.post('/applications', { job_id: jobId, status: 'saved' }),

  /**
   * Update application status or notes (PATCH - matches Laravel apiResource)
   */
  updateApplication: (id, data) => client.patch(`/applications/${id}`, data),

  /**
   * Convenience alias for status-only updates.
   */
  updateApplicationStatus: (id, status) =>
    client.patch(`/applications/${id}`, { status }),

  /**
   * Remove application from tracker
   */
  removeApplication: (id) => client.delete(`/applications/${id}`),

  /**
   * Convenience alias for deletion.
   */
  deleteApplication: (id) => client.delete(`/applications/${id}`),
};

export default applicationsAPI;
