import User from '../models/user.model.js';
import Counter from '../models/counter.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../config/redis.js';
import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signup = async (req, res) => {
  try {
    const {
      name, email, password, phone, role_id, status,
      designation_id, department_id, departmentId, joining_date, salary, address,
      identityType, identityNumber, profile_image,
      dateOfBirth, gender, alternatePhone, city, state, pincode,
      qualification, institution, passingYear, coursePreference
    } = req.body;

    const { normalizeEmail, normalizePhone, normalizeIdentityNumber, buildPhoneMatchVariants } = await import('../utils/normalize.util.js');

    const cleanEmail = normalizeEmail(email);
    const cleanPhone = String(phone || '').trim();
    const cleanNormPhone = normalizePhone(cleanPhone);
    const cleanIdNum = normalizeIdentityNumber(identityNumber);

    // 1. Comprehensive Check if user or student already exists
    const searchConditions = [{ email: cleanEmail }];
    if (cleanPhone) {
      const phoneVariants = buildPhoneMatchVariants(cleanPhone);
      searchConditions.push({ phone: { $in: phoneVariants } });
      if (cleanNormPhone && cleanNormPhone.length >= 7) {
        searchConditions.push({ phone: new RegExp(`${cleanNormPhone}$`) });
      }
    }
    if (cleanIdNum) {
      searchConditions.push({ identityNumber: cleanIdNum });
    }

    const existingUsers = await User.find({ $or: searchConditions });
    if (existingUsers.length > 0) {
      const isStudentRegistration = String(role_id) === '10' || String(req.body.role || '').toLowerCase() === 'student';
      const existingStudent = existingUsers.find(u => u.role === 'student' || u.role_id === '10');
      const targetExisting = existingStudent || existingUsers[0];

      if (isStudentRegistration || existingStudent) {
        return res.status(409).json({
          success: false,
          conflict: true,
          message: "Student already exists. Please check the existing student record.",
          detail: "Student already exists. Please check the existing student record.",
          duplicateField: cleanEmail && existingUsers.some(u => u.email === cleanEmail) ? 'email' : 'phone',
          existingStudent: {
            _id: targetExisting._id,
            name: targetExisting.name,
            studentId: targetExisting.studentId || null
          }
        });
      }

      const conflicts = [];
      const hasEmail = existingUsers.some(u => u.email === cleanEmail);
      const hasPhone = cleanPhone && existingUsers.some(u => {
        const uNorm = normalizePhone(u.phone);
        return u.phone === cleanPhone || (cleanNormPhone && uNorm === cleanNormPhone);
      });
      if (hasEmail) conflicts.push('Email');
      if (hasPhone) conflicts.push('Phone number');

      let msgPart = '';
      if (conflicts.length === 1) {
        msgPart = `${conflicts[0]} is`;
      } else {
        msgPart = `${conflicts[0]} and ${conflicts[1]} are`;
      }
      return res.status(400).json({ detail: `Conflict: ${msgPart} already registered.` });
    }

    // 2. Hash security password
    const hashedPassword = await bcrypt.hash(password, 10);

    const roleMap = {
      '1': 'hr',
      '2': 'admin',
      '3': 'employee',
      '4': 'digital_marketer',
      '10': 'student'
    };
    const userRole = roleMap[role_id] || String(role_id || 'employee');

    // 2.2 Auto-generate Student ID for student role
    let generatedStudentId = null;
    if (String(role_id) === '10' || userRole === 'student') {
      const currentYear = new Date().getFullYear();
      const counterId = `student_${currentYear}`;
      const counter = await Counter.findOneAndUpdate(
        { id: counterId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      generatedStudentId = `STD-${currentYear}-${String(counter.seq).padStart(6, '0')}`;
    }

    // 2.5 Resolve designation and department names if provided
    let resolvedDesignationName = '';
    let resolvedDesignationId = null;
    if (designation_id && mongoose.Types.ObjectId.isValid(String(designation_id))) {
      const Designation = (await import('../models/designation.model.js')).default;
      const designationObj = await Designation.findById(designation_id);
      if (designationObj) {
        resolvedDesignationName = designationObj.name;
        resolvedDesignationId = designationObj._id;
      }
    }

    let resolvedDepartmentName = '';
    let resolvedDepartmentId = null;
    const deptId = departmentId || department_id;
    if (deptId && mongoose.Types.ObjectId.isValid(String(deptId))) {
      const Department = (await import('../modules/departments/department.model.js')).default;
      const departmentObj = await Department.findById(deptId);
      if (departmentObj) {
        resolvedDepartmentName = departmentObj.name;
        resolvedDepartmentId = departmentObj._id;
      }
    }

    // 3. Create document instance
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      passwordHash: hashedPassword,
      phone,
      role_id: String(role_id),
      role: userRole,
      status: status || 'active',
      isActive: (status || 'active') === 'active',
      designation: resolvedDesignationName,
      designationId: resolvedDesignationId,
      department: resolvedDepartmentName,
      departmentId: resolvedDepartmentId,
      designation_id: resolvedDesignationId ? String(resolvedDesignationId) : String(designation_id),
      joining_date: joining_date ? new Date(joining_date) : new Date(),
      salary: parseFloat(salary) || 0,
      address: address || '',
      identityType: identityType || 'aadhaar',
      identityNumber: identityNumber || '',
      profile_image: profile_image || null,
      avatar: profile_image || null,
      employeeId: generatedStudentId || email,
      studentId: generatedStudentId,
      dateOfBirth: dateOfBirth || '',
      gender: gender || '',
      alternatePhone: alternatePhone || '',
      city: city || '',
      state: state || '',
      pincode: pincode || '',
      qualification: qualification || '',
      institution: institution || '',
      passingYear: passingYear || '',
      coursePreference: coursePreference || ''
    });

    await newUser.save();

    res.status(201).json({
      message: "Student Registration Successful!",
      userId: newUser._id,
      studentId: generatedStudentId
    });
  } catch (error) {
    if (error.code === 11000) {
      const isStudent = String(req.body?.role_id) === '10' || String(req.body?.role || '').toLowerCase() === 'student';
      if (isStudent) {
        return res.status(409).json({
          success: false,
          conflict: true,
          message: "Student already exists. Please check the existing student record.",
          detail: "Student already exists. Please check the existing student record."
        });
      }
      return res.status(409).json({
        success: false,
        conflict: true,
        message: "Conflict: An account with this email or identifier is already registered.",
        detail: "Conflict: An account with this email or identifier is already registered."
      });
    }
    res.status(500).json({ detail: error.message });
  }
};



export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ detail: "Email and password credentials are required." });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanPassword = String(password);

    // 1. Find user by email (case-insensitive & trimmed)
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ detail: "Invalid credentials provided." });
    }

    // 2. Check account active status
    if (user.status === 'blocked' || user.status === 'inactive' || user.isActive === false) {
      return res.status(403).json({ detail: "Account is inactive or suspended. Please contact your administrator." });
    }

    // 3. Verify password (bcrypt + plain text fallback with auto-upgrade)
    const storedPassword = user.password || user.passwordHash;
    if (!storedPassword) {
      return res.status(401).json({ detail: "Invalid credentials provided." });
    }

    let validPassword = false;
    const isBcrypt = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$');

    if (isBcrypt) {
      try {
        validPassword = await bcrypt.compare(cleanPassword, storedPassword);
      } catch (bcryptErr) {
        console.error("Bcrypt comparison error:", bcryptErr.message);
        validPassword = false;
      }
    } else {
      // Plain-text check for initial temporary passwords or unhashed seeds
      if (cleanPassword === storedPassword) {
        validPassword = true;
        try {
          const hashedPassword = await bcrypt.hash(cleanPassword, 10);
          user.password = hashedPassword;
          user.passwordHash = hashedPassword;
          await user.save();
          console.log(`🔐 Auto-upgraded plain password to bcrypt hash for user: ${user.email}`);
        } catch (upgradeErr) {
          console.error("Failed to upgrade password hash:", upgradeErr.message);
        }
      }
    }

    if (!validPassword) {
      return res.status(401).json({ detail: "Invalid credentials provided." });
    }

    // 4. Sign Auth JWT Token safely with fallback secret
    const secret = process.env.JWT_SECRET || 'supersecretjwtkey_12345';
    const isSuperAdminUser = Boolean(user.isSuperAdmin || user.role === 'superadmin' || String(user.role_id) === '0');
    const token = jwt.sign(
      {
        id: user._id,
        _id: user._id,
        role_id: user.role_id,
        role: user.role || (isSuperAdminUser ? 'superadmin' : 'staff'),
        isSuperAdmin: isSuperAdminUser,
        departmentId: user.departmentId || null
      },
      secret,
      {
        expiresIn: process.env.JWT_EXPIRE || '7d'
      }
    );

    // 5. Redis active session key for inactivity timeout (30 mins = 1800 seconds)
    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
        await redis.set(`session:active:${user._id}`, 'active', 'EX', 1800);
        console.log(`🔑 Redis active session key set for User: ${user._id}`);
      }
    } catch (redisError) {
      console.warn("Failed to set Redis session key during login:", redisError.message);
    }

    // 6. Update lastLogin date
    try {
      user.lastLogin = new Date();
      await user.save();
    } catch (lastLoginErr) {
      console.warn("Failed to update lastLogin timestamp:", lastLoginErr.message);
    }

    // 7. Resolve department and team lead info safely
    let isTeamLead = false;
    let departmentName = user.department || '';

    try {
      const Department = (await import('../modules/departments/department.model.js')).default;
      if (Department) {
        const tlExists = await Department.exists({ managerId: user._id });
        isTeamLead = !!tlExists;

        if (user.departmentId && mongoose.Types.ObjectId.isValid(String(user.departmentId))) {
          const deptObj = await Department.findById(user.departmentId).select('name');
          if (deptObj && deptObj.name) {
            departmentName = deptObj.name;
          }
        }
      }
    } catch (deptErr) {
      console.warn("Department lookup warning during login:", deptErr.message);
    }

    // 8. Return matching data structure required by React components
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role || "employee",
        role_id: user.role_id,
        designation: user.designation,
        designationId: user.designationId || user.designation_id, 
        reportingManager: user.reportingManager || null,
        salary: user.salary ?? 0,
        profile_image: user.profile_image || null,
        department: departmentName,
        departmentId: user.departmentId || null,
        employeeId: user.employeeId || null,
        avatar: user.avatar || null,
        isActive: user.isActive ?? true,
        status: user.status || "active",
        joining_date: user.joining_date,
        isTeamLead,
        permissions: user.permissions || [],
        isSuperAdmin: Boolean(user.isSuperAdmin || user.role === 'superadmin' || user.role_id === '0'),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error("🚨 Login Controller Exception Error:", error);
    return res.status(500).json({ detail: error.message || "Internal server error during authentication" });
  }
};

const normalizePhoneDigits = (val) => {
  const digits = String(val || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

export const verifyForgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ success: false, detail: "Email and phone number are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, detail: "User profile not found with this email." });
    }

    const cleanUserPhone = normalizePhoneDigits(user.phone);
    const cleanInputPhone = normalizePhoneDigits(phone);

    if (!cleanUserPhone || !cleanInputPhone || cleanUserPhone !== cleanInputPhone) {
      return res.status(400).json({ success: false, detail: "Phone number does not match our records." });
    }

    return res.status(200).json({ success: true, message: "Credentials verified." });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
};

export const resetForgotPassword = async (req, res) => {
  try {
    const { email, phone, newPassword } = req.body;
    if (!email || !phone || !newPassword) {
      return res.status(400).json({ success: false, detail: "Email, phone number, and new password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, detail: "User profile not found." });
    }

    const cleanUserPhone = normalizePhoneDigits(user.phone);
    const cleanInputPhone = normalizePhoneDigits(phone);

    if (!cleanUserPhone || !cleanInputPhone || cleanUserPhone !== cleanInputPhone) {
      return res.status(400).json({ success: false, detail: "Phone number verification failed." });
    }

    // Backend validation for password requirements (symbol, length, uppercase, number)
    const hasSymbol = /[\W_]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const isLongEnough = newPassword.length >= 8;

    if (!hasSymbol || !hasNumber || !hasUppercase || !hasLowercase || !isLongEnough) {
      return res.status(400).json({
        success: false,
        detail: "Password must be at least 8 characters long and include a symbol, number, uppercase and lowercase letters."
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordHash = hashedPassword;
    await user.save();

    return res.status(200).json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { credential, token: inputToken } = req.body || {};
    const idToken = credential || inputToken;

    if (!idToken) {
      return res.status(400).json({ success: false, detail: "Google ID token credential is required." });
    }

    let payload;
    try {
      if (process.env.GOOGLE_CLIENT_ID) {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        payload = ticket.getPayload();
      } else {
        const decoded = jwt.decode(idToken);
        if (decoded && decoded.email) {
          payload = decoded;
        } else {
          return res.status(400).json({ success: false, detail: "Invalid Google token payload." });
        }
      }
    } catch (verifyErr) {
      console.warn("Google token verification warning, attempting fallback decode:", verifyErr.message);
      const decoded = jwt.decode(idToken);
      if (decoded && decoded.email) {
        payload = decoded;
      } else {
        return res.status(400).json({ success: false, detail: "Google token verification failed." });
      }
    }

    const { email, name, sub: googleId, picture } = payload || {};
    if (!email) {
      return res.status(400).json({ success: false, detail: "Google account does not provide an email address." });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      user = new User({
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: 'N/A',
        role: 'employee',
        role_id: '3',
        status: 'active',
        isActive: true,
        profile_image: picture || null,
        avatar: picture || null,
        googleId,
        isGoogleAuth: true
      });
      await user.save();
      console.log(`✨ Created new Google authenticated user account: ${user.email}`);
    } else {
      let updated = false;
      if (!user.googleId) {
        user.googleId = googleId;
        user.isGoogleAuth = true;
        updated = true;
      }
      if (picture && (!user.profile_image || !user.avatar)) {
        user.profile_image = user.profile_image || picture;
        user.avatar = user.avatar || picture;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    if (user.status === 'blocked' || user.status === 'inactive' || user.isActive === false) {
      return res.status(403).json({ detail: "Account is inactive or suspended. Please contact your administrator." });
    }

    const secret = process.env.JWT_SECRET || 'supersecretjwtkey_12345';
    const isSuperAdminUser = Boolean(user.isSuperAdmin || user.role === 'superadmin' || String(user.role_id) === '0');
    const authToken = jwt.sign(
      {
        id: user._id,
        role_id: user.role_id,
        role: user.role || (isSuperAdminUser ? 'superadmin' : 'staff'),
        isSuperAdmin: isSuperAdminUser,
        departmentId: user.departmentId || null
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
        await redis.set(`session:active:${user._id}`, 'active', 'EX', 1800);
      }
    } catch (redisError) {}

    user.lastLogin = new Date();
    await user.save();

    return res.json({
      success: true,
      message: "Google login successful",
      token: authToken,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role || "employee",
        role_id: user.role_id,
        designation: user.designation,
        designationId: user.designationId || user.designation_id, 
        reportingManager: user.reportingManager || null,
        salary: user.salary ?? 0,
        profile_image: user.profile_image || null,
        department: user.department || '',
        departmentId: user.departmentId || null,
        employeeId: user.employeeId || null,
        avatar: user.avatar || null,
        isActive: user.isActive ?? true,
        status: user.status || "active",
        joining_date: user.joining_date,
        permissions: user.permissions || [],
        isSuperAdmin: isSuperAdminUser,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error("Google Auth Controller Error:", error);
    return res.status(500).json({ detail: error.message || "Internal server error during Google authentication." });
  }
};