import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import EmployeeReports from '../models/employeeReports.model.js';
import User from '../models/user.model.js';
import Department from '../modules/departments/department.model.js';
import Designation from '../models/designation.model.js';
import DeveloperReport from '../models/developerReport.model.js';
import GraphicDesignerReport from '../models/graphicDesignerReport.model.js';
import HodRdReport from '../models/hodRdReport.model.js';
import HodMarketingReport from '../models/hodMarketingReport.model.js';
import HrReport from '../models/hrReport.model.js';
import MarketingReport from '../models/marketingReport.model.js';
import OpsReport from '../models/opsReport.model.js';
import VideographerReport from '../models/videographerReport.model.js';
import AcademicCounselorReport from '../models/academicCounselorReport.model.js';
import AccountantReport from '../models/accountantReport.model.js';
import { generateReportPDFBuffer } from '../utils/pdfGenerator.js';
import { v2 as cloudinary } from 'cloudinary';
import { sendSuccess, sendError } from '../utils/response.helper.js';

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper: Upload PDF buffer to Cloudinary
// Uses chunked upload for large files (> 9MB) to bypass the 10MB single-request limit
const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks
const LARGE_FILE_THRESHOLD = 9 * 1024 * 1024; // 9MB threshold

const uploadToCloudinary = (fileBuffer, userId, filenameKey) => {
  const uploadOptions = {
    folder: `admin-reports/employee_${userId}`,
    public_id: `report_${filenameKey}`,
    resource_type: 'raw', // Critical for PDF uploads
    format: 'pdf',
    overwrite: true
  };

  return new Promise((resolve, reject) => {
    // Use chunked upload for large files to avoid the 10MB Cloudinary limit
    if (fileBuffer.length > LARGE_FILE_THRESHOLD) {
      console.log(`[Cloudinary] Large file detected (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB) - using chunked upload`);
      const stream = cloudinary.uploader.upload_chunked_stream(
        { ...uploadOptions, chunk_size: CHUNK_SIZE },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(fileBuffer);
    } else {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(fileBuffer);
    }
  });
};

// Helper: Check if logged-in user is authorized to access a target user's reports
const isAuthorizedToAccessUser = async (reqUser, targetUserId) => {
  if (!reqUser) return false;
  
  const loggedInUserId = reqUser.id || reqUser._id;
  const loggedInUserRole = String(reqUser.role || '').toLowerCase().trim();
  const loggedInRoleId = String(reqUser.role_id || reqUser.roleId || '').trim();
  
  let isHrAdminDept = false;
  let currentUserObj = null;

  if (loggedInUserId) {
    currentUserObj = await User.findById(loggedInUserId).populate('departmentId', 'name');
    const deptName = String(currentUserObj?.departmentId?.name || currentUserObj?.department || reqUser.department || '').toLowerCase().trim();
    isHrAdminDept = ['hr', 'admin', 'hr/admin', 'non-operational'].some(d => deptName.includes(d));
  }

  const isSuperAdmin = reqUser?.isSuperAdmin === true || reqUser?.is_super_admin === true || loggedInUserRole === 'superadmin' || loggedInRoleId === '0';
  const isAdmin = loggedInUserRole === 'admin' || loggedInRoleId === '1';
  const isHr = loggedInUserRole === 'hr' || loggedInRoleId === '2';

  const isPrivileged = isSuperAdmin || isAdmin || isHr || isHrAdminDept || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(loggedInUserRole) || ['0', '1', '2'].includes(loggedInRoleId);

  // Privileged roles & HR/ADMIN department members can see everything
  if (isPrivileged) return true;

  // Users can see their own reports
  if (loggedInUserId && String(loggedInUserId) === String(targetUserId)) return true;

  if (loggedInUserId) {
    // Check if the logged-in user is a Team Lead or Manager of the target user's department
    const Department = (await import('../modules/departments/department.model.js')).default;
    const UserDepartment = (await import('../models/userDepartment.model.js')).default;

    if (!currentUserObj) {
      currentUserObj = await User.findById(loggedInUserId).select('departmentId department designation isTeamLead is_team_lead');
    }

    const designationName = String(currentUserObj?.designation || '').toLowerCase();
    let userDeptId = reqUser.departmentId || currentUserObj?.departmentId;
    let userDeptName = currentUserObj?.department;

    const isRoleBasedTeamLead = (
      reqUser?.isTeamLead === true ||
      reqUser?.is_team_lead === true ||
      currentUserObj?.isTeamLead === true ||
      currentUserObj?.is_team_lead === true ||
      loggedInUserRole.includes('manager') ||
      loggedInUserRole.includes('lead') ||
      loggedInUserRole.includes('hod') ||
      designationName.includes('manager') ||
      designationName.includes('lead') ||
      designationName.includes('hod') ||
      loggedInUserRole === '2'
    );

    const ledDepartments = await Department.find({ managerId: loggedInUserId }).select('_id name');
    let deptIds = ledDepartments.map(d => d._id);
    let deptNames = ledDepartments.map(d => d.name).filter(Boolean);

    if (isRoleBasedTeamLead && deptIds.length === 0) {
       if (userDeptId) {
         deptIds.push(userDeptId);
         try {
           const fallbackDept = await Department.findById(userDeptId).select('name');
           if (fallbackDept && fallbackDept.name) {
             deptNames.push(fallbackDept.name);
           }
         } catch (err) {}
       }
       if (userDeptName) {
         deptNames.push(userDeptName);
       }
    }

    if (deptIds.length > 0 || deptNames.length > 0) {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) return false;

      const ledDeptIdsStr = deptIds.map(d => String(d));
      
      // Direct departmentId match
      if (targetUser.departmentId && ledDeptIdsStr.includes(String(targetUser.departmentId))) {
        return true;
      }
      
      // Department string match
      if (targetUser.department && deptNames.includes(targetUser.department)) {
        return true;
      }

      // UserDepartment mapping check
      const userDeptMapping = await UserDepartment.findOne({
        userId: targetUserId,
        departmentId: { $in: deptIds }
      });
      if (userDeptMapping) return true;
    }
  }

  return false;
};

// Helper: Map report type slug to Mongoose model
const getReportModel = (type) => {
  const normalized = String(type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  switch (normalized) {
    case 'developer':
      return DeveloperReport;
    case 'graphicdesigner':
      return GraphicDesignerReport;
    case 'hodrd':
    case 'hodrnd':
      return HodRdReport;
    case 'hodmarketing':
    case 'hod-marketing':
      return HodMarketingReport;
    case 'hr':
      return HrReport;
    case 'marketing':
      return MarketingReport;
    case 'ops':
      return OpsReport;
    case 'videographer':
      return VideographerReport;
    case 'academiccounselor':
      return AcademicCounselorReport;
    case 'accountant':
      return AccountantReport;
    default:
      return null;
  }
};

export const employeeReportPDFController = {
  /**
   * 1. Generate Daily PDF on the server, upload to Cloudinary,
   * and serve back to browser as downloadable attachment.
   */
  async generatePDFReport(req, res, next) {
    try {
      const { userId, dateString, reportType, reportPeriod } = req.query;
      const period = reportPeriod || 'daily';

      if (!userId || !dateString) {
        return res.status(400).json({
          success: false,
          message: 'userId and dateString are required query parameters'
        });
      }

      // Check authorization
      const isAuthorized = await isAuthorizedToAccessUser(req.user, userId);
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to view this report.'
        });
      }

      // Fetch the employee details
      const employee = await User.findById(userId).populate('designationId');
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Determine the report model dynamically
      let finalReportType = reportType;
      if (!finalReportType) {
        const desig = (employee.designation || employee.designationId?.name || '').toLowerCase();
        if (desig.includes('developer')) finalReportType = 'developer';
        else if (desig.includes('graphic')) finalReportType = 'graphicdesigner';
        else if (desig.includes('hod') || desig.includes('r&d')) finalReportType = 'hodrd';
        else if (desig.includes('hr')) finalReportType = 'hr';
        else if (desig.includes('marketing')) finalReportType = 'marketing';
        else if (desig.includes('ops') || desig.includes('operations')) finalReportType = 'ops';
        else if (desig.includes('video')) finalReportType = 'videographer';
        else if (desig.includes('counselor')) finalReportType = 'academiccounselor';
        else if (desig.includes('accountant')) finalReportType = 'accountant';
      }

      const ReportModel = getReportModel(finalReportType);
      if (!ReportModel) {
        return res.status(400).json({
          success: false,
          message: `Unable to map report type '${finalReportType || 'unknown'}' to a daily report template.`
        });
      }

      // Query the report document
      const report = await ReportModel.findOne({ userId, dateString });
      if (!report) {
        return res.status(404).json({
          success: false,
          message: `Report not found for employee on date ${dateString}.`
        });
      }

      const designationName = employee.designation || employee.designationId?.name || finalReportType;

      // Generate the PDF using pdfkit utility
      const pdfBuffer = await generateReportPDFBuffer(report, employee.name, designationName);

      const cleanFilename = `${finalReportType || 'Report'}_${period.charAt(0).toUpperCase() + period.slice(1)}_${employee.name.replace(/[^a-zA-Z0-9]/g, '_')}_${dateString}.pdf`;

      // Upload the PDF to Cloudinary dynamically using employee ID folder
      let uploadResult = null;
      try {
        uploadResult = await uploadToCloudinary(pdfBuffer, userId, `${dateString}_${period}`);
      } catch (uploadError) {
        console.error('Error uploading PDF to Cloudinary (ignoring to allow local download):', uploadError.message);
      }

      if (uploadResult) {
        // Save or update the record in EmployeeReports model
        await EmployeeReports.findOneAndUpdate(
          { employee_id: userId, report_date: dateString, report_period: period },
          {
            pdf_url: uploadResult.secure_url,
            pdf_public_id: uploadResult.public_id,
            filename: cleanFilename,
            employee_id: userId,
            report_date: dateString,
            report_type: finalReportType || period,
            report_period: period,
            created_at: new Date()
          },
          { upsert: true, new: true }
        );
      }

      // Serve the PDF back to the browser as a downloadable attachment
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (error) {
      console.error('Error in generatePDFReport:', error.message);
      next(error);
    }
  },

  /**
   * 2. Upload compiled PDF report (for weekly/monthly) to Cloudinary and register in database
   */
  async uploadPDFReport(req, res, next) {
    try {
      let { userId, reportDate, reportType, reportPeriod } = req.body;
      
      if (!userId || userId === 'undefined' || userId === 'null' || userId === '') {
        userId = req.user?.id || req.user?._id;
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'PDF file is required'
        });
      }

      if (!userId || !reportDate || !reportType || !reportPeriod) {
        return res.status(400).json({
          success: false,
          message: 'userId, reportDate, reportType, and reportPeriod are required fields'
        });
      }

      // Get file buffer (handles both memoryStorage and diskStorage)
      const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);

      // Generate filename based on details
      const cleanFilename = req.file.originalname || `${reportType}_${reportPeriod}_${reportDate}.pdf`;

      // Save a local copy on disk
      let localUrl = '';
      try {
        const uploadDir = path.join(process.cwd(), 'uploads', 'employee-reports');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const safeName = `${userId}_${reportPeriod}_${cleanFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        if (fileBuffer) {
          fs.writeFileSync(path.join(uploadDir, safeName), fileBuffer);
        } else if (req.file.path && fs.existsSync(req.file.path)) {
          fs.copyFileSync(req.file.path, path.join(uploadDir, safeName));
        }
        localUrl = `/uploads/employee-reports/${safeName}`;
      } catch (fsErr) {
        console.warn('Local PDF file write warning:', fsErr.message);
      }

      // Upload to Cloudinary under the employee folder if configured
      let uploadResult = null;
      if (fileBuffer && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        try {
          uploadResult = await uploadToCloudinary(fileBuffer, userId, `${reportDate.replace(/[^a-zA-Z0-9_-]/g, '_')}_${reportPeriod}`);
        } catch (cloudErr) {
          console.warn('Cloudinary upload failed (using local storage & DB buffer):', cloudErr.message);
        }
      }

      // Save to database with binary buffer
      const reportRecord = await EmployeeReports.findOneAndUpdate(
        { employee_id: userId, report_date: reportDate, report_period: reportPeriod },
        {
          pdf_url: uploadResult?.secure_url || localUrl || '',
          pdf_public_id: uploadResult?.public_id || '',
          ...(fileBuffer ? { pdf_data: fileBuffer } : {}),
          filename: cleanFilename,
          employee_id: userId,
          report_date: reportDate,
          report_type: reportType,
          report_period: reportPeriod,
          created_at: new Date()
        },
        { upsert: true, new: true }
      );

      return sendSuccess(res, 'PDF Report uploaded successfully', reportRecord, 201);
    } catch (error) {
      console.error('Error in uploadPDFReport:', error.message);
      next(error);
    }
  },

  /**
   * 3. Get all PDF reports uploaded for a user with sorting by date (newest/oldest)
   */
  async getPDFReportsByUser(req, res, next) {
    try {
      const { userId, sort } = req.query;

      if (userId && userId !== 'all') {
        const isAuthorized = await isAuthorizedToAccessUser(req.user, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You are not authorized to view these reports.'
          });
        }
      }

      // Determine sort order: descending (newest first) by default
      const sortOrder = sort === 'oldest' ? 1 : -1;

      let pdfQuery = {};
      let userQuery = {};

      if (userId && userId !== 'all') {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const objId = new mongoose.Types.ObjectId(userId);
          pdfQuery = { $or: [{ employee_id: objId }, { employee_id: String(userId) }, { userId: objId }, { userId: String(userId) }] };
          userQuery = {
            $or: [
              { userId: objId },
              { userId: String(userId) },
              { employee_id: objId },
              { employee_id: String(userId) },
              { user: objId },
              { user: String(userId) },
              { 'basicDetails.employeeId': String(userId) }
            ]
          };
        } else {
          pdfQuery = { $or: [{ employee_id: String(userId) }, { userId: String(userId) }] };
          userQuery = {
            $or: [
              { userId: String(userId) },
              { employee_id: String(userId) },
              { user: String(userId) },
              { 'basicDetails.employeeId': String(userId) }
            ]
          };
        }
      }

      // 1. Fetch manual PDF file uploads
      const pdfUploads = await EmployeeReports.find(pdfQuery).lean();

      // 2. Fetch saved shift reports from all 10 report collections for this employee
      const [
        devReports,
        gdReports,
        hodReports,
        hrReports,
        mktReports,
        opsReports,
        videoReports,
        counselorReports,
        acctReports,
        hodMktReports
      ] = await Promise.all([
        DeveloperReport.find(userQuery).lean(),
        GraphicDesignerReport.find(userQuery).lean(),
        HodRdReport.find(userQuery).lean(),
        HrReport.find(userQuery).lean(),
        MarketingReport.find(userQuery).lean(),
        OpsReport.find(userQuery).lean(),
        VideographerReport.find(userQuery).lean(),
        AcademicCounselorReport.find(userQuery).lean(),
        AccountantReport.find(userQuery).lean(),
        HodMarketingReport.find(userQuery).lean()
      ]);

      const baseUrl = process.env.VITE_API_URL || '/api';
      const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl.replace(/\/+$/, '')}/v1`;

      const mapShiftReport = (doc, reportType, reportTypeSlug) => ({
        _id: doc._id,
        employee_id: doc.userId || doc.employee_id,
        report_date: doc.dateString || doc.basicDetails?.date || (doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : ''),
        report_period: doc.reportPeriod || 'daily',
        report_type: reportType,
        filename: `${reportType}_Report_${doc.dateString || 'saved'}.pdf`,
        pdf_url: `${cleanBase}/employee-reports/generate-pdf?userId=${doc.userId || doc.employee_id}&dateString=${doc.dateString}&reportType=${reportTypeSlug}`,
        created_at: doc.createdAt || doc.updatedAt || new Date(),
        isShiftReport: true,
        basicDetails: doc.basicDetails
      });

      const shiftReports = [
        ...devReports.map(d => mapShiftReport(d, 'Developer', 'developer')),
        ...gdReports.map(d => mapShiftReport(d, 'Graphic Designer', 'graphic-designer')),
        ...hodReports.map(d => mapShiftReport(d, 'HOD R&D', 'hod-rd')),
        ...hodMktReports.map(d => mapShiftReport(d, 'HOD Marketing', 'hod-marketing')),
        ...hrReports.map(d => mapShiftReport(d, 'HR', 'hr')),
        ...mktReports.map(d => mapShiftReport(d, 'Marketing', 'marketing')),
        ...opsReports.map(d => mapShiftReport(d, 'Ops', 'ops')),
        ...videoReports.map(d => mapShiftReport(d, 'Videographer', 'videographer')),
        ...counselorReports.map(d => mapShiftReport(d, 'Academic Counselor', 'academic-counselor')),
        ...acctReports.map(d => mapShiftReport(d, 'Accountant', 'accountant'))
      ];

      // Merge and deduplicate by (report_date + '_' + report_period)
      const reportMap = new Map();

      // 1. Add shiftReports (JSON database records)
      shiftReports.forEach(report => {
        const dateKey = String(report.report_date || '').trim();
        const periodKey = String(report.report_period || 'daily').toLowerCase().trim();
        const key = `${dateKey}_${periodKey}`;
        reportMap.set(key, report);
      });

      // 2. Merge pdfUploads (Cloudinary compiled PDF uploads take priority for pdf_url IF valid)
      pdfUploads.forEach(upload => {
        const dateKey = String(upload.report_date || '').trim();
        const periodKey = String(upload.report_period || 'daily').toLowerCase().trim();
        const key = `${dateKey}_${periodKey}`;
        if (reportMap.has(key)) {
          const existing = reportMap.get(key);
          const hasValidPdf = Boolean(upload.pdf_public_id || upload.pdf_url);
          reportMap.set(key, {
            ...existing,
            ...upload,
            _id: hasValidPdf ? (upload._id || existing._id) : existing._id,
            shiftReportId: existing._id,
            pdf_url: (hasValidPdf && upload.pdf_url) ? upload.pdf_url : existing.pdf_url,
            created_at: upload.created_at || existing.created_at
          });
        } else {
          reportMap.set(key, upload);
        }
      });

      const combined = Array.from(reportMap.values());

      // Sort by report_date / created_at
      combined.sort((a, b) => {
        const dA = new Date(a.report_date || a.created_at);
        const dB = new Date(b.report_date || b.created_at);
        return sortOrder === 1 ? dA - dB : dB - dA;
      });

      return sendSuccess(res, 'PDF Reports retrieved successfully', combined, 200);
    } catch (error) {
      console.error('Error in getPDFReportsByUser:', error.message);
      next(error);
    }
  },

  /**
   * 4. Stream a saved PDF report (weekly/monthly/daily) from Cloudinary by its DB record _id.
   *    Uses cloudinary.utils.private_download_url to generate a signed URL so that
   *    Cloudinary's raw-delivery auth is satisfied (plain URLs return 401 for raw resources).
   */
  async streamSavedPDFReport(req, res, next) {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        return res.status(400).json({ success: false, message: 'reportId is required' });
      }

      let record = await EmployeeReports.findById(reportId).select('+pdf_data');
      if (!record) {
        // If not found in EmployeeReports (manual file uploads), search across all 9 department shift report collections!
        const shiftReportModels = [
          { model: DeveloperReport, type: 'developer' },
          { model: GraphicDesignerReport, type: 'graphicdesigner' },
          { model: HodRdReport, type: 'hodrd' },
          { model: HodMarketingReport, type: 'hod-marketing' },
          { model: HrReport, type: 'hr' },
          { model: MarketingReport, type: 'marketing' },
          { model: OpsReport, type: 'ops' },
          { model: VideographerReport, type: 'videographer' },
          { model: AcademicCounselorReport, type: 'academiccounselor' },
          { model: AccountantReport, type: 'accountant' }
        ];

        let foundShiftDoc = null;
        let foundTypeSlug = null;
        for (const item of shiftReportModels) {
          const doc = await item.model.findById(reportId);
          if (doc) {
            foundShiftDoc = doc;
            foundTypeSlug = item.type;
            break;
          }
        }

        if (foundShiftDoc) {
          const empUserId = foundShiftDoc.userId || foundShiftDoc.employee_id;
          const isAuthorized = await isAuthorizedToAccessUser(req.user, empUserId);
          if (!isAuthorized) {
            return res.status(403).json({
              success: false,
              message: 'Access denied. You are not authorized to stream this report.'
            });
          }

          const employee = await User.findById(empUserId).populate('designationId');
          const designationName = employee?.designation || employee?.designationId?.name || foundTypeSlug;
          const pdfBuffer = await generateReportPDFBuffer(foundShiftDoc, employee?.name || 'Employee', designationName);

          const dateStr = foundShiftDoc.dateString || foundShiftDoc.basicDetails?.date || 'saved';
          const filename = `${foundTypeSlug}_Report_${dateStr}.pdf`;

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Length', pdfBuffer.length);
          return res.end(pdfBuffer);
        }

        return res.status(404).json({ success: false, message: 'Report not found in database' });
      }

      // Check authorization
      const isAuthorized = await isAuthorizedToAccessUser(req.user, record.employee_id);
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to stream this report.'
        });
      }

      const shiftReportModels = [
        { model: DeveloperReport, type: 'developer' },
        { model: GraphicDesignerReport, type: 'graphicdesigner' },
        { model: HodRdReport, type: 'hodrd' },
        { model: HodMarketingReport, type: 'hod-marketing' },
        { model: HrReport, type: 'hr' },
        { model: MarketingReport, type: 'marketing' },
        { model: OpsReport, type: 'ops' },
        { model: VideographerReport, type: 'videographer' },
        { model: AcademicCounselorReport, type: 'academiccounselor' },
        { model: AccountantReport, type: 'accountant' }
      ];

      const generateAndStreamShiftReport = async (empId, dateStr, shiftReportId, recordDbId) => {
        let foundShiftDoc = null;
        let foundTypeSlug = null;

        if (shiftReportId) {
          for (const item of shiftReportModels) {
            const doc = await item.model.findById(shiftReportId);
            if (doc) {
              foundShiftDoc = doc;
              foundTypeSlug = item.type;
              break;
            }
          }
        }

        if (!foundShiftDoc && empId) {
          for (const item of shiftReportModels) {
            const query = {
              $or: [
                { userId: empId },
                { userId: String(empId) },
                { employee_id: empId },
                { employee_id: String(empId) },
                { 'basicDetails.employeeId': String(empId) }
              ]
            };
            if (dateStr) {
              if (dateStr.includes('_to_')) {
                const [startDate, endDate] = dateStr.split('_to_');
                query.dateString = { $gte: startDate, $lte: endDate };
              } else {
                query.dateString = dateStr;
              }
            }
            const doc = await item.model.findOne(query).sort({ dateString: -1, createdAt: -1 });
            if (doc) {
              foundShiftDoc = doc;
              foundTypeSlug = item.type;
              break;
            }
          }
        }

        // Fallback: If not found in date range, search by employee alone
        if (!foundShiftDoc && empId) {
          for (const item of shiftReportModels) {
            const query = {
              $or: [
                { userId: empId },
                { userId: String(empId) },
                { employee_id: empId },
                { employee_id: String(empId) },
                { 'basicDetails.employeeId': String(empId) }
              ]
            };
            const doc = await item.model.findOne(query).sort({ dateString: -1, createdAt: -1 });
            if (doc) {
              foundShiftDoc = doc;
              foundTypeSlug = item.type;
              break;
            }
          }
        }

        const targetEmpId = foundShiftDoc?.userId || foundShiftDoc?.employee_id || empId;
        const employee = await User.findById(targetEmpId).populate('designationId');

        if (!foundShiftDoc) {
          foundTypeSlug = record?.report_type || 'report';
          foundShiftDoc = {
            basicDetails: {
              employeeId: String(empId),
              date: dateStr || new Date().toISOString().split('T')[0],
              department: employee?.department || 'Department'
            },
            summary: `Consolidated report for period ${dateStr || ''}`
          };
        }

        const designationName = employee?.designation || employee?.designationId?.name || foundTypeSlug;
        const pdfBuffer = await generateReportPDFBuffer(foundShiftDoc, employee?.name || 'Employee', designationName);

        // Cache the buffer in EmployeeReports so future stream clicks are instantaneous
        if (recordDbId) {
          try {
            await EmployeeReports.findByIdAndUpdate(recordDbId, { $set: { pdf_data: pdfBuffer } });
          } catch (cacheErr) {}
        }

        const dateFileName = foundShiftDoc.dateString || dateStr || 'saved';
        const filenameStr = `${foundTypeSlug}_Report_${dateFileName}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameStr}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.end(pdfBuffer);
      };

      // 1. If PDF binary buffer exists directly in the database record, stream it immediately
      if (record.pdf_data) {
        const rawBuf = Buffer.isBuffer(record.pdf_data)
          ? record.pdf_data
          : (record.pdf_data.buffer ? Buffer.from(record.pdf_data.buffer) : Buffer.from(record.pdf_data));
        if (rawBuf && rawBuf.length > 0) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${record.filename || 'report.pdf'}"`);
          res.setHeader('Content-Length', rawBuf.length);
          return res.end(rawBuf);
        }
      }

      // 2. Check local disk for the stored PDF file
      const cleanName = (record.filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const baseClean = cleanName.replace(/\.pdf$/i, '');
      const localCandidates = [
        path.join(process.cwd(), 'uploads', 'employee-reports', `${record.employee_id}_${record.report_period}_${cleanName}`),
        path.join(process.cwd(), 'uploads', 'employee-reports', cleanName),
        path.join(process.cwd(), (record.pdf_url || '').replace(/^\//, ''))
      ];

      // Also search uploads/tasks/general where multer.diskStorage saves uploaded files
      try {
        const tasksDir = path.join(process.cwd(), 'uploads', 'tasks', 'general');
        if (fs.existsSync(tasksDir)) {
          const files = fs.readdirSync(tasksDir);
          const matched = files
            .filter(f => f.includes(baseClean) && f.endsWith('.pdf'))
            .sort()
            .reverse();
          if (matched.length > 0) {
            localCandidates.unshift(path.join(tasksDir, matched[0]));
          }
        }
      } catch (err) {}

      for (const candidate of localCandidates) {
        if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${record.filename || 'report.pdf'}"`);
          return fs.createReadStream(candidate).pipe(res);
        }
      }

      // 3. Check Cloudinary or external URL
      let fetchUrl = null;
      if (record.pdf_public_id && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        try {
          fetchUrl = cloudinary.utils.private_download_url(
            record.pdf_public_id,
            'pdf',
            { resource_type: 'raw', type: 'upload' }
          );
        } catch (err) {
          console.warn('Cloudinary download url failed:', err.message);
        }
      } else if (record.pdf_url && /^https?:\/\//i.test(record.pdf_url)) {
        fetchUrl = record.pdf_url;
      }

      const filename = record.filename || 'report.pdf';

      if (fetchUrl && /^https?:\/\//i.test(fetchUrl)) {
        // Helper: fetch URL with redirect-following
        const fetchAndPipe = (url, redirectsLeft) => {
          try {
            const mod = url.startsWith('https') ? https : http;
            const reqPipe = mod.get(url, (cloudRes) => {
              const { statusCode, headers } = cloudRes;

              // Follow redirects
              if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location && redirectsLeft > 0) {
                cloudRes.resume();
                return fetchAndPipe(headers.location, redirectsLeft - 1);
              }

              if (statusCode !== 200) {
                console.error(`[stream] Remote server returned ${statusCode} for ${url}, falling back to dynamic PDF generation`);
                return generateAndStreamShiftReport(record.employee_id || record.userId, record.report_date || record.dateString, record.shiftReportId, record._id);
              }

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
              if (headers['content-length']) res.setHeader('Content-Length', headers['content-length']);
              cloudRes.pipe(res);
            });

            reqPipe.on('error', (err) => {
              console.error('[stream] Error fetching from remote URL:', err.message, 'falling back to dynamic PDF generation');
              generateAndStreamShiftReport(record.employee_id || record.userId, record.report_date || record.dateString, record.shiftReportId, record._id);
            });
          } catch (err) {
            console.error('[stream] Synchronous URL error:', err.message, 'falling back to dynamic PDF generation');
            return generateAndStreamShiftReport(record.employee_id || record.userId, record.report_date || record.dateString, record.shiftReportId, record._id);
          }
        };

        return fetchAndPipe(fetchUrl, 5);
      }

      // 4. If neither binary buffer, local file, nor external URL is available, generate dynamically
      return generateAndStreamShiftReport(record.employee_id || record.userId, record.report_date || record.dateString, record.shiftReportId, record._id);

    } catch (error) {
      console.error('Error in streamSavedPDFReport:', error.message);
      if (!res.headersSent) next(error);
    }
  }
};
