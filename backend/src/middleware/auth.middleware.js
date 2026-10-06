
// middleware/auth.middleware.js

import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.helper.js';
import redis from '../config/redis.js';

/**
 * Standard Token Verification Middleware for Departments Module
 */
export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendError(res, 'No authorization header', 401);
    }

    if (!authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Invalid authorization format', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'supersecretjwtkey_12345';
    const decoded = jwt.verify(token, secret);
    
    req.user = decoded || {};
    const userId = decoded.id || decoded._id || decoded.userId;
    if (userId) {
      req.user.id = userId;
      req.user._id = userId;
      req.user.userId = userId;
    }
    if (decoded && (decoded.isSuperAdmin || String(decoded.role || '').toLowerCase() === 'superadmin' || String(decoded.role_id || '') === '0')) {
      req.user.isSuperAdmin = true;
    }
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    return sendError(res, error.message || 'Unauthorized access', 401);
  }
};

/**
 * Role Restriction Middleware
 * @param {Array<String>} allowedRoles - Roles allowed to mutate resources
 */
export const requireRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    // Collect possible role identifiers and user ID from req.user
    const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();
    const roleName = String(req.user?.role || '').toLowerCase().trim();
    const userId = req.user?.id || req.user?._id || req.user?.userId;

    let isSuperAdmin = 
      req.user?.isSuperAdmin === true ||
      req.user?.is_super_admin === true ||
      roleId === '0' ||
      roleName.includes('super');

    if (!isSuperAdmin && userId) {
      try {
        const User = (await import('../models/user.model.js')).default;
        const userObj = await User.findById(userId);
        if (userObj && (
          userObj.isSuperAdmin === true || 
          userObj.is_super_admin === true ||
          String(userObj.role).toLowerCase().includes('super') || 
          String(userObj.role_id) === '0' ||
          String(userObj.roleId) === '0'
        )) {
          isSuperAdmin = true;
          req.user.isSuperAdmin = true;
        }
      } catch (err) {}
    }

    if (isSuperAdmin) return next();

    // Explicitly deny students from administrative access
    if (roleId === '10' || roleName === 'student') {
      return res.status(403).json({
        success: false,
        detail: 'Access denied. Students cannot perform administrative actions.'
      });
    }

    // Map of roles for broad compatibility
    const isAllowed = allowedRoles.some(allowed => {
      const target = allowed.toLowerCase().trim();
      
      // Admin checks
      if (target === 'admin') {
        return (
          roleName === 'admin' ||
          roleId === '2' ||
          roleId === '1' ||
          roleName.toUpperCase() === 'MD' ||
          roleName.toUpperCase() === 'COO'
        );
      }
      
      // Employee checks
      if (target === 'employee') {
        return (
          roleName === 'employee' ||
          roleName === 'staff' ||
          roleId === '3' ||
          roleId === '2'
        );
      }

      // Student checks
      if (target === 'student') {
        return (
          roleName === 'student' ||
          roleId === '10' ||
          roleId === '4'
        );
      }

      // Exact checks (e.g. custom role strings or IDs)
      return (
        roleName === target ||
        roleId === target
      );
    });

    if (!isAllowed) {
      return sendError(res, 'Access denied. Insufficient permissions.', 403);
    }

    next();
  };
};

/**
 * Reusable Admin / Staff Middleware for Academy & CRM Administrative mutations
 */
export const requireAdminOrStaff = (req, res, next) => {
  const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();
  const roleName = String(req.user?.role || '').toLowerCase().trim();

  const isSuperAdmin = req.user?.isSuperAdmin === true || roleId === '0' || roleName.includes('super');
  if (isSuperAdmin) return next();

  if (roleId === '10' || roleName === 'student') {
    return res.status(403).json({
      success: false,
      detail: 'Access denied. Students are not authorized for administrative operations.'
    });
  }

  const isStaffOrAdmin = 
    ['1', '2', '3', 'hr', 'admin', 'employee', 'staff', 'instructor', 'teacher', 'manager', 'counselor'].includes(roleId) ||
    ['1', '2', '3', 'hr', 'admin', 'employee', 'staff', 'instructor', 'teacher', 'manager', 'counselor'].includes(roleName) ||
    roleName.toUpperCase() === 'MD' || roleName.toUpperCase() === 'COO';

  if (!isStaffOrAdmin) {
    return res.status(403).json({
      success: false,
      detail: 'Access denied. Insufficient permissions for administrative operation.'
    });
  }

  next();
};

/**
 * Strict Admin Authorization Middleware for Courses, Batches, Fees, and Settings
 */
export const requireAdmin = (req, res, next) => {
  const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();
  const roleName = String(req.user?.role || '').toLowerCase().trim();

  const isAdmin = 
    req.user?.isSuperAdmin === true ||
    roleId === '0' ||
    roleId === '1' ||
    roleId === '2' ||
    roleName === 'admin' ||
    roleName === 'superadmin' ||
    roleName.includes('admin') ||
    roleName.toUpperCase() === 'MD';

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      detail: 'Access denied. Administrator privileges required.'
    });
  }

  next();
};

/**
 * Instructor or Admin Authorization Middleware for Batch teaching, attendance, assignments, live classes
 */
export const requireInstructorOrAdmin = (req, res, next) => {
  const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();
  const roleName = String(req.user?.role || '').toLowerCase().trim();

  const isAllowed = 
    req.user?.isSuperAdmin === true ||
    roleId === '0' ||
    roleId === '1' ||
    roleId === '2' ||
    ['admin', 'superadmin', 'instructor', 'teacher', 'faculty', 'trainer'].includes(roleName) ||
    roleName.includes('instructor') ||
    roleName.includes('teach') ||
    roleName.includes('admin');

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      detail: 'Access denied. Instructor or Admin privileges required.'
    });
  }

  next();
};

/**
 * Counselor or Admin Authorization Middleware for Admissions pipeline
 */
export const requireCounselorOrAdmin = (req, res, next) => {
  const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();
  const roleName = String(req.user?.role || '').toLowerCase().trim();

  const isAllowed = 
    req.user?.isSuperAdmin === true ||
    roleId === '0' ||
    roleId === '1' ||
    roleId === '2' ||
    ['admin', 'superadmin', 'counselor', 'telecaller', 'admissions'].includes(roleName) ||
    roleName.includes('counsel') ||
    roleName.includes('admiss') ||
    roleName.includes('admin');

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      detail: 'Access denied. Counselor or Admin privileges required.'
    });
  }

  next();
};

/**
 * Strict SuperAdmin Authorization Middleware
 */
export const requireSuperAdmin = async (req, res, next) => {
  const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();
  const roleName = String(req.user?.role || '').toLowerCase().trim();
  const userId = req.user?.id || req.user?._id || req.user?.userId;

  let isSuper = 
    req.user?.isSuperAdmin === true ||
    req.user?.is_super_admin === true ||
    roleId === '0' ||
    roleName.includes('super');

  if (!isSuper && userId) {
    try {
      const User = (await import('../models/user.model.js')).default;
      const userObj = await User.findById(userId);
      if (userObj && (
        userObj.isSuperAdmin === true || 
        userObj.is_super_admin === true ||
        String(userObj.role).toLowerCase().includes('super') || 
        String(userObj.role_id) === '0' ||
        String(userObj.roleId) === '0'
      )) {
        isSuper = true;
        req.user.isSuperAdmin = true;
      }
    } catch (err) {}
  }

  if (!isSuper) {
    return res.status(403).json({
      success: false,
      detail: 'Access denied. Only SuperAdmins are authorized to delete enrollment records.'
    });
  }

  next();
};

/**
 * Strict Role Access control middleware for leads and analytics
 * Checks req.user.role (e.g. 'digital_marketer') and req.user.role_id (e.g. '4')
 */
export const restrictToRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    const userRole = String(req.user?.role || '').toLowerCase().trim();
    const userRoleId = String(req.user?.role_id || '').trim();

    const isSuperAdmin = 
      req.user?.isSuperAdmin === true ||
      req.user?.is_super_admin === true ||
      userRoleId === '0' ||
      userRole === 'superadmin' ||
      userRole === 'super_admin';

    if (isSuperAdmin) return next();

    const isAllowed = allowedRoles.some(role => {
      const target = role.toLowerCase().trim();
      return userRole === target || userRoleId === target;
    });

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have authorization for this action.'
      });
    }

    next();
  };
};

export const restrictToDepartment = (targetDeptNames = []) => {
  const allowedNames = (Array.isArray(targetDeptNames) ? targetDeptNames : [targetDeptNames]).map(n => String(n).toLowerCase().trim());
  return async (req, res, next) => {
    const role = String(req.user?.role || '').toLowerCase().trim();
    const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();
    const isSuperAdmin = req.user?.isSuperAdmin === true || req.user?.is_super_admin === true || role === 'superadmin' || roleId === '0';
    const isPrivileged = isSuperAdmin || ['1', '2', 'admin', 'hr'].includes(role) || ['1', '2'].includes(roleId);
    if (isPrivileged) {
      return next();
    }

    const userId = req.user?.id || req.user?._id;
    if (userId) {
      try {
        const User = (await import('../models/user.model.js')).default;
        const userObj = await User.findById(userId).populate('departmentId', 'name');
        const deptName = String(userObj?.departmentId?.name || userObj?.department || '').toLowerCase().trim();

        if (deptName.includes('hr') || deptName.includes('admin') || deptName.includes('non-operational')) {
          return next();
        }

        const matches = allowedNames.some(target => deptName.includes(target) || target.includes(deptName));
        if (matches) return next();
      } catch (err) {
        console.error("Department restriction check error:", err);
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied for this department.'
    });
  };
};

/**
 * Original default protectRoute middleware to prevent breaking existing routes
 * Restored EXACTLY to original implementation, with added Redis sliding session check.
 */
const protectRoute = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        detail: "No authorization header"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        detail: "Invalid authorization format"
      });
    }

    const token = authHeader.split(" ")[1];

    const secret = process.env.JWT_SECRET || 'supersecretjwtkey_12345';
    const decoded = jwt.verify(token, secret);

    req.user = decoded || {};
    const userId = decoded.id || decoded._id || decoded.userId;
    if (userId) {
      req.user.id = userId;
      req.user._id = userId;
      req.user.userId = userId;
    }
    const rId = String(req.user.role_id || req.user.roleId || '').trim();
    const rName = String(req.user.role || '').toLowerCase().trim();
    if (req.user.isSuperAdmin === true || req.user.is_super_admin === true || rId === '0' || rName.includes('super')) {
      req.user.isSuperAdmin = true;
    }

    // --- Inactivity sliding session check (30 mins = 1800 seconds) ---
    try {
      if (redis && redis.status === 'ready') {
        const sessionKey = `session:active:${decoded.id}`;
        const sessionExists = await redis.exists(sessionKey);
        
        if (sessionExists) {
          // Slide expiration forward
          await redis.expire(sessionKey, 1800);
        } else {
          // If Redis key is missing for valid JWT, auto-re-arm session key
          await redis.set(sessionKey, 'active', 'EX', 1800);
        }
      }
    } catch (redisError) {
      console.warn("Redis session verification failed, skipping check:", redisError.message);
    }

    next();

  } catch (error) {
    console.error("JWT ERROR:", error.message);

    return res.status(401).json({
      detail: error.message || "Unauthorized access"
    });
  }
};

export default protectRoute;
