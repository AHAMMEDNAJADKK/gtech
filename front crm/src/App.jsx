import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';

// Page Imports
import { UserProvider } from './contexts/UserContext'; 
import Dashboard from './pages/Dashboard';
import LeadDashboard from './pages/LeadDashboard';
import MarketingDashboard from './pages/Marketing Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Attendance from './pages/Attendance';
import Todo from './pages/Todo';
import Users from './pages/Users';
import Leads from './pages/Leads';
import LeadsTelecaller from './pages/LeadsTelecaller';
import LeadCounselor from './pages/LeadCounselor';
import ClientLeads from './pages/ClientLeads';
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
import DepartmentsPage from './modules/departments/DepartmentsPage';
import DeveloperReportPage from './pages/DeveloperReportPage';
import DeveloperDashboard from './pages/DeveloperDashboard';
import HodRdReportPage from './pages/HodRdReportPage';
import GraphicDesignerReportPage from './pages/GraphicDesignerReportPage';
import GraphicDesignerDashboard from './pages/GraphicDesignerDashboard';
import VideographerDashboard from './pages/VideographerDashboard';
import AcademicCounselorReportPage from './pages/AcademicCounselorReportPage';
import HrReportPage from './pages/HrReportPage';
import HrDashboard from './pages/HrDashboard';
import OpsReportPage from './pages/OpsReportPage';
import AccountantReportPage from './pages/AccountantReportPage';
import AccountantDashboard from './pages/AccountantDashboard';
import MarketingReportPage from './pages/MarketingReportPage';
import VideographerReportPage from './pages/VideographerReportPage';
import EmployeeReports from './pages/EmployeeReports';
import CounselorDashboard from './pages/CounselorDashboard';

import AiReport from './pages/AiReport';
import CommonDashboard from './pages/CommonDashboard';
import BasicReportPage from './pages/BasicReportPage';
import NotificationPage from './pages/NotificationPage';
import PerformanceDashboard from './pages/PerformanceDashboard';
import UserPermissionsPage from './pages/UserPermissionsPage';
import SidebarPermissionsPage from './pages/SidebarPermissionsPage';
import MdDashboard from './pages/MdDashboard';
import AccountsPage from './pages/AccountsPage';
import LeavesPage from './pages/LeavesPage';
import ApprovalsPage from './pages/ApprovalsPage';
import PayslipsPage from './pages/PayslipsPage';
import PersonalPayslipPage from './pages/PersonalPayslipPage';
import RecruitmentPage from './pages/RecruitmentPage';
import CalendarWorkPage from './pages/CalendarWorkPage';

// Client & Project Management Module Pages
import ClientsPage from './pages/ClientsPage';
import CreateClientPage from './pages/CreateClientPage';
import ClientDetailsPage from './pages/ClientDetailsPage';
import ProjectsPage from './pages/ProjectsPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectDetailsPage from './pages/ProjectDetailsPage';
import VisibleWorkPage from './pages/VisibleWorkPage';
import ProjectReportsPage from './pages/ProjectReportsPage';




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
        console.warn('🔑 JWT token expired overnight. Clearing session.');
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

const RestrictedRoute = ({ children }) => {
  return children;
};

const PublicRoute = ({ children }) => {
  const token = getStoredToken();
  if (token) {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        const role = String(userObj.role_id || userObj.roleId || userObj.role || '').toLowerCase().trim();
        const designation = String(userObj.designation || '').toLowerCase().trim();
        const designationId = String(userObj.designationId?._id || userObj.designationId || userObj.designation_id || '').trim();
        const isHr = role === 'hr' || designation.includes('hr');
        const isAdmin = ['1', '2', 'admin'].includes(role) || designation.includes('admin');
        
        if (isHr) {
          return <Navigate to="/hr-dashboard" replace />;
        }
        if (isAdmin) {
          return <Navigate to="/dashboard" replace />;
        }
        return <Navigate to="/attendance" replace />;
      }
    } catch (e) {
      console.error("Public redirect role parse failed:", e);
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

import { resolveUserDashboardPath } from './utils/userDashboard';

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
    <UserProvider><Router>
      <Routes>
        {/* Auth Routes - No Sidebar */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Protected Routes - Wrapped in MainLayout */}
        <Route path="/dashboard" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/lead-dashboard" element={<ProtectedRoute><MainLayout><LeadDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/marketing-dashboard" element={<ProtectedRoute><MainLayout><MarketingDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><MainLayout><Attendance /></MainLayout></ProtectedRoute>} />
        <Route path="/todo" element={<ProtectedRoute><MainLayout><RestrictedRoute><Todo /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><MainLayout><RestrictedRoute><Users /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/sidebar-permissions" element={<ProtectedRoute><MainLayout><RestrictedRoute><SidebarPermissionsPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/permissions/:userId" element={<ProtectedRoute><MainLayout><RestrictedRoute><UserPermissionsPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/leads" element={<ProtectedRoute><MainLayout><RestrictedRoute><Leads /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/leads-telecaller" element={<ProtectedRoute><MainLayout><RestrictedRoute><LeadsTelecaller /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/client-leads" element={<ProtectedRoute><MainLayout><RestrictedRoute><ClientLeads /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/lead-counselor" element={<ProtectedRoute><MainLayout><RestrictedRoute><LeadCounselor /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
        <Route path="/student-attendance" element={<ProtectedRoute><MainLayout><StudentAttendance /></MainLayout></ProtectedRoute>} />
        <Route path="/academy/courses" element={<ProtectedRoute><MainLayout><CourseManagement /></MainLayout></ProtectedRoute>} />
        <Route path="/academy/courses/:courseId" element={<ProtectedRoute><MainLayout><CourseDetails /></MainLayout></ProtectedRoute>} />
        <Route path="/academy/batches" element={<ProtectedRoute><MainLayout><BatchManagement /></MainLayout></ProtectedRoute>} />
        <Route path="/academy/batches/:batchId" element={<ProtectedRoute><MainLayout><BatchDetails /></MainLayout></ProtectedRoute>} />
        <Route path="/academy/enrollments" element={<ProtectedRoute><MainLayout><EnrollmentTracking /></MainLayout></ProtectedRoute>} />
        <Route path="/academy/enrollments/:enrollmentId" element={<ProtectedRoute><MainLayout><EnrollmentDetails /></MainLayout></ProtectedRoute>} />
        <Route path="/academy/learning" element={<ProtectedRoute><MainLayout><StudentLmsPortal /></MainLayout></ProtectedRoute>} />
        <Route path="/academy/learning/:courseId" element={<ProtectedRoute><MainLayout><StudentCourseViewer /></MainLayout></ProtectedRoute>} />
        <Route path="/departments" element={<ProtectedRoute><MainLayout><RestrictedRoute><DepartmentsPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/developer-report" element={<ProtectedRoute><MainLayout><DeveloperReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/developer-dashboard" element={<ProtectedRoute><MainLayout><DeveloperDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/hod-rd-report" element={<ProtectedRoute><MainLayout><HodRdReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/graphic-designer-report" element={<ProtectedRoute><MainLayout><GraphicDesignerReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/graphic-designer-dashboard" element={<ProtectedRoute><MainLayout><GraphicDesignerDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/videographer-dashboard" element={<ProtectedRoute><MainLayout><VideographerDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/academic-counselor-report" element={<ProtectedRoute><MainLayout><AcademicCounselorReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/counselor-dashboard" element={<ProtectedRoute><MainLayout><CounselorDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/hr-report" element={<ProtectedRoute><MainLayout><HrReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/hr-dashboard" element={<ProtectedRoute><MainLayout><HrDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/ops-report" element={<ProtectedRoute><MainLayout><OpsReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accountant-report" element={<ProtectedRoute><MainLayout><AccountantReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accountant-dashboard" element={<ProtectedRoute><MainLayout><AccountantDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/marketing-report" element={<ProtectedRoute><MainLayout><MarketingReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/videographer-report" element={<ProtectedRoute><MainLayout><VideographerReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/employee-reports" element={<ProtectedRoute><MainLayout><EmployeeReports /></MainLayout></ProtectedRoute>} />
        <Route path="/team-reports" element={<ProtectedRoute><MainLayout><EmployeeReports /></MainLayout></ProtectedRoute>} />
        <Route path="/ai-report" element={<ProtectedRoute><MainLayout><AiReport /></MainLayout></ProtectedRoute>} />
        <Route path="/common-dashboard" element={<ProtectedRoute><MainLayout><CommonDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/md-dashboard" element={<ProtectedRoute><MainLayout><RestrictedRoute><MdDashboard /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/basic-report" element={<ProtectedRoute><MainLayout><BasicReportPage /></MainLayout></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><MainLayout><NotificationPage /></MainLayout></ProtectedRoute>} />
        <Route path="/performance-dashboard" element={<ProtectedRoute><MainLayout><PerformanceDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/leaves" element={<ProtectedRoute><MainLayout><LeavesPage /></MainLayout></ProtectedRoute>} />
        <Route path="/approvals" element={<ProtectedRoute><MainLayout><ApprovalsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/payslips" element={<ProtectedRoute><MainLayout><PayslipsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/my-payslip" element={<ProtectedRoute><MainLayout><PersonalPayslipPage /></MainLayout></ProtectedRoute>} />
        <Route path="/recruitment" element={<ProtectedRoute><MainLayout><RecruitmentPage /></MainLayout></ProtectedRoute>} />

        {/* Accounts Department Module Routes */}
        <Route path="/accounts" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/income" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/sales" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/capital" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/purchase" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/create-invoice" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/income" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/capital" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/categories" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/expenses" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/salary" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/cash-book" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts/reports" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />

        {/* Client & Project Management Module Routes */}
        <Route path="/clients" element={<ProtectedRoute><MainLayout><RestrictedRoute><ClientsPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/clients/new" element={<ProtectedRoute><MainLayout><RestrictedRoute><CreateClientPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute><MainLayout><RestrictedRoute><ClientDetailsPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><MainLayout><RestrictedRoute><ProjectsPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/projects/new" element={<ProtectedRoute><MainLayout><RestrictedRoute><CreateProjectPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/projects/reports" element={<ProtectedRoute><MainLayout><RestrictedRoute><ProjectReportsPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><MainLayout><RestrictedRoute><ProjectDetailsPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />
        <Route path="/projects/:id/visible-work" element={<ProtectedRoute><MainLayout><RestrictedRoute><VisibleWorkPage /></RestrictedRoute></MainLayout></ProtectedRoute>} />

        {/* Content Calendar Module Route */}
        <Route path="/calendar-work" element={<ProtectedRoute><MainLayout><CalendarWorkPage /></MainLayout></ProtectedRoute>} />

        {/* Default Landing Route */}
        <Route path="/" element={<LandingRoute />} />

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" />} />
      </Routes>
    </Router></UserProvider>
  );
}


export default App;
