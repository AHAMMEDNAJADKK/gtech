import { Router } from 'express';
import protectRoute from '../middleware/auth.middleware.js';
import edtechDashboardController from '../controllers/edtechDashboard.controller.js';

const router = Router();

router.use(protectRoute);

router.get('/stats', edtechDashboardController.getDashboardStats);
router.get('/', edtechDashboardController.getDashboardStats);

export default router;
