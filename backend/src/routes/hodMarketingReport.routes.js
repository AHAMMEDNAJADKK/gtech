import { Router } from 'express';
import protectRoute from '../middleware/auth.middleware.js';
import {
  getReportByDate,
  saveReport,
  getHodsList,
  getSubmittedDates,
  getReportsByRange
} from '../controllers/hodMarketingReport.controller.js';

const router = Router();

router.use(protectRoute);

router.get('/by-date', getReportByDate);
router.post('/', saveReport);
router.get('/hods', getHodsList);
router.get('/submitted-dates', getSubmittedDates);
router.get('/range', getReportsByRange);

export default router;
