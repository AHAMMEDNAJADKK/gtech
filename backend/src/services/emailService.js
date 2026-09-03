/**
 * Email Service Module
 * Primary Provider: Brevo (Sendinblue) REST API v3
 * Secondary Provider: SMTP (Nodemailer)
 */

import nodemailer from 'nodemailer';

const BREVO_API_URL = 'https://api.brevo.com/v3';

/**
 * Get Brevo API Key
 */
const getBrevoApiKey = () => {
  const key = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || process.env.VITE_BREVO_API_KEY;
  return key && !key.includes('your_brevo_api_key') && key.trim() !== '' ? key.trim() : null;
};

/**
 * Create SMTP Transporter fallback
 */
const createSmtpTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.VITE_EMAIL_SENDER_ADDRESS || process.env.BREVO_SENDER_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY;

  if (!user || user.includes('smtp_username_here') || !pass || pass.includes('smtp_password_here')) {
    return null;
  }

  if (host.includes('gmail') || (user && user.endsWith('@gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
};

/**
 * Send Transactional Email
 * @param {Object} options
 * @param {string|Array<string>} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.htmlContent - HTML body
 * @param {string} [options.textContent] - Plain text body
 * @param {string} [options.senderName] - Sender name
 * @param {string} [options.senderEmail] - Sender email
 * @param {Array<{email: string, name?: string}>} [options.cc] - CC recipients
 */
export const sendEmail = async ({
  to,
  subject,
  htmlContent,
  textContent = '',
  senderName = null,
  senderEmail = null,
  cc = null,
  apiKeyOverride = null
}) => {
  if (!to) return { success: false, message: 'Recipient email is required.' };

  let recipients = [];
  if (typeof to === 'string') {
    recipients = [{ email: to.trim() }];
  } else if (Array.isArray(to)) {
    recipients = to.map(e => (typeof e === 'string' ? { email: e.trim() } : e));
  }

  const defaultSenderEmail = senderEmail || process.env.BREVO_SENDER_EMAIL || process.env.VITE_EMAIL_SENDER_ADDRESS || process.env.SMTP_FROM || 'kodbrandsolutions@gmail.com';
  const defaultSenderName = senderName || process.env.BREVO_SENDER_NAME || process.env.VITE_EMAIL_SENDER_NAME || 'KODBRAND';

  // 1. Try Brevo API v3
  const apiKey = (apiKeyOverride && String(apiKeyOverride).trim()) || getBrevoApiKey();
  if (apiKey) {
    try {
      const payload = {
        sender: { name: defaultSenderName, email: defaultSenderEmail },
        to: recipients,
        subject: subject || 'KOD.BRAND Notification',
        htmlContent: htmlContent || textContent || '<p>No content</p>'
      };

      if (textContent) payload.textContent = textContent;
      if (Array.isArray(cc) && cc.length > 0) payload.cc = cc;

      const res = await fetch(`${BREVO_API_URL}/smtp/email`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.messageId) {
        console.log(`[emailService Brevo] 🚀 Email sent to ${recipients.map(r => r.email).join(', ')} | ID: ${data.messageId}`);
        return { success: true, messageId: data.messageId, provider: 'brevo_api' };
      } else {
        console.error('[emailService Brevo Error Response]:', data);
      }
    } catch (e) {
      console.error('[emailService Brevo API Error]:', e.message);
    }
  }

  // 2. Fallback to SMTP
  const transporter = createSmtpTransporter();
  if (transporter) {
    try {
      const mailOptions = {
        from: `"${defaultSenderName}" <${defaultSenderEmail}>`,
        to: recipients.map(r => r.email).join(', '),
        subject,
        html: htmlContent,
        text: textContent || subject
      };
      if (Array.isArray(cc) && cc.length > 0) {
        mailOptions.cc = cc.map(c => c.email || c).join(', ');
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`[emailService SMTP] 🚀 Email sent to ${mailOptions.to} | MessageID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (e) {
      console.error('[emailService SMTP Error]:', e.message);
      return { success: false, error: e.message };
    }
  }

  // 3. Fallback to Simulation
  console.log(`\n================== 📧 SIMULATED MAIL DELIVERY 💾 ==================`);
  console.log(`TO:      ${recipients.map(r => r.email).join(', ')}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`BODY:\n${textContent || htmlContent}`);
  console.log(`=================================================================\n`);
  return { success: true, simulated: true, provider: 'simulated' };
};

/**
 * Send Email using a Brevo Template ID
 * @param {Object} options
 * @param {string|Array<string>} options.to
 * @param {number} options.templateId
 * @param {Object} [options.params]
 */
export const sendTemplateEmail = async ({ to, templateId, params = {} }) => {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    return { success: false, message: 'Brevo API Key required for template emails.' };
  }

  let recipients = [];
  if (typeof to === 'string') {
    recipients = [{ email: to.trim() }];
  } else if (Array.isArray(to)) {
    recipients = to.map(e => (typeof e === 'string' ? { email: e.trim() } : e));
  }

  try {
    const res = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        to: recipients,
        templateId: parseInt(templateId, 10),
        params
      })
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[emailService Brevo Template] 🚀 Template ${templateId} sent to ${recipients.map(r => r.email).join(', ')}`);
      return { success: true, messageId: data.messageId, provider: 'brevo_template' };
    }
    return { success: false, error: data.message || 'Template email failed' };
  } catch (e) {
    console.error('[emailService Template Error]:', e.message);
    return { success: false, error: e.message };
  }
};

const emailService = {
  sendEmail,
  sendTemplateEmail
};

export default emailService;
