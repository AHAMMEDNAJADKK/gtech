// ===============================
// FRONTEND: DailyShiftReportPage.jsx
// Duplicated from DeveloperReportPage framework & customized for Daily Shift Report
// ===============================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Calendar, Plus, Trash2, Save, Download,
  CheckCircle, HelpCircle, Loader2, User, ChevronLeft, ChevronRight, ChevronDown, Pencil, X, Maximize2,
  MinusCircle, PlusCircle, History, Printer, Send, Sparkles, CheckCircle2, RefreshCw, Award
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompletedTasks } from '../utils/taskUtils';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';
import { uploadCompiledPDFReport } from '../services/departmentService';

const RAW_API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (RAW_API_BASE.endsWith('/v1')) {
    return `${RAW_API_BASE}${cleanPath}`;
  }
  if (RAW_API_BASE.endsWith('/api')) {
    return `${RAW_API_BASE}/v1${cleanPath}`;
  }
  return `${RAW_API_BASE}/api${cleanPath}`;
};

const getISTDate = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(new Date());
};

const formatDateString = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
  }
  return dateStr;
};

// Default Row Templates for Daily Shift Report
const DEFAULT_PLAN_ACHIEVEMENT = [
  { taskActivity: '', targetToday: '', actualOutput: '', status: 'Pending', businessResultRemarks: '' }
];

const DEFAULT_KEY_METRICS = [
  { metricKpi: '', target: '', actual: '', achievementPct: '', remarks: '' }
];

const DEFAULT_EVIDENCE = [
  { workItem: '', crmRecordUrlFileApproval: '' }
];

const DEFAULT_BLOCKERS = [
  { pendingTaskIssue: '', reasonBlocker: '', owner: '', expectedCompletion: '' }
];

const DEFAULT_PRIORITIES = [
  { priorityText: '' },
  { priorityText: '' },
  { priorityText: '' }
];

const DEFAULT_STUDENT_LEADS = [
  { activity: 'New Leads Generated', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Qualified Lead', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Calls Made', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Follow up', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Hot Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Warm Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Cold Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'RNT Leads (Ring Next Time)', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Switch Off Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Wrong leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Pending Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Client/Student Meetings Fixed', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Admissions/Closings Done', count: '', digitalMktg: '', web: '', remarks: '' }
];

const DEFAULT_CLIENT_LEADS = [
  { activity: 'New Client Leads Generated', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Qualified Client Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Client Calls / Contacted', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Client Follow ups', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Hot Client Leads (High Priority)', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Warm Client Leads (Medium Priority)', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Cold Client Leads (Low Priority)', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Wrong Client Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Pending Client Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Client Meetings Fixed', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Client Closings / Onboarding Done', count: '', digitalMktg: '', web: '', remarks: '' }
];

// Helper to group planVsAchievement rows by project (Task / Activity)
const getProjectGroups = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const groups = [];
  let currentGroup = null;

  rows.forEach((row, index) => {
    const rawName = (row.taskActivity || '').trim();

    if (!currentGroup) {
      currentGroup = { projectName: rawName, startIndex: index, rows: [{ ...row, originalIndex: index }] };
    } else {
      if (
        (rawName === '' && currentGroup.projectName !== '') ||
        (rawName !== '' && currentGroup.projectName !== '' && rawName.toLowerCase() === currentGroup.projectName.toLowerCase())
      ) {
        currentGroup.rows.push({ ...row, originalIndex: index });
      } else {
        groups.push(currentGroup);
        currentGroup = { projectName: rawName, startIndex: index, rows: [{ ...row, originalIndex: index }] };
      }
    }
  });

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
};

const DailyShiftReportPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [selectedDate, setSelectedDate] = useState(getISTDate());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [pastReports, setPastReports] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [isPrivileged, setIsPrivileged] = useState(false);

  // Selection state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);

  // Date sidebar state matching other reports
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Helper for 12-month calendar log
  const getRecentMonths = () => {
    const months = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth();

    for (let i = 0; i < 12; i++) {
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const d = new Date(y, m, 1);
      const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const totalDays = new Date(y, m + 1, 0).getDate();
      const dates = [];

      for (let day = 1; day <= totalDays; day++) {
        const dateObj = new Date(y, m, day);
        const dateString = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const displayDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        dates.push({ dateString, dayName, displayDate });
      }

      months.push({ monthKey, monthName, dates });

      m--;
      if (m < 0) {
        m = 11;
        y--;
      }
    }
    return months;
  };
  const recentMonths = getRecentMonths();

  const [expandedMonth, setExpandedMonth] = useState(() => {
    const sel = selectedDate ? new Date(selectedDate) : new Date();
    return `${sel.getFullYear()}-${String(sel.getMonth() + 1).padStart(2, '0')}`;
  });

  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

  // Excluded sections toggle map
  const [hiddenSections, setHiddenSections] = useState({});

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Form States matching Daily Shift Report schema
  const [employeeShiftDetails, setEmployeeShiftDetails] = useState({
    date: getISTDate(),
    employeeName: '',
    employeeId: '',
    department: '',
    designation: '',
    reportingTo: '',
    shiftTiming: '09:30 AM - 06:30 PM',
    workMode: 'Office',
    preparedTime: ''
  });

  const [planVsAchievement, setPlanVsAchievement] = useState(DEFAULT_PLAN_ACHIEVEMENT);
  const [departmentKeyMetrics, setDepartmentKeyMetrics] = useState(DEFAULT_KEY_METRICS);
  const [evidenceAttachments, setEvidenceAttachments] = useState(DEFAULT_EVIDENCE);
  const [pendingBlockers, setPendingBlockers] = useState(DEFAULT_BLOCKERS);
  const [tomorrowPriorities, setTomorrowPriorities] = useState(DEFAULT_PRIORITIES);
  const [studentLeadsUpdate, setStudentLeadsUpdate] = useState(DEFAULT_STUDENT_LEADS);
  const [clientLeadsUpdate, setClientLeadsUpdate] = useState(DEFAULT_CLIENT_LEADS);

  const [handoverFinalConfirmation, setHandoverFinalConfirmation] = useState({
    handoverRequired: 'No',
    handoverTo: '',
    crmUpdated: 'Yes',
    reportSubmitted: 'Yes',
    employeeComment: '',
    signature: ''
  });

  // Fetch token headers helper
  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Designation Check: Is Academic Counselor / Telecaller
  const isAcademicCounselor = useMemo(() => {
    const userDetail = isPrivileged && staffList.length > 0 ? staffList.find(u => (u._id || u.id) === selectedUserId) : currentUser;
    const desig = String(
      employeeShiftDetails.designation ||
      userDetail?.designationName ||
      userDetail?.designation ||
      userDetail?.designationId?.name ||
      currentUser?.designationName ||
      currentUser?.designation ||
      ''
    ).toLowerCase().trim();

    const dept = String(
      employeeShiftDetails.department ||
      userDetail?.department ||
      userDetail?.departmentId?.name ||
      currentUser?.department ||
      ''
    ).toLowerCase().trim();

    return (
      desig.includes('counselor') ||
      desig.includes('academic') ||
      desig.includes('tele') ||
      dept.includes('counselor') ||
      dept.includes('academic')
    );
  }, [employeeShiftDetails.designation, employeeShiftDetails.department, isPrivileged, staffList, selectedUserId, currentUser]);

  // Auto-fetch Student & Client Leads stats from CRM
  const autoFetchLeadStats = useCallback(async (dateStr = selectedDate, showNotification = false) => {
    try {
      const [resTele, resClient] = await Promise.all([
        fetch(getApiEndpoint(`/ops-reports/lead-stats?date=${dateStr}`), { headers: getAuthHeaders() }),
        fetch(getApiEndpoint(`/ops-reports/client-lead-stats?date=${dateStr}`), { headers: getAuthHeaders() })
      ]);

      const contentTypeTele = resTele.headers.get('content-type') || '';
      if (contentTypeTele.includes('application/json')) {
        const dataTele = await resTele.json();
        if (dataTele.success && Array.isArray(dataTele.data) && dataTele.data.length > 0) {
          setStudentLeadsUpdate(dataTele.data);
        }
      }

      const contentTypeClient = resClient.headers.get('content-type') || '';
      if (contentTypeClient.includes('application/json')) {
        const dataClient = await resClient.json();
        if (dataClient.success && Array.isArray(dataClient.data) && dataClient.data.length > 0) {
          setClientLeadsUpdate(dataClient.data);
        }
      }

      if (showNotification) {
        showToast('Counselor lead statistics auto-fetched from CRM!', 'success');
      }
    } catch (e) {
      console.error('Failed to auto-fetch counselor lead stats:', e);
      if (showNotification) {
        showToast('Failed to auto-fetch counselor lead stats', 'error');
      }
    }
  }, [selectedDate, getAuthHeaders, showToast]);

  // Initialize user session
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      const storedUserId = localStorage.getItem('user_id')?.replace(/"/g, '');
      if (savedUser) {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);

        const role = String(userObj.role_id || userObj.roleId || userObj.role || '').toLowerCase().trim();
        const privileged = userObj.isSuperAdmin === true || userObj.is_super_admin === true || ['0', '1', '2', 'hr', 'admin', 'superadmin', 'super_admin'].includes(role);
        setIsPrivileged(privileged);

        const myUserId = userObj._id || userObj.id || userObj.user_id || storedUserId || '';
        if (!selectedUserId || !privileged) {
          if (myUserId) {
            setSelectedUserId(myUserId);
          }
        }
      }
    } catch (err) {
      console.error("Failed to parse user session details:", err);
    }
  }, []);

  // Fetch staff list for Admins/HR
  useEffect(() => {
    if (isPrivileged) {
      const fetchStaff = async () => {
        try {
          const res = await fetch(getApiEndpoint('/daily-shift-reports/staff'), {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setStaffList(data.data);
            if (data.data.length > 0 && !selectedUserId) {
              setSelectedUserId(data.data[0]._id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch staff list:", e);
        }
      };
      fetchStaff();
    }
  }, [isPrivileged, getAuthHeaders, selectedUserId]);

  // Fetch submitted report dates list
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(getApiEndpoint(`/daily-shift-reports/submitted-dates?userId=${userId}`), {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSubmittedDates(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch submitted dates:", e);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (selectedUserId) {
      fetchSubmittedDates(selectedUserId);
    }
  }, [selectedUserId, fetchSubmittedDates]);

  // Cache basic details in localStorage
  useEffect(() => {
    if (selectedUserId && employeeShiftDetails && (employeeShiftDetails.employeeName || employeeShiftDetails.employeeId)) {
      const { date, ...persistent } = employeeShiftDetails;
      if (Object.keys(persistent).length > 0) {
        localStorage.setItem(`cachedBasicDetails_ShiftReport_${selectedUserId}`, JSON.stringify(persistent));
      }
    }
  }, [employeeShiftDetails, selectedUserId]);

  // Fetch report data for selected date and user
  const fetchReport = async (userId, dateStr) => {
    if (!userId || !dateStr) return;
    try {
      setLoading(true);
      const res = await fetch(getApiEndpoint(`/daily-shift-reports/by-date?userId=${userId}&dateString=${dateStr}`), {
        headers: getAuthHeaders()
      });

      const data = await res.json();

      let freshestUser = currentUser;
      try {
        const su = localStorage.getItem('user');
        if (su) freshestUser = JSON.parse(su);
      } catch (e) {}

      let userDetail = freshestUser;
      if (isPrivileged && staffList.length > 0) {
        userDetail = staffList.find(u => (u._id || u.id) === userId) || freshestUser;
      }

      const cached = localStorage.getItem(`cachedBasicDetails_ShiftReport_${userId}`);
      const parsedCached = cached ? JSON.parse(cached) : {};

      if (data.success && data.data) {
        const report = data.data;
        const apiDetails = report.employeeShiftDetails || {};

        setEmployeeShiftDetails({
          date: dateStr,
          employeeName: userDetail.name || apiDetails.employeeName || parsedCached.employeeName || '',
          employeeId: userDetail.employeeId || apiDetails.employeeId || parsedCached.employeeId || '',
          department: userDetail.department || userDetail.departmentId?.name || apiDetails.department || parsedCached.department || '',
          designation: userDetail.designationName || userDetail.designation || apiDetails.designation || parsedCached.designation || '',
          reportingTo: userDetail.reportingManager || apiDetails.reportingTo || parsedCached.reportingTo || '',
          shiftTiming: apiDetails.shiftTiming || parsedCached.shiftTiming || '09:30 AM - 06:30 PM',
          workMode: apiDetails.workMode || parsedCached.workMode || 'Office',
          preparedTime: apiDetails.preparedTime || parsedCached.preparedTime || ''
        });

        setPlanVsAchievement(report.planVsAchievement && report.planVsAchievement.length > 0 ? report.planVsAchievement : DEFAULT_PLAN_ACHIEVEMENT);
        setDepartmentKeyMetrics(report.departmentKeyMetrics && report.departmentKeyMetrics.length > 0 ? report.departmentKeyMetrics : DEFAULT_KEY_METRICS);
        setEvidenceAttachments(report.evidenceAttachments && report.evidenceAttachments.length > 0 ? report.evidenceAttachments : DEFAULT_EVIDENCE);
        setPendingBlockers(report.pendingBlockers && report.pendingBlockers.length > 0 ? report.pendingBlockers : DEFAULT_BLOCKERS);
        setTomorrowPriorities(report.tomorrowPriorities && report.tomorrowPriorities.length > 0 ? report.tomorrowPriorities : DEFAULT_PRIORITIES);
        if (report.studentLeadsUpdate && report.studentLeadsUpdate.length > 0) {
          setStudentLeadsUpdate(report.studentLeadsUpdate);
        } else {
          setStudentLeadsUpdate(DEFAULT_STUDENT_LEADS);
          autoFetchLeadStats(dateStr, false);
        }
        if (report.clientLeadsUpdate && report.clientLeadsUpdate.length > 0) {
          setClientLeadsUpdate(report.clientLeadsUpdate);
        } else {
          setClientLeadsUpdate(DEFAULT_CLIENT_LEADS);
          autoFetchLeadStats(dateStr, false);
        }
        setHandoverFinalConfirmation(report.handoverFinalConfirmation || {
          handoverRequired: 'No', handoverTo: '', crmUpdated: 'Yes', reportSubmitted: 'Yes', employeeComment: '', signature: ''
        });
      } else {
        // Initialize blank report with user pre-filling
        setEmployeeShiftDetails({
          date: dateStr,
          employeeName: userDetail.name || parsedCached.employeeName || '',
          employeeId: userDetail.employeeId || parsedCached.employeeId || '',
          department: userDetail.department || userDetail.departmentId?.name || parsedCached.department || '',
          designation: userDetail.designationName || userDetail.designation || parsedCached.designation || '',
          reportingTo: userDetail.reportingManager || parsedCached.reportingTo || '',
          shiftTiming: parsedCached.shiftTiming || '09:30 AM - 06:30 PM',
          workMode: parsedCached.workMode || 'Office',
          preparedTime: parsedCached.preparedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        setPlanVsAchievement(DEFAULT_PLAN_ACHIEVEMENT);
        setDepartmentKeyMetrics(DEFAULT_KEY_METRICS);
        setEvidenceAttachments(DEFAULT_EVIDENCE);
        setPendingBlockers(DEFAULT_BLOCKERS);
        setTomorrowPriorities(DEFAULT_PRIORITIES);
        setStudentLeadsUpdate(DEFAULT_STUDENT_LEADS);
        setClientLeadsUpdate(DEFAULT_CLIENT_LEADS);
        autoFetchLeadStats(dateStr, false);
        setHandoverFinalConfirmation({
          handoverRequired: 'No', handoverTo: '', crmUpdated: 'Yes', reportSubmitted: 'Yes', employeeComment: '', signature: ''
        });

        // Auto-fetch completed tasks from system & group tasks under their respective projects
        try {
          const completed = await fetchCompletedTasks(userId, dateStr);
          if (completed && completed.length > 0) {
            const projectMap = new Map();

            completed.forEach(t => {
              const projName = (t.project && typeof t.project === 'object')
                ? (t.project.projectName || t.project.name || t.project.title || '')
                : (t.projectName || t.project_name || (typeof t.project === 'string' && t.project.trim() ? t.project : '') || t.projectId?.name || '');

              const key = projName.trim();
              if (!projectMap.has(key)) {
                projectMap.set(key, {
                  projectName: projName,
                  items: []
                });
              }

              const group = projectMap.get(key);

              const addItem = (title, rawStatus, itemDate) => {
                const cleanTitle = (title || '').replace(/\[[^\]]+\]/g, '').trim();
                if (!cleanTitle) return;

                const raw = String(rawStatus || '').toLowerCase();
                const isItemDone = ['done', 'completed', 'complete', 'finished'].includes(raw);

                // If item is marked completed/done, exclude if completed yesterday or earlier
                if (isItemDone && itemDate) {
                  try {
                    const dObj = new Date(itemDate);
                    if (!isNaN(dObj.getTime())) {
                      const itemY = dObj.getFullYear();
                      const itemM = String(dObj.getMonth() + 1).padStart(2, '0');
                      const itemD = String(dObj.getDate()).padStart(2, '0');
                      const itemDateStr = `${itemY}-${itemM}-${itemD}`;

                      const itemUtcY = dObj.getUTCFullYear();
                      const itemUtcM = String(dObj.getUTCMonth() + 1).padStart(2, '0');
                      const itemUtcD = String(dObj.getUTCDate()).padStart(2, '0');
                      const itemUtcDateStr = `${itemUtcY}-${itemUtcM}-${itemUtcD}`;

                      if (itemDateStr !== dateStr && itemUtcDateStr !== dateStr) {
                        return; // Skip item completed on prior date (e.g. yesterday)
                      }
                    }
                  } catch (e) {}
                }

                let statusVal = 'Pending';
                if (raw.includes('current') || raw.includes('progress')) statusVal = 'Current';
                else if (raw.includes('preview')) statusVal = 'Preview';
                else if (raw.includes('done') || raw.includes('completed') || raw.includes('finished')) statusVal = 'Completed';

                if (!group.items.some(it => it.title === cleanTitle)) {
                  group.items.push({ title: cleanTitle, status: statusVal });
                }
              };

              const mainTitle = t.rawTitle || t.taskTitle || t.title || t.name;
              const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
              const taskCompletionTime = t.completedAt || t.completed_at || t.updatedAt || t.updated_at;

              if (subtasks.length > 0) {
                if (mainTitle) addItem(mainTitle, t.status, taskCompletionTime);
                subtasks.forEach(sub => {
                  const subTime = sub.completedAt || sub.completed_at || sub.updatedAt || sub.updated_at || taskCompletionTime;
                  addItem(sub.title || sub.name || sub.taskTitle, sub.status || t.status, subTime);
                });
              } else {
                if (mainTitle) addItem(mainTitle, t.status, taskCompletionTime);
              }
            });

            // Convert project groups into rows: each task/subtask gets its own row,
            // with taskActivity (Project Name) filled ONLY on the first task of the group.
            const mappedRows = [];
            projectMap.forEach(group => {
              group.items.forEach((item, idx) => {
                mappedRows.push({
                  taskActivity: idx === 0 ? group.projectName : '',
                  targetToday: item.title,
                  actualOutput: '',
                  status: item.status,
                  businessResultRemarks: ''
                });
              });
            });

            if (mappedRows.length > 0) {
              setPlanVsAchievement(mappedRows);
            }
          }
        } catch (e) {
          console.error("Error auto-fetching tasks:", e);
        }
      }
    } catch (err) {
      console.error('Error fetching shift report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserId && selectedDate) {
      fetchReport(selectedUserId, selectedDate);
    }
  }, [selectedUserId, selectedDate]);

  // History Drawer Handler
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(getApiEndpoint('/daily-shift-reports/my-reports'), {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setPastReports(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    if (!historyDrawerOpen) {
      fetchHistory();
    }
    setHistoryDrawerOpen(!historyDrawerOpen);
  };

  // Submit Report
  const handleSaveReport = async () => {
    try {
      setSaving(true);
      const cleanPlan = planVsAchievement.filter(r => (r.taskActivity || '').trim() !== '' || (r.targetToday || '').trim() !== '');
      const cleanMetrics = departmentKeyMetrics.filter(r => (r.metricKpi || '').trim() !== '');
      const cleanEvidence = evidenceAttachments.filter(r => (r.workItem || '').trim() !== '');
      const cleanBlockers = pendingBlockers.filter(r => (r.pendingTaskIssue || '').trim() !== '');
      const cleanPriorities = tomorrowPriorities.filter(r => (r.priorityText || '').trim() !== '');

      const payload = {
        userId: selectedUserId,
        dateString: selectedDate,
        employeeShiftDetails,
        planVsAchievement: cleanPlan.length > 0 ? cleanPlan : planVsAchievement,
        departmentKeyMetrics: cleanMetrics.length > 0 ? cleanMetrics : departmentKeyMetrics,
        evidenceAttachments: cleanEvidence.length > 0 ? cleanEvidence : evidenceAttachments,
        pendingBlockers: cleanBlockers.length > 0 ? cleanBlockers : pendingBlockers,
        tomorrowPriorities: cleanPriorities.length > 0 ? cleanPriorities : tomorrowPriorities,
        studentLeadsUpdate,
        clientLeadsUpdate,
        handoverFinalConfirmation,
        status: 'Submitted'
      };

      const res = await fetch(getApiEndpoint('/daily-shift-reports/save'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Daily Shift Report saved successfully!', 'success');
        
        // Immediately update date sidebar submitted checkmarks
        if (selectedDate && !submittedDates.includes(selectedDate)) {
          setSubmittedDates(prev => [...prev, selectedDate]);
        }
        fetchSubmittedDates(selectedUserId);

        // Cache persistent basic details in localStorage for next time
        if (selectedUserId && employeeShiftDetails) {
          const { date, ...persistent } = employeeShiftDetails;
          localStorage.setItem(`cachedBasicDetails_ShiftReport_${selectedUserId}`, JSON.stringify(persistent));
        }

        // Refresh history drawer if opened
        if (historyDrawerOpen) {
          fetchHistory();
        }
      } else {
        showToast(data.message || 'Failed to save shift report', 'error');
      }
    } catch (err) {
      console.error('Error saving shift report:', err);
      showToast('Server error. Failed to save report.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Export PDF Handler matching KOD.BRAND official styling
  const handleDownloadPDF = async () => {
    // Automatically save report to database of that user when downloading
    await handleSaveReport();

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let currentY = 15;

      const checkNewPage = (needed = 25) => {
        if (currentY + needed > 270) {
          doc.addPage();
          currentY = 15;
        }
      };

      const drawSectionHeader = (title, neededSpace = 25) => {
        checkNewPage(neededSpace);
        doc.setFillColor(30, 41, 59); // Slate-800
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      // Header Brand Logo
      const logoImg = new Image();
      logoImg.src = '/logo3.png';
      await new Promise((resolve) => {
        logoImg.onload = () => {
          doc.addImage(logoImg, 'PNG', 14, 10, 32, 12);
          resolve();
        };
        logoImg.onerror = () => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(20);
          doc.setTextColor(30, 41, 59);
          doc.text("KOD.BRAND", 14, 20);
          resolve();
        };
      });

      // Title
      const reportTitleText = isAcademicCounselor ? "ACADEMIC COUNSELOR DAILY SHIFT REPORT" : "DAILY SHIFT REPORT";
      doc.setFontSize(isAcademicCounselor ? 12.5 : 14);
      doc.setTextColor(30, 41, 59);
      doc.text(reportTitleText, isAcademicCounselor ? 70 : 100, 17);

      currentY = 24;

      // 1. BASIC DETAILS
      if (!hiddenSections.employeeShiftDetails) {
        drawSectionHeader("1. EMPLOYEE & SHIFT DETAILS", 45);
        const detailsRows = [
          ["Date", employeeShiftDetails.date || selectedDate],
          ["Employee Name", employeeShiftDetails.employeeName || ''],
          ["Employee ID", employeeShiftDetails.employeeId || ''],
          ["Department", employeeShiftDetails.department || ''],
          ["Designation", employeeShiftDetails.designation || ''],
          ["Shift Timing", employeeShiftDetails.shiftTiming || ''],
          ["Reporting To", employeeShiftDetails.reportingTo || ''],
          ["Work Mode", employeeShiftDetails.workMode || 'Office']
        ];

        autoTable(doc, {
          body: detailsRows,
          startY: currentY,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 45 },
            1: { width: 137 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 2. TODAY'S PLAN VS ACHIEVEMENT
      if (!hiddenSections.planVsAchievement) {
        drawSectionHeader("2. TODAY'S PLAN VS ACHIEVEMENT", 35);
        const summaryHeaders = [["Task / Activity", "Target", "Actual", "Status", "Remarks"]];
        const summaryRows = [];
        const projectGroups = getProjectGroups(planVsAchievement);

        projectGroups.forEach(group => {
          group.rows.forEach((t, gIdx) => {
            if (gIdx === 0) {
              summaryRows.push([
                { content: group.projectName || t.taskActivity || '', rowSpan: group.rows.length },
                t.targetToday || '',
                t.actualOutput || '',
                t.status || '',
                t.businessResultRemarks || ''
              ]);
            } else {
              summaryRows.push([
                t.targetToday || '',
                t.actualOutput || '',
                t.status || '',
                t.businessResultRemarks || ''
              ]);
            }
          });
        });

        autoTable(doc, {
          head: summaryHeaders,
          body: summaryRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15, overflow: 'linebreak' },
          columnStyles: {
            0: { width: 35 },
            1: { width: 55 },
            2: { width: 32 },
            3: { width: 22, halign: 'center' },
            4: { width: 38 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 2B. STUDENT LEADS UPDATE (FOR COUNSELORS)
      if (isAcademicCounselor && !hiddenSections.studentLeadsUpdate) {
        drawSectionHeader("2B. STUDENT LEADS UPDATE", 35);
        const studentHeaders = [["Activity", "Count", "Remarks"]];
        const studentRows = (studentLeadsUpdate || []).map(t => [
          t.activity || '',
          t.count || '',
          t.remarks || ''
        ]);

        autoTable(doc, {
          head: studentHeaders,
          body: studentRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [49, 46, 129], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { width: 75 },
            1: { width: 25, halign: 'center' },
            2: { width: 82 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 2C. CLIENT LEADS UPDATE (FOR COUNSELORS)
      if (isAcademicCounselor && !hiddenSections.clientLeadsUpdate) {
        drawSectionHeader("2C. CLIENT LEADS UPDATE", 35);
        const clientHeaders = [["Activity", "Count", "Remarks"]];
        const clientRows = (clientLeadsUpdate || []).map(t => [
          t.activity || '',
          t.count || '',
          t.remarks || ''
        ]);

        autoTable(doc, {
          head: clientHeaders,
          body: clientRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { width: 75 },
            1: { width: 25, halign: 'center' },
            2: { width: 82 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 3. DEPARTMENT-SPECIFIC KEY METRICS
      if (!hiddenSections.departmentKeyMetrics) {
        drawSectionHeader("3. DEPARTMENT-SPECIFIC KEY METRICS");
        const metricHeaders = [["Metric / KPI", "Target", "Actual", "Achievement %", "Remarks"]];
        const metricRows = departmentKeyMetrics.map(m => [
          m.metricKpi || '',
          m.target || '',
          m.actual || '',
          m.achievementPct || '',
          m.remarks || ''
        ]);

        autoTable(doc, {
          head: metricHeaders,
          body: metricRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { width: 55 },
            1: { width: 25 },
            2: { width: 25 },
            3: { width: 25, halign: 'center' },
            4: { width: 52 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 4. EVIDENCE / ATTACHMENTS
      if (!hiddenSections.evidenceAttachments) {
        drawSectionHeader("4. EVIDENCE / ATTACHMENTS");
        const evHeaders = [["Work Item", "CRM Record / URL / File / Approval"]];
        const evRows = evidenceAttachments.map(e => [
          e.workItem || '',
          e.crmRecordUrlFileApproval || ''
        ]);

        autoTable(doc, {
          head: evHeaders,
          body: evRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { width: 60 },
            1: { width: 122 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 5. PENDING / BLOCKERS
      if (!hiddenSections.pendingBlockers) {
        drawSectionHeader("5. PENDING / BLOCKERS");
        const blockHeaders = [["Pending Task / Issue", "Reason / Blocker", "Owner", "Expected Completion"]];
        const blockRows = pendingBlockers.map(b => [
          b.pendingTaskIssue || '',
          b.reasonBlocker || '',
          b.owner || '',
          b.expectedCompletion || ''
        ]);

        autoTable(doc, {
          head: blockHeaders,
          body: blockRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { width: 55 },
            1: { width: 65 },
            2: { width: 30 },
            3: { width: 32 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 6. TOMORROW'S TOP PRIORITIES
      if (!hiddenSections.tomorrowPriorities) {
        drawSectionHeader("6. TOMORROW'S TOP PRIORITIES");
        const prioHeaders = [["#", "Priority Task / Objective"]];
        const prioRows = tomorrowPriorities.map((p, idx) => [
          `${idx + 1}`,
          p.priorityText || ''
        ]);

        autoTable(doc, {
          head: prioHeaders,
          body: prioRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { width: 12, halign: 'center', fontStyle: 'bold' },
            1: { width: 170 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 7. HANDOVER & FINAL CONFIRMATION
      if (!hiddenSections.handoverFinalConfirmation) {
        drawSectionHeader("7. HANDOVER & FINAL CONFIRMATION");
        const h = handoverFinalConfirmation;
        const confirmRows = [
          ["Handover Required?", h.handoverRequired || 'No'],
          ["Handover To", h.handoverTo || 'N/A'],
          ["CRM Updated?", h.crmUpdated || 'Yes'],
          ["Report Submitted?", h.reportSubmitted || 'Yes'],
          ["Employee Comments", h.employeeComment || '']
        ];

        autoTable(doc, {
          body: confirmRows,
          startY: currentY,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 45 },
            1: { width: 137 }
          },
          margin: { left: 14, right: 14 }
        });
      }

      const pdfBlob = doc.output('blob');
      const reportPrefix = isAcademicCounselor ? 'Academic_Counselor_Daily_Shift_Report' : 'Daily_Shift_Report';
      const filename = `${reportPrefix}_${(employeeShiftDetails.employeeName || 'Staff').replace(/[^a-zA-Z0-9_-]/g, '_')}_${selectedDate}.pdf`;

      try {
        const targetUserId = selectedUserId || currentUser._id || currentUser.id || localStorage.getItem('user_id') || '';
        if (targetUserId) {
          await uploadCompiledPDFReport(targetUserId, selectedDate, pdfBlob, filename, 'daily_shift', 'daily');
        }
      } catch (uploadErr) {
        console.error("Failed to upload compiled shift PDF to employee reports:", uploadErr);
      }

      doc.save(filename);
      showToast('Daily Shift Report submitted and saved to employee reports successfully!', 'success');
    } catch (e) {
      console.error('PDF generation error:', e);
      showToast('Failed to generate PDF.', 'error');
    }
  };

  // Helper for auto-bulleting lists on Enter key press in textareas
  const handleAutoListKeyDown = (e, currentValue, updateCallback) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const target = e.target;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const text = currentValue || '';

      const textBefore = text.substring(0, start);
      const textAfter = text.substring(end);

      const lastNewLine = textBefore.lastIndexOf('\n');
      const currentLine = lastNewLine === -1 ? textBefore : textBefore.substring(lastNewLine + 1);

      const bulletMatch = currentLine.match(/^(\s*)(•|-|\*)\s*(.*)/);

      if (bulletMatch) {
        const indent = bulletMatch[1];
        const lineText = bulletMatch[3];

        if (lineText.trim() === '') {
          e.preventDefault();
          const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
          const newText = text.substring(0, lineStart) + textAfter;
          updateCallback(newText);
          setTimeout(() => {
            target.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }

        e.preventDefault();
        const insertion = `\n${indent}• `;
        const newText = textBefore + insertion + textAfter;
        updateCallback(newText);
        const nextPos = start + insertion.length;
        setTimeout(() => {
          target.setSelectionRange(nextPos, nextPos);
        }, 0);
        return;
      }

      e.preventDefault();
      const insertion = '\n• ';
      const newText = textBefore + insertion + textAfter;
      updateCallback(newText);
      const nextPos = start + insertion.length;
      setTimeout(() => {
        target.setSelectionRange(nextPos, nextPos);
      }, 0);
    }
  };

  // Helper row handlers for Plan Vs Achievement (Project & Task grouping)
  const handlePlanChange = (index, field, value) => {
    setPlanVsAchievement(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleProjectNameChange = (group, newName) => {
    setPlanVsAchievement(prev => {
      const updated = [...prev];
      group.rows.forEach(r => {
        updated[r.originalIndex] = {
          ...updated[r.originalIndex],
          taskActivity: newName
        };
      });
      return updated;
    });
  };

  const addNewProject = () => {
    setPlanVsAchievement(prev => {
      const existingGroups = getProjectGroups(prev);
      const projectNum = existingGroups.length + 1;
      const newProjectName = `New Project ${projectNum}`;
      return [
        ...prev,
        { taskActivity: newProjectName, targetToday: '', actualOutput: '', status: 'Pending', businessResultRemarks: '' }
      ];
    });
  };

  const addTaskToProject = (projectName = '', insertAfterIndex = -1) => {
    setPlanVsAchievement(prev => {
      const updated = [...prev];
      let targetName = projectName;
      if (!targetName && updated.length > 0) {
        targetName = updated[updated.length - 1].taskActivity || '';
      }
      const newRow = {
        taskActivity: targetName,
        targetToday: '',
        actualOutput: '',
        status: 'Pending',
        businessResultRemarks: ''
      };

      if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0 && insertAfterIndex < updated.length) {
        updated.splice(insertAfterIndex + 1, 0, newRow);
      } else {
        updated.push(newRow);
      }
      return updated;
    });
  };

  const addPlanRow = () => {
    addTaskToProject();
  };

  const removePlanRow = (index) => {
    setPlanVsAchievement(prev => prev.filter((_, i) => i !== index));
  };

  const handleMetricChange = (index, field, value) => {
    setDepartmentKeyMetrics(prev => {
      const updated = [...prev];
      const curRow = { ...updated[index], [field]: value };

      if (field === 'target' || field === 'actual') {
        const targetNum = parseFloat(field === 'target' ? value : curRow.target);
        const actualNum = parseFloat(field === 'actual' ? value : curRow.actual);
        if (!isNaN(targetNum) && !isNaN(actualNum) && targetNum > 0) {
          curRow.achievementPct = `${Math.min(999, Math.round((actualNum / targetNum) * 100))}%`;
        }
      }

      updated[index] = curRow;
      return updated;
    });
  };

  const addMetricRow = () => {
    setDepartmentKeyMetrics(prev => [
      ...prev,
      { metricKpi: '', target: '', actual: '', achievementPct: '', remarks: '' }
    ]);
  };

  const removeMetricRow = (index) => {
    setDepartmentKeyMetrics(prev => prev.filter((_, i) => i !== index));
  };

  const handleEvidenceChange = (index, field, value) => {
    setEvidenceAttachments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addEvidenceRow = () => {
    setEvidenceAttachments(prev => [
      ...prev,
      { workItem: '', crmRecordUrlFileApproval: '' }
    ]);
  };

  const removeEvidenceRow = (index) => {
    setEvidenceAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleBlockerChange = (index, field, value) => {
    setPendingBlockers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addBlockerRow = () => {
    setPendingBlockers(prev => [
      ...prev,
      { pendingTaskIssue: '', reasonBlocker: '', owner: '', expectedCompletion: '' }
    ]);
  };

  const removeBlockerRow = (index) => {
    setPendingBlockers(prev => prev.filter((_, i) => i !== index));
  };

  const handlePriorityChange = (index, value) => {
    setTomorrowPriorities(prev => {
      const updated = [...prev];
      updated[index] = { priorityText: value };
      return updated;
    });
  };

  const addPriorityRow = () => {
    setTomorrowPriorities(prev => [...prev, { priorityText: '' }]);
  };

  const removePriorityRow = (index) => {
    setTomorrowPriorities(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0c10] p-4 lg:p-8 font-sans text-slate-800 dark:text-slate-200">
      
      <AiAnalyzeModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        contextData={aiModalContext}
        title="Daily Shift Report AI Analysis"
      />

      <div className="max-w-7xl mx-auto flex gap-6 items-start w-full relative flex-col lg:flex-row">
        {/* LEFT PANEL: Date Select Sidebar */}
        <div className={`transition-all duration-300 ease-in-out shrink-0 bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md rounded-3xl p-5 shadow-sm relative print:hidden ${
          isSidebarOpen 
            ? 'w-full lg:w-72 opacity-100 translate-x-0' 
            : 'w-0 lg:w-0 opacity-0 -translate-x-12 overflow-hidden p-0 border-none pointer-events-none'
        }`}>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Calendar size={14} className="text-indigo-500 dark:text-indigo-400" />
            Shift Report Log (Monthly)
          </h3>

          <div className="space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto pr-0.5 scrollbar-thin">
            {recentMonths.map(m => {
              const isExpanded = expandedMonth === m.monthKey;
              return (
                <div key={m.monthKey} className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => setExpandedMonth(isExpanded ? null : m.monthKey)}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between font-bold text-xs transition cursor-pointer ${
                      isExpanded 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className={isExpanded ? 'text-white' : 'text-indigo-500'} />
                      <span>{m.monthName}</span>
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="p-1.5 space-y-1 bg-white/70 dark:bg-slate-900/70 border-t border-slate-200/50 dark:border-slate-800/50 max-h-60 overflow-y-auto">
                      {m.dates.map(dateObj => {
                        const isSelected = selectedDate === dateObj.dateString;
                        const isSubmitted = submittedDates.includes(dateObj.dateString);
                        return (
                          <button
                            key={dateObj.dateString}
                            onClick={() => setSelectedDate(dateObj.dateString)}
                            className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className={`text-[10px] ${isSelected ? 'text-indigo-200 font-semibold' : 'text-slate-400'}`}>
                                {dateObj.dayName}
                              </span>
                              <span className="font-bold text-xs mt-0.5">
                                {dateObj.displayDate}
                              </span>
                            </div>
                            {isSubmitted && (
                              <CheckCircle size={13} className={isSelected ? 'text-white' : 'text-emerald-500'} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN REPORT CONTENT CONTAINER */}
        <div className="flex-1 min-w-0 w-full space-y-4">

          {/* MINIMAL ACTION TOOLBAR */}
          <div className="w-full print:hidden flex flex-wrap items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md py-2 px-3.5 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">Daily Shift Report</h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* User Selector Dropdown for Privileged Roles */}
              {isPrivileged && staffList.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700/70 text-xs">
                  <User size={13} className="text-slate-500" />
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="bg-transparent font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer text-xs"
                  >
                    {staffList.map((u) => (
                      <option key={u._id || u.id} value={u._id || u.id}>
                        {u.name} ({u.employeeId || 'EMP'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSidebarOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Calendar size={14} />
                <span>Dates</span>
              </button>

              <button
                onClick={toggleHistory}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                <History size={14} className="text-indigo-500" />
                <span>History</span>
              </button>

              <button
                onClick={() => navigate('/weekly-performance-report')}
                className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-extrabold rounded-lg shadow-xs transition-all cursor-pointer"
                title="Open 7-Day Weekly Performance & MD Review Report"
              >
                <Award size={14} />
                <span>Weekly Report</span>
              </button>

              <button
                onClick={() => navigate('/monthly-performance-report')}
                className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-extrabold rounded-lg shadow-xs transition-all cursor-pointer"
                title="Open Monthly Performance Report"
              >
                <Calendar size={14} />
                <span>Monthly Report</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Saves report to system, downloads PDF to your computer, and uploads to Employee Reports"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Submit & Save Report</span>
              </button>
            </div>
          </div>

          {/* Excluded Sections Banner */}
          {Object.values(hiddenSections).some(Boolean) && (
            <div className="w-full mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center justify-between flex-wrap gap-2">
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

          {/* PRINTABLE DOCUMENT CARD (Matching exact KOD.BRAND paper design) */}
          <div className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-xl p-6 lg:p-10 space-y-6 print:shadow-none print:border-none print:p-0">

        {/* LOGO & TITLE HEADER */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-slate-900 dark:border-slate-700 pb-5 gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo3.png" alt="KOD.BRAND Logo" className="h-12 sm:h-14 w-auto object-contain" />
          </div>

          <div className="text-right sm:text-right text-center">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              DAILY SHIFT REPORT
            </h1>
          </div>
        </div>

        {/* SECTION 1: EMPLOYEE & SHIFT DETAILS */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider">EMPLOYEE & SHIFT DETAILS</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingBasic(!isEditingBasic)}
              className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white font-bold transition-all cursor-pointer"
            >
              {isEditingBasic ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-400" /> Done
                </>
              ) : (
                <>
                  <Pencil size={14} /> Edit
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <DetailField label="Date" value={employeeShiftDetails.date || selectedDate} onChange={(v) => setEmployeeShiftDetails(prev => ({ ...prev, date: v }))} isEditing={isEditingBasic} />
            <DetailField label="Employee Name" value={employeeShiftDetails.employeeName || ''} onChange={(v) => setEmployeeShiftDetails(prev => ({ ...prev, employeeName: v }))} isEditing={isEditingBasic} />
            <DetailField label="Employee ID" value={employeeShiftDetails.employeeId || ''} onChange={(v) => setEmployeeShiftDetails(prev => ({ ...prev, employeeId: v }))} isEditing={isEditingBasic} />
            <DetailField label="Department" value={employeeShiftDetails.department || ''} onChange={(v) => setEmployeeShiftDetails(prev => ({ ...prev, department: v }))} isEditing={isEditingBasic} />
            <DetailField label="Designation" value={employeeShiftDetails.designation || ''} onChange={(v) => setEmployeeShiftDetails(prev => ({ ...prev, designation: v }))} isEditing={isEditingBasic} />
            <DetailField label="Reporting To" value={employeeShiftDetails.reportingTo || ''} onChange={(v) => setEmployeeShiftDetails(prev => ({ ...prev, reportingTo: v }))} isEditing={isEditingBasic} />
            <DetailField label="Shift Timing" value={employeeShiftDetails.shiftTiming || ''} onChange={(v) => setEmployeeShiftDetails(prev => ({ ...prev, shiftTiming: v }))} isEditing={isEditingBasic} />

            <div className="flex items-center gap-3">
              <span className="w-28 font-bold text-slate-600 dark:text-slate-400 shrink-0">Work Mode</span>
              <span className="font-bold text-slate-400">:</span>
              <select
                value={employeeShiftDetails.workMode || 'Office'}
                onChange={(e) => setEmployeeShiftDetails(prev => ({ ...prev, workMode: e.target.value }))}
                disabled={!isEditingBasic}
                className={`flex-1 border rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  isEditingBasic
                    ? 'bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-500 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <option value="Office">Office</option>
                <option value="WFH">WFH</option>
                <option value="Field">Field</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: TODAY'S PLAN VS ACHIEVEMENT */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <SectionHeader number="2" title="TODAY'S PLAN VS ACHIEVEMENT" />
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => toggleSectionHidden('planVsAchievement')}
                className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
              >
                <MinusCircle size={14} /> Exclude
              </button>
            </div>
          </div>

          {!hiddenSections.planVsAchievement && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-36 sm:w-44">Task / Activity (Project Name)</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-44 sm:w-52">Target Today</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-28">Actual Output</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-28">Status</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-44">Business Result / Remarks</th>
                    <th className="p-2.5 text-center w-28 print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="border-t border-slate-200 dark:border-slate-800">
                  {getProjectGroups(planVsAchievement).map((group) => {
                    return group.rows.map((row, rowInGroupIdx) => {
                      const idx = row.originalIndex;
                      const isFirstInGroup = rowInGroupIdx === 0;
                      const isLastInGroup = rowInGroupIdx === group.rows.length - 1;

                      return (
                        <tr 
                          key={idx} 
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                            isLastInGroup ? 'border-b border-slate-200 dark:border-slate-700' : 'border-b border-slate-100/60 dark:border-slate-800/40'
                          }`}
                        >
                          {isFirstInGroup && (
                            <td 
                              rowSpan={group.rows.length} 
                              className="p-2.5 border-r border-slate-200 dark:border-slate-800 align-top bg-slate-50/40 dark:bg-slate-900/40 font-bold"
                            >
                              <textarea
                                rows={Math.max(2, group.rows.length * 2)}
                                placeholder="Project Name..."
                                value={group.projectName || row.taskActivity || ''}
                                onChange={(e) => handleProjectNameChange(group, e.target.value)}
                                className="w-full bg-transparent font-bold border-none focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs resize-y"
                              />
                            </td>
                          )}
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                            <textarea
                              rows={2}
                              placeholder="Tasks list..."
                              value={row.targetToday || ''}
                              onKeyDown={(e) => handleAutoListKeyDown(e, row.targetToday, (val) => handlePlanChange(idx, 'targetToday', val))}
                              onChange={(e) => handlePlanChange(idx, 'targetToday', e.target.value)}
                              className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 text-xs resize-y min-h-[40px]"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                            <textarea
                              rows={2}
                              placeholder="Actual output..."
                              value={row.actualOutput || ''}
                              onKeyDown={(e) => handleAutoListKeyDown(e, row.actualOutput, (val) => handlePlanChange(idx, 'actualOutput', val))}
                              onChange={(e) => handlePlanChange(idx, 'actualOutput', e.target.value)}
                              className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 text-xs resize-y min-h-[40px]"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                            <select
                              value={row.status || 'Pending'}
                              onChange={(e) => handlePlanChange(idx, 'status', e.target.value)}
                              className="w-full bg-transparent font-bold border-none focus:outline-none text-xs text-indigo-600 dark:text-indigo-400 cursor-pointer"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Current">Current</option>
                              <option value="Preview">Preview</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                            <textarea
                              rows={2}
                              placeholder="Remarks / outcome..."
                              value={row.businessResultRemarks || ''}
                              onKeyDown={(e) => handleAutoListKeyDown(e, row.businessResultRemarks, (val) => handlePlanChange(idx, 'businessResultRemarks', val))}
                              onChange={(e) => handlePlanChange(idx, 'businessResultRemarks', e.target.value)}
                              className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 text-xs resize-y min-h-[40px]"
                            />
                          </td>
                          <td className="p-2 text-center print:hidden align-top whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => addTaskToProject(group.projectName || row.taskActivity, idx)}
                                className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all cursor-pointer shadow-2xs"
                                title={`Add target under ${group.projectName || 'this project'}`}
                              >
                                <Plus size={10} /> + Add Target
                              </button>
                              <button
                                type="button"
                                onClick={() => removePlanRow(idx)}
                                className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                                title="Delete row"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!hiddenSections.planVsAchievement && (
            <div className="mt-2.5 print:hidden">
              <button
                type="button"
                onClick={addNewProject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <PlusCircle size={14} /> + Add Project
              </button>
            </div>
          )}
        </div>

        {/* COUNSELOR LEAD INTELLIGENCE (STUDENT & CLIENT LEADS UPDATE - STRICTLY FOR COUNSELORS) */}
        {isAcademicCounselor && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-emerald-50/50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-emerald-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shadow-xs">
              <div>
                <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Academic Counselor Lead Intelligence Updates
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Daily tracking metrics for student course counseling & corporate client lead pipelines.
                </p>
              </div>
              <button
                type="button"
                onClick={() => autoFetchLeadStats(selectedDate, true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs shadow-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer shrink-0"
              >
                <RefreshCw size={13} /> Auto-Fetch CRM Leads
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* STUDENT LEADS UPDATE TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    Student Leads Update
                  </h4>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('studentLeadsUpdate')}
                    className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Exclude
                  </button>
                </div>
                {!hiddenSections.studentLeadsUpdate && (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                          <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-[50%]">Activity</th>
                          <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-center w-20">Count</th>
                          <th className="p-2.5">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {studentLeadsUpdate.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">{item.activity}</td>
                            <td className="p-2 text-center border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="text"
                                value={item.count || ''}
                                onChange={(e) => {
                                  const updated = [...studentLeadsUpdate];
                                  updated[index].count = e.target.value;
                                  setStudentLeadsUpdate(updated);
                                }}
                                placeholder="-"
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-900 dark:text-slate-100 font-extrabold"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={(e) => {
                                  const updated = [...studentLeadsUpdate];
                                  updated[index].remarks = e.target.value;
                                  setStudentLeadsUpdate(updated);
                                }}
                                placeholder="Remarks..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-200"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* CLIENT LEADS UPDATE TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Client Leads Update
                  </h4>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('clientLeadsUpdate')}
                    className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Exclude
                  </button>
                </div>
                {!hiddenSections.clientLeadsUpdate && (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                          <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-[50%]">Activity</th>
                          <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-center w-20">Count</th>
                          <th className="p-2.5">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {clientLeadsUpdate.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">{item.activity}</td>
                            <td className="p-2 text-center border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="text"
                                value={item.count || ''}
                                onChange={(e) => {
                                  const updated = [...clientLeadsUpdate];
                                  updated[index].count = e.target.value;
                                  setClientLeadsUpdate(updated);
                                }}
                                placeholder="-"
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-900 dark:text-slate-100 font-extrabold"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={(e) => {
                                  const updated = [...clientLeadsUpdate];
                                  updated[index].remarks = e.target.value;
                                  setClientLeadsUpdate(updated);
                                }}
                                placeholder="Remarks..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-200"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: DEPARTMENT-SPECIFIC KEY METRICS */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <SectionHeader number="3" title="DEPARTMENT-SPECIFIC KEY METRICS" />
            <button
              type="button"
              onClick={() => toggleSectionHidden('departmentKeyMetrics')}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer mb-3"
            >
              <MinusCircle size={14} /> Exclude
            </button>
          </div>

          {!hiddenSections.departmentKeyMetrics && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700">Metric / KPI</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-24">Target</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-24">Actual</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-28 text-center">Achievement %</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700">Remarks</th>
                    <th className="p-2.5 text-center w-10 print:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {departmentKeyMetrics.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="e.g. Calls, Leads, Code Commits..."
                          value={row.metricKpi || ''}
                          onChange={(e) => handleMetricChange(idx, 'metricKpi', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="0"
                          value={row.target || ''}
                          onChange={(e) => handleMetricChange(idx, 'target', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="0"
                          value={row.actual || ''}
                          onChange={(e) => handleMetricChange(idx, 'actual', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-indigo-600 dark:text-indigo-400">
                        <input
                          type="text"
                          placeholder="0%"
                          value={row.achievementPct || ''}
                          onChange={(e) => handleMetricChange(idx, 'achievementPct', e.target.value)}
                          className="w-full bg-transparent text-center font-extrabold border-none focus:outline-none text-indigo-600 dark:text-indigo-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Remarks"
                          value={row.remarks || ''}
                          onChange={(e) => handleMetricChange(idx, 'remarks', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 text-center print:hidden">
                        <button
                          onClick={() => removeMetricRow(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!hiddenSections.departmentKeyMetrics && (
            <button
              onClick={addMetricRow}
              className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline print:hidden cursor-pointer"
            >
              <Plus size={14} /> Add Metric
            </button>
          )}
        </div>

        {/* SECTION 4: EVIDENCE / ATTACHMENTS */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <SectionHeader number="4" title="EVIDENCE / ATTACHMENTS" />
            <button
              type="button"
              onClick={() => toggleSectionHidden('evidenceAttachments')}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer mb-3"
            >
              <MinusCircle size={14} /> Exclude
            </button>
          </div>

          {!hiddenSections.evidenceAttachments && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-1/3">Work Item</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700">CRM Record / URL / File / Approval</th>
                    <th className="p-2.5 text-center w-10 print:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {evidenceAttachments.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Work item description..."
                          value={row.workItem || ''}
                          onChange={(e) => handleEvidenceChange(idx, 'workItem', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Paste link, CRM ID, or attachment note..."
                          value={row.crmRecordUrlFileApproval || ''}
                          onChange={(e) => handleEvidenceChange(idx, 'crmRecordUrlFileApproval', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 text-center print:hidden">
                        <button
                          onClick={() => removeEvidenceRow(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!hiddenSections.evidenceAttachments && (
            <button
              onClick={addEvidenceRow}
              className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline print:hidden cursor-pointer"
            >
              <Plus size={14} /> Add Attachment / Evidence
            </button>
          )}
        </div>

        {/* SECTION 5: PENDING / BLOCKERS */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <SectionHeader number="5" title="PENDING / BLOCKERS" />
            <button
              type="button"
              onClick={() => toggleSectionHidden('pendingBlockers')}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer mb-3"
            >
              <MinusCircle size={14} /> Exclude
            </button>
          </div>

          {!hiddenSections.pendingBlockers && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700">Pending Task / Issue</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700">Reason / Blocker</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-32">Owner</th>
                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-36">Expected Completion</th>
                    <th className="p-2.5 text-center w-10 print:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pendingBlockers.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Pending issue..."
                          value={row.pendingTaskIssue || ''}
                          onChange={(e) => handleBlockerChange(idx, 'pendingTaskIssue', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Reason for blocker..."
                          value={row.reasonBlocker || ''}
                          onChange={(e) => handleBlockerChange(idx, 'reasonBlocker', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Owner"
                          value={row.owner || ''}
                          onChange={(e) => handleBlockerChange(idx, 'owner', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Target Date"
                          value={row.expectedCompletion || ''}
                          onChange={(e) => handleBlockerChange(idx, 'expectedCompletion', e.target.value)}
                          className="w-full bg-transparent font-medium border-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="p-2 text-center print:hidden">
                        <button
                          onClick={() => removeBlockerRow(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!hiddenSections.pendingBlockers && (
            <button
              onClick={addBlockerRow}
              className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline print:hidden cursor-pointer"
            >
              <Plus size={14} /> Add Blocker
            </button>
          )}
        </div>

        {/* SECTION 6: TOMORROW'S TOP PRIORITIES */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <SectionHeader number="6" title="TOMORROW'S TOP PRIORITIES" />
            <button
              type="button"
              onClick={() => toggleSectionHidden('tomorrowPriorities')}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer mb-3"
            >
              <MinusCircle size={14} /> Exclude
            </button>
          </div>

          {!hiddenSections.tomorrowPriorities && (
            <div className="space-y-2">
              {tomorrowPriorities.map((row, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    placeholder={`Priority #${idx + 1}...`}
                    value={row.priorityText || ''}
                    onChange={(e) => handlePriorityChange(idx, e.target.value)}
                    className="flex-1 bg-transparent font-medium border-none focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => removePriorityRow(idx)}
                    className="text-slate-400 hover:text-rose-500 p-1 transition-colors print:hidden"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={addPriorityRow}
                className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline print:hidden cursor-pointer"
              >
                <Plus size={14} /> Add Priority
              </button>
            </div>
          )}
        </div>

        {/* SECTION 7: HANDOVER & FINAL CONFIRMATION */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <SectionHeader number="7" title="HANDOVER & FINAL CONFIRMATION" />
            <button
              type="button"
              onClick={() => toggleSectionHidden('handoverFinalConfirmation')}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer mb-3"
            >
              <MinusCircle size={14} /> Exclude
            </button>
          </div>

          {!hiddenSections.handoverFinalConfirmation && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-600 dark:text-slate-400 w-36">Handover Required?</span>
                  <select
                    value={handoverFinalConfirmation.handoverRequired || 'No'}
                    onChange={(e) => setHandoverFinalConfirmation(prev => ({ ...prev, handoverRequired: e.target.value }))}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                {handoverFinalConfirmation.handoverRequired === 'Yes' && (
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-600 dark:text-slate-400 w-28">Handover To</span>
                    <input
                      type="text"
                      placeholder="Colleague name..."
                      value={handoverFinalConfirmation.handoverTo || ''}
                      onChange={(e) => setHandoverFinalConfirmation(prev => ({ ...prev, handoverTo: e.target.value }))}
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-600 dark:text-slate-400 w-36">CRM Updated?</span>
                  <select
                    value={handoverFinalConfirmation.crmUpdated || 'Yes'}
                    onChange={(e) => setHandoverFinalConfirmation(prev => ({ ...prev, crmUpdated: e.target.value }))}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-600 dark:text-slate-400 w-36">Report Submitted?</span>
                  <select
                    value={handoverFinalConfirmation.reportSubmitted || 'Yes'}
                    onChange={(e) => setHandoverFinalConfirmation(prev => ({ ...prev, reportSubmitted: e.target.value }))}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1.5">Employee Shift Comments / End Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes, key wins, or shift comments..."
                  value={handoverFinalConfirmation.employeeComment || ''}
                  onChange={(e) => setHandoverFinalConfirmation(prev => ({ ...prev, employeeComment: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="font-bold text-slate-600 dark:text-slate-400 mb-2">Employee Signature</p>
                <SignatureUpload
                  value={handoverFinalConfirmation.signature}
                  onChange={(val) => setHandoverFinalConfirmation(prev => ({ ...prev, signature: val }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER BRANDING */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-center space-y-1">
          <p className="text-xs font-black tracking-widest text-slate-400 uppercase">KOD.BRAND • TURN WORK INTO PROGRESS</p>
          <p className="text-[10px] text-slate-400">Confidential Internal Daily Operations & Shift Log</p>
        </div>

      </div>

      {/* BOTTOM ACTION TOOLBAR */}
      <div className="w-full print:hidden flex flex-wrap items-center justify-between sm:justify-end gap-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md py-3 px-5 rounded-2xl shadow-md">
        <button
          type="button"
          onClick={handleSaveReport}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-slate-700"
        >
          {saving ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Save size={14} className="text-indigo-500" />}
          <span>Save Report</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={saving}
          className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          <span>Submit & Export PDF</span>
        </button>
      </div>

    </div>
  </div>

      {/* HISTORY DRAWER */}
      {historyDrawerOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <History className="text-indigo-600" size={20} />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">Report History</h3>
              </div>
              <button onClick={() => setHistoryDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
              </div>
            ) : pastReports.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">No submitted reports found.</p>
            ) : (
              <div className="space-y-3">
                {pastReports.map((r) => (
                  <div
                    key={r._id}
                    onClick={() => {
                      setSelectedDate(r.dateString);
                      setHistoryDrawerOpen(false);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedDate === r.dateString
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{r.dateString}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {r.status || 'Submitted'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Shift: {r.employeeShiftDetails?.shiftTiming || '09:30 AM - 06:30 PM'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// Detail Field item matching key: value layout with read-only/edit support
const DetailField = ({ label, value, onChange, isEditing }) => (
  <div className="flex items-center gap-3">
    <span className="w-28 font-bold text-slate-600 dark:text-slate-400 shrink-0">{label}</span>
    <span className="font-bold text-slate-400">:</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={!isEditing}
      className={`flex-1 border rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
        isEditing
          ? 'bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-500 text-slate-800 dark:text-slate-100 shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500'
          : 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none'
      }`}
    />
  </div>
);

// Section Header Banner matching grey headers
const SectionHeader = ({ number, title }) => (
  <div className="flex items-center gap-2.5 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg mb-3 shadow-xs">
    <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">
      {number}
    </span>
    <h2 className="text-xs font-black uppercase tracking-wider">{title}</h2>
  </div>
);

export default DailyShiftReportPage;
