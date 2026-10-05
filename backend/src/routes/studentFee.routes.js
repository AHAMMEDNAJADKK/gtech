import { Router } from 'express';
import protectRoute, { requireAdminOrStaff } from '../middleware/auth.middleware.js';
import studentFeeController from '../controllers/studentFee.controller.js';

const router = Router();

// Public Receipt Download route
router.get('/receipts/:receiptNo/pdf', studentFeeController.downloadReceiptPdf);

// Protected routes
router.use(protectRoute);

router.get('/', studentFeeController.getFees);
router.get('/my-account', studentFeeController.getMyFeeAccount);
router.get('/:id', studentFeeController.getFeeById);
router.post('/', requireAdminOrStaff, studentFeeController.createFee);
router.post('/:id/record-payment', requireAdminOrStaff, studentFeeController.recordPayment);

// Payment Gateway Checkout routes
router.post('/payments/create-order', studentFeeController.createOnlineOrder);
router.post('/payments/verify', studentFeeController.verifyOnlinePayment);

export default router;
