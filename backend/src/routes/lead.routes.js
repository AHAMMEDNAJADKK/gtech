import { Router } from 'express';
import { leadController } from '../controllers/lead.controller.js';
import checkAuth from '../middleware/auth.middleware.js';
import { validateBody, validateQuery, validateParams } from '../validators/task.validator.js';
import {
  createLeadSchema,
  updateLeadSchema,
  bulkUpdateStatusSchema,
  addFollowUpSchema,
  updateStatusSchema
} from '../validators/lead.validator.js';
import { apiRateLimiter, leadMutationRateLimiter } from '../middleware/rateLimiter.middleware.js';
import { getAuthUserContext, hasPermission, EDTECH_PERMISSIONS } from '../utils/rbac.helper.js';

const router = Router();

// =========================================================================
// Centralized EdTech Admissions RBAC Guards
// =========================================================================

const requireLeadsRead = async (req, res, next) => {
  try {
    const auth = await getAuthUserContext(req);
    req.authContext = auth;

    if (auth.isStudent) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Students are not authorized to access the Leads directory.'
      });
    }

    if (auth.isInstructor && !hasPermission(auth, EDTECH_PERMISSIONS.LEADS_VIEW)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Instructors are not authorized to view the Leads directory.'
      });
    }

    if (!hasPermission(auth, EDTECH_PERMISSIONS.LEADS_VIEW)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Exclusive to Admissions, Counselors, or authorized administrators.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireLeadsCreate = async (req, res, next) => {
  try {
    const auth = req.authContext || await getAuthUserContext(req);
    req.authContext = auth;

    if (auth.isStudent || auth.isInstructor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to create leads.'
      });
    }

    if (!hasPermission(auth, EDTECH_PERMISSIONS.LEADS_CREATE)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions to create leads.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireLeadsUpdate = async (req, res, next) => {
  try {
    const auth = req.authContext || await getAuthUserContext(req);
    req.authContext = auth;

    if (auth.isStudent || auth.isInstructor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to update leads.'
      });
    }

    if (!hasPermission(auth, EDTECH_PERMISSIONS.LEADS_UPDATE)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions to update leads.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireLeadsDelete = async (req, res, next) => {
  try {
    const auth = req.authContext || await getAuthUserContext(req);
    req.authContext = auth;

    if (!hasPermission(auth, EDTECH_PERMISSIONS.LEADS_DELETE)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required to delete lead records.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireLeadsConvert = async (req, res, next) => {
  try {
    const auth = req.authContext || await getAuthUserContext(req);
    req.authContext = auth;

    if (auth.isStudent || auth.isInstructor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to convert leads to students.'
      });
    }

    if (!hasPermission(auth, EDTECH_PERMISSIONS.LEADS_CONVERT)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions to convert leads.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireFollowups = async (req, res, next) => {
  try {
    const auth = req.authContext || await getAuthUserContext(req);
    req.authContext = auth;

    if (auth.isStudent || auth.isInstructor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to log follow-up actions.'
      });
    }

    if (!hasPermission(auth, EDTECH_PERMISSIONS.FOLLOWUPS_CREATE)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions for follow-up operations.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Global JWT verification for all leads routes
router.use(checkAuth);

// GET ALL LEADS (with search, status filters, date range, pagination, counselor ownership)
router.get('/', apiRateLimiter, requireLeadsRead, leadController.getLeads);

// GET SINGLE LEAD BY ID (with timeline follow-up history)
router.get('/:id', apiRateLimiter, requireLeadsRead, leadController.getLeadById);

// CREATE LEAD
router.post('/', leadMutationRateLimiter, requireLeadsCreate, validateBody(createLeadSchema), leadController.createLead);
router.post('/create', leadMutationRateLimiter, requireLeadsCreate, validateBody(createLeadSchema), leadController.createLead);

// BULK UPDATE LEAD STATUS
router.put('/update', leadMutationRateLimiter, requireLeadsUpdate, validateBody(bulkUpdateStatusSchema), leadController.bulkUpdateStatus);

// UPDATE SINGLE LEAD
router.put('/:id', leadMutationRateLimiter, requireLeadsUpdate, validateBody(updateLeadSchema), leadController.updateLead);
router.post('/update/:id', leadMutationRateLimiter, requireLeadsUpdate, validateBody(updateLeadSchema), leadController.updateLead);
router.post('/update', leadMutationRateLimiter, requireLeadsUpdate, validateBody(updateLeadSchema), leadController.updateLead);

// LOG FOLLOW-UP ACTION
router.post('/followup', leadMutationRateLimiter, requireFollowups, validateBody(addFollowUpSchema), leadController.addFollowUp);
router.post('/followup/:id', leadMutationRateLimiter, requireFollowups, validateBody(addFollowUpSchema), leadController.addFollowUp);

// UPDATE LEAD STATUS
router.patch('/status-update', leadMutationRateLimiter, requireLeadsUpdate, validateBody(updateStatusSchema), leadController.updateStatus);
router.patch('/status-update/:id', leadMutationRateLimiter, requireLeadsUpdate, validateBody(updateStatusSchema), leadController.updateStatus);
router.post('/status-update', leadMutationRateLimiter, requireLeadsUpdate, validateBody(updateStatusSchema), leadController.updateStatus);
router.post('/status-update/:id', leadMutationRateLimiter, requireLeadsUpdate, validateBody(updateStatusSchema), leadController.updateStatus);

// DELETE LEAD (strictly Super Admin / Admin)
router.delete('/delete/:id', leadMutationRateLimiter, requireLeadsDelete, leadController.deleteLead);
router.post('/delete/:id', leadMutationRateLimiter, requireLeadsDelete, leadController.deleteLead);
router.delete('/:id', leadMutationRateLimiter, requireLeadsDelete, leadController.deleteLead);
router.delete('/delete', leadMutationRateLimiter, requireLeadsDelete, leadController.deleteLead);
router.post('/delete', leadMutationRateLimiter, requireLeadsDelete, leadController.deleteLead);

// BULK IMPORT LEADS
router.post('/import', leadMutationRateLimiter, requireLeadsCreate, leadController.importLeads);

// CONVERT LEAD TO STUDENT
router.post('/:id/convert-to-student', leadMutationRateLimiter, requireLeadsConvert, leadController.convertToStudent);

export default router;
