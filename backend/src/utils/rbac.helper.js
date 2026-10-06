/**
 * Centralized RBAC & Permission Helper for EdTech CRM
 * Handles Role-Based Access Control, Department resolution,
 * and Admissions module permissions.
 */

export const EDTECH_PERMISSIONS = {
  LEADS_VIEW: 'leads.view',
  LEADS_CREATE: 'leads.create',
  LEADS_UPDATE: 'leads.update',
  LEADS_DELETE: 'leads.delete',
  LEADS_ASSIGN: 'leads.assign',
  LEADS_CONVERT: 'leads.convert',
  FOLLOWUPS_VIEW: 'followups.view',
  FOLLOWUPS_CREATE: 'followups.create',
  FOLLOWUPS_UPDATE: 'followups.update',
  FOLLOWUPS_DELETE: 'followups.delete'
};

/**
 * Resolves full authorization context for an authenticated user request.
 */
export const getAuthUserContext = async (req) => {
  const userId = req.user?.id || req.user?._id || req.user?.userId;
  const role = String(req.user?.role || '').toLowerCase().trim();
  const roleId = String(req.user?.role_id || req.user?.roleId || '').trim();

  let isSuperAdmin = Boolean(
    req.user?.isSuperAdmin === true ||
    req.user?.is_super_admin === true ||
    role === 'superadmin' ||
    role === 'super_admin' ||
    roleId === '0'
  );

  let department = String(req.user?.department || req.user?.departmentId?.name || '').toLowerCase().trim();
  let designation = String(req.user?.designation || req.user?.designationId?.name || '').toLowerCase().trim();
  let permissions = Array.isArray(req.user?.permissions) ? req.user.permissions.map(p => String(p).toLowerCase().trim()) : [];

  // Deep fallback: If DB query needed to resolve missing profile properties
  if (userId && (!department || !designation || permissions.length === 0 || !isSuperAdmin)) {
    try {
      const User = (await import('../models/user.model.js')).default;
      const userDoc = await User.findById(userId)
        .populate('departmentId', 'name')
        .populate('designationId', 'name')
        .lean();

      if (userDoc) {
        if (!isSuperAdmin) {
          isSuperAdmin = Boolean(
            userDoc.isSuperAdmin === true ||
            userDoc.is_super_admin === true ||
            String(userDoc.role || '').toLowerCase() === 'superadmin' ||
            String(userDoc.role_id || '') === '0'
          );
        }
        if (!department) {
          department = String(userDoc.departmentId?.name || userDoc.department || '').toLowerCase().trim();
        }
        if (!designation) {
          designation = String(userDoc.designationId?.name || userDoc.designation || '').toLowerCase().trim();
        }
        if (Array.isArray(userDoc.permissions) && userDoc.permissions.length > 0) {
          permissions = userDoc.permissions.map(p => String(p).toLowerCase().trim());
        }
      }
    } catch (err) {
      console.warn('Failed to load user DB fallback in RBAC context:', err.message);
    }
  }

  // Identify roles in EdTech context
  const isStudent = role === 'student' || roleId === '10' || designation === 'student';

  const isInstructor = (
    role === 'instructor' ||
    role === 'teacher' ||
    role === 'faculty' ||
    role === 'trainer' ||
    designation.includes('instructor') ||
    designation.includes('teacher') ||
    designation.includes('faculty') ||
    designation.includes('trainer')
  );

  const isAdmin = Boolean(
    isSuperAdmin ||
    role === 'admin' ||
    role === 'hr' ||
    roleId === '1' ||
    roleId === '2' ||
    role.toUpperCase() === 'MD' ||
    role.toUpperCase() === 'COO' ||
    designation.includes('admin') ||
    department.includes('admin')
  );

  const isCounselor = Boolean(
    !isStudent &&
    !isInstructor &&
    (
      role.includes('counsel') ||
      role.includes('telecall') ||
      role.includes('admiss') ||
      roleId === '3' ||
      roleId === '4' ||
      designation.includes('counsel') ||
      designation.includes('telecall') ||
      designation.includes('admiss') ||
      designation.includes('academic') ||
      department.includes('admiss') ||
      department.includes('counsel') ||
      department.includes('telecall') ||
      department.includes('sales') ||
      department.includes('growth')
    )
  );

  return {
    userId: String(userId || ''),
    role,
    roleId,
    department,
    designation,
    permissions,
    isSuperAdmin,
    isAdmin,
    isCounselor,
    isInstructor,
    isStudent
  };
};

/**
 * Checks if the context has the requested permission
 */
export const hasPermission = (context, permissionKey) => {
  if (context.isSuperAdmin) return true;
  if (context.isStudent) return false;

  const keyLower = String(permissionKey).toLowerCase().trim();

  // Explicit permission array match
  if (context.permissions.includes(keyLower) || context.permissions.includes('*')) {
    return true;
  }

  // Super Admin & Admin defaults
  if (context.isAdmin) {
    return true;
  }

  // Counselor / Admissions defaults
  if (context.isCounselor) {
    const counselorAllowed = [
      EDTECH_PERMISSIONS.LEADS_VIEW,
      EDTECH_PERMISSIONS.LEADS_CREATE,
      EDTECH_PERMISSIONS.LEADS_UPDATE,
      EDTECH_PERMISSIONS.LEADS_CONVERT,
      EDTECH_PERMISSIONS.FOLLOWUPS_VIEW,
      EDTECH_PERMISSIONS.FOLLOWUPS_CREATE,
      EDTECH_PERMISSIONS.FOLLOWUPS_UPDATE,
      'leads',
      'leads & enquiries',
      '/leads',
      '/leads-telecaller'
    ];
    return counselorAllowed.includes(keyLower);
  }

  return false;
};
