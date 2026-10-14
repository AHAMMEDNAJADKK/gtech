// src/routes/attendance.routes.js
import { Router } from 'express';
import protectRoute from '../middleware/auth.middleware.js'; 
import { 
  checkIn, 
  checkOut, 
  getAttendanceByDate, 
  getAllAttendanceByDate, 
  markUserAttendance,
  getMyShift,
  getMyHistory,
  getAttendanceSummary
} from '../controllers/attendance.controller.js';

const router = Router();

// Secure all endpoints below this line
router.use(protectRoute);

// Place explicit paths BEFORE dynamic parameters (:date)
router.get('/my-shift', getMyShift);
router.get('/my-history', getMyHistory);
router.get('/summary', getAttendanceSummary);
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.post('/mark-user', markUserAttendance);
router.get('/all/:date', getAllAttendanceByDate);
router.get('/:date', getAttendanceByDate);

export default router;
