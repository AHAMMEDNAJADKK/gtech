import mongoose from 'mongoose';
import fs from 'fs';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://shabeeba:9995982324@cluster0.i23tzbf.mongodb.net/crm?appName=Cluster0';

async function inspect() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
  const Enrollment = mongoose.model('Enrollment', new mongoose.Schema({}, { strict: false }));

  const userCount = await User.countDocuments({});
  const studentUserCount = await User.countDocuments({
    $or: [
      { role: { $regex: /^student$/i } },
      { role_id: '10' },
      { role_id: 10 },
      { role_id: '4' },
      { role_id: 4 }
    ]
  });

  const dedicatedStudentCount = await Student.countDocuments({});
  const enrollmentCount = await Enrollment.countDocuments({});

  const sampleStudentUsers = await User.find({
    $or: [
      { role: { $regex: /^student$/i } },
      { role_id: '10' },
      { role_id: 10 },
      { role_id: '4' },
      { role_id: 4 }
    ]
  }).select('name email role role_id status isActive studentId employeeId identityNumber phone');

  const sampleDedicatedStudents = await Student.find({});

  const allUsersRoles = await User.aggregate([
    { $group: { _id: { role: '$role', role_id: '$role_id', status: '$status', isActive: '$isActive' }, count: { $sum: 1 } } }
  ]);

  const outputData = {
    summary: {
      totalUsers: userCount,
      studentUsersInUserCollection: studentUserCount,
      dedicatedStudentsInStudentCollection: dedicatedStudentCount,
      enrollmentCount: enrollmentCount
    },
    userRolesBreakdown: allUsersRoles,
    sampleStudentUsers: sampleStudentUsers,
    sampleDedicatedStudents: sampleDedicatedStudents
  };

  fs.writeFileSync('inspect_result.json', JSON.stringify(outputData, null, 2), 'utf8');
  console.log('Saved to inspect_result.json successfully');

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
