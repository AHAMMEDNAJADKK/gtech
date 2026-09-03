import axios from 'axios';

const getBaseUrl = () => {
  let envUrl = import.meta.env?.VITE_API_URL || import.meta.env?.REACT_APP_API_URL || '/api';
  envUrl = envUrl.replace(/\/+$/, '');
  
  if (envUrl.endsWith('/v1')) {
    return `${envUrl}/accounts`;
  }
  return `${envUrl}/v1/accounts`;
};

const getFallbackUrl = () => {
  let envUrl = import.meta.env?.VITE_API_URL || import.meta.env?.REACT_APP_API_URL || '/api';
  envUrl = envUrl.replace(/\/+$/, '');
  return `${envUrl}/accounts`;
};

const getAuthHeaders = (isMultipart = false) => {
  let token = localStorage.getItem('token') || '';
  token = token.replace(/^"(.*)"$/, '$1').trim();
  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }
  const headers = {
    'Authorization': `Bearer ${token}`
  };
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return { headers };
};

// Helper for resilient GET request trying primary then fallback path if 404 occurs
const safeGet = async (endpoint, params = {}) => {
  const headersObj = getAuthHeaders();
  try {
    const primaryUrl = `${getBaseUrl()}${endpoint}`;
    return await axios.get(primaryUrl, { ...headersObj, params });
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const fallbackUrl = `${getFallbackUrl()}${endpoint}`;
      return await axios.get(fallbackUrl, { ...headersObj, params });
    }
    throw err;
  }
};

// Helper for resilient POST request
const safePost = async (endpoint, data, isMultipart = false) => {
  const headersObj = getAuthHeaders(isMultipart);
  try {
    const primaryUrl = `${getBaseUrl()}${endpoint}`;
    return await axios.post(primaryUrl, data, headersObj);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const fallbackUrl = `${getFallbackUrl()}${endpoint}`;
      return await axios.post(fallbackUrl, data, headersObj);
    }
    throw err;
  }
};

// Helper for resilient PUT request
const safePut = async (endpoint, data, isMultipart = false) => {
  const headersObj = getAuthHeaders(isMultipart);
  try {
    const primaryUrl = `${getBaseUrl()}${endpoint}`;
    return await axios.put(primaryUrl, data, headersObj);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const fallbackUrl = `${getFallbackUrl()}${endpoint}`;
      return await axios.put(fallbackUrl, data, headersObj);
    }
    throw err;
  }
};

// Helper for resilient DELETE request
const safeDelete = async (endpoint) => {
  const headersObj = getAuthHeaders();
  try {
    const primaryUrl = `${getBaseUrl()}${endpoint}`;
    return await axios.delete(primaryUrl, headersObj);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const fallbackUrl = `${getFallbackUrl()}${endpoint}`;
      return await axios.delete(fallbackUrl, headersObj);
    }
    throw err;
  }
};

// ── Categories Service ──
export const getExpenseCategories = async () => {
  const response = await safeGet('/categories');
  return response.data;
};

export const createExpenseCategory = async (data) => {
  const response = await safePost('/categories', data);
  return response.data;
};

export const updateExpenseCategory = async (id, data) => {
  const response = await safePut(`/categories/${id}`, data);
  return response.data;
};

export const updateBatchCategoryOpeningBalances = async (balances) => {
  const response = await safePut('/categories/batch/opening-balances', { balances });
  return response.data;
};

export const deleteExpenseCategory = async (id) => {
  const response = await safeDelete(`/categories/${id}`);
  return response.data;
};

// ── Expenses Service ──
export const getExpenses = async (params = {}) => {
  const response = await safeGet('/expenses', params);
  return response.data;
};

export const createExpense = async (formData) => {
  const isMultipart = typeof FormData !== 'undefined' && formData instanceof FormData;
  const response = await safePost('/expenses', formData, isMultipart);
  return response.data;
};

export const updateExpense = async (id, formData) => {
  const isMultipart = typeof FormData !== 'undefined' && formData instanceof FormData;
  const response = await safePut(`/expenses/${id}`, formData, isMultipart);
  return response.data;
};

export const deleteExpense = async (id) => {
  const response = await safeDelete(`/expenses/${id}`);
  return response.data;
};

export const approveOrRejectExpense = async (id, data) => {
  const response = await safePut(`/expenses/${id}/action`, data);
  return response.data;
};

// ── Salary Payments Service ──
export const getSalaryPayments = async (params = {}) => {
  const response = await safeGet('/salary-payments', params);
  return response.data;
};

export const createSalaryPayment = async (data) => {
  const response = await safePost('/salary-payments', data);
  return response.data;
};

export const updateSalaryPayment = async (id, data) => {
  const response = await safePut(`/salary-payments/${id}`, data);
  return response.data;
};

export const approveOrRejectSalaryPayment = async (id, data) => {
  const response = await safePut(`/salary-payments/${id}/action`, data);
  return response.data;
};

export const approveAllSalaryPayments = async () => {
  const response = await safePut('/salary-payments/approve-all', {});
  return response.data;
};

export const deleteSalaryPayment = async (id) => {
  const response = await safeDelete(`/salary-payments/${id}`);
  return response.data;
};

export const sendSalaryPayslipEmail = async (id, data = {}) => {
  const response = await safePost(`/salary-payments/${id}/send-email`, data);
  return response.data;
};

// ── Cash Book Service ──
export const getCashBook = async (params = {}) => {
  const response = await safeGet('/cash-book', params);
  return response.data;
};

// ── Reports Service ──
export const getDailyReport = async (params = {}) => {
  const response = await safeGet('/reports/daily', params);
  return response.data;
};

export const getMonthlyReport = async (params = {}) => {
  const response = await safeGet('/reports/monthly', params);
  return response.data;
};

export const getCategoryWiseReport = async (params = {}) => {
  const response = await safeGet('/reports/category-wise', params);
  return response.data;
};

export const getSalaryReport = async (params = {}) => {
  const response = await safeGet('/reports/salary', params);
  return response.data;
};

// ── Opening Balance Service ──
export const getOpeningBalance = async () => {
  const response = await safeGet('/opening-balance');
  return response.data;
};

export const setOpeningBalance = async (data) => {
  const response = await safePost('/opening-balance', data);
  return response.data;
};

// ── Payment Settlement Logs Service ──
export const updatePaymentSettlement = async (incomeId, paymentId, data) => {
  const response = await safePut(`/income/${incomeId}/payments/${paymentId}`, data);
  return response.data;
};

export const deletePaymentSettlement = async (incomeId, paymentId) => {
  const response = await safeDelete(`/income/${incomeId}/payments/${paymentId}`);
  return response.data;
};
