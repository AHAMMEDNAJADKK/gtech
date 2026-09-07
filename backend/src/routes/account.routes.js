import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  updateBatchCategoryOpeningBalances,
  deleteCategory,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveOrRejectExpense,
  getSalaryPayments,
  createSalaryPayment,
  updateSalaryPayment,
  deleteSalaryPayment,
  approveOrRejectSalaryPayment,
  approveAllSalaryPayments,
  sendSalaryPayslipEmail,
  getCashBook,
  getDailyReport,
  getMonthlyReport,
  getCategoryWiseReport,
  getSalaryReport,
  getIncomes,
  getIncomeById,
  createIncome,
  updateIncome,
  deleteIncome,
  restoreIncome,
  convertProformaToInvoice,
  permanentDeleteIncome,
  recordPaymentSettlement,
  updatePaymentSettlement,
  deletePaymentSettlement,
  getOpeningBalance,
  setOpeningBalance,
  getCapitals,
  createCapital,
  updateCapital,
  deleteCapital,
  addCapitalTopUp,
  getOperations,
  createOperation,
  updateOperation,
  deleteOperation,
  uploadPublicPdf,
  servePublicPdf
} from '../controllers/account.controller.js';
import protectRoute from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';

const router = Router();

// ── Public Unprotected PDF Endpoint (for WhatsApp Link Sharing & Rich Preview Cards) ──
router.get('/public/pdf/:token/raw', servePublicPdf);
router.get('/public/pdf/:token', servePublicPdf);

// Protect all account routes below
router.use(protectRoute);

// PDF Upload Endpoint for WhatsApp sharing
router.post('/upload-pdf', uploadPublicPdf);
router.post('/income/upload-pdf', uploadPublicPdf);

// ── Capital Accounts Routes ──
router.get('/capital', getCapitals);
router.post('/capital', createCapital);
router.put('/capital/:id', updateCapital);
router.delete('/capital/:id', deleteCapital);
router.post('/capital/:id/topup', addCapitalTopUp);

// ── Opening Balance Routes ──
router.get('/opening-balance', getOpeningBalance);
router.post('/opening-balance', setOpeningBalance);
router.put('/opening-balance', setOpeningBalance);

// ── Income Routes ──
router.get('/income', getIncomes);
router.post('/income', createIncome);

// Specific sub-resource payment routes with :paymentId (MUST be declared first)
router.put('/income/:id/payments/:paymentId', updatePaymentSettlement);
router.put('/income/:id/payment/:paymentId', updatePaymentSettlement);
router.delete('/income/:id/payments/:paymentId', deletePaymentSettlement);
router.delete('/income/:id/payment/:paymentId', deletePaymentSettlement);

// Payment settlement routes without :paymentId
router.post('/income/:id/payment', recordPaymentSettlement);
router.put('/income/:id/payment', recordPaymentSettlement);

// Other sub-routes
router.put('/income/:id/restore', restoreIncome);
router.put('/income/:id/convert-proforma', convertProformaToInvoice);
router.delete('/income/:id/permanent', permanentDeleteIncome);

// Generic /income/:id routes
router.get('/income/:id', getIncomeById);
router.put('/income/:id', updateIncome);
router.delete('/income/:id', deleteIncome);

// ── Categories Routes ──
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/batch/opening-balances', updateBatchCategoryOpeningBalances);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// ── Expenses Routes ──
router.get('/expenses', getExpenses);
router.post('/expenses', upload.single('attachment'), createExpense);
router.put('/expenses/:id/action', approveOrRejectExpense);
router.put('/expenses/:id', upload.single('attachment'), updateExpense);
router.delete('/expenses/:id', deleteExpense);

// ── Salary Payments Routes ──
router.get('/salary-payments', getSalaryPayments);
router.post('/salary-payments', createSalaryPayment);
router.post('/salary-payments/:id/send-email', sendSalaryPayslipEmail);
router.put('/salary-payments/approve-all', approveAllSalaryPayments);
router.put('/salary-payments/:id/action', approveOrRejectSalaryPayment);
router.put('/salary-payments/:id', updateSalaryPayment);
router.delete('/salary-payments/:id', deleteSalaryPayment);

// ── Cash Book Routes ──
router.get('/cash-book', getCashBook);

// ── Operation Accounts Routes ──
router.get('/operations', getOperations);
router.post('/operations', createOperation);
router.put('/operations/:id', updateOperation);
router.delete('/operations/:id', deleteOperation);

// ── Reports Routes ──
router.get('/reports/daily', getDailyReport);
router.get('/reports/monthly', getMonthlyReport);
router.get('/reports/category-wise', getCategoryWiseReport);
router.get('/reports/salary', getSalaryReport);

export default router;
