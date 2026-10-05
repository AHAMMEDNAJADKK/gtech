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
          <Route path="/counselor-dashboard" element={<ProtectedRoute><MainLayout><CounselorDashboard /></MainLayout></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><MainLayout><NotificationPage /></MainLayout></ProtectedRoute>} />

          {/* Admissions / Academic Counselor Pipeline */}
          <Route path="/leads" element={<ProtectedRoute><MainLayout><Leads /></MainLayout></ProtectedRoute>} />
          <Route path="/leads-telecaller" element={<ProtectedRoute><MainLayout><LeadsTelecaller /></MainLayout></ProtectedRoute>} />
          <Route path="/lead-counselor" element={<ProtectedRoute><MainLayout><LeadCounselor /></MainLayout></ProtectedRoute>} />

          {/* Academic Management (Courses & Batches) */}
          <Route path="/academy/courses" element={<ProtectedRoute><MainLayout><CourseManagement /></MainLayout></ProtectedRoute>} />
          <Route path="/academy/courses/:courseId" element={<ProtectedRoute><MainLayout><CourseDetails /></MainLayout></ProtectedRoute>} />
          <Route path="/academy/batches" element={<ProtectedRoute><MainLayout><BatchManagement /></MainLayout></ProtectedRoute>} />
          <Route path="/academy/batches/:batchId" element={<ProtectedRoute><MainLayout><BatchDetails /></MainLayout></ProtectedRoute>} />
          <Route path="/academy/enrollments" element={<ProtectedRoute><MainLayout><EnrollmentTracking /></MainLayout></ProtectedRoute>} />
          <Route path="/academy/enrollments/:enrollmentId" element={<ProtectedRoute><MainLayout><EnrollmentDetails /></MainLayout></ProtectedRoute>} />

          {/* Student LMS & Learning */}
          <Route path="/academy/learning" element={<ProtectedRoute><MainLayout><StudentLmsPortal /></MainLayout></ProtectedRoute>} />
          <Route path="/academy/learning/:courseId" element={<ProtectedRoute><MainLayout><StudentCourseViewer /></MainLayout></ProtectedRoute>} />

          {/* Student Attendance */}
          <Route path="/student-attendance" element={<ProtectedRoute><MainLayout><StudentAttendance /></MainLayout></ProtectedRoute>} />

          {/* Assignments & Grading */}
          <Route path="/assignments" element={<ProtectedRoute><MainLayout><AssignmentsGradingPage /></MainLayout></ProtectedRoute>} />

          {/* Student Fees & Accounts */}
          <Route path="/accounts" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
          <Route path="/accounts/*" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />

          {/* Live Classrooms (Zoom / Google Meet) */}
          <Route path="/live-classes" element={<ProtectedRoute><MainLayout><LiveClassrooms /></MainLayout></ProtectedRoute>} />

          {/* Automated Certificates */}
          <Route path="/certificates" element={<ProtectedRoute><MainLayout><CertificatesPage /></MainLayout></ProtectedRoute>} />

          {/* User Management & Settings */}
          <Route path="/users" element={<ProtectedRoute><MainLayout><Users /></MainLayout></ProtectedRoute>} />
          <Route path="/users/:userId" element={<ProtectedRoute><MainLayout><UserDetailPage /></MainLayout></ProtectedRoute>} />
          <Route path="/sidebar-permissions" element={<ProtectedRoute><MainLayout><SidebarPermissionsPage /></MainLayout></ProtectedRoute>} />
          <Route path="/permissions/:userId" element={<ProtectedRoute><MainLayout><UserPermissionsPage /></MainLayout></ProtectedRoute>} />
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
