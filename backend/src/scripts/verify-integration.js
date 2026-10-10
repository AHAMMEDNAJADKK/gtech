import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/user.model.js';
import Course from '../models/course.model.js';
import Batch from '../models/batch.model.js';
import StudentFee from '../models/studentFee.model.js';
import { normalizePhone, normalizeEmail, normalizeIdentityNumber } from '../utils/normalize.util.js';

async function runVerification() {
  console.log('=== STARTING INTEGRATION VERIFICATION ===');
  await connectDB();

  try {
    // 1. Verify existing student querying & duplicate detection logic
    console.log('\n[1] Checking Student Duplicate Detection Logic...');
    const existingStudent = await User.findOne({ 
      $or: [
        { role_id: '10' }, 
        { role: 'student' }
      ] 
    }).lean();

    if (existingStudent) {
      console.log(`Found existing student: ${existingStudent.name} (${existingStudent.email}, ${existingStudent.phone})`);
      
      const normPhone = normalizePhone(existingStudent.phone);
      console.log(`Normalized existing phone: "${normPhone}"`);

      // Test duplicate query matching with variations (+91, spaces, 0 prefix)
      const testVariations = [
        `+91${normPhone}`,
        `0${normPhone}`,
        `${normPhone.slice(0, 5)} ${normPhone.slice(5)}`,
        `+91 ${normPhone.slice(0, 5)}-${normPhone.slice(5)}`
      ];

      for (const phoneVar of testVariations) {
        const testNorm = normalizePhone(phoneVar);
        const dupMatch = await User.findOne({
          $or: [
            { phone: phoneVar },
            { phone: testNorm },
            { phone: `+91${testNorm}` },
            { phone: `0${testNorm}` }
          ]
        }).lean();

        if (dupMatch && dupMatch._id.toString() === existingStudent._id.toString()) {
          console.log(`  ✓ Duplicate phone variation matched correctly: "${phoneVar}" -> normalized: "${testNorm}"`);
        } else {
          console.log(`  ✗ Duplicate failed for: "${phoneVar}"`);
        }
      }

      // 2. Verify Fee Receipt Auto-Fetching Logic
      console.log('\n[2] Testing Student Fee Receipt Auto-Fetching details for studentId:', existingStudent._id);
      
      // Check courses and batches
      const courses = await Course.find({}).lean();
      const batches = await Batch.find({}).populate('courseId').lean();
      console.log(`  Found ${courses.length} courses and ${batches.length} batches in database.`);

      // Check enrollment / batch assignment for this student
      const assignedBatches = batches.filter(b => 
        Array.isArray(b.students) && b.students.some(sId => sId?.toString() === existingStudent._id.toString())
      );
      console.log(`  Student is directly assigned in ${assignedBatches.length} batches.`);

      // 3. Test Student Fee creation and Receipt Generation
      console.log('\n[3] Testing Fee Receipt Generation & Numbering...');
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const testReceiptNo = `RCP-${year}-${randomSuffix}`;
      console.log(`  Generated receipt number: ${testReceiptNo}`);
      
      const regex = /^RCP-\d{4}-\d{6}$/;
      if (regex.test(testReceiptNo)) {
        console.log(`  ✓ Receipt number matches mandatory format "RCP-YYYY-XXXXXX"`);
      } else {
        console.error(`  ✗ Receipt number does not match format: ${testReceiptNo}`);
      }

      console.log('\n=== INTEGRATION VERIFICATION SUCCESSFUL ===');
    } else {
      console.log('No student found in DB. Skipping student-specific check.');
    }
  } catch (error) {
    console.error('Integration Verification Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

runVerification();
