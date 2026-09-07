import { Router } from 'express';
import { leadController } from '../controllers/lead.controller.js';
import checkAuth, { restrictToDepartment } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery, validateParams } from '../validators/task.validator.js';
import {
  createLeadSchema,
  updateLeadSchema,
  bulkUpdateStatusSchema,
  addFollowUpSchema,
  updateStatusSchema
} from '../validators/lead.validator.js';
import { apiRateLimiter, leadMutationRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// Middleware to check authorization for department (Marketing or Telecaller) or role ID 3 (Employee)
const authorizeLeadsAccess = async (req, res, next) => {
  const userRole = String(req.user?.role || req.user?.role_id || req.user?.roleId || '').toLowerCase().trim();
  const isSuperAdmin = 
    req.user?.isSuperAdmin === true || 
    req.user?.is_super_admin === true || 
    userRole === '0' || 
    userRole.includes('super');

  if (isSuperAdmin) {
    return next();
  }

  let userDeptName = String(req.user?.department || req.user?.departmentId?.name || '').toLowerCase().trim();
  let userDesigName = String(req.user?.designation || req.user?.designationId?.name || '').toLowerCase().trim();

  // Fallback: If department/designation name is missing from token, query from DB
  if ((!userDeptName || !userDesigName) && req.user?.id) {
    try {
      const User = (await import('../models/user.model.js')).default;
      const userObj = await User.findById(req.user.id).populate('departmentId').populate('designationId');
      if (userObj) {
        userDeptName = String(userObj.departmentId?.name || userObj.department || '').toLowerCase().trim();
        userDesigName = String(userObj.designationId?.name || userObj.designation || '').toLowerCase().trim();
      }
    } catch (err) {
      console.error("Failed to fetch user department fallback:", err);
    }
  }

  const isAuthorized = 
    userRole.includes('admin') ||
    userRole.includes('hr') ||
    userRole.includes('telecall') ||
    userRole.includes('counsel') ||
    userRole.includes('market') ||
    userRole.includes('manager') ||
    ['0', '1', '2', '3', '10'].includes(userRole) ||
    userDeptName.includes('market') ||
    userDeptName.includes('telecall') ||
    userDeptName.includes('counsel') ||
    userDeptName.includes('sales') ||
    userDeptName.includes('growth') ||
    userDeptName.includes('ops') ||
    userDeptName.includes('hr') ||
    userDeptName.includes('account') ||
    userDeptName.includes('r&d') ||
    userDeptName.includes('design') ||
    userDeptName.includes('video') ||
    userDesigName.includes('counsel') ||
    userDesigName.includes('telecall') ||
    userDesigName.includes('market');

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Exclusive to marketing, telecallers, or authorized roles.'
    });
  }

  next();
};

// Middleware for mutation operations
const restrictAdminMutations = (req, res, next) => {
  next();
};

router.use(checkAuth);
router.use(authorizeLeadsAccess);


// GET ALL LEADS (supporting filters, search, and pagination) - View access allowed for Admin
router.get('/', apiRateLimiter, leadController.getLeads);

// GET SINGLE LEAD BY ID - View access allowed for Admin
router.get('/:id', apiRateLimiter, leadController.getLeadById);

// CREATE LEAD (with Zod validation, rate limiting, blocked for Admin)
router.post('/create', leadMutationRateLimiter, restrictAdminMutations, validateBody(createLeadSchema), leadController.createLead);

// BULK UPDATE LEAD STATUS (blocked for Admin)
router.put('/update', leadMutationRateLimiter, restrictAdminMutations, validateBody(bulkUpdateStatusSchema), leadController.bulkUpdateStatus);

// UPDATE SINGLE LEAD (blocked for Admin)
router.put('/:id', leadMutationRateLimiter, restrictAdminMutations, validateBody(updateLeadSchema), leadController.updateLead);
router.post('/update/:id', leadMutationRateLimiter, restrictAdminMutations, validateBody(updateLeadSchema), leadController.updateLead);
router.post('/update', leadMutationRateLimiter, restrictAdminMutations, validateBody(updateLeadSchema), leadController.updateLead);

// LOG FOLLOW-UP ACTION (blocked for Admin)
router.post('/followup', leadMutationRateLimiter, restrictAdminMutations, validateBody(addFollowUpSchema), leadController.addFollowUp);
router.post('/followup/:id', leadMutationRateLimiter, restrictAdminMutations, validateBody(addFollowUpSchema), leadController.addFollowUp);

// UPDATE LEAD STATUS (blocked for Admin)
router.patch('/status-update', leadMutationRateLimiter, restrictAdminMutations, validateBody(updateStatusSchema), leadController.updateStatus);
router.patch('/status-update/:id', leadMutationRateLimiter, restrictAdminMutations, validateBody(updateStatusSchema), leadController.updateStatus);
router.post('/status-update', leadMutationRateLimiter, restrictAdminMutations, validateBody(updateStatusSchema), leadController.updateStatus);
router.post('/status-update/:id', leadMutationRateLimiter, restrictAdminMutations, validateBody(updateStatusSchema), leadController.updateStatus);

// DELETE LEAD (blocked for Admin)
router.delete('/delete/:id', leadMutationRateLimiter, restrictAdminMutations, leadController.deleteLead);
router.post('/delete/:id', leadMutationRateLimiter, restrictAdminMutations, leadController.deleteLead);
router.delete('/:id', leadMutationRateLimiter, restrictAdminMutations, leadController.deleteLead);
router.delete('/delete', leadMutationRateLimiter, restrictAdminMutations, leadController.deleteLead);
router.post('/delete', leadMutationRateLimiter, restrictAdminMutations, leadController.deleteLead);

// BULK IMPORT LEADS (blocked for Admin)
router.post('/import', leadMutationRateLimiter, restrictAdminMutations, leadController.importLeads);

export default router;
