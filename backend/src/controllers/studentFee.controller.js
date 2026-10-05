import mongoose from 'mongoose';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import PDFDocument from 'pdfkit';
import StudentFee from '../models/studentFee.model.js';
import User from '../models/user.model.js';
import Course from '../models/course.model.js';
import Batch from '../models/batch.model.js';
import Enrollment from '../models/enrollment.model.js';
import Counter from '../models/counter.model.js';

// Initialize Razorpay client with fallback for dev/demo mode
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_edtech_dummy';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_edtech_dummy';

let razorpayInstance = null;
try {
  razorpayInstance = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret
  });
} catch (err) {
  console.warn('Razorpay initialization notice:', err.message);
}

const generateReceiptNumber = async () => {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { id: `receipt_${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `RCP-${year}-${String(counter.seq).padStart(6, '0')}`;
};

const generateFeeCode = async () => {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { id: `fee_${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `FEE-${year}-${String(counter.seq).padStart(6, '0')}`;
};

export const studentFeeController = {
  /**
   * GET /api/v1/student-fees
   * Retrieve fees with search, filters, and role-based isolation
   */
  getFees: async (req, res) => {
    try {
      const { search, courseId, batchId, status, studentId } = req.query;
      const user = req.user || {};
      const userRole = String(user.role || '').toLowerCase();
      const userRoleId = String(user.role_id || '');

      const query = {};

      // If user is a student, strictly isolate to their own fee records
      if (userRole === 'student' || userRoleId === '10') {
        query.studentId = user.id || user._id;
      } else if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        query.studentId = studentId;
      }

      if (courseId && courseId !== 'ALL' && mongoose.Types.ObjectId.isValid(courseId)) {
        query.courseId = courseId;
      }

      if (batchId && batchId !== 'ALL' && mongoose.Types.ObjectId.isValid(batchId)) {
        query.batchId = batchId;
      }

      if (status && status !== 'ALL') {
        query.status = status;
      }

      const fees = await StudentFee.find(query)
        .populate('studentId', 'name email phone studentId profile_image')
        .populate('courseId', 'courseName courseCode durationValue durationUnit')
        .populate('batchId', 'batchName batchCode')
        .sort({ createdAt: -1 })
        .lean();

      // Aggregate high-level totals
      let totalFeeAmount = 0;
      let totalPaidAmount = 0;
      let totalDueAmount = 0;

      fees.forEach(f => {
        totalFeeAmount += (f.finalAmount || 0);
        totalPaidAmount += (f.paidAmount || 0);
        totalDueAmount += (f.dueAmount || 0);
      });

      return res.status(200).json({
        success: true,
        data: fees,
        summary: {
          totalFeeAmount,
          totalPaidAmount,
          totalDueAmount,
          recordCount: fees.length
        }
      });
    } catch (error) {
      console.error('Error fetching student fees:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve fee records.', error: error.message });
    }
  },

  /**
   * GET /api/v1/student-fees/my-account
   */
  getMyFeeAccount: async (req, res) => {
    try {
      const studentId = req.user?.id || req.user?._id;
      const fees = await StudentFee.find({ studentId })
        .populate('courseId', 'courseName courseCode durationValue durationUnit')
        .populate('batchId', 'batchName batchCode startDate endDate')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, data: fees });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to retrieve fee records.', error: error.message });
    }
  },

  /**
   * GET /api/v1/student-fees/:id
   */
  getFeeById: async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid fee ID format.' });
      }

      const user = req.user || {};
      const userRole = String(user.role || '').toLowerCase();
      const userRoleId = String(user.role_id || '');

      const fee = await StudentFee.findById(id)
        .populate('studentId', 'name email phone studentId profile_image address')
        .populate('courseId', 'courseName courseCode durationValue durationUnit')
        .populate('batchId', 'batchName batchCode startDate endDate')
        .lean();

      if (!fee) {
        return res.status(404).json({ success: false, message: 'Fee record not found.' });
      }

      // Security check: student can only view own fee
      if ((userRole === 'student' || userRoleId === '10') && String(fee.studentId?._id) !== String(user.id || user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied to this fee statement.' });
      }

      return res.status(200).json({ success: true, data: fee });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to retrieve fee record.', error: error.message });
    }
  },

  /**
   * POST /api/v1/student-fees
   * Admin creates or assigns tuition plan for student
   */
  createFee: async (req, res) => {
    try {
      const { studentId, courseId, batchId, totalAmount, discountAmount = 0, installments = [], dueDate, notes } = req.body;

      if (!studentId || !courseId || !batchId || totalAmount === undefined) {
        return res.status(400).json({ success: false, message: 'studentId, courseId, batchId, and totalAmount are required.' });
      }

      const finalAmount = Math.max(0, Number(totalAmount) - Number(discountAmount));
      const feeCode = await generateFeeCode();

      // Format installments
      let formattedInstallments = [];
      if (Array.isArray(installments) && installments.length > 0) {
        formattedInstallments = installments.map((ins, idx) => ({
          installmentNumber: ins.installmentNumber || idx + 1,
          title: ins.title || `Installment ${idx + 1}`,
          dueDate: ins.dueDate ? new Date(ins.dueDate) : new Date(Date.now() + (idx + 1) * 30 * 24 * 60 * 60 * 1000),
          amount: Number(ins.amount) || 0,
          paidAmount: 0,
          status: 'PENDING'
        }));
      } else {
        // Single installment
        formattedInstallments = [{
          installmentNumber: 1,
          title: 'Full Course Tuition',
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          amount: finalAmount,
          paidAmount: 0,
          status: 'PENDING'
        }];
      }

      const newFee = await StudentFee.create({
        feeCode,
        studentId,
        courseId,
        batchId,
        totalAmount: Number(totalAmount),
        discountAmount: Number(discountAmount),
        finalAmount,
        paidAmount: 0,
        dueAmount: finalAmount,
        status: 'PENDING',
        dueDate: dueDate ? new Date(dueDate) : formattedInstallments[0]?.dueDate,
        installments: formattedInstallments,
        paymentHistory: [],
        notes: notes || '',
        createdBy: req.user?.id || req.user?._id
      });

      return res.status(201).json({
        success: true,
        message: 'Student fee account initialized successfully.',
        data: newFee
      });
    } catch (error) {
      console.error('Error creating fee record:', error);
      return res.status(500).json({ success: false, message: 'Failed to create student fee account.', error: error.message });
    }
  },

  /**
   * POST /api/v1/student-fees/:id/record-payment
   * Record payment (Cash, UPI, Bank Transfer, etc.) and generate receipt
   */
  recordPayment: async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod, transactionId, installmentIndex, notes } = req.body;

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
      }

      const fee = await StudentFee.findById(id);
      if (!fee) {
        return res.status(404).json({ success: false, message: 'Fee record not found.' });
      }

      const receiptNo = await generateReceiptNumber();

      // Update installment if specified
      if (installmentIndex !== undefined && installmentIndex >= 0 && fee.installments[installmentIndex]) {
        const targetIns = fee.installments[installmentIndex];
        targetIns.paidAmount = (targetIns.paidAmount || 0) + numAmount;
        if (targetIns.paidAmount >= targetIns.amount) {
          targetIns.status = 'PAID';
        } else {
          targetIns.status = 'PARTIALLY_PAID';
        }
        targetIns.paidDate = new Date();
        targetIns.paymentMethod = paymentMethod || 'Online';
        targetIns.receiptNo = receiptNo;
      }

      // Append to payment history
      fee.paymentHistory.push({
        receiptNo,
        amount: numAmount,
        paymentDate: new Date(),
        paymentMethod: paymentMethod || 'Online - Razorpay',
        transactionId: transactionId || `TXN-${Date.now()}`,
        installmentIndex: installmentIndex !== undefined ? installmentIndex : -1,
        notes: notes || 'Tuition fee installment receipt',
        recordedBy: req.user?.id || req.user?._id,
        gatewayStatus: 'SUCCESS'
      });

      // Recalculate totals
      fee.paidAmount = (fee.paidAmount || 0) + numAmount;
      fee.dueAmount = Math.max(0, fee.finalAmount - fee.paidAmount);

      if (fee.dueAmount === 0) {
        fee.status = 'PAID';
      } else {
        fee.status = 'PARTIALLY_PAID';
      }

      fee.updatedBy = req.user?.id || req.user?._id;
      await fee.save();

      return res.status(200).json({
        success: true,
        message: 'Payment recorded and receipt generated successfully.',
        data: {
          receiptNo,
          fee
        }
      });
    } catch (error) {
      console.error('Error recording payment:', error);
      return res.status(500).json({ success: false, message: 'Failed to record fee payment.', error: error.message });
    }
  },

  /**
   * POST /api/v1/student-fees/payments/create-order
   * Online Checkout: Razorpay Order Creation
   */
  createOnlineOrder: async (req, res) => {
    try {
      const { feeId, amount, installmentIndex } = req.body;
      const numAmount = Number(amount);

      if (!feeId || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Valid feeId and amount are required.' });
      }

      const fee = await StudentFee.findById(feeId);
      if (!fee) {
        return res.status(404).json({ success: false, message: 'Fee statement not found.' });
      }

      const receiptNo = await generateReceiptNumber();
      const amountInPaise = Math.round(numAmount * 100);

      let razorpayOrder = null;
      try {
        if (razorpayInstance && process.env.RAZORPAY_KEY_SECRET) {
          razorpayOrder = await razorpayInstance.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: receiptNo,
            notes: {
              feeId: String(fee._id),
              feeCode: fee.feeCode,
              installmentIndex: String(installmentIndex ?? -1)
            }
          });
        }
      } catch (rzpErr) {
        console.warn('Razorpay live order create warning, generating test order ID:', rzpErr.message);
      }

      // Mock/Sandbox Order fallback if keys are test/dummy
      if (!razorpayOrder) {
        razorpayOrder = {
          id: `order_test_${Date.now()}`,
          amount: amountInPaise,
          currency: 'INR',
          receipt: receiptNo,
          status: 'created'
        };
      }

      return res.status(200).json({
        success: true,
        order: razorpayOrder,
        key: razorpayKeyId,
        receiptNo
      });
    } catch (error) {
      console.error('Create Online Order Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to initiate payment gateway checkout.', error: error.message });
    }
  },

  /**
   * POST /api/v1/student-fees/payments/verify
   * Verify online payment and record successful checkout
   */
  verifyOnlinePayment: async (req, res) => {
    try {
      const {
        feeId,
        amount,
        installmentIndex,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        receiptNo
      } = req.body;

      const fee = await StudentFee.findById(feeId);
      if (!fee) {
        return res.status(404).json({ success: false, message: 'Fee record not found.' });
      }

      // Verify signature if secret provided and not a test order
      let isSignatureValid = true;
      if (process.env.RAZORPAY_KEY_SECRET && razorpaySignature && razorpayOrderId && !razorpayOrderId.startsWith('order_test_')) {
        const body = `${razorpayOrderId}|${razorpayPaymentId}`;
        const expectedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(body.toString())
          .digest('hex');

        isSignatureValid = (expectedSignature === razorpaySignature);
      }

      if (!isSignatureValid) {
        return res.status(400).json({ success: false, message: 'Payment gateway signature verification failed.' });
      }

      const finalReceiptNo = receiptNo || await generateReceiptNumber();
      const numAmount = Number(amount) || 0;

      // Update installment
      const idx = Number(installmentIndex);
      if (!isNaN(idx) && idx >= 0 && fee.installments[idx]) {
        const ins = fee.installments[idx];
        ins.paidAmount = (ins.paidAmount || 0) + numAmount;
        ins.status = ins.paidAmount >= ins.amount ? 'PAID' : 'PARTIALLY_PAID';
        ins.paidDate = new Date();
        ins.paymentMethod = 'Online - Razorpay';
        ins.receiptNo = finalReceiptNo;
      }

      // Record in payment history
      fee.paymentHistory.push({
        receiptNo: finalReceiptNo,
        amount: numAmount,
        paymentDate: new Date(),
        paymentMethod: 'Online - Razorpay',
        transactionId: razorpayPaymentId || `PAY-${Date.now()}`,
        installmentIndex: isNaN(idx) ? -1 : idx,
        gatewayOrderId: razorpayOrderId || '',
        gatewayPaymentId: razorpayPaymentId || '',
        gatewaySignature: razorpaySignature || '',
        gatewayStatus: 'SUCCESS',
        recordedBy: req.user?.id || req.user?._id,
        notes: 'Online checkout payment via Razorpay'
      });

      fee.paidAmount = (fee.paidAmount || 0) + numAmount;
      fee.dueAmount = Math.max(0, fee.finalAmount - fee.paidAmount);
      fee.status = fee.dueAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
      await fee.save();

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully. Receipt generated.',
        receiptNo: finalReceiptNo,
        fee
      });
    } catch (error) {
      console.error('Verify Online Payment Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to complete payment verification.', error: error.message });
    }
  },

  /**
   * GET /api/v1/student-fees/receipts/:receiptNo/pdf
   * Render and download printable fee receipt PDF
   */
  downloadReceiptPdf: async (req, res) => {
    try {
      const { receiptNo } = req.params;

      const fee = await StudentFee.findOne({ 'paymentHistory.receiptNo': receiptNo })
        .populate('studentId', 'name email phone studentId')
        .populate('courseId', 'courseName courseCode')
        .populate('batchId', 'batchName batchCode')
        .lean();

      if (!fee) {
        return res.status(404).json({ success: false, message: 'Receipt not found.' });
      }

      const payment = fee.paymentHistory.find(p => p.receiptNo === receiptNo);
      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment record not found for receipt.' });
      }

      const doc = new PDFDocument({ margin: 40, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Receipt_${receiptNo}.pdf"`);

      doc.pipe(res);

      const primary = '#4f46e5';
      const textDark = '#0f172a';
      const textMuted = '#64748b';

      // Header Banner
      doc.rect(40, 40, 515, 60).fill('#f8fafc');
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(20).text('EDTECH ACADEMY', 55, 50);
      doc.fillColor(textMuted).font('Helvetica').fontSize(9).text('Official Tuition Fee Payment Receipt', 55, 75);

      doc.fillColor(textDark).font('Helvetica-Bold').fontSize(12).text('RECEIPT', 400, 50, { align: 'right' });
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(10).text(receiptNo, 400, 68, { align: 'right' });

      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, 110).lineTo(555, 110).stroke();

      // Details Block
      const startY = 130;
      doc.fillColor(textDark).font('Helvetica-Bold').fontSize(11).text('STUDENT INFORMATION', 40, startY);
      doc.font('Helvetica').fontSize(9).fillColor(textMuted);
      doc.text(`Name: ${fee.studentId?.name || 'N/A'}`, 40, startY + 18);
      doc.text(`Student ID: ${fee.studentId?.studentId || 'N/A'}`, 40, startY + 32);
      doc.text(`Email: ${fee.studentId?.email || 'N/A'}`, 40, startY + 46);
      doc.text(`Phone: ${fee.studentId?.phone || 'N/A'}`, 40, startY + 60);

      doc.fillColor(textDark).font('Helvetica-Bold').fontSize(11).text('PAYMENT DETAILS', 300, startY);
      doc.font('Helvetica').fontSize(9).fillColor(textMuted);
      doc.text(`Payment Date: ${new Date(payment.paymentDate).toLocaleDateString('en-IN')}`, 300, startY + 18);
      doc.text(`Payment Method: ${payment.paymentMethod}`, 300, startY + 32);
      doc.text(`Transaction ID: ${payment.transactionId || 'N/A'}`, 300, startY + 46);
      doc.text(`Fee Statement ID: ${fee.feeCode}`, 300, startY + 60);

      // Line items table
      const tableY = 220;
      doc.rect(40, tableY, 515, 24).fill(primary);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      doc.text('DESCRIPTION', 50, tableY + 7);
      doc.text('COURSE / BATCH', 250, tableY + 7);
      doc.text('AMOUNT (INR)', 450, tableY + 7, { align: 'right' });

      doc.rect(40, tableY + 24, 515, 30).fill('#ffffff');
      doc.strokeColor('#e2e8f0').lineWidth(1).rect(40, tableY + 24, 515, 30).stroke();
      doc.fillColor(textDark).font('Helvetica').fontSize(9);
      doc.text(payment.notes || 'Tuition Fee Installment Payment', 50, tableY + 34);
      doc.text(`${fee.courseId?.courseName || 'Course'} (${fee.batchId?.batchName || 'Batch'})`, 250, tableY + 34);
      doc.font('Helvetica-Bold').text(`Rs. ${Number(payment.amount).toLocaleString('en-IN')}`, 450, tableY + 34, { align: 'right' });

      // Summary
      const summaryY = 280;
      doc.rect(300, summaryY, 255, 75).fill('#f1f5f9');
      doc.fillColor(textDark).font('Helvetica').fontSize(9);
      doc.text('Total Course Fee:', 315, summaryY + 12);
      doc.text(`Rs. ${Number(fee.finalAmount).toLocaleString('en-IN')}`, 480, summaryY + 12, { align: 'right' });

      doc.text('Total Paid Till Date:', 315, summaryY + 30);
      doc.fillColor('#15803d').font('Helvetica-Bold').text(`Rs. ${Number(fee.paidAmount).toLocaleString('en-IN')}`, 480, summaryY + 30, { align: 'right' });

      doc.fillColor(textDark).font('Helvetica').text('Balance Due:', 315, summaryY + 48);
      doc.fillColor('#b91c1c').font('Helvetica-Bold').text(`Rs. ${Number(fee.dueAmount).toLocaleString('en-IN')}`, 480, summaryY + 48, { align: 'right' });

      // Footer
      doc.fillColor(textMuted).font('Helvetica').fontSize(8);
      doc.text('This is a computer-generated receipt for official tuition fee records.', 40, 420, { align: 'center', width: 515 });

      doc.end();
    } catch (error) {
      console.error('Error downloading receipt PDF:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate receipt PDF.', error: error.message });
    }
  }
};

export default studentFeeController;
