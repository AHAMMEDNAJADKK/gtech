import { Router } from 'express';
import protectRoute, { requireAdminOrStaff } from '../middleware/auth.middleware.js';
import certificateController from '../controllers/certificate.controller.js';

const router = Router();

// Public Certificate Verification Endpoint
router.get('/verify/:code', certificateController.verifyCertificate);

// Download Certificate PDF (can be accessed via link or authenticated session)
router.get('/:id/pdf', certificateController.downloadPdf);

// Protected routes
router.use(protectRoute);

router.get('/', certificateController.getCertificates);
router.get('/:id', certificateController.getCertificateById);
router.post('/', requireAdminOrStaff, certificateController.generateCertificate);
router.post('/generate', requireAdminOrStaff, certificateController.generateCertificate);

export default router;
