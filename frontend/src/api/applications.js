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
   * Create/Update application (Save job)
   */
  saveJob: (data) => client.post('/applications', data),

  /**
   * Update application status or notes
   */
  updateApplication: (id, data) => client.put(`/applications/${id}`, data),

  /**
   * Remove application from tracker
   */
  removeApplication: (id) => client.delete(`/applications/${id}`),
};

export default applicationsAPI;
