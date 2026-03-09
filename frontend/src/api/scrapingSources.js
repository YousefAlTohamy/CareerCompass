import apiClient from './client';

const BASE_URL = '/admin/scraping-sources';

export const getAllSources = async (page = 1, search = '') => {
    const response = await apiClient.get(`${BASE_URL}?page=${page}&search=${encodeURIComponent(search)}`);
    return response.data;
};

export const createSource = async (data) => {
    const response = await apiClient.post(BASE_URL, data);
    return response.data;
};

export const updateSource = async (id, data) => {
    const response = await apiClient.put(`${BASE_URL}/${id}`, data);
    return response.data;
};

export const deleteSource = async (id) => {
    await apiClient.delete(`${BASE_URL}/${id}`);
};

export const toggleSourceStatus = async (id) => {
    const response = await apiClient.patch(`${BASE_URL}/${id}/toggle`);
    return response.data;
};

export const testSources = async () => {
    const response = await apiClient.post(`${BASE_URL}/test`, {}, { timeout: 120000 });
    return response.data;
};

// Target Job Roles
const ROLES_URL = '/admin/target-roles';

export const getTargetRoles = async (page = 1, search = '') => {
    const response = await apiClient.get(`${ROLES_URL}?page=${page}&search=${encodeURIComponent(search)}`);
    return response.data;
};

export const addTargetRole = async (data) => {
    const response = await apiClient.post(ROLES_URL, data);
    return response.data;
};

export const toggleTargetRole = async (id) => {
    const response = await apiClient.patch(`${ROLES_URL}/${id}/toggle`);
    return response.data;
};

export const deleteTargetRole = async (id) => {
    const response = await apiClient.delete(`${ROLES_URL}/${id}`);
    return response.data;
};

export const runFullScraping = async () => {
    const response = await apiClient.post('/admin/scraping/run-full', {}, { timeout: 120000 });
    return response.data;
};
