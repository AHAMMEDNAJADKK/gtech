import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ============================================================
// COMMON HELPERS
// ============================================================

const preprocessSingleString = (schema) =>
  z.preprocess(
    (val) => Array.isArray(val) ? val[0] : val,
    schema
  );

const objectIdSchema = (fieldName) =>
  preprocessSingleString(
    z.string().regex(objectIdRegex, {
      message: `Invalid format for ${fieldName}`
    })
  );

const coerceBooleanSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'boolean') return val;
  const normalized = String(Array.isArray(val) ? val[0] : val).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}, z.boolean().optional());

const coerceTagsSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (Array.isArray(val)) {
    return val.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // comma-separated fallback
    }
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return undefined;
}, z.array(z.string().trim()).optional());

// ============================================================
// VALID STATUSES
// ============================================================

const WORK_STATUSES = [
  'draft',
  'in_progress',
  'ready_for_review',
  'approved',
  'revision_requested',
  'completed',
  'cancelled'
];

const POSTING_STATUSES = [
  'not_scheduled',
  'scheduled',
  'ready_to_post',
  'posted',
  'missed',
  'cancelled'
];

const CONTENT_TYPES = [
  'instagram_post',
  'instagram_story',
  'facebook_post',
  'facebook_story',
  'blog_post',
  'youtube_video',
  'newsletter',
  'twitter_post',
  'tiktok_video',
  'email_campaign',
  'web_banner',
  'linkedin_post',
  'other'
];

// ============================================================
// CREATE CALENDAR WORK
// ============================================================

export const createCalendarWorkSchema = z.object({
  title: preprocessSingleString(
    z.string({
      required_error: 'Title is required'
    })
      .trim()
      .min(1, { message: 'Title cannot be empty' })
      .max(500, { message: 'Title cannot exceed 500 characters' })
  ),

  description: preprocessSingleString(
    z.string()
      .trim()
      .max(3000, { message: 'Description cannot exceed 3000 characters' })
      .optional()
      .or(z.literal(''))
      .transform(val => val === '' ? '' : val)
  ),

  contentType: preprocessSingleString(
    z.string()
      .trim()
      .max(100, { message: 'Content type cannot exceed 100 characters' })
      .optional()
      .or(z.literal(''))
  ),

  assignedTo: objectIdSchema('assignedTo'),

  workDate: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'Invalid workDate format' }
      )
  ),

  workDueDate: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'Invalid workDueDate format' }
      )
  ),

  postingDate: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'Invalid postingDate format' }
      )
  ),

  postingTime: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          return /^\d{2}:\d{2}$/.test(val);
        },
        { message: 'postingTime must be in HH:MM format (24-hour)' }
      )
  ),

  project: objectIdSchema('project').optional().or(z.literal('')),
  client: objectIdSchema('client').optional().or(z.literal('')),
  campaign: preprocessSingleString(
    z.string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal(''))
  ),
  task: objectIdSchema('task').optional().or(z.literal('')),

  contentUrl: preprocessSingleString(
    z.string()
      .trim()
      .url('Invalid URL format')
      .optional()
      .or(z.literal(''))
  ),

  isUrgent: coerceBooleanSchema,
  isPriority: coerceBooleanSchema,
  tags: coerceTagsSchema,
  imageUrl: preprocessSingleString(
    z.string().trim().optional().or(z.literal(''))
  ),
  removeImage: coerceBooleanSchema
});

// ============================================================
// UPDATE CALENDAR WORK
// ============================================================

export const updateCalendarWorkSchema = z.object({
  title: preprocessSingleString(
    z.string()
      .trim()
      .min(1, { message: 'Title cannot be empty' })
      .max(500, { message: 'Title cannot exceed 500 characters' })
      .optional()
  ),

  description: preprocessSingleString(
    z.string()
      .trim()
      .max(3000)
      .optional()
      .or(z.literal(''))
  ),

  contentType: preprocessSingleString(
    z.string()
      .trim()
      .max(100, { message: 'Content type cannot exceed 100 characters' })
      .optional()
      .or(z.literal(''))
  ),

  assignedTo: objectIdSchema('assignedTo').optional(),

  workDate: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'Invalid workDate format' }
      )
  ),

  workDueDate: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'Invalid workDueDate format' }
      )
  ),

  postingDate: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'Invalid postingDate format' }
      )
  ),

  postingTime: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          return /^\d{2}:\d{2}$/.test(val);
        },
        { message: 'postingTime must be in HH:MM format (24-hour)' }
      )
  ),

  project: objectIdSchema('project').optional().or(z.literal('')),
  client: objectIdSchema('client').optional().or(z.literal('')),
  campaign: preprocessSingleString(z.string().trim().max(200).optional()),
  contentUrl: preprocessSingleString(
    z.string().trim().url('Invalid URL format').optional().or(z.literal(''))
  ),

  approvalNotes: preprocessSingleString(
    z.string().trim().optional().or(z.literal(''))
  ),

  revisionNotes: preprocessSingleString(
    z.string().trim().optional().or(z.literal(''))
  ),

  isUrgent: coerceBooleanSchema,
  isPriority: coerceBooleanSchema,
  tags: coerceTagsSchema,
  imageUrl: preprocessSingleString(
    z.string().trim().optional().or(z.literal(''))
  ),
  removeImage: coerceBooleanSchema
});

// ============================================================
// UPDATE STATUS
// ============================================================

export const updateWorkStatusSchema = z.object({
  status: z.preprocess(
    (val) => {
      const raw = String(Array.isArray(val) ? val[0] : (val ?? '')).trim();
      if (!raw) return raw;
      if (raw.toLowerCase() === 'completed') return 'completed';
      return raw;
    },
    z.string()
      .refine(
        (val) => WORK_STATUSES.includes(val),
        { message: `Invalid status. Must be one of: ${WORK_STATUSES.join(', ')}` }
      )
  ),

  notes: preprocessSingleString(
    z.string()
      .trim()
      .max(1000)
      .optional()
      .or(z.literal(''))
  )
});

// ============================================================
// UPDATE POSTING STATUS
// ============================================================

export const updatePostingStatusSchema = z.object({
  status: z.string()
    .refine(
      (val) => POSTING_STATUSES.includes(val),
      { message: `Invalid posting status. Must be one of: ${POSTING_STATUSES.join(', ')}` }
    ),

  actualPostTime: preprocessSingleString(
    z.string()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'Invalid actualPostTime format' }
      )
  ),

  socialMediaLinks: z.array(
    z.object({
      platform: z.string().optional(),
      postUrl: z.string().url('Invalid URL format').optional()
    })
  ).optional(),

  notes: preprocessSingleString(
    z.string()
      .trim()
      .max(1000)
      .optional()
      .or(z.literal(''))
  )
});

// ============================================================
// VALIDATION MIDDLEWARE
// ============================================================

export const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          data: { errors: messages }
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        data: error
      });
    }
  };
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return res.status(400).json({
          success: false,
          message: 'Invalid parameters',
          data: { errors: messages }
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Parameter validation error',
        data: error
      });
    }
  };
};

// ============================================================
// COMMON PARAM SCHEMAS
// ============================================================

export const calendarWorkIdParamsSchema = z.object({
  id: objectIdSchema('calendar work ID')
});
