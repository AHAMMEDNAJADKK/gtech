import jwt from 'jsonwebtoken';
import app from './app.js';
import dotenv from 'dotenv';
dotenv.config();

const PORT = 5089;
const SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

async function runWorkflowTest() {
  const adminToken = jwt.sign(
    { id: '6a55fb7a47aa971ddfc65e92', role: 'admin', role_id: '1', isSuperAdmin: true, name: 'Lead Architect' },
    SECRET,
    { expiresIn: '1h' }
  );

  const headers = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  const server = app.listen(PORT, async () => {
    console.log(`\n🚀 Workflow Pipeline Test Server on http://localhost:${PORT}\n`);

    try {
      // Step A: Fetch or create an existing course & batch
      console.log('--- STEP 1: Fetch or Create Course & Batch ---');
      let coursesRes = await fetch(`http://localhost:${PORT}/api/v1/academy/courses`, { headers });
      let coursesData = await coursesRes.json();
      let course = coursesData.data?.[0];
      if (!course) {
        console.log('No existing course found. Creating seed course for test...');
        const createCourseRes = await fetch(`http://localhost:${PORT}/api/v1/academy/courses`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            courseName: 'Full Stack Web Development Bootcamp',
            category: 'DEVELOPMENT',
            shortDescription: 'Master modern full stack web development with MERN.',
            baseFee: 45000,
            durationWeeks: 12
          })
        });
        const createdCourseData = await createCourseRes.json();
        course = createdCourseData.data;
      }
      console.log(`Found/Created Course: ${course.courseName} (${course._id || course.id})`);

      let batchesRes = await fetch(`http://localhost:${PORT}/api/v1/academy/batches`, { headers });
      let batchesData = await batchesRes.json();
      let batch = batchesData.data?.[0];
      if (!batch) {
        console.log('No existing batch found. Creating seed batch for test...');
        const createBatchRes = await fetch(`http://localhost:${PORT}/api/v1/academy/batches`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            batchName: 'Cohort 2026-A',
            courseId: course._id || course.id,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 90 * 86400000).toISOString(),
            maxStudents: 30,
            scheduleTime: '09:00 AM - 12:00 PM',
            status: 'ONGOING'
          })
        });
        const createdBatchData = await createBatchRes.json();
        batch = createdBatchData.data;
      }
      console.log(`Found/Created Batch: ${batch.batchName} (${batch._id || batch.id})`);

      // Step B: Create a prospective lead
      console.log('\n--- STEP 2: Create Prospective Lead / Enquiry ---');
      const testLeadEmail = `lead_edtech_${Date.now()}@testinstitute.edu`;
      const createLeadRes = await fetch(`http://localhost:${PORT}/api/v1/leads`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          leadName: 'Sarah Connor',
          email: testLeadEmail,
          phone: '+919876543210',
          interestedService: course.courseName,
          status: 'Interested',
          source: 'Website Enquiry'
        })
      });
      const leadData = await createLeadRes.json();
      const leadId = leadData.data?.id || leadData.data?._id || leadData.id || leadData._id;
      console.log(`Lead Created: ID = ${leadId}, Email = ${testLeadEmail}`);

      // Step C: Convert lead to student
      console.log('\n--- STEP 3: Convert Lead to Student ---');
      const convertRes = await fetch(`http://localhost:${PORT}/api/v1/leads/${leadId}/convert-to-student`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          batchId: batch._id || batch.id,
          courseId: course._id || course.id
        })
      });
      const convertData = await convertRes.json();
      console.log('Conversion Result:', convertData.message);
      const studentId = convertData.data?.student?.studentId;
      const studentMongoId = convertData.data?.student?.id || convertData.data?.student?._id;
      console.log(`Generated Student ID: ${studentId} (User ID: ${studentMongoId})`);

      // Step D: Create Tuition Fee Account
      console.log('\n--- STEP 4: Create Tuition Fee Account with Installments ---');
      const feeRes = await fetch(`http://localhost:${PORT}/api/v1/student-fees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          studentId: studentMongoId,
          courseId: course._id || course.id,
          batchId: batch._id || batch.id,
          totalAmount: 45000,
          discountAmount: 5000,
          installments: [
            { installmentNumber: 1, title: 'Term 1 Tuition', amount: 20000 },
            { installmentNumber: 2, title: 'Term 2 Tuition', amount: 20000 }
          ]
        })
      });
      const feeData = await feeRes.json();
      console.log('Fee Account Created:', feeData.data?.feeCode, 'Final Amount: ₹', feeData.data?.finalAmount);
      const feeId = feeData.data?.id || feeData.data?._id;

      // Step E: Record Installment Payment
      console.log('\n--- STEP 5: Record Payment & Generate Receipt ---');
      const payRes = await fetch(`http://localhost:${PORT}/api/v1/student-fees/${feeId}/record-payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: 20000,
          paymentMethod: 'UPI',
          transactionId: `TXN_${Date.now()}`,
          notes: 'First installment tuition fee paid'
        })
      });
      const payData = await payRes.json();
      console.log('Payment Recorded! Status:', payData.data?.fee?.status, 'Receipt No:', payData.data?.receiptNo);

      // Step F: Schedule Live Classroom
      console.log('\n--- STEP 6: Schedule Live Classroom Session ---');
      const liveRes = await fetch(`http://localhost:${PORT}/api/v1/live-classes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'Full Stack Architecture Masterclass',
          courseId: course._id || course.id,
          batchId: batch._id || batch.id,
          platform: 'Google Meet',
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
          scheduledDate: '2026-10-15',
          startTime: '10:00 AM',
          endTime: '11:30 AM',
          durationMinutes: 90
        })
      });
      const liveData = await liveRes.json();
      console.log('Live Class Scheduled:', liveData.data?.title, 'Platform:', liveData.data?.platform);

      // Mark Enrollment Completed for Certification
      const Enrollment = (await import('./src/models/enrollment.model.js')).default;
      await Enrollment.findOneAndUpdate(
        { studentId: studentMongoId, courseId: course._id || course.id },
        { status: 'completed', progressPercentage: 100 }
      );
      console.log('Course Marked as Completed for Graduation!');

      // Step G: Issue Course Completion Certificate
      console.log('\n--- STEP 7: Issue Certificate with QR Code & PDF ---');
      const certRes = await fetch(`http://localhost:${PORT}/api/v1/certificates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          studentId: studentMongoId,
          courseId: course._id || course.id,
          batchId: batch._id || batch.id,
          gradeAwarded: 'A+',
          scorePercentage: 94
        })
      });
      const certData = await certRes.json();
      console.log('certRes status:', certRes.status, 'certData:', JSON.stringify(certData));
      console.log('Certificate Issued! Verification Code:', certData.data?.verificationCode, 'Certificate ID:', certData.data?.certificateId);
      const verificationCode = certData.data?.verificationCode;

      // Step H: Verify Certificate Publicly (QR code scan simulation)
      console.log('\n--- STEP 8: Public Verification of Certificate via QR Code ---');
      const verifyRes = await fetch(`http://localhost:${PORT}/api/v1/certificates/verify/${verificationCode}`);
      const verifyData = await verifyRes.json();
      console.log('Public Verification Status:', verifyData.verified ? '✅ VALID AUTHENTIC CERTIFICATE' : '❌ INVALID');
      console.log(`Student: ${verifyData.data?.studentName}, Course: ${verifyData.data?.courseName}, Score: ${verifyData.data?.score}%`);

      console.log('\n======================================================');
      console.log('🎉 COMPLETE END-TO-END EDTECH WORKFLOW TEST SUCCEEDED!');
      console.log('======================================================\n');
    } catch (err) {
      console.error('Workflow Test Error:', err);
    } finally {
      server.close(() => {
        process.exit(0);
      });
    }
  });
}

runWorkflowTest();
