import { Router } from 'express';
import protectRoute, { requireAdminOrStaff } from '../middleware/auth.middleware.js';
import liveClassController from '../controllers/liveClass.controller.js';

const router = Router();

router.use(protectRoute);

router.get('/', liveClassController.getLiveClasses);
router.get('/:id', liveClassController.getLiveClassById);
router.post('/', requireAdminOrStaff, liveClassController.createLiveClass);
router.put('/:id', requireAdminOrStaff, liveClassController.updateLiveClass);
router.patch('/:id/status', requireAdminOrStaff, liveClassController.updateStatus);
router.delete('/:id', requireAdminOrStaff, liveClassController.deleteLiveClass);

export default router;
