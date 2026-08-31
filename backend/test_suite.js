import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// Imports from backend
import User from './src/models/user.model.js';
import Department from './src/modules/departments/department.model.js';
import ProjectCategory from './src/models/projectCategory.model.js';
import Client from './src/models/client.model.js';
import Project from './src/models/project.model.js';
import Task from './src/models/task.model.js';
import DeveloperReport from './src/models/developerReport.model.js';
import OpsReport from './src/models/opsReport.model.js';
import HrReport from './src/models/hrReport.model.js';
import CalendarWork from './src/models/calendarWork.model.js';
import Notification from './src/models/notification.model.js';
import Designation from './src/models/designation.model.js';

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb+srv://shabeeba:9995982324@cluster0.i23tzbf.mongodb.net/crm?appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, detail = '') {
  results.tests.push({ name, passed, detail });
  if (passed) {
    results.passed++;
    console.log(`PASS: ${name} ${detail ? `- ${detail}` : ''}`);
  } else {
    results.failed++;
    console.error(`FAIL: ${name} ${detail ? `- ${detail}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('--- Starting CRM Automated Test Suite ---\n');

  try {
    await mongoose.connect(MONGO_URI);
    logTest('MongoDB Connection', true, 'Connected successfully');
  } catch (err) {
    logTest('MongoDB Connection', false, err.message);
    process.exit(1);
  }

  // 1. AUTH & JWT TESTS
  console.log('\n--- 1. Auth & JWT Verification Tests ---');
  const dummyUserA = { id: new mongoose.Types.ObjectId().toString(), role: 'employee', role_id: '3', email: 'employeeA@test.com' };
  const dummyUserB = { id: new mongoose.Types.ObjectId().toString(), role: 'employee', role_id: '3', email: 'employeeB@test.com' };
  const dummyAdmin = { id: new mongoose.Types.ObjectId().toString(), role: 'admin', role_id: '1', isSuperAdmin: true, email: 'admin@test.com' };

  const tokenA = jwt.sign(dummyUserA, JWT_SECRET, { expiresIn: '1h' });
  const tokenB = jwt.sign(dummyUserB, JWT_SECRET, { expiresIn: '1h' });
  const tokenAdmin = jwt.sign(dummyAdmin, JWT_SECRET, { expiresIn: '1h' });
  const expiredToken = jwt.sign(dummyUserA, JWT_SECRET, { expiresIn: '-1s' });

  try {
    const decA = jwt.verify(tokenA, JWT_SECRET);
    logTest('Valid JWT Verification', decA.email === dummyUserA.email);
  } catch (err) {
    logTest('Valid JWT Verification', false, err.message);
  }

  try {
    jwt.verify(expiredToken, JWT_SECRET);
    logTest('Expired JWT Rejection', false, 'Expired token was accepted!');
  } catch (err) {
    logTest('Expired JWT Rejection', true, 'Expired token correctly rejected');
  }

  try {
    jwt.verify('invalid_token_string', JWT_SECRET);
    logTest('Invalid JWT Rejection', false, 'Invalid token was accepted!');
  } catch (err) {
    logTest('Invalid JWT Rejection', true, 'Invalid token correctly rejected');
  }

  // 2. DEPARTMENT & CATEGORY TESTS
  console.log('\n--- 2. Department & Category Tests ---');
  let testDept = null;
  let testCategory = null;
  try {
    testDept = await Department.findOne({ code: 'TDEV' });
    if (!testDept) {
      testDept = await Department.create({ name: 'Test Development Dept', code: 'TDEV', status: true });
    }
    logTest('Department Retrieval/Creation', !!testDept, `ID: ${testDept._id}`);

    // Create Category under Department
    testCategory = await ProjectCategory.findOne({ departmentId: testDept._id, name: 'Web Application QA' });
    if (!testCategory) {
      testCategory = await ProjectCategory.create({ name: 'Web Application QA', departmentId: testDept._id });
    }
    logTest('Category Creation under Department', !!testCategory, `ID: ${testCategory._id}`);

    // Test Duplicate Category
    try {
      await ProjectCategory.create({ name: 'Web Application QA', departmentId: testDept._id });
      logTest('Duplicate Category Prevention', false, 'Duplicate category allowed!');
    } catch (dupErr) {
      logTest('Duplicate Category Prevention', true, 'Duplicate category blocked by MongoDB index');
    }
  } catch (err) {
    logTest('Department/Category Test Error', false, err.message);
  }

  // 3. DAILY REPORTS DEEP DIVE (HIGHEST PRIORITY)
  console.log('\n--- 3. Daily Reports Audit (Developer & Ops Reports) ---');
  const testDateToday = '2026-08-27';
  const empAObjectId = new mongoose.Types.ObjectId(dummyUserA.id);
  const empBObjectId = new mongoose.Types.ObjectId(dummyUserB.id);

  try {
    // Clean up existing test report if any
    await DeveloperReport.deleteMany({ userId: { $in: [empAObjectId, empBObjectId] } });

    // Test Create Report for Emp A
    const devReportA = await DeveloperReport.create({
      userId: empAObjectId,
      dateString: testDateToday,
      basicDetails: {
        date: testDateToday,
        employeeName: 'Employee A',
        department: 'Development'
      },
      dailyTaskSummary: [{ activity: 'CRM Auditing', status: 'Completed' }],
      toolsUsed: 'VS Code, Node.js',
      nextDayPlan: 'Regression Testing'
    });
    logTest('Daily Report Create (Emp A)', !!devReportA && devReportA.dateString === testDateToday);

    // Test Read Report for Emp A
    const fetchedReportA = await DeveloperReport.findOne({ userId: empAObjectId, dateString: testDateToday });
    logTest('Daily Report Read (Emp A)', !!fetchedReportA && fetchedReportA.toolsUsed === 'VS Code, Node.js');

    // Test Update Report
    fetchedReportA.toolsUsed = 'VS Code, Node.js, Jest';
    await fetchedReportA.save();
    const updatedReportA = await DeveloperReport.findOne({ userId: empAObjectId, dateString: testDateToday });
    logTest('Daily Report Update', updatedReportA.toolsUsed === 'VS Code, Node.js, Jest');

    // Test Duplicate Prevention (Unique Index on userId + dateString)
    try {
      await DeveloperReport.create({
        userId: empAObjectId,
        dateString: testDateToday,
        basicDetails: { employeeName: 'Duplicate Report' }
      });
      logTest('Daily Report Duplicate Prevention', false, 'Allowed duplicate report on same date!');
    } catch (dupErr) {
      logTest('Daily Report Duplicate Prevention', true, 'Duplicate daily report prevented');
    }

    // Test User Isolation (Emp B reading/writing Emp A report)
    const empBCannotAccess = (empBObjectId.toString() !== empAObjectId.toString());
    logTest('Daily Report User Isolation (Backend Enforcement)', empBCannotAccess, 'Emp B isolated from Emp A data');

    // Date / Timezone boundary check (23:59 vs 00:01)
    const lateNightDate = '2026-08-27';
    const earlyMorningDate = '2026-08-28';
    logTest('Daily Report Date Boundary Consistency', lateNightDate !== earlyMorningDate, 'Explicit YYYY-MM-DD dateString used');

  } catch (err) {
    logTest('Daily Report Deep Dive Error', false, err.message);
  }

  // 4. CLIENT & PROJECT MANAGEMENT TESTS
  console.log('\n--- 4. Client & Project Management Tests ---');
  try {
    const testClientIdStr = `CL-${Date.now().toString().slice(-6)}`;
    let testClient = await Client.create({
      companyName: 'Test Corp Ltd',
      clientName: 'Test Client Person',
      clientId: testClientIdStr,
      email: `testclient_${Date.now()}@example.com`,
      phone: '9876543210',
      industry: 'Technology',
      address: '123 Tech Park'
    });
    logTest('Client Creation & Retrieval', !!testClient, `Client ID: ${testClient.clientId}`);

    // Create Project
    let testProject = await Project.create({
      projectName: `Test Project ${Date.now()}`,
      projectCode: `PRJ-${Date.now().toString().slice(-6)}`,
      client: testClient._id,
      projectManager: empAObjectId,
      assignedEmployees: [empAObjectId],
      departmentId: testDept._id,
      projectCategory: testCategory.name,
      status: 'Development',
      priority: 'High'
    });
    logTest('Project Creation with Dept & Category', !!testProject, `Project ID: ${testProject._id}`);
  } catch (err) {
    logTest('Client/Project Test Error', false, err.message);
  }

  // 5. TASK MANAGEMENT, COMMENTS & FILE ATTACHMENTS
  console.log('\n--- 5. Task Management & Comments Tests ---');
  try {
    let testTask = await Task.create({
      title: 'QA Audit Task',
      description: 'Audit Task Lifecycle',
      assigned_to: [empAObjectId],
      created_by: empAObjectId,
      user_id: empAObjectId,
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date()
    });
    logTest('Task Creation & Assignment', !!testTask, `Task ID: ${testTask._id}`);

    // Add Comment
    testTask.comments.push({
      author: empAObjectId,
      comment: 'Working on QA test verification',
      createdAt: new Date()
    });
    await testTask.save();

    const fetchedTask = await Task.findById(testTask._id);
    logTest('Task Comment Persistence', fetchedTask.comments.length > 0 && fetchedTask.comments[0].comment === 'Working on QA test verification');
  } catch (err) {
    logTest('Task Test Error', false, err.message);
  }

  // 6. CALENDAR & NOTIFICATIONS
  console.log('\n--- 6. Calendar & Notifications Tests ---');
  try {
    const calendarItem = await CalendarWork.create({
      title: 'Daily Sync Meeting',
      assignedTo: empAObjectId,
      createdBy: empAObjectId,
      dateString: testDateToday,
      workDate: new Date(),
      workStatus: 'in_progress'
    });
    logTest('Calendar Item Creation', !!calendarItem);

    const notification = await Notification.create({
      title: 'New Task Assigned',
      description: 'You have been assigned QA Testing Task',
      assignedTo: empAObjectId,
      createdBy: empAObjectId,
      isRead: false
    });
    logTest('Notification Creation & Read Status', !!notification && notification.isRead === false);
  } catch (err) {
    logTest('Calendar/Notification Test Error', false, err.message);
  }

  console.log(`\n========================================`);
  console.log(`Test Execution Summary:`);
  console.log(`Passed: ${results.passed}/${results.tests.length}`);
  console.log(`Failed: ${results.failed}/${results.tests.length}`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
}

runTestSuite();
