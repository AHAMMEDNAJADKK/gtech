// Calendar Work Service
// Handles all API calls to the backend calendar-work endpoints

const baseUrl = () => (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const headers = () => {
  const raw = localStorage.getItem('token') || '';
  const token = raw.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const isFormDataBody = (body) => typeof FormData !== 'undefined' && body instanceof FormData;

const request = async (path, options = {}) => {
  const url = `${baseUrl()}/v1/calendar-work/${path}`;
  const formData = isFormDataBody(options.body);

  const mergedHeaders = {
    ...headers(),
    ...(options.headers || {})
  };

  if (formData) {
    delete mergedHeaders['Content-Type'];
    delete mergedHeaders['content-type'];
  } else if (!mergedHeaders['Content-Type'] && !mergedHeaders['content-type']) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: mergedHeaders
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message || 'Calendar work request failed');
    error.response = { status: response.status, data: body };
    throw error;
  }

  return body;
};

const appendFormValue = (formData, key, value) => {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    formData.append(key, JSON.stringify(value));
    return;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    formData.append(key, String(value));
    return;
  }
  formData.append(key, value);
};

/**
 * Build a multipart payload when an image file is present.
 * Uses field name `image` to match upload.single('image') on the backend.
 */
export const toCalendarWorkFormData = (data = {}, imageFile = null) => {
  const formData = data instanceof FormData ? data : new FormData();

  if (!(data instanceof FormData) && data && typeof data === 'object') {
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'image' || key === 'imageFile') return;
      appendFormValue(formData, key, value);
    });
  }

  const file = imageFile || data?.imageFile || data?.image;
  if (file instanceof File || file instanceof Blob) {
    formData.append('image', file);
  }

  return formData;
};

/**
 * Resolve stored imageUrl values to a browser-loadable URL.
 */
export const resolveCalendarImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  const value = String(imageUrl).trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  const api = baseUrl();
  const origin = api.replace(/\/api(?:\/v1)?$/i, '');
  const path = value.startsWith('/') ? value : `/${value}`;
  return origin ? `${origin}${path}` : path;
};

/**
 * Get all calendar work items with optional filters
 * @param {Object} filters - { workStatus, postingStatus, assignedTo, contentType, startDate, endDate, limit, skip }
 * @returns {Promise<Object>} - { success, data: { items, total, limit, skip, pages }, message }
 */
export const getCalendarWorks = (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.workStatus) params.append('workStatus', filters.workStatus);
  if (filters.postingStatus) params.append('postingStatus', filters.postingStatus);
  if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
  if (filters.contentType) params.append('contentType', filters.contentType);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.skip) params.append('skip', filters.skip || 0);
  if (filters.department) params.append('department', filters.department);

  const queryString = params.toString();
  const path = queryString ? `?${queryString}` : '';

  return request(path);
};

/**
 * Get calendar work items assigned to the current user
 * @param {Object} filters - { workStatus, postingStatus, limit, skip }
 * @returns {Promise<Object>}
 */
export const getMyCalendarWork = (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.workStatus) params.append('workStatus', filters.workStatus);
  if (filters.postingStatus) params.append('postingStatus', filters.postingStatus);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.skip) params.append('skip', filters.skip || 0);

  const queryString = params.toString();
  const path = queryString ? `my-work?${queryString}` : 'my-work';

  return request(path);
};

/**
 * Get a single calendar work item by ID
 * @param {String} id - Calendar work item ID
 * @returns {Promise<Object>}
 */
export const getCalendarWorkById = (id) => {
  return request(`${id}`);
};

/**
 * Create a new calendar work item
 * @param {Object|FormData} data - Calendar work data or multipart FormData
 * @returns {Promise<Object>}
 */
export const createCalendarWork = (data) => {
  const hasImageFile = Boolean(data?.imageFile || data?.image instanceof File || data?.image instanceof Blob);
  const body = data instanceof FormData || hasImageFile
    ? toCalendarWorkFormData(data, data?.imageFile || data?.image)
    : JSON.stringify(data);

  return request('', {
    method: 'POST',
    body
  });
};

/**
 * Update a calendar work item
 * @param {String} id - Calendar work item ID
 * @param {Object|FormData} data - Updated data or multipart FormData
 * @returns {Promise<Object>}
 */
export const updateCalendarWork = (id, data) => {
  const hasImageFile = Boolean(data?.imageFile || data?.image instanceof File || data?.image instanceof Blob);
  const body = data instanceof FormData || hasImageFile
    ? toCalendarWorkFormData(data, data?.imageFile || data?.image)
    : JSON.stringify(data);

  return request(`${id}`, {
    method: 'PUT',
    body
  });
};

/**
 * Update work status of a calendar work item
 * Immediate PATCH to /api/calendar-work/:id/status
 * @param {String} id - Calendar work item ID
 * @param {Object} data - { status, notes }
 * @returns {Promise<Object>}
 */
export const updateWorkStatus = (id, data) => {
  const payload = typeof data === 'string' ? { status: data } : data;
  return request(`${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
};

/**
 * Update posting status of a calendar work item
 * @param {String} id - Calendar work item ID
 * @param {Object} data - { status, actualPostTime, socialMediaLinks, notes }
 * @returns {Promise<Object>}
 */
export const updatePostingStatus = (id, data) => {
  return request(`${id}/posting-status`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
};

/**
 * Delete a calendar work item
 * @param {String} id - Calendar work item ID
 * @returns {Promise<Object>}
 */
export const deleteCalendarWork = (id) => {
  return request(`${id}`, {
    method: 'DELETE'
  });
};

export const fetchContentTypes = () => {
  return request('content-types', { method: 'GET' });
};

export const createContentTypeApi = (data) => {
  return request('content-types', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const updateContentTypeApi = (id, data) => {
  return request(`content-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const deleteContentTypeApi = (id) => {
  return request(`content-types/${id}`, {
    method: 'DELETE'
  });
};

export default {
  getCalendarWorks,
  getMyCalendarWork,
  getCalendarWorkById,
  createCalendarWork,
  updateCalendarWork,
  updateWorkStatus,
  updatePostingStatus,
  deleteCalendarWork,
  fetchContentTypes,
  createContentTypeApi,
  updateContentTypeApi,
  deleteContentTypeApi,
  resolveCalendarImageUrl,
  toCalendarWorkFormData
};
