import { Router } from 'express';
import { signup, login, googleLogin, verifyForgotPassword, resetForgotPassword } from '../controllers/auth.controller.js';
import { designationController } from '../controllers/designation.controller.js';
import { departmentController } from '../modules/departments/department.controller.js';
import verifyJWT from '../middleware/auth.middleware.js';
import User from '../models/user.model.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  userIdParamsSchema,
  userStatusBodySchema,
  validateParams,
  validateBody
} from '../validators/task.validator.js';

import { checkDuplicateStudent } from '../controllers/student.controller.js';

const router = Router();

router.get('/check-duplicate', checkDuplicateStudent);
router.post('/signup', signup);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/forgot-password/verify', verifyForgotPassword);
router.post('/forgot-password/reset', resetForgotPassword);
router.get('/designations', designationController.getDesignations);
router.get('/departments', departmentController.getAll);

router.put(
  '/update-status/:user_id',
  verifyJWT,
  validateParams(userIdParamsSchema),
  validateBody(userStatusBodySchema),
  async (req, res, next) => {
    try {
      const role = req.user.role || req.user.role_id;
      if (role !== 'admin') {
        throw new AppError('Access denied. Admin access only.', 403);
      }

      const { user_id } = req.params;
      const { status } = req.body;

      const user = await User.findById(user_id);
      if (!user) {
        throw new AppError('User profile not found', 404);
      }

      user.status = status;
      // Sync status with the model's isActive boolean
      user.isActive = (status === 'active');
      await user.save();

      const userJson = user.toJSON();
      delete userJson.passwordHash;
      delete userJson.password;

      return res.status(200).json(userJson);
    } catch (error) {
      next(error);
    }
  }
);

export default router;