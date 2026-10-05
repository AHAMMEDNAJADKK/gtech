import { Router } from 'express';
import { employeeReportPDFController } from '../controllers/employeeReportPDF.controller.js';
import checkAuth from '../middleware/auth.middleware.js';
import upload, { memoryUpload } from '../middleware/upload.middleware.js';

const router = Router();

// Secure all routes with authentication
router.use(checkAuth);

router.post('/upload', (req, res, next) => {
  memoryUpload.single('pdfFile')(req, res, (err) => {
    if (err) {
      console.warn('[Multer Memory Upload] Warning, trying disk upload fallback:', err.message);
      return upload.single('pdfFile')(req, res, next);
    }
    next();
  });
}, employeeReportPDFController.uploadPDFReport);
router.get('/generate-pdf', employeeReportPDFController.generatePDFReport);
router.get('/list', employeeReportPDFController.getPDFReportsByUser);
router.get('/stream/:reportId', employeeReportPDFController.streamSavedPDFReport);

export default router;
