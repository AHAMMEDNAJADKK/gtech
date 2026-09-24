import { Router } from 'express';
import protectRoute from '../middleware/auth.middleware.js';
import {
  getTodayShiftReport,
  getShiftReportByDate,
  getStaffList,
  getSubmittedDates,
  saveShiftReport,
  getMyShiftReports,
  getAllShiftReports
} from '../controllers/dailyShiftReport.controller.js';

const router = Router();

router.use(protectRoute);

router.get('/today', getTodayShiftReport);
router.get('/by-date', getShiftReportByDate);
router.get('/staff', getStaffList);
router.get('/submitted-dates', getSubmittedDates);
router.post('/save', saveShiftReport);
router.post('/', saveShiftReport);
router.get('/my-reports', getMyShiftReports);
router.get('/all', getAllShiftReports);

export default router;
