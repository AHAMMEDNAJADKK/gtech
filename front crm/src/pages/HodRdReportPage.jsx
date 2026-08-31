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
import { fetchCompletedTasks, fetchDelegatedTasks } from '../utils/taskUtils';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const isRowEmpty = (item) => {
  if (!item || typeof item !== 'object') return true;
  const skipKeys = new Set(['_id', 'id', '__v']);
  return !Object.entries(item).some(([k, v]) => {
    if (skipKeys.has(k)) return false;
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
};

// Default items for Daily Task Summary
const DEFAULT_TASK_SUMMARY = [
  { activity: '', status: '', dueDate: '', startDate: '', endDate: '', remarks: '' }
];

// Default items for Development Work Report
const DEFAULT_DEV_REPORT = [
  { project: '', activity: '', status: '', remark: '' },
  { project: '', activity: '', status: '', remark: '' }
];

// Default items for KPI Tracking
const DEFAULT_KPI_TRACKING = [
  { project: '', kpi: ' ', target: '', achieved: '' },
  { project: '', kpi: '', target: '', achieved: '' },
  { project: '', kpi: '', target: '', achieved: '' }
];

// Default items for Issues/Support Required
const DEFAULT_ISSUES = [
  { issue: '', priority: '', actionTaken: '' },
  { issue: '', priority: '', actionTaken: '' }
];

const HodRdReportPage = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [isPrivileged, setIsPrivileged] = useState(false);
  
  // Selection state
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
  const [hods, setHods] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);
  
  // Form State
  const [basicDetails, setBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: 'R&D/ Development',
    designation: 'HOD-R&D Software & Web Developer',
    shiftTiming: '9:00 AM - 5:00 PM',
    reportingTo: 'Manager - OPS Creative & Marketing',
    preparedTime: ''
  });
  
  const [dailyTaskSummary, setDailyTaskSummary] = useState(DEFAULT_TASK_SUMMARY);
  const [selectedActivityText, setSelectedActivityText] = useState(null);
  const [developmentWorkReport, setDevelopmentWorkReport] = useState(DEFAULT_DEV_REPORT);
  const [rdInnovationReport, setRdInnovationReport] = useState([{ activity: '', details: '', dueDate: '', status: '' }]);
  const [kpiTracking, setKpiTracking] = useState(DEFAULT_KPI_TRACKING);
  const [issuesSupportRequired, setIssuesSupportRequired] = useState(DEFAULT_ISSUES);
  const [nextDayPlanning, setNextDayPlanning] = useState('');
  const [hodComments, setHodComments] = useState('');
  const [approval, setApproval] = useState({
    hodName: 'HOD - R&D /Developer',
    hodSignature: '',
    hodDate: '',
    managerName: 'Manager - OPS Creative &Marketing',
    managerSignature: '',
    managerDate: ''
  });

  const [hiddenSections, setHiddenSections] = useState({});

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Weekly States
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [weeklyEndDate, setWeeklyEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [weeklyActiveTab, setWeeklyActiveTab] = useState('basic');

  const [weeklyBasicDetails, setWeeklyBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: 'R&D/ Development',
    designation: 'HOD-R&D Software & Web Developer',
    shiftTiming: '9:00 AM - 5:00 PM',
    reportingTo: 'Manager - OPS Creative & Marketing',
    preparedTime: ''
  });
  const [weeklyDailyTaskSummary, setWeeklyDailyTaskSummary] = useState([]);
  const [weeklyDevelopmentWorkReport, setWeeklyDevelopmentWorkReport] = useState([]);
  const [weeklyRdInnovationReport, setWeeklyRdInnovationReport] = useState([]);
  const [weeklyKpiTracking, setWeeklyKpiTracking] = useState([]);
  const [weeklyIssuesSupportRequired, setWeeklyIssuesSupportRequired] = useState([]);
  const [weeklyNextDayPlanning, setWeeklyNextDayPlanning] = useState('');
  const [weeklyHodComments, setWeeklyHodComments] = useState('');
  const [weeklyApproval, setWeeklyApproval] = useState({
    hodName: 'HOD - R&D /Developer',
    hodSignature: '',
    hodDate: '',
    managerName: 'Manager - OPS Creative &Marketing',
    managerSignature: '',
    managerDate: ''
  });

  const [weeklyAchievements, setWeeklyAchievements] = useState('');
  const [weeklyImprovements, setWeeklyImprovements] = useState('');
  const [weeklyNextWeekPlanning, setWeeklyNextWeekPlanning] = useState('');

  // Monthly States
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
  const [monthlyStartDate, setMonthlyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [monthlyEndDate, setMonthlyEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [monthlyActiveTab, setMonthlyActiveTab] = useState('basic');

  const [monthlyBasicDetails, setMonthlyBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: 'R&D/ Development',
    designation: 'HOD-R&D Software & Web Developer',
    shiftTiming: '9:00 AM - 5:00 PM',
    reportingTo: 'Manager - OPS Creative & Marketing',
    preparedTime: ''
  });
  const [monthlyDailyTaskSummary, setMonthlyDailyTaskSummary] = useState([]);
  const [monthlyDevelopmentWorkReport, setMonthlyDevelopmentWorkReport] = useState([]);
  const [monthlyRdInnovationReport, setMonthlyRdInnovationReport] = useState([]);
  const [monthlyKpiTracking, setMonthlyKpiTracking] = useState([]);
  const [monthlyIssuesSupportRequired, setMonthlyIssuesSupportRequired] = useState([]);
  const [monthlyNextDayPlanning, setMonthlyNextDayPlanning] = useState('');
  const [monthlyHodComments, setMonthlyHodComments] = useState('');
  const [monthlyApproval, setMonthlyApproval] = useState({
    hodName: 'HOD - R&D /Developer',
    hodSignature: '',
    hodDate: '',
    managerName: 'Manager - OPS Creative &Marketing',
    managerSignature: '',
    managerDate: ''
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

  // Helper for auto-bulleting & numbering lists on Enter key press in activity textareas
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
      const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s*(.*)/);

      if (numberMatch) {
        const indent = numberMatch[1];
        const num = parseInt(numberMatch[2], 10);
        const lineText = numberMatch[3];

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
        const nextNum = num + 1;
        const insertion = `\n${indent}${nextNum}. `;
        const newText = textBefore + insertion + textAfter;
        updateCallback(newText);
        const nextPos = start + insertion.length;
        setTimeout(() => {
          target.setSelectionRange(nextPos, nextPos);
        }, 0);
        return;
      }

      if (bulletMatch) {
        const indent = bulletMatch[1];
        const bulletChar = bulletMatch[2];
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
        const nextBullet = bulletChar === '*' ? '•' : bulletChar;
        const insertion = `\n${indent}${nextBullet} `;
        const newText = textBefore + insertion + textAfter;
        updateCallback(newText);
        const nextPos = start + insertion.length;
        setTimeout(() => {
          target.setSelectionRange(nextPos, nextPos);
        }, 0);
        return;
      }

      if (text.trim() === '') {
        e.preventDefault();
        const newText = '• ';
        updateCallback(newText);
        setTimeout(() => {
          target.setSelectionRange(2, 2);
        }, 0);
        return;
      }

      if (!textBefore.includes('• ') && !textBefore.includes('- ') && !/^\s*\d+\.\s/.test(currentLine)) {
        e.preventDefault();
        const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
        const lineContentBefore = textBefore.substring(lineStart);
        const newText = text.substring(0, lineStart) + '• ' + lineContentBefore + '\n• ' + textAfter;
        updateCallback(newText);
        const nextPos = start + 5;
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

  // Initialize user information
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
    } catch (err) {
      console.error("Failed to parse user session details:", err);
    }
  }, []);

  // Fetch HODs list (for HR/Admins)
  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

  useEffect(() => {
    if (isPrivileged) {
      const fetchHods = async () => {
        try {
          const res = await fetch(`${API_BASE}/v1/hod-rd-reports/hods`, {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setHods(data.data);
            if (data.data.length > 0 && !selectedUserId) {
              setSelectedUserId(data.data[0]._id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch HODs list:", e);
        }
      };
      fetchHods();
    }
  }, [isPrivileged, getAuthHeaders, selectedUserId]);

  // Fetch submitted report dates list for highlighting
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/hod-rd-reports/submitted-dates?userId=${userId}`, {
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

  // Trigger submitted dates reload on user selection change
  useEffect(() => {
    if (selectedUserId) {
      fetchSubmittedDates(selectedUserId);
    }
  }, [selectedUserId, fetchSubmittedDates]);

  // Fetch report data for selected date and user
  const fetchReport = async (userId, dateStr) => {
    if (!userId || !dateStr) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/v1/hod-rd-reports/by-date?userId=${userId}&dateString=${dateStr}`, {
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

        setDailyTaskSummary(report.dailyTaskSummary || []);
        setDevelopmentWorkReport(report.developmentWorkReport || []);
        setRdInnovationReport(report.rdInnovationReport || []);
        setKpiTracking(report.kpiTracking || []);
        setIssuesSupportRequired(report.issuesSupportRequired || []);
        setNextDayPlanning(report.nextDayPlanning || '');
        setHodComments(report.hodComments || '');
        setApproval(report.approval || {});
      } else {
        // Initialize default blank report
        initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({
              activity: t.title,
              status: t.status === 'In Progress' ? 'ongoing' : (t.status || 'Done'),
              dueDate: t.dueDate || '',
              startDate: t.startDate || t.startTime || t.startDateTimeLocal || '',
              endDate: t.endDate || t.endTime || t.endDateTimeLocal || '',
              remarks: t.description || 'Auto-fetched'
            }));
            setDailyTaskSummary(mappedTasks);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
        }
        
        try {
          const delegatedTasks = await fetchDelegatedTasks(userId, dateStr, hods);
          if (delegatedTasks && delegatedTasks.length > 0) {
            setKpiTracking(delegatedTasks);
          }
        } catch(e) {
          console.error("Error auto-fetching delegated tasks:", e);
        }

      }
    } catch (err) {
      // In case of 404 or other errors, fallback to initializing default blank report
      initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({
              activity: t.title,
              status: t.status === 'In Progress' ? 'ongoing' : (t.status || 'Done'),
              dueDate: t.dueDate || '',
              startDate: t.startDate || t.startTime || t.startDateTimeLocal || '',
              endDate: t.endDate || t.endTime || t.endDateTimeLocal || '',
              remarks: t.description || 'Auto-fetched'
            }));
            setDailyTaskSummary(mappedTasks);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
        }
        
        try {
          const delegatedTasks = await fetchDelegatedTasks(userId, dateStr, hods);
          if (delegatedTasks && delegatedTasks.length > 0) {
            setKpiTracking(delegatedTasks);
          }
        } catch(e) {
          console.error("Error auto-fetching delegated tasks:", e);
        }

    } finally {
      setLoading(false);
    }
  };

  // Load report when selection changes
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
        localStorage.setItem(`cachedBasicDetails_HodRd_${selectedUserId}`, JSON.stringify(persistent));
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
    if (isPrivileged && hods.length > 0) {
      userDetail = hods.find(d => (d._id || d.id) === userId) || freshestUser;
    }

    const dateObj = new Date(dateStr);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDateString = dateObj.toLocaleDateString('en-GB').replace(/\//g, '-'); // DD-MM-YYYY

    // Prefill time to current time
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    const timeStr = hours + ':' + minutes + ' ' + ampm;

    // Load from cache if exists
    const cached = localStorage.getItem(`cachedBasicDetails_HodRd_${userId}`);
    const parsedCached = cached ? JSON.parse(cached) : null;

    setBasicDetails({
      date: formattedDateString,
      day: dayName,
      employeeName: userDetail.name || parsedCached?.employeeName || '',
      employeeId: userDetail.employeeId || parsedCached?.employeeId || '',
      department: userDetail.department || parsedCached?.department || 'R&D/ Development',
      designation: userDetail.designationName || userDetail.designation || parsedCached?.designation || 'HOD-R&D Software & Web Developer',
      shiftTiming: parsedCached?.shiftTiming || '9:00 AM - 5:00 PM',
      reportingTo: userDetail.reportingManager || parsedCached?.reportingTo || 'Manager - OPS Creative & Marketing',
      preparedTime: parsedCached?.preparedTime || timeStr
    });

    setDailyTaskSummary(DEFAULT_TASK_SUMMARY);
    setDevelopmentWorkReport(DEFAULT_DEV_REPORT);
    setRdInnovationReport([{ activity: '', details: '', dueDate: '', status: '' }]);
    setKpiTracking(DEFAULT_KPI_TRACKING);
    setIssuesSupportRequired(DEFAULT_ISSUES);
    setNextDayPlanning('');
    setHodComments('');
    setApproval({
      hodName: 'HOD - R&D /Developer',
      hodSignature: '',
      hodDate: formattedDateString,
      managerName: 'Manager - OPS Creative &Marketing',
      managerSignature: '',
      managerDate: ''
    });
  };

  // Submit report to backend
  const handleSaveReport = async () => {
    try {
      setSaving(true);

      const cleanDailyTaskSummary = dailyTaskSummary.filter(t => (t.activity || '').trim() !== '');
      const cleanDevelopmentWorkReport = developmentWorkReport.filter(t => (t.project || '').trim() !== '' || (t.activity || '').trim() !== '');
      const cleanRdInnovationReport = rdInnovationReport.filter(t => (t.activity || '').trim() !== '' || (t.details || '').trim() !== '');
      const cleanKpiTracking = kpiTracking.filter(t => (t.project || '').trim() !== '' || (t.kpi || '').trim() !== '');
      const cleanIssuesSupportRequired = issuesSupportRequired.filter(t => (t.issue || '').trim() !== '');

      const excludedSections = Object.entries(hiddenSections).filter(([_, h]) => h).map(([k]) => k);

      const payload = {
        userId: selectedUserId,
        dateString: selectedDate,
        basicDetails,
        dailyTaskSummary: cleanDailyTaskSummary,
        developmentWorkReport: cleanDevelopmentWorkReport,
        rdInnovationReport: cleanRdInnovationReport,
        kpiTracking: cleanKpiTracking,
        issuesSupportRequired: cleanIssuesSupportRequired,
        nextDayPlanning,
        hodComments,
        approval,
        excludedSections,
        hiddenSections
      };

      const res = await fetch(`${API_BASE}/v1/hod-rd-reports`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("HOD R&D Shift Report saved successfully!", 'success');
        fetchSubmittedDates(selectedUserId);
      } else {
        showToast(data.message || "Failed to save the report.", 'error');
      }
    } catch (err) {
      console.error(err);
      showToast("Server error. Please try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    const reportType = 'hodrd';
    // Automatically save report as well
    await handleSaveReport();

    try {
      showToast("Generating PDF on server...", "info");
      const token = localStorage.getItem('token');
      const cleanToken = token ? token.replace(/"/g, '') : '';
      
      const url = `${API_BASE}/v1/employee-reports/generate-pdf?userId=${selectedUserId}&dateString=${selectedDate}&reportType=${reportType}`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
        }
      });
      
      if (!res.ok) {
        throw new Error("Failed to generate PDF report on server.");
      }
      
      const blob = await res.blob();
      const filename = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)}_Report_${(basicDetails.employeeName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_')}_${selectedDate}.pdf`;
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }, 15000);
      
      showToast("PDF report downloaded and saved successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to download PDF.", "error");
    }
  };;

  // Helper row handlers for dynamic monthly tables
  const addMonthlySummaryRow = () => {
    setMonthlyDailyTaskSummary([...monthlyDailyTaskSummary, { activity: '', status: 'Done', dueDate: '', startDate: '', endDate: '', remarks: '' }]);
  };
  const removeMonthlySummaryRow = (index) => {
    if (monthlyDailyTaskSummary.length > 1) {
      setMonthlyDailyTaskSummary(monthlyDailyTaskSummary.filter((_, i) => i !== index));
    }
  };

  const addMonthlyDevRow = () => {
    setMonthlyDevelopmentWorkReport([...monthlyDevelopmentWorkReport, { project: '', activity: '', status: 'ongoing', remark: '' }]);
  };
  const removeMonthlyDevRow = (index) => {
    if (monthlyDevelopmentWorkReport.length > 1) {
      setMonthlyDevelopmentWorkReport(monthlyDevelopmentWorkReport.filter((_, i) => i !== index));
    }
  };

  const addMonthlyInnovRow = () => {
    setMonthlyRdInnovationReport([...monthlyRdInnovationReport, { activity: '', details: '', dueDate: '', status: '' }]);
  };
  const removeMonthlyInnovRow = (index) => {
    if (monthlyRdInnovationReport.length > 1) {
      setMonthlyRdInnovationReport(monthlyRdInnovationReport.filter((_, i) => i !== index));
    }
  };

  const addMonthlyKpiRow = () => {
    setMonthlyKpiTracking([...monthlyKpiTracking, { project: '', kpi: '', target: '', achieved: '' }]);
  };
  const removeMonthlyKpiRow = (index) => {
    if (monthlyKpiTracking.length > 1) {
      setMonthlyKpiTracking(monthlyKpiTracking.filter((_, i) => i !== index));
    }
  };

  const addMonthlyIssueRow = () => {
    setMonthlyIssuesSupportRequired([...monthlyIssuesSupportRequired, { issue: '', priority: '', actionTaken: '' }]);
  };
  const removeMonthlyIssueRow = (index) => {
    if (monthlyIssuesSupportRequired.length > 1) {
      setMonthlyIssuesSupportRequired(monthlyIssuesSupportRequired.filter((_, i) => i !== index));
    }
  };

  const handleFetchMonthlyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a user first.", "error");
      return;
    }
    if (!monthlyStartDate || !monthlyEndDate) {
      showToast("Please select start and end dates.", "error");
      return;
    }

    try {
      setIsMonthlyLoading(true);

      const dates = [];
      let current = new Date(monthlyStartDate);
      const end = new Date(monthlyEndDate);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const fetchPromises = dates.map(async (dateStr) => {
        try {
          const res = await fetch(`${API_BASE}/v1/hod-rd-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
            headers: getAuthHeaders()
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              return data.data;
            }
          }
        } catch (err) {
          console.error(`Failed to fetch report for ${dateStr}:`, err);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      const validReports = results.filter(Boolean);

      if (validReports.length === 0) {
        showToast("No reports found for the selected date range.", "warning");
        // Initialize empty but interactive states
        setMonthlyBasicDetails({
          date: `${monthlyStartDate} to ${monthlyEndDate}`,
          day: 'Monthly Consolidation',
          employeeName: basicDetails.employeeName || '',
          employeeId: basicDetails.employeeId || '',
          department: basicDetails.department || 'R&D/ Development',
          designation: basicDetails.designation || 'HOD-R&D Software & Web Developer',
          shiftTiming: basicDetails.shiftTiming || '9:00 AM - 5:00 PM',
          reportingTo: basicDetails.reportingTo || 'Manager - OPS Creative & Marketing',
          preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
        setMonthlyDailyTaskSummary(DEFAULT_TASK_SUMMARY);
        setMonthlyDevelopmentWorkReport(DEFAULT_DEV_REPORT);
        setMonthlyRdInnovationReport([{ activity: '', details: '', dueDate: '', status: '' }]);
        setMonthlyKpiTracking(DEFAULT_KPI_TRACKING);
        setMonthlyIssuesSupportRequired(DEFAULT_ISSUES);
        setMonthlyNextDayPlanning('');
        setMonthlyHodComments('');
        setMonthlyApproval({
          hodName: 'HOD - R&D /Developer',
          hodSignature: '',
          hodDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
          managerName: 'Manager - OPS Creative &Marketing',
          managerSignature: '',
          managerDate: ''
        });
        return;
      }

      // Consolidate basic details (latest report has precedence)
      const latestReport = validReports[validReports.length - 1];
      const latestBasic = latestReport.basicDetails || {};

      setMonthlyBasicDetails({
        date: `${monthlyStartDate} to ${monthlyEndDate}`,
        day: 'Monthly Consolidation',
        employeeName: latestBasic.employeeName || basicDetails.employeeName || '',
        employeeId: latestBasic.employeeId || basicDetails.employeeId || '',
        department: latestBasic.department || basicDetails.department || 'R&D/ Development',
        designation: latestBasic.designation || basicDetails.designation || 'HOD-R&D Software & Web Developer',
        shiftTiming: latestBasic.shiftTiming || basicDetails.shiftTiming || '9:00 AM - 5:00 PM',
        reportingTo: latestBasic.reportingTo || basicDetails.reportingTo || 'Manager - OPS Creative & Marketing',
        preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });

      // Group Daily Task Summary
      const tasksMap = {};
      validReports.forEach(report => {
        const tasks = report.dailyTaskSummary || [];
        tasks.forEach(task => {
          const key = (task.activity || '').trim();
          if (!key) return;
          if (!tasksMap[key]) {
            tasksMap[key] = { activity: key, statuses: [], dueDate: '', remarks: [] };
          }
          if (task.status) tasksMap[key].statuses.push(task.status);
          if (task.remarks) tasksMap[key].remarks.push(task.remarks);
        });
      });
      const consolidatedTasks = Object.values(tasksMap).map(group => {
        const uniqueStatuses = Array.from(new Set(group.statuses));
        const status = uniqueStatuses.length > 0 ? uniqueStatuses[0] : 'Done';
        const uniqueRemarks = Array.from(new Set(group.remarks)).filter(Boolean);
        return {
          activity: group.activity,
          status,
          dueDate: '', remarks: uniqueRemarks.join('; ')
        };
      });
      setMonthlyDailyTaskSummary(consolidatedTasks.length > 0 ? consolidatedTasks : DEFAULT_TASK_SUMMARY);

      // Group Development Work Report (merging developmentWorkReport)
      const devMap = {};
      validReports.forEach(report => {
        const devItems = report.developmentWorkReport || [];
        devItems.forEach(item => {
          const projectKey = (item.project || '').trim() || 'General';
          if (!devMap[projectKey]) {
            devMap[projectKey] = { project: projectKey, activities: [], statuses: [], remarks: [] };
          }
          if (item.activity) devMap[projectKey].activities.push(item.activity.trim());
          if (item.status) devMap[projectKey].statuses.push(item.status.trim());
          if (item.remark) devMap[projectKey].remarks.push(item.remark.trim());
        });
      });
      const consolidatedDev = Object.values(devMap).map(group => {
        const uniqueActivities = Array.from(new Set(group.activities)).filter(Boolean);
        const activityStr = uniqueActivities.length > 1
          ? uniqueActivities.map(a => `• ${a}`).join('\n')
          : (uniqueActivities[0] || '');
        const uniqueStatuses = Array.from(new Set(group.statuses)).filter(Boolean);
        const status = uniqueStatuses.includes('ongoing') ? 'ongoing' : (uniqueStatuses[0] || 'Done');
        const uniqueRemarks = Array.from(new Set(group.remarks)).filter(Boolean);
        return {
          project: group.project,
          activity: activityStr,
          status,
          remark: uniqueRemarks.join('; ')
        };
      });
      setMonthlyDevelopmentWorkReport(consolidatedDev.length > 0 ? consolidatedDev : DEFAULT_DEV_REPORT);

      // R&D Innovation Report
      const innovMap = {};
      validReports.forEach(report => {
        const items = report.rdInnovationReport || [];
        items.forEach(item => {
          const key = (item.activity || '').trim();
          if (!key) return;
          if (!innovMap[key]) {
            innovMap[key] = { activity: key, details: [], statuses: [] };
          }
          if (item.details) innovMap[key].details.push(item.details.trim());
          if (item.status) innovMap[key].statuses.push(item.status.trim());
        });
      });
      const consolidatedInnov = Object.values(innovMap).map(group => {
        const uniqueDetails = Array.from(new Set(group.details)).filter(Boolean);
        const detailsStr = uniqueDetails.length > 1
          ? uniqueDetails.map(d => `• ${d}`).join('\n')
          : (uniqueDetails[0] || '');
        const uniqueStatuses = Array.from(new Set(group.statuses)).filter(Boolean);
        return {
          activity: group.activity,
          details: detailsStr,
          dueDate: '', status: uniqueStatuses.join('; ') || 'Done'
        };
      });
      setMonthlyRdInnovationReport(consolidatedInnov.length > 0 ? consolidatedInnov : [{ activity: '', details: '', dueDate: '', status: '' }]);

      // Sum KPI Tracking (summing kpiTracking)
      const parseVal = (str) => {
        if (typeof str === 'number') return str;
        if (!str || typeof str !== 'string') return 0;
        const cleaned = str.replace(/[$,₹]/g, '').replace(/,/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };
      const isNumeric = (str) => {
        if (typeof str === 'number') return true;
        if (!str || typeof str !== 'string') return false;
        const cleaned = str.replace(/[$,₹]/g, '').replace(/,/g, '').trim();
        return !isNaN(parseFloat(cleaned)) && isFinite(cleaned);
      };

      const kpiMap = {};
      validReports.forEach(report => {
        const items = report.kpiTracking || [];
        items.forEach(item => {
          const projectKey = (item.project || '').trim() || 'General';
          const kpiKey = (item.kpi || '').trim();
          if (!kpiKey) return;
          const compositeKey = `${projectKey}::${kpiKey}`;
          if (!kpiMap[compositeKey]) {
            kpiMap[compositeKey] = { project: projectKey, kpi: kpiKey, targets: [], achieveds: [] };
          }
          if (item.target) kpiMap[compositeKey].targets.push(item.target.trim());
          if (item.achieved) kpiMap[compositeKey].achieveds.push(item.achieved.trim());
        });
      });
      const consolidatedKpi = Object.values(kpiMap).map(group => {
        const allTargetsNumeric = group.targets.every(isNumeric);
        let target = '';
        if (allTargetsNumeric && group.targets.length > 0) {
          target = String(group.targets.reduce((acc, t) => acc + parseVal(t), 0));
        } else {
          target = Array.from(new Set(group.targets)).filter(Boolean).join('; ');
        }

        const allAchievedNumeric = group.achieveds.every(isNumeric);
        let achieved = '';
        if (allAchievedNumeric && group.achieveds.length > 0) {
          achieved = String(group.achieveds.reduce((acc, a) => acc + parseVal(a), 0));
        } else {
          achieved = Array.from(new Set(group.achieveds)).filter(Boolean).join('; ');
        }
        return { project: group.project, kpi: group.kpi, target, achieved };
      });
      setMonthlyKpiTracking(consolidatedKpi.length > 0 ? consolidatedKpi : DEFAULT_KPI_TRACKING);

      // Issues & Support Required
      const issueMap = {};
      validReports.forEach(report => {
        const items = report.issuesSupportRequired || [];
        items.forEach(item => {
          const key = (item.issue || '').trim();
          if (!key) return;
          if (!issueMap[key]) {
            issueMap[key] = { issue: key, priorities: [], actions: [] };
          }
          if (item.priority) issueMap[key].priorities.push(item.priority.trim());
          if (item.actionTaken) issueMap[key].actions.push(item.actionTaken.trim());
        });
      });
      const consolidatedIssues = Object.values(issueMap).map(group => {
        const uniqPriorities = Array.from(new Set(group.priorities)).map(p => p.toLowerCase());
        let priority = 'Low';
        if (uniqPriorities.includes('high')) priority = 'High';
        else if (uniqPriorities.includes('medium')) priority = 'Medium';
        else if (group.priorities.length > 0) priority = group.priorities[0];
        const uniqActions = Array.from(new Set(group.actions)).filter(Boolean);
        return {
          issue: group.issue,
          priority,
          actionTaken: uniqActions.join('; ')
        };
      });
      setMonthlyIssuesSupportRequired(consolidatedIssues.length > 0 ? consolidatedIssues : DEFAULT_ISSUES);

      // Next Day Planning & HOD Comments
      const planningList = [];
      const commentsList = [];
      validReports.forEach(report => {
        const reportDate = report.basicDetails?.date || 'Unknown Date';
        if (report.nextDayPlanning && report.nextDayPlanning.trim()) {
          planningList.push(`[${reportDate}]: ${report.nextDayPlanning.trim()}`);
        }
        if (report.hodComments && report.hodComments.trim()) {
          commentsList.push(`[${reportDate}]: ${report.hodComments.trim()}`);
        }
      });
      setMonthlyNextDayPlanning(planningList.join('\n'));
      setMonthlyHodComments(commentsList.join('\n'));

      // Approvals
      const latestAppr = latestReport.approval || {};
      setMonthlyApproval({
        hodName: latestAppr.hodName || 'HOD - R&D /Developer',
        hodSignature: latestAppr.hodSignature || '',
        hodDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        managerName: latestAppr.managerName || 'Manager - OPS Creative &Marketing',
        managerSignature: latestAppr.managerSignature || '',
        managerDate: ''
      });

      showToast(`Consolidated ${validReports.length} daily reports!`, "success");
      setMonthlyActiveTab('basic');
    } catch (err) {
      console.error(err);
      showToast("An error occurred during consolidation.", "error");
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const handleFetchWeeklyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a user first.", "error");
      return;
    }
    if (!weeklyStartDate || !weeklyEndDate) {
      showToast("Please select start and end dates.", "error");
      return;
    }

    try {
      setIsWeeklyLoading(true);

      const dates = [];
      let current = new Date(weeklyStartDate);
      const end = new Date(weeklyEndDate);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const fetchPromises = dates.map(async (dateStr) => {
        try {
          const res = await fetch(`${API_BASE}/v1/hod-rd-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
            headers: getAuthHeaders()
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              return data.data;
            }
          }
        } catch (err) {
          console.error(`Failed to fetch report for ${dateStr}:`, err);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      const validReports = results.filter(Boolean);

      if (validReports.length === 0) {
        showToast("No reports found for the selected date range.", "warning");
        setWeeklyBasicDetails({
          date: `${weeklyStartDate} to ${weeklyEndDate}`,
          day: 'Weekly Consolidation',
          employeeName: basicDetails.employeeName || '',
          employeeId: basicDetails.employeeId || '',
          department: basicDetails.department || 'R&D/ Development',
          designation: basicDetails.designation || 'HOD-R&D Software & Web Developer',
          shiftTiming: basicDetails.shiftTiming || '9:00 AM - 5:00 PM',
          reportingTo: basicDetails.reportingTo || 'Manager - OPS Creative & Marketing',
          preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
        setWeeklyDailyTaskSummary(DEFAULT_TASK_SUMMARY);
        setWeeklyDevelopmentWorkReport(DEFAULT_DEV_REPORT);
        setWeeklyRdInnovationReport([{ activity: '', details: '', dueDate: '', status: '' }]);
        setWeeklyKpiTracking(DEFAULT_KPI_TRACKING);
        setWeeklyIssuesSupportRequired(DEFAULT_ISSUES);
        setWeeklyNextDayPlanning('');
        setWeeklyHodComments('');
        setWeeklyApproval({
          hodName: 'HOD - R&D /Developer',
          hodSignature: '',
          hodDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
          managerName: 'Manager - OPS Creative &Marketing',
          managerSignature: '',
          managerDate: ''
        });
        return;
      }

      const latestReport = validReports[validReports.length - 1];
      const latestBasic = latestReport.basicDetails || {};

      setWeeklyBasicDetails({
        date: `${weeklyStartDate} to ${weeklyEndDate}`,
        day: 'Weekly Consolidation',
        employeeName: latestBasic.employeeName || basicDetails.employeeName || '',
        employeeId: latestBasic.employeeId || basicDetails.employeeId || '',
        department: latestBasic.department || basicDetails.department || 'R&D/ Development',
        designation: latestBasic.designation || basicDetails.designation || 'HOD-R&D Software & Web Developer',
        shiftTiming: latestBasic.shiftTiming || basicDetails.shiftTiming || '9:00 AM - 5:00 PM',
        reportingTo: latestBasic.reportingTo || basicDetails.reportingTo || 'Manager - OPS Creative & Marketing',
        preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });

      // Group Daily Task Summary
      const tasksMap = {};
      validReports.forEach(report => {
        const tasks = report.dailyTaskSummary || [];
        tasks.forEach(task => {
          const key = (task.activity || '').trim();
          if (!key) return;
          if (!tasksMap[key]) {
            tasksMap[key] = { activity: key, statuses: [], dueDate: '', remarks: [] };
          }
          if (task.status) tasksMap[key].statuses.push(task.status);
          if (task.remarks) tasksMap[key].remarks.push(task.remarks);
        });
      });
      const consolidatedTasks = Object.values(tasksMap).map(group => {
        const uniqueStatuses = Array.from(new Set(group.statuses));
        const status = uniqueStatuses.length > 0 ? uniqueStatuses[0] : 'Done';
        const uniqueRemarks = Array.from(new Set(group.remarks)).filter(Boolean);
        return {
          activity: group.activity,
          status,
          dueDate: '', remarks: uniqueRemarks.join('; ')
        };
      });
      setWeeklyDailyTaskSummary(consolidatedTasks.length > 0 ? consolidatedTasks : DEFAULT_TASK_SUMMARY);

      // Group Development Work Report
      const devMap = {};
      validReports.forEach(report => {
        const devItems = report.developmentWorkReport || [];
        devItems.forEach(item => {
          const projectKey = (item.project || '').trim() || 'General';
          if (!devMap[projectKey]) {
            devMap[projectKey] = { project: projectKey, activities: [], statuses: [], remarks: [] };
          }
          if (item.activity) devMap[projectKey].activities.push(item.activity.trim());
          if (item.status) devMap[projectKey].statuses.push(item.status.trim());
          if (item.remark) devMap[projectKey].remarks.push(item.remark.trim());
        });
      });
      const consolidatedDev = Object.values(devMap).map(group => {
        const uniqueActivities = Array.from(new Set(group.activities)).filter(Boolean);
        const activityStr = uniqueActivities.length > 1
          ? uniqueActivities.map(a => `• ${a}`).join('\n')
          : (uniqueActivities[0] || '');
        const uniqueStatuses = Array.from(new Set(group.statuses)).filter(Boolean);
        const status = uniqueStatuses.includes('ongoing') ? 'ongoing' : (uniqueStatuses[0] || 'Done');
        const uniqueRemarks = Array.from(new Set(group.remarks)).filter(Boolean);
        return {
          project: group.project,
          activity: activityStr,
          status,
          remark: uniqueRemarks.join('; ')
        };
      });
      setWeeklyDevelopmentWorkReport(consolidatedDev.length > 0 ? consolidatedDev : DEFAULT_DEV_REPORT);

      // R&D Innovation Report
      const innovMap = {};
      validReports.forEach(report => {
        const items = report.rdInnovationReport || [];
        items.forEach(item => {
          const key = (item.activity || '').trim();
          if (!key) return;
          if (!innovMap[key]) {
            innovMap[key] = { activity: key, details: [], statuses: [] };
          }
          if (item.details) innovMap[key].details.push(item.details.trim());
          if (item.status) innovMap[key].statuses.push(item.status.trim());
        });
      });
      const consolidatedInnov = Object.values(innovMap).map(group => {
        const uniqueDetails = Array.from(new Set(group.details)).filter(Boolean);
        const detailsStr = uniqueDetails.length > 1
          ? uniqueDetails.map(d => `• ${d}`).join('\n')
          : (uniqueDetails[0] || '');
        const uniqueStatuses = Array.from(new Set(group.statuses)).filter(Boolean);
        return {
          activity: group.activity,
          details: detailsStr,
          dueDate: '', status: uniqueStatuses.join('; ') || 'Done'
        };
      });
      setWeeklyRdInnovationReport(consolidatedInnov.length > 0 ? consolidatedInnov : [{ activity: '', details: '', dueDate: '', status: '' }]);

      // Sum KPI Tracking
      const parseVal = (str) => {
        if (typeof str === 'number') return str;
        if (!str || typeof str !== 'string') return 0;
        const cleaned = str.replace(/[$,₹]/g, '').replace(/,/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };
      const isNumeric = (str) => {
        if (typeof str === 'number') return true;
        if (!str || typeof str !== 'string') return false;
        const cleaned = str.replace(/[$,₹]/g, '').replace(/,/g, '').trim();
        return !isNaN(parseFloat(cleaned)) && isFinite(cleaned);
      };

      const kpiMap = {};
      validReports.forEach(report => {
        const items = report.kpiTracking || [];
        items.forEach(item => {
          const projectKey = (item.project || '').trim() || 'General';
          const kpiKey = (item.kpi || '').trim();
          if (!kpiKey) return;
          const compositeKey = `${projectKey}::${kpiKey}`;
          if (!kpiMap[compositeKey]) {
            kpiMap[compositeKey] = { project: projectKey, kpi: kpiKey, targets: [], achieveds: [] };
          }
          if (item.target) kpiMap[compositeKey].targets.push(item.target.trim());
          if (item.achieved) kpiMap[compositeKey].achieveds.push(item.achieved.trim());
        });
      });
      const consolidatedKpi = Object.values(kpiMap).map(group => {
        const allTargetsNumeric = group.targets.every(isNumeric);
        let target = '';
        if (allTargetsNumeric && group.targets.length > 0) {
          target = String(group.targets.reduce((acc, t) => acc + parseVal(t), 0));
        } else {
          target = Array.from(new Set(group.targets)).filter(Boolean).join('; ');
        }

        const allAchievedNumeric = group.achieveds.every(isNumeric);
        let achieved = '';
        if (allAchievedNumeric && group.achieveds.length > 0) {
          achieved = String(group.achieveds.reduce((acc, a) => acc + parseVal(a), 0));
        } else {
          achieved = Array.from(new Set(group.achieveds)).filter(Boolean).join('; ');
        }
        return { project: group.project, kpi: group.kpi, target, achieved };
      });
      setWeeklyKpiTracking(consolidatedKpi.length > 0 ? consolidatedKpi : DEFAULT_KPI_TRACKING);

      // Issues & Support Required
      const issueMap = {};
      validReports.forEach(report => {
        const items = report.issuesSupportRequired || [];
        items.forEach(item => {
          const key = (item.issue || '').trim();
          if (!key) return;
          if (!issueMap[key]) {
            issueMap[key] = { issue: key, priorities: [], actions: [] };
          }
          if (item.priority) issueMap[key].priorities.push(item.priority.trim());
          if (item.actionTaken) issueMap[key].actions.push(item.actionTaken.trim());
        });
      });
      const consolidatedIssues = Object.values(issueMap).map(group => {
        const uniqPriorities = Array.from(new Set(group.priorities)).map(p => p.toLowerCase());
        let priority = 'Low';
        if (uniqPriorities.includes('high')) priority = 'High';
        else if (uniqPriorities.includes('medium')) priority = 'Medium';
        else if (group.priorities.length > 0) priority = group.priorities[0];
        const uniqActions = Array.from(new Set(group.actions)).filter(Boolean);
        return {
          issue: group.issue,
          priority,
          actionTaken: uniqActions.join('; ')
        };
      });
      setWeeklyIssuesSupportRequired(consolidatedIssues.length > 0 ? consolidatedIssues : DEFAULT_ISSUES);

      // Next Day Planning & HOD Comments
      const planningList = [];
      const commentsList = [];
      validReports.forEach(report => {
        const reportDate = report.basicDetails?.date || 'Unknown Date';
        if (report.nextDayPlanning && report.nextDayPlanning.trim()) {
          planningList.push(`[${reportDate}]: ${report.nextDayPlanning.trim()}`);
        }
        if (report.hodComments && report.hodComments.trim()) {
          commentsList.push(`[${reportDate}]: ${report.hodComments.trim()}`);
        }
      });
      setWeeklyNextDayPlanning(planningList.join('\n'));
      setWeeklyHodComments(commentsList.join('\n'));

      // Approvals
      const latestAppr = latestReport.approval || {};
      setWeeklyApproval({
        hodName: latestAppr.hodName || 'HOD - R&D /Developer',
        hodSignature: latestAppr.hodSignature || '',
        hodDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        managerName: latestAppr.managerName || 'Manager - OPS Creative &Marketing',
        managerSignature: latestAppr.managerSignature || '',
        managerDate: ''
      });

      showToast(`Consolidated ${validReports.length} daily reports!`, "success");
      setWeeklyActiveTab('basic');
    } catch (err) {
      console.error(err);
      showToast("An error occurred during consolidation.", "error");
    } finally {
      setIsWeeklyLoading(false);
    }
  };

  const handleDownloadWeeklyPDF = async () => {
    try {
      const logoImg = new Image();
      logoImg.src = '/logo3.png';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
      });

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let currentY = 15;

      const drawSectionHeader = (title) => {
        doc.setFillColor(60, 35, 117);
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      const drawHeader = () => {
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          doc.addImage(logoImg, 'PNG', 14, 10, 32, 12);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(22);
          doc.setTextColor(132, 204, 22);
          doc.text("KOD.", 14, 21);
          
          doc.setTextColor(60, 35, 117);
          doc.text("brand", 34, 21);
        }

        doc.setFontSize(13);
        doc.setTextColor(60, 35, 117);
        doc.text("WEEKLY CONSOLIDATED HOD R&D REPORT", 95, 16);
        
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text("HOD - R&D / SOFTWARE & WEB DEVELOPER", 116, 22);
      };

      drawHeader();
      currentY = 27;

      // 1. BASIC DETAILS
      drawSectionHeader("1. BASIC DETAILS");

      const basicDetailsRows = [
        ["Date Range", `${weeklyStartDate} to ${weeklyEndDate}`],
        ["Employee Name:", weeklyBasicDetails.employeeName || ''],
        ["Employee ID", weeklyBasicDetails.employeeId || ''],
        ["Department", weeklyBasicDetails.department || ''],
        ["Designation", weeklyBasicDetails.designation || ''],
        ["Shift Timing", weeklyBasicDetails.shiftTiming || ''],
        ["Reporting To", weeklyBasicDetails.reportingTo || ''],
        ["Prepared Time", weeklyBasicDetails.preparedTime || '']
      ];

      autoTable(doc, {
        body: basicDetailsRows,
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

      // 2. DAILY TASK SUMMARY
      drawSectionHeader("2. DAILY TASK SUMMARY");

      const summaryHeaders = [["Activity", "Status", "Remarks"]];
      const summaryRows = weeklyDailyTaskSummary.map(t => [
        t.activity || '',
        t.status || '',
        t.remarks || ''
      ]);

      autoTable(doc, {
        head: summaryHeaders,
        body: summaryRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 70 },
          1: { width: 35, halign: 'center' },
          2: { width: 77 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 3. DEVELOPMENT WORK REPORT
      drawSectionHeader("3. DEVELOPMENT WORK REPORT");

      const devHeaders = [["Project", "Activity / Task Detail", "Status", "Remark / Reason for Delay"]];
      const devRows = weeklyDevelopmentWorkReport.map(t => [
        t.project || '',
        t.activity || '',
        t.status || '',
        t.remark || ''
      ]);

      autoTable(doc, {
        head: devHeaders,
        body: devRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 35 },
          1: { width: 75 },
          2: { width: 37, halign: 'center' },
          3: { width: 35 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 4. R&D / INNOVATION REPORT
      drawSectionHeader("4. R&D / INNOVATION REPORT");

      const innovHeaders = [["R&D Innovation Activity", "Details of R&D Innovation", "Current Status"]];
      const innovRows = weeklyRdInnovationReport.map(t => [
        t.activity || '',
        t.details || '',
        t.status || ''
      ]);

      autoTable(doc, {
        head: innovHeaders,
        body: innovRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 55 },
          1: { width: 92 },
          2: { width: 35, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 5. KPI TRACKING
      drawSectionHeader("5. KPI TRACKING");

      const kpiHeaders = [["Project", "KPI", "TARGET", "ACHIEVED"]];
      const kpiRows = weeklyKpiTracking.map(t => [
        t.project || '',
        t.kpi || '',
        t.target || '',
        t.achieved || ''
      ]);

      autoTable(doc, {
        head: kpiHeaders,
        body: kpiRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 35 },
          1: { width: 75 },
          2: { width: 37 },
          3: { width: 35, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      // Page break
      doc.addPage();
      currentY = 15;

      // 6. ISSUES / SUPPORT REQUIRED
      drawSectionHeader("6. ISSUES / SUPPORT REQUIRED");

      const issueHeaders = [["ISSUE", "PRIORITY", "ACTION TAKEN"]];
      const issueRows = weeklyIssuesSupportRequired.map(t => [
        t.issue || '',
        t.priority || '',
        t.actionTaken || ''
      ]);

      autoTable(doc, {
        head: issueHeaders,
        body: issueRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 70 },
          1: { width: 35, halign: 'center' },
          2: { width: 77 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 7. NEXT DAY PLANNING
      drawSectionHeader("7. NEXT DAY PLANNING");
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      const planLines = doc.splitTextToSize(weeklyNextDayPlanning || '', 178);
      doc.text(planLines, 16, currentY + 5);
      const planBoxHeight = Math.max(12, planLines.length * 4.2 + 5);
      doc.setDrawColor(180, 180, 180);
      doc.rect(14, currentY, 182, planBoxHeight);
      currentY += planBoxHeight + 4;

      // 8. HOD COMMENTS
      drawSectionHeader("8. HOD COMMENTS");
      const commentsLines = doc.splitTextToSize(weeklyHodComments || '', 178);
      doc.text(commentsLines, 16, currentY + 5);
      const commentsBoxHeight = Math.max(12, commentsLines.length * 4.2 + 5);
      doc.rect(14, currentY, 182, commentsBoxHeight);
      currentY += commentsBoxHeight + 4;

      // 9. ACHIEVEMENTS
      drawSectionHeader("9. ACHIEVEMENTS");
      const achievementsLines = doc.splitTextToSize(weeklyAchievements || '', 178);
      doc.text(achievementsLines, 16, currentY + 5);
      const achievementsBoxHeight = Math.max(12, achievementsLines.length * 4.2 + 5);
      doc.rect(14, currentY, 182, achievementsBoxHeight);
      currentY += achievementsBoxHeight + 4;

      // 10. IMPROVEMENTS NEEDED
      drawSectionHeader("10. IMPROVEMENTS NEEDED");
      const improvementsLines = doc.splitTextToSize(weeklyImprovements || '', 178);
      doc.text(improvementsLines, 16, currentY + 5);
      const improvementsBoxHeight = Math.max(12, improvementsLines.length * 4.2 + 5);
      doc.rect(14, currentY, 182, improvementsBoxHeight);
      currentY += improvementsBoxHeight + 4;

      // Check if page fits before drawing Next Week Planning & Approvals
      if (currentY > 220) {
        doc.addPage();
        currentY = 15;
        drawHeader();
        currentY = 27;
      }

      // 11. NEXT WEEK PLANNING
      drawSectionHeader("11. NEXT WEEK PLANNING");
      const nextWeekLines = doc.splitTextToSize(weeklyNextWeekPlanning || '', 178);
      doc.text(nextWeekLines, 16, currentY + 5);
      const nextWeekBoxHeight = Math.max(12, nextWeekLines.length * 4.2 + 5);
      doc.rect(14, currentY, 182, nextWeekBoxHeight);
      currentY += nextWeekBoxHeight + 4;

      // Check if page fits before drawing approvals
      if (currentY > 210) {
        doc.addPage();
        currentY = 15;
        drawHeader();
        currentY = 27;
      }

      // 12. APPROVAL
      drawSectionHeader("12. APPROVAL");
      const approvalHeaders = [["Name", "Signature", "Date"]];
      const approvalRows = [
        [
          `HOD - R&D /Developer: ${weeklyApproval.hodName || ''}`,
          weeklyApproval.hodSignature || '',
          weeklyApproval.hodDate || ''
        ],
        [
          `Manager – OPS Creative & Marketing: ${weeklyApproval.managerName || ''}`,
          weeklyApproval.managerSignature || '',
          weeklyApproval.managerDate || ''
        ]
      ];

      autoTable(doc, {
        head: approvalHeaders,
        body: approvalRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 62 },
          2: { cellWidth: 40 }
        },
        didDrawCell: (data) => {
          if (data.column.index === 1 && data.cell.section === 'body') {
            const signatureVal = data.cell.raw;
            if (signatureVal && String(signatureVal).startsWith('data:image/')) {
              data.cell.text = '';
              const x = data.cell.x + 2;
              const y = data.cell.y + 2;
              const w = data.cell.width - 4;
              const h = data.cell.height - 4;
              try {
                doc.addImage(signatureVal, 'PNG', x, y, w, h);
              } catch (e) {
                console.error("Failed to add signature image to weekly PDF:", e);
              }
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      const pdfBlob = doc.output('blob');
      const filename = `Weekly_Consolidated_Report_HOD_RD_${weeklyBasicDetails.employeeName || 'HOD'}_${weeklyStartDate}_to_${weeklyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${weeklyStartDate}_to_${weeklyEndDate}`, pdfBlob, filename, 'hodrd', 'weekly');
        console.log("Weekly PDF saved successfully");
      } catch (uploadErr) {
        console.error("Failed to upload weekly PDF:", uploadErr);
      }
      doc.save(filename);
      showToast("Weekly PDF report downloaded successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to generate Weekly PDF.", "error");
    }
  };

  const handleDownloadMonthlyPDF = async () => {
    try {
      const logoImg = new Image();
      logoImg.src = '/logo3.png';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
      });

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let currentY = 15;

      const drawSectionHeader = (title) => {
        doc.setFillColor(60, 35, 117); // rgb(60, 35, 117) - deep purple/indigo
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      // Header Brand Logo
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        doc.addImage(logoImg, 'PNG', 14, 10, 32, 12);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(132, 204, 22); // lime green
        doc.text("KOD.", 14, 21);

        doc.setTextColor(60, 35, 117); // purple/indigo
        doc.text("brand", 34, 21);
      }

      // Document Title & Designation
      doc.setFontSize(13);
      doc.setTextColor(60, 35, 117);
      doc.text("MONTHLY CONSOLIDATED HOD R&D REPORT", 95, 16);

      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text("HOD - R&D / SOFTWARE & WEB DEVELOPER", 116, 22);

      currentY = 27;

      // 1. BASIC DETAILS
      drawSectionHeader("1. BASIC DETAILS");

      const basicDetailsRows = [
        ["Date Range", `${monthlyStartDate} to ${monthlyEndDate}`],
        ["Employee Name:", monthlyBasicDetails.employeeName || ''],
        ["Employee ID", monthlyBasicDetails.employeeId || ''],
        ["Department", monthlyBasicDetails.department || ''],
        ["Designation", monthlyBasicDetails.designation || ''],
        ["Shift Timing", monthlyBasicDetails.shiftTiming || ''],
        ["Reporting To", monthlyBasicDetails.reportingTo || ''],
        ["Prepared Time", monthlyBasicDetails.preparedTime || '']
      ];

      autoTable(doc, {
        body: basicDetailsRows,
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

      // 2. DAILY TASK SUMMARY
      drawSectionHeader("2. DAILY TASK SUMMARY");

      const summaryHeaders = [["Activity", "Status", "Remarks"]];
      const summaryRows = monthlyDailyTaskSummary.map(t => [
        t.activity || '',
        t.status || '',
        t.remarks || ''
      ]);

      autoTable(doc, {
        head: summaryHeaders,
        body: summaryRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 70 },
          1: { width: 35, halign: 'center' },
          2: { width: 77 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 3. DEVELOPMENT WORK REPORT
      drawSectionHeader("3. DEVELOPMENT WORK REPORT");

      const devHeaders = [["Project", "Development Activity", "Status", "Remark"]];
      const devRows = monthlyDevelopmentWorkReport.map(t => [
        t.project || '',
        t.activity || '',
        t.status || '',
        t.remark || ''
      ]);

      autoTable(doc, {
        head: devHeaders,
        body: devRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 35 },
          1: { width: 75 },
          2: { width: 35, halign: 'center' },
          3: { width: 37 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 4. R&D INNOVATION REPORT
      drawSectionHeader("4. R&D INNOVATION REPORT");

      const innovHeaders = [["Activity", "Details", "Status"]];
      const innovRows = monthlyRdInnovationReport.map(t => [
        t.activity || '',
        t.details || '',
        t.status || ''
      ]);

      autoTable(doc, {
        head: innovHeaders,
        body: innovRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 55 },
          1: { width: 92 },
          2: { width: 35, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 5. KPI TRACKING
      drawSectionHeader("5. KPI TRACKING");

      const kpiHeaders = [["Project", "KPI", "TARGET", "ACHIEVED"]];
      const kpiRows = monthlyKpiTracking.map(t => [
        t.project || '',
        t.kpi || '',
        t.target || '',
        t.achieved || ''
      ]);

      autoTable(doc, {
        head: kpiHeaders,
        body: kpiRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 35 },
          1: { width: 75 },
          2: { width: 37 },
          3: { width: 35, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      // Page break
      doc.addPage();
      currentY = 15;

      // 6. ISSUES / SUPPORT REQUIRED
      drawSectionHeader("6. ISSUES / SUPPORT REQUIRED");

      const issueHeaders = [["ISSUE", "PRIORITY", "ACTION TAKEN"]];
      const issueRows = monthlyIssuesSupportRequired.map(t => [
        t.issue || '',
        t.priority || '',
        t.actionTaken || ''
      ]);

      autoTable(doc, {
        head: issueHeaders,
        body: issueRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 70 },
          1: { width: 35, halign: 'center' },
          2: { width: 77 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 7. NEXT DAY PLANNING
      drawSectionHeader("7. NEXT DAY PLANNING");
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      const planLines = doc.splitTextToSize(monthlyNextDayPlanning || '', 178);
      doc.text(planLines, 16, currentY + 5);
      const planBoxHeight = Math.max(12, planLines.length * 4.2 + 5);
      doc.setDrawColor(180, 180, 180);
      doc.rect(14, currentY, 182, planBoxHeight);
      currentY += planBoxHeight + 4;

      // 8. HOD COMMENTS
      drawSectionHeader("8. HOD COMMENTS");
      const commentsLines = doc.splitTextToSize(monthlyHodComments || '', 178);
      doc.text(commentsLines, 16, currentY + 5);
      const commentsBoxHeight = Math.max(12, commentsLines.length * 4.2 + 5);
      doc.rect(14, currentY, 182, commentsBoxHeight);
      currentY += commentsBoxHeight + 4;

      // 9. APPROVAL
      drawSectionHeader("9. APPROVAL");
      const approvalHeaders = [["Name", "Signature", "Date"]];
      const approvalRows = [
        [
          `HOD - R&D /Developer: ${monthlyApproval.hodName || ''}`,
          monthlyApproval.hodSignature || '',
          monthlyApproval.hodDate || ''
        ],
        [
          `Manager – OPS Creative & Marketing: ${monthlyApproval.managerName || ''}`,
          monthlyApproval.managerSignature || '',
          monthlyApproval.managerDate || ''
        ]
      ];

      autoTable(doc, {
        head: approvalHeaders,
        body: approvalRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 62 },
          2: { cellWidth: 40 }
        },
        didDrawCell: (data) => {
          if (data.column.index === 1 && data.cell.section === 'body') {
            const signatureVal = data.cell.raw;
            if (signatureVal && String(signatureVal).startsWith('data:image/')) {
              data.cell.text = '';
              const x = data.cell.x + 2;
              const y = data.cell.y + 2;
              const w = data.cell.width - 4;
              const h = data.cell.height - 4;
              try {
                doc.addImage(signatureVal, 'PNG', x, y, w, h);
              } catch (e) {
                console.error("Failed to add signature image to monthly PDF:", e);
              }
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      const pdfBlob = doc.output('blob');
      const filename = `Monthly_Consolidated_Report_HOD_RD_${monthlyBasicDetails.employeeName || 'HOD'}_${monthlyStartDate}_to_${monthlyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${monthlyStartDate}_to_${monthlyEndDate}`, pdfBlob, filename, 'hodrd', 'monthly');
        console.log("Monthly PDF saved successfully");
      } catch (uploadErr) {
        console.error("Failed to upload monthly PDF:", uploadErr);
      }
      doc.save(filename);
      showToast("Monthly PDF report downloaded successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to generate Monthly PDF.", "error");
    }
  };

  // Generate last 14 days list
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

  // Helper row handlers for dynamic tables
  const addSummaryRow = () => {
    setDailyTaskSummary([...dailyTaskSummary, { activity: '', status: 'Done', dueDate: '', startDate: '', endDate: '', remarks: '' }]);
  };
  
  const removeSummaryRow = (index) => {
    if (dailyTaskSummary.length > 1) {
      setDailyTaskSummary(dailyTaskSummary.filter((_, i) => i !== index));
    }
  };

  const addDevRow = () => {
    setDevelopmentWorkReport([...developmentWorkReport, { project: '', activity: '', status: 'ongoing', remark: '' }]);
  };

  const removeDevRow = (index) => {
    if (developmentWorkReport.length > 1) {
      setDevelopmentWorkReport(developmentWorkReport.filter((_, i) => i !== index));
    }
  };

  const addInnovRow = () => {
    setRdInnovationReport([...rdInnovationReport, { activity: '', details: '', dueDate: '', status: '' }]);
  };

  const removeInnovRow = (index) => {
    if (rdInnovationReport.length > 1) {
      setRdInnovationReport(rdInnovationReport.filter((_, i) => i !== index));
    }
  };

  const addKpiRow = () => {
    setKpiTracking([...kpiTracking, { project: '', kpi: '', target: '', achieved: '' }]);
  };

  const removeKpiRow = (index) => {
    if (kpiTracking.length > 1) {
      setKpiTracking(kpiTracking.filter((_, i) => i !== index));
    }
  };

  const addIssueRow = () => {
    setIssuesSupportRequired([...issuesSupportRequired, { issue: '', priority: '', actionTaken: '' }]);
  };

  const removeIssueRow = (index) => {
    if (issuesSupportRequired.length > 1) {
      setIssuesSupportRequired(issuesSupportRequired.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="flex gap-6 items-start w-full relative flex-col lg:flex-row">
      
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

      {/* RIGHT PANEL: Main Report Form */}
      <div className="flex-1 w-full bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md rounded-3xl p-6 lg:p-8 shadow-sm">
        
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
            {/* Form Header Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  HOD R&D Daily Shift Report
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fill, review, and download daily reports for Software & Web Development R&D.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Weekly Report
                </button>

                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Monthly Report
                </button>

                

                <AiAnalyzeButton
                  onClick={() => {
                    setAiModalContext({
                      employeeName: basicDetails.employeeName,
                      department: 'HOD R&D',
                      designation: basicDetails.designation,
                      date: selectedDate,
                      actualReportContentText: JSON.stringify({ basicDetails, taskSummary, researchInnovation, teamMentorship, hodComments: comments })
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
              title="HOD R&D Report AI Analysis"
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
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Reporting Manager</label>
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

            {/* 2. DAILY TASK SUMMARY */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">2</span>
                  Daily Task Summary
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('dailyTaskSummary')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={addSummaryRow}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.dailyTaskSummary ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Daily Task Summary (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('dailyTaskSummary')}
                    className="text-xs font-bold text-indigo-600 dark:text-lime-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3.5 w-[35%]">Activity / Task</th>
                      <th className="px-3 py-3.5 w-[12%]">Due Date</th>
                      <th className="px-3 py-3.5 w-[12%]">Start Date</th>
                      <th className="px-3 py-3.5 w-[12%]">End Date</th>
                      <th className="px-3 py-3.5 w-[12%] text-center">Status</th>
                      <th className="px-4 py-3.5 w-[12%]">Remarks</th>
                      <th className="px-2 py-3.5 w-[5%] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dailyTaskSummary.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-4 py-3 relative group">
                          <div className="flex items-start gap-1.5">
                            <textarea
                              rows={2}
                              value={item.activity || ''}
                              onChange={(e) => {
                                const updated = [...dailyTaskSummary];
                                updated[index].activity = e.target.value;
                                setDailyTaskSummary(updated);
                              }}
                              placeholder="Enter task details..."
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                            />
                            {item.activity && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(item.activity)}
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                title="Expand / View Full Text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 vertical-top">
                          <input
                            type="date"
                            value={item.dueDate || ''}
                            onChange={(e) => {
                              const updated = [...dailyTaskSummary];
                              updated[index].dueDate = e.target.value;
                              setDailyTaskSummary(updated);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-3 vertical-top">
                          <input
                            type="text"
                            placeholder="DD-MM-YYYY HH:mm"
                            value={item.startDate || ''}
                            onChange={(e) => {
                              const updated = [...dailyTaskSummary];
                              updated[index].startDate = e.target.value;
                              setDailyTaskSummary(updated);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-3 vertical-top">
                          <input
                            type="text"
                            placeholder="DD-MM-YYYY HH:mm"
                            value={item.endDate || ''}
                            onChange={(e) => {
                              const updated = [...dailyTaskSummary];
                              updated[index].endDate = e.target.value;
                              setDailyTaskSummary(updated);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-center vertical-top">
                          <select
                            value={item.status}
                            onChange={(e) => {
                              const updated = [...dailyTaskSummary];
                              updated[index].status = e.target.value;
                              setDailyTaskSummary(updated);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                          >
                            <option value="Done">Done</option>
                            <option value="ongoing">ongoing</option>
                            <option value="onprogress">onprogress</option>
                            <option value="Pending">Pending</option>
                            <option value="NA">NA</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 vertical-top">
                          <textarea
                            rows={2}
                            value={item.remarks || ''}
                            onChange={(e) => {
                              const updated = [...dailyTaskSummary];
                              updated[index].remarks = e.target.value;
                              setDailyTaskSummary(updated);
                            }}
                            placeholder="Remarks..."
                            className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                          />
                        </td>
                        <td className="px-2 py-3 text-center vertical-top">
                          <button
                            type="button"
                            onClick={() => removeSummaryRow(index)}
                            disabled={dailyTaskSummary.length === 1}
                            className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            {/* 3. DEVELOPMENT WORK REPORT */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">3</span>
                  Development Work Report
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('developmentWorkReport')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={addDevRow}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.developmentWorkReport ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Development Work Report (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('developmentWorkReport')}
                    className="text-xs font-bold text-indigo-600 dark:text-lime-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3.5 w-[25%]">Project</th>
                      <th className="px-4 py-3.5 w-[45%]">Development Activity</th>
                      <th className="px-3 py-3.5 w-[12%] text-center">Status</th>
                      <th className="px-4 py-3.5 w-[13%]">Remark</th>
                      <th className="px-2 py-3.5 w-[5%] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {developmentWorkReport.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-4 py-3 vertical-top relative group">
                          <div className="flex items-start gap-1.5">
                            <input
                              type="text"
                              value={item.project || ''}
                              onChange={(e) => {
                                const updated = [...developmentWorkReport];
                                updated[index].project = e.target.value;
                                setDevelopmentWorkReport(updated);
                              }}
                              placeholder="Ayurvedic website, CRM"
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                            {item.project && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(item.project)}
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                title="Expand / View Full Text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 vertical-top relative group">
                          <div className="flex items-start gap-1.5">
                            <textarea
                              rows={2}
                              value={item.activity || ''}
                              onChange={(e) => {
                                const updated = [...developmentWorkReport];
                                updated[index].activity = e.target.value;
                                setDevelopmentWorkReport(updated);
                              }}
                              onKeyDown={(e) => handleAutoListKeyDown(e, item.activity || '', (newVal) => {
                                const updated = [...developmentWorkReport];
                                updated[index].activity = newVal;
                                setDevelopmentWorkReport(updated);
                              })}
                              placeholder="Changes in UI, debugging, etc."
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                            />
                            {item.activity && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(item.activity)}
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                title="Expand / View Full Text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center vertical-top">
                          <select
                            value={item.status}
                            onChange={(e) => {
                              const updated = [...developmentWorkReport];
                              updated[index].status = e.target.value;
                              setDevelopmentWorkReport(updated);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                          >
                            <option value="Done">Done</option>
                            <option value="ongoing">ongoing</option>
                            <option value="onprogress">onprogress</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 vertical-top">
                          <textarea
                            rows={2}
                            value={item.remark || ''}
                            onChange={(e) => {
                              const updated = [...developmentWorkReport];
                              updated[index].remark = e.target.value;
                              setDevelopmentWorkReport(updated);
                            }}
                            placeholder="e.g. Client verified"
                            className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                          />
                        </td>
                        <td className="px-2 py-3 text-center vertical-top">
                          <button
                            type="button"
                            onClick={() => removeDevRow(index)}
                            disabled={developmentWorkReport.length === 1}
                            className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            {/* 4. R&D INNOVATION REPORT */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">4</span>
                  R&D Innovation Report
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('rdInnovationReport')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={addInnovRow}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.rdInnovationReport ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    R&D Innovation Report (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('rdInnovationReport')}
                    className="text-xs font-bold text-indigo-600 dark:text-lime-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-4 w-[45%]">Activity</th>
                      <th className="px-5 py-4 w-[30%]">Due Date</th>
                      <th className="px-5 py-4 w-[50%]">Details</th>
                      <th className="px-5 py-4 w-[15%] text-center">Status</th>
                      <th className="px-5 py-4 w-[5%] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rdInnovationReport.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-5 py-3 relative group">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={item.activity}
                              onChange={(e) => {
                                const updated = [...rdInnovationReport];
                                updated[index].activity = e.target.value;
                                setRdInnovationReport(updated);
                              }}
                              placeholder="Research activity..."
                              className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                            />
                            {item.activity && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(item.activity)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 transition-all p-0.5"
                                title="View full text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <textarea
                            value={item.details}
                            onChange={(e) => {
                              const updated = [...rdInnovationReport];
                              updated[index].details = e.target.value;
                              setRdInnovationReport(updated);
                            }}
                            placeholder="Technical findings / documentation..."
                            rows={1}
                            className="w-full bg-transparent border-none focus:outline-none resize-y text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="text"
                            value={item.status}
                            onChange={(e) => {
                              const updated = [...rdInnovationReport];
                              updated[index].status = e.target.value;
                              setRdInnovationReport(updated);
                            }}
                            placeholder="Done / In Progress"
                            className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeInnovRow(index)}
                            disabled={rdInnovationReport.length === 1}
                            className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            {/* 5. KPI TRACKING */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5</span>
                  KPI Tracking
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('kpiTracking')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={addKpiRow}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.kpiTracking ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    KPI Tracking (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('kpiTracking')}
                    className="text-xs font-bold text-indigo-600 dark:text-lime-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-4 w-[20%]">Assigned To</th>
                      <th className="px-5 py-4 w-[40%]">Task</th>
                      <th className="px-5 py-4 w-[20%]">Due Date</th>
                      <th className="px-5 py-4 w-[15%] text-center">Status</th>
                      <th className="px-5 py-4 w-[5%] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {kpiTracking.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.project}
                            onChange={(e) => {
                              const updated = [...kpiTracking];
                              updated[index].project = e.target.value;
                              setKpiTracking(updated);
                            }}
                            placeholder="Ayurvedic website"
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 relative group">
                          <div className="flex items-center gap-1.5">
                            <textarea
                              value={item.kpi}
                              onChange={(e) => {
                                const updated = [...kpiTracking];
                                updated[index].kpi = e.target.value;
                                setKpiTracking(updated);
                              }}
                              onKeyDown={(e) => handleAutoListKeyDown(e, item.kpi || '', (newVal) => {
                                const updated = [...kpiTracking];
                                updated[index].kpi = newVal;
                                setKpiTracking(updated);
                              })}
                              placeholder="Changes in UI"
                              rows={1}
                              className="w-full bg-transparent border-none focus:outline-none resize-y text-slate-700 dark:text-slate-200"
                            />
                            {item.kpi && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(item.kpi)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 transition-all p-0.5"
                                title="View full text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="date"
                            value={item.target}
                            onChange={(e) => {
                              const updated = [...kpiTracking];
                              updated[index].target = e.target.value;
                              setKpiTracking(updated);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none text-sm text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <select
                            value={item.achieved}
                            onChange={(e) => {
                              const updated = [...kpiTracking];
                              updated[index].achieved = e.target.value;
                              setKpiTracking(updated);
                            }}
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Preview">Preview</option>
                            <option value="Done">Done</option>
                          </select>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeKpiRow(index)}
                            disabled={kpiTracking.length === 1}
                            className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            {/* 6. ISSUES / SUPPORT REQUIRED */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">6</span>
                  Issues / Support Required
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('issuesSupportRequired')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={addIssueRow}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.issuesSupportRequired ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Issues / Support Required (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('issuesSupportRequired')}
                    className="text-xs font-bold text-indigo-600 dark:text-lime-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-4 w-[40%]">ISSUE</th>
                      <th className="px-5 py-4 w-[20%] text-center">PRIORITY</th>
                      <th className="px-5 py-4 w-[35%]">ACTION TAKEN</th>
                      <th className="px-5 py-4 w-[5%] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {issuesSupportRequired.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-5 py-3 relative group">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={item.issue}
                              onChange={(e) => {
                                const updated = [...issuesSupportRequired];
                                updated[index].issue = e.target.value;
                                setIssuesSupportRequired(updated);
                              }}
                              placeholder="HR / Admin Manager, COO, etc."
                              className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                            />
                            {item.issue && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(item.issue)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 transition-all p-0.5"
                                title="View full text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="text"
                            value={item.priority}
                            onChange={(e) => {
                              const updated = [...issuesSupportRequired];
                              updated[index].priority = e.target.value;
                              setIssuesSupportRequired(updated);
                            }}
                            placeholder="High / Medium / Low"
                            className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.actionTaken}
                            onChange={(e) => {
                              const updated = [...issuesSupportRequired];
                              updated[index].actionTaken = e.target.value;
                              setIssuesSupportRequired(updated);
                            }}
                            placeholder="Pending / Discussed"
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeIssueRow(index)}
                            disabled={issuesSupportRequired.length === 1}
                            className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            {/* 7. NEXT DAY PLANNING & 8. HOD COMMENTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">7</span>
                  Next Day Planning
                </h2>
                <textarea
                  value={nextDayPlanning}
                  onChange={(e) => setNextDayPlanning(e.target.value)}
                  placeholder="CRM Continues, etc."
                  rows={4}
                  className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                />
              </div>

              <div className="space-y-3">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">8</span>
                  HOD Comments
                </h2>
                <textarea
                  value={hodComments}
                  onChange={(e) => setHodComments(e.target.value)}
                  placeholder="Manager review notes, specific R&D challenges..."
                  rows={4}
                  className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                />
              </div>
            </div>

            {/* 9. APPROVALS */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">9</span>
                Approval Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-3 border-r border-slate-200/50 dark:border-slate-800/50 pr-0 md:pr-6">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">HOD - R&D /Developer</h3>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Name</label>
                    <input
                      type="text"
                      value={approval.hodName || ''}
                      onChange={(e) => setApproval({ ...approval, hodName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Signature (Initials)</label>
                    <SignatureUpload
                      value={approval.hodSignature || ''}
                      onChange={(val) => setApproval({ ...approval, hodSignature: val })}
                      placeholder="Upload HOD signature"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Date</label>
                    <input
                      type="text"
                      value={approval.hodDate || ''}
                      onChange={(e) => setApproval({ ...approval, hodDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Manager - OPS Creative & Marketing</h3>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Name</label>
                    <input
                      type="text"
                      value={approval.managerName || ''}
                      onChange={(e) => setApproval({ ...approval, managerName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Signature (Initials)</label>
                    <SignatureUpload
                      value={approval.managerSignature || ''}
                      onChange={(val) => setApproval({ ...approval, managerSignature: val })}
                      placeholder="Upload manager signature"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Date</label>
                    <input
                      type="text"
                      value={approval.managerDate || ''}
                      onChange={(e) => setApproval({ ...approval, managerDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Form Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 w-full">
              <button
                type="button"
                onClick={() => setIsWeeklyModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all border border-indigo-100 dark:border-indigo-900/50"
              >
                <Calendar size={16} />
                Weekly Report
              </button>

              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all border border-indigo-100 dark:border-indigo-900/50"
              >
                <Calendar size={16} />
                Monthly Report
              </button>

              

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

      {/* MONTHLY CONSOLIDATION MODAL */}
      <AnimatePresence>
        {isMonthlyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 mx-4 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Monthly Consolidation Report</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Aggregate multiple daily reports into a single monthly shift report</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Date Filters & Fetch */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={monthlyStartDate}
                    onChange={(e) => setMonthlyStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={monthlyEndDate}
                    onChange={(e) => setMonthlyEndDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={handleFetchMonthlyData}
                    disabled={isMonthlyLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {isMonthlyLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Consolidating...
                      </>
                    ) : (
                      <>
                        <Calendar size={16} />
                        Fetch & Consolidate
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-950/10 px-4 scrollbar-none">
                {[
                  { id: 'basic', label: '1. Basic Details' },
                  { id: 'tasks', label: '2. Tasks Summary' },
                  { id: 'dev', label: '3. Dev Work' },
                  { id: 'innov', label: '4. Innovation' },
                  { id: 'kpi', label: '5. KPI Tracking' },
                  { id: 'issues', label: '6. Issues' },
                  { id: 'planning', label: '7-8. Comments' },
                  { id: 'approvals', label: '9. Approvals' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMonthlyActiveTab(tab.id)}
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all duration-200
                      ${monthlyActiveTab === tab.id
                        ? 'border-indigo-600 text-indigo-600 dark:border-lime-400 dark:text-lime-400'
                        : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6 max-h-[50vh] overflow-y-auto">
                {/* Tab basic */}
                {monthlyActiveTab === 'basic' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date Range</label>
                      <input
                        type="text"
                        value={monthlyBasicDetails.date || ''}
                        readOnly
                        className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Employee Name</label>
                      <input
                        type="text"
                        value={monthlyBasicDetails.employeeName || ''}
                        onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, employeeName: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Employee ID</label>
                      <input
                        type="text"
                        value={monthlyBasicDetails.employeeId || ''}
                        onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, employeeId: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
                      <input
                        type="text"
                        value={monthlyBasicDetails.department || ''}
                        onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, department: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Designation</label>
                      <input
                        type="text"
                        value={monthlyBasicDetails.designation || ''}
                        onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, designation: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Shift Timing</label>
                      <input
                        type="text"
                        value={monthlyBasicDetails.shiftTiming || ''}
                        onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, shiftTiming: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reporting Manager</label>
                      <input
                        type="text"
                        value={monthlyBasicDetails.reportingTo || ''}
                        onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, reportingTo: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Prepared Time</label>
                      <input
                        type="text"
                        value={monthlyBasicDetails.preparedTime || ''}
                        onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, preparedTime: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {/* Tab tasks */}
                {monthlyActiveTab === 'tasks' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">Daily Task Summary (Monthly)</h3>
                      <button type="button" onClick={addMonthlySummaryRow} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 font-bold transition-all">
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                            <th className="px-4 py-3.5 w-[35%]">Activity / Task</th>
                            <th className="px-3 py-3.5 w-[12%]">Due Date</th>
                            <th className="px-3 py-3.5 w-[12%]">Start Date</th>
                            <th className="px-3 py-3.5 w-[12%]">End Date</th>
                            <th className="px-3 py-3.5 w-[12%] text-center">Status</th>
                            <th className="px-4 py-3.5 w-[12%]">Remarks</th>
                            <th className="px-2 py-3.5 w-[5%] text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyDailyTaskSummary.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                              <td className="px-4 py-3 relative group">
                                <div className="flex items-start gap-1.5">
                                  <textarea
                                    rows={2}
                                    value={item.activity || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyDailyTaskSummary];
                                      updated[idx].activity = e.target.value;
                                      setMonthlyDailyTaskSummary(updated);
                                    }}
                                    placeholder="Enter activity details..."
                                    className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                                  />
                                  {item.activity && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedActivityText(item.activity)}
                                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                      title="Expand / View Full Text"
                                    >
                                      <Maximize2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 vertical-top">
                                <input
                                  type="date"
                                  value={item.dueDate || ''}
                                  onChange={(e) => {
                                    const updated = [...monthlyDailyTaskSummary];
                                    updated[idx].dueDate = e.target.value;
                                    setMonthlyDailyTaskSummary(updated);
                                  }}
                                  className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                              </td>
                              <td className="px-3 py-3 vertical-top">
                                <input
                                  type="date"
                                  value={item.startDate || ''}
                                  onChange={(e) => {
                                    const updated = [...monthlyDailyTaskSummary];
                                    updated[idx].startDate = e.target.value;
                                    setMonthlyDailyTaskSummary(updated);
                                  }}
                                  className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                              </td>
                              <td className="px-3 py-3 vertical-top">
                                <input
                                  type="date"
                                  value={item.endDate || ''}
                                  onChange={(e) => {
                                    const updated = [...monthlyDailyTaskSummary];
                                    updated[idx].endDate = e.target.value;
                                    setMonthlyDailyTaskSummary(updated);
                                  }}
                                  className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                              </td>
                              <td className="px-3 py-3 text-center vertical-top">
                                <select
                                  value={item.status}
                                  onChange={(e) => {
                                    const updated = [...monthlyDailyTaskSummary];
                                    updated[idx].status = e.target.value;
                                    setMonthlyDailyTaskSummary(updated);
                                  }}
                                  className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                                >
                                  <option value="Done">Done</option>
                                  <option value="ongoing">ongoing</option>
                                  <option value="onprogress">onprogress</option>
                                  <option value="Pending">Pending</option>
                                  <option value="NA">NA</option>
                                </select>
                              </td>
                              <td className="px-4 py-3 vertical-top">
                                <textarea
                                  rows={2}
                                  value={item.remarks || ''}
                                  onChange={(e) => {
                                    const updated = [...monthlyDailyTaskSummary];
                                    updated[idx].remarks = e.target.value;
                                    setMonthlyDailyTaskSummary(updated);
                                  }}
                                  placeholder="Remarks..."
                                  className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                                />
                              </td>
                              <td className="px-2 py-3 text-center vertical-top">
                                <button type="button" onClick={() => removeMonthlySummaryRow(idx)} className="text-rose-500 hover:text-rose-700 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab dev */}
                {monthlyActiveTab === 'dev' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">Development Work Report (Monthly)</h3>
                      <button type="button" onClick={addMonthlyDevRow} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 font-bold transition-all">
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                            <th className="px-5 py-4 w-[25%]">Project</th>
                            <th className="px-5 py-4 w-[45%]">Development Activity</th>
                            <th className="px-5 py-4 w-[12%] text-center">Status</th>
                            <th className="px-5 py-4 w-[13%]">Remark</th>
                            <th className="px-5 py-4 w-[5%] text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyDevelopmentWorkReport.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.project}
                                  onChange={(e) => {
                                    const updated = [...monthlyDevelopmentWorkReport];
                                    updated[idx].project = e.target.value;
                                    setMonthlyDevelopmentWorkReport(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <textarea
                                  value={item.activity}
                                  onChange={(e) => {
                                    const updated = [...monthlyDevelopmentWorkReport];
                                    updated[idx].activity = e.target.value;
                                    setMonthlyDevelopmentWorkReport(updated);
                                  }}
                                  onKeyDown={(e) => handleAutoListKeyDown(e, item.activity || '', (newVal) => {
                                    const updated = [...monthlyDevelopmentWorkReport];
                                    updated[idx].activity = newVal;
                                    setMonthlyDevelopmentWorkReport(updated);
                                  })}
                                  rows={2}
                                  className="w-full bg-transparent border-none focus:outline-none resize-y text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <select
                                  value={item.status}
                                  onChange={(e) => {
                                    const updated = [...monthlyDevelopmentWorkReport];
                                    updated[idx].status = e.target.value;
                                    setMonthlyDevelopmentWorkReport(updated);
                                  }}
                                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                                >
                                  <option value="Done">Done</option>
                                  <option value="ongoing">ongoing</option>
                                  <option value="onprogress">onprogress</option>
                                  <option value="Pending">Pending</option>
                                </select>
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.remark}
                                  onChange={(e) => {
                                    const updated = [...monthlyDevelopmentWorkReport];
                                    updated[idx].remark = e.target.value;
                                    setMonthlyDevelopmentWorkReport(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <button type="button" onClick={() => removeMonthlyDevRow(idx)} className="text-rose-500 hover:text-rose-700 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab innov */}
                {monthlyActiveTab === 'innov' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">R&D Innovation Report (Monthly)</h3>
                      <button type="button" onClick={addMonthlyInnovRow} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 font-bold transition-all">
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                            <th className="px-5 py-4 w-[45%]">Activity</th>
                      <th className="px-5 py-4 w-[30%]">Due Date</th>
                            <th className="px-5 py-4 w-[50%]">Details</th>
                            <th className="px-5 py-4 w-[15%] text-center">Status</th>
                            <th className="px-5 py-4 w-[5%] text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyRdInnovationReport.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.activity}
                                  onChange={(e) => {
                                    const updated = [...monthlyRdInnovationReport];
                                    updated[idx].activity = e.target.value;
                                    setMonthlyRdInnovationReport(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <textarea
                                  value={item.details}
                                  onChange={(e) => {
                                    const updated = [...monthlyRdInnovationReport];
                                    updated[idx].details = e.target.value;
                                    setMonthlyRdInnovationReport(updated);
                                  }}
                                  rows={2}
                                  className="w-full bg-transparent border-none focus:outline-none resize-y text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <input
                                  type="text"
                                  value={item.status}
                                  onChange={(e) => {
                                    const updated = [...monthlyRdInnovationReport];
                                    updated[idx].status = e.target.value;
                                    setMonthlyRdInnovationReport(updated);
                                  }}
                                  className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <button type="button" onClick={() => removeMonthlyInnovRow(idx)} className="text-rose-500 hover:text-rose-700 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab kpi */}
                {monthlyActiveTab === 'kpi' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">KPI Tracking (Monthly)</h3>
                      <button type="button" onClick={addMonthlyKpiRow} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 font-bold transition-all">
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                            <th className="px-5 py-4 w-[20%]">Assigned To</th>
                            <th className="px-5 py-4 w-[40%]">Task</th>
                            <th className="px-5 py-4 w-[20%]">Due Date</th>
                            <th className="px-5 py-4 w-[15%] text-center">Status</th>
                            <th className="px-5 py-4 w-[5%] text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyKpiTracking.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.project}
                                  onChange={(e) => {
                                    const updated = [...monthlyKpiTracking];
                                    updated[idx].project = e.target.value;
                                    setMonthlyKpiTracking(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <textarea
                                  value={item.kpi}
                                  onChange={(e) => {
                                    const updated = [...monthlyKpiTracking];
                                    updated[idx].kpi = e.target.value;
                                    setMonthlyKpiTracking(updated);
                                  }}
                                  onKeyDown={(e) => handleAutoListKeyDown(e, item.kpi || '', (newVal) => {
                                    const updated = [...monthlyKpiTracking];
                                    updated[idx].kpi = newVal;
                                    setMonthlyKpiTracking(updated);
                                  })}
                                  rows={2}
                                  className="w-full bg-transparent border-none focus:outline-none resize-y text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.target}
                                  onChange={(e) => {
                                    const updated = [...monthlyKpiTracking];
                                    updated[idx].target = e.target.value;
                                    setMonthlyKpiTracking(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <input
                                  type="text"
                                  value={item.achieved}
                                  onChange={(e) => {
                                    const updated = [...monthlyKpiTracking];
                                    updated[idx].achieved = e.target.value;
                                    setMonthlyKpiTracking(updated);
                                  }}
                                  className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <button type="button" onClick={() => removeMonthlyKpiRow(idx)} className="text-rose-500 hover:text-rose-700 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab issues */}
                {monthlyActiveTab === 'issues' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">Issues / Support Required (Monthly)</h3>
                      <button type="button" onClick={addMonthlyIssueRow} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 font-bold transition-all">
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                            <th className="px-5 py-4 w-[40%]">ISSUE</th>
                            <th className="px-5 py-4 w-[20%] text-center">PRIORITY</th>
                            <th className="px-5 py-4 w-[35%]">ACTION TAKEN</th>
                            <th className="px-5 py-4 w-[5%] text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyIssuesSupportRequired.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.issue}
                                  onChange={(e) => {
                                    const updated = [...monthlyIssuesSupportRequired];
                                    updated[idx].issue = e.target.value;
                                    setMonthlyIssuesSupportRequired(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <input
                                  type="text"
                                  value={item.priority}
                                  onChange={(e) => {
                                    const updated = [...monthlyIssuesSupportRequired];
                                    updated[idx].priority = e.target.value;
                                    setMonthlyIssuesSupportRequired(updated);
                                  }}
                                  className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.actionTaken}
                                  onChange={(e) => {
                                    const updated = [...monthlyIssuesSupportRequired];
                                    updated[idx].actionTaken = e.target.value;
                                    setMonthlyIssuesSupportRequired(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <button type="button" onClick={() => removeMonthlyIssueRow(idx)} className="text-rose-500 hover:text-rose-700 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab planning */}
                {monthlyActiveTab === 'planning' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">Next Day Planning (Monthly Consolidated)</h3>
                      <textarea
                        value={monthlyNextDayPlanning}
                        onChange={(e) => setMonthlyNextDayPlanning(e.target.value)}
                        rows={8}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                      />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">HOD Comments (Monthly Consolidated)</h3>
                      <textarea
                        value={monthlyHodComments}
                        onChange={(e) => setMonthlyHodComments(e.target.value)}
                        rows={8}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                      />
                    </div>
                  </div>
                )}

                {/* Tab approvals */}
                {monthlyActiveTab === 'approvals' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 border-r border-slate-200/50 dark:border-slate-800/50 pr-0 md:pr-6">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">HOD - R&D /Developer</h4>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Name</label>
                        <input
                          type="text"
                          value={monthlyApproval.hodName || ''}
                          onChange={(e) => setMonthlyApproval({ ...monthlyApproval, hodName: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Signature</label>
                        <SignatureUpload
                          value={monthlyApproval.hodSignature || ''}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Date</label>
                        <input
                          type="text"
                          value={monthlyApproval.hodDate || ''}
                          onChange={(e) => setMonthlyApproval({ ...monthlyApproval, hodDate: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Manager - OPS Creative & Marketing</h4>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Name</label>
                        <input
                          type="text"
                          value={monthlyApproval.managerName || ''}
                          onChange={(e) => setMonthlyApproval({ ...monthlyApproval, managerName: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Signature</label>
                        <SignatureUpload
                          value={monthlyApproval.managerSignature || ''}
                          onChange={(val) => setMonthlyApproval({ ...monthlyApproval, managerSignature: val })}
                          placeholder="Upload manager signature"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Date</label>
                        <input
                          type="text"
                          value={monthlyApproval.managerDate || ''}
                          onChange={(e) => setMonthlyApproval({ ...monthlyApproval, managerDate: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/10">
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMonthlyPDF}
                  disabled={monthlyDailyTaskSummary.length === 0 && monthlyDevelopmentWorkReport.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
                >
                  <Download size={16} />
                  Download Monthly PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isWeeklyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 mx-4 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Weekly Consolidation Report</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Aggregate multiple daily reports into a single weekly shift report</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Date Filters & Fetch */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={weeklyStartDate}
                    onChange={(e) => setWeeklyStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={weeklyEndDate}
                    onChange={(e) => setWeeklyEndDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={handleFetchWeeklyData}
                    disabled={isWeeklyLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {isWeeklyLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Consolidating...
                      </>
                    ) : (
                      <>
                        <Calendar size={16} />
                        Fetch & Consolidate
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-6 py-2 gap-2 scrollbar-none">
                {[
                  { id: 'basic', label: '1. Basic' },
                  { id: 'tasks', label: '2. Tasks' },
                  { id: 'dev', label: '3. Dev Work' },
                  { id: 'innov', label: '4. Innovation' },
                  { id: 'kpi', label: '5. KPI' },
                  { id: 'issues', label: '6. Issues' },
                  { id: 'planning', label: '7. Summary & Planning' },
                  { id: 'approvals', label: '8. Approvals' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setWeeklyActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      weeklyActiveTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-650/10'
                        : 'bg-transparent text-slate-500 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content Panel */}
              <div className="p-6 max-h-[55vh] overflow-y-auto">
                {weeklyActiveTab === 'basic' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(weeklyBasicDetails).map((key) => (
                      <div key={key}>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1')}</label>
                        <input
                          type="text"
                          value={weeklyBasicDetails[key] || ''}
                          onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, [key]: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {weeklyActiveTab === 'tasks' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">Consolidated Daily Task Summary</h3>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-250/20 text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase">Activity</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase w-32">Status</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-250/25">
                          {weeklyDailyTaskSummary.map((t, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-250">{t.activity}</td>
                              <td className="px-4 py-2.5 text-center">
                                <select
                                  value={t.status}
                                  onChange={(e) => {
                                    const updated = [...weeklyDailyTaskSummary];
                                    updated[idx].status = e.target.value;
                                    setWeeklyDailyTaskSummary(updated);
                                  }}
                                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-1 text-center w-full focus:outline-none"
                                >
                                  <option value="Done">Done</option>
                                  <option value="pending">Pending</option>
                                  <option value="ongoing">Ongoing</option>
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  type="text"
                                  value={t.remarks || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyDailyTaskSummary];
                                    updated[idx].remarks = e.target.value;
                                    setWeeklyDailyTaskSummary(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'dev' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">Consolidated Development Work</h3>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-250/20 text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase w-36">Project</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase">Activity</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase w-28">Status</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-250/25">
                          {weeklyDevelopmentWorkReport.map((t, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-250">{t.project}</td>
                              <td className="px-4 py-2.5">
                                <textarea
                                  value={t.activity}
                                  onChange={(e) => {
                                    const updated = [...weeklyDevelopmentWorkReport];
                                    updated[idx].activity = e.target.value;
                                    setWeeklyDevelopmentWorkReport(updated);
                                  }}
                                  rows={2}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 focus:outline-none resize-none"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <select
                                  value={t.status}
                                  onChange={(e) => {
                                    const updated = [...weeklyDevelopmentWorkReport];
                                    updated[idx].status = e.target.value;
                                    setWeeklyDevelopmentWorkReport(updated);
                                  }}
                                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-1 text-center w-full focus:outline-none"
                                >
                                  <option value="Done">Done</option>
                                  <option value="pending">Pending</option>
                                  <option value="ongoing">Ongoing</option>
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  type="text"
                                  value={t.remark || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyDevelopmentWorkReport];
                                    updated[idx].remark = e.target.value;
                                    setWeeklyDevelopmentWorkReport(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'innov' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">Consolidated R&D Innovation Report</h3>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-250/20 text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase w-48">Activity</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase">Details</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase w-32">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-250/25">
                          {weeklyRdInnovationReport.map((t, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-250">{t.activity}</td>
                              <td className="px-4 py-2.5">
                                <textarea
                                  value={t.details}
                                  onChange={(e) => {
                                    const updated = [...weeklyRdInnovationReport];
                                    updated[idx].details = e.target.value;
                                    setWeeklyRdInnovationReport(updated);
                                  }}
                                  rows={2}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 focus:outline-none resize-none"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="text"
                                  value={t.status || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyRdInnovationReport];
                                    updated[idx].status = e.target.value;
                                    setWeeklyRdInnovationReport(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 text-center focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'kpi' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">Consolidated KPIs</h3>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-250/20 text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase w-36">Project</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase">KPI</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase w-28">Target</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase w-28">Achieved</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-250/25">
                          {weeklyKpiTracking.map((t, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-250">{t.project}</td>
                              <td className="px-4 py-2.5 text-slate-700 dark:text-slate-250">{t.kpi}</td>
                              <td className="px-4 py-2.5">
                                <input
                                  type="text"
                                  value={t.target || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyKpiTracking];
                                    updated[idx].target = e.target.value;
                                    setWeeklyKpiTracking(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 text-center focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  type="text"
                                  value={t.achieved || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyKpiTracking];
                                    updated[idx].achieved = e.target.value;
                                    setWeeklyKpiTracking(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 text-center focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'issues' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-250">Consolidated Issues & Support Required</h3>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-250/20 text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase">Issue</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase w-32">Priority</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase">Action Taken</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-250/25">
                          {weeklyIssuesSupportRequired.map((t, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-250">{t.issue}</td>
                              <td className="px-4 py-2.5 text-center">
                                <select
                                  value={t.priority}
                                  onChange={(e) => {
                                    const updated = [...weeklyIssuesSupportRequired];
                                    updated[idx].priority = e.target.value;
                                    setWeeklyIssuesSupportRequired(updated);
                                  }}
                                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-1 text-center w-full focus:outline-none animate-none"
                                >
                                  <option value="High">High</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Low">Low</option>
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  type="text"
                                  value={t.actionTaken || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyIssuesSupportRequired];
                                    updated[idx].actionTaken = e.target.value;
                                    setWeeklyIssuesSupportRequired(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'planning' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">Next Day Planning</h3>
                      <textarea
                        value={weeklyNextDayPlanning}
                        onChange={(e) => setWeeklyNextDayPlanning(e.target.value)}
                        rows={6}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                      />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">HOD Comments</h3>
                      <textarea
                        value={weeklyHodComments}
                        onChange={(e) => setWeeklyHodComments(e.target.value)}
                        rows={6}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                      />
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">Achievements</h3>
                      <textarea
                        value={weeklyAchievements}
                        onChange={(e) => setWeeklyAchievements(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                        placeholder="Enter achievements..."
                      />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">Improvements Needed</h3>
                      <textarea
                        value={weeklyImprovements}
                        onChange={(e) => setWeeklyImprovements(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                        placeholder="Enter improvements needed..."
                      />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">Next Week Planning</h3>
                      <textarea
                        value={weeklyNextWeekPlanning}
                        onChange={(e) => setWeeklyNextWeekPlanning(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                        placeholder="Enter next week planning..."
                      />
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'approvals' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 border-r border-slate-200/50 dark:border-slate-800/50 pr-0 md:pr-6">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">HOD - R&D /Developer</h4>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Name</label>
                        <input
                          type="text"
                          value={weeklyApproval.hodName || ''}
                          onChange={(e) => setWeeklyApproval({ ...weeklyApproval, hodName: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Signature (Base64 Image or Text)</label>
                        <input
                          type="text"
                          value={weeklyApproval.hodSignature || ''}
                          onChange={(e) => setWeeklyApproval({ ...weeklyApproval, hodSignature: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="e.g. data:image/png;base64,..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Date</label>
                        <input
                          type="text"
                          value={weeklyApproval.hodDate || ''}
                          onChange={(e) => setWeeklyApproval({ ...weeklyApproval, hodDate: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Manager – OPS Creative & Marketing</h4>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Name</label>
                        <input
                          type="text"
                          value={weeklyApproval.managerName || ''}
                          onChange={(e) => setWeeklyApproval({ ...weeklyApproval, managerName: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Signature</label>
                        <input
                          type="text"
                          value={weeklyApproval.managerSignature || ''}
                          onChange={(e) => setWeeklyApproval({ ...weeklyApproval, managerSignature: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="e.g. data:image/png;base64,..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Date</label>
                        <input
                          type="text"
                          value={weeklyApproval.managerDate || ''}
                          onChange={(e) => setWeeklyApproval({ ...weeklyApproval, managerDate: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDownloadWeeklyPDF}
                  disabled={weeklyDailyTaskSummary.length === 0 && weeklyDevelopmentWorkReport.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
                >
                  <Download size={16} />
                  Download Weekly PDF
                </button>
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

export default HodRdReportPage;
