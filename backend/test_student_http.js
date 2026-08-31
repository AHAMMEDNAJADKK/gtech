import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import app from './app.js';

const PORT = 5099;
const SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

async function runTest() {
  const token = jwt.sign(
    { id: '6a55fb7a47aa971ddfc65e92', role: 'superadmin', role_id: '0', isSuperAdmin: true },
    SECRET,
    { expiresIn: '1h' }
  );

  const server = app.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);

    const results = {};

    try {
      // Test 1: GET /api/v1/users?role=student&limit=500
      const res1 = await fetch(`http://localhost:${PORT}/api/v1/users?role=student&limit=500`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      results.users_role_student = {
        status: res1.status,
        data: await res1.json()
      };

      // Test 2: GET /api/v1/users?role=10&limit=500
      const res2 = await fetch(`http://localhost:${PORT}/api/v1/users?role=10&limit=500`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      results.users_role_10 = {
        status: res2.status,
        data: await res2.json()
      };

      // Test 3: GET /api/v1/academy/enrollments
      const res3 = await fetch(`http://localhost:${PORT}/api/v1/academy/enrollments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      results.academy_enrollments = {
        status: res3.status,
        data: await res3.json()
      };

      // Test 4: GET /api/v1/academy/batches
      const res4 = await fetch(`http://localhost:${PORT}/api/v1/academy/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      results.academy_batches = {
        status: res4.status,
        data: await res4.json()
      };

      fs.writeFileSync('http_test_results.json', JSON.stringify(results, null, 2), 'utf8');
      console.log('HTTP Test completed and written to http_test_results.json');

    } catch (err) {
      console.error('HTTP Test Error:', err);
    } finally {
      server.close();
      await mongoose.disconnect();
      process.exit(0);
    }
  });
}

runTest();
