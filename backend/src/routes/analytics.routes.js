import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
import protectRoute, { restrictToRoles, restrictToDepartment } from '../middleware/auth.middleware.js';
import { apiRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// Secure all analytics routes with authentication, rate-limiting, and department restrictions
router.use(protectRoute);
router.use(apiRateLimiter);
router.use(restrictToDepartment(['marketing', 'digital marketing', 'admissions', 'admission', 'counselor', 'telecaller']));


// Summary Overview Metrics
router.get('/summary', analyticsController.getSummary);

// Conversion Rate Stage Funnel
router.get('/conversion-rate', analyticsController.getConversionRate);

// Staff Allocation & Performances
router.get('/staff-performance', analyticsController.getStaffPerformance);

// Channel Attribution Sources
router.get('/source-performance', analyticsController.getSourcePerformance);

// Follow-up interaction log frequencies
router.get('/followup-metrics', analyticsController.getFollowupMetrics);

export default router;
