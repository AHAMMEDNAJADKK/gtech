// src/services/emailService.js
import { BrevoClient } from '@getbrevo/brevo';

const apiKey = import.meta.env.VITE_BREVO_API_KEY;
const senderAddress = import.meta.env.VITE_EMAIL_SENDER_ADDRESS;
const senderName = import.meta.env.VITE_EMAIL_SENDER_NAME || 'CRM System';

const brevo = apiKey ? new BrevoClient({ apiKey }) : null;

/**
 * Format recipient(s) to Brevo expected format: [{ email: '...', name: '...' }]
 */
const formatRecipients = (to) => {
  if (!to) return [];
  const list = Array.isArray(to) ? to : [to];
  return list
    .map((item) => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        return trimmed ? { email: trimmed } : null;
      }
      if (typeof item === 'object' && item !== null && item.email) {
        const trimmedEmail = String(item.email).trim();
        if (!trimmedEmail) return null;
        return { email: trimmedEmail, name: item.name ? String(item.name).trim() : undefined };
      }
      return null;
    })
    .filter(Boolean);
};

const wrapHtmlTemplate = (content, subjectStr, senderNameStr) => {
  if (content && (content.includes('max-width') || content.includes('font-family') || content.includes('<table') || content.includes('background: linear-gradient'))) {
    return content;
  }

  const cleanSubject = (subjectStr || 'New CRM Notification Alert')
    .replace(/^[📌🔔]\s*/, '')
    .replace(/^Notification:\s*/i, '');

  const formattedBody = content
    ? (content.startsWith('<') 
        ? content 
        : content.split('\n').map(line => line.trim() ? `<p style="margin: 0 0 12px 0; color: #334155; font-size: 15px; line-height: 1.6;">${line}</p>` : '').join(''))
    : '<p style="margin: 0; color: #334155; font-size: 15px;">You have a new update in your CRM portal.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #c4ec0d 0%, #aed604 100%); padding: 32px 32px 28px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background: #0f172a; color: #c4ec0d; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 12px; border-radius: 50px; margin-bottom: 12px;">
                      CRM Notification
                    </span>
                    <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0; line-height: 1.3; letter-spacing: -0.02em;">
                      ${cleanSubject}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content Area -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background-color: #ffffff;">
              <div style="color: #334155; font-size: 15px; line-height: 1.6; font-weight: 400;">
                ${formattedBody}
              </div>
            </td>
          </tr>

          <!-- Callout Footer Info -->
          <tr>
            <td style="padding: 0 32px 28px 32px; background-color: #ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #c4ec0d; border-radius: 14px; padding: 16px 20px;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; font-weight: 600; color: #475569;">
                      📌 <strong>Action Required:</strong> Log in to your CRM dashboard to view full details and respond.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #64748b;">
                ${senderNameStr}
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                This is an automated transactional email from your CRM platform.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Send a transactional email via Brevo.
 * @param {Object} params
 * @param {string|Object|Array<string|Object>} params.to - Recipient email(s)
 * @param {string} params.subject - Email subject
 * @param {string} [params.htmlContent] - HTML body
 * @param {string} [params.textContent] - Plain text body
 * @returns {Promise<any>} API response
 */
export const sendEmail = async ({ to, subject, htmlContent, textContent }) => {
  if (!apiKey) {
    throw new Error('VITE_BREVO_API_KEY is not set in frontend .env file.');
  }
  if (!senderAddress || senderAddress === 'no-reply@example.com') {
    throw new Error('VITE_EMAIL_SENDER_ADDRESS is not set or using default in .env file.');
  }

  const recipients = formatRecipients(to);
  if (recipients.length === 0) {
    throw new Error('No valid recipient email address found for selected employee(s).');
  }

  const safeSubject = subject || 'CRM Notification Alert';
  const finalHtml = wrapHtmlTemplate(htmlContent, safeSubject, senderName);
  const plainText = textContent || (htmlContent ? htmlContent.replace(/<[^>]+>/g, '').trim() : safeSubject);

  const emailPayload = {
    subject: safeSubject,
    sender: {
      name: senderName,
      email: senderAddress.trim(),
    },
    to: recipients,
    htmlContent: finalHtml,
    textContent: plainText,
  };

  try {
    const data = await brevo.transactionalEmails.sendTransacEmail(emailPayload);
    return data;
  } catch (error) {
    console.error('Brevo Email Error Details:', error);
    let detailedMsg = error?.message || 'Failed to send email via Brevo.';
    if (error?.body) {
      try {
        const bodyObj = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
        if (bodyObj.message) detailedMsg = bodyObj.message;
      } catch (e) {
        // ignore parse error
      }
    }
    throw new Error(detailedMsg);
  }
};


