import { Router } from 'express';
import verifyJWT from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';

import {
  createCalendarWork,
  getCalendarWorks,
  getMyCalendarWorks,
  getCalendarWorkById,
  updateCalendarWork,
  updateWorkStatus,
  updatePostingStatus,
  deleteCalendarWork
} from '../controllers/calendarWork.controller.js';

import {
  createCalendarWorkSchema,
  updateCalendarWorkSchema,
  updateWorkStatusSchema,
  updatePostingStatusSchema,
  calendarWorkIdParamsSchema,
  validateBody,
  validateParams
} from '../validators/calendarWork.validator.js';

const router = Router();

const handleImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();

    const isTooLarge = err.code === 'LIMIT_FILE_SIZE' || err.message === 'File too large';
    return res.status(isTooLarge ? 413 : 400).json({
      success: false,
      message: isTooLarge
        ? 'Image is too large. Maximum allowed size is 50MB.'
        : (err.message || 'Image upload failed')
    });
  });
};

// ============================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================

router.use(verifyJWT);

import {
  getContentTypes,
  createContentType,
  updateContentType,
  deleteContentType
} from '../controllers/contentType.controller.js';

// ============================================================
// DYNAMIC CONTENT TYPES (Defined at top to avoid route collision)
// ============================================================

router.get('/content-types', getContentTypes);
router.post('/content-types', createContentType);
router.put('/content-types/:id', updateContentType);
router.delete('/content-types/:id', deleteContentType);

// ============================================================
// CREATE CALENDAR WORK
// POST /api/calendar-work
// ============================================================

router.post(
  '/',
  handleImageUpload,
  validateBody(createCalendarWorkSchema),
  createCalendarWork
);

// ============================================================
// GET ALL CALENDAR WORK (with filters)
// GET /api/calendar-work
// ============================================================

router.get(
  '/',
  getCalendarWorks
);

// ============================================================
// GET MY CALENDAR WORK
// GET /api/calendar-work/my-work
// ============================================================

router.get(
  '/my-work',
  getMyCalendarWorks
);

// ============================================================
// GET CALENDAR WORK BY ID
// GET /api/calendar-work/:id
// ============================================================

router.get(
  '/:id',
  validateParams(calendarWorkIdParamsSchema),
  getCalendarWorkById
);

// ============================================================
// UPDATE CALENDAR WORK
// PUT /api/calendar-work/:id
// ============================================================

router.put(
  '/:id',
  validateParams(calendarWorkIdParamsSchema),
  handleImageUpload,
  validateBody(updateCalendarWorkSchema),
  updateCalendarWork
);

// ============================================================
// UPDATE WORK STATUS
// PATCH /api/calendar-work/:id/status
// ============================================================

router.patch(
  '/:id/status',
  validateParams(calendarWorkIdParamsSchema),
  validateBody(updateWorkStatusSchema),
  updateWorkStatus
);

// ============================================================
// UPDATE POSTING STATUS
// PATCH /api/calendar-work/:id/posting-status
// ============================================================

router.patch(
  '/:id/posting-status',
  validateParams(calendarWorkIdParamsSchema),
  validateBody(updatePostingStatusSchema),
  updatePostingStatus
);

// ============================================================
// UPDATE CALENDAR WORK (PATCH alias)
// PATCH /api/calendar-work/:id
// ============================================================

router.patch(
  '/:id',
  validateParams(calendarWorkIdParamsSchema),
  handleImageUpload,
  validateBody(updateCalendarWorkSchema),
  updateCalendarWork
);

// ============================================================
// DELETE CALENDAR WORK
// DELETE /api/calendar-work/:id
// ============================================================

router.delete(
  '/:id',
  validateParams(calendarWorkIdParamsSchema),
  deleteCalendarWork
);

export default router;
