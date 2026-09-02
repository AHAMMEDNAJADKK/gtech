// src/services/departmentService.js

import axios from 'axios';
import { PDFDocument } from 'pdf-lib';

// Get base URL from environment or default to local development port
const RAW_API_URL = import.meta.env?.VITE_API_URL || import.meta.env?.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_URL = RAW_API_URL.replace(/\/v1\/?$/, '').replace(/\/+$/, '');

// Create dedicated Axios instance for departments
const departmentApi = axios.create({
  baseURL: `${API_URL}/v1/departments`,
});

// Request interceptor to automatically attach authorization header
departmentApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to extract `{ success, message, data }` response shape
departmentApi.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // Standardize error formats for forms and alerts
    const parsedError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      statusCode: error.response?.status || 500,
      errors: error.response?.data?.data || null // For field-level validation errors
    };
    return Promise.reject(parsedError);
  }
);

// Named exports for all API endpoints

/**
 * Fetch all departments
 * @param {Object} params - Query params (?status=true|false&search=name|code)
 */
export const getAllDepartments = (params) => {
  return departmentApi.get('/', { params });
};

/**
 * Get single department details
 * @param {String} id - Department ID
 */
export const getDepartmentById = (id) => {
  return departmentApi.get(`/${id}`);
};

/**
 * Create a new department
 * @param {Object} data - { name, code, description, managerId, status }
 */
export const createDepartment = (data) => {
  return departmentApi.post('/create', data);
};

/**
 * Update existing department
 * @param {Object} data - { id, name, code, description, managerId, status }
 */
export const updateDepartment = (data) => {
  return departmentApi.put('/update', data);
};

/**
 * Delete a department
 * @param {String} id - Department ID
 */
export const deleteDepartment = (id) => {
  return departmentApi.delete(`/${id}`);
};

/**
 * Assign department manager
 * @param {String} id - Department ID
 * @param {String} managerId - User ID of manager
 */
export const assignManager = (id, managerId) => {
  return departmentApi.put(`/${id}/manager`, { managerId });
};

/**
 * Fetch users in department
 * @param {String} id - Department ID
 */
export const getDepartmentUsers = (id) => {
  return departmentApi.get(`/${id}/users`);
};

/**
 * Toggle department status
 * @param {String} id - Department ID
 * @param {Boolean} status - Target status (true = active, false = inactive)
 */
export const updateDepartmentStatus = (id, status) => {
  return departmentApi.patch(`/${id}/status`, { status });
};

/**
 * Fetch department analytics
 * @param {String} id - Department ID
 */
export const getDepartmentAnalytics = (id) => {
  return departmentApi.get(`/${id}/analytics`);
};

/**
 * Add a user to a department
 * @param {String} departmentId - Department ID
 * @param {String} userId - User ID
 * @param {String} roleInDepartment - User role (e.g. member)
 * @param {Boolean} isPrimary - Whether department is primary for user
 */
export const addUserToDepartment = (departmentId, userId, roleInDepartment = 'member', isPrimary = true) => {
  return departmentApi.post(`/${departmentId}/users`, { userId, roleInDepartment, isPrimary });
};

/**
 * Remove a user from a department
 * @param {String} departmentId - Department ID
 * @param {String} userId - User ID
 */
export const removeUserFromDepartment = (departmentId, userId) => {
  return departmentApi.delete(`/${departmentId}/users/${userId}`);
};

/**
 * Get PDF reports list uploaded for a user with sorting
 */
export const getPDFReportsByUser = (userId, sort = 'newest') => {
  return departmentApi.get(`${API_URL}/v1/employee-reports/list?userId=${userId}&sort=${sort}`);
};

/**
 * Compress a PDF Blob using pdf-lib (re-serializes with compression).
 * Returns a compressed Blob, or original if compression fails.
 */
const compressPdfBlob = async (pdfBlob) => {
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const compressedBytes = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false });
    const compressedBlob = new Blob([compressedBytes], { type: 'application/pdf' });
    const originalMB = (pdfBlob.size / 1024 / 1024).toFixed(2);
    const compressedMB = (compressedBlob.size / 1024 / 1024).toFixed(2);
    // Use compressed only if it's actually smaller
    return compressedBlob.size < pdfBlob.size ? compressedBlob : pdfBlob;
  } catch (err) {
    console.warn('[PDF Compress] Compression failed, using original:', err.message);
    return pdfBlob;
  }
};

/**
 * Upload compiled PDF report (weekly/monthly) to server.
 * Automatically compresses the PDF before uploading.
 */
export const uploadCompiledPDFReport = async (userId, reportDate, pdfBlob, filename, reportType, reportPeriod) => {
  const token = localStorage.getItem('token');
  const cleanToken = token ? token.replace(/"/g, '') : '';
  const headers = {
    'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
  };

  // Compress the PDF before uploading to stay under Cloudinary's size limit
  const compressedBlob = await compressPdfBlob(pdfBlob);

  const fd = new FormData();
  fd.append('pdfFile', compressedBlob, filename);
  fd.append('userId', userId);
  fd.append('reportDate', reportDate);
  fd.append('reportType', reportType);
  fd.append('reportPeriod', reportPeriod);

  return axios.post(`${API_URL}/v1/employee-reports/upload`, fd, { headers });
};

export default {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  assignManager,
  getDepartmentUsers,
  updateDepartmentStatus,
  getDepartmentAnalytics,
  addUserToDepartment,
  removeUserFromDepartment,
  getPDFReportsByUser,
  uploadCompiledPDFReport
};

