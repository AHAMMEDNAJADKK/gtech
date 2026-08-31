import mongoose from 'mongoose';
import fs from 'fs';
import User from './src/models/user.model.js';
import { userController } from './src/controllers/user.controller.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://shabeeba:9995982324@cluster0.i23tzbf.mongodb.net/crm?appName=Cluster0';

async function testApiLogic() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const results = {};

  // Test 1: Mock req for getUsers with role=student
  const mockReq1 = {
    query: { role: 'student', limit: '500' }
  };
  let resData1 = null;
  const mockRes1 = {
    status: function(code) {
      return this;
    },
    json: function(data) {
      resData1 = data;
      return data;
    }
  };

  await userController.getUsers(mockReq1, mockRes1, (err) => console.error('Next err:', err));
  results.getUsers_role_student = resData1;

  // Test 2: Mock req for getUsers with role=10
  const mockReq2 = {
    query: { role: '10', limit: '500' }
  };
  let resData2 = null;
  const mockRes2 = {
    status: function(code) { return this; },
    json: function(data) { resData2 = data; return data; }
  };
  await userController.getUsers(mockReq2, mockRes2, (err) => console.error('Next err:', err));
  results.getUsers_role_10 = resData2;

  // Test 3: Mock req for getUsers WITHOUT role (staff list)
  const mockReq3 = {
    query: {}
  };
  let resData3 = null;
  const mockRes3 = {
    status: function(code) { return this; },
    json: function(data) { resData3 = data; return data; }
  };
  await userController.getUsers(mockReq3, mockRes3, (err) => console.error('Next err:', err));
  results.getUsers_no_role = resData3;

  fs.writeFileSync('test_student_api_results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('API Logic results written to test_student_api_results.json');

  await mongoose.disconnect();
}

testApiLogic().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
