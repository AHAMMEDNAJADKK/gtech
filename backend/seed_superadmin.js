import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {}

import User from './src/models/user.model.js';

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL;

async function seedSuperAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to:', mongoose.connection.name);

    const email = 'superadmin@gmail.com';
    const plainPassword = 'superadmin@111';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const userData = {
      name: 'Super Admin',
      email: email.toLowerCase().trim(),
      phone: '+91 9999999999',
      password: hashedPassword,
      passwordHash: hashedPassword,
      role: 'superadmin',
      role_id: '0',
      isSuperAdmin: true,
      status: 'active',
      isActive: true,
      employeeId: 'EMP-SUPERADMIN-001',
      designation: 'Super Administrator'
    };

    let user = await User.findOne({ email: userData.email });

    if (user) {
      console.log('Existing super admin user found. Updating password and permissions...');
      user.name = userData.name;
      user.password = hashedPassword;
      user.passwordHash = hashedPassword;
      user.role = 'superadmin';
      user.role_id = '0';
      user.isSuperAdmin = true;
      user.status = 'active';
      user.isActive = true;
      if (!user.employeeId) user.employeeId = userData.employeeId;
      await user.save();
      console.log('✅ Super admin credentials updated successfully!');
    } else {
      console.log('Creating new super admin user...');
      user = await User.create(userData);
      console.log('✅ Super admin created successfully!');
    }

    console.log('\n----------------------------------------');
    console.log(`User ID:       ${user._id}`);
    console.log(`Name:          ${user.name}`);
    console.log(`Email:         ${user.email}`);
    console.log(`Role:          ${user.role} (Role ID: ${user.role_id})`);
    console.log(`isSuperAdmin:  ${user.isSuperAdmin}`);
    console.log('----------------------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
}

seedSuperAdmin();
