import { Router } from 'express';
import protectRoute from '../middleware/auth.middleware.js';
import {
  getWeeklyReport,
  autoCompileWeeklyReport,
  saveWeeklyReport,
  updateMDApproval
} from '../controllers/weeklyPerformanceReport.controller.js';

const router = Router();

router.use(protectRoute);

router.get('/get', getWeeklyReport);
router.get('/compile', autoCompileWeeklyReport);
router.post('/save', saveWeeklyReport);
router.post('/md-approval', updateMDApproval);

export default router;
