// src/services/smsService.js
import { TransactionalSMSApi, TransactionalSMSApiApiKeys } from '@getbrevo/brevo';

const smsApi = new TransactionalSMSApi();
smsApi.setApiKey(TransactionalSMSApiApiKeys.apiKey, import.meta.env.VITE_BREVO_API_KEY);

/**
 * Send a transactional SMS via Brevo.
 * @param {Object} params
 * @param {string|string[]} params.to - Recipient phone number(s) in international format
 * @param {string} params.content - SMS text content
 * @returns {Promise<any>}
 */
export const sendSms = async ({ to, content }) => {
  const sms = {
    sender: import.meta.env.VITE_SMS_SENDER || 'MyCompany',
    recipient: Array.isArray(to) ? to.join(',') : to,
    content,
  };
  try {
    const data = await smsApi.sendTransacSms(sms);
    return data;
  } catch (error) {
    console.error('Brevo SMS error:', error);
    throw error;
  }
};
