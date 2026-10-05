import { Router } from 'express';
import protectRoute from '../middleware/auth.middleware.js';
import {
  getMonthlyReport,
  autoCompileMonthlyReport,
  saveMonthlyReport,
  updateMDApproval
} from '../controllers/monthlyPerformanceReport.controller.js';

const router = Router();

router.use(protectRoute);

router.get('/get', getMonthlyReport);
router.get('/compile', autoCompileMonthlyReport);
router.post('/save', saveMonthlyReport);
router.post('/md-approval', updateMDApproval);

export default router;
