// ── src/middleware/upload.middleware.js ──

import fs from 'fs';
import path from 'path';
import multer from 'multer';

const getTaskUploadDir = (req) => {
  const taskId = String(
    req?.params?.task_id ||
    req?.body?.task_id ||
    req?.query?.task_id ||
    'general'
  ).trim();

  const safeTaskId = /^[0-9a-fA-F]{24}$/.test(taskId)
    ? taskId
    : 'general';

  const uploadDir = path.resolve(
    process.cwd(),
    'uploads',
    'tasks',
    safeTaskId
  );

  fs.mkdirSync(uploadDir, { recursive: true });

  return uploadDir;
};

const buildSafeFileName = (originalName, taskId) => {
  const rawBase = String(originalName || 'attachment')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'attachment';

  const ext = path.extname(String(originalName || '') || '.bin');
  const safeExt = ext && /^[a-zA-Z0-9]{1,8}$/.test(ext.replace('.', ''))
    ? ext.toLowerCase()
    : '.bin';

  return `${Date.now()}_${taskId.slice(-8)}_${rawBase}${safeExt}`;
};

// ============================================================
// DISK STORAGE
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      cb(null, getTaskUploadDir(req));
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    try {
      const taskId = String(
        req?.params?.task_id ||
        req?.body?.task_id ||
        req?.query?.task_id ||
        'general'
      ).trim();
      const safeTaskId = /^[0-9a-fA-F]{24}$/.test(taskId)
        ? taskId
        : 'general';

      cb(null, buildSafeFileName(file.originalname, safeTaskId));
    } catch (error) {
      cb(error, null);
    }
  }
});

// ============================================================
// ALLOWED FILE TYPES
// ============================================================

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/avif',

  // PDF
  'application/pdf',

  // Documents
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Text / CSV
  'text/plain',
  'text/csv',

  // Generic binary files
  'application/octet-stream'
]);

const ALLOWED_EXTENSIONS = new Set([
  // Images
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'svg',
  'bmp',
  'heic',
  'heif',
  'jfif',
  'avif',

  // Documents
  'pdf',
  'doc',
  'docx',

  // Excel
  'xls',
  'xlsx',

  // PowerPoint
  'ppt',
  'pptx',

  // Text
  'txt',
  'csv'
]);

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (req, file, cb) => {
  try {
    if (!file) {
      return cb(null, false);
    }

    const mimetype = String(file.mimetype || '')
      .toLowerCase()
      .trim();

    const originalName = String(file.originalname || '')
      .toLowerCase()
      .trim();

    const extension = originalName.includes('.')
      ? originalName.split('.').pop()
      : '';

    const isMimeAllowed =
      ALLOWED_MIME_TYPES.has(mimetype);

    const isExtensionAllowed =
      ALLOWED_EXTENSIONS.has(extension);

    // Accept when either MIME type or extension is recognized.
    // This helps with browsers that send application/octet-stream
    // for otherwise valid files.
    if (isMimeAllowed || isExtensionAllowed) {
      return cb(null, true);
    }

    return cb(
      new Error(
        `Invalid file type "${extension || mimetype}". ` +
        'Allowed files: images, PDF, Word, Excel, PowerPoint, TXT and CSV.'
      ),
      false
    );

  } catch (error) {
    return cb(error, false);
  }
};

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const upload = multer({
  storage,

  limits: {
    // Maximum size per file: 50 MB
    fileSize: 50 * 1024 * 1024,

    // Prevent extremely large multipart requests
    files: 20,

    // Prevent excessive form fields
    fields: 100,

    // Prevent excessively large field names/values
    fieldNameSize: 200,
    fieldSize: 2 * 1024 * 1024
  },

  fileFilter
});

export const memoryUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
    fields: 100,
    fieldNameSize: 200,
    fieldSize: 2 * 1024 * 1024
  },

  fileFilter
});

// ============================================================
// EXPORT
// ============================================================

export default upload;