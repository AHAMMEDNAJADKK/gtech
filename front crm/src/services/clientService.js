import axios from 'axios';

const getBaseUrl = () => {
  const host = import.meta.env.VITE_API_URL || '/api';
  return `${host.replace(/\/+$/, '')}/v1/clients`;
};

const getAuthHeaders = () => {
  let token = localStorage.getItem('token') || '';
  token = token.replace(/^"(.*)"$/, '$1').trim();
  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
};

export const getClients = async (params = {}) => {
  const response = await axios.get(getBaseUrl(), {
    ...getAuthHeaders(),
    params
  });
  return response.data;
};

export const getClientById = async (id) => {
  if (!id || id === 'undefined' || id === 'null') {
    return { success: false, message: 'Client ID is missing or invalid' };
  }
  const response = await axios.get(`${getBaseUrl()}/${id}`, getAuthHeaders());
  return response.data;
};

export const createClient = async (clientData) => {
  const response = await axios.post(getBaseUrl(), clientData, getAuthHeaders());
  return response.data;
};

export const updateClient = async (id, clientData) => {
  const response = await axios.put(`${getBaseUrl()}/${id}`, clientData, getAuthHeaders());
  return response.data;
};

export const deleteClient = async (id) => {
  const response = await axios.delete(`${getBaseUrl()}/${id}`, getAuthHeaders());
  return response.data;
};

export const exportClients = async () => {
  const response = await axios.get(`${getBaseUrl()}/export`, getAuthHeaders());
  return response.data;
};

// Client Meetings API
export const getClientMeetings = async (clientId) => {
  const response = await axios.get(`${getBaseUrl()}/${clientId}/meetings`, getAuthHeaders());
  return response.data;
};

export const createClientMeeting = async (clientId, meetingData) => {
  const response = await axios.post(`${getBaseUrl()}/${clientId}/meetings`, meetingData, getAuthHeaders());
  return response.data;
};

export const updateClientMeeting = async (clientId, meetingId, meetingData) => {
  const response = await axios.put(`${getBaseUrl()}/${clientId}/meetings/${meetingId}`, meetingData, getAuthHeaders());
  return response.data;
};

export const deleteClientMeeting = async (clientId, meetingId) => {
  const response = await axios.delete(`${getBaseUrl()}/${clientId}/meetings/${meetingId}`, getAuthHeaders());
  return response.data;
};

// Client Follow-ups API
export const getClientFollowups = async (clientId) => {
  const response = await axios.get(`${getBaseUrl()}/${clientId}/followups`, getAuthHeaders());
  return response.data;
};

export const createClientFollowup = async (clientId, followupData) => {
  const response = await axios.post(`${getBaseUrl()}/${clientId}/followups`, followupData, getAuthHeaders());
  return response.data;
};

export const updateClientFollowup = async (clientId, followupId, followupData) => {
  const response = await axios.put(`${getBaseUrl()}/${clientId}/followups/${followupId}`, followupData, getAuthHeaders());
  return response.data;
};

export const deleteClientFollowup = async (clientId, followupId) => {
  const response = await axios.delete(`${getBaseUrl()}/${clientId}/followups/${followupId}`, getAuthHeaders());
  return response.data;
};
