import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import User from './src/models/user.model.js';
import Lead from './src/models/lead.model.js';

dotenv.config();

const SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';
const TEST_PORT = 5098;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

let server;
let passed = 0;
let failed = 0;

function assertTest(desc, condition) {
  if (condition) {
    console.log(`  ✅ [PASS]: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL]: ${desc}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 COMMENCING EDTECH ADMISSIONS LEADS RBAC TEST SUITE');
  console.log('======================================================\n');

  await new Promise((resolve) => {
    server = http.createServer(app).listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}`);
      resolve();
    });
  });

  try {
    // 1. Create or load test users for each role
    const timestamp = Date.now();

    // SUPER ADMIN
    const superAdmin = await User.findOneAndUpdate(
      { email: 'superadmin@gmail.com' },
      { name: 'Super Admin', role: 'superadmin', role_id: '0', isSuperAdmin: true, status: 'active', isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
    const superAdminToken = jwt.sign(
      { id: superAdmin._id, _id: superAdmin._id, role: 'superadmin', role_id: '0', isSuperAdmin: true, name: 'Super Admin' },
      SECRET,
      { expiresIn: '1h' }
    );
    const superAdminHeaders = { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' };

    // ADMIN
    const adminUser = await User.findOneAndUpdate(
      { email: `admin_test_${timestamp}@edtech.com` },
      { name: 'Admin Test', role: 'admin', role_id: '1', status: 'active', isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
    const adminToken = jwt.sign(
      { id: adminUser._id, _id: adminUser._id, role: 'admin', role_id: '1', name: 'Admin Test' },
      SECRET,
      { expiresIn: '1h' }
    );
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    // COUNSELOR 1
    const counselor1 = await User.findOneAndUpdate(
      { email: `counselor1_${timestamp}@edtech.com` },
      { name: 'Counselor 1', role: 'counselor', role_id: '4', designation: 'Academic Counselor', department: 'Admissions', status: 'active', isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
    const counselor1Token = jwt.sign(
      { id: counselor1._id, _id: counselor1._id, role: 'counselor', role_id: '4', designation: 'Academic Counselor', department: 'Admissions', name: 'Counselor 1' },
      SECRET,
      { expiresIn: '1h' }
    );
    const counselor1Headers = { Authorization: `Bearer ${counselor1Token}`, 'Content-Type': 'application/json' };

    // COUNSELOR 2
    const counselor2 = await User.findOneAndUpdate(
      { email: `counselor2_${timestamp}@edtech.com` },
      { name: 'Counselor 2', role: 'counselor', role_id: '4', designation: 'Academic Counselor', department: 'Admissions', status: 'active', isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
    const counselor2Token = jwt.sign(
      { id: counselor2._id, _id: counselor2._id, role: 'counselor', role_id: '4', designation: 'Academic Counselor', department: 'Admissions', name: 'Counselor 2' },
      SECRET,
      { expiresIn: '1h' }
    );
    const counselor2Headers = { Authorization: `Bearer ${counselor2Token}`, 'Content-Type': 'application/json' };

    // INSTRUCTOR
    const instructor = await User.findOneAndUpdate(
      { email: `instructor_${timestamp}@edtech.com` },
      { name: 'Instructor Test', role: 'instructor', role_id: '3', designation: 'Senior Faculty', status: 'active', isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
    const instructorToken = jwt.sign(
      { id: instructor._id, _id: instructor._id, role: 'instructor', role_id: '3', designation: 'Senior Faculty', name: 'Instructor Test' },
      SECRET,
      { expiresIn: '1h' }
    );
    const instructorHeaders = { Authorization: `Bearer ${instructorToken}`, 'Content-Type': 'application/json' };

    // STUDENT
    const student = await User.findOneAndUpdate(
      { email: `student_${timestamp}@edtech.com` },
      { name: 'Student Test', role: 'student', role_id: '10', designation: 'student', status: 'active', isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
    const studentToken = jwt.sign(
      { id: student._id, _id: student._id, role: 'student', role_id: '10', designation: 'student', name: 'Student Test' },
      SECRET,
      { expiresIn: '1h' }
    );
    const studentHeaders = { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' };

    console.log('--- 1. DIRECT API ACCESS & DENIAL CHECKS ---');

    // 1.1 Super Admin GET /leads
    const saGetRes = await fetch(`${BASE_URL}/leads`, { headers: superAdminHeaders });
    assertTest('Super Admin can view leads (200 OK)', saGetRes.status === 200);

    // 1.2 Admin GET /leads
    const adminGetRes = await fetch(`${BASE_URL}/leads`, { headers: adminHeaders });
    assertTest('Admin can view leads (200 OK)', adminGetRes.status === 200);

    // 1.3 Counselor GET /leads
    const c1GetRes = await fetch(`${BASE_URL}/leads`, { headers: counselor1Headers });
    assertTest('Counselor can view permitted leads (200 OK)', c1GetRes.status === 200);

    // 1.4 Instructor GET /leads -> Denied (403)
    const instGetRes = await fetch(`${BASE_URL}/leads`, { headers: instructorHeaders });
    assertTest('Instructor denied from viewing leads (403 Forbidden)', instGetRes.status === 403);

    // 1.5 Student GET /leads -> Denied (403)
    const stdGetRes = await fetch(`${BASE_URL}/leads`, { headers: studentHeaders });
    assertTest('Student denied from viewing leads (403 Forbidden)', stdGetRes.status === 403);

    console.log('\n--- 2. LEAD CREATION CHECKS ---');

    // 2.1 Super Admin Create Lead
    const saCreateRes = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: superAdminHeaders,
      body: JSON.stringify({
        leadName: 'Lead By SuperAdmin',
        phone: '+919111111111',
        email: `sa_lead_${timestamp}@test.com`,
        status: 'New'
      })
    });
    const saCreateData = await saCreateRes.json();
    const saLeadId = saCreateData.data?.id || saCreateData.data?._id;
    assertTest('Super Admin can create lead (201 Created)', saCreateRes.status === 201 && !!saLeadId);

    // 2.2 Admin Create Lead
    const adminCreateRes = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        leadName: 'Lead By Admin',
        phone: '+919222222222',
        email: `admin_lead_${timestamp}@test.com`,
        status: 'New',
        assignedTo: counselor1._id
      })
    });
    const adminCreateData = await adminCreateRes.json();
    const adminLeadId = adminCreateData.data?.id || adminCreateData.data?._id;
    assertTest('Admin can create & assign lead to Counselor (201 Created)', adminCreateRes.status === 201 && !!adminLeadId);

    // 2.3 Counselor 1 Create Lead
    const c1CreateRes = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: counselor1Headers,
      body: JSON.stringify({
        leadName: 'Lead By Counselor 1',
        phone: '+919333333333',
        email: `c1_lead_${timestamp}@test.com`,
        status: 'New'
      })
    });
    const c1CreateData = await c1CreateRes.json();
    const c1LeadId = c1CreateData.data?.id || c1CreateData.data?._id;
    assertTest('Counselor can create lead (201 Created)', c1CreateRes.status === 201 && !!c1LeadId);

    // 2.4 Instructor Create Lead -> Denied (403)
    const instCreateRes = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: instructorHeaders,
      body: JSON.stringify({
        leadName: 'Instructor Attempted Lead',
        phone: '+919444444444'
      })
    });
    assertTest('Instructor denied from creating lead (403 Forbidden)', instCreateRes.status === 403);

    // 2.5 Student Create Lead -> Denied (403)
    const stdCreateRes = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        leadName: 'Student Attempted Lead',
        phone: '+919555555555'
      })
    });
    assertTest('Student denied from creating lead (403 Forbidden)', stdCreateRes.status === 403);

    console.log('\n--- 3. COUNSELOR OWNERSHIP & FOLLOW-UP RESTRICTIONS ---');

    // 3.1 Counselor 1 can log follow-up on their assigned lead
    const c1FollowupRes = await fetch(`${BASE_URL}/leads/followup`, {
      method: 'POST',
      headers: counselor1Headers,
      body: JSON.stringify({
        leadId: adminLeadId,
        remarks: 'Counselor 1 called candidate.',
        statusChangedTo: 'Contacted'
      })
    });
    assertTest('Counselor 1 can follow-up on assigned lead (201 Created)', c1FollowupRes.status === 201);

    // 3.2 Counselor 2 attempting to modify Counselor 1\'s lead -> Denied (403)
    const c2FollowupRes = await fetch(`${BASE_URL}/leads/followup`, {
      method: 'POST',
      headers: counselor2Headers,
      body: JSON.stringify({
        leadId: adminLeadId,
        remarks: 'Unauthorized Counselor 2 attempt.'
      })
    });
    assertTest('Counselor 2 denied from modifying Counselor 1 lead (403 Forbidden)', c2FollowupRes.status === 403);

    console.log('\n--- 4. DELETION RESTRICTIONS ---');

    // 4.1 Counselor denied from deleting lead
    const c1DelRes = await fetch(`${BASE_URL}/leads/delete/${c1LeadId}`, {
      method: 'POST',
      headers: counselor1Headers
    });
    assertTest('Counselor denied from deleting lead (403 Forbidden)', c1DelRes.status === 403);

    // 4.2 Student denied from deleting lead
    const stdDelRes = await fetch(`${BASE_URL}/leads/delete/${saLeadId}`, {
      method: 'POST',
      headers: studentHeaders
    });
    assertTest('Student denied from deleting lead (403 Forbidden)', stdDelRes.status === 403);

    // 4.3 Admin can delete lead
    const adminDelRes = await fetch(`${BASE_URL}/leads/delete/${saLeadId}`, {
      method: 'POST',
      headers: adminHeaders
    });
    assertTest('Admin permitted to delete lead (200 OK)', adminDelRes.status === 200);

    console.log('\n--- 5. CONVERSION RESTRICTIONS ---');

    // 5.1 Student denied from converting lead
    const stdConvertRes = await fetch(`${BASE_URL}/leads/${c1LeadId}/convert-to-student`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({})
    });
    assertTest('Student denied from converting lead (403 Forbidden)', stdConvertRes.status === 403);

    // 5.2 Instructor denied from converting lead
    const instConvertRes = await fetch(`${BASE_URL}/leads/${c1LeadId}/convert-to-student`, {
      method: 'POST',
      headers: instructorHeaders,
      body: JSON.stringify({})
    });
    assertTest('Instructor denied from converting lead (403 Forbidden)', instConvertRes.status === 403);

    // 5.3 Admin can convert lead
    const adminConvertRes = await fetch(`${BASE_URL}/leads/${c1LeadId}/convert-to-student`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({})
    });
    const adminConvertData = await adminConvertRes.json();
    assertTest('Admin permitted to convert lead (200 OK & student created)', adminConvertRes.status === 200 && !!(adminConvertData.data?.student?._id || adminConvertData.data?.student?.id));

    console.log('\n======================================================');
    console.log(`📊 ADMISSIONS LEADS RBAC RESULTS: Passed: ${passed} | Failed: ${failed}`);
    console.log('======================================================\n');

  } finally {
    if (server) server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
