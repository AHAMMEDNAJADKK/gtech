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
  permanentDeleteIncome,
  recordPaymentSettlement,
  updatePaymentSettlement,
  deletePaymentSettlement,
  getOpeningBalance,
  setOpeningBalance
} from '../controllers/account.controller.js';
import protectRoute from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';

const router = Router();

// Protect all account routes
router.use(protectRoute);

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

// ── Reports Routes ──
router.get('/reports/daily', getDailyReport);
router.get('/reports/monthly', getMonthlyReport);
router.get('/reports/category-wise', getCategoryWiseReport);
router.get('/reports/salary', getSalaryReport);

export default router;
