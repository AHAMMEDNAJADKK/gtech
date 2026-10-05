import mongoose from 'mongoose';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import Certificate from '../models/certificate.model.js';
import Enrollment from '../models/enrollment.model.js';
import User from '../models/user.model.js';
import Course from '../models/course.model.js';
import Batch from '../models/batch.model.js';
import Counter from '../models/counter.model.js';

const generateCertificateId = async () => {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { id: `cert_${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `CERT-${year}-${String(counter.seq).padStart(6, '0')}`;
};

export const certificateController = {
  /**
   * POST /api/v1/certificates/generate
   * Generates completion certificate enforcing strict course completion criteria
   */
  generateCertificate: async (req, res) => {
    try {
      const { enrollmentId, studentId, courseId, finalScorePercent = 100 } = req.body;

      if (!enrollmentId && (!studentId || !courseId)) {
        return res.status(400).json({
          success: false,
          message: 'Either enrollmentId or studentId + courseId are required.'
        });
      }

      // 1. Fetch Enrollment
      let enrollment = null;
      if (enrollmentId && mongoose.Types.ObjectId.isValid(enrollmentId)) {
        enrollment = await Enrollment.findById(enrollmentId)
          .populate('studentId')
          .populate('courseId')
          .populate('batchId');
      } else {
        enrollment = await Enrollment.findOne({ studentId, courseId })
          .populate('studentId')
          .populate('courseId')
          .populate('batchId');
      }

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: 'Enrollment record not found.'
        });
      }

      // 2. Strict Completion Criteria Verification
      // Must be marked 'completed' OR have 100% progress
      const isCompleted = (
        enrollment.status === 'completed' ||
        enrollment.status === 'COMPLETED' ||
        enrollment.progressPercentage >= 100 ||
        (enrollment.completedModules > 0 && enrollment.completedModules >= enrollment.totalModules)
      );

      if (!isCompleted) {
        return res.status(400).json({
          success: false,
          message: 'Certificate cannot be generated: Student has not met the required course completion criteria. (Current Progress: ' + (enrollment.progressPercentage || 0) + '%, Status: ' + enrollment.status + ')'
        });
      }

      // 3. Check if certificate already issued for this enrollment
      const existingCert = await Certificate.findOne({
        enrollmentId: enrollment._id,
        status: 'ISSUED'
      });

      if (existingCert) {
        return res.status(200).json({
          success: true,
          message: 'Certificate already issued for this course completion.',
          data: existingCert
        });
      }

      // 4. Generate Certificate Identifiers
      const certificateId = await generateCertificateId();
      const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();

      const student = enrollment.studentId || {};
      const course = enrollment.courseId || {};
      const batch = enrollment.batchId || {};

      const completionDate = enrollment.completedAt || new Date();

      const newCert = await Certificate.create({
        certificateId,
        verificationCode,
        studentId: student._id,
        courseId: course._id,
        batchId: batch._id,
        enrollmentId: enrollment._id,
        studentName: student.name || 'Student',
        courseName: course.courseName || 'Professional Course',
        completionDate,
        finalScorePercent: Number(finalScorePercent) || 100,
        status: 'ISSUED',
        issuedBy: req.user?.id || req.user?._id
      });

      return res.status(201).json({
        success: true,
        message: 'Certificate generated successfully.',
        data: newCert
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate certificate.', error: error.message });
    }
  },

  /**
   * GET /api/v1/certificates
   * List certificates with role-based filtering
   */
  getCertificates: async (req, res) => {
    try {
      const { search, courseId } = req.query;
      const user = req.user || {};
      const userRole = String(user.role || '').toLowerCase();
      const userRoleId = String(user.role_id || '');

      const query = { status: 'ISSUED' };

      if (userRole === 'student' || userRoleId === '10') {
        query.studentId = user.id || user._id;
      }

      if (courseId && courseId !== 'ALL' && mongoose.Types.ObjectId.isValid(courseId)) {
        query.courseId = courseId;
      }

      if (search) {
        query.$or = [
          { certificateId: { $regex: search, $options: 'i' } },
          { studentName: { $regex: search, $options: 'i' } },
          { courseName: { $regex: search, $options: 'i' } }
        ];
      }

      const certificates = await Certificate.find(query)
        .populate('studentId', 'name email phone studentId profile_image')
        .populate('courseId', 'courseName courseCode durationValue durationUnit')
        .populate('batchId', 'batchName batchCode')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: certificates
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to retrieve certificates.', error: error.message });
    }
  },

  /**
   * GET /api/v1/certificates/:id
   */
  getCertificateById: async (req, res) => {
    try {
      const { id } = req.params;
      const cert = await Certificate.findById(id)
        .populate('studentId', 'name email phone studentId profile_image')
        .populate('courseId', 'courseName courseCode durationValue durationUnit')
        .populate('batchId', 'batchName batchCode')
        .lean();

      if (!cert) {
        return res.status(404).json({ success: false, message: 'Certificate not found.' });
      }

      return res.status(200).json({ success: true, data: cert });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to retrieve certificate.', error: error.message });
    }
  },

  /**
   * GET /api/v1/certificates/verify/:code
   * PUBLIC endpoint to verify certificate authenticity via QR code scan or code
   */
  verifyCertificate: async (req, res) => {
    try {
      const { code } = req.params;

      const cert = await Certificate.findOne({
        $or: [
          { verificationCode: code.toUpperCase().trim() },
          { certificateId: code.trim() }
        ],
        status: 'ISSUED'
      })
      .populate('courseId', 'courseName courseCode durationValue durationUnit')
      .populate('batchId', 'batchName batchCode')
      .lean();

      if (!cert) {
        return res.status(404).json({
          success: false,
          verified: false,
          message: 'Certificate is INVALID or does not exist in registry.'
        });
      }

      return res.status(200).json({
        success: true,
        verified: true,
        data: {
          certificateId: cert.certificateId,
          studentName: cert.studentName,
          courseName: cert.courseName,
          completionDate: cert.completionDate,
          issueDate: cert.issueDate,
          status: cert.status,
          score: cert.finalScorePercent
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Verification error.', error: error.message });
    }
  },

  /**
   * GET /api/v1/certificates/:id/pdf
   * Generate downloadable landscape Certificate PDF with vector border & QR code
   */
  downloadPdf: async (req, res) => {
    try {
      const { id } = req.params;

      const cert = await Certificate.findById(id)
        .populate('courseId')
        .populate('batchId')
        .lean();

      if (!cert) {
        return res.status(404).json({ success: false, message: 'Certificate not found.' });
      }

      // Verification URL to encode in QR code
      const baseUrl = process.env.CLIENT_URL || 'https://edtech-crm.local';
      const verificationUrl = `${baseUrl}/verify-certificate/${cert.verificationCode}`;

      // Generate QR Code PNG Buffer
      const qrBuffer = await QRCode.toBuffer(verificationUrl, {
        width: 120,
        margin: 1,
        color: { dark: '#1e1b4b', light: '#ffffff' }
      });

      // Create landscape A4 PDF (841.89 x 595.28 pt)
      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margin: 0
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Certificate_${cert.certificateId}.pdf"`);

      doc.pipe(res);

      const pageWidth = 841.89;
      const pageHeight = 595.28;

      // 1. Elegant Background & Borders
      doc.rect(0, 0, pageWidth, pageHeight).fill('#ffffff');

      // Outer gold border
      doc.rect(20, 20, pageWidth - 40, pageHeight - 40)
        .lineWidth(4)
        .strokeColor('#d97706')
        .stroke();

      // Inner navy border
      doc.rect(26, 26, pageWidth - 52, pageHeight - 52)
        .lineWidth(1.5)
        .strokeColor('#312e81')
        .stroke();

      // Thin inner boundary
      doc.rect(32, 32, pageWidth - 64, pageHeight - 64)
        .lineWidth(0.5)
        .strokeColor('#e2e8f0')
        .stroke();

      // 2. Organization Header
      doc.font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#4338ca')
        .text('EDTECH ACADEMY & TRAINING INSTITUTE', 0, 70, { align: 'center', width: pageWidth });

      doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text('CERTIFICATE OF COURSE COMPLETION', 0, 95, { align: 'center', width: pageWidth, characterSpacing: 3 });

      // Horizontal separator
      doc.strokeColor('#cbd5e1').lineWidth(1)
        .moveTo(pageWidth / 2 - 120, 115)
        .lineTo(pageWidth / 2 + 120, 115)
        .stroke();

      // 3. Presentation text
      doc.font('Helvetica')
        .fontSize(12)
        .fillColor('#475569')
        .text('This is to proudly certify that', 0, 145, { align: 'center', width: pageWidth });

      // Student Name
      doc.font('Helvetica-Bold')
        .fontSize(32)
        .fillColor('#0f172a')
        .text(cert.studentName.toUpperCase(), 0, 180, { align: 'center', width: pageWidth });

      // Line under name
      doc.strokeColor('#d97706').lineWidth(2)
        .moveTo(pageWidth / 2 - 160, 225)
        .lineTo(pageWidth / 2 + 160, 225)
        .stroke();

      // Course completion description
      doc.font('Helvetica')
        .fontSize(13)
        .fillColor('#334155')
        .text('has successfully completed the comprehensive professional curriculum in', 0, 250, { align: 'center', width: pageWidth });

      // Course Name
      doc.font('Helvetica-Bold')
        .fontSize(22)
        .fillColor('#4338ca')
        .text(cert.courseName, 0, 280, { align: 'center', width: pageWidth });

      // Date & remarks
      const formattedDate = new Date(cert.completionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.font('Helvetica')
        .fontSize(11)
        .fillColor('#64748b')
        .text(`Completed on ${formattedDate} with Distinction`, 0, 320, { align: 'center', width: pageWidth });

      // 4. Bottom Block: Certificate ID, Signatures, and QR Code
      const bottomY = 380;

      // Left Column: Certificate ID & Verification
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('CERTIFICATE DETAILS', 60, bottomY);
      doc.font('Helvetica').fontSize(8.5).fillColor('#64748b');
      doc.text(`Certificate ID: ${cert.certificateId}`, 60, bottomY + 16);
      doc.text(`Verification Code: ${cert.verificationCode}`, 60, bottomY + 30);
      doc.text(`Issue Date: ${new Date(cert.issueDate).toLocaleDateString()}`, 60, bottomY + 44);

      // Center Column: Authorized Signatory
      doc.strokeColor('#0f172a').lineWidth(1)
        .moveTo(pageWidth / 2 - 70, bottomY + 50)
        .lineTo(pageWidth / 2 + 70, bottomY + 50)
        .stroke();

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
        .text('Academic Director', pageWidth / 2 - 70, bottomY + 56, { align: 'center', width: 140 });
      doc.font('Helvetica').fontSize(8).fillColor('#64748b')
        .text('Authorized Signatory', pageWidth / 2 - 70, bottomY + 68, { align: 'center', width: 140 });

      // Right Column: QR Code & Verification Scan
      doc.image(qrBuffer, pageWidth - 165, bottomY - 10, { width: 85, height: 85 });
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#4338ca')
        .text('SCAN TO VERIFY', pageWidth - 165, bottomY + 80, { align: 'center', width: 85 });

      doc.end();
    } catch (error) {
      console.error('Error generating certificate PDF:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate certificate PDF.', error: error.message });
    }
  }
};

export default certificateController;
