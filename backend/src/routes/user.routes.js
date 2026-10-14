import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import checkAuth, { requireRole } from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';

const router = Router();

// ==========================================
// AUTH MIDDLEWARE
// ==========================================

router.use(checkAuth);

// ==========================================
// USER ROUTES
// ==========================================

// CHANGE PASSWORD (self)
router.post(
  '/change-password',
  userController.changePassword
);

// GET ALL USERS (Admin / HR only)
router.get(
  '/',
  requireRole(['admin', 'hr']),
  userController.getUsers
);

// SIMPLE USER LIST (Staff only, never students)
router.get(
  '/list',
  requireRole(['admin', 'hr']),
  userController.getUserList
);

// GET USER BY ID (Admin / HR only)
router.get(
  '/:id',
  requireRole(['admin', 'hr']),
  userController.getUserById
);

// ==========================================
// ADMIN & HR MUTATION ROUTES
// ==========================================

// CREATE USER
router.post(
  '/create',
  requireRole(['admin', 'hr']),
  upload.any(),
  userController.createUser
);
router.post(
  '/',
  requireRole(['admin', 'hr']),
  upload.any(),
  userController.createUser
);

// UPDATE USER
router.put(
  '/update/:id',
  requireRole(['admin', 'hr']),
  upload.any(),
  userController.updateUser
);
router.post(
  '/update/:id',
  requireRole(['admin', 'hr']),
  upload.any(),
  userController.updateUser
);
router.put(
  '/:id',
  requireRole(['admin', 'hr']),
  upload.any(),
  userController.updateUser
);
router.put(
  '/update',
  requireRole(['admin', 'hr']),
  upload.any(),
  (req, res, next) => {
    req.params.id = req.body.id || req.body._id;
    next();
  },
  userController.updateUser
);
router.post(
  '/update',
  requireRole(['admin', 'hr']),
  upload.any(),
  (req, res, next) => {
    req.params.id = req.body.id || req.body._id;
    next();
  },
  userController.updateUser
);

// CHANGE ROLE (Admin only)
router.patch(
  '/:id/role',
  requireRole(['admin']),
  userController.changeUserRole
);

// UPDATE PERMISSIONS & SIDEBAR ACCESS (Admin only)
router.put(
  '/:id/permissions',
  requireRole(['admin']),
  userController.updatePermissions
);
router.post(
  '/:id/permissions',
  requireRole(['admin']),
  userController.updatePermissions
);

// DEACTIVATE USER (Admin only)
router.patch(
  '/:id/deactivate',
  requireRole(['admin']),
  userController.deactivateUser
);

// DELETE USER (Admin only)
router.delete(
  '/delete/:id',
  requireRole(['admin']),
  userController.deleteUser
);
router.post(
  '/delete/:id',
  requireRole(['admin']),
  userController.deleteUser
);
router.delete(
  '/:id',
  requireRole(['admin']),
  userController.deleteUser
);
router.delete(
  '/delete',
  requireRole(['admin']),
  (req, res, next) => {
    req.params.id = req.body.id || req.body._id;
    next();
  },
  userController.deleteUser
);
router.post(
  '/delete',
  requireRole(['admin']),
  (req, res, next) => {
    req.params.id = req.body.id || req.body._id;
    next();
  },
  userController.deleteUser
);

export default router;