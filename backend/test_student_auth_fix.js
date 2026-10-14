import 'dotenv/config';
import mongoose from 'mongoose';
import request from 'supertest';
import dns from 'dns';
import app from './app.js';
import User from './src/models/user.model.js';

dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {}

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function run() {
  console.log('========================================================');
  console.log('   STUDENT LOGIN AUTHENTICATION & PROFILE VERIFICATION');
  console.log('========================================================\n');

  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(mongoUri);
  }

  // 1. Verify Student Login
  console.log('--- 1. VERIFY STUDENT LOGIN (student@gmail.com / student@111) ---');
  const badLogin = await request(app).post('/api/auth/login').send({
    email: 'student@gmail.com',
    password: 'wrong_password'
  });
  assert(badLogin.status === 401, 'Invalid password correctly rejected with 401');

  const studentLogin = await request(app).post('/api/auth/login').send({
    email: 'student@gmail.com',
    password: 'student@111'
  });
  assert(studentLogin.status === 200, 'Student logs in successfully with 200 OK');
  assert(Boolean(studentLogin.body.token), 'Student login returns valid JWT token');
  
  const studentUser = studentLogin.body.user;
  assert(studentUser && studentUser.email === 'student@gmail.com', 'Student user object returned with correct email');
  assert(studentUser.role === 'student' || studentUser.role_id === '10', 'Student user has role=student / role_id=10');
  assert(studentUser.studentId !== undefined, 'Student user includes studentId property');
  console.log(`  ℹ️ Student ID: ${studentUser.studentId || 'N/A'}, Mongo ID: ${studentUser._id || studentUser.id}`);

  const studentToken = studentLogin.body.token;
  const studentId = studentUser._id || studentUser.id;

  // 2. Fetch Own Profile (The exact call made by MainLayout / UserContext on student dashboard)
  console.log('\n--- 2. STUDENT CALLING GET /api/v1/users/:userId (PROFILE FETCH) ---');
  const ownProfileRes = await request(app)
    .get(`/api/v1/users/${studentId}`)
    .set('Authorization', `Bearer ${studentToken}`);
  
  assert(ownProfileRes.status === 200, `Student fetching own profile returns 200 OK (was previously 403)`);
  assert(ownProfileRes.body.success === true, 'Profile response indicates success');
  assert(ownProfileRes.body.data.email === 'student@gmail.com', 'Profile response returns correct student data');
  assert(ownProfileRes.body.data.role === 'student', 'Profile response confirms student role');

  // 3. Fetch Self via /me
  console.log('\n--- 3. STUDENT CALLING GET /api/v1/users/me ---');
  const meProfileRes = await request(app)
    .get('/api/v1/users/me')
    .set('Authorization', `Bearer ${studentToken}`);
  
  assert(meProfileRes.status === 200, 'Student fetching /api/v1/users/me returns 200 OK');
  assert(meProfileRes.body.data.email === 'student@gmail.com', '/me returns student email');

  // 4. RBAC Protection: Student must NOT access other users' profiles
  console.log('\n--- 4. RBAC PROTECTION: STUDENT ACCESSING OTHER USERS ---');
  const adminUser = await User.findOne({ email: 'superadmin@gmail.com' });
  if (adminUser) {
    const studentAccessingAdmin = await request(app)
      .get(`/api/v1/users/${adminUser._id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    assert(studentAccessingAdmin.status === 403, 'Student prevented from inspecting admin profile with 403 Forbidden');
  }

  // 5. Privileged Access: Super Admin & HR can inspect Student profile
  console.log('\n--- 5. PRIVILEGED ACCESS: ADMIN & HR FETCHING STUDENT PROFILE ---');
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'superadmin@gmail.com',
    password: 'superadmin@111'
  });
  assert(adminLogin.status === 200, 'Super Admin logs in successfully');
  const adminToken = adminLogin.body.token;

  const adminFetchStudent = await request(app)
    .get(`/api/v1/users/${studentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminFetchStudent.status === 200, 'Super Admin can fetch student profile (200 OK)');

  const hrLogin = await request(app).post('/api/auth/login').send({
    email: 'hr@gmail.com',
    password: 'hr@111'
  });
  assert(hrLogin.status === 200, 'HR logs in successfully');
  const hrToken = hrLogin.body.token;

  const hrFetchStudent = await request(app)
    .get(`/api/v1/users/${studentId}`)
    .set('Authorization', `Bearer ${hrToken}`);
  assert(hrFetchStudent.status === 200, 'HR can fetch student profile (200 OK)');

  console.log('\n========================================================');
  console.log(`   ALL TESTS PASSED: ${passed}/${total}`);
  console.log('========================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
