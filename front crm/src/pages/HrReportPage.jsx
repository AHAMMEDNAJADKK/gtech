import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { uploadCompiledPDFReport } from '../services/departmentService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, Plus, Trash2, Save, Download, 
  CheckCircle, HelpCircle, Loader2, User, ChevronLeft, ChevronRight, Pencil, X, Maximize2,
  MinusCircle, PlusCircle
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompletedTasks } from '../utils/taskUtils';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const DEFAULT_DAILY_OPERATIONS = [];

const DEFAULT_EMPLOYEE_MGMT = [
  { employeeName: 'NA', department: '', attendance: '', taskStatus: '', remarks: '' },
  { employeeName: 'NA', department: '', attendance: '', taskStatus: '', remarks: '' }
];

const DEFAULT_RECRUITMENT = [
  { activity: 'Applications Received:', countStatus: '' },
  { activity: 'Interviews Conducted:', countStatus: '' },
  { activity: 'Candidates Shortlisted:', countStatus: '' },
  { activity: 'New Joining', countStatus: '' },
  { activity: 'Pending Hiring', countStatus: '' }
];

const DEFAULT_ATTENDANCE_LEAVE = [
  { category: 'Present Employees', count: '' },
  { category: 'Absent Employees', count: '' },
  { category: 'Leave Requests', count: '' },
  { category: 'Approved Leaves', count: '' },
  { category: 'Late Attendance Cases', count: '' }
];

const DEFAULT_ADMIN_OPERATIONS = [
  { activity: 'Office Maintenance', status: '', dueDate: '', remarks: '' },
  { activity: 'Inventory Check', status: '', dueDate: '', remarks: '' },
  { activity: 'Asset Management', status: '', dueDate: '', remarks: '' },
  { activity: 'Vendor Coordination', status: '', dueDate: '', remarks: '' },
  { activity: 'Utility Monitoring', status: '', dueDate: '', remarks: '' }
];

const DEFAULT_DOCUMENTATION = [
  { activity: 'Employee Documents Updated', dueDate: '', status: '' },
  { activity: 'Contracts Verified', dueDate: '', status: '' },
  { activity: 'Payroll Coordination Done', dueDate: '', status: '' },
  { activity: 'Compliance Checked', dueDate: '', status: '' },
  { activity: 'Reports Filed', dueDate: '', status: '' }
];

const DEFAULT_KPI_TRACKING = [
  { kpi: 'Attendance Compliance', status: '' },
  { kpi: 'Recruitment Tasks', status: '' },
  { kpi: 'Admin Tasks Completed', status: '' },
  { kpi: 'Employee Support Requests Closed', status: '' }
];

const DEFAULT_ISSUES = [
  { issue: 'NA', priority: '', actionTaken: '' },
  { issue: 'NA', priority: '', actionTaken: '' }
];

const DEFAULT_HANDOVER = [
  { item: 'Pending Tasks Shared', status: '' },
  { item: 'Reports Submitted', status: '' },
  { item: 'Documents Updated', status: '' },
  { item: 'Management Updated', status: '' }
];

const HrReportPage = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [isPrivileged, setIsPrivileged] = useState(false);

  // Selection states
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedUserId, setSelectedUserId] = useState(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const queryUserId = queryParams.get('userId');
    if (queryUserId) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const userObj = JSON.parse(savedUser);
          const role = String(userObj.role_id || userObj.role || '').toLowerCase().trim();
          const privileged = ['1', '2', 'hr', 'admin'].includes(role);
          if (privileged) return queryUserId;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return '';
  });
  const [hrStaff, setHrStaff] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);

  // Form States
  const [basicDetails, setBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: 'HR / Admin',
    designation: 'HR / Admin Manager',
    shiftTiming: '9:00 AM – 5:00 PM',
    reportingTo: 'COO / Executive Director',
    preparedTime: ''
  });

  const [dailyOperations, setDailyOperations] = useState(DEFAULT_DAILY_OPERATIONS);
  const [selectedActivityText, setSelectedActivityText] = useState(null);
  const [employeeManagement, setEmployeeManagement] = useState(DEFAULT_EMPLOYEE_MGMT);
  const [recruitmentReport, setRecruitmentReport] = useState(DEFAULT_RECRUITMENT);
  const [attendanceLeave, setAttendanceLeave] = useState(DEFAULT_ATTENDANCE_LEAVE);
  const [adminOperations, setAdminOperations] = useState(DEFAULT_ADMIN_OPERATIONS);
  const [documentationCompliance, setDocumentationCompliance] = useState(DEFAULT_DOCUMENTATION);
  const [kpiTracking, setKpiTracking] = useState(DEFAULT_KPI_TRACKING);
  const [issuesEscalations, setIssuesEscalations] = useState(DEFAULT_ISSUES);
  const [nextDayActionPlan, setNextDayActionPlan] = useState("1.\n\n2.\n\n3.");
  const [finalShiftHandover, setFinalShiftHandover] = useState(DEFAULT_HANDOVER);
  const [hrAdminComments, setHrAdminComments] = useState('');
  
  const [approval, setApproval] = useState({
    hrName: '',
    hrSignature: '',
    hrDate: '',
    cooName: 'COO / Executive Director',
    cooSignature: '',
    cooDate: ''
  });

  const [hiddenSections, setHiddenSections] = useState({});

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Monthly states
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);

  // Auto-open monthly modal from URL parameters
  useEffect(() => {
    if (selectedUserId) {
      const queryParams = new URLSearchParams(window.location.search);
      const savedUser = localStorage.getItem('user');
      let isUserPrivileged = false;
      if (savedUser) {
        try {
          const userObj = JSON.parse(savedUser);
          const role = String(userObj.role_id || userObj.role || '').toLowerCase().trim();
          isUserPrivileged = ['1', '2', 'hr', 'admin'].includes(role);
        } catch (e) {
          console.error(e);
        }
      }
      
      if (isUserPrivileged) {
        if (queryParams.get('generateMonthly') === 'true') {
          setIsMonthlyModalOpen(true);
        }
      }
    }
  }, [selectedUserId]);
  const [monthlyStartDate, setMonthlyStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [monthlyEndDate, setMonthlyEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [monthlyActiveTab, setMonthlyActiveTab] = useState("recruitment");
  const [monthlyBasicDetails, setMonthlyBasicDetails] = useState({
    dateRange: '',
    employeeName: '',
    employeeId: '',
    department: '',
    designation: '',
    reportingTo: '',
    preparedTime: ''
  });
  const [monthlyDailyOperations, setMonthlyDailyOperations] = useState([]);
  const [monthlyEmployeeManagement, setMonthlyEmployeeManagement] = useState([]);
  const [monthlyRecruitmentReport, setMonthlyRecruitmentReport] = useState([]);
  const [monthlyAttendanceLeave, setMonthlyAttendanceLeave] = useState([]);
  const [monthlyAdminOperations, setMonthlyAdminOperations] = useState([]);
  const [monthlyDocumentationCompliance, setMonthlyDocumentationCompliance] = useState([]);
  const [monthlyKpiTracking, setMonthlyKpiTracking] = useState([]);
  const [monthlyIssuesEscalations, setMonthlyIssuesEscalations] = useState([]);
  const [monthlyFinalShiftHandover, setMonthlyFinalShiftHandover] = useState([]);
  const [monthlyNextDayActionPlan, setMonthlyNextDayActionPlan] = useState('');
  const [monthlyHrAdminComments, setMonthlyHrAdminComments] = useState('');

  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);

  // Auto-open weekly modal from URL parameters
  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

  useEffect(() => {
    if (selectedUserId) {
      const queryParams = new URLSearchParams(window.location.search);
      const savedUser = localStorage.getItem('user');
      let isUserPrivileged = false;
      if (savedUser) {
        try {
          const userObj = JSON.parse(savedUser);
          const role = String(userObj.role_id || userObj.role || '').toLowerCase().trim();
          isUserPrivileged = ['1', '2', 'hr', 'admin'].includes(role);
        } catch (e) {
          console.error(e);
        }
      }
      
      if (isUserPrivileged) {
        if (queryParams.get('generateWeekly') === 'true') {
          setIsWeeklyModalOpen(true);
        }
      }
    }
  }, [selectedUserId]);
  const [weeklyStartDate, setWeeklyStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [weeklyEndDate, setWeeklyEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [weeklyActiveTab, setWeeklyActiveTab] = useState("recruitment");
  const [weeklyBasicDetails, setWeeklyBasicDetails] = useState({
    dateRange: '',
    employeeName: '',
    employeeId: '',
    department: '',
    designation: '',
    reportingTo: '',
    preparedTime: ''
  });
  const [weeklyDailyOperations, setWeeklyDailyOperations] = useState([]);
  const [weeklyEmployeeManagement, setWeeklyEmployeeManagement] = useState([]);
  const [weeklyRecruitmentReport, setWeeklyRecruitmentReport] = useState([]);
  const [weeklyAttendanceLeave, setWeeklyAttendanceLeave] = useState([]);
  const [weeklyAdminOperations, setWeeklyAdminOperations] = useState([]);
  const [weeklyDocumentationCompliance, setWeeklyDocumentationCompliance] = useState([]);
  const [weeklyKpiTracking, setWeeklyKpiTracking] = useState([]);
  const [weeklyIssuesEscalations, setWeeklyIssuesEscalations] = useState([]);
  const [weeklyFinalShiftHandover, setWeeklyFinalShiftHandover] = useState([]);
  const [weeklyNextDayActionPlan, setWeeklyNextDayActionPlan] = useState('');
  const [weeklyHrAdminComments, setWeeklyHrAdminComments] = useState('');
  const [weeklyAchievements, setWeeklyAchievements] = useState('');
  const [weeklyImprovements, setWeeklyImprovements] = useState('');
  const [weeklyNextWeekPlanning, setWeeklyNextWeekPlanning] = useState('');

  // Get Auth Headers Helper
  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const handleFetchMonthlyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a user first.", "error");
      return;
    }
    setIsMonthlyLoading(true);
    try {
      const start = new Date(monthlyStartDate);
      const end = new Date(monthlyEndDate);
      const dates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      const promises = dates.map(dateStr => 
        fetch(`${API_BASE}/v1/hr-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
          headers: getAuthHeaders()
        }).then(res => res.json())
      );

      const results = await Promise.all(promises);
      const validReports = results
        .filter(res => res.success && res.data)
        .map(res => res.data);

      if (validReports.length === 0) {
        showToast("No daily reports found in the selected date range.", "warning");
        setIsMonthlyLoading(false);
        return;
      }

      const consolidatedRecruitment = JSON.parse(JSON.stringify(DEFAULT_RECRUITMENT));
      const consolidatedAttendance = JSON.parse(JSON.stringify(DEFAULT_ATTENDANCE_LEAVE));
      const consolidatedDailyOps = JSON.parse(JSON.stringify(DEFAULT_DAILY_OPERATIONS));
      const consolidatedAdminOps = JSON.parse(JSON.stringify(DEFAULT_ADMIN_OPERATIONS));
      const consolidatedCompliance = JSON.parse(JSON.stringify(DEFAULT_DOCUMENTATION));
      const consolidatedKPI = JSON.parse(JSON.stringify(DEFAULT_KPI_TRACKING));
      const consolidatedHandover = JSON.parse(JSON.stringify(DEFAULT_HANDOVER));

      consolidatedDailyOps.forEach(row => { row.remarks = ''; row.status = ''; });
      consolidatedAdminOps.forEach(row => { row.remarks = ''; row.status = ''; });
      consolidatedCompliance.forEach(row => { row.status = ''; });
      consolidatedKPI.forEach(row => { row.status = ''; });
      consolidatedHandover.forEach(row => { row.status = ''; });

      let combinedEmployeeMgmt = [];
      let combinedIssues = [];
      let combinedActionPlans = [];
      let combinedComments = [];

      const recruitMap = {};
      consolidatedRecruitment.forEach(item => {
        recruitMap[item.activity] = {
          isNumeric: !['Pending Hiring'].includes(item.activity),
          sum: 0,
          textList: []
        };
      });

      const attendanceMap = {};
      consolidatedAttendance.forEach(item => {
        attendanceMap[item.category] = {
          sum: 0
        };
      });

      const dailyOpsMap = {};
      consolidatedDailyOps.forEach(item => {
        dailyOpsMap[item.activity] = {
          statuses: [],
          remarks: []
        };
      });

      const adminOpsMap = {};
      consolidatedAdminOps.forEach(item => {
        adminOpsMap[item.activity] = {
          statuses: [],
          remarks: []
        };
      });

      const complianceMap = {};
      consolidatedCompliance.forEach(item => {
        complianceMap[item.activity] = {
          statuses: []
        };
      });

      const kpiMap = {};
      consolidatedKPI.forEach(item => {
        kpiMap[item.kpi] = {
          statuses: []
        };
      });

      const handoverMap = {};
      consolidatedHandover.forEach(item => {
        handoverMap[item.item] = {
          statuses: []
        };
      });

      validReports.forEach(report => {
        if (Array.isArray(report.recruitmentReport)) {
          report.recruitmentReport.forEach(item => {
            const act = item.activity;
            if (recruitMap[act]) {
              if (recruitMap[act].isNumeric) {
                const val = parseFloat(String(item.countStatus || '0').replace(/[^0-9.-]/g, ''));
                if (!isNaN(val)) {
                  recruitMap[act].sum += val;
                }
              } else {
                if (item.countStatus && item.countStatus !== 'None' && item.countStatus !== 'NA') {
                  recruitMap[act].textList.push(item.countStatus);
                }
              }
            }
          });
        }

        if (Array.isArray(report.attendanceLeave)) {
          report.attendanceLeave.forEach(item => {
            const cat = item.category;
            if (attendanceMap[cat]) {
              const val = parseFloat(String(item.count || '0').replace(/[^0-9.-]/g, ''));
              if (!isNaN(val)) {
                attendanceMap[cat].sum += val;
              }
            }
          });
        }

        if (Array.isArray(report.dailyOperations)) {
          report.dailyOperations.forEach(item => {
            const act = item.activity;
            if (dailyOpsMap[act]) {
              if (item.status && item.status !== 'Done') {
                dailyOpsMap[act].statuses.push(item.status);
              }
              if (item.remarks && item.remarks !== 'NA' && item.remarks !== '') {
                dailyOpsMap[act].remarks.push(item.remarks);
              }
            }
          });
        }

        if (Array.isArray(report.adminOperations)) {
          report.adminOperations.forEach(item => {
            const act = item.activity;
            if (adminOpsMap[act]) {
              if (item.status) {
                adminOpsMap[act].statuses.push(item.status);
              }
              if (item.remarks && item.remarks !== 'NA' && item.remarks !== '') {
                adminOpsMap[act].remarks.push(item.remarks);
              }
            }
          });
        }

        if (Array.isArray(report.documentationCompliance)) {
          report.documentationCompliance.forEach(item => {
            const act = item.activity;
            if (complianceMap[act]) {
              if (item.status) complianceMap[act].statuses.push(item.status);
            }
          });
        }

        if (Array.isArray(report.kpiTracking)) {
          report.kpiTracking.forEach(item => {
            const kpi = item.kpi;
            if (kpiMap[kpi]) {
              if (item.status) kpiMap[kpi].statuses.push(item.status);
            }
          });
        }

        if (Array.isArray(report.finalShiftHandover)) {
          report.finalShiftHandover.forEach(item => {
            const hit = item.item;
            if (handoverMap[hit]) {
              if (item.status) handoverMap[hit].statuses.push(item.status);
            }
          });
        }

        if (Array.isArray(report.employeeManagement)) {
          report.employeeManagement.forEach(emp => {
            if (emp.employeeName && emp.employeeName !== 'NA' && emp.employeeName !== '') {
              combinedEmployeeMgmt.push({ ...emp });
            }
          });
        }

        if (Array.isArray(report.issuesEscalations)) {
          report.issuesEscalations.forEach(iss => {
            if (iss.issue && iss.issue !== 'NA' && iss.issue !== '') {
              combinedIssues.push({ ...iss });
            }
          });
        }

        if (report.nextDayActionPlan && report.nextDayActionPlan !== "1.\n\n2.\n\n3.") {
          combinedActionPlans.push(report.nextDayActionPlan);
        }

        if (report.hrAdminComments) {
          combinedComments.push(report.hrAdminComments);
        }
      });

      const finalRecruitment = consolidatedRecruitment.map(item => {
        const entry = recruitMap[item.activity];
        let val = '';
        if (entry.isNumeric) {
          val = String(entry.sum);
        } else {
          val = entry.textList.length > 0 ? Array.from(new Set(entry.textList)).join('; ') : 'None';
        }
        return {
          activity: item.activity,
          countStatus: val
        };
      });

      const finalAttendance = consolidatedAttendance.map(item => {
        const entry = attendanceMap[item.category];
        return {
          category: item.category,
          count: String(entry.sum)
        };
      });

      const finalDailyOps = consolidatedDailyOps.map(item => {
        const entry = dailyOpsMap[item.activity];
        const statuses = Array.from(new Set(entry.statuses));
        const remarks = Array.from(new Set(entry.remarks));
        return {
          activity: item.activity,
          status: statuses.length > 0 ? statuses.join('; ') : 'Done',
          dueDate: '', remarks: remarks.length > 0 ? remarks.join('; ') : 'NA'
        };
      });

      const finalAdminOps = consolidatedAdminOps.map(item => {
        const entry = adminOpsMap[item.activity];
        const statuses = Array.from(new Set(entry.statuses));
        const remarks = Array.from(new Set(entry.remarks));
        return {
          activity: item.activity,
          status: statuses.length > 0 ? statuses.join('; ') : 'Completed',
          dueDate: '', remarks: remarks.length > 0 ? remarks.join('; ') : 'NA'
        };
      });

      const finalCompliance = consolidatedCompliance.map(item => {
        const entry = complianceMap[item.activity];
        const statuses = Array.from(new Set(entry.statuses));
        return {
          activity: item.activity,
          dueDate: '', status: statuses.length > 0 ? statuses.join('; ') : 'Yes'
        };
      });

      const finalKPI = consolidatedKPI.map(item => {
        const entry = kpiMap[item.kpi];
        const statuses = Array.from(new Set(entry.statuses));
        return {
          kpi: item.kpi,
          status: statuses.length > 0 ? statuses.join('; ') : 'Yes'
        };
      });

      const finalHandover = consolidatedHandover.map(item => {
        const entry = handoverMap[item.item];
        const statuses = Array.from(new Set(entry.statuses));
        return {
          item: item.item,
          status: statuses.length > 0 ? statuses.join('; ') : 'Yes'
        };
      });

      if (combinedEmployeeMgmt.length === 0) {
        combinedEmployeeMgmt = [
          { employeeName: 'NA', department: '', attendance: 'Present / Absent', taskStatus: 'Completed / Pending', remarks: '' }
        ];
      }
      if (combinedIssues.length === 0) {
        combinedIssues = [
          { issue: 'NA', priority: 'High / Medium / Low', actionTaken: '__________' }
        ];
      }

      const userDetail = isPrivileged && hrStaff.length > 0 
        ? (hrStaff.find(u => (u._id || u.id) === selectedUserId) || currentUser) 
        : currentUser;

      const formattedStart = new Date(monthlyStartDate).toLocaleDateString('en-GB').replace(/\//g, '-');
      const formattedEnd = new Date(monthlyEndDate).toLocaleDateString('en-GB').replace(/\//g, '-');

      setMonthlyBasicDetails({
        dateRange: `${formattedStart} to ${formattedEnd}`,
        employeeName: userDetail.name || '',
        employeeId: userDetail.employeeId || '',
        department: 'HR / Admin',
        designation: userDetail.designationName || userDetail.designation || 'HR / Admin Manager',
        reportingTo: userDetail.reportingManager || 'COO / Executive Director',
        preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });

      setMonthlyRecruitmentReport(finalRecruitment);
      setMonthlyAttendanceLeave(finalAttendance);
      setMonthlyDailyOperations(finalDailyOps);
      setMonthlyAdminOperations(finalAdminOps);
      setMonthlyEmployeeManagement(combinedEmployeeMgmt);
      setMonthlyDocumentationCompliance(finalCompliance);
      setMonthlyKpiTracking(finalKPI);
      setMonthlyIssuesEscalations(combinedIssues);
      setMonthlyFinalShiftHandover(finalHandover);
      setMonthlyNextDayActionPlan(combinedActionPlans.length > 0 ? combinedActionPlans.join('\n\n') : '1.\n\n2.\n\n3.');
      setMonthlyHrAdminComments(combinedComments.length > 0 ? combinedComments.join('\n\n') : '');

      showToast(`Consolidated ${validReports.length} daily report(s) successfully!`, "success");
    } catch (error) {
      console.error("Error consolidating data:", error);
      showToast("Error consolidating data. Please try again.", "error");
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const handleFetchWeeklyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a user first.", "error");
      return;
    }
    setIsWeeklyLoading(true);
    try {
      const start = new Date(weeklyStartDate);
      const end = new Date(weeklyEndDate);
      const dates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      const promises = dates.map(dateStr => 
        fetch(`${API_BASE}/v1/hr-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
          headers: getAuthHeaders()
        }).then(res => res.json())
      );

      const results = await Promise.all(promises);
      const validReports = results
        .filter(res => res.success && res.data)
        .map(res => res.data);

      if (validReports.length === 0) {
        showToast("No daily reports found in the selected date range.", "warning");
        setIsWeeklyLoading(false);
        return;
      }

      const consolidatedRecruitment = JSON.parse(JSON.stringify(DEFAULT_RECRUITMENT));
      const consolidatedAttendance = JSON.parse(JSON.stringify(DEFAULT_ATTENDANCE_LEAVE));
      const consolidatedDailyOps = JSON.parse(JSON.stringify(DEFAULT_DAILY_OPERATIONS));
      const consolidatedAdminOps = JSON.parse(JSON.stringify(DEFAULT_ADMIN_OPERATIONS));
      const consolidatedCompliance = JSON.parse(JSON.stringify(DEFAULT_DOCUMENTATION));
      const consolidatedKPI = JSON.parse(JSON.stringify(DEFAULT_KPI_TRACKING));
      const consolidatedHandover = JSON.parse(JSON.stringify(DEFAULT_HANDOVER));

      consolidatedDailyOps.forEach(row => { row.remarks = ''; row.status = ''; });
      consolidatedAdminOps.forEach(row => { row.remarks = ''; row.status = ''; });
      consolidatedCompliance.forEach(row => { row.status = ''; });
      consolidatedKPI.forEach(row => { row.status = ''; });
      consolidatedHandover.forEach(row => { row.status = ''; });

      let combinedEmployeeMgmt = [];
      let combinedIssues = [];
      let combinedActionPlans = [];
      let combinedComments = [];

      const recruitMap = {};
      consolidatedRecruitment.forEach(item => {
        recruitMap[item.activity] = {
          isNumeric: !['Pending Hiring'].includes(item.activity),
          sum: 0,
          textList: []
        };
      });

      const attendanceMap = {};
      consolidatedAttendance.forEach(item => {
        attendanceMap[item.category] = {
          sum: 0
        };
      });

      const dailyOpsMap = {};
      consolidatedDailyOps.forEach(item => {
        dailyOpsMap[item.activity] = {
          statuses: [],
          remarks: []
        };
      });

      const adminOpsMap = {};
      consolidatedAdminOps.forEach(item => {
        adminOpsMap[item.activity] = {
          statuses: [],
          remarks: []
        };
      });

      const complianceMap = {};
      consolidatedCompliance.forEach(item => {
        complianceMap[item.activity] = {
          statuses: []
        };
      });

      const kpiMap = {};
      consolidatedKPI.forEach(item => {
        kpiMap[item.kpi] = {
          statuses: []
        };
      });

      const handoverMap = {};
      consolidatedHandover.forEach(item => {
        handoverMap[item.item] = {
          statuses: []
        };
      });

      validReports.forEach(report => {
        if (Array.isArray(report.recruitmentReport)) {
          report.recruitmentReport.forEach(item => {
            const act = item.activity;
            if (recruitMap[act]) {
              if (recruitMap[act].isNumeric) {
                const val = parseFloat(String(item.countStatus || '0').replace(/[^0-9.-]/g, ''));
                if (!isNaN(val)) {
                  recruitMap[act].sum += val;
                }
              } else {
                if (item.countStatus && item.countStatus !== 'None' && item.countStatus !== 'NA') {
                  recruitMap[act].textList.push(item.countStatus);
                }
              }
            }
          });
        }

        if (Array.isArray(report.attendanceLeave)) {
          report.attendanceLeave.forEach(item => {
            const cat = item.category;
            if (attendanceMap[cat]) {
              const val = parseFloat(String(item.count || '0').replace(/[^0-9.-]/g, ''));
              if (!isNaN(val)) {
                attendanceMap[cat].sum += val;
              }
            }
          });
        }

        if (Array.isArray(report.dailyOperations)) {
          report.dailyOperations.forEach(item => {
            const act = item.activity;
            if (dailyOpsMap[act]) {
              if (item.status && item.status !== 'Done') {
                dailyOpsMap[act].statuses.push(item.status);
              }
              if (item.remarks && item.remarks !== 'NA' && item.remarks !== '') {
                dailyOpsMap[act].remarks.push(item.remarks);
              }
            }
          });
        }

        if (Array.isArray(report.adminOperations)) {
          report.adminOperations.forEach(item => {
            const act = item.activity;
            if (adminOpsMap[act]) {
              if (item.status) {
                adminOpsMap[act].statuses.push(item.status);
              }
              if (item.remarks && item.remarks !== 'NA' && item.remarks !== '') {
                adminOpsMap[act].remarks.push(item.remarks);
              }
            }
          });
        }

        if (Array.isArray(report.documentationCompliance)) {
          report.documentationCompliance.forEach(item => {
            const act = item.activity;
            if (complianceMap[act]) {
              if (item.status) complianceMap[act].statuses.push(item.status);
            }
          });
        }

        if (Array.isArray(report.kpiTracking)) {
          report.kpiTracking.forEach(item => {
            const kpi = item.kpi;
            if (kpiMap[kpi]) {
              if (item.status) kpiMap[kpi].statuses.push(item.status);
            }
          });
        }

        if (Array.isArray(report.finalShiftHandover)) {
          report.finalShiftHandover.forEach(item => {
            const hit = item.item;
            if (handoverMap[hit]) {
              if (item.status) handoverMap[hit].statuses.push(item.status);
            }
          });
        }

        if (Array.isArray(report.employeeManagement)) {
          report.employeeManagement.forEach(emp => {
            if (emp.employeeName && emp.employeeName !== 'NA' && emp.employeeName !== '') {
              combinedEmployeeMgmt.push({ ...emp });
            }
          });
        }

        if (Array.isArray(report.issuesEscalations)) {
          report.issuesEscalations.forEach(iss => {
            if (iss.issue && iss.issue !== 'NA' && iss.issue !== '') {
              combinedIssues.push({ ...iss });
            }
          });
        }

        if (report.nextDayActionPlan && report.nextDayActionPlan !== "1.\n\n2.\n\n3.") {
          combinedActionPlans.push(report.nextDayActionPlan);
        }

        if (report.hrAdminComments) {
          combinedComments.push(report.hrAdminComments);
        }
      });

      const finalRecruitment = consolidatedRecruitment.map(item => {
        const entry = recruitMap[item.activity];
        let val = '';
        if (entry.isNumeric) {
          val = String(entry.sum);
        } else {
          val = entry.textList.length > 0 ? Array.from(new Set(entry.textList)).join('; ') : 'None';
        }
        return {
          activity: item.activity,
          countStatus: val
        };
      });

      const finalAttendance = consolidatedAttendance.map(item => {
        const entry = attendanceMap[item.category];
        return {
          category: item.category,
          count: String(entry.sum)
        };
      });

      const finalDailyOps = consolidatedDailyOps.map(item => {
        const entry = dailyOpsMap[item.activity];
        const statuses = Array.from(new Set(entry.statuses));
        const remarks = Array.from(new Set(entry.remarks));
        return {
          activity: item.activity,
          status: statuses.length > 0 ? statuses.join('; ') : 'Done',
          dueDate: '', remarks: remarks.length > 0 ? remarks.join('; ') : 'NA'
        };
      });

      const finalAdminOps = consolidatedAdminOps.map(item => {
        const entry = adminOpsMap[item.activity];
        const statuses = Array.from(new Set(entry.statuses));
        const remarks = Array.from(new Set(entry.remarks));
        return {
          activity: item.activity,
          status: statuses.length > 0 ? statuses.join('; ') : 'Completed',
          dueDate: '', remarks: remarks.length > 0 ? remarks.join('; ') : 'NA'
        };
      });

      const finalCompliance = consolidatedCompliance.map(item => {
        const entry = complianceMap[item.activity];
        const statuses = Array.from(new Set(entry.statuses));
        return {
          activity: item.activity,
          dueDate: '', status: statuses.length > 0 ? statuses.join('; ') : 'Yes'
        };
      });

      const finalKPI = consolidatedKPI.map(item => {
        const entry = kpiMap[item.kpi];
        const statuses = Array.from(new Set(entry.statuses));
        return {
          kpi: item.kpi,
          status: statuses.length > 0 ? statuses.join('; ') : 'Yes'
        };
      });

      const finalHandover = consolidatedHandover.map(item => {
        const entry = handoverMap[item.item];
        const statuses = Array.from(new Set(entry.statuses));
        return {
          item: item.item,
          status: statuses.length > 0 ? statuses.join('; ') : 'Yes'
        };
      });

      if (combinedEmployeeMgmt.length === 0) {
        combinedEmployeeMgmt = [
          { employeeName: 'NA', department: '', attendance: 'Present / Absent', taskStatus: 'Completed / Pending', remarks: '' }
        ];
      }
      if (combinedIssues.length === 0) {
        combinedIssues = [
          { issue: 'NA', priority: 'High / Medium / Low', actionTaken: '__________' }
        ];
      }

      const userDetail = isPrivileged && hrStaff.length > 0 
        ? (hrStaff.find(u => (u._id || u.id) === selectedUserId) || currentUser) 
        : currentUser;

      const formattedStart = new Date(weeklyStartDate).toLocaleDateString('en-GB').replace(/\//g, '-');
      const formattedEnd = new Date(weeklyEndDate).toLocaleDateString('en-GB').replace(/\//g, '-');

      setWeeklyBasicDetails({
        dateRange: `${formattedStart} to ${formattedEnd}`,
        employeeName: userDetail.name || '',
        employeeId: userDetail.employeeId || '',
        department: 'HR / Admin',
        designation: userDetail.designationName || userDetail.designation || 'HR / Admin Manager',
        reportingTo: userDetail.reportingManager || 'COO / Executive Director',
        preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });

      setWeeklyRecruitmentReport(finalRecruitment);
      setWeeklyAttendanceLeave(finalAttendance);
      setWeeklyDailyOperations(finalDailyOps);
      setWeeklyAdminOperations(finalAdminOps);
      setWeeklyEmployeeManagement(combinedEmployeeMgmt);
      setWeeklyDocumentationCompliance(finalCompliance);
      setWeeklyKpiTracking(finalKPI);
      setWeeklyIssuesEscalations(combinedIssues);
      setWeeklyFinalShiftHandover(finalHandover);
      setWeeklyNextDayActionPlan(combinedActionPlans.length > 0 ? combinedActionPlans.join('\n\n') : '1.\n\n2.\n\n3.');
      setWeeklyHrAdminComments(combinedComments.length > 0 ? combinedComments.join('\n\n') : '');

      showToast(`Consolidated ${validReports.length} daily report(s) successfully!`, "success");
    } catch (error) {
      console.error("Error consolidating data:", error);
      showToast("Error consolidating data. Please try again.", "error");
    } finally {
      setIsWeeklyLoading(false);
    }
  };

  // --- UNIFIED MULTI-PAGE AUTO-PAGINATED PDF ENGINE ---
  const downloadFormattedHrPDF = async ({ title, subtitle, basicRows, sections, filename, returnBlob = false, autoDownload = true }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    
    // Header Brand Logo - Only on First Page
    const logoImg = new Image();
    logoImg.src = '/logo3.png';
    await new Promise((resolve) => {
      logoImg.onload = () => {
        try {
          doc.addImage(logoImg, 'PNG', 14, 10, 32, 12);
        } catch (e) {
          console.error("Failed to render logo3.png in HR PDF:", e);
        }
        resolve();
      };
      logoImg.onerror = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(132, 204, 22);
        doc.text("KOD.", 14, 21);
        doc.setTextColor(60, 35, 117);
        doc.text("brand", 34, 21);
        resolve();
      };
    });

    // Document Title & Subtitle on First Page
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(60, 35, 117);
    doc.text(title.toUpperCase(), 196, 15, { align: 'right' });
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle.toUpperCase(), 196, 20, { align: 'right' });
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 23, 196, 23);

    let currentY = 27;

    const checkHeightAndAddPage = (neededHeight) => {
      if (currentY + neededHeight > 270) {
        doc.addPage();
        currentY = 15;
      }
    };

    const drawSectionHeader = (secTitle) => {
      checkHeightAndAddPage(12);
      doc.setFillColor(60, 35, 117);
      doc.rect(14, currentY, 182, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(secTitle.toUpperCase(), 17, currentY + 4.5);
      currentY += 7.5;
    };

    // 1. Basic Details Table
    const validBasicRows = basicRows.filter(r => r[1] && String(r[1]).trim() !== '');
    if (validBasicRows.length > 0) {
      drawSectionHeader("1. BASIC DETAILS");
      autoTable(doc, {
        body: validBasicRows,
        startY: currentY,
        theme: 'grid',
        margin: { top: 15, bottom: 20, left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [200, 200, 200], lineWidth: 0.1 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 248], width: 45 }, 1: { width: 137 } }
      });
      currentY = doc.lastAutoTable.finalY + 5;
    }

    // Render all other dynamic sections (Only if they contain valid non-empty data)
    sections.forEach((sec) => {
      if (sec.type === 'table' && sec.rows && sec.rows.length > 0) {
        const validRows = sec.rows.filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''));
        if (validRows.length === 0) return; // Skip section if no data

        drawSectionHeader(sec.title);
        autoTable(doc, {
          head: [sec.headers],
          body: validRows,
          startY: currentY,
          theme: 'grid',
          margin: { top: 15, bottom: 20, left: 14, right: 14 },
          headStyles: { fillColor: [240, 240, 245], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [200, 200, 200], lineWidth: 0.1 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [200, 200, 200], lineWidth: 0.1, overflow: 'linebreak' },
          columnStyles: sec.columnStyles || {}
        });
        currentY = doc.lastAutoTable.finalY + 5;
      } else if (sec.type === 'text' && sec.content && String(sec.content).trim() !== '') {
        const lines = doc.splitTextToSize(String(sec.content), 178);
        const boxH = Math.max(14, lines.length * 4.2 + 6);
        checkHeightAndAddPage(boxH + 12);
        drawSectionHeader(sec.title);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(lines, 16, currentY + 5);
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, currentY, 182, boxH);
        currentY += boxH + 5;
      }
    });

    // Footer page numbering across all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${i} of ${totalPages}  |  KOD.brand Operations Command Center © ${new Date().getFullYear()}`, 105, 287, { align: 'center' });
    }

    if (autoDownload) {
      doc.save(filename);
    }
    if (returnBlob) {
      return doc.output('blob');
    }
  };

  const [isMonthlySaving, setIsMonthlySaving] = useState(false);
  const [isWeeklySaving, setIsWeeklySaving] = useState(false);

  const handleSaveMonthlyReport = async (shouldDownload = false) => {
    try {
      setIsMonthlySaving(true);
      showToast(shouldDownload ? "Generating and saving Monthly HR PDF..." : "Saving Monthly HR Report to Employee Reports...", "info");

      const basicRows = [
        ["Date Range", monthlyBasicDetails.dateRange || `${monthlyStartDate} to ${monthlyEndDate}`],
        ["Employee Name", monthlyBasicDetails.employeeName || ''],
        ["Employee ID", monthlyBasicDetails.employeeId || ''],
        ["Department", monthlyBasicDetails.department || 'HR / Admin'],
        ["Designation", monthlyBasicDetails.designation || 'HR / Admin Manager'],
        ["Reporting To", monthlyBasicDetails.reportingTo || ''],
        ["Prepared Time", monthlyBasicDetails.preparedTime || '']
      ];

      const sections = [
        {
          title: "2. DAILY OPERATIONS SUMMARY (CONSOLIDATED)",
          type: "table",
          headers: ["Activity", "Due Date", "Start Date", "End Date", "Status", "Remarks"],
          rows: monthlyDailyOperations.map(o => [o.activity || '', o.dueDate || '', o.startDate || '', o.endDate || '', o.status || '', o.remarks || '']),
          columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 22 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 42 } }
        },
        {
          title: "3. EMPLOYEE MANAGEMENT (CONSOLIDATED)",
          type: "table",
          headers: ["Employee Name", "Department", "Attendance", "Task Status", "Remarks"],
          rows: monthlyEmployeeManagement.map(e => [e.employeeName || '', e.department || '', e.attendance || '', e.taskStatus || '', e.remarks || '']),
          columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 35 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 42 } }
        },
        {
          title: "4. RECRUITMENT REPORT (CONSOLIDATED)",
          type: "table",
          headers: ["Recruitment Activity", "Count / Status"],
          rows: monthlyRecruitmentReport.map(r => [r.activity || '', r.countStatus || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "5. ATTENDANCE & LEAVE REPORT (CONSOLIDATED)",
          type: "table",
          headers: ["Category", "Count"],
          rows: monthlyAttendanceLeave.map(l => [l.category || '', l.count || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "6. ADMIN OPERATIONS REPORT (CONSOLIDATED)",
          type: "table",
          headers: ["Activity", "Status", "Remarks"],
          rows: monthlyAdminOperations.map(a => [a.activity || '', a.status || '', a.remarks || '']),
          columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 35, halign: 'center' }, 2: { cellWidth: 77 } }
        },
        {
          title: "7. DOCUMENTATION & COMPLIANCE (CONSOLIDATED)",
          type: "table",
          headers: ["Activity", "Status"],
          rows: monthlyDocumentationCompliance.map(d => [d.activity || '', d.status || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "8. KPI TRACKING (CONSOLIDATED)",
          type: "table",
          headers: ["KPI", "Status"],
          rows: monthlyKpiTracking.map(k => [k.kpi || '', k.status || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "9. ISSUES / ESCALATIONS (CONSOLIDATED)",
          type: "table",
          headers: ["Issue", "Priority", "Action Taken"],
          rows: monthlyIssuesEscalations.map(i => [i.issue || '', i.priority || '', i.actionTaken || '']),
          columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 45, halign: 'center' }, 2: { cellWidth: 77 } }
        },
        {
          title: "10. NEXT DAY ACTION PLAN (CONSOLIDATED)",
          type: "text",
          content: monthlyNextDayActionPlan || ''
        },
        {
          title: "11. FINAL SHIFT HANDOVER (CONSOLIDATED)",
          type: "table",
          headers: ["Handover Item", "Status"],
          rows: monthlyFinalShiftHandover.map(h => [h.item || '', h.status || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "12. HR / ADMIN COMMENTS (CONSOLIDATED)",
          type: "text",
          content: monthlyHrAdminComments || ''
        }
      ];

      const empCleanName = (monthlyBasicDetails.employeeName || 'HR').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `HR_Monthly_Consolidated_Report_${empCleanName}_${monthlyStartDate}_to_${monthlyEndDate}.pdf`;

      const pdfBlob = await downloadFormattedHrPDF({
        title: "MONTHLY CONSOLIDATED HR REPORT",
        subtitle: "HR / ADMIN MANAGER",
        basicRows,
        sections,
        filename,
        returnBlob: true,
        autoDownload: shouldDownload
      });

      const dateRangeKey = `${monthlyStartDate}_to_${monthlyEndDate}`;
      const targetUserId = selectedUserId || currentUser?._id || currentUser?.id;

      if (pdfBlob && targetUserId) {
        try {
          await uploadCompiledPDFReport(targetUserId, dateRangeKey, pdfBlob, filename, 'hr', 'monthly');
          console.log("Monthly HR PDF saved successfully to Employee Reports");
        } catch (uploadErr) {
          console.error("Failed to upload monthly HR PDF to Employee Reports:", uploadErr);
          showToast("Warning: Could not save report to server storage.", "warning");
        }
      }

      showToast(
        shouldDownload 
          ? "Monthly PDF report downloaded & saved to Employee Reports successfully!" 
          : "Monthly report saved to Employee Reports successfully!", 
        "success"
      );
    } catch (e) {
      console.error(e);
      showToast("Failed to process Monthly Report.", "error");
    } finally {
      setIsMonthlySaving(false);
    }
  };

  const handleDownloadMonthlyPDF = () => handleSaveMonthlyReport(true);

  const handleSaveWeeklyReport = async (shouldDownload = false) => {
    try {
      setIsWeeklySaving(true);
      showToast(shouldDownload ? "Generating and saving Weekly HR PDF..." : "Saving Weekly HR Report to Employee Reports...", "info");

      const basicRows = [
        ["Date Range", weeklyBasicDetails.dateRange || `${weeklyStartDate} to ${weeklyEndDate}`],
        ["Employee Name", weeklyBasicDetails.employeeName || ''],
        ["Employee ID", weeklyBasicDetails.employeeId || ''],
        ["Department", weeklyBasicDetails.department || 'HR / Admin'],
        ["Designation", weeklyBasicDetails.designation || 'HR / Admin Manager'],
        ["Reporting To", weeklyBasicDetails.reportingTo || ''],
        ["Prepared Time", weeklyBasicDetails.preparedTime || '']
      ];

      const sections = [
        {
          title: "2. DAILY OPERATIONS SUMMARY (CONSOLIDATED)",
          type: "table",
          headers: ["Activity", "Due Date", "Start Date", "End Date", "Status", "Remarks"],
          rows: weeklyDailyOperations.map(o => [o.activity || '', o.dueDate || '', o.startDate || '', o.endDate || '', o.status || '', o.remarks || '']),
          columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 22 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 42 } }
        },
        {
          title: "3. EMPLOYEE MANAGEMENT (CONSOLIDATED)",
          type: "table",
          headers: ["Employee Name", "Department", "Attendance", "Task Status", "Remarks"],
          rows: weeklyEmployeeManagement.map(e => [e.employeeName || '', e.department || '', e.attendance || '', e.taskStatus || '', e.remarks || '']),
          columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 35 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 42 } }
        },
        {
          title: "4. RECRUITMENT REPORT (CONSOLIDATED)",
          type: "table",
          headers: ["Recruitment Activity", "Count / Status"],
          rows: weeklyRecruitmentReport.map(r => [r.activity || '', r.countStatus || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "5. ATTENDANCE & LEAVE REPORT (CONSOLIDATED)",
          type: "table",
          headers: ["Category", "Count"],
          rows: weeklyAttendanceLeave.map(l => [l.category || '', l.count || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "6. ADMIN OPERATIONS REPORT (CONSOLIDATED)",
          type: "table",
          headers: ["Activity", "Status", "Remarks"],
          rows: weeklyAdminOperations.map(a => [a.activity || '', a.status || '', a.remarks || '']),
          columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 35, halign: 'center' }, 2: { cellWidth: 77 } }
        },
        {
          title: "7. DOCUMENTATION & COMPLIANCE (CONSOLIDATED)",
          type: "table",
          headers: ["Activity", "Status"],
          rows: weeklyDocumentationCompliance.map(d => [d.activity || '', d.status || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "8. KPI TRACKING (CONSOLIDATED)",
          type: "table",
          headers: ["KPI", "Status"],
          rows: weeklyKpiTracking.map(k => [k.kpi || '', k.status || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "9. ISSUES / ESCALATIONS (CONSOLIDATED)",
          type: "table",
          headers: ["Issue", "Priority", "Action Taken"],
          rows: weeklyIssuesEscalations.map(i => [i.issue || '', i.priority || '', i.actionTaken || '']),
          columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 45, halign: 'center' }, 2: { cellWidth: 77 } }
        },
        {
          title: "10. NEXT DAY ACTION PLAN (CONSOLIDATED)",
          type: "text",
          content: weeklyNextDayActionPlan || ''
        },
        {
          title: "11. FINAL SHIFT HANDOVER (CONSOLIDATED)",
          type: "table",
          headers: ["Handover Item", "Status"],
          rows: weeklyFinalShiftHandover.map(h => [h.item || '', h.status || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "12. HR / ADMIN COMMENTS (CONSOLIDATED)",
          type: "text",
          content: weeklyHrAdminComments || ''
        },
        {
          title: "13. ACHIEVEMENTS",
          type: "text",
          content: weeklyAchievements || ''
        },
        {
          title: "14. IMPROVEMENTS",
          type: "text",
          content: weeklyImprovements || ''
        }
      ];

      const empCleanName = (weeklyBasicDetails.employeeName || 'HR').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `HR_Weekly_Consolidated_Report_${empCleanName}_${weeklyStartDate}_to_${weeklyEndDate}.pdf`;

      const pdfBlob = await downloadFormattedHrPDF({
        title: "WEEKLY CONSOLIDATED HR REPORT",
        subtitle: "HR / ADMIN MANAGER",
        basicRows,
        sections,
        filename,
        returnBlob: true,
        autoDownload: shouldDownload
      });

      const dateRangeKey = `${weeklyStartDate}_to_${weeklyEndDate}`;
      const targetUserId = selectedUserId || currentUser?._id || currentUser?.id;

      if (pdfBlob && targetUserId) {
        try {
          await uploadCompiledPDFReport(targetUserId, dateRangeKey, pdfBlob, filename, 'hr', 'weekly');
          console.log("Weekly HR PDF saved successfully to Employee Reports");
        } catch (uploadErr) {
          console.error("Failed to upload weekly HR PDF to Employee Reports:", uploadErr);
          showToast("Warning: Could not save weekly report to server storage.", "warning");
        }
      }

      showToast(
        shouldDownload 
          ? "Weekly PDF report downloaded & saved to Employee Reports successfully!" 
          : "Weekly report saved to Employee Reports successfully!", 
        "success"
      );
    } catch (e) {
      console.error(e);
      showToast("Failed to process Weekly Report.", "error");
    } finally {
      setIsWeeklySaving(false);
    }
  };

  const handleDownloadWeeklyPDF = () => handleSaveWeeklyReport(true);

  // Initialize current user
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
        
        const role = String(userObj.role_id || userObj.role || '').toLowerCase().trim();
        const privileged = ['1', '2', 'hr', 'admin'].includes(role);
        setIsPrivileged(privileged);
        
        const uId = userObj.id || userObj._id;
        if (!selectedUserId && uId) {
          setSelectedUserId(uId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch HR Staff List (For Admins)
  useEffect(() => {
    if (isPrivileged) {
      const fetchHrStaff = async () => {
        try {
          const res = await fetch(`${API_BASE}/v1/hr-reports/hr-staff`, {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setHrStaff(data.data);
            if (data.data.length > 0 && !selectedUserId) {
              setSelectedUserId(data.data[0]._id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch HR Staff list:", e);
        }
      };
      fetchHrStaff();
    }
  }, [isPrivileged, getAuthHeaders, selectedUserId]);

  // Fetch submitted dates
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/hr-reports/submitted-dates?userId=${userId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSubmittedDates(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (selectedUserId) {
      fetchSubmittedDates(selectedUserId);
    }
  }, [selectedUserId, fetchSubmittedDates]);

  // Fetch HR report data
  const fetchReport = async (userId, dateStr) => {
    if (!userId || !dateStr) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/v1/hr-reports/by-date?userId=${userId}&dateString=${dateStr}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success && data.data) {
        const report = data.data;
        
        let freshestUser = currentUser;
        try {
          const su = localStorage.getItem('user');
          if (su) freshestUser = JSON.parse(su);
        } catch(e){}

        let staffList = [];
        if (typeof developers !== 'undefined') staffList = developers;
        else if (typeof marketingStaff !== 'undefined') staffList = marketingStaff;
        else if (typeof hrStaff !== 'undefined') staffList = hrStaff;
        else if (typeof designers !== 'undefined') staffList = designers;
        else if (typeof hods !== 'undefined') staffList = hods;
        else if (typeof videographers !== 'undefined') staffList = videographers;
        else if (typeof counselors !== 'undefined') staffList = counselors;
        else if (typeof accountants !== 'undefined') staffList = accountants;
        else if (typeof opsStaff !== 'undefined') staffList = opsStaff;

        let isPriv = true;
        if (typeof isPrivileged !== 'undefined') isPriv = isPrivileged;

        let userDetail = freshestUser;
        if (isPriv && staffList.length > 0) {
          userDetail = staffList.find(u => (u._id || u.id) === userId) || freshestUser;
        }

        const apiBasicDetails = report.basicDetails || {};
        setBasicDetails({
          ...apiBasicDetails,
          employeeName: userDetail.name || apiBasicDetails.employeeName || '',
          employeeId: userDetail.employeeId || apiBasicDetails.employeeId || '',
          designation: userDetail.designationName || userDetail.designation || apiBasicDetails.designation || '',
          reportingTo: userDetail.reportingManager || apiBasicDetails.reportingTo || '',
          department: userDetail.department || apiBasicDetails.department || ''
        });

        setDailyOperations(report.dailyOperations || []);
        setEmployeeManagement(report.employeeManagement || []);
        setRecruitmentReport(report.recruitmentReport || []);
        setAttendanceLeave(report.attendanceLeave || []);
        setAdminOperations(report.adminOperations || []);
        setDocumentationCompliance(report.documentationCompliance || []);
        setKpiTracking(report.kpiTracking || []);
        setIssuesEscalations(report.issuesEscalations || []);
        setNextDayActionPlan(report.nextDayActionPlan || "1.\n\n2.\n\n3.");
        setFinalShiftHandover(report.finalShiftHandover || []);
        setHrAdminComments(report.hrAdminComments || '');
        setApproval(report.approval || {});
      } else {
        initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({ activity: t.title, status: t.status || 'Done', dueDate: t.dueDate || '', startDate: t.startDate || t.startTime || t.startDateTimeLocal || '', endDate: t.endDate || t.endTime || t.endDateTimeLocal || '', remarks: t.description || 'Auto-fetched' }));
            mappedTasks.push({ activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' });
            mappedTasks.push({ activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' });
            setDailyOperations(mappedTasks);
          } else {
            setDailyOperations(prev => [...prev, { activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' }, { activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' }]);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
        }

      }
    } catch (e) {
      initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({ activity: t.title, status: t.status || 'Done', dueDate: t.dueDate || '', startDate: t.startDate || t.startTime || t.startDateTimeLocal || '', endDate: t.endDate || t.endTime || t.endDateTimeLocal || '', remarks: t.description || 'Auto-fetched' }));
            mappedTasks.push({ activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' });
            mappedTasks.push({ activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' });
            setDailyOperations(mappedTasks);
          } else {
            setDailyOperations(prev => [...prev, { activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' }, { activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' }]);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
        }

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserId && selectedDate) {
      fetchReport(selectedUserId, selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, selectedDate]);

  // Cache basicDetails in localStorage when they change
  useEffect(() => {
    if (selectedUserId && basicDetails && (basicDetails.employeeName || basicDetails.employeeId)) {
      const { date, day, ...persistent } = basicDetails;
      if (Object.keys(persistent).length > 0) {
        localStorage.setItem(`cachedBasicDetails_Hr_${selectedUserId}`, JSON.stringify(persistent));
      }
    }
  }, [basicDetails, selectedUserId]);

    const initializeBlankReport = (userId, dateStr) => {
    let freshestUser = currentUser;
    try {
      const su = localStorage.getItem('user');
      if (su) freshestUser = JSON.parse(su);
    } catch(e){}

    let userDetail = freshestUser;
    if (isPrivileged && hrStaff.length > 0) {
      userDetail = hrStaff.find(u => (u._id || u.id) === userId) || freshestUser;
    }

    const dateObj = new Date(dateStr);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDateString = dateObj.toLocaleDateString('en-GB').replace(/\//g, '-'); // DD-MM-YYYY

    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    // Load from cache if exists
    const cached = localStorage.getItem(`cachedBasicDetails_Hr_${userId}`);
    const parsedCached = cached ? JSON.parse(cached) : null;

    setBasicDetails({
      date: formattedDateString,
      day: dayName,
      employeeName: userDetail.name || parsedCached?.employeeName || '',
      employeeId: userDetail.employeeId || parsedCached?.employeeId || '',
      department: userDetail.department || parsedCached?.department || 'HR / Admin',
      designation: userDetail.designationName || userDetail.designation || parsedCached?.designation || 'HR / Admin Manager',
      shiftTiming: parsedCached?.shiftTiming || '9:00 AM – 5:00 PM',
      reportingTo: userDetail.reportingManager || parsedCached?.reportingTo || 'COO / Executive Director',
      preparedTime: parsedCached?.preparedTime || timeStr
    });

    setDailyOperations(DEFAULT_DAILY_OPERATIONS);
    setEmployeeManagement(DEFAULT_EMPLOYEE_MGMT);
    setRecruitmentReport(DEFAULT_RECRUITMENT);
    setAttendanceLeave(DEFAULT_ATTENDANCE_LEAVE);
    setAdminOperations(DEFAULT_ADMIN_OPERATIONS);
    setDocumentationCompliance(DEFAULT_DOCUMENTATION);
    setKpiTracking(DEFAULT_KPI_TRACKING);
    setIssuesEscalations(DEFAULT_ISSUES);
    setNextDayActionPlan("1.\n\n2.\n\n3.");
    setFinalShiftHandover(DEFAULT_HANDOVER);
    setHrAdminComments('');
    setApproval({
      hrName: userDetail.name || '',
      hrSignature: '',
      hrDate: formattedDateString,
      cooName: 'COO / Executive Director',
      cooSignature: '',
      cooDate: ''
    });
  };

  const handleSaveReport = async () => {
    try {
      setSaving(true);

      const cleanDailyOperations = dailyOperations.filter(t => (t.activity || t.task || '').trim() !== '');
      const cleanEmployeeManagement = employeeManagement.filter(t => (t.employeeName || '').trim() !== '');
      const cleanRecruitmentReport = recruitmentReport.filter(t => (t.activity || '').trim() !== '');
      const cleanAttendanceLeave = attendanceLeave.filter(t => (t.category || '').trim() !== '');
      const cleanAdminOperations = adminOperations.filter(t => (t.activity || '').trim() !== '');
      const cleanDocumentationCompliance = documentationCompliance.filter(t => (t.activity || '').trim() !== '');
      const cleanKpiTracking = kpiTracking.filter(t => (t.kpi || '').trim() !== '');
      const cleanIssuesEscalations = issuesEscalations.filter(t => (t.issue || '').trim() !== '');
      const cleanFinalShiftHandover = finalShiftHandover.filter(t => (t.item || '').trim() !== '');

      const excludedSections = Object.entries(hiddenSections).filter(([_, h]) => h).map(([k]) => k);

      const payload = {
        userId: selectedUserId,
        dateString: selectedDate,
        basicDetails,
        dailyOperations: cleanDailyOperations.length > 0 ? cleanDailyOperations : dailyOperations,
        employeeManagement: cleanEmployeeManagement.length > 0 ? cleanEmployeeManagement : employeeManagement,
        recruitmentReport: cleanRecruitmentReport.length > 0 ? cleanRecruitmentReport : recruitmentReport,
        attendanceLeave: cleanAttendanceLeave.length > 0 ? cleanAttendanceLeave : attendanceLeave,
        adminOperations: cleanAdminOperations.length > 0 ? cleanAdminOperations : adminOperations,
        documentationCompliance: cleanDocumentationCompliance.length > 0 ? cleanDocumentationCompliance : documentationCompliance,
        kpiTracking: cleanKpiTracking.length > 0 ? cleanKpiTracking : kpiTracking,
        issuesEscalations: cleanIssuesEscalations.length > 0 ? cleanIssuesEscalations : issuesEscalations,
        nextDayActionPlan,
        finalShiftHandover: cleanFinalShiftHandover.length > 0 ? cleanFinalShiftHandover : finalShiftHandover,
        hrAdminComments,
        approval,
        excludedSections,
        hiddenSections
      };

      const res = await fetch(`${API_BASE}/v1/hr-reports`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("HR Daily Shift Report saved successfully!", 'success');
        fetchSubmittedDates(selectedUserId);
      } else {
        showToast(data.message || "Failed to save the report.", 'error');
      }
    } catch (e) {
      console.error(e);
      showToast("Server error. Please try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    // Automatically save report state first
    await handleSaveReport();

    try {
      showToast("Generating HR Shift PDF report...", "info");

      const basicRows = [
        ["Date", basicDetails.date || selectedDate],
        ["Day", basicDetails.day || ''],
        ["Employee Name", basicDetails.employeeName || ''],
        ["Employee ID", basicDetails.employeeId || ''],
        ["Department", basicDetails.department || 'HR / Admin'],
        ["Designation", basicDetails.designation || 'HR / Admin Manager'],
        ["Shift Timing", basicDetails.shiftTiming || ''],
        ["Reporting To", basicDetails.reportingTo || ''],
        ["Prepared Time", basicDetails.preparedTime || '']
      ];

      const sections = [
        {
          title: "2. DAILY OPERATIONS SUMMARY",
          type: "table",
          headers: ["Activity", "Due Date", "Start Date", "End Date", "Status", "Remarks"],
          rows: dailyOperations.map(o => [o.activity || '', o.dueDate || '', o.startDate || '', o.endDate || '', o.status || '', o.remarks || '']),
          columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 22 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 42 } }
        },
        {
          title: "3. RECRUITMENT REPORT",
          type: "table",
          headers: ["Recruitment Activity", "Count / Status"],
          rows: recruitmentReport.map(r => [r.activity || '', r.countStatus || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72 } }
        },
        {
          title: "4. ATTENDANCE & LEAVE REPORT",
          type: "table",
          headers: ["Category", "Count"],
          rows: attendanceLeave.map(a => [a.category || '', a.count || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "5. ADMIN OPERATIONS REPORT",
          type: "table",
          headers: ["Activity", "Due Date", "Status", "Remarks"],
          rows: adminOperations.map(a => [a.activity || '', a.dueDate || '', a.status || '', a.remarks || '']),
          columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 30 }, 2: { cellWidth: 30 }, 3: { cellWidth: 57 } }
        },
        {
          title: "6. DOCUMENTATION & COMPLIANCE",
          type: "table",
          headers: ["Activity", "Due Date", "Status"],
          rows: documentationCompliance.map(d => [d.activity || '', d.dueDate || '', d.status || '']),
          columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 42 }, 2: { cellWidth: 40, halign: 'center' } }
        },
        {
          title: "7. KPI TRACKING",
          type: "table",
          headers: ["KPI", "Status"],
          rows: kpiTracking.map(k => [k.kpi || '', k.status || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72 } }
        },
        {
          title: "8. ISSUES / ESCALATIONS",
          type: "table",
          headers: ["Issue", "Priority", "Action Taken"],
          rows: issuesEscalations.map(i => [i.issue || '', i.priority || '', i.actionTaken || '']),
          columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 82 } }
        },
        {
          title: "9. NEXT DAY ACTION PLAN",
          type: "text",
          content: nextDayActionPlan || ''
        },
        {
          title: "10. FINAL SHIFT HANDOVER",
          type: "table",
          headers: ["Handover Item", "Status"],
          rows: finalShiftHandover.map(h => [h.item || '', h.status || '']),
          columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 72, halign: 'center' } }
        },
        {
          title: "11. HR / ADMIN COMMENTS",
          type: "text",
          content: hrAdminComments || ''
        },
        {
          title: "12. APPROVAL DETAILS",
          type: "table",
          headers: ["Field", "Details"],
          rows: [
            ["HR / Admin Manager Name", approval?.hrName || basicDetails.employeeName || ''],
            ["Signature Status", approval?.hrSignature ? "Signed" : "Pending"],
            ["Date", approval?.hrDate || basicDetails.date || selectedDate]
          ],
          columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 122 } }
        }
      ];

      const filename = `HR_Shift_Report_${(basicDetails.employeeName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_')}_${selectedDate}.pdf`;
      const pdfBlob = await downloadFormattedHrPDF({
        title: "DAILY HR OPERATIONS REPORT",
        subtitle: "HUMAN RESOURCES & ADMINISTRATION",
        basicRows,
        sections,
        filename,
        returnBlob: true
      });

      if (pdfBlob && selectedUserId) {
        try {
          await uploadCompiledPDFReport(selectedUserId, selectedDate, pdfBlob, filename, 'hr', 'daily');
        } catch (uploadErr) {
          console.warn("PDF upload to server skipped:", uploadErr);
        }
      }

      showToast("HR Shift PDF report generated and downloaded successfully!", "success");
    } catch (e) {
      console.error("PDF generation failed:", e);
      showToast("Failed to generate HR Shift PDF report.", "error");
    }
  };

  const getRecentDates = () => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      const displayDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      dates.push({ dateString, dayName, displayDate });
    }
    return dates;
  };
  const recentDates = getRecentDates();

  return (
    <div className="flex gap-6 items-start w-full relative flex-col lg:flex-row lg:pr-8">
      {/* LEFT PANEL: Date Select Sidebar */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md rounded-3xl p-5 shadow-sm relative ${
        isSidebarOpen 
          ? 'w-full lg:w-72 opacity-100 translate-x-0' 
          : 'w-0 lg:w-0 opacity-0 -translate-x-12 overflow-hidden p-0 border-none pointer-events-none'
      }`}>
        

        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
          <Calendar size={14} className="text-indigo-500 dark:text-lime-400" />
          Shift Report Log (14 Days)
        </h3>

        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
          {recentDates.map(dateObj => {
            const isSelected = selectedDate === dateObj.dateString;
            const isSubmitted = submittedDates.includes(dateObj.dateString);
            
            return (
              <button
                key={dateObj.dateString}
                onClick={() => setSelectedDate(dateObj.dateString)}
                className={`flex items-center justify-between w-52 lg:w-full shrink-0 px-4 py-3 rounded-2xl border text-left transition-all duration-300
                  ${isSelected 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                    : 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-950/60 text-slate-700 dark:text-slate-300'
                  }`}
              >
                <div className="flex flex-col">
                  <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {dateObj.dayName}
                  </span>
                  <span className="text-sm font-bold mt-0.5">
                    {dateObj.displayDate}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {isSubmitted ? (
                    <CheckCircle size={16} className={isSelected ? 'text-lime-400' : 'text-emerald-500'} />
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-300' : 'bg-slate-300 dark:bg-slate-700'}`} />
                  )}
                  <ChevronRight size={14} className="opacity-50" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar Toggle Arrow Button */}
      <button
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="mt-6 z-30 flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-lime-500 text-slate-600 dark:text-slate-350 hover:text-indigo-600 dark:hover:text-lime-400 rounded-full shadow-md transition-all shrink-0 cursor-pointer active:scale-95"
      >
        {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* RIGHT PANEL: Form Details */}
      <div className="flex-1 w-full bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md rounded-3xl lg:p-20 shadow-sm ">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-sm text-slate-400">Loading daily report...</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  HR Daily Shift Report
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fill, review, and download HR operations reports.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Weekly Report
                </button>
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Monthly Report
                </button>



                

                <AiAnalyzeButton
                  onClick={() => {
                    setAiModalContext({
                      employeeName: basicDetails.employeeName,
                      department: 'Human Resources & Recruitment',
                      designation: basicDetails.designation,
                      date: selectedDate,
                      actualReportContentText: JSON.stringify({ basicDetails, dailyOperations, employeeMgmt, recruitmentPipeline, hrComments: comments })
                    });
                    setIsAiModalOpen(true);
                  }}
                />

                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  Save File
                </button>
              </div>
            </div>

            <AiAnalyzeModal
              isOpen={isAiModalOpen}
              onClose={() => setIsAiModalOpen(false)}
              contextData={aiModalContext}
              title="HR Report AI Analysis"
            />

            {/* Excluded Sections Banner */}
            {Object.values(hiddenSections).some(Boolean) && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <MinusCircle size={15} /> Excluded Sections (Will not appear in Report or PDF):
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(hiddenSections).map(([secKey, isHidden]) => isHidden && (
                    <button
                      key={secKey}
                      type="button"
                      onClick={() => toggleSectionHidden(secKey)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition-all cursor-pointer"
                    >
                      <PlusCircle size={13} /> Restore {secKey.replace(/([A-Z])/g, ' $1')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 1. BASIC DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">1</span>
                  Basic Details
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditingBasic(!isEditingBasic)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                >
                  {isEditingBasic ? (
                    <>
                      <CheckCircle size={14} /> Done
                    </>
                  ) : (
                    <>
                      <Pencil size={14} /> Edit
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="text"
                    value={basicDetails.date || ''}
                    readOnly={true}
                    disabled={true}
                    className="w-full bg-slate-100/50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-900 rounded-xl px-3 py-2 text-sm text-slate-450 dark:text-slate-500 cursor-not-allowed focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Day</label>
                  <input
                    type="text"
                    value={basicDetails.day || ''}
                    readOnly={true}
                    disabled={true}
                    className="w-full bg-slate-100/50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-900 rounded-xl px-3 py-2 text-sm text-slate-450 dark:text-slate-500 cursor-not-allowed focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Employee Name</label>
                  <input
                    type="text"
                    value={basicDetails.employeeName || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, employeeName: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Employee ID</label>
                  <input
                    type="text"
                    value={basicDetails.employeeId || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, employeeId: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
                  <input
                    type="text"
                    value={basicDetails.department || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, department: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
                  <input
                    type="text"
                    value={basicDetails.designation || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, designation: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Shift Timing</label>
                  <input
                    type="text"
                    value={basicDetails.shiftTiming || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, shiftTiming: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Reporting To</label>
                  <input
                    type="text"
                    value={basicDetails.reportingTo || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, reportingTo: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Prepared Time</label>
                  <input
                    type="text"
                    value={basicDetails.preparedTime || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, preparedTime: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
              </div>
            </div>

            {/* 2. DAILY OPERATIONS SUMMARY */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">2</span>
                  Daily Operations Summary
                </h2>
                <button
                  type="button"
                  onClick={() => setDailyOperations([...dailyOperations, { activity: '', status: 'ongoing', dueDate: '', startDate: '', endDate: '', remarks: '' }])}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3 w-36">Due Date</th>
                      <th className="px-4 py-3 w-36">Start Date</th>
                      <th className="px-4 py-3 w-36">End Date</th>
                      <th className="px-4 py-3 w-32">Status</th>
                      <th className="px-4 py-3">Remarks</th>
                      <th className="px-4 py-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {dailyOperations.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 relative group">
                          <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={row.activity || ''}
                            onChange={(e) => {
                              const newArr = [...dailyOperations];
                              newArr[i].activity = e.target.value;
                              setDailyOperations(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-semibold text-slate-700 dark:text-slate-300"
                            placeholder="Activity name"
                          />
                          {row.activity && (
                            <button
                              type="button"
                              onClick={() => setSelectedActivityText(row.activity)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 transition-all p-0.5"
                              title="View full text"
                            >
                              <Maximize2 size={13} />
                            </button>
                          )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="date"
                            value={row.dueDate || ''}
                            onChange={(e) => {
                              const newArr = [...dailyOperations];
                              newArr[i].dueDate = e.target.value;
                              setDailyOperations(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            placeholder="DD-MM-YYYY HH:mm"
                            value={row.startDate || ''}
                            onChange={(e) => {
                              const newArr = [...dailyOperations];
                              newArr[i].startDate = e.target.value;
                              setDailyOperations(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            placeholder="DD-MM-YYYY HH:mm"
                            value={row.endDate || ''}
                            onChange={(e) => {
                              const newArr = [...dailyOperations];
                              newArr[i].endDate = e.target.value;
                              setDailyOperations(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={row.status || 'ongoing'}
                            onChange={(e) => {
                              const newArr = [...dailyOperations];
                              newArr[i].status = e.target.value;
                              setDailyOperations(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-semibold text-slate-700 dark:text-slate-300"
                          >
                            <option value="ongoing">Ongoing</option>
                            <option value="completed">Completed</option>
                            <option value="pending">Pending</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.remarks || ''}
                            onChange={(e) => {
                              const newArr = [...dailyOperations];
                              newArr[i].remarks = e.target.value;
                              setDailyOperations(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                            placeholder="Add remarks"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...dailyOperations];
                              updated.splice(i, 1);
                              setDailyOperations(updated);
                            }}
                            className="text-rose-500 hover:text-rose-600 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. RECRUITMENT REPORT */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">3</span>
                Recruitment Report
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3 w-[35%] min-w-[280px]">Recruitment Activity</th>
                      <th className="px-4 py-3 w-48">Count / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-855">
                    {recruitmentReport.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.countStatus}
                            onChange={(e) => {
                              const newArr = [...recruitmentReport];
                              newArr[i].countStatus = e.target.value;
                              setRecruitmentReport(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. ATTENDANCE & LEAVE REPORT */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">4</span>
                Attendance & Leave Report
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 w-48">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {attendanceLeave.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500">{row.category}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.count}
                            onChange={(e) => {
                              const newArr = [...attendanceLeave];
                              newArr[i].count = e.target.value;
                              setAttendanceLeave(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. ADMIN OPERATIONS REPORT */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5</span>
                Admin Operations Report
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3 w-48 font-semibold">Status</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {adminOperations.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.dueDate || ''}
                            onChange={(e) => {
                              const newArr = [...adminOperations];
                              newArr[i].dueDate = e.target.value;
                              setAdminOperations(newArr);
                            }}
                            placeholder="DD/MM/YYYY"
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.status || ''}
                            onChange={(e) => {
                              const newArr = [...adminOperations];
                              newArr[i].status = e.target.value;
                              setAdminOperations(newArr);
                            }}
                            placeholder="Pending / Completed"
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.remarks || ''}
                            onChange={(e) => {
                              const newArr = [...adminOperations];
                              newArr[i].remarks = e.target.value;
                              setAdminOperations(newArr);
                            }}
                            placeholder="Add remarks..."
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. DOCUMENTATION & COMPLIANCE */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">6</span>
                Documentation & Compliance
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3 w-48">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {documentationCompliance.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.dueDate || ''}
                            onChange={(e) => {
                              const newArr = [...documentationCompliance];
                              newArr[i].dueDate = e.target.value;
                              setDocumentationCompliance(newArr);
                            }}
                            placeholder="DD/MM/YYYY"
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.status || ''}
                            onChange={(e) => {
                              const newArr = [...documentationCompliance];
                              newArr[i].status = e.target.value;
                              setDocumentationCompliance(newArr);
                            }}
                            placeholder="Yes / No"
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 7. KPI TRACKING */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">7</span>
                KPI Tracking
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">KPI</th>
                      <th className="px-4 py-3 w-48">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {kpiTracking.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500">{row.kpi}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.status}
                            onChange={(e) => {
                              const newArr = [...kpiTracking];
                              newArr[i].status = e.target.value;
                              setKpiTracking(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 8. ISSUES / ESCALATIONS */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">8</span>
                Issues / Escalations
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Issue</th>
                      <th className="px-4 py-3 w-48">Priority</th>
                      <th className="px-4 py-3">Action Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {issuesEscalations.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.issue}
                            onChange={(e) => {
                              const newArr = [...issuesEscalations];
                              newArr[i].issue = e.target.value;
                              setIssuesEscalations(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-semibold"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={row.priority}
                            onChange={(e) => {
                              const newArr = [...issuesEscalations];
                              newArr[i].priority = e.target.value;
                              setIssuesEscalations(newArr);
                            }}
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none"
                          >
                            <option value="High / Medium / Low">High / Medium / Low</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.actionTaken}
                            onChange={(e) => {
                              const newArr = [...issuesEscalations];
                              newArr[i].actionTaken = e.target.value;
                              setIssuesEscalations(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 9. NEXT DAY ACTION PLAN */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">9</span>
                Next Day Action Plan
              </h2>
              <textarea
                value={nextDayActionPlan}
                onChange={(e) => setNextDayActionPlan(e.target.value)}
                placeholder="1. Tasks planned..."
                className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
              />
            </div>

            {/* 10. FINAL SHIFT HANDOVER */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">10</span>
                Final Shift Handover
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Handover Item</th>
                      <th className="px-4 py-3 w-48">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {finalShiftHandover.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500">{row.item}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.status}
                            onChange={(e) => {
                              const newArr = [...finalShiftHandover];
                              newArr[i].status = e.target.value;
                              setFinalShiftHandover(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 11. HR / ADMIN COMMENTS */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">11</span>
                HR / Admin Comments
              </h2>
              <textarea
                value={hrAdminComments}
                onChange={(e) => setHrAdminComments(e.target.value)}
                placeholder="Enter remarks or summary comments"
                className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
              />
            </div>

            {/* 12. APPROVAL */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">12</span>
                Approval Details
              </h2>
              <div className="bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 max-w-lg">
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">HR / Admin Manager</h4>
                  <div>
                    <label className="block text-xs mb-1">Name</label>
                    <input
                      type="text"
                      value={approval.hrName || ''}
                      onChange={(e) => setApproval({ ...approval, hrName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Signature</label>
                    <SignatureUpload
                      value={approval.hrSignature || ''}
                      onChange={(val) => setApproval({ ...approval, hrSignature: val })}
                      placeholder="Upload HR signature"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Date</label>
                    <input
                      type="text"
                      value={approval.hrDate || ''}
                      onChange={(e) => setApproval({ ...approval, hrDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 w-full">
              {/* <button
                type="button"
                onClick={() => setIsWeeklyModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all"
              >
                <Calendar size={16} />
                Weekly Report
              </button>
              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all"
              >
                <Calendar size={16} />
                Monthly Report
              </button> */}

              

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Save File
              </button>
            </div>

          </motion.div>
        )}
      </div>

      {/* Monthly Report Modal */}
      <AnimatePresence>
        {isMonthlyModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-start pt-10 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 dark:border-slate-850 overflow-hidden mb-10 text-slate-700 dark:text-slate-200"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-150 dark:border-slate-850 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="text-indigo-600 dark:text-indigo-400" size={20} />
                    Monthly Report Consolidation
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidate, edit, and download HR operations reports for a specific date range.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
                >
                  <span className="sr-only">Close</span>
                  &times;
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Date Selection Bar */}
                <div className="flex flex-wrap items-end gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={monthlyStartDate}
                      onChange={(e) => setMonthlyStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={monthlyEndDate}
                      onChange={(e) => setMonthlyEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchMonthlyData}
                    disabled={isMonthlyLoading}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    {isMonthlyLoading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Fetch & Consolidate
                  </button>
                </div>

                {monthlyBasicDetails.dateRange ? (
                  <div className="space-y-6">
                    {/* Interactive Section Tabs */}
                    <div className="flex flex-wrap gap-1 border-b border-slate-100 dark:border-slate-850 pb-px">
                      {[
                        { id: 'recruitment', label: 'Recruitment' },
                        { id: 'attendance', label: 'Attendance & Leave' },
                        { id: 'operations', label: 'Daily & Admin Ops' },
                        { id: 'compliance', label: 'Compliance & KPIs' },
                        { id: 'issues', label: 'Issues & Plans' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setMonthlyActiveTab(tab.id)}
                          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                            monthlyActiveTab === tab.id
                              ? 'border-indigo-600 text-indigo-600 dark:border-lime-400 dark:text-lime-400'
                              : 'border-transparent text-slate-450 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab Panels */}
                    <div className="min-h-[350px]">
                      {/* 1. RECRUITMENT */}
                      {monthlyActiveTab === 'recruitment' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Recruitment Report
                          </h4>
                          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                  <th className="px-4 py-3 w-[35%] min-w-[280px]">Recruitment Activity</th>
                                  <th className="px-4 py-3 w-48">Count / Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                {monthlyRecruitmentReport.map((row, i) => (
                                  <tr key={i}>
                                    <td className="px-4 py-3 font-semibold text-xs text-slate-500">{row.activity}</td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="text"
                                        value={row.countStatus}
                                        onChange={(e) => {
                                          const newArr = [...monthlyRecruitmentReport];
                                          newArr[i].countStatus = e.target.value;
                                          setMonthlyRecruitmentReport(newArr);
                                        }}
                                        className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* 2. ATTENDANCE & LEAVE */}
                      {monthlyActiveTab === 'attendance' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Attendance & Leave Report
                          </h4>
                          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                  <th className="px-4 py-3">Category</th>
                                  <th className="px-4 py-3 w-48">Count</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                {monthlyAttendanceLeave.map((row, i) => (
                                  <tr key={i}>
                                    <td className="px-4 py-3 font-semibold text-xs text-slate-500">{row.category}</td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="text"
                                        value={row.count}
                                        onChange={(e) => {
                                          const newArr = [...monthlyAttendanceLeave];
                                          newArr[i].count = e.target.value;
                                          setMonthlyAttendanceLeave(newArr);
                                        }}
                                        className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* 3. DAILY & ADMIN OPS */}
                      {monthlyActiveTab === 'operations' && (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Daily Operations Summary
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3 w-[30%] min-w-[240px]">Activity</th>
                                    <th className="px-4 py-3 w-32">Due Date</th>
                                    <th className="px-4 py-3 w-32">Start Date</th>
                                    <th className="px-4 py-3 w-32">End Date</th>
                                    <th className="px-4 py-3 w-32">Status</th>
                                    <th className="px-4 py-3">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {monthlyDailyOperations.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="date"
                                          value={row.dueDate || ''}
                                          onChange={(e) => {
                                            const newArr = [...monthlyDailyOperations];
                                            newArr[i].dueDate = e.target.value;
                                            setMonthlyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="date"
                                          value={row.startDate || ''}
                                          onChange={(e) => {
                                            const newArr = [...monthlyDailyOperations];
                                            newArr[i].startDate = e.target.value;
                                            setMonthlyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="date"
                                          value={row.endDate || ''}
                                          onChange={(e) => {
                                            const newArr = [...monthlyDailyOperations];
                                            newArr[i].endDate = e.target.value;
                                            setMonthlyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <select
                                          value={row.status || 'ongoing'}
                                          onChange={(e) => {
                                            const newArr = [...monthlyDailyOperations];
                                            newArr[i].status = e.target.value;
                                            setMonthlyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        >
                                          <option value="ongoing">Ongoing</option>
                                          <option value="completed">Completed</option>
                                          <option value="pending">Pending</option>
                                        </select>
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.remarks || ''}
                                          onChange={(e) => {
                                            const newArr = [...monthlyDailyOperations];
                                            newArr[i].remarks = e.target.value;
                                            setMonthlyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                          placeholder="Add remarks"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Admin Operations Report
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                                    <th className="px-4 py-3 w-40">Status</th>
                                    <th className="px-4 py-3">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {monthlyAdminOperations.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.status}
                                          onChange={(e) => {
                                            const newArr = [...monthlyAdminOperations];
                                            newArr[i].status = e.target.value;
                                            setMonthlyAdminOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.remarks}
                                          onChange={(e) => {
                                            const newArr = [...monthlyAdminOperations];
                                            newArr[i].remarks = e.target.value;
                                            setMonthlyAdminOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 5. COMPLIANCE & KPIS */}
                      {monthlyActiveTab === 'compliance' && (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Documentation & Compliance
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                                    <th className="px-4 py-3 w-48">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {monthlyDocumentationCompliance.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.status}
                                          onChange={(e) => {
                                            const newArr = [...monthlyDocumentationCompliance];
                                            newArr[i].status = e.target.value;
                                            setMonthlyDocumentationCompliance(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              KPI Tracking
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">KPI</th>
                                    <th className="px-4 py-3 w-48">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {monthlyKpiTracking.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500">{row.kpi}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.status}
                                          onChange={(e) => {
                                            const newArr = [...monthlyKpiTracking];
                                            newArr[i].status = e.target.value;
                                            setMonthlyKpiTracking(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Final Shift Handover
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">Handover Item</th>
                                    <th className="px-4 py-3 w-48">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {monthlyFinalShiftHandover.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500">{row.item}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.status}
                                          onChange={(e) => {
                                            const newArr = [...monthlyFinalShiftHandover];
                                            newArr[i].status = e.target.value;
                                            setMonthlyFinalShiftHandover(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 6. ISSUES & PLANS */}
                      {monthlyActiveTab === 'issues' && (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                Issues / Escalations
                              </h4>
                              <button
                                type="button"
                                onClick={() => setMonthlyIssuesEscalations([...monthlyIssuesEscalations, { issue: '', priority: 'High / Medium / Low', actionTaken: '' }])}
                                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-lime-400 font-bold hover:underline"
                              >
                                <Plus size={14} /> Add Issue
                              </button>
                            </div>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">Issue</th>
                                    <th className="px-4 py-3 w-44">Priority</th>
                                    <th className="px-4 py-3">Action Taken</th>
                                    <th className="px-4 py-3 w-10"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {monthlyIssuesEscalations.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-2">
                                        <input
                                          type="text"
                                          value={row.issue}
                                          onChange={(e) => {
                                            const newArr = [...monthlyIssuesEscalations];
                                            newArr[i].issue = e.target.value;
                                            setMonthlyIssuesEscalations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-semibold text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <select
                                          value={row.priority}
                                          onChange={(e) => {
                                            const newArr = [...monthlyIssuesEscalations];
                                            newArr[i].priority = e.target.value;
                                            setMonthlyIssuesEscalations(newArr);
                                          }}
                                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                                        >
                                          <option value="High / Medium / Low">High / Medium / Low</option>
                                          <option value="High">High</option>
                                          <option value="Medium">Medium</option>
                                          <option value="Low">Low</option>
                                        </select>
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          type="text"
                                          value={row.actionTaken}
                                          onChange={(e) => {
                                            const newArr = [...monthlyIssuesEscalations];
                                            newArr[i].actionTaken = e.target.value;
                                            setMonthlyIssuesEscalations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <button
                                          type="button"
                                          onClick={() => setMonthlyIssuesEscalations(monthlyIssuesEscalations.filter((_, idx) => idx !== i))}
                                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Next Day Action Plan (Consolidated)
                            </h4>
                            <textarea
                              value={monthlyNextDayActionPlan}
                              onChange={(e) => setMonthlyNextDayActionPlan(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[120px] text-slate-700 dark:text-slate-200"
                            />
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              HR / Admin Comments (Consolidated)
                            </h4>
                            <textarea
                              value={monthlyHrAdminComments}
                              onChange={(e) => setMonthlyHrAdminComments(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[120px] text-slate-700 dark:text-slate-200"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-450 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    Select a date range and click "Fetch & Consolidate" to begin editing.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-150 dark:border-slate-850 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                {monthlyBasicDetails.dateRange && (
                  <>
                    <button
                      type="button"
                      disabled={isMonthlySaving}
                      onClick={() => handleSaveMonthlyReport(false)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Save size={16} />
                      {isMonthlySaving ? "Saving..." : "Save to Employee Reports"}
                    </button>
                    <button
                      type="button"
                      disabled={isMonthlySaving}
                      onClick={() => handleSaveMonthlyReport(true)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50 cursor-pointer"
                    >
                      <Download size={16} />
                      Download & Save PDF
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {isWeeklyModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-start pt-10 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 dark:border-slate-850 overflow-hidden mb-10 text-slate-700 dark:text-slate-200"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-150 dark:border-slate-850 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="text-indigo-600 dark:text-indigo-400" size={20} />
                    Weekly Report Consolidation
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidate, edit, and download HR operations reports for a specific date range.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
                >
                  <span className="sr-only">Close</span>
                  &times;
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Date Selection Bar */}
                <div className="flex flex-wrap items-end gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={weeklyStartDate}
                      onChange={(e) => setWeeklyStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={weeklyEndDate}
                      onChange={(e) => setWeeklyEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchWeeklyData}
                    disabled={isWeeklyLoading}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    {isWeeklyLoading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Fetch & Consolidate
                  </button>
                </div>

                {weeklyBasicDetails.dateRange ? (
                  <div className="space-y-6">
                    {/* Interactive Section Tabs */}
                    <div className="flex flex-wrap gap-1 border-b border-slate-100 dark:border-slate-855 pb-px">
                      {[
                        { id: 'recruitment', label: 'Recruitment' },
                        { id: 'attendance', label: 'Attendance & Leave' },
                        { id: 'operations', label: 'Daily & Admin Ops' },
                        { id: 'compliance', label: 'Compliance & KPIs' },
                        { id: 'issues', label: 'Issues & Plans' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setWeeklyActiveTab(tab.id)}
                          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                            weeklyActiveTab === tab.id
                              ? 'border-indigo-600 text-indigo-600 dark:border-lime-400 dark:text-lime-400'
                              : 'border-transparent text-slate-450 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab Panels */}
                    <div className="min-h-[350px]">
                      {/* 1. RECRUITMENT */}
                      {weeklyActiveTab === 'recruitment' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Recruitment Report
                          </h4>
                          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                  <th className="px-4 py-3 w-[35%] min-w-[280px]">Recruitment Activity</th>
                                  <th className="px-4 py-3 w-48">Count / Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                {weeklyRecruitmentReport.map((row, i) => (
                                  <tr key={i}>
                                    <td className="px-4 py-3 font-semibold text-xs text-slate-500">{row.activity}</td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="text"
                                        value={row.countStatus}
                                        onChange={(e) => {
                                          const newArr = [...weeklyRecruitmentReport];
                                          newArr[i].countStatus = e.target.value;
                                          setWeeklyRecruitmentReport(newArr);
                                        }}
                                        className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* 2. ATTENDANCE & LEAVE */}
                      {weeklyActiveTab === 'attendance' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Attendance & Leave Report
                          </h4>
                          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                  <th className="px-4 py-3">Category</th>
                                  <th className="px-4 py-3 w-48">Count</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                {weeklyAttendanceLeave.map((row, i) => (
                                  <tr key={i}>
                                    <td className="px-4 py-3 font-semibold text-xs text-slate-500">{row.category}</td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="text"
                                        value={row.count}
                                        onChange={(e) => {
                                          const newArr = [...weeklyAttendanceLeave];
                                          newArr[i].count = e.target.value;
                                          setWeeklyAttendanceLeave(newArr);
                                        }}
                                        className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* 3. DAILY & ADMIN OPS */}
                      {weeklyActiveTab === 'operations' && (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Daily Operations Summary
                            </h4>
                             <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3 w-[30%] min-w-[240px]">Activity</th>
                                    <th className="px-4 py-3 w-32">Due Date</th>
                                    <th className="px-4 py-3 w-32">Start Date</th>
                                    <th className="px-4 py-3 w-32">End Date</th>
                                    <th className="px-4 py-3 w-32">Status</th>
                                    <th className="px-4 py-3">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {weeklyDailyOperations.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="date"
                                          value={row.dueDate || ''}
                                          onChange={(e) => {
                                            const newArr = [...weeklyDailyOperations];
                                            newArr[i].dueDate = e.target.value;
                                            setWeeklyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="date"
                                          value={row.startDate || ''}
                                          onChange={(e) => {
                                            const newArr = [...weeklyDailyOperations];
                                            newArr[i].startDate = e.target.value;
                                            setWeeklyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="date"
                                          value={row.endDate || ''}
                                          onChange={(e) => {
                                            const newArr = [...weeklyDailyOperations];
                                            newArr[i].endDate = e.target.value;
                                            setWeeklyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <select
                                          value={row.status || 'ongoing'}
                                          onChange={(e) => {
                                            const newArr = [...weeklyDailyOperations];
                                            newArr[i].status = e.target.value;
                                            setWeeklyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        >
                                          <option value="ongoing">Ongoing</option>
                                          <option value="completed">Completed</option>
                                          <option value="pending">Pending</option>
                                        </select>
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.remarks || ''}
                                          onChange={(e) => {
                                            const newArr = [...weeklyDailyOperations];
                                            newArr[i].remarks = e.target.value;
                                            setWeeklyDailyOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                          placeholder="Add remarks"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Admin Operations Report
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                                    <th className="px-4 py-3 w-40">Status</th>
                                    <th className="px-4 py-3">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {weeklyAdminOperations.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.status}
                                          onChange={(e) => {
                                            const newArr = [...weeklyAdminOperations];
                                            newArr[i].status = e.target.value;
                                            setWeeklyAdminOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.remarks}
                                          onChange={(e) => {
                                            const newArr = [...weeklyAdminOperations];
                                            newArr[i].remarks = e.target.value;
                                            setWeeklyAdminOperations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 5. COMPLIANCE & KPIS */}
                      {weeklyActiveTab === 'compliance' && (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Documentation & Compliance
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                                    <th className="px-4 py-3 w-48">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {weeklyDocumentationCompliance.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.status}
                                          onChange={(e) => {
                                            const newArr = [...weeklyDocumentationCompliance];
                                            newArr[i].status = e.target.value;
                                            setWeeklyDocumentationCompliance(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              KPI Tracking
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">KPI</th>
                                    <th className="px-4 py-3 w-48">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {weeklyKpiTracking.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500">{row.kpi}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.status}
                                          onChange={(e) => {
                                            const newArr = [...weeklyKpiTracking];
                                            newArr[i].status = e.target.value;
                                            setWeeklyKpiTracking(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Final Shift Handover
                            </h4>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">Handover Item</th>
                                    <th className="px-4 py-3 w-48">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {weeklyFinalShiftHandover.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-3 font-semibold text-xs text-slate-500">{row.item}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={row.status}
                                          onChange={(e) => {
                                            const newArr = [...weeklyFinalShiftHandover];
                                            newArr[i].status = e.target.value;
                                            setWeeklyFinalShiftHandover(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 6. ISSUES & PLANS */}
                      {weeklyActiveTab === 'issues' && (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                Issues / Escalations
                              </h4>
                              <button
                                type="button"
                                onClick={() => setWeeklyIssuesEscalations([...weeklyIssuesEscalations, { issue: '', priority: 'High / Medium / Low', actionTaken: '' }])}
                                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-lime-400 font-bold hover:underline"
                              >
                                <Plus size={14} /> Add Issue
                              </button>
                            </div>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">Issue</th>
                                    <th className="px-4 py-3 w-44">Priority</th>
                                    <th className="px-4 py-3">Action Taken</th>
                                    <th className="px-4 py-3 w-10"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                  {weeklyIssuesEscalations.map((row, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-2">
                                        <input
                                          type="text"
                                          value={row.issue}
                                          onChange={(e) => {
                                            const newArr = [...weeklyIssuesEscalations];
                                            newArr[i].issue = e.target.value;
                                            setWeeklyIssuesEscalations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-semibold text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <select
                                          value={row.priority}
                                          onChange={(e) => {
                                            const newArr = [...weeklyIssuesEscalations];
                                            newArr[i].priority = e.target.value;
                                            setWeeklyIssuesEscalations(newArr);
                                          }}
                                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                                        >
                                          <option value="High / Medium / Low">High / Medium / Low</option>
                                          <option value="High">High</option>
                                          <option value="Medium">Medium</option>
                                          <option value="Low">Low</option>
                                        </select>
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          type="text"
                                          value={row.actionTaken}
                                          onChange={(e) => {
                                            const newArr = [...weeklyIssuesEscalations];
                                            newArr[i].actionTaken = e.target.value;
                                            setWeeklyIssuesEscalations(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <button
                                          type="button"
                                          onClick={() => setWeeklyIssuesEscalations(weeklyIssuesEscalations.filter((_, idx) => idx !== i))}
                                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Next Day Action Plan (Consolidated)
                            </h4>
                            <textarea
                              value={weeklyNextDayActionPlan}
                              onChange={(e) => setWeeklyNextDayActionPlan(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[120px] text-slate-700 dark:text-slate-200"
                            />
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              HR / Admin Comments (Consolidated)
                            </h4>
                            <textarea
                              value={weeklyHrAdminComments}
                              onChange={(e) => setWeeklyHrAdminComments(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[120px] text-slate-700 dark:text-slate-200"
                            />
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Achievements
                            </h4>
                            <textarea
                              value={weeklyAchievements}
                              onChange={(e) => setWeeklyAchievements(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[120px] text-slate-700 dark:text-slate-200"
                              placeholder="Enter achievements..."
                            />
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Improvements
                            </h4>
                            <textarea
                              value={weeklyImprovements}
                              onChange={(e) => setWeeklyImprovements(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[120px] text-slate-700 dark:text-slate-200"
                              placeholder="Enter improvements needed..."
                            />
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Next Week Planning
                            </h4>
                            <textarea
                              value={weeklyNextWeekPlanning}
                              onChange={(e) => setWeeklyNextWeekPlanning(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[120px] text-slate-700 dark:text-slate-200"
                              placeholder="Enter next week planning..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-450 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    Select a date range and click "Fetch & Consolidate" to begin editing.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-150 dark:border-slate-850 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                {weeklyBasicDetails.dateRange && (
                  <>
                    <button
                      type="button"
                      disabled={isWeeklySaving}
                      onClick={() => handleSaveWeeklyReport(false)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Save size={16} />
                      {isWeeklySaving ? "Saving..." : "Save to Employee Reports"}
                    </button>
                    <button
                      type="button"
                      disabled={isWeeklySaving}
                      onClick={() => handleSaveWeeklyReport(true)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50 cursor-pointer"
                    >
                      <Download size={16} />
                      Download & Save PDF
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Detail Modal */}
      {selectedActivityText && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative my-auto">
            <button
              type="button"
              onClick={() => setSelectedActivityText(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-4">Activity Details</h3>
            <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-words font-medium leading-relaxed">
              {selectedActivityText}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedActivityText(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default HrReportPage;
