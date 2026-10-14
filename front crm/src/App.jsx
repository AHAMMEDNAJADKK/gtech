import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';

// Page Imports
import { UserProvider } from './contexts/UserContext'; 
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Users from './pages/Users';
import UserDetailPage from './pages/UserDetailPage';
import Leads from './pages/Leads';
import LeadsTelecaller from './pages/LeadsTelecaller';
import LeadCounselor from './pages/LeadCounselor';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import StudentAttendance from './pages/StudentAttendance';
import CourseManagement from './pages/CourseManagement';
import CourseDetails from './pages/CourseDetails';
import BatchManagement from './pages/BatchManagement';
import BatchDetails from './pages/BatchDetails';
import EnrollmentTracking from './pages/EnrollmentTracking';
import EnrollmentDetails from './pages/EnrollmentDetails';
import StudentLmsPortal from './pages/StudentLmsPortal';
import StudentCourseViewer from './pages/StudentCourseViewer';
import NotificationPage from './pages/NotificationPage';
import AccountsPage from './pages/AccountsPage';
import LiveClassrooms from './pages/LiveClassrooms';
import CertificatesPage from './pages/CertificatesPage';
import VerifyCertificatePage from './pages/VerifyCertificatePage';
import AssignmentsGradingPage from './pages/AssignmentsGradingPage';
import CounselorDashboard from './pages/CounselorDashboard';
import SidebarPermissionsPage from './pages/SidebarPermissionsPage';
import UserPermissionsPage from './pages/UserPermissionsPage';

// Employee Management Pages
import StudentsPage from './pages/employees/StudentsPage';
import HrPage from './pages/employees/HrPage';
import MentorsPage from './pages/employees/MentorsPage';

// Shift Attendance & Reports Pages
import AttendancePage from './pages/AttendancePage';
import StudentAssignmentsPage from './pages/StudentAssignmentsPage';
import StudentResultsPage from './pages/StudentResultsPage';
import ReportsPage from './pages/ReportsPage';
import DailyShiftReportPage from './pages/DailyShiftReportPage';

import { resolveUserDashboardPath } from './utils/userDashboard';

// Route Guards
const getStoredToken = () => {
  const rawToken = localStorage.getItem('token');
  const token = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
  if (!token || ['undefined', 'null'].includes(token.toLowerCase())) {
    return '';
  }

  // Check if JWT token is expired
  try {
    const payloadBase64 = token.split('.')[1];
    if (payloadBase64) {
      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.warn('🔑 JWT token expired. Clearing session.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_id');
        return '';
      }
    }
  } catch (err) {
    // If decoding fails, retain token and let server validate
  }

  return token;
};

const ProtectedRoute = ({ children }) => {
  const token = getStoredToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const token = getStoredToken();
  if (token) {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        const targetPath = resolveUserDashboardPath(userObj);
        return <Navigate to={targetPath} replace />;
      }
    } catch (e) {
      console.error("Public redirect role parse failed:", e);
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const RoleRoute = ({ children, allowedRoles = [], fallbackPath = '/dashboard' }) => {
  const token = getStoredToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      const userRole = String(userObj.role_id || userObj.roleId || userObj.role || '').toLowerCase().trim();
      const userDesig = String(userObj.designation || userObj.designationId?.name || '').toLowerCase().trim();

      const isSuperAdmin =
        userObj.isSuperAdmin === true ||
        userObj.is_super_admin === true ||
        userRole === '0' ||
        userRole === 'superadmin' ||
        userRole === 'super_admin' ||
        userDesig.includes('super admin');

      // Super Admin has unrestricted access to all CRM routes
      if (isSuperAdmin) {
        return children;
      }

      const isStudent = userRole === 'student' || userRole === '10' || userDesig.includes('student');
      const isHR = userRole === 'hr' || (userRole === '2' && !isSuperAdmin) || userDesig.includes('hr');
      const isMentor =
        userRole === 'mentor' ||
        userRole === 'instructor' ||
        userRole === '3' ||
        userDesig.includes('mentor') ||
        userDesig.includes('instructor') ||
        userDesig.includes('faculty') ||
        userDesig.includes('teacher');

      const matches = allowedRoles.some(r => {
        const rLower = r.toLowerCase().trim();
        if ((rLower === 'superadmin' || rLower === 'admin') && isSuperAdmin) return true;
        if (rLower === 'student' && isStudent) return true;
        if (rLower === 'hr' && isHR) return true;
        if ((rLower === 'mentor' || rLower === 'instructor') && isMentor) return true;
        return userRole === rLower;
      });

      if (!matches) {
        const redirectTarget = isStudent ? '/academy/learning' : fallbackPath;
        return <Navigate to={redirectTarget} replace />;
      }
    }
  } catch (err) {
    console.error("RoleRoute evaluation failed:", err);
  }

  return children;
};

const LandingRoute = () => {
  const token = getStoredToken();
  if (!token) return <Navigate to="/login" replace />;

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      const targetDashboard = resolveUserDashboardPath(userObj);
      return <Navigate to={targetDashboard} replace />;
    }
  } catch (e) {
    console.error("Landing redirect role parse failed:", e);
  }

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          {/* Public Certificate Verification (accessible by anyone via QR code) */}
          <Route path="/verify-certificate/:code" element={<VerifyCertificatePage />} />

          {/* Overview & Dashboards */}
          <Route path="/dashboard" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
          <Route path="/counselor-dashboard" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'counselor']}><MainLayout><CounselorDashboard /></MainLayout></RoleRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><MainLayout><NotificationPage /></MainLayout></ProtectedRoute>} />

          {/* Admissions / Academic Counselor Pipeline */}
          <Route path="/leads" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'counselor', 'telecaller']}><MainLayout><Leads /></MainLayout></RoleRoute>} />
          <Route path="/leads-telecaller" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'counselor', 'telecaller']}><MainLayout><LeadsTelecaller /></MainLayout></RoleRoute>} />
          <Route path="/lead-counselor" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'counselor']}><MainLayout><LeadCounselor /></MainLayout></RoleRoute>} />

          {/* Academic Management (Courses & Batches) */}
          <Route path="/academy/courses" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor']} fallbackPath="/academy/learning"><MainLayout><CourseManagement /></MainLayout></RoleRoute>} />
          <Route path="/academy/courses/:courseId" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor']} fallbackPath="/academy/learning"><MainLayout><CourseDetails /></MainLayout></RoleRoute>} />
          <Route path="/academy/batches" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor']} fallbackPath="/academy/learning"><MainLayout><BatchManagement /></MainLayout></RoleRoute>} />
          <Route path="/academy/batches/:batchId" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor']} fallbackPath="/academy/learning"><MainLayout><BatchDetails /></MainLayout></RoleRoute>} />
          <Route path="/academy/enrollments" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor', 'counselor']} fallbackPath="/academy/learning"><MainLayout><EnrollmentTracking /></MainLayout></RoleRoute>} />
          <Route path="/academy/enrollments/:enrollmentId" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor', 'counselor']} fallbackPath="/academy/learning"><MainLayout><EnrollmentDetails /></MainLayout></RoleRoute>} />

          {/* Student LMS & Learning */}
          <Route path="/academy/learning" element={<ProtectedRoute><MainLayout><StudentLmsPortal /></MainLayout></ProtectedRoute>} />
          <Route path="/academy/learning/:courseId" element={<ProtectedRoute><MainLayout><StudentCourseViewer /></MainLayout></ProtectedRoute>} />

          {/* Employee Management Section (Students, HR, Mentors) */}
          <Route path="/employees" element={<Navigate to="/employees/students" replace />} />
          <Route path="/employees/students" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor', 'counselor']} fallbackPath="/academy/learning"><MainLayout><StudentsPage /></MainLayout></RoleRoute>} />
          <Route path="/employees/hr" element={<RoleRoute allowedRoles={['superadmin', 'admin']} fallbackPath="/dashboard"><MainLayout><HrPage /></MainLayout></RoleRoute>} />
          <Route path="/employees/mentors" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr']} fallbackPath="/dashboard"><MainLayout><MentorsPage /></MainLayout></RoleRoute>} />

          {/* Attendance System */}
          <Route path="/attendance" element={<ProtectedRoute><MainLayout><AttendancePage /></MainLayout></ProtectedRoute>} />
          <Route path="/student-attendance" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor']} fallbackPath="/attendance"><MainLayout><StudentAttendance /></MainLayout></RoleRoute>} />

          {/* Assignments & Grading Workflows */}
          <Route path="/assignments" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor']} fallbackPath="/student/assignments"><MainLayout><AssignmentsGradingPage /></MainLayout></RoleRoute>} />
          <Route path="/student/assignments" element={<RoleRoute allowedRoles={['student']} fallbackPath="/assignments"><MainLayout><StudentAssignmentsPage /></MainLayout></RoleRoute>} />
          <Route path="/student/results" element={<RoleRoute allowedRoles={['student']} fallbackPath="/assignments"><MainLayout><StudentResultsPage /></MainLayout></RoleRoute>} />
          <Route path="/student/submissions" element={<RoleRoute allowedRoles={['student']} fallbackPath="/assignments"><MainLayout><StudentResultsPage /></MainLayout></RoleRoute>} />

          {/* Student Fees & Accounts */}
          <Route path="/accounts" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'student', 'accountant']} fallbackPath="/dashboard"><MainLayout><AccountsPage /></MainLayout></RoleRoute>} />
          <Route path="/accounts/*" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'student', 'accountant']} fallbackPath="/dashboard"><MainLayout><AccountsPage /></MainLayout></RoleRoute>} />

          {/* Live Classrooms (Zoom / Google Meet) */}
          <Route path="/live-classes" element={<ProtectedRoute><MainLayout><LiveClassrooms /></MainLayout></ProtectedRoute>} />

          {/* Automated Certificates */}
          <Route path="/certificates" element={<ProtectedRoute><MainLayout><CertificatesPage /></MainLayout></ProtectedRoute>} />

          {/* Reports & Analytics */}
          <Route path="/reports" element={<RoleRoute allowedRoles={['superadmin', 'admin', 'hr', 'mentor', 'instructor']} fallbackPath="/dashboard"><MainLayout><ReportsPage /></MainLayout></RoleRoute>} />
          <Route path="/daily-shift-report" element={<ProtectedRoute><MainLayout><DailyShiftReportPage /></MainLayout></ProtectedRoute>} />

          {/* User Management & Settings */}
          <Route path="/users" element={<RoleRoute allowedRoles={['superadmin', 'admin']} fallbackPath="/dashboard"><MainLayout><Users /></MainLayout></RoleRoute>} />
          <Route path="/users/:userId" element={<RoleRoute allowedRoles={['superadmin', 'admin']} fallbackPath="/dashboard"><MainLayout><UserDetailPage /></MainLayout></RoleRoute>} />
          <Route path="/sidebar-permissions" element={<RoleRoute allowedRoles={['superadmin', 'admin']} fallbackPath="/dashboard"><MainLayout><SidebarPermissionsPage /></MainLayout></RoleRoute>} />
          <Route path="/permissions/:userId" element={<RoleRoute allowedRoles={['superadmin', 'admin']} fallbackPath="/dashboard"><MainLayout><UserPermissionsPage /></MainLayout></RoleRoute>} />
          <Route path="/settings" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />

          {/* Default Landing Route */}
          <Route path="/" element={<LandingRoute />} />

          {/* 404 Route */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
