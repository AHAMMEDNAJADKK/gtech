import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import mongoose from 'mongoose';
import User from './src/models/user.model.js';
import Lead from './src/models/lead.model.js';
import LeadFollowup from './src/models/leadFollowup.model.js';

async function runTests() {
  console.log('================================================================');
  console.log('   COUNSELLOR FOLLOW-UP CONSOLIDATION & LEADS VALIDATION TEST   ');
  console.log('================================================================\n');

  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  await mongoose.connect(MONGO_URI);
  console.log(' Connected to MongoDB');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  try {
    // 1. Find or create a counselor / admin user
    let counselor = await User.findOne({ role: 'counselor' });
    if (!counselor) {
      counselor = await User.findOne({ role: 'admin' }) || await User.findOne({ role: 'superadmin' });
    }
    assert(counselor !== null, 'Valid operator account found');

    // 2. Clean previous test leads
    await Lead.deleteMany({ email: /test_counselor_consolidation_/i });

    // 3. Create a lead with nextFollowUpDate set to today (Due)
    const today = new Date();
    const testLead1 = await Lead.create({
      leadName: 'Rahul Counselor Test Due',
      phone: '9876543210',
      email: 'test_counselor_consolidation_due@example.com',
      status: 'Follow Up',
      assignedTo: counselor._id,
      nextFollowUpDate: today,
      followUpDate1: today,
      remarks: 'Interested in Full Stack Bootcamp, callback requested'
    });
    assert(testLead1._id !== null, 'Lead with Follow Up status and today nextFollowUpDate created');

    // 4. Create another lead with nextFollowUpDate in future (Not due)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const testLead2 = await Lead.create({
      leadName: 'Ananya Future Followup Test',
      phone: '9876543211',
      email: 'test_counselor_consolidation_future@example.com',
      status: 'Contacted',
      assignedTo: counselor._id,
      nextFollowUpDate: futureDate,
      remarks: 'Student requested callback next week'
    });
    assert(testLead2._id !== null, 'Lead with future follow-up date created');

    // 5. Create a lead with Overdue follow-up date (Past)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const testLead3 = await Lead.create({
      leadName: 'Vikram Overdue Followup Test',
      phone: '9876543212',
      email: 'test_counselor_consolidation_overdue@example.com',
      status: 'Follow Up',
      assignedTo: counselor._id,
      nextFollowUpDate: pastDate,
      remarks: 'Overdue follow-up call pending'
    });
    assert(testLead3._id !== null, 'Lead with overdue follow-up date created');

    // 6. Test Logging Follow-up Activity (LeadFollowup model)
    const followup1 = await LeadFollowup.create({
      leadId: testLead1._id,
      createdBy: counselor._id,
      remarks: 'Spoke with candidate. Very interested in evening batch.',
      callSummary: 'Discussed syllabus, batch timings, and fee installment plan.',
      meetingNotes: 'Scheduled follow-up demo for tomorrow.',
      statusChangedTo: 'Interested',
      nextFollowUpDate: new Date(Date.now() + 86400000)
    });
    assert(followup1._id !== null, 'Follow-up log created in LeadFollowup collection');
    assert(followup1.remarks.includes('evening batch'), 'Follow-up remarks persisted');
    assert(followup1.callSummary.includes('Discussed syllabus'), 'Call summary notes persisted');

    // 7. Update lead to reflect new status and nextFollowUpDate
    await Lead.findByIdAndUpdate(testLead1._id, {
      status: 'Interested',
      nextFollowUpDate: followup1.nextFollowUpDate
    });
    const updatedLead1 = await Lead.findById(testLead1._id);
    assert(updatedLead1.status === 'Interested', 'Lead status correctly transitioned to Interested');

    // 8. Add a second follow-up activity log
    const followup2 = await LeadFollowup.create({
      leadId: testLead1._id,
      createdBy: counselor._id,
      remarks: 'Demo attended. Ready to enroll.',
      callSummary: 'Sent admission form link.',
      statusChangedTo: 'Interested'
    });
    assert(followup2._id !== null, 'Second follow-up activity recorded');

    // 9. Verify retrieval of full follow-up history
    const allFollowups = await LeadFollowup.find({ leadId: testLead1._id }).sort({ createdAt: -1 });
    assert(allFollowups.length === 2, `Full follow-up history retrieved (expected 2, got ${allFollowups.length})`);

    // 10. Verify Due Filter Query logic
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const dueLeads = await Lead.find({
      _id: { $in: [testLead1._id, testLead2._id, testLead3._id] },
      $or: [
        { nextFollowUpDate: { $lte: endOfToday }, status: { $nin: ['Converted', 'Lost'] } },
        { status: 'Follow Up' }
      ]
    });
    // testLead3 is overdue (Due), testLead2 is future Contacted (Not due)
    const dueIds = dueLeads.map(l => l._id.toString());
    assert(dueIds.includes(testLead3._id.toString()), 'Overdue lead correctly matched by Due filter');
    assert(!dueIds.includes(testLead2._id.toString()), 'Future follow-up lead excluded from Due filter');

    // 11. Cleanup test leads
    await Lead.deleteMany({ email: /test_counselor_consolidation_/i });
    await LeadFollowup.deleteMany({ leadId: { $in: [testLead1._id, testLead2._id, testLead3._id] } });
    console.log(' Cleaned up test leads');

    console.log('\n================================================================');
    console.log(`   TEST RESULT: ${passed} / ${total} PASSED (${Math.round(passed/total*100)}%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
