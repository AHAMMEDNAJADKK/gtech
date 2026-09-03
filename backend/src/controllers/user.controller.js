import User from '../models/user.model.js';
import Designation from '../models/designation.model.js';
import mongoose from 'mongoose';
import { hashPassword, comparePassword } from '../utils/bcrypt.util.js';
import { authService } from '../services/auth.service.js';
import { recordAudit } from '../middleware/audit.middleware.js';
import notificationService from '../services/notification.service.js';
import { sendSuccess } from '../utils/response.util.js';
import {
  getPaginationParams,
  getPaginationMetadata
} from '../utils/pagination.util.js';
import { AppError } from '../middleware/errorHandler.js';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      return reject(new Error('Cloudinary credentials missing in environment'));
    }
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'crm_profiles' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

const processProfileImageFile = async (req, fallbackUrl = null) => {
  const file = req.file || (req.files && Array.isArray(req.files) ? (req.files.find(f => ['profileImage', 'avatar', 'profile_image', 'file'].includes(f.fieldname)) || req.files[0]) : null);
  if (!file || !file.buffer) return fallbackUrl;

  try {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      const uploadResult = await uploadToCloudinary(file.buffer);
      if (uploadResult && uploadResult.secure_url) {
        return uploadResult.secure_url;
      }
    }
  } catch (uploadError) {
    console.warn("Cloudinary profile image upload failed, utilizing Base64 fallback:", uploadError?.message || uploadError);
  }

  try {
    const mime = file.mimetype || 'image/jpeg';
    const base64 = file.buffer.toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    console.error("Base64 conversion failed:", e);
  }

  return fallbackUrl;
};

const findDesignationById = async (designationVal) => {
  if (!designationVal) return null;
  const valStr = String(designationVal).trim();
  if (!valStr) return null;

  try {
    // 1. Try finding by MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(valStr)) {
      const designation = await Designation.findById(valStr);
      if (designation) return designation;
    }

    // 2. Try finding by Designation name string (case-insensitive)
    const escaped = valStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const designationByName = await Designation.findOne({ name: { $regex: `^${escaped}$`, $options: 'i' } });
    if (designationByName) return designationByName;
  } catch (e) {
    console.warn("Designation lookup warning:", e);
  }

  // 3. Fallback: return object with string name so user designation is NEVER lost or rejected
  return { _id: null, name: valStr };
};

export const userController = {

  /**
   * GET /api/v1/users/list
   */
  getUserList: async (req, res) => {
    try {
      const loggedInUserId = req.user?.id || req.user?._id;
      const loggedInUserRole = String(req.user?.role || '').toLowerCase().trim();
      const loggedInRoleId = String(req.user?.role_id || req.user?.roleId || '').trim();
      
      let isNonOperational = false;
      if (loggedInUserId) {
        const currentUserObj = await User.findById(loggedInUserId).populate('departmentId', 'name');
        const deptName = currentUserObj?.departmentId?.name || currentUserObj?.department || '';
        isNonOperational = String(deptName).toLowerCase().trim() === 'non-operational';
      }

      const isSuperAdmin = req.user?.isSuperAdmin === true || req.user?.is_super_admin === true || loggedInUserRole === 'superadmin' || loggedInRoleId === '0';
      const isAdmin = loggedInUserRole === 'admin' || loggedInRoleId === '1';
      const isHr = loggedInUserRole === 'hr' || loggedInRoleId === '2';

      const isPrivileged = isSuperAdmin || isAdmin || isHr || isNonOperational || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(loggedInUserRole) || ['0', '1', '2'].includes(loggedInRoleId);
      
      let queryFilter = {
        isActive: true,
        role: { $nin: ['student', 'Student'] },
        role_id: { $nin: ['10', 10] }
      };

      if (!isPrivileged && loggedInUserId) {
        const Department = (await import('../modules/departments/department.model.js')).default;
        const UserDepartment = (await import('../models/userDepartment.model.js')).default;
        
        const currentUserObj = await User.findById(loggedInUserId).select('departmentId department designation');
        const designationName = String(currentUserObj?.designation || '').toLowerCase();
        let userDeptId = req.user?.departmentId || currentUserObj?.departmentId;
        let userDeptName = currentUserObj?.department;

        const isRoleBasedTeamLead = (
          loggedInUserRole.includes('manager') ||
          loggedInUserRole.includes('lead') ||
          loggedInUserRole.includes('hod') ||
          designationName.includes('manager') ||
          designationName.includes('lead') ||
          designationName.includes('hod') ||
          loggedInUserRole === '2'
        );

        const ledDepartments = await Department.find({ managerId: loggedInUserId }).select('_id name');
        let deptIds = ledDepartments.map(d => d._id);
        let deptNames = ledDepartments.map(d => d.name).filter(Boolean);

        if (isRoleBasedTeamLead && deptIds.length === 0) {
           if (userDeptId) {
             deptIds.push(userDeptId);
             try {
               const fallbackDept = await Department.findById(userDeptId).select('name');
               if (fallbackDept && fallbackDept.name) {
                 deptNames.push(fallbackDept.name);
               }
             } catch (err) {}
           }
           if (userDeptName) {
             deptNames.push(userDeptName);
           }
        }

        if (deptIds.length > 0 || deptNames.length > 0) {
          const userDepts = await UserDepartment.find({ departmentId: { $in: deptIds } }).select('userId');
          const userDeptUserIds = userDepts.map(ud => ud.userId).filter(Boolean);

          queryFilter.$or = [
            { departmentId: { $in: deptIds } },
            { department: { $in: deptNames, $ne: '' } },
            { _id: { $in: userDeptUserIds } }
          ];
        } else {
          // If they aren't a team lead/manager, they should only see themselves
          queryFilter._id = loggedInUserId;
        }
      }

      const users = await User.find(
        queryFilter,
        {
          password: 0,
          passwordHash: 0,
          __v: 0
        }
      )
      .populate('designationId')
      .populate('departmentId')
      const formattedUsers = users.map(u => {
        const uObj = u.toObject ? u.toObject() : { ...u };
        const imgUrl = uObj.avatar || uObj.profile_image || uObj.profileImage || null;
        uObj.avatar = imgUrl;
        uObj.profile_image = imgUrl;
        uObj.profileImage = imgUrl;
        return uObj;
      });

      return res.status(200).json(formattedUsers);

    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: 'Failed to fetch users'
      });
    }
  },

  /**
   * GET /api/v1/users
   */
  getUsers: async (req, res, next) => {
    try {
      const { page, limit, skip } =
        getPaginationParams(req.query);

      const {
        department,
        role,
        search,
        status
      } = req.query;

      const conditions = [];

      if (role) {
        const roleLower = String(role).toLowerCase().trim();
        if (roleLower === 'student' || roleLower === '10' || roleLower === '4') {
          conditions.push({
            $or: [
              { role: { $regex: /^student$/i } },
              { role_id: '10' },
              { role_id: 10 },
              { role_id: '4' },
              { role_id: 4 }
            ]
          });
        } else {
          conditions.push({ role: role });
        }
      } else {
        // Exclude students by default when listing staff members
        conditions.push({
          role: { $not: /^student$/i },
          role_id: { $nin: ['10', 10, '4', 4] }
        });
      }

      if (department) {
        conditions.push({
          $or: [
            { departmentId: department },
            { department: { $regex: department, $options: 'i' } }
          ]
        });
      }

      if (status !== undefined && status !== '') {
        conditions.push({ status: status });
      }

      if (search) {
        conditions.push({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { employeeId: { $regex: search, $options: 'i' } }
          ]
        });
      }

      const whereClause = conditions.length > 0 ? { $and: conditions } : {};

      const isPaginationRequested = req.query.page !== undefined || req.query.limit !== undefined;

      let query = User.find(whereClause)
        .populate(
          'departmentId',
          'name status'
        )
        .sort({ createdAt: -1 });

      if (isPaginationRequested) {
        query = query.skip(skip).limit(limit);
      }

      const [users, totalCount] =
        await Promise.all([
          query,
          User.countDocuments(whereClause)
        ]);

      const designationIds = users
        .map((u) => u.designationId || u.designation)
        .filter((designationId) => mongoose.Types.ObjectId.isValid(String(designationId)))
        .filter(Boolean);
      const designations = await Designation.find({ _id: { $in: designationIds } });
      const designationMap = new Map(designations.map((designation) => [
        String(designation._id),
        designation.name
      ]));

      const safeUsers = users.map((u) => {
        const designationId = u.designationId ? String(u.designationId) : '';
        const legacyDesignationId = designationMap.has(String(u.designation)) ? String(u.designation) : '';
        const resolvedDesignationId = designationId || legacyDesignationId;

        const isDeptActive = u.departmentId && u.departmentId.status !== false;

        return ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        employeeId: u.employeeId,
        department: isDeptActive ? (u.departmentId.name || u.department) : '',
        departmentId: isDeptActive ? u.departmentId._id : null,
        designation: resolvedDesignationId || u.designation,
        designationId: resolvedDesignationId,
        designationName: designationMap.get(resolvedDesignationId) || u.designation,
        reportingManager: u.reportingManager,
        avatar: u.avatar || u.profile_image || null,
        profile_image: u.avatar || u.profile_image || null,
        profileImage: u.avatar || u.profile_image || null,
        isActive: u.isActive,
        status: u.status || (u.isActive ? 'active' : 'inactive'),
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
        joining_date: u.joining_date,
        salary: u.salary,
        address: u.address,
        identityType: u.identityType,
        identityNumber: u.identityNumber,
        permissions: u.permissions || [],
        isSuperAdmin: u.isSuperAdmin || u.role === 'superadmin'
        });
      });

      const paginationMeta =
        getPaginationMetadata(
          totalCount,
          page,
          limit
        );

      return sendSuccess(res, {
        status: 200,
        message:
          'Staff directory list retrieved successfully.',
        data: safeUsers,
        pagination: paginationMeta
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/users/:id
   */
  getUserById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id)
        .populate(
          'departmentId',
          'name headUserId status'
        )
        .populate('designationId', 'name');

      if (!user) {
        throw new AppError(
          'Employee profile not found in directory.',
          404
        );
      }

      const isDeptActive = user.departmentId && user.departmentId.status !== false;

      const Department = (await import('../modules/departments/department.model.js')).default;
      const isTeamLead = await Department.exists({ managerId: user._id }) ? true : false;

      return sendSuccess(res, {
        status: 200,
        message:
          'Employee details successfully retrieved.',
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          employeeId: user.employeeId,
          department: isDeptActive ? (user.departmentId.name || user.department) : '',
          departmentId: isDeptActive ? user.departmentId : null,
          designation: user.designationId ? String(user.designationId._id) : user.designation,
          designationId: user.designationId ? String(user.designationId._id) : '',
          designationName: user.designationId?.name || user.designation,
          reportingManager: user.reportingManager,
          avatar: user.avatar || user.profile_image || null,
          profile_image: user.avatar || user.profile_image || null,
          profileImage: user.avatar || user.profile_image || null,
          isActive: user.isActive,
          status: user.status || (user.isActive ? 'active' : 'inactive'),
          lastLogin: user.lastLogin,
          isTeamLead,
          createdAt: user.createdAt,
          joining_date: user.joining_date,
          salary: user.salary,
          address: user.address,
          identityType: user.identityType,
          identityNumber: user.identityNumber,
          permissions: user.permissions || [],
          isSuperAdmin: user.isSuperAdmin || user.role === 'superadmin'
        }
      });

    } catch (error) {
      next(error);
    }
  },

  createUser: async (req, res, next) => {
    try {

      const {
        name,
        email,
        phone,
        role,
        department,
        departmentId,
        designation,
        reportingManager,
        status,
        employeeId,
        avatar,
        profile_image,
        password,
        joining_date,
        salary,
        address,
        identityType,
        identityNumber
      } = req.body;

      const searchConditions = [{ email }];
      if (phone) searchConditions.push({ phone });
      if (employeeId) searchConditions.push({ employeeId });

      const existingUsers = await User.find({
        $or: searchConditions
      });

      if (existingUsers.length > 0) {
        const conflicts = [];
        const hasEmail = existingUsers.some(u => u.email === email);
        const hasPhone = phone && existingUsers.some(u => u.phone === phone);
        const hasEmpId = employeeId && existingUsers.some(u => u.employeeId === employeeId);

        if (hasEmail) conflicts.push('Email');
        if (hasPhone) conflicts.push('Phone number');
        if (hasEmpId) conflicts.push('Employee ID');

        let msgPart = '';
        if (conflicts.length === 1) {
          msgPart = `${conflicts[0]} is`;
        } else if (conflicts.length === 2) {
          msgPart = `${conflicts[0]} and ${conflicts[1]} are`;
        } else {
          msgPart = `${conflicts[0]}, ${conflicts[1]} and ${conflicts[2]} are`;
        }
        const message = `Conflict: ${msgPart} already registered.`;

        throw new AppError(message, 409);
      }

      const tempPass =
        password || 'WelcomeKOD123!';

      const passwordHash =
        await hashPassword(tempPass);

      let fileUrl = avatar || profile_image || null;
      fileUrl = await processProfileImageFile(req, fileUrl);

      const selectedDesignation = await findDesignationById(designation);

      const newUser =
        await User.create({
          name,
          email,
          phone,
          role: role || 'employee',
          role_id: role === 'admin' ? '1' : (role === 'manager' ? '2' : '3'),
          department,
          departmentId,
          designation: selectedDesignation?.name || '',
          designationId: selectedDesignation?._id,
          reportingManager,
          status: status || 'active',
          employeeId,
          avatar: fileUrl,
          profile_image: fileUrl,
          passwordHash,
          joining_date: joining_date ? new Date(joining_date) : new Date(),
          salary: parseFloat(salary) || 0,
          address: address || '',
          identityType: identityType || 'aadhaar',
          identityNumber: identityNumber || ''
        });

      await recordAudit(req, {
        action: 'CREATE',
        entity: 'User',
        entityId: newUser._id,
        newValue: {
          name,
          email,
          role,
          employeeId,
          department,
          designation: selectedDesignation?.name || '',
          designationId: selectedDesignation?._id
        }
      });

      try {
        await notificationService.sendEmail(
          newUser.email,
          '🎉 Welcome to the Team!',
          'Your Command Center Account is Ready',
          `Welcome ${newUser.name}! Temp Password: ${tempPass}`
        );
      } catch (err) {
        console.error('Failed to send welcome email:', err.message);
      }

      return sendSuccess(res, {
        status: 201,
        message:
          'New employee account registered.',
        data: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          employeeId: newUser.employeeId,
          status: newUser.status
        }
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/users/:id
   */
  updateUser: async (req, res, next) => {
    try {

      const { id } = req.params;

      const {
        name,
        email,
        phone,
        role,
        department,
        departmentId,
        designation,
        reportingManager,
        status,
        avatar,
        profile_image,
        isActive,
        joining_date,
        salary,
        address,
        identityType,
        identityNumber,
        employeeId,
        dateOfBirth,
        gender,
        alternatePhone,
        city,
        state,
        pincode,
        qualification,
        institution,
        passingYear,
        coursePreference
      } = req.body;

      const existingUser =
        await User.findById(id);

      if (!existingUser) {
        throw new AppError(
          'Employee profile not found.',
          404
        );
      }

      let fileUrl = undefined;
      fileUrl = await processProfileImageFile(req, undefined);

      const selectedDesignation = await findDesignationById(designation);

      const updateFields = {
        name,
        phone,
        department,
        departmentId,
        designation: selectedDesignation?.name || (typeof designation === 'string' ? designation : existingUser.designation),
        designationId: selectedDesignation?._id || existingUser.designationId,
        reportingManager,
      };
      if (role) updateFields.role = role;
      if (status) updateFields.status = status;

      if (joining_date !== undefined) updateFields.joining_date = joining_date ? new Date(joining_date) : null;
      if (salary !== undefined) updateFields.salary = parseFloat(salary) || 0;
      if (address !== undefined) updateFields.address = address;
      if (identityType !== undefined) updateFields.identityType = identityType;
      if (identityNumber !== undefined) updateFields.identityNumber = identityNumber;
      if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
      if (gender !== undefined) updateFields.gender = gender;
      if (alternatePhone !== undefined) updateFields.alternatePhone = alternatePhone;
      if (city !== undefined) updateFields.city = city;
      if (state !== undefined) updateFields.state = state;
      if (pincode !== undefined) updateFields.pincode = pincode;
      if (qualification !== undefined) updateFields.qualification = qualification;
      if (institution !== undefined) updateFields.institution = institution;
      if (passingYear !== undefined) updateFields.passingYear = passingYear;
      if (coursePreference !== undefined) updateFields.coursePreference = coursePreference;

      if (email && email !== existingUser.email) {
        const emailTaken = await User.findOne({ email, _id: { $ne: id } });
        if (emailTaken) {
          throw new AppError('Conflict: Email address is already registered by another account.', 409);
        }
        updateFields.email = email;
      }

      if (phone && phone !== existingUser.phone) {
        const phoneTaken = await User.findOne({ phone, _id: { $ne: id } });
        if (phoneTaken) {
          throw new AppError('Conflict: Phone number is already registered to another account.', 409);
        }
        updateFields.phone = phone;
      }

      if (employeeId && employeeId !== existingUser.employeeId) {
        const empIdTaken = await User.findOne({ employeeId, _id: { $ne: id } });
        if (empIdTaken) {
          throw new AppError('Conflict: Employee ID is already registered to another account.', 409);
        }
        updateFields.employeeId = employeeId;
      }

      if (fileUrl) {
        updateFields.avatar = fileUrl;
        updateFields.profile_image = fileUrl;
      } else if (avatar || profile_image) {
        updateFields.avatar = avatar || profile_image;
        updateFields.profile_image = profile_image || avatar;
      }

      if (role) {
        updateFields.role = role;
        updateFields.role_id = role === 'admin' ? '1' : (role === 'manager' ? '2' : '3');
      }

      if (status !== undefined) {
        updateFields.status = status;
        updateFields.isActive = status === 'active';
      } else if (isActive !== undefined) {
        updateFields.isActive = isActive;
        updateFields.status = isActive ? 'active' : 'inactive';
      }

      const updatedUser =
        await User.findByIdAndUpdate(
          id,
          updateFields,
          { new: true }
        );

      await recordAudit(req, {
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        oldValue: {
          name: existingUser.name,
          email: existingUser.email,
          phone: existingUser.phone,
          status: existingUser.status
        },
        newValue: {
          name,
          email: updateFields.email || existingUser.email,
          phone,
          department,
          designation: selectedDesignation?.name || '',
          designationId: selectedDesignation?._id,
          status
        }
      });

      return sendSuccess(res, {
        status: 200,
        message:
          'Employee record successfully updated.',
        data: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          employeeId: updatedUser.employeeId,
          department: updatedUser.department,
          designation: updatedUser.designation,
          avatar: updatedUser.avatar || updatedUser.profile_image || null,
          profile_image: updatedUser.avatar || updatedUser.profile_image || null,
          profileImage: updatedUser.avatar || updatedUser.profile_image || null,
          status: updatedUser.status,
          isActive: updatedUser.isActive
        }
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/users/:id/role
   */
  changeUserRole: async (req, res, next) => {
    try {

      const { id } = req.params;
      const { role } = req.body;

      const user =
        await User.findById(id);

      if (!user) {
        throw new AppError(
          'Employee profile not found.',
          404
        );
      }

      const updatedUser =
        await User.findByIdAndUpdate(
          id,
          { role },
          { new: true }
        );

      await authService.revokeAllSessions(id);

      await recordAudit(req, {
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        oldValue: {
          role: user.role
        },
        newValue: {
          role
        }
      });

      return sendSuccess(res, {
        status: 200,
        message:
          `Role updated to ${role}. Security protocol triggered.`,
        data: {
          id: updatedUser._id,
          name: updatedUser.name,
          role: updatedUser.role
        }
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/users/:id/deactivate
   */
  deactivateUser: async (req, res, next) => {
    try {

      const { id } = req.params;

      const user =
        await User.findById(id);

      if (!user) {
        throw new AppError(
          'Employee profile not found.',
          404
        );
      }

      await User.findByIdAndUpdate(
        id,
        { isActive: false }
      );

      await authService.revokeAllSessions(id);

      await recordAudit(req, {
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        oldValue: {
          isActive: true
        },
        newValue: {
          isActive: false
        }
      });

      return sendSuccess(res, {
        status: 200,
        message:
          'Employee account deactivated.'
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/users/:id
   */
  deleteUser: async (req, res, next) => {
    try {

      const { id } = req.params;

      const user =
        await User.findById(id);

      if (!user) {
        throw new AppError(
          'Employee profile not found.',
          404
        );
      }

      await User.findByIdAndDelete(id);

      await authService.revokeAllSessions(id);

      await recordAudit(req, {
        action: 'DELETE',
        entity: 'User',
        entityId: id,
        oldValue: {
          name: user.name,
          email: user.email
        }
      });

      return sendSuccess(res, {
        status: 200,
        message:
          'Employee record successfully purged from the CRM database.'
      });

    } catch (error) {
      next(error);
    }
  },

  changePassword: async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new AppError('Current password and new password are required.', 400);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User profile not found.', 404);
      }

      const storedPassword = user.password || user.passwordHash;
      const isMatch = storedPassword && await comparePassword(currentPassword, storedPassword);
      if (!isMatch) {
        throw new AppError('Current password is incorrect.', 400);
      }

      // Backend password validation matching forgot password complexity
      const hasSymbol = /[\W_]/.test(newPassword);
      const hasNumber = /\d/.test(newPassword);
      const hasUppercase = /[A-Z]/.test(newPassword);
      const hasLowercase = /[a-z]/.test(newPassword);
      const isLongEnough = newPassword.length >= 8;

      if (!hasSymbol || !hasNumber || !hasUppercase || !hasLowercase || !isLongEnough) {
        throw new AppError('Password must be at least 8 characters long and include a symbol, number, uppercase and lowercase letters.', 400);
      }

      const newPasswordHash = await hashPassword(newPassword);
      user.password = newPasswordHash;
      user.passwordHash = newPasswordHash;
      await user.save();

      await recordAudit(req, {
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        newValue: { details: 'Self password change' }
      });

      return sendSuccess(res, {
        status: 200,
        message: 'Password successfully updated.'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/users/:id/permissions
   */
  updatePermissions: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { permissions, isSuperAdmin, role } = req.body;

      const user = await User.findById(id);
      if (!user) {
        throw new AppError('Employee profile not found.', 404);
      }

      if (permissions !== undefined && Array.isArray(permissions)) {
        user.permissions = permissions;
      }
      if (isSuperAdmin !== undefined) {
        user.isSuperAdmin = Boolean(isSuperAdmin);
        if (user.isSuperAdmin) {
          user.role = 'superadmin';
          user.role_id = '0';
        }
      }
      if (role !== undefined && role) {
        user.role = role;
        if (role === 'superadmin') {
          user.isSuperAdmin = true;
          user.role_id = '0';
        }
      }

      await user.save();

      return sendSuccess(res, {
        status: 200,
        message: 'Employee sidebar permissions updated successfully.',
        data: {
          id: user._id,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          isSuperAdmin: user.isSuperAdmin
        }
      });
    } catch (error) {
      next(error);
    }
  }

};
