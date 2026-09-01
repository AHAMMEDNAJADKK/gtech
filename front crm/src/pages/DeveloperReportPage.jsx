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

const RAW_API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const isRowEmpty = (item) => {
  if (!item || typeof item !== 'object') return true;
  const skipKeys = new Set(['_id', 'id', '__v']);
  return !Object.entries(item).some(([k, v]) => {
    if (skipKeys.has(k)) return false;
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
};

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (RAW_API_BASE.endsWith('/v1')) {
    return `${RAW_API_BASE}${cleanPath}`;
  }
  if (RAW_API_BASE.endsWith('/api')) {
    return `${RAW_API_BASE}/v1${cleanPath}`;
  }
  return `${RAW_API_BASE}/api/v1${cleanPath}`;
};

// Default items for Daily Task Summary (matching the mockup)
const DEFAULT_TASK_SUMMARY = [
  { activity: '', status: '', dueDate: '', startDate: '', endDate: '', remarks: '' }
];

// Default items for Development Task Report
const DEFAULT_DEV_REPORT = [
  { project: '', activity: '', status: '', remark: '' }
];

const getMostFrequentValue = (countsObj, fallback) => {
  const entries = Object.entries(countsObj);
  if (entries.length === 0) return fallback;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
};

const formatDateString = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
  }
  return dateStr;
};

const consolidateDeveloperReports = (reports) => {
  const firstReport = reports[0];
  const userDetail = firstReport?.basicDetails || {};
  
  const mBasic = {
    date: '',
    day: 'N/A',
    employeeName: userDetail.employeeName || '',
    employeeId: userDetail.employeeId || '',
    department: userDetail.department || 'R&D/ Development',
    designation: userDetail.designation || 'Developer',
    shiftTiming: userDetail.shiftTiming || '9:00 AM - 5:00 PM',
    reportingTo: userDetail.reportingTo || 'HOD - R&D / Developer',
    preparedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  // 2. Daily Task Summary
  const summaryGroup = {};
  reports.forEach(r => {
    const summary = r.dailyTaskSummary || [];
    summary.forEach(item => {
      const act = (item.activity || '').trim();
      if (!act) return;
      const key = act.toLowerCase();
      if (!summaryGroup[key]) {
        summaryGroup[key] = { activity: act, statuses: {}, remarks: new Set() };
      }
      const status = (item.status || 'NA').trim();
      summaryGroup[key].statuses[status] = (summaryGroup[key].statuses[status] || 0) + 1;
      if (item.remarks && item.remarks.trim()) {
        summaryGroup[key].remarks.add(item.remarks.trim());
      }
    });
  });

  let mDailyTaskSummary = Object.values(summaryGroup).map(group => {
    const statusEntries = Object.entries(group.statuses);
    statusEntries.sort((a, b) => b[1] - a[1]);
    const mainStatus = statusEntries.length > 0 ? statusEntries[0][0] : 'Done';
    const remarksText = Array.from(group.remarks).join('; ');
    return {
      activity: group.activity,
      status: mainStatus,
      dueDate: '', remarks: remarksText
    };
  });
  if (mDailyTaskSummary.length === 0) {
    mDailyTaskSummary = DEFAULT_TASK_SUMMARY.map(item => ({ ...item }));
  }

  // 3. Development Task Report
  const devGroup = {};
  reports.forEach(r => {
    const devList = r.developmentTaskReport || [];
    devList.forEach(item => {
      const proj = (item.project || '').trim();
      if (!proj) return;
      const key = proj.toLowerCase();
      if (!devGroup[key]) {
        devGroup[key] = { project: proj, activities: new Set(), statuses: {}, remarks: new Set() };
      }
      
      const actText = item.activity || '';
      const parts = actText.split('\n');
      parts.forEach(p => {
        let cleaned = p.replace(/^[-*•\s]+/, '').trim();
        if (cleaned) {
          devGroup[key].activities.add(cleaned);
        }
      });

      const status = (item.status || '').trim();
      if (status) {
        devGroup[key].statuses[status] = (devGroup[key].statuses[status] || 0) + 1;
      }

      const remark = (item.remark || '').trim();
      if (remark) {
        devGroup[key].remarks.add(remark);
      }
    });
  });

  let mDevelopmentTaskReport = Object.values(devGroup).map(group => {
    const activityLines = Array.from(group.activities).map(act => `- ${act}`).join('\n');
    const statusEntries = Object.entries(group.statuses);
    statusEntries.sort((a, b) => b[1] - a[1]);
    const mainStatus = statusEntries.length > 0 ? statusEntries[0][0] : 'ongoing';
    const remarkText = Array.from(group.remarks).join('; ');
    return {
      project: group.project,
      activity: activityLines,
      status: mainStatus,
      remark: remarkText
    };
  });
  if (mDevelopmentTaskReport.length === 0) {
    mDevelopmentTaskReport = DEFAULT_DEV_REPORT.map(item => ({ ...item }));
  }

  // 4. Research & Learning Activities
  const researchGroup = {};
  reports.forEach(r => {
    const resList = r.researchLearning || [];
    resList.forEach(item => {
      const act = (item.activity || '').trim();
      if (!act) return;
      const key = act.toLowerCase();
      if (!researchGroup[key]) {
        researchGroup[key] = { activity: act, details: new Set() };
      }
      if (item.details && item.details.trim()) {
        researchGroup[key].details.add(item.details.trim());
      }
    });
  });
  let mResearchLearning = Object.values(researchGroup).map(group => {
    return {
      activity: group.activity,
      details: Array.from(group.details).join('; ')
    };
  });
  if (mResearchLearning.length === 0) {
    mResearchLearning = [{ activity: '', details: '' }];
  }

  // 5. Daily Performance Tracker
  const perfFields = ['taskCompleted', 'learningProgress', 'communication', 'attendance', 'productivity'];
  const perfCounts = {
    taskCompleted: {},
    learningProgress: {},
    communication: {},
    attendance: {},
    productivity: {}
  };
  reports.forEach(r => {
    const pt = r.performanceTracker || {};
    perfFields.forEach(field => {
      const val = pt[field] || '';
      if (val) {
        perfCounts[field][val] = (perfCounts[field][val] || 0) + 1;
      }
    });
  });
  const mPerformanceTracker = {
    taskCompleted: getMostFrequentValue(perfCounts.taskCompleted, 'Good'),
    learningProgress: getMostFrequentValue(perfCounts.learningProgress, 'Improving'),
    communication: getMostFrequentValue(perfCounts.communication, 'Good'),
    attendance: getMostFrequentValue(perfCounts.attendance, 'Present'),
    productivity: getMostFrequentValue(perfCounts.productivity, 'Present')
  };

  const mergeTextFields = (fieldName) => {
    const uniqueLines = new Set();
    reports.forEach(r => {
      const text = r[fieldName] || '';
      text.split('\n').forEach(line => {
        let cleaned = line.replace(/^[-*•\s]+/, '').trim();
        if (cleaned) {
          uniqueLines.add(cleaned);
        }
      });
    });
    return Array.from(uniqueLines).map(line => `- ${line}`).join('\n');
  };

  const mToolsUsed = mergeTextFields('toolsUsed');
  const mChallengesFaced = mergeTextFields('challengesFaced');
  const mNextDayPlan = mergeTextFields('nextDayPlan');
  const mInternRemarks = mergeTextFields('internRemarks');

  const firstApproval = firstReport?.approval || {};
  const mApproval = {
    internName: firstApproval.internName || '',
    internSignature: firstApproval.internSignature || '',
    internDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
    hodName: firstApproval.hodName || 'HOD - R&D / Developer',
    hodSignature: '',
    hodDate: ''
  };

  return {
    basicDetails: mBasic,
    dailyTaskSummary: mDailyTaskSummary,
    developmentTaskReport: mDevelopmentTaskReport,
    researchLearning: mResearchLearning,
    performanceTracker: mPerformanceTracker,
    toolsUsed: mToolsUsed,
    challengesFaced: mChallengesFaced,
    nextDayPlan: mNextDayPlan,
    internRemarks: mInternRemarks,
    approval: mApproval
  };
};

const DeveloperReportPage = () => {
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
  const [developers, setDevelopers] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);

  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);
  
  // Form State
  const [basicDetails, setBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: '',
    designation: '',
    shiftTiming: '9:00 AM - 5:00 PM',
    reportingTo: 'HOD- R&D Software & Web Developer',
    preparedTime: ''
  });
  
  const [dailyTaskSummary, setDailyTaskSummary] = useState(DEFAULT_TASK_SUMMARY);
  const [selectedActivityText, setSelectedActivityText] = useState(null);
  const [developmentTaskReport, setDevelopmentTaskReport] = useState(DEFAULT_DEV_REPORT);

  const [hiddenSections, setHiddenSections] = useState({});

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

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
  const [researchLearning, setResearchLearning] = useState([{ activity: '', details: '' }]);
  const [performanceTracker, setPerformanceTracker] = useState({
    taskCompleted: 'Good',
    learningProgress: 'Improving',
    communication: 'Good',
    attendance: 'Present',
    productivity: 'Present'
  });
  const [toolsUsed, setToolsUsed] = useState('');
  const [challengesFaced, setChallengesFaced] = useState('');
  const [nextDayPlan, setNextDayPlan] = useState('');
  const [internRemarks, setInternRemarks] = useState('');
  const [approval, setApproval] = useState({
    internName: '',
    internSignature: '',
    internDate: '',
    hodName: 'HOD - R&D / Developer',
    hodSignature: '',
    hodDate: ''
  });

  // Monthly Report Consolidation States
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
  
  const [monthlyBasicDetails, setMonthlyBasicDetails] = useState(null);
  const [monthlyDailyTaskSummary, setMonthlyDailyTaskSummary] = useState([]);
  const [monthlyDevelopmentTaskReport, setMonthlyDevelopmentTaskReport] = useState([]);
  const [monthlyResearchLearning, setMonthlyResearchLearning] = useState([]);
  const [monthlyPerformanceTracker, setMonthlyPerformanceTracker] = useState({
    taskCompleted: 'Good',
    learningProgress: 'Improving',
    communication: 'Good',
    attendance: 'Present',
    productivity: 'Present'
  });
  const [monthlyToolsUsed, setMonthlyToolsUsed] = useState('');
  const [monthlyChallengesFaced, setMonthlyChallengesFaced] = useState('');
  const [monthlyNextDayPlan, setMonthlyNextDayPlan] = useState('');
  const [monthlyInternRemarks, setMonthlyInternRemarks] = useState('');
  const [monthlyApproval, setMonthlyApproval] = useState({
    internName: '',
    internSignature: '',
    internDate: '',
    hodName: 'HOD - R&D / Developer',
    hodSignature: '',
    hodDate: ''
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

  // Initialize user information
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

  // Fetch developers list (for HR/Admins)
  useEffect(() => {
    if (isPrivileged) {
      const fetchDevs = async () => {
        try {
          const res = await fetch(getApiEndpoint('/developer-reports/developers'), {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setDevelopers(data.data);
            if (data.data.length > 0 && !selectedUserId) {
              setSelectedUserId(data.data[0]._id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch developers list:", e);
        }
      };
      fetchDevs();
    }
  }, [isPrivileged, getAuthHeaders, selectedUserId]);

  // Fetch submitted report dates list for highlighting
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(getApiEndpoint(`/developer-reports/submitted-dates?userId=${userId}`), {
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

  // Fetch developer report data for selected date and user
  const fetchReport = async (userId, dateStr) => {
    if (!userId || !dateStr) return;
    try {
      setLoading(true);
      const res = await fetch(getApiEndpoint(`/developer-reports/by-date?userId=${userId}&dateString=${dateStr}`), {
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

        const savedLog = report.dailyTaskSummary || [];
        setDailyTaskSummary(savedLog);

        try {
          fetchCompletedTasks(userId, dateStr).then(completedTasks => {
            if (completedTasks && completedTasks.length > 0) {
              const cleanTitle = (title) => {
                if (!title) return '';
                return title.replace(/\[[^\]]+\]/g, '').trim().toLowerCase();
              };

              const updatedLog = [...savedLog];
              const addedTasks = [];

              completedTasks.forEach(t => {
                const cleanT = cleanTitle(t.title);
                const matchIndex = updatedLog.findIndex(row => cleanTitle(row.activity || '') === cleanT);

                if (matchIndex > -1) {
                  // Update existing task details in the saved report
                  updatedLog[matchIndex] = {
                    ...updatedLog[matchIndex],
                    activity: t.title,
                    dueDate: t.dueDate || '',
                    startDate: t.startDate || t.startTime || updatedLog[matchIndex].startDate || '',
                    endDate: t.endDate || t.endTime || updatedLog[matchIndex].endDate || '',
                    status: t.status || 'Pending',
                    remarks: t.description || updatedLog[matchIndex].remarks || ''
                  };
                } else {
                  // Append new task
                  addedTasks.push({
                    activity: t.title,
                    status: t.status || 'Pending',
                    dueDate: t.dueDate || '',
                    startDate: t.startDate || t.startTime || '',
                    endDate: t.endDate || t.endTime || '',
                    remarks: t.description || ''
                  });
                }
              });

              setDailyTaskSummary([...updatedLog, ...addedTasks]);
            }
          });
        } catch (e) {
          console.error("Error merging additional tasks:", e);
        }

        setDevelopmentTaskReport(report.developmentTaskReport || []);
        setResearchLearning(report.researchLearning || []);
        setPerformanceTracker(report.performanceTracker || {
          taskCompleted: 'Good',
          learningProgress: 'Improving',
          communication: 'Good',
          attendance: 'Present',
          productivity: 'Present'
        });
        setToolsUsed(report.toolsUsed || '');
        setChallengesFaced(report.challengesFaced || '');
        setNextDayPlan(report.nextDayPlan || '');
        setInternRemarks(report.internRemarks || '');
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
              status: t.status || 'Pending',
              dueDate: t.dueDate || '',
              startDate: t.startDate || t.startTime || t.startDateTimeLocal || '',
              endDate: t.endDate || t.endTime || t.endDateTimeLocal || '',
              remarks: t.description || ''
            }));
            setDailyTaskSummary(mappedTasks);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
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
              status: t.status || 'Pending',
              dueDate: t.dueDate || '',
              startDate: t.startDate || t.startTime || t.startDateTimeLocal || '',
              endDate: t.endDate || t.endTime || t.endDateTimeLocal || '',
              remarks: t.description || ''
            }));
            setDailyTaskSummary(mappedTasks);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
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
        localStorage.setItem(`cachedBasicDetails_Developer_${selectedUserId}`, JSON.stringify(persistent));
      }
    }
  }, [basicDetails, selectedUserId]);

    const initializeBlankReport = (userId, dateStr) => {
    let freshestUser = currentUser;
    try {
      const su = localStorage.getItem('user');
      if (su) freshestUser = JSON.parse(su);
    } catch(e){}

    // Find selected user info
    let userDetail = freshestUser;
    if (isPrivileged && developers.length > 0) {
      userDetail = developers.find(d => (d._id || d.id) === userId) || freshestUser;
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
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    const timeStr = hours + ':' + minutes + ' ' + ampm;

    // Load from cache if exists
    const cached = localStorage.getItem(`cachedBasicDetails_Developer_${userId}`);
    const parsedCached = cached ? JSON.parse(cached) : null;

    setBasicDetails({
      date: formattedDateString,
      day: dayName,
      employeeName: userDetail.name || parsedCached?.employeeName || '',
      employeeId: userDetail.employeeId || parsedCached?.employeeId || '',
      department: parsedCached?.department || 'R&D/ Development',
      designation: userDetail.designationName || userDetail.designation || parsedCached?.designation || 'Developer',
      shiftTiming: parsedCached?.shiftTiming || '9:00 AM - 5:00 PM',
      reportingTo: userDetail.reportingManager || parsedCached?.reportingTo || 'HOD - R&D / Developer',
      preparedTime: parsedCached?.preparedTime || timeStr
    });

    setDailyTaskSummary(DEFAULT_TASK_SUMMARY);
    setDevelopmentTaskReport(DEFAULT_DEV_REPORT);
    setResearchLearning([{ activity: '', details: '' }]);
    setPerformanceTracker({
      taskCompleted: 'Good',
      learningProgress: 'Improving',
      communication: 'Good',
      attendance: 'Present',
      productivity: 'Present'
    });
    setToolsUsed('');
    setChallengesFaced('');
    setNextDayPlan('');
    setInternRemarks('');
    setApproval({
      internName: userDetail.name || '',
      internSignature: '',
      internDate: formattedDateString,
      hodName: 'HOD - R&D / Developer',
      hodSignature: '',
      hodDate: ''
    });
  };

  // Submit report to backend
  const handleSaveReport = async () => {
    try {
      setSaving(true);

      const cleanDailyTaskSummary = dailyTaskSummary.filter(t => (t.activity || '').trim() !== '');
      const cleanDevelopmentTaskReport = developmentTaskReport.filter(t => (t.project || '').trim() !== '' || (t.activity || '').trim() !== '');
      const cleanResearchLearning = researchLearning.filter(t => (t.activity || '').trim() !== '' || (t.details || '').trim() !== '');

      const excludedSections = Object.entries(hiddenSections).filter(([_, h]) => h).map(([k]) => k);

      const payload = {
        userId: selectedUserId,
        dateString: selectedDate,
        basicDetails,
        dailyTaskSummary: cleanDailyTaskSummary,
        developmentTaskReport: cleanDevelopmentTaskReport,
        researchLearning: cleanResearchLearning,
        performanceTracker,
        toolsUsed,
        challengesFaced,
        nextDayPlan,
        internRemarks,
        approval,
        excludedSections,
        hiddenSections
      };

      const res = await fetch(getApiEndpoint('/developer-reports'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.warn("Could not parse JSON response:", jsonErr);
      }

      if (res.ok && data.success) {
        showToast("Daily Shift Report saved successfully!", 'success');
        // Refresh status indicators
        fetchSubmittedDates(selectedUserId);
      } else {
        showToast(data.message || `Failed to save the report (Status: ${res.status}).`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast("Server error. Please try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  // Fetch and consolidate monthly reports
  const handleFetchMonthlyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a developer first.", "error");
      return;
    }
    
    try {
      setIsMonthlyLoading(true);
      
      const start = new Date(monthlyStartDate);
      const end = new Date(monthlyEndDate);
      
      if (start > end) {
        showToast("Start date must be before or equal to End date.", "error");
        return;
      }
      
      const dates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }
      
      const promises = dates.map(dateStr => 
        fetch(getApiEndpoint(`/developer-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`), {
          headers: getAuthHeaders()
        })
        .then(res => {
          if (!res.ok) return null;
          return res.json();
        })
        .catch(() => null)
      );
      
      const results = await Promise.all(promises);
      const validReports = results
        .filter(r => r && r.success && r.data)
        .map(r => r.data);
        
      if (validReports.length === 0) {
        showToast("No daily reports found in the selected date range.", "error");
        setMonthlyBasicDetails(null);
        return;
      }
      
      // Perform consolidation
      const consolidated = consolidateDeveloperReports(validReports);
      
      // Override basic details date range to match current range selection formatted nicely
      consolidated.basicDetails.date = `${formatDateString(monthlyStartDate)} to ${formatDateString(monthlyEndDate)}`;
      
      setMonthlyBasicDetails(consolidated.basicDetails);
      setMonthlyDailyTaskSummary(consolidated.dailyTaskSummary);
      setMonthlyDevelopmentTaskReport(consolidated.developmentTaskReport);
      setMonthlyResearchLearning(consolidated.researchLearning);
      setMonthlyPerformanceTracker(consolidated.performanceTracker);
      setMonthlyToolsUsed(consolidated.toolsUsed);
      setMonthlyChallengesFaced(consolidated.challengesFaced);
      setMonthlyNextDayPlan(consolidated.nextDayPlan);
      setMonthlyInternRemarks(consolidated.internRemarks);
      setMonthlyApproval(consolidated.approval);
      
      showToast(`Successfully consolidated ${validReports.length} reports!`, "success");
    } catch (e) {
      console.error("Consolidation error:", e);
      showToast("Failed to consolidate monthly data.", "error");
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const handleDownloadMonthlyPDF = async (mDetails, mTaskSummary, mDevReport, mResearch, mPerf, mTools, mChallenges, mPlan, mRemarks, mApproval) => {
    try {
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
          doc.setFontSize(22);
          doc.setTextColor(132, 204, 22);
          doc.text("KOD.", 14, 21);
          doc.setTextColor(60, 35, 117);
          doc.text("brand", 34, 21);
          resolve();
        };
      });

      // Document Title & Designation
      doc.setFontSize(13);
      doc.setTextColor(60, 35, 117);
      doc.text("MONTHLY CONSOLIDATED DEVELOPER REPORT", 85, 16);
      
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text("JUNIOR DEVELOPER / SOFTWARE & WEB DEVELOPER", 112, 22);

      currentY = 27;

      // 1. BASIC DETAILS
      drawSectionHeader("1. BASIC DETAILS");
      
      const basicDetailsRows = [
        ["Date Range", mDetails.date || ''],
        ["Employee Name:", mDetails.employeeName || ''],
        ["Employee ID", mDetails.employeeId || ''],
        ["Department", mDetails.department || ''],
        ["Designation", mDetails.designation || ''],
        ["Shift Timing", mDetails.shiftTiming || ''],
        ["Reporting To", mDetails.reportingTo || ''],
        ["Prepared Time", mDetails.preparedTime || '']
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
      
      const summaryHeaders = [["Activity", "Due Date", "Start Time", "End Time", "Status", "Remarks"]];
      const summaryRows = mTaskSummary.map(t => [
        t.activity || '',
        t.dueDate || '',
        t.startDate || '',
        t.endDate || '',
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
          0: { width: 45 },
          1: { width: 20 },
          2: { width: 20 },
          3: { width: 20 },
          4: { width: 20, halign: 'center' },
          5: { width: 57 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 3. DEVELOPMENT TASK REPORT
      drawSectionHeader("3. DEVELOPMENT TASK REPORT");
      
      const devHeaders = [["Project", "Development Activity", "Status", "Remark"]];
      const devRows = mDevReport.map(t => [
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

      // 4. RESEARCH & LEARNING ACTIVITIES
      drawSectionHeader("4. RESEARCH & LEARNING ACTIVITIES");
      
      const researchHeaders = [["Activity", "Details"]];
      const researchRows = mResearch.map(t => [
        t.activity || '',
        t.details || ''
      ]);

      autoTable(doc, {
        head: researchHeaders,
        body: researchRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 55 },
          1: { width: 127 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 5. DAILY PERFORMANCE TRACKER
      drawSectionHeader("5. PERFORMANCE TRACKER CONSOLIDATED");
      
      const perfHeaders = [["KPI", "STATUS"]];
      const perfRows = [
        ["Task Completed", mPerf.taskCompleted || ''],
        ["Learning Progress", mPerf.learningProgress || ''],
        ["Communication", mPerf.communication || ''],
        ["Attendance", mPerf.attendance || ''],
        ["Productivity", mPerf.productivity || '']
      ];

      autoTable(doc, {
        head: perfHeaders,
        body: perfRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 91, fontStyle: 'bold' },
          1: { width: 91, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      // Page break to start Page 2 fresh
      doc.addPage();
      currentY = 15;

      // 6. TOOLS AND SOFTWARE USED
      drawSectionHeader("6. TOOLS AND SOFTWARE USED");
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      const toolsLines = doc.splitTextToSize(mTools || '', 178);
      doc.text(toolsLines, 16, currentY + 5);
      const toolsBoxHeight = Math.max(12, toolsLines.length * 4.2 + 5);
      doc.setDrawColor(180, 180, 180);
      doc.rect(14, currentY, 182, toolsBoxHeight);
      currentY += toolsBoxHeight + 4;

      // 7. CHALLENGES FACED
      drawSectionHeader("7. CHALLENGES FACED");
      const challengesLines = doc.splitTextToSize(mChallenges || '', 178);
      doc.text(challengesLines, 16, currentY + 5);
      const challengesBoxHeight = Math.max(12, challengesLines.length * 4.2 + 5);
      doc.rect(14, currentY, 182, challengesBoxHeight);
      currentY += challengesBoxHeight + 4;

      // 8. PLANNED NEXT STEPS / NEXT PLAN
      drawSectionHeader("8. PLANNED NEXT STEPS / NEXT PLAN");
      const planLines = doc.splitTextToSize(mPlan || '', 178);
      doc.text(planLines, 16, currentY + 5);
      const planBoxHeight = Math.max(12, planLines.length * 4.2 + 5);
      doc.rect(14, currentY, 182, planBoxHeight);
      currentY += planBoxHeight + 4;

      // 9. DEVELOPER REMARKS
      drawSectionHeader("9. REMARKS");
      const remarksLines = doc.splitTextToSize(mRemarks || '', 178);
      doc.text(remarksLines, 16, currentY + 5);
      const remarksBoxHeight = Math.max(12, remarksLines.length * 4.2 + 5);
      doc.rect(14, currentY, 182, remarksBoxHeight);
      currentY += remarksBoxHeight + 4;

      // 10. APPROVAL
      drawSectionHeader("10. APPROVAL");
      const approvalHeaders = [["Name", "Signature", "Date"]];
      const approvalRows = [
        [
          `Developer: ${mApproval.internName || ''}`,
          mApproval.internSignature || '',
          mApproval.internDate || ''
        ],
        [
          `HOD - R&D / Developer: ${mApproval.hodName || ''}`,
          mApproval.hodSignature || '',
          mApproval.hodDate || ''
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
      const filename = `Monthly_Consolidated_Developer_Report_${mDetails.employeeName || 'Developer'}_${mDetails.date.replace(/ /g, '_')}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, mDetails.date || selectedDate, pdfBlob, filename, 'developer', 'monthly');
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

  // Download PDF
  const handleDownloadPDF = async () => {
    // Automatically save report as well
    await handleSaveReport();

    try {
      showToast("Generating Developer Shift PDF report...", "info");

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let currentY = 15;
      
      const checkHeightAndAddPage = (neededHeight) => {
        if (currentY + neededHeight > 270) {
          doc.addPage();
          currentY = 15;
        }
      };

      const drawSectionHeader = (title) => {
        checkHeightAndAddPage(12);
        doc.setFillColor(60, 35, 117);
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
          doc.setFontSize(22);
          doc.setTextColor(132, 204, 22);
          doc.text("KOD.", 14, 21);
          doc.setTextColor(60, 35, 117);
          doc.text("brand", 34, 21);
          resolve();
        };
      });

      // Document Title & Designation
      doc.setFontSize(13);
      doc.setTextColor(60, 35, 117);
      doc.text("DAILY DEVELOPER SHIFT REPORT", 85, 16);
      
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text("SOFTWARE & WEB DEVELOPER / R&D", 112, 22);

      currentY = 27;

      // 1. BASIC DETAILS
      const validBasicRows = [
        ["Date", basicDetails.date || selectedDate],
        ["Day", basicDetails.day || ''],
        ["Employee Name", basicDetails.employeeName || ''],
        ["Employee ID", basicDetails.employeeId || ''],
        ["Department", basicDetails.department || 'Software Development / R&D'],
        ["Designation", basicDetails.designation || 'Developer'],
        ["Shift Timing", basicDetails.shiftTiming || ''],
        ["Reporting To", basicDetails.reportingTo || ''],
        ["Prepared Time", basicDetails.preparedTime || '']
      ].filter(r => r[1] && String(r[1]).trim() !== '');

      if (validBasicRows.length > 0) {
        drawSectionHeader("1. BASIC DETAILS");
        autoTable(doc, {
          body: validBasicRows,
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

      // 2. DAILY TASK SUMMARY
      const summaryHeaders = [["Activity", "Due Date", "Start Time", "End Time", "Status", "Remarks"]];
      const validSummaryRows = dailyTaskSummary
        .map(t => [t.activity || '', t.dueDate || '', t.startDate || '', t.endDate || '', t.status || '', t.remarks || t.remark || ''])
        .filter(row => row.some(cell => cell && String(cell).trim() !== ''));

      if (validSummaryRows.length > 0) {
        drawSectionHeader("2. DAILY TASK SUMMARY");
        autoTable(doc, {
          head: summaryHeaders,
          body: validSummaryRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15, overflow: 'linebreak' },
          columnStyles: {
            0: { width: 45 },
            1: { width: 20 },
            2: { width: 20 },
            3: { width: 20 },
            4: { width: 20, halign: 'center' },
            5: { width: 57 }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 3. DEVELOPMENT TASK REPORT
      const devHeaders = [["Project", "Development Activity", "Status", "Remark"]];
      const validDevRows = developmentTaskReport
        .map(t => [t.project || '', t.activity || '', t.status || '', t.remark || t.remarks || ''])
        .filter(row => row.some(cell => cell && String(cell).trim() !== ''));

      if (validDevRows.length > 0) {
        drawSectionHeader("3. DEVELOPMENT TASK REPORT");
        autoTable(doc, {
          head: devHeaders,
          body: validDevRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15, overflow: 'linebreak' },
          columnStyles: {
            0: { width: 35 },
            1: { width: 75 },
            2: { width: 35, halign: 'center' },
            3: { width: 37 }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 4. RESEARCH & LEARNING ACTIVITIES
      const researchHeaders = [["Activity", "Details"]];
      const validResearchRows = researchLearning
        .map(t => [t.activity || '', t.details || ''])
        .filter(row => row.some(cell => cell && String(cell).trim() !== ''));

      if (validResearchRows.length > 0) {
        drawSectionHeader("4. RESEARCH & LEARNING ACTIVITIES");
        autoTable(doc, {
          head: researchHeaders,
          body: validResearchRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15, overflow: 'linebreak' },
          columnStyles: {
            0: { width: 55 },
            1: { width: 127 }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 5. PERFORMANCE TRACKER
      const perfHeaders = [["KPI", "STATUS"]];
      const validPerfRows = [
        ["Task Completed", performanceTracker.taskCompleted || ''],
        ["Learning Progress", performanceTracker.learningProgress || ''],
        ["Communication", performanceTracker.communication || ''],
        ["Attendance", performanceTracker.attendance || ''],
        ["Productivity", performanceTracker.productivity || '']
      ].filter(r => r[1] && String(r[1]).trim() !== '');

      if (validPerfRows.length > 0) {
        drawSectionHeader("5. PERFORMANCE TRACKER");
        autoTable(doc, {
          head: perfHeaders,
          body: validPerfRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15, overflow: 'linebreak' },
          columnStyles: {
            0: { width: 91, fontStyle: 'bold' },
            1: { width: 91, halign: 'center' }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 4;
      }

      // 6. TOOLS AND SOFTWARE USED
      if (toolsUsed && String(toolsUsed).trim() !== '') {
        const toolsLines = doc.splitTextToSize(String(toolsUsed), 178);
        const toolsBoxHeight = Math.max(12, toolsLines.length * 4.2 + 5);
        checkHeightAndAddPage(toolsBoxHeight + 14);
        drawSectionHeader("6. TOOLS AND SOFTWARE USED");
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(toolsLines, 16, currentY + 5);
        doc.setDrawColor(180, 180, 180);
        doc.rect(14, currentY, 182, toolsBoxHeight);
        currentY += toolsBoxHeight + 4;
      }

      // 7. CHALLENGES FACED
      if (challengesFaced && String(challengesFaced).trim() !== '') {
        const challengesLines = doc.splitTextToSize(String(challengesFaced), 178);
        const challengesBoxHeight = Math.max(12, challengesLines.length * 4.2 + 5);
        checkHeightAndAddPage(challengesBoxHeight + 14);
        drawSectionHeader("7. CHALLENGES FACED");
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(challengesLines, 16, currentY + 5);
        doc.setDrawColor(180, 180, 180);
        doc.rect(14, currentY, 182, challengesBoxHeight);
        currentY += challengesBoxHeight + 4;
      }

      // 8. PLANNED NEXT STEPS / NEXT PLAN
      if (nextDayPlan && String(nextDayPlan).trim() !== '') {
        const planLines = doc.splitTextToSize(String(nextDayPlan), 178);
        const planBoxHeight = Math.max(12, planLines.length * 4.2 + 5);
        checkHeightAndAddPage(planBoxHeight + 14);
        drawSectionHeader("8. PLANNED NEXT STEPS / NEXT PLAN");
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(planLines, 16, currentY + 5);
        doc.setDrawColor(180, 180, 180);
        doc.rect(14, currentY, 182, planBoxHeight);
        currentY += planBoxHeight + 4;
      }

      // 9. DEVELOPER REMARKS
      const activeRemarks = internRemarks || '';
      if (activeRemarks && String(activeRemarks).trim() !== '') {
        const remarksLines = doc.splitTextToSize(String(activeRemarks), 178);
        const remarksBoxHeight = Math.max(12, remarksLines.length * 4.2 + 5);
        checkHeightAndAddPage(remarksBoxHeight + 14);
        drawSectionHeader("9. REMARKS");
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(remarksLines, 16, currentY + 5);
        doc.setDrawColor(180, 180, 180);
        doc.rect(14, currentY, 182, remarksBoxHeight);
        currentY += remarksBoxHeight + 4;
      }

      // 10. APPROVAL
      drawSectionHeader("10. APPROVAL");
      const approvalHeaders = [["Role / Field", "Signature", "Date"]];
      const approvalRows = [
        [
          `Developer: ${approval.internName || basicDetails.employeeName || ''}`,
          approval.internSignature || '',
          approval.internDate || basicDetails.date || selectedDate
        ]
      ];
      if (approval.hodName || approval.hodSignature) {
        approvalRows.push([
          `HOD - R&D / Developer: ${approval.hodName || ''}`,
          approval.hodSignature || '',
          approval.hodDate || ''
        ]);
      }

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
                console.error("Failed to add signature image:", e);
              }
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      const pdfBlob = doc.output('blob');
      const filename = `Developer_Report_${(basicDetails.employeeName || 'Developer').replace(/[^a-zA-Z0-9_-]/g, '_')}_${selectedDate}.pdf`;
      try {
        const targetUserId = selectedUserId || currentUser._id || currentUser.id || localStorage.getItem('user_id') || '';
        if (targetUserId) {
          await uploadCompiledPDFReport(targetUserId, selectedDate, pdfBlob, filename, 'developer', 'daily');
        }
      } catch (uploadErr) {
        console.error("Failed to upload developer PDF (saving locally anyway):", uploadErr);
      }
      doc.save(filename);
      showToast("Developer PDF report downloaded successfully!", "success");
    } catch (e) {
      console.error("Developer PDF generation error:", e);
      showToast("Failed to download Developer PDF.", "error");
    }
  };;

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
    setDailyTaskSummary([...dailyTaskSummary, { activity: '', status: 'Pending', dueDate: '', startDate: '', endDate: '', remarks: '' }]);
  };
  
  const removeSummaryRow = (index) => {
    if (dailyTaskSummary.length > 1) {
      setDailyTaskSummary(dailyTaskSummary.filter((_, i) => i !== index));
    }
  };

  const addDevRow = () => {
    setDevelopmentTaskReport([...developmentTaskReport, { project: '', activity: '', status: 'ongoing', remark: '' }]);
  };

  const removeDevRow = (index) => {
    if (developmentTaskReport.length > 1) {
      setDevelopmentTaskReport(developmentTaskReport.filter((_, i) => i !== index));
    }
  };

  const addResearchRow = () => {
    setResearchLearning([...researchLearning, { activity: '', details: '' }]);
  };

  const removeResearchRow = (index) => {
    if (researchLearning.length > 1) {
      setResearchLearning(researchLearning.filter((_, i) => i !== index));
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
      <div className="flex-1 min-w-0 w-full bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md rounded-3xl p-6 lg:p-8 shadow-sm">
        
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
                  Daily Shift Report
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fill, review, and export shift report details.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all border border-indigo-100 dark:border-indigo-900/50"
                >
                  <FileText size={16} />
                  Monthly Report
                </button>

                

                <AiAnalyzeButton
                  onClick={() => {
                    setAiModalContext({
                      employeeName: basicDetails.employeeName,
                      department: 'Software Development / R&D',
                      designation: basicDetails.designation,
                      date: selectedDate,
                      actualReportContentText: JSON.stringify({ basicDetails, dailyTasks: dailyTaskSummary, developmentTaskReport, researchLearning, toolsUsed, challengesFaced, nextDayPlan, internRemarks })
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
              title="Developer Report AI Analysis"
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
              <div className="flex justify-between items-center">
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
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-lime-400 hover:opacity-80 cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Activity
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
                      <th className="px-2 py-3.5 w-[5%] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dailyTaskSummary.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-4 py-3 relative group">
                          <div className="flex items-start gap-1.5">
                            <textarea
                              rows={2}
                              value={row.activity || ''}
                              onChange={(e) => {
                                const newArr = [...dailyTaskSummary];
                                newArr[i].activity = e.target.value;
                                setDailyTaskSummary(newArr);
                              }}
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                              placeholder="Enter activity name"
                            />
                            {row.activity && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(row.activity)}
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                title="View full text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 vertical-top">
                          <input
                            type="date"
                            value={row.dueDate || ''}
                            onChange={(e) => {
                              const newArr = [...dailyTaskSummary];
                              newArr[i].dueDate = e.target.value;
                              setDailyTaskSummary(newArr);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-3 vertical-top">
                          <input
                            type="text"
                            placeholder="DD-MM-YYYY HH:mm"
                            value={row.startDate || ''}
                            onChange={(e) => {
                              const newArr = [...dailyTaskSummary];
                              newArr[i].startDate = e.target.value;
                              setDailyTaskSummary(newArr);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-3 vertical-top">
                          <input
                            type="text"
                            placeholder="DD-MM-YYYY HH:mm"
                            value={row.endDate || ''}
                            onChange={(e) => {
                              const newArr = [...dailyTaskSummary];
                              newArr[i].endDate = e.target.value;
                              setDailyTaskSummary(newArr);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-center vertical-top">
                          <select
                            value={row.status}
                            onChange={(e) => {
                              const newArr = [...dailyTaskSummary];
                              newArr[i].status = e.target.value;
                              setDailyTaskSummary(newArr);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                          >
                            <option value="Done">Done</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Pending">Pending</option>
                            <option value="NA">NA</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 vertical-top">
                          <textarea
                            rows={2}
                            value={row.remarks || ''}
                            onChange={(e) => {
                              const newArr = [...dailyTaskSummary];
                              newArr[i].remarks = e.target.value;
                              setDailyTaskSummary(newArr);
                            }}
                            className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                            placeholder="Add remarks"
                          />
                        </td>
                        <td className="px-2 py-3 text-center vertical-top">
                          <button
                            type="button"
                            onClick={() => removeSummaryRow(i)}
                            className="text-rose-500 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
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

            {/* 3. DEVELOPMENT TASK REPORT */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">3</span>
                  Development Task Report
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('developmentTaskReport')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={addDevRow}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-lime-400 hover:opacity-80 cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Project
                  </button>
                </div>
              </div>

              {hiddenSections.developmentTaskReport ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Development Task Report (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('developmentTaskReport')}
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
                      <th className="px-4 py-3.5 w-[20%]">Project</th>
                      <th className="px-4 py-3.5 w-[40%]">Development Activity</th>
                      <th className="px-3 py-3.5 w-[15%] text-center">Status</th>
                      <th className="px-4 py-3.5 w-[20%]">Remark</th>
                      <th className="px-2 py-3.5 w-[5%] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {developmentTaskReport.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-4 py-3 vertical-top">
                          <input
                            type="text"
                            value={row.project || ''}
                            onChange={(e) => {
                              const newArr = [...developmentTaskReport];
                              newArr[i].project = e.target.value;
                              setDevelopmentTaskReport(newArr);
                            }}
                            className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="e.g. CRM"
                          />
                        </td>
                        <td className="px-4 py-3 vertical-top relative group">
                          <div className="flex items-start gap-1.5">
                            <textarea
                              rows={2}
                              value={row.activity || ''}
                              onChange={(e) => {
                                const newArr = [...developmentTaskReport];
                                newArr[i].activity = e.target.value;
                                setDevelopmentTaskReport(newArr);
                              }}
                              onKeyDown={(e) => handleAutoListKeyDown(e, row.activity || '', (newVal) => {
                                const newArr = [...developmentTaskReport];
                                newArr[i].activity = newVal;
                                setDevelopmentTaskReport(newArr);
                              })}
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                              placeholder="- Description of work done"
                            />
                            {row.activity && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(row.activity)}
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                title="View full text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center vertical-top">
                          <input
                            type="text"
                            value={row.status || ''}
                            onChange={(e) => {
                              const newArr = [...developmentTaskReport];
                              newArr[i].status = e.target.value;
                              setDevelopmentTaskReport(newArr);
                            }}
                            className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center"
                            placeholder="e.g. ongoing / done"
                          />
                        </td>
                        <td className="px-4 py-3 vertical-top">
                          <textarea
                            rows={2}
                            value={row.remark || ''}
                            onChange={(e) => {
                              const newArr = [...developmentTaskReport];
                              newArr[i].remark = e.target.value;
                              setDevelopmentTaskReport(newArr);
                            }}
                            className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                            placeholder="Add remark"
                          />
                        </td>
                        <td className="px-2 py-3 text-center vertical-top">
                          <button
                            type="button"
                            onClick={() => removeDevRow(i)}
                            className="text-rose-500 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
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

            {/* 4. RESEARCH & LEARNING ACTIVITIES */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">4</span>
                  Research & Learning Activities
                </h2>
                <button
                  type="button"
                  onClick={addResearchRow}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-lime-400 hover:opacity-80"
                >
                  <Plus size={14} />
                  Add Activity
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3.5 w-[30%]">Activity</th>
                      <th className="px-3 py-3.5 w-[15%]">Due Date</th>
                      <th className="px-4 py-3.5 w-[50%]">Details</th>
                      <th className="px-2 py-3.5 w-[5%] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {researchLearning.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-4 py-3 vertical-top relative group">
                          <div className="flex items-start gap-1.5">
                            <input
                              type="text"
                              value={row.activity || ''}
                              onChange={(e) => {
                                const newArr = [...researchLearning];
                                newArr[i].activity = e.target.value;
                                setResearchLearning(newArr);
                              }}
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              placeholder="Activity name"
                            />
                            {row.activity && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityText(row.activity)}
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                title="View full text"
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 vertical-top">
                          <input
                            type="date"
                            value={row.dueDate || ''}
                            onChange={(e) => {
                              const newArr = [...researchLearning];
                              newArr[i].dueDate = e.target.value;
                              setResearchLearning(newArr);
                            }}
                            className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 vertical-top">
                          <textarea
                            rows={2}
                            value={row.details || ''}
                            onChange={(e) => {
                              const newArr = [...researchLearning];
                              newArr[i].details = e.target.value;
                              setResearchLearning(newArr);
                            }}
                            className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                            placeholder="Enter details"
                          />
                        </td>
                        <td className="px-2 py-3 text-center vertical-top">
                          <button
                            type="button"
                            onClick={() => removeResearchRow(i)}
                            className="text-rose-500 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. DAILY PERFORMANCE TRACKER */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5</span>
                Daily Performance Tracker
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Task Completed</label>
                  <select
                    value={performanceTracker.taskCompleted || 'Good'}
                    onChange={(e) => setPerformanceTracker({ ...performanceTracker, taskCompleted: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="Good">Good</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Satisfactory">Satisfactory</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Learning Progress</label>
                  <select
                    value={performanceTracker.learningProgress || 'Improving'}
                    onChange={(e) => setPerformanceTracker({ ...performanceTracker, learningProgress: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="Improving">Improving</option>
                    <option value="Good">Good</option>
                    <option value="Slow">Slow</option>
                    <option value="NA">NA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Communication</label>
                  <select
                    value={performanceTracker.communication || 'Good'}
                    onChange={(e) => setPerformanceTracker({ ...performanceTracker, communication: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="Good">Good</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Average">Average</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Attendance</label>
                  <select
                    value={performanceTracker.attendance || 'Present'}
                    onChange={(e) => setPerformanceTracker({ ...performanceTracker, attendance: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Half Day">Half Day</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Productivity</label>
                  <select
                    value={performanceTracker.productivity || 'Present'}
                    onChange={(e) => setPerformanceTracker({ ...performanceTracker, productivity: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="Present">Present</option>
                    <option value="Highly Productive">Highly Productive</option>
                    <option value="Average">Average</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 6. TOOLS AND SOFTWARE USED */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">6</span>
                Tools and Software Used
              </h2>
              <textarea
                value={toolsUsed}
                onChange={(e) => setToolsUsed(e.target.value)}
                placeholder="e.g. VS Code, Git, Chrome DevTools, Postman"
                className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
              />
            </div>

            {/* 7. CHALLENGES FACED */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">7</span>
                Challenges Faced
              </h2>
              <textarea
                value={challengesFaced}
                onChange={(e) => setChallengesFaced(e.target.value)}
                placeholder="Describe any blockers or challenges faced today"
                className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
              />
            </div>

            {/* 8. NEXT DAY PLAN */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">8</span>
                Next Day Plan
              </h2>
              <textarea
                value={nextDayPlan}
                onChange={(e) => setNextDayPlan(e.target.value)}
                placeholder="List tasks planned for tomorrow"
                className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
              />
            </div>

            {/* 9. INTERN / STUDENT REMARKS */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">8</span>
                 Remarks
              </h2>
              <textarea
                value={internRemarks}
                onChange={(e) => setInternRemarks(e.target.value)}
                placeholder="Any special remarks or suggestions"
                className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
              />
            </div>

            {/* 10. APPROVAL */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">9</span>
                Approval Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Developer</h4>
                  <div>
                    <label className="block text-xs mb-1">Name</label>
                    <input
                      type="text"
                      value={approval.internName || ''}
                      onChange={(e) => setApproval({ ...approval, internName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Signature</label>
                    <SignatureUpload
                      value={approval.internSignature || ''}
                      onChange={(val) => setApproval({ ...approval, internSignature: val })}
                      placeholder="Upload developer signature"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Date</label>
                    <input
                      type="text"
                      value={approval.internDate || ''}
                      onChange={(e) => setApproval({ ...approval, internDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">HOD - R&D / Developer</h4>
                  <div>
                    <label className="block text-xs mb-1">Name</label>
                    <input
                      type="text"
                      value={approval.hodName || ''}
                      onChange={(e) => setApproval({ ...approval, hodName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Signature</label>
                    <SignatureUpload
                      value={approval.hodSignature || ''}
                      onChange={(val) => setApproval({ ...approval, hodSignature: val })}
                      placeholder="Upload HOD signature"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Date</label>
                    <input
                      type="text"
                      value={approval.hodDate || ''}
                      onChange={(e) => setApproval({ ...approval, hodDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Form Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 w-full">
              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all border border-indigo-100 dark:border-indigo-900/50"
              >
                <FileText size={16} />
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

      {/* Monthly Consolidation Modal */}
      <AnimatePresence>
        {isMonthlyModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-start pt-10 px-4 pb-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                      Monthly Consolidated Report
                    </h3>
                    <p className="text-xs text-slate-500">
                      Consolidate daily developer shift reports across a date range.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Step 1: Range Selector */}
                <div className="flex flex-wrap items-end gap-4 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                    <input
                      type="date"
                      value={monthlyStartDate}
                      onChange={(e) => setMonthlyStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
                    <input
                      type="date"
                      value={monthlyEndDate}
                      onChange={(e) => setMonthlyEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchMonthlyData}
                    disabled={isMonthlyLoading}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isMonthlyLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Fetch & Consolidate
                  </button>
                </div>

                {/* Step 2: Tabbed Editor */}
                {monthlyBasicDetails ? (
                  <div className="space-y-4">
                    {/* Tabs Selector */}
                    <div className="flex flex-wrap gap-1 border-b border-slate-100 dark:border-slate-800 pb-1">
                      {[
                        { id: 'basic', label: '1. Basic Info' },
                        { id: 'summary', label: '2. Task Summary' },
                        { id: 'dev', label: '3. Dev Report' },
                        { id: 'research', label: '4. Research' },
                        { id: 'tracker', label: '5. Performance & KPI' },
                        { id: 'remarks', label: '6. Text Fields' },
                        { id: 'approval', label: '7. Approval' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setMonthlyActiveTab(tab.id)}
                          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x -mb-[1px] transition-all
                            ${monthlyActiveTab === tab.id
                              ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-lime-400 font-bold'
                              : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab Contents */}
                    <div className="min-h-[350px]">
                      {/* Tab 1: Basic Details */}
                      {monthlyActiveTab === 'basic' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Date Range</label>
                            <input
                              type="text"
                              value={monthlyBasicDetails.date || ''}
                              onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, date: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Employee Name</label>
                            <input
                              type="text"
                              value={monthlyBasicDetails.employeeName || ''}
                              onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, employeeName: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Employee ID</label>
                            <input
                              type="text"
                              value={monthlyBasicDetails.employeeId || ''}
                              onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, employeeId: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
                            <input
                              type="text"
                              value={monthlyBasicDetails.department || ''}
                              onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, department: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
                            <input
                              type="text"
                              value={monthlyBasicDetails.designation || ''}
                              onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, designation: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Shift Timing</label>
                            <input
                              type="text"
                              value={monthlyBasicDetails.shiftTiming || ''}
                              onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, shiftTiming: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Reporting Manager</label>
                            <input
                              type="text"
                              value={monthlyBasicDetails.reportingTo || ''}
                              onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, reportingTo: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Prepared Time</label>
                            <input
                              type="text"
                              value={monthlyBasicDetails.preparedTime || ''}
                              onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, preparedTime: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Daily Task Summary Consolidated */}
                      {monthlyActiveTab === 'summary' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wide">Daily Task Summary</h4>
                            <button
                              type="button"
                              onClick={() => setMonthlyDailyTaskSummary([...monthlyDailyTaskSummary, { activity: '', status: 'Pending', dueDate: '', startDate: '', endDate: '', remarks: '' }])}
                              className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-lime-400 hover:opacity-80"
                            >
                              <Plus size={14} /> Add Row
                            </button>
                          </div>
                          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                  <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                                  <th className="px-4 py-3">Due Date</th>
                                  <th className="px-4 py-3">Start Time</th>
                                  <th className="px-4 py-3">End Time</th>
                                  <th className="px-4 py-3 w-40">Status</th>
                                  <th className="px-4 py-3">Remarks</th>
                                  <th className="px-4 py-3 w-12 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                {monthlyDailyTaskSummary.map((row, i) => (
                                  <tr key={i} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/10">
                                    <td className="px-4 py-2.5 relative group">
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="text"
                                          value={row.activity}
                                          onChange={(e) => {
                                            const newArr = [...monthlyDailyTaskSummary];
                                            newArr[i].activity = e.target.value;
                                            setMonthlyDailyTaskSummary(newArr);
                                          }}
                                          className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                                          placeholder="Activity"
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
                                          const newArr = [...monthlyDailyTaskSummary];
                                          newArr[i].dueDate = e.target.value;
                                          setMonthlyDailyTaskSummary(newArr);
                                        }}
                                        className="bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-300 w-full"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <input
                                        type="date"
                                        value={row.startDate || ''}
                                        onChange={(e) => {
                                          const newArr = [...monthlyDailyTaskSummary];
                                          newArr[i].startDate = e.target.value;
                                          setMonthlyDailyTaskSummary(newArr);
                                        }}
                                        className="bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-300 w-full"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <input
                                        type="date"
                                        value={row.endDate || ''}
                                        onChange={(e) => {
                                          const newArr = [...monthlyDailyTaskSummary];
                                          newArr[i].endDate = e.target.value;
                                          setMonthlyDailyTaskSummary(newArr);
                                        }}
                                        className="bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-300 w-full"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <select
                                        value={row.status}
                                        onChange={(e) => {
                                          const newArr = [...monthlyDailyTaskSummary];
                                          newArr[i].status = e.target.value;
                                          setMonthlyDailyTaskSummary(newArr);
                                        }}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                      >
                                        <option value="Done">Done</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Pending">Pending</option>
                                        <option value="NA">NA</option>
                                      </select>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <input
                                        type="text"
                                        value={row.remarks}
                                        onChange={(e) => {
                                          const newArr = [...monthlyDailyTaskSummary];
                                          newArr[i].remarks = e.target.value;
                                          setMonthlyDailyTaskSummary(newArr);
                                        }}
                                        className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                                        placeholder="Remarks"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => setMonthlyDailyTaskSummary(monthlyDailyTaskSummary.filter((_, idx) => idx !== i))}
                                        className="text-rose-500 hover:text-rose-600 animate-colors"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Tab 3: Development Task Report */}
                      {monthlyActiveTab === 'dev' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wide">Development Task Report</h4>
                            <button
                              type="button"
                              onClick={() => setMonthlyDevelopmentTaskReport([...monthlyDevelopmentTaskReport, { project: '', activity: '', status: 'ongoing', remark: '' }])}
                              className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-lime-400 hover:opacity-80"
                            >
                              <Plus size={14} /> Add Row
                            </button>
                          </div>
                          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                  <th className="px-4 py-3.5 w-[20%]">Project</th>
                                  <th className="px-4 py-3.5 w-[40%]">Development Activity</th>
                                  <th className="px-3 py-3.5 w-[15%] text-center">Status</th>
                                  <th className="px-4 py-3.5 w-[20%]">Remark</th>
                                  <th className="px-2 py-3.5 w-[5%] text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {monthlyDevelopmentTaskReport.map((row, i) => (
                                  <tr key={i} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                    <td className="px-4 py-3 vertical-top">
                                      <input
                                        type="text"
                                        value={row.project || ''}
                                        onChange={(e) => {
                                          const newArr = [...monthlyDevelopmentTaskReport];
                                          newArr[i].project = e.target.value;
                                          setMonthlyDevelopmentTaskReport(newArr);
                                        }}
                                        className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Project"
                                      />
                                    </td>
                                    <td className="px-4 py-3 vertical-top relative group">
                                      <div className="flex items-start gap-1.5">
                                        <textarea
                                          rows={2}
                                          value={row.activity || ''}
                                          onChange={(e) => {
                                            const newArr = [...monthlyDevelopmentTaskReport];
                                            newArr[i].activity = e.target.value;
                                            setMonthlyDevelopmentTaskReport(newArr);
                                          }}
                                          className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                                          placeholder="Activity details"
                                        />
                                        {row.activity && (
                                          <button
                                            type="button"
                                            onClick={() => setSelectedActivityText(row.activity)}
                                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                            title="View full text"
                                          >
                                            <Maximize2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-center vertical-top">
                                      <input
                                        type="text"
                                        value={row.status || ''}
                                        onChange={(e) => {
                                          const newArr = [...monthlyDevelopmentTaskReport];
                                          newArr[i].status = e.target.value;
                                          setMonthlyDevelopmentTaskReport(newArr);
                                        }}
                                        className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center"
                                        placeholder="Status"
                                      />
                                    </td>
                                    <td className="px-4 py-3 vertical-top">
                                      <textarea
                                        rows={2}
                                        value={row.remark || ''}
                                        onChange={(e) => {
                                          const newArr = [...monthlyDevelopmentTaskReport];
                                          newArr[i].remark = e.target.value;
                                          setMonthlyDevelopmentTaskReport(newArr);
                                        }}
                                        className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                                        placeholder="Remark"
                                      />
                                    </td>
                                    <td className="px-2 py-3 text-center vertical-top">
                                      <button
                                        type="button"
                                        onClick={() => setMonthlyDevelopmentTaskReport(monthlyDevelopmentTaskReport.filter((_, idx) => idx !== i))}
                                        className="text-rose-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Tab 4: Research & Learning */}
                      {monthlyActiveTab === 'research' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wide">Research & Learning Activities</h4>
                            <button
                              type="button"
                              onClick={() => setMonthlyResearchLearning([...monthlyResearchLearning, { activity: '', details: '' }])}
                              className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-lime-400 hover:opacity-80"
                            >
                              <Plus size={14} /> Add Row
                            </button>
                          </div>
                          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                  <th className="px-4 py-3.5 w-[30%]">Activity</th>
                                  <th className="px-3 py-3.5 w-[15%]">Due Date</th>
                                  <th className="px-4 py-3.5 w-[50%]">Details</th>
                                  <th className="px-2 py-3.5 w-[5%] text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {monthlyResearchLearning.map((row, i) => (
                                  <tr key={i} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                    <td className="px-4 py-3 vertical-top relative group">
                                      <div className="flex items-start gap-1.5">
                                        <input
                                          type="text"
                                          value={row.activity || ''}
                                          onChange={(e) => {
                                            const newArr = [...monthlyResearchLearning];
                                            newArr[i].activity = e.target.value;
                                            setMonthlyResearchLearning(newArr);
                                          }}
                                          className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                          placeholder="Activity"
                                        />
                                        {row.activity && (
                                          <button
                                            type="button"
                                            onClick={() => setSelectedActivityText(row.activity)}
                                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                            title="View full text"
                                          >
                                            <Maximize2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 vertical-top">
                                      <input
                                        type="date"
                                        value={row.dueDate || ''}
                                        onChange={(e) => {
                                          const newArr = [...monthlyResearchLearning];
                                          newArr[i].dueDate = e.target.value;
                                          setMonthlyResearchLearning(newArr);
                                        }}
                                        className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                      />
                                    </td>
                                    <td className="px-4 py-3 vertical-top">
                                      <textarea
                                        rows={2}
                                        value={row.details || ''}
                                        onChange={(e) => {
                                          const newArr = [...monthlyResearchLearning];
                                          newArr[i].details = e.target.value;
                                          setMonthlyResearchLearning(newArr);
                                        }}
                                        className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[44px]"
                                        placeholder="Details"
                                      />
                                    </td>
                                    <td className="px-2 py-3 text-center vertical-top">
                                      <button
                                        type="button"
                                        onClick={() => setMonthlyResearchLearning(monthlyResearchLearning.filter((_, idx) => idx !== i))}
                                        className="text-rose-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Tab 5: Performance Tracker */}
                      {monthlyActiveTab === 'tracker' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Task Completed</label>
                            <select
                              value={monthlyPerformanceTracker.taskCompleted || 'Good'}
                              onChange={(e) => setMonthlyPerformanceTracker({ ...monthlyPerformanceTracker, taskCompleted: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            >
                              <option value="Good">Good</option>
                              <option value="Excellent">Excellent</option>
                              <option value="Satisfactory">Satisfactory</option>
                              <option value="Poor">Poor</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Learning Progress</label>
                            <select
                              value={monthlyPerformanceTracker.learningProgress || 'Improving'}
                              onChange={(e) => setMonthlyPerformanceTracker({ ...monthlyPerformanceTracker, learningProgress: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            >
                              <option value="Improving">Improving</option>
                              <option value="Good">Good</option>
                              <option value="Slow">Slow</option>
                              <option value="NA">NA</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Communication</label>
                            <select
                              value={monthlyPerformanceTracker.communication || 'Good'}
                              onChange={(e) => setMonthlyPerformanceTracker({ ...monthlyPerformanceTracker, communication: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            >
                              <option value="Good">Good</option>
                              <option value="Excellent">Excellent</option>
                              <option value="Average">Average</option>
                              <option value="Poor">Poor</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Attendance</label>
                            <select
                              value={monthlyPerformanceTracker.attendance || 'Present'}
                              onChange={(e) => setMonthlyPerformanceTracker({ ...monthlyPerformanceTracker, attendance: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            >
                              <option value="Present">Present</option>
                              <option value="Absent">Absent</option>
                              <option value="Half Day">Half Day</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Productivity</label>
                            <select
                              value={monthlyPerformanceTracker.productivity || 'Present'}
                              onChange={(e) => setMonthlyPerformanceTracker({ ...monthlyPerformanceTracker, productivity: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            >
                              <option value="Present">Present</option>
                              <option value="Highly Productive">Highly Productive</option>
                              <option value="Average">Average</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Tab 6: Text Fields */}
                      {monthlyActiveTab === 'remarks' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tools and Software Used</label>
                            <textarea
                              value={monthlyToolsUsed}
                              onChange={(e) => setMonthlyToolsUsed(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-805 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Challenges Faced</label>
                            <textarea
                              value={monthlyChallengesFaced}
                              onChange={(e) => setMonthlyChallengesFaced(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-805 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Next Plan (Planned Next Steps)</label>
                            <textarea
                              value={monthlyNextDayPlan}
                              onChange={(e) => setMonthlyNextDayPlan(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-805 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"> Remarks</label>
                            <textarea
                              value={monthlyInternRemarks}
                              onChange={(e) => setMonthlyInternRemarks(e.target.value)}
                              className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-805 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Tab 7: Approval */}
                      {monthlyActiveTab === 'approval' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="space-y-3">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Developer</h4>
                            <div>
                              <label className="block text-xs mb-1">Name</label>
                              <input
                                type="text"
                                value={monthlyApproval.internName || ''}
                                onChange={(e) => setMonthlyApproval({ ...monthlyApproval, internName: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1">Signature</label>
                              <SignatureUpload
                                value={monthlyApproval.internSignature || ''}
                                onChange={(val) => setMonthlyApproval({ ...monthlyApproval, internSignature: val })}
                                placeholder="Upload developer signature"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1">Date</label>
                              <input
                                type="text"
                                value={monthlyApproval.internDate || ''}
                                onChange={(e) => setMonthlyApproval({ ...monthlyApproval, internDate: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">HOD - R&D / Developer</h4>
                            <div>
                              <label className="block text-xs mb-1">Name</label>
                              <input
                                type="text"
                                value={monthlyApproval.hodName || ''}
                                onChange={(e) => setMonthlyApproval({ ...monthlyApproval, hodName: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1">Signature</label>
                              <SignatureUpload
                                value={monthlyApproval.hodSignature || ''}
                                onChange={(val) => setMonthlyApproval({ ...monthlyApproval, hodSignature: val })}
                                placeholder="Upload HOD signature"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1">Date</label>
                              <input
                                type="text"
                                value={monthlyApproval.hodDate || ''}
                                onChange={(e) => setMonthlyApproval({ ...monthlyApproval, hodDate: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <FileText size={48} className="opacity-20 mb-3" />
                    <p className="text-sm">Select date range and click "Fetch & Consolidate" to generate monthly report data.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all"
                >
                  Close
                </button>
                {monthlyBasicDetails && (
                  <button
                    type="button"
                    onClick={() => handleDownloadMonthlyPDF(
                      monthlyBasicDetails,
                      monthlyDailyTaskSummary,
                      monthlyDevelopmentTaskReport,
                      monthlyResearchLearning,
                      monthlyPerformanceTracker,
                      monthlyToolsUsed,
                      monthlyChallengesFaced,
                      monthlyNextDayPlan,
                      monthlyInternRemarks,
                      monthlyApproval
                    )}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10"
                  >
                    <Download size={16} />
                    Download Monthly PDF
                  </button>
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

export default DeveloperReportPage;