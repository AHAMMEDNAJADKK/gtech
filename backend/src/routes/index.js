import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import leadRoutes from './lead.routes.js';
import academyRoutes from './academy.routes.js';
import studentFeeRoutes from './studentFee.routes.js';
import liveClassRoutes from './liveClass.routes.js';
import certificateRoutes from './certificate.routes.js';
import edtechDashboardRoutes from './edtechDashboard.routes.js';
import attendanceRoutes from './attendance.routes.js';
import notificationRoutes from './notification.routes.js';
import accountRoutes from './account.routes.js';
import academicCounselorReportRoutes from './academicCounselorReport.routes.js';

const router = Router();

// ============================================================
// CORE EDTECH ROUTE MOUNT POINTS
// ============================================================
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/leads', leadRoutes);
router.use('/academy', academyRoutes);
router.use('/student-fees', studentFeeRoutes);
router.use('/accounts', studentFeeRoutes); // Point /accounts directly to Student Fees & Receipts
router.use('/live-classes', liveClassRoutes);
router.use('/certificates', certificateRoutes);
router.use('/edtech-dashboard', edtechDashboardRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/academic-counselor-reports', academicCounselorReportRoutes);

// Fallback legacy account endpoints maintained for backwards compatibility
router.use('/legacy-accounts', accountRoutes);

export default router;
