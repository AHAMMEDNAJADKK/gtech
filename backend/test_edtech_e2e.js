import jwt from 'jsonwebtoken';
import app from './app.js';
import dotenv from 'dotenv';
dotenv.config();

const PORT = 5088;
const SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

async function runEdTechTests() {
  const adminToken = jwt.sign(
    { id: '6a55fb7a47aa971ddfc65e92', role: 'admin', role_id: '1', isSuperAdmin: true },
    SECRET,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { id: '6a55fb7a47aa971ddfc65e93', role: 'student', role_id: '10' },
    SECRET,
    { expiresIn: '1h' }
  );

  const server = app.listen(PORT, async () => {
    console.log(`\n🚀 EdTech Test Server listening on http://localhost:${PORT}\n`);
    let passCount = 0;
    let failCount = 0;

    const testEndpoint = async (name, url, options = {}) => {
      try {
        const expectedStatus = options.expectedStatus || null;
        const res = await fetch(`http://localhost:${PORT}${url}`, options);
        const data = await res.json().catch(() => ({ statusText: res.statusText }));
        const isOk = expectedStatus ? (res.status === expectedStatus) : (res.status >= 200 && res.status < 400);

        if (isOk) {
          console.log(`✅ [PASS] ${name} (Status: ${res.status})`);
          passCount++;
          return { success: true, data };
        } else {
          console.log(`❌ [FAIL] ${name} (Status: ${res.status}, Expected: ${expectedStatus || '2xx/3xx'}) -`, JSON.stringify(data));
          failCount++;
          return { success: false, data };
        }
      } catch (err) {
        console.log(`❌ [ERR] ${name} - ${err.message}`);
        failCount++;
        return { success: false, error: err.message };
      }
    };

    console.log('--- 1. DASHBOARD & KPIS ---');
    await testEndpoint(
      'EdTech Dashboard Stats',
      '/api/v1/edtech-dashboard/stats',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('\n--- 2. ACCOUNTS & STUDENT FEES ---');
    await testEndpoint(
      'Get Student Fee Accounts (Admin)',
      '/api/v1/student-fees',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    await testEndpoint(
      'Get My Fee Account (Student)',
      '/api/v1/student-fees/my-account',
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    console.log('\n--- 3. LIVE CLASSROOMS ---');
    await testEndpoint(
      'Get Live Classes List',
      '/api/v1/live-classes',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('\n--- 4. CERTIFICATES ---');
    await testEndpoint(
      'Get Certificates List (Admin)',
      '/api/v1/certificates',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    await testEndpoint(
      'Public Certificate Verification (Invalid Code Test)',
      '/api/v1/certificates/verify/EDTECH-NONEXISTENT',
      { expectedStatus: 404 }
    );

    console.log('\n--- 5. ASSIGNMENTS & LMS ---');
    await testEndpoint(
      'Get Assignments List',
      '/api/v1/academy/assignments',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    await testEndpoint(
      'Get Student Enrolled Courses',
      '/api/v1/academy/student/enrolled-courses',
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    console.log('\n--- 6. ADMISSIONS & BATCHES ---');
    await testEndpoint(
      'Get Leads List',
      '/api/v1/leads?limit=5',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    await testEndpoint(
      'Get Batches List',
      '/api/v1/academy/batches',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    await testEndpoint(
      'Get Courses List',
      '/api/v1/academy/courses',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log(`\n================================`);
    console.log(`TEST SUMMARY: Passed: ${passCount}, Failed: ${failCount}`);
    console.log(`================================\n`);

    server.close(() => {
      console.log('Server stopped.');
      process.exit(failCount > 0 ? 1 : 0);
    });
  });
}

runEdTechTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
