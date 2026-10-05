/**
 * Dynamically resolves the primary dashboard path for any logged-in user in the EdTech CRM.
 * - Admin -> /dashboard
 * - Counselor -> /dashboard (or /leads-telecaller)
 * - Instructor -> /academy/batches
 * - Student -> /academy/learning
 */

export const resolveUserDashboardPath = (userObj) => {
  if (!userObj) return '/dashboard';

  const userRole = String(userObj.role_id || userObj.roleId || userObj.role || '').toLowerCase().trim();
  const userDesig = String(userObj.designation || userObj.designationId?.name || '').toLowerCase().trim();

  // 1. Student Role -> Direct to Student Learning Portal
  if (userRole === 'student' || userRole === '10' || userDesig.includes('student')) {
    return '/academy/learning';
  }

  // 2. Instructor / Faculty Role -> Batches or Dashboard
  if (userRole.includes('instructor') || userDesig.includes('instructor') || userDesig.includes('trainer') || userDesig.includes('teacher')) {
    return '/academy/batches';
  }

  // 3. Academic Counselor Role
  if (userRole.includes('counsel') || userDesig.includes('counsel') || userDesig.includes('telecaller')) {
    return '/leads-telecaller';
  }

  // 4. Admin / Default -> Core EdTech Dashboard
  return '/dashboard';
};

export default resolveUserDashboardPath;
