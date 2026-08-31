import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { uploadCompiledPDFReport } from '../services/departmentService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, Plus, Trash2, Save, Download, 
  CheckCircle, HelpCircle, Loader2, User, ChevronLeft, ChevronRight, Pencil, X, Maximize2, ExternalLink, RefreshCw,
  MinusCircle, PlusCircle
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompletedTasks, fetchDelegatedTasks } from '../utils/taskUtils';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

// Default items for Task Log
const DEFAULT_TASK_LOG = [
  { taskProjectName: '', descriptionDetails: '', startTime: '', endTime: '', dueDate: '', status: '', fileLink: '' },
  { taskProjectName: '', descriptionDetails: '', startTime: '', endTime: '', dueDate: '', status: '', fileLink: '' }
];

// Default Key Numbers
const DEFAULT_KEY_NUMBERS = {
  designsCompleted: { target: '', todaysCount: '', notes: '' },
  revisionsDone: { target: '', todaysCount: '', notes: '' },
  clientDeliveries: { target: '', todaysCount: '', notes: '' }
};

// Default Blockers
const DEFAULT_BLOCKERS = [
  { issue: '', details: '', priority: '' }
];

// Default Tomorrow's Plan
const DEFAULT_TOMORROW = [
  { task: '', details: '', notes: '' }
];

const GraphicDesignerReportPage = () => {
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
  const [designers, setDesigners] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);
  
  // Form State
  const [basicDetails, setBasicDetails] = useState({
    employeeName: '',
    employeeId: '',
    designation: 'Graphic Designer',
    reportingTo: 'CMO',
    shiftTiming: '9:00 AM - 5:00 PM',
    preparedAt: ''
  });
  
  const [taskLog, setTaskLog] = useState(DEFAULT_TASK_LOG);
  const [teamLeadKpi, setTeamLeadKpi] = useState([]);
  const [selectedActivityText, setSelectedActivityText] = useState(null);
  const [keyNumbers, setKeyNumbers] = useState(DEFAULT_KEY_NUMBERS);
  const [blockers, setBlockers] = useState(DEFAULT_BLOCKERS);
  const [tomorrowTasks, setTomorrowTasks] = useState(DEFAULT_TOMORROW);
  const [approval, setApproval] = useState({
    designerName: '',
    designerSignature: '',
    submittedAt: '',
    teamLeaderName: '',
    approvedOn: ''
  });

  const handleFetchTeamLeadTasks = async () => {
    if (!selectedUserId || !selectedDate) return;
    try {
      showToast("Fetching Team Lead assigned tasks...", "info");
      const delegated = await fetchDelegatedTasks(selectedUserId, selectedDate);
      if (delegated && delegated.length > 0) {
        const mapped = delegated.map(t => ({
          taskProjectName: t.kpi || t.title || '',
          assignedTo: t.project || t.assignedName || '',
          dueDate: t.target || t.dueDate || '',
          status: t.achieved || t.status || 'Pending',
          remarks: t.remarks || 'Auto-fetched'
        }));
        setTeamLeadKpi(mapped);
        showToast(`Fetched ${mapped.length} tasks assigned by Team Lead!`, "success");
      } else {
        showToast("No tasks assigned by Team Lead found for this date.", "info");
      }
    } catch (err) {
      console.error("Error fetching team lead tasks:", err);
      showToast("Failed to fetch team lead tasks.", "error");
    }
  };

  // Monthly Report States
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
  const [monthlyActiveTab, setMonthlyActiveTab] = useState("range");

  const [monthlyBasicDetails, setMonthlyBasicDetails] = useState({
    employeeId: '',
    designation: 'Graphic Designer',
    reportingTo: 'CMO',
    shiftTiming: '9:00 AM - 5:00 PM',
    preparedAt: ''
  });
  const [monthlyTaskLog, setMonthlyTaskLog] = useState([]);
  const [monthlyKeyNumbers, setMonthlyKeyNumbers] = useState(DEFAULT_KEY_NUMBERS);
  const [monthlyBlockers, setMonthlyBlockers] = useState([]);
  const [monthlyTomorrowTasks, setMonthlyTomorrowTasks] = useState([]);
  const [monthlyApproval, setMonthlyApproval] = useState({
    designerName: '',
    designerSignature: '',
    submittedAt: '',
    teamLeaderName: '',
    approvedOn: ''
  });

  const getMonthlyTaskSummaryCounts = () => {
    let done = 0;
    let pending = 0;
    let na = 0;
    
    monthlyTaskLog.forEach(t => {
      const s = String(t.status || '').toLowerCase().trim();
      if (s === 'done') done++;
      else if (s === 'pending' || s === 'ongoing' || s === 'onprogress') pending++;
      else if (s === 'na' || s === 'n/a') na++;
    });

    return { done, pending, na, total: monthlyTaskLog.length };
  };

  const addMonthlyTaskRow = () => {
    setMonthlyTaskLog([...monthlyTaskLog, { taskProjectName: '', descriptionDetails: '', startTime: '', endTime: '', dueDate: '', status: 'Done', fileLink: '' }]);
  };
  
  const removeMonthlyTaskRow = (index) => {
    if (monthlyTaskLog.length > 1) {
      setMonthlyTaskLog(monthlyTaskLog.filter((_, i) => i !== index));
    }
  };

  const addMonthlyBlockerRow = () => {
    setMonthlyBlockers([...monthlyBlockers, { issue: '', details: '', priority: 'None' }]);
  };

  const removeMonthlyBlockerRow = (index) => {
    if (monthlyBlockers.length > 1) {
      setMonthlyBlockers(monthlyBlockers.filter((_, i) => i !== index));
    }
  };

  const addMonthlyTomorrowRow = () => {
    setMonthlyTomorrowTasks([...monthlyTomorrowTasks, { task: '', details: '', notes: '' }]);
  };

  const removeMonthlyTomorrowRow = (index) => {
    if (monthlyTomorrowTasks.length > 1) {
      setMonthlyTomorrowTasks(monthlyTomorrowTasks.filter((_, i) => i !== index));
    }
  };

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
  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

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

  const [hiddenSections, setHiddenSections] = useState({});

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Fetch designers list
  useEffect(() => {
    const fetchDesigners = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/graphic-designer-reports/designers`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setDesigners(data.data);
          
          // Try to default to the logged in user's ID if found in designers list
          const savedUser = localStorage.getItem('user');
          let myId = '';
          if (savedUser) {
            const userObj = JSON.parse(savedUser);
            myId = userObj.id || userObj._id;
          }
          
          if (myId && data.data.some(d => d._id === myId)) {
            setSelectedUserId(myId);
          } else if (data.data.length > 0 && !selectedUserId) {
            setSelectedUserId(data.data[0]._id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch designers list:", e);
      }
    };
    fetchDesigners();
  }, [getAuthHeaders, selectedUserId]);

  // Fetch submitted report dates list for highlighting
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/graphic-designer-reports/submitted-dates?userId=${userId}`, {
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
      const res = await fetch(`${API_BASE}/v1/graphic-designer-reports/by-date?userId=${userId}&dateString=${dateStr}`, {
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

        const savedLog = report.taskLog || [];
        setTaskLog(savedLog);

        
        // Auto-fetch and merge new/missing tasks or update existing ones
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
                const matchIndex = updatedLog.findIndex(row => cleanTitle(row.taskProjectName || '') === cleanT);

                if (matchIndex > -1) {
                  // Update existing task details in the saved report
                  updatedLog[matchIndex] = {
                    ...updatedLog[matchIndex],
                    taskProjectName: t.title,
                  dueDate: t.dueDate || '',
                    status: t.status === 'Done' ? 'Done' : 'Pending',
                    startTime: t.startTime || updatedLog[matchIndex].startTime || '',
                    endTime: t.endTime || updatedLog[matchIndex].endTime || ''
                  };
                } else {
                  // Append new task
                  addedTasks.push({
                    taskProjectName: t.title,
                    descriptionDetails: 'Auto-fetched',
                    startTime: t.startTime || '',
                    endTime: t.endTime || '',
                    dueDate: t.dueDate || '', status: t.status === 'Done' ? 'Done' : 'Pending',
                    fileLink: ''
                  });
                }
              });

              setTaskLog([...updatedLog, ...addedTasks]);
            }
          });
        } catch (e) {
          console.error("Error merging additional tasks:", e);
        }


        const savedTeamLeadKpi = report.teamLeadKpi || [];
        setTeamLeadKpi(savedTeamLeadKpi);

        // Auto-fetch delegated team lead tasks if empty
        try {
          fetchDelegatedTasks(userId, dateStr).then(delegatedTasks => {
            if (delegatedTasks && delegatedTasks.length > 0 && savedTeamLeadKpi.length === 0) {
              const mapped = delegatedTasks.map(t => ({
                taskProjectName: t.kpi || t.title || '',
                assignedTo: t.project || t.assignedName || '',
                dueDate: t.target || t.dueDate || '',
                status: t.achieved || t.status || 'Pending',
                remarks: t.remarks || 'Auto-fetched'
              }));
              setTeamLeadKpi(mapped);
            }
          });
        } catch (e) {
          console.error("Error auto-fetching team lead tasks:", e);
        }

        setKeyNumbers(report.keyNumbers || DEFAULT_KEY_NUMBERS);
        setBlockers(report.blockers || []);
        setTomorrowTasks(report.tomorrowTasks || []);
        setApproval(report.approval || {});
      } else {
        initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks and delegated team lead tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({ taskProjectName: t.title, descriptionDetails: t.description || 'Auto-fetched', startTime: t.startTime || t.startDate || t.startDateTimeLocal || '', endTime: t.endTime || t.endDate || t.endDateTimeLocal || '', dueDate: t.dueDate || '', status: t.status === 'Done' ? 'Done' : 'Pending', fileLink: '' }));
            setTaskLog(mappedTasks);
          }
          const delegatedTasks = await fetchDelegatedTasks(userId, dateStr);
          if (delegatedTasks && delegatedTasks.length > 0) {
            const mappedDelegated = delegatedTasks.map(t => ({
              taskProjectName: t.kpi || t.title || '',
              assignedTo: t.project || t.assignedName || '',
              dueDate: t.target || t.dueDate || '',
              status: t.achieved || t.status || 'Pending',
              remarks: t.remarks || 'Auto-fetched'
            }));
            setTeamLeadKpi(mappedDelegated);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
        }

      }
    } catch (err) {
      initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({ taskProjectName: t.title, descriptionDetails: t.description || 'Auto-fetched', startTime: t.startTime || t.startDate || t.startDateTimeLocal || '', endTime: t.endTime || t.endDate || t.endDateTimeLocal || '', dueDate: t.dueDate || '', status: t.status === 'Done' ? 'Done' : 'Pending', fileLink: '' }));
            setTaskLog(mappedTasks);
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
      const { preparedAt, ...persistent } = basicDetails;
      if (Object.keys(persistent).length > 0) {
        localStorage.setItem(`cachedBasicDetails_GraphicDesigner_${selectedUserId}`, JSON.stringify(persistent));
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
    if (isPrivileged && designers.length > 0) {
      userDetail = designers.find(d => (d._id || d.id) === userId) || freshestUser;
    }

    const dateObj = new Date(dateStr);
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
    const cached = localStorage.getItem(`cachedBasicDetails_GraphicDesigner_${userId}`);
    const parsedCached = cached ? JSON.parse(cached) : null;

    setBasicDetails({
      employeeName: userDetail.name || parsedCached?.employeeName || '',
      employeeId: userDetail.employeeId || parsedCached?.employeeId || '',
      designation: userDetail.designationName || userDetail.designation || parsedCached?.designation || 'Graphic Designer',
      reportingTo: userDetail.reportingManager || parsedCached?.reportingTo || 'CMO',
      shiftTiming: parsedCached?.shiftTiming || '9:00 AM - 5:00 PM',
      preparedAt: parsedCached?.preparedAt || timeStr
    });

    setTaskLog(DEFAULT_TASK_LOG);
    setKeyNumbers(DEFAULT_KEY_NUMBERS);
    setBlockers(DEFAULT_BLOCKERS);
    setTomorrowTasks(DEFAULT_TOMORROW);
    setApproval({
      designerName: userDetail.name || '',
      designerSignature: '',
      submittedAt: formattedDateString,
      teamLeaderName: '',
      approvedOn: ''
    });
  };

  // Auto task summary counters
  const getTaskSummaryCounts = () => {
    let done = 0;
    let pending = 0;
    let na = 0;
    
    taskLog.forEach(t => {
      if (!(t.taskProjectName || '').trim() && !(t.descriptionDetails || '').trim()) return;
      const s = String(t.status || '').toLowerCase().trim();
      if (s === 'done') done++;
      else if (s === 'pending' || s === 'ongoing' || s === 'onprogress') pending++;
      else if (s === 'na' || s === 'n/a') na++;
    });

    return { done, pending, na, total: done + pending + na };
  };
  const counts = getTaskSummaryCounts();

  // Submit report to backend
  const handleSaveReport = async () => {
    try {
      setSaving(true);

      const cleanTaskLog = taskLog.filter(t => (t.taskProjectName || '').trim() !== '' || (t.descriptionDetails || '').trim() !== '');
      const cleanBlockers = blockers.filter(b => (b.issue || '').trim() !== '' && (b.issue || '').toLowerCase() !== 'none');
      const cleanTomorrowTasks = tomorrowTasks.filter(t => (t.task || '').trim() !== '' || (t.details || '').trim() !== '' || (t.notes || '').trim() !== '');

      const excludedSections = Object.entries(hiddenSections).filter(([_, h]) => h).map(([k]) => k);

      const payload = {
         userId: selectedUserId,
         dateString: selectedDate,
         basicDetails,
         taskLog: cleanTaskLog,
         teamLeadKpi,
         keyNumbers,
         blockers: cleanBlockers.length > 0 ? cleanBlockers : [{ issue: 'None', details: '', priority: 'None' }],
         tomorrowTasks: cleanTomorrowTasks,
         approval,
         excludedSections,
         hiddenSections
      };

      const res = await fetch(`${API_BASE}/v1/graphic-designer-reports`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Graphic Designer daily report saved successfully!", 'success');
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
    const reportType = 'graphicdesigner';
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

  const handleFetchMonthlyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a designer first.", "error");
      return;
    }
    try {
      setIsMonthlyLoading(true);
      const dates = [];
      let curr = new Date(monthlyStartDate);
      const end = new Date(monthlyEndDate);
      while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      if (dates.length === 0) {
        showToast("Invalid date range.", "error");
        return;
      }

      // Fetch all reports in parallel
      const fetchPromises = dates.map(async (dateStr) => {
        try {
          const res = await fetch(`${API_BASE}/v1/graphic-designer-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && data.data) {
            return data.data;
          }
        } catch (e) {
          console.error(`Error fetching for date ${dateStr}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      const reports = results.filter(r => r !== null);

      if (reports.length === 0) {
        showToast("No daily reports found in the selected date range.", "warning");
        setMonthlyTaskLog([]);
        setMonthlyBlockers([]);
        setMonthlyTomorrowTasks([]);
        setMonthlyKeyNumbers(DEFAULT_KEY_NUMBERS);
        setIsMonthlyLoading(false);
        setMonthlyActiveTab("basic");
        return;
      }

      // Consolidation
      const firstReport = reports[0];
      setMonthlyBasicDetails({
        employeeId: firstReport.basicDetails?.employeeId || '',
        designation: firstReport.basicDetails?.designation || 'Graphic Designer',
        reportingTo: firstReport.basicDetails?.reportingTo || 'CMO',
        shiftTiming: firstReport.basicDetails?.shiftTiming || '9:00 AM - 5:00 PM',
        preparedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });

      const mergedTasks = [];
      reports.forEach(r => {
        if (r.taskLog && Array.isArray(r.taskLog)) {
          r.taskLog.forEach(t => {
            if (t.taskProjectName || t.descriptionDetails) {
              mergedTasks.push({
                taskProjectName: t.taskProjectName || '',
                descriptionDetails: t.descriptionDetails || '',
                startTime: t.startTime || '',
                endTime: t.endTime || '',
                dueDate: t.dueDate || '', status: t.status || 'Done',
                fileLink: t.fileLink || ''
              });
            }
          });
        }
      });
      setMonthlyTaskLog(mergedTasks.length > 0 ? mergedTasks : DEFAULT_TASK_LOG);

      const parseNum = (val) => {
        if (val === undefined || val === null) return 0;
        const clean = String(val).replace(/[^0-9.-]/g, '');
        return Number(clean) || 0;
      };

      const keyNums = {
        designsCompleted: { target: 0, todaysCount: 0, notes: [] },
        revisionsDone: { target: 0, todaysCount: 0, notes: [] },
        clientDeliveries: { target: 0, todaysCount: 0, notes: [] }
      };

      reports.forEach(r => {
        const k = r.keyNumbers || {};
        ['designsCompleted', 'revisionsDone', 'clientDeliveries'].forEach(field => {
          if (k[field]) {
            keyNums[field].target += parseNum(k[field].target);
            keyNums[field].todaysCount += parseNum(k[field].todaysCount);
            if (k[field].notes && k[field].notes.trim()) {
              keyNums[field].notes.push(k[field].notes.trim());
            }
          }
        });
      });

      setMonthlyKeyNumbers({
        designsCompleted: {
          target: keyNums.designsCompleted.target.toString(),
          todaysCount: keyNums.designsCompleted.todaysCount.toString(),
          notes: Array.from(new Set(keyNums.designsCompleted.notes)).join('; ')
        },
        revisionsDone: {
          target: keyNums.revisionsDone.target.toString(),
          todaysCount: keyNums.revisionsDone.todaysCount.toString(),
          notes: Array.from(new Set(keyNums.revisionsDone.notes)).join('; ')
        },
        clientDeliveries: {
          target: keyNums.clientDeliveries.target.toString(),
          todaysCount: keyNums.clientDeliveries.todaysCount.toString(),
          notes: Array.from(new Set(keyNums.clientDeliveries.notes)).join('; ')
        }
      });

      const mergedBlockers = [];
      reports.forEach(r => {
        if (r.blockers && Array.isArray(r.blockers)) {
          r.blockers.forEach(b => {
            if (b.issue || b.details) {
              mergedBlockers.push({
                issue: b.issue || '',
                details: b.details || '',
                priority: b.priority || ''
              });
            }
          });
        }
      });
      setMonthlyBlockers(mergedBlockers.length > 0 ? mergedBlockers : DEFAULT_BLOCKERS);

      const mergedTomorrow = [];
      reports.forEach(r => {
        if (r.tomorrowTasks && Array.isArray(r.tomorrowTasks)) {
          r.tomorrowTasks.forEach(t => {
            if (t.task || t.details) {
              mergedTomorrow.push({
                task: t.task || '',
                details: t.details || '',
                notes: t.notes || ''
              });
            }
          });
        }
      });
      setMonthlyTomorrowTasks(mergedTomorrow.length > 0 ? mergedTomorrow : DEFAULT_TOMORROW);

      const lastReport = reports[reports.length - 1];
      const designerUser = designers.find(d => d._id === selectedUserId) || currentUser;
      setMonthlyApproval({
        designerName: lastReport.approval?.designerName || designerUser.name || '',
        designerSignature: lastReport.approval?.designerSignature || '',
        submittedAt: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        teamLeaderName: lastReport.approval?.teamLeaderName || '',
        approvedOn: lastReport.approval?.approvedOn || ''
      });

      showToast(`Consolidated ${reports.length} daily reports!`, "success");
      setMonthlyActiveTab("basic");
    } catch (err) {
      console.error(err);
      showToast("Error consolidating monthly reports.", "error");
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const handleDownloadMonthlyPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let currentY = 15;
      
      const drawSectionHeader = (title) => {
        doc.setFillColor(43, 48, 128); // KODBRAND Navy
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      // Header Brand
      doc.setFillColor(43, 48, 128);
      doc.rect(14, 12, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("KODBRAND — Monthly Consolidated Report", 18, 20);

      doc.setFontSize(8);
      doc.text("Graphic Designer  ·  CMO Office", 145, 20);

      currentY = 27;

      // 1. BASIC DETAILS
      drawSectionHeader("1. Basic details");
      
      const basicDetailsRows = [
        ["Employee ID", monthlyBasicDetails.employeeId || '', "Designation", monthlyBasicDetails.designation || '', "Reporting to", monthlyBasicDetails.reportingTo || ''],
        ["Shift timing", monthlyBasicDetails.shiftTiming || '', "Report prepared at", monthlyBasicDetails.preparedAt || '', "Date Range", `${monthlyStartDate} to ${monthlyEndDate}`]
      ];

      autoTable(doc, {
        body: basicDetailsRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 30 },
          1: { width: 31 },
          2: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 30 },
          3: { width: 31 },
          4: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 30 },
          5: { width: 30 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 2. TASK LOG
      drawSectionHeader("2. Consolidated Task log");
      
      const taskHeaders = [["Task / project name", "Description / details", "Start time", "End time", "Status", "File link"]];
      const taskRows = monthlyTaskLog.map(t => [
        t.taskProjectName || '',
        t.descriptionDetails || '',
        t.startTime || '',
        t.endTime || '',
        t.status || '',
        t.fileLink || ''
      ]);

      const monthlyCounts = getMonthlyTaskSummaryCounts();
      taskRows.push([
        "Monthly summary",
        `Done: ${monthlyCounts.done}   |   Pending: ${monthlyCounts.pending}   |   N/A: ${monthlyCounts.na}   |   Total: ${monthlyCounts.total}`,
        "", "", "", ""
      ]);

      autoTable(doc, {
        head: taskHeaders,
        body: taskRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [43, 48, 128], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 40 },
          1: { width: 62 },
          2: { width: 20 },
          3: { width: 20 },
          4: { width: 18, halign: 'center' },
          5: { width: 22 }
        },
        didParseCell: (data) => {
          if (data.row.index === taskRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 247];
            if (data.column.index === 0) {
              data.cell.styles.textColor = [43, 48, 128];
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 3. KEY NUMBERS
      drawSectionHeader("3. Consolidated Key numbers");
      
      const keyHeaders = [["KPI", "Target (Sum)", "Actual (Sum)", "Notes"]];
      const keyRows = [
        ["Designs completed", monthlyKeyNumbers.designsCompleted?.target || '0', monthlyKeyNumbers.designsCompleted?.todaysCount || '0', monthlyKeyNumbers.designsCompleted?.notes || ''],
        ["Revisions done", monthlyKeyNumbers.revisionsDone?.target || '0', monthlyKeyNumbers.revisionsDone?.todaysCount || '0', monthlyKeyNumbers.revisionsDone?.notes || ''],
        ["Client deliveries", monthlyKeyNumbers.clientDeliveries?.target || '0', monthlyKeyNumbers.clientDeliveries?.todaysCount || '0', monthlyKeyNumbers.clientDeliveries?.notes || '']
      ];

      autoTable(doc, {
        head: keyHeaders,
        body: keyRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [43, 48, 128], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 45, fontStyle: 'bold' },
          1: { width: 40 },
          2: { width: 30, halign: 'center' },
          3: { width: 67 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 4. BLOCKERS & FUTURE PLAN
      drawSectionHeader("4. Blockers & next period's plan");
      
      const combinedHeaders = [["Blocker / issue", "Details", "Priority", "Next Period main task", "Details", "Notes"]];
      
      const maxLines = Math.max(monthlyBlockers.length, monthlyTomorrowTasks.length);
      const combinedRows = [];
      for (let i = 0; i < maxLines; i++) {
        const b = monthlyBlockers[i] || {};
        const t = monthlyTomorrowTasks[i] || {};
        combinedRows.push([
          b.issue || '',
          b.details || '',
          b.priority || '',
          t.task || '',
          t.details || '',
          t.notes || ''
        ]);
      }

      autoTable(doc, {
        head: combinedHeaders,
        body: combinedRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [43, 48, 128], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.2, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 30 },
          1: { width: 35 },
          2: { width: 16, halign: 'center' },
          3: { width: 30 },
          4: { width: 36 },
          5: { width: 35 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 5. APPROVAL
      drawSectionHeader("5. Approval");
      
      const approvalHeaders = [["Designer name & sign", "Submitted at", "Team leader", "Approved on"]];
      const approvalRows = [
        [
          `${monthlyApproval.designerName || ''} (${monthlyApproval.designerSignature || 'Signature'})`,
          monthlyApproval.submittedAt || '',
          monthlyApproval.teamLeaderName || '',
          monthlyApproval.approvedOn || ''
        ]
      ];

      autoTable(doc, {
        head: approvalHeaders,
        body: approvalRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [43, 48, 128], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 52 },
          1: { width: 35, halign: 'center' },
          2: { width: 60 },
          3: { width: 35, halign: 'center' }
        },
        didDrawCell: (data) => {
          if (data.column.index === 0 && data.cell.section === 'body') {
            const rawVal = String(data.cell.raw || '');
            if (rawVal.includes('(data:image/')) {
              const parts = rawVal.split(' (');
              const nameText = parts[0];
              const signatureBase64 = parts[1] ? parts[1].slice(0, -1) : '';
              if (signatureBase64.startsWith('data:image/')) {
                data.cell.text = '';
                const x = data.cell.x + 2;
                const y = data.cell.y + 2;
                doc.text(nameText, x, y + 2);
                const imgY = y + 8;
                const w = data.cell.width - 4;
                const h = data.cell.height - 12;
                try {
                  doc.addImage(signatureBase64, 'PNG', x, imgY, w, h);
                } catch (e) {
                  console.error("Failed to add signature image to monthly PDF:", e);
                }
              }
            }
          }
        },
        margin: { left: 14, right: 14 }
      });
      const pdfBlob = doc.output('blob');
      const filename = `Monthly_Report_Designer_${monthlyApproval.designerName || 'Designer'}_${monthlyStartDate}_to_${monthlyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${monthlyStartDate}_to_${monthlyEndDate}`, pdfBlob, filename, 'graphicdesigner', 'monthly');
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
  const addTaskRow = () => {
    setTaskLog([...taskLog, { taskProjectName: '', descriptionDetails: '', startTime: '', endTime: '', dueDate: '', status: 'Done', fileLink: '' }]);
  };
  
  const removeTaskRow = (index) => {
    if (taskLog.length > 1) {
      setTaskLog(taskLog.filter((_, i) => i !== index));
    }
  };

  const addBlockerRow = () => {
    setBlockers([...blockers, { issue: '', details: '', priority: '' }]);
  };

  const removeBlockerRow = (index) => {
    if (blockers.length > 1) {
      setBlockers(blockers.filter((_, i) => i !== index));
    }
  };

  const addTomorrowRow = () => {
    setTomorrowTasks([...tomorrowTasks, { task: '', details: '', notes: '' }]);
  };

  const removeTomorrowRow = (index) => {
    if (tomorrowTasks.length > 1) {
      setTomorrowTasks(tomorrowTasks.filter((_, i) => i !== index));
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
                  Graphic Designer Daily Report
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fill, review, and download daily reports for Graphic Design / CMO Office.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Monthly Report
                </button>

                

                <AiAnalyzeButton
                  onClick={() => {
                    setAiModalContext({
                      employeeName: basicDetails.employeeName,
                      department: 'Graphic Design & UI/UX',
                      designation: basicDetails.designation,
                      date: selectedDate,
                      actualReportContentText: JSON.stringify({ basicDetails, taskLog, designDeliverables, designerComments: comments })
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
              title="Graphic Designer Report AI Analysis"
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
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Report Prepared At</label>
                  <input
                    type="text"
                    value={basicDetails.preparedAt || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, preparedAt: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
              </div>
            </div>

            {/* 2. TASK LOG */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">2</span>
                  Task Log
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('taskLog')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={addTaskRow}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.taskLog ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Task Log (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('taskLog')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="px-3 py-3.5 w-[20%]">Task / Project Name</th>
                        <th className="px-2 py-3.5 w-[8%] text-center">Due Date</th>
                        <th className="px-3 py-3.5 w-[28%]">Description / Details</th>
                        <th className="px-2 py-3.5 w-[9%] text-center">Start Time</th>
                        <th className="px-2 py-3.5 w-[9%] text-center">End Time</th>
                        <th className="px-2 py-3.5 w-[9%] text-center">Status</th>
                        <th className="px-3 py-3.5 w-[14%]">Drive File Link</th>
                        <th className="px-2 py-3.5 w-[3%] text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {taskLog.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                          <td className="px-3 py-3 vertical-top">
                            <textarea
                              rows={2}
                              value={item.taskProjectName || ''}
                              onChange={(e) => {
                                const updated = [...taskLog];
                                updated[index].taskProjectName = e.target.value;
                                setTaskLog(updated);
                              }}
                              placeholder="Design Task..."
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px] resize-y"
                            />
                          </td>
                          <td className="px-2 py-3 vertical-top">
                            <input
                              type="text"
                              value={item.dueDate || ''}
                              onChange={(e) => {
                                const updated = [...taskLog];
                                updated[index].dueDate = e.target.value;
                                setTaskLog(updated);
                              }}
                              placeholder="DD/MM"
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-3 vertical-top relative group">
                            <div className="flex items-start gap-1">
                              <textarea
                                rows={2}
                                value={item.descriptionDetails || ''}
                                onChange={(e) => {
                                  const updated = [...taskLog];
                                  updated[index].descriptionDetails = e.target.value;
                                  setTaskLog(updated);
                                }}
                                placeholder="Provide design work details..."
                                className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y min-h-[44px]"
                              />
                              {item.descriptionDetails && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedActivityText(item.descriptionDetails)}
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-1"
                                  title="Expand / View Full Text"
                                >
                                  <Maximize2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-3 vertical-top text-center">
                            <input
                              type="text"
                              value={item.startTime || ''}
                              onChange={(e) => {
                                const updated = [...taskLog];
                                updated[index].startTime = e.target.value;
                                setTaskLog(updated);
                              }}
                              placeholder="DD-MM-YYYY HH:mm"
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs text-center focus:outline-none text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-2 py-3 vertical-top text-center">
                            <input
                              type="text"
                              value={item.endTime || ''}
                              onChange={(e) => {
                                const updated = [...taskLog];
                                updated[index].endTime = e.target.value;
                                setTaskLog(updated);
                              }}
                              placeholder="DD-MM-YYYY HH:mm"
                              className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs text-center focus:outline-none text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-2 py-3 vertical-top text-center">
                            <select
                              value={item.status}
                              onChange={(e) => {
                                const updated = [...taskLog];
                                updated[index].status = e.target.value;
                                setTaskLog(updated);
                              }}
                              className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs focus:outline-none text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                              <option value="Done">Done</option>
                              <option value="Pending">Pending</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </td>
                          <td className="px-3 py-3 vertical-top">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={item.fileLink || ''}
                                onChange={(e) => {
                                  const updated = [...taskLog];
                                  updated[index].fileLink = e.target.value;
                                  setTaskLog(updated);
                                }}
                                placeholder="Link to drive..."
                                className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-indigo-600 dark:text-lime-400 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              />
                              {item.fileLink && (
                                <a
                                  href={item.fileLink.startsWith('http') ? item.fileLink : `https://${item.fileLink}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-0.5"
                                  title="Open Drive Link"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center vertical-top">
                            <button
                              type="button"
                              onClick={() => removeTaskRow(index)}
                              disabled={taskLog.length === 1}
                              className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Auto-Calculated Daily Summary Row */}
                      <tr className="bg-slate-50/70 dark:bg-slate-950/40 font-bold border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                        <td className="px-5 py-4 text-indigo-600 dark:text-lime-400">Daily Summary</td>
                        <td className="px-5 py-4" colSpan={6}>
                          <div className="flex gap-6 text-xs uppercase tracking-wider">
                            <span>Done: <strong className="text-emerald-500">{counts.done}</strong></span>
                            <span>Pending: <strong className="text-amber-500">{counts.pending}</strong></span>
                            <span>N/A: <strong className="text-slate-400">{counts.na}</strong></span>
                            <span>Total: <strong>{counts.total}</strong></span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. TEAM LEAD KPI REPORT (TASKS ASSIGNED) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">3</span>
                  Team Lead KPI Report (Tasks Assigned)
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('teamLeadKpi')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={handleFetchTeamLeadTasks}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                    title="Auto-fetch tasks assigned by Team Lead for this date"
                  >
                    <RefreshCw size={14} /> Auto-Fetch Tasks
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamLeadKpi([...teamLeadKpi, { taskProjectName: '', assignedTo: '', dueDate: '', status: 'Pending', remarks: '' }])}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.teamLeadKpi ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Team Lead KPI Report (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('teamLeadKpi')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="px-3 py-3.5 w-[30%]">Task / Project Name</th>
                        <th className="px-3 py-3.5 w-[20%]">Assigned To</th>
                        <th className="px-2 py-3.5 w-[12%] text-center">Due Date</th>
                        <th className="px-2 py-3.5 w-[12%] text-center">Status</th>
                        <th className="px-3 py-3.5 w-[21%]">Remarks / Details</th>
                        <th className="px-2 py-3.5 w-[5%] text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {teamLeadKpi.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                            No Team Lead assigned tasks loaded. Click "Auto-Fetch Tasks" or "Add Row" to add entries.
                          </td>
                        </tr>
                      ) : (
                        teamLeadKpi.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                            <td className="px-3 py-3 vertical-top">
                              <div className="flex items-start gap-1">
                                <input
                                  type="text"
                                  value={item.taskProjectName || item.task || ''}
                                  onChange={(e) => {
                                    const updated = [...teamLeadKpi];
                                    updated[index].taskProjectName = e.target.value;
                                    setTeamLeadKpi(updated);
                                  }}
                                  placeholder="Assigned Task title..."
                                  className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                {(item.taskProjectName || item.task) && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedActivityText(item.taskProjectName || item.task)}
                                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 mt-0.5"
                                    title="Expand / View Full Text"
                                  >
                                    <Maximize2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 vertical-top">
                              <input
                                type="text"
                                value={item.assignedTo || item.project || ''}
                                onChange={(e) => {
                                  const updated = [...teamLeadKpi];
                                  updated[index].assignedTo = e.target.value;
                                  setTeamLeadKpi(updated);
                                }}
                                placeholder="Team member name..."
                                className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-2 py-3 vertical-top text-center">
                              <input
                                type="text"
                                value={item.dueDate || item.target || ''}
                                onChange={(e) => {
                                  const updated = [...teamLeadKpi];
                                  updated[index].dueDate = e.target.value;
                                  setTeamLeadKpi(updated);
                                }}
                                placeholder="YYYY-MM-DD"
                                className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs text-center text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-2 py-3 vertical-top text-center">
                              <select
                                value={item.status || item.achieved || 'Pending'}
                                onChange={(e) => {
                                  const updated = [...teamLeadKpi];
                                  updated[index].status = e.target.value;
                                  setTeamLeadKpi(updated);
                                }}
                                className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs focus:outline-none text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              >
                                <option value="Done">Done</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Pending">Pending</option>
                                <option value="Blocked">Blocked</option>
                              </select>
                            </td>
                            <td className="px-3 py-3 vertical-top">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={(e) => {
                                  const updated = [...teamLeadKpi];
                                  updated[index].remarks = e.target.value;
                                  setTeamLeadKpi(updated);
                                }}
                                placeholder="Remarks / feedback..."
                                className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-2 py-3 text-center vertical-top">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...teamLeadKpi];
                                  updated.splice(index, 1);
                                  setTeamLeadKpi(updated);
                                }}
                                className="text-rose-500 hover:text-rose-700 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. KEY NUMBERS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">4</span>
                  Key Numbers
                </h2>
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('keyNumbers')}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title="Exclude this table section from report & PDF (-)"
                >
                  <MinusCircle size={14} /> Exclude Table
                </button>
              </div>

              {hiddenSections.keyNumbers ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Key Numbers (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('keyNumbers')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="px-5 py-4 w-[25%]">KPI</th>
                        <th className="px-5 py-4 w-[25%]">Target</th>
                        <th className="px-5 py-4 w-[15%] text-center">Today's Count</th>
                        <th className="px-5 py-4 w-[35%]">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                        <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">Designs Completed</td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={keyNumbers.designsCompleted?.target || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              designsCompleted: { ...keyNumbers.designsCompleted, target: e.target.value }
                            })}
                            placeholder="Target count..."
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="text"
                            value={keyNumbers.designsCompleted?.todaysCount || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              designsCompleted: { ...keyNumbers.designsCompleted, todaysCount: e.target.value }
                            })}
                            placeholder="Actual..."
                            className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={keyNumbers.designsCompleted?.notes || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              designsCompleted: { ...keyNumbers.designsCompleted, notes: e.target.value }
                            })}
                            placeholder="Notes..."
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                        <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">Revisions Done</td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={keyNumbers.revisionsDone?.target || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              revisionsDone: { ...keyNumbers.revisionsDone, target: e.target.value }
                            })}
                            placeholder="Target count..."
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="text"
                            value={keyNumbers.revisionsDone?.todaysCount || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              revisionsDone: { ...keyNumbers.revisionsDone, todaysCount: e.target.value }
                            })}
                            placeholder="Actual..."
                            className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={keyNumbers.revisionsDone?.notes || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              revisionsDone: { ...keyNumbers.revisionsDone, notes: e.target.value }
                            })}
                            placeholder="Notes..."
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                        <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">Client Deliveries</td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={keyNumbers.clientDeliveries?.target || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              clientDeliveries: { ...keyNumbers.clientDeliveries, target: e.target.value }
                            })}
                            placeholder="Target count..."
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="text"
                            value={keyNumbers.clientDeliveries?.todaysCount || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              clientDeliveries: { ...keyNumbers.clientDeliveries, todaysCount: e.target.value }
                            })}
                            placeholder="Actual..."
                            className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={keyNumbers.clientDeliveries?.notes || ''}
                            onChange={(e) => setKeyNumbers({
                              ...keyNumbers,
                              clientDeliveries: { ...keyNumbers.clientDeliveries, notes: e.target.value }
                            })}
                            placeholder="Notes..."
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 5. BLOCKERS & TOMORROW'S PLAN */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* BLOCKERS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5A</span>
                    Blockers & Issues
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSectionHidden('blockers')}
                      className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                      title="Exclude this table section from report & PDF (-)"
                    >
                      <MinusCircle size={14} /> Exclude Table
                    </button>
                    <button
                      type="button"
                      onClick={addBlockerRow}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                    >
                      <Plus size={14} /> Add Blocker
                    </button>
                  </div>
                </div>

                {hiddenSections.blockers ? (
                  <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                      <MinusCircle size={14} className="text-rose-400" />
                      Blockers & Issues (Excluded from Report & PDF)
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleSectionHidden('blockers')}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle size={14} /> Restore Section
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                          <th className="px-4 py-3 w-[30%]">Blocker / Issue</th>
                          <th className="px-4 py-3 w-[50%]">Details</th>
                          <th className="px-4 py-3 w-[15%] text-center">Priority</th>
                          <th className="px-4 py-3 w-[5%] text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {blockers.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={item.issue}
                                onChange={(e) => {
                                  const updated = [...blockers];
                                  updated[index].issue = e.target.value;
                                  setBlockers(updated);
                                }}
                                placeholder="issue, etc."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={item.details}
                                onChange={(e) => {
                                  const updated = [...blockers];
                                  updated[index].details = e.target.value;
                                  setBlockers(updated);
                                }}
                                placeholder="Describe the issue..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <select
                                value={item.priority}
                                onChange={(e) => {
                                  const updated = [...blockers];
                                  updated[index].priority = e.target.value;
                                  setBlockers(updated);
                                }}
                                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                              >
                                <option value="">Select Priority</option>
                                <option value="None">None</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeBlockerRow(index)}
                                disabled={blockers.length === 1}
                                className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* TOMORROW'S PLAN */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5B</span>
                    Tomorrow's Plan
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSectionHidden('tomorrowTasks')}
                      className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                      title="Exclude this table section from report & PDF (-)"
                    >
                      <MinusCircle size={14} /> Exclude Table
                    </button>
                    <button
                      type="button"
                      onClick={addTomorrowRow}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                    >
                      <Plus size={14} /> Add Task
                    </button>
                  </div>
                </div>

                {hiddenSections.tomorrowTasks ? (
                  <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                      <MinusCircle size={14} className="text-rose-400" />
                      Tomorrow's Plan (Excluded from Report & PDF)
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleSectionHidden('tomorrowTasks')}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle size={14} /> Restore Section
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                          <th className="px-4 py-3 w-[30%]">Tomorrow's Main Task</th>
                          <th className="px-4 py-3 w-[45%]">Details</th>
                          <th className="px-4 py-3 w-[20%]">Notes</th>
                          <th className="px-4 py-3 w-[5%] text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tomorrowTasks.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={item.task}
                                onChange={(e) => {
                                  const updated = [...tomorrowTasks];
                                  updated[index].task = e.target.value;
                                  setTomorrowTasks(updated);
                                }}
                                placeholder="Next project..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={item.details}
                                onChange={(e) => {
                                  const updated = [...tomorrowTasks];
                                  updated[index].details = e.target.value;
                                  setTomorrowTasks(updated);
                                }}
                                placeholder="Describe tomorrow's task..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => {
                                  const updated = [...tomorrowTasks];
                                  updated[index].notes = e.target.value;
                                  setTomorrowTasks(updated);
                                }}
                                placeholder="Notes..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeTomorrowRow(index)}
                                disabled={tomorrowTasks.length === 1}
                                className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* 5. APPROVAL DETAILS */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5</span>
                Approval Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designer Name</label>
                  <input
                    type="text"
                    value={approval.designerName || ''}
                    onChange={(e) => setApproval({ ...approval, designerName: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designer Signature (Initials)</label>
                  <SignatureUpload
                    value={approval.designerSignature || ''}
                    onChange={(val) => setApproval({ ...approval, designerSignature: val })}
                    placeholder="Upload signature"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Submitted At (Date)</label>
                  <input
                    type="text"
                    value={approval.submittedAt || ''}
                    onChange={(e) => setApproval({ ...approval, submittedAt: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Team Leader Name</label>
                  <input
                    type="text"
                    value={approval.teamLeaderName || ''}
                    onChange={(e) => setApproval({ ...approval, teamLeaderName: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Approved On (Date)</label>
                  <input
                    type="text"
                    value={approval.approvedOn || ''}
                    onChange={(e) => setApproval({ ...approval, approvedOn: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Form Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 w-full">
              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all"
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

      {/* MONTHLY CONSOLIDATED MODAL */}
      <AnimatePresence>
        {isMonthlyModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-center items-start pt-10 overflow-y-auto bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden mb-10 mx-4"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Monthly Consolidated Report
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidate, edit, and download monthly reports for Graphic Design / CMO Office.
                  </p>
                </div>
                <button
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs Bar */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-950/20 px-6 scrollbar-none">
                {[
                  { id: 'range', label: '1. Date Range' },
                  { id: 'basic', label: '2. Basic Details' },
                  { id: 'tasks', label: '3. Task Log' },
                  { id: 'kpis', label: '4. Key Numbers' },
                  { id: 'blockers', label: '5. Blockers' },
                  { id: 'tomorrow', label: '6. Tomorrow\'s Plan' },
                  { id: 'approval', label: '7. Approval' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMonthlyActiveTab(tab.id)}
                    className={`py-3.5 px-4 font-semibold text-xs border-b-2 whitespace-nowrap transition-all duration-200 ${
                      monthlyActiveTab === tab.id
                        ? 'border-indigo-600 text-indigo-600 dark:border-lime-400 dark:text-lime-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-900">
                {monthlyActiveTab === 'range' && (
                  <div className="space-y-6 max-w-xl mx-auto py-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={monthlyStartDate}
                          onChange={(e) => setMonthlyStartDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={monthlyEndDate}
                          onChange={(e) => setMonthlyEndDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={handleFetchMonthlyData}
                        disabled={isMonthlyLoading}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
                      >
                        {isMonthlyLoading ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            Consolidating...
                          </>
                        ) : (
                          <>
                            <Calendar size={16} />
                            Fetch & Consolidate Data
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {monthlyActiveTab === 'basic' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">
                      Consolidated Basic Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Employee ID</label>
                        <input
                          type="text"
                          value={monthlyBasicDetails.employeeId || ''}
                          onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, employeeId: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
                        <input
                          type="text"
                          value={monthlyBasicDetails.designation || ''}
                          onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, designation: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Reporting Manager</label>
                        <input
                          type="text"
                          value={monthlyBasicDetails.reportingTo || ''}
                          onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, reportingTo: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Shift Timing</label>
                        <input
                          type="text"
                          value={monthlyBasicDetails.shiftTiming || ''}
                          onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, shiftTiming: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Report Prepared At</label>
                        <input
                          type="text"
                          value={monthlyBasicDetails.preparedAt || ''}
                          onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, preparedAt: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {monthlyActiveTab === 'tasks' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">
                        Consolidated Task Log
                      </h3>
                      <button
                        type="button"
                        onClick={addMonthlyTaskRow}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                      >
                        <Plus size={14} /> Add Row
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <th className="px-5 py-4 w-[35%]">Task / Project Name</th>
                      <th className="px-5 py-4 w-[25%]">Due Date</th>
                            <th className="px-5 py-4 w-[45%]">Description / Details</th>
                            <th className="px-5 py-4 w-[10%] text-center">Start Time</th>
                            <th className="px-5 py-4 w-[10%] text-center">End Time</th>
                            <th className="px-5 py-4 w-[10%] text-center">Status</th>
                            <th className="px-5 py-4 w-[15%]">Drive File Link</th>
                            <th className="px-5 py-4 w-[5%] text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyTaskLog.map((item, index) => (
                            <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.taskProjectName}
                                  onChange={(e) => {
                                    const updated = [...monthlyTaskLog];
                                    updated[index].taskProjectName = e.target.value;
                                    setMonthlyTaskLog(updated);
                                  }}
                                  placeholder="Design Task..."
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <textarea
                                  value={item.descriptionDetails}
                                  onChange={(e) => {
                                    const updated = [...monthlyTaskLog];
                                    updated[index].descriptionDetails = e.target.value;
                                    setMonthlyTaskLog(updated);
                                  }}
                                  placeholder="Provide design work details..."
                                  rows={1}
                                  className="w-full bg-transparent border-none focus:outline-none resize-y text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <input
                                  type="text"
                                  value={item.startTime}
                                  onChange={(e) => {
                                    const updated = [...monthlyTaskLog];
                                    updated[index].startTime = e.target.value;
                                    setMonthlyTaskLog(updated);
                                  }}
                                  placeholder="9:30 AM"
                                  className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <input
                                  type="text"
                                  value={item.endTime}
                                  onChange={(e) => {
                                    const updated = [...monthlyTaskLog];
                                    updated[index].endTime = e.target.value;
                                    setMonthlyTaskLog(updated);
                                  }}
                                  placeholder="11:00 AM"
                                  className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <select
                                  value={item.status}
                                  onChange={(e) => {
                                    const updated = [...monthlyTaskLog];
                                    updated[index].status = e.target.value;
                                    setMonthlyTaskLog(updated);
                                  }}
                                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                                >
                                  <option value="Done">Done</option>
                                  <option value="Pending">Pending</option>
                                  <option value="N/A">N/A</option>
                                </select>
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={item.fileLink}
                                  onChange={(e) => {
                                    const updated = [...monthlyTaskLog];
                                    updated[index].fileLink = e.target.value;
                                    setMonthlyTaskLog(updated);
                                  }}
                                  placeholder="Link to drive..."
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200 text-xs text-indigo-600 dark:text-lime-400"
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeMonthlyTaskRow(index)}
                                  disabled={monthlyTaskLog.length === 1}
                                  className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {/* Auto-Calculated Summary Row */}
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 font-bold border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                            <td className="px-5 py-4 text-indigo-600 dark:text-lime-400">Consolidated Summary</td>
                            <td className="px-5 py-4" colSpan={6}>
                              <div className="flex gap-6 text-xs uppercase tracking-wider">
                                <span>Done: <strong className="text-emerald-500">{getMonthlyTaskSummaryCounts().done}</strong></span>
                                <span>Pending: <strong className="text-amber-500">{getMonthlyTaskSummaryCounts().pending}</strong></span>
                                <span>N/A: <strong className="text-slate-400">{getMonthlyTaskSummaryCounts().na}</strong></span>
                                <span>Total: <strong>{getMonthlyTaskSummaryCounts().total}</strong></span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {monthlyActiveTab === 'kpis' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">
                      Consolidated Key Numbers
                    </h3>
                    
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <th className="px-5 py-4 w-[25%]">KPI</th>
                            <th className="px-5 py-4 w-[25%]">Target (Sum)</th>
                            <th className="px-5 py-4 w-[15%] text-center">Actual (Sum)</th>
                            <th className="px-5 py-4 w-[35%]">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                            <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">Designs Completed</td>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.designsCompleted?.target || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  designsCompleted: { ...monthlyKeyNumbers.designsCompleted, target: e.target.value }
                                })}
                                placeholder="Target count..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-5 py-3 text-center">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.designsCompleted?.todaysCount || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  designsCompleted: { ...monthlyKeyNumbers.designsCompleted, todaysCount: e.target.value }
                                })}
                                placeholder="Actual..."
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.designsCompleted?.notes || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  designsCompleted: { ...monthlyKeyNumbers.designsCompleted, notes: e.target.value }
                                })}
                                placeholder="Notes..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                          </tr>

                          <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                            <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">Revisions Done</td>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.revisionsDone?.target || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  revisionsDone: { ...monthlyKeyNumbers.revisionsDone, target: e.target.value }
                                })}
                                placeholder="Target count..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-5 py-3 text-center">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.revisionsDone?.todaysCount || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  revisionsDone: { ...monthlyKeyNumbers.revisionsDone, todaysCount: e.target.value }
                                })}
                                placeholder="Actual..."
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.revisionsDone?.notes || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  revisionsDone: { ...monthlyKeyNumbers.revisionsDone, notes: e.target.value }
                                })}
                                placeholder="Notes..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                          </tr>

                          <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                            <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">Client Deliveries</td>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.clientDeliveries?.target || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  clientDeliveries: { ...monthlyKeyNumbers.clientDeliveries, target: e.target.value }
                                })}
                                placeholder="Target count..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-5 py-3 text-center">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.clientDeliveries?.todaysCount || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  clientDeliveries: { ...monthlyKeyNumbers.clientDeliveries, todaysCount: e.target.value }
                                })}
                                placeholder="Actual..."
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={monthlyKeyNumbers.clientDeliveries?.notes || ''}
                                onChange={(e) => setMonthlyKeyNumbers({
                                  ...monthlyKeyNumbers,
                                  clientDeliveries: { ...monthlyKeyNumbers.clientDeliveries, notes: e.target.value }
                                })}
                                placeholder="Notes..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {monthlyActiveTab === 'blockers' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">
                        Consolidated Blockers & Issues
                      </h3>
                      <button
                        type="button"
                        onClick={addMonthlyBlockerRow}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                      >
                        <Plus size={14} /> Add Blocker
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <th className="px-4 py-3 w-[30%]">Blocker / Issue</th>
                            <th className="px-4 py-3 w-[50%]">Details</th>
                            <th className="px-4 py-3 w-[15%] text-center">Priority</th>
                            <th className="px-4 py-3 w-[5%] text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyBlockers.map((item, index) => (
                            <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.issue}
                                  onChange={(e) => {
                                    const updated = [...monthlyBlockers];
                                    updated[index].issue = e.target.value;
                                    setMonthlyBlockers(updated);
                                  }}
                                  placeholder="issue, etc."
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.details}
                                  onChange={(e) => {
                                    const updated = [...monthlyBlockers];
                                    updated[index].details = e.target.value;
                                    setMonthlyBlockers(updated);
                                  }}
                                  placeholder="Describe the issue..."
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2 text-center">
                                <select
                                  value={item.priority}
                                  onChange={(e) => {
                                    const updated = [...monthlyBlockers];
                                    updated[index].priority = e.target.value;
                                    setMonthlyBlockers(updated);
                                  }}
                                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                                >
                                  <option value="None">None</option>
                                  <option value="High">High</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Low">Low</option>
                                </select>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeMonthlyBlockerRow(index)}
                                  disabled={monthlyBlockers.length === 1}
                                  className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors"
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
                )}

                {monthlyActiveTab === 'tomorrow' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">
                        Consolidated Next Period's Plan
                      </h3>
                      <button
                        type="button"
                        onClick={addMonthlyTomorrowRow}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                      >
                        <Plus size={14} /> Add Task
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <th className="px-4 py-3 w-[30%]">Tomorrow's Main Task</th>
                            <th className="px-4 py-3 w-[45%]">Details</th>
                            <th className="px-4 py-3 w-[20%]">Notes</th>
                            <th className="px-4 py-3 w-[5%] text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyTomorrowTasks.map((item, index) => (
                            <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.task}
                                  onChange={(e) => {
                                    const updated = [...monthlyTomorrowTasks];
                                    updated[index].task = e.target.value;
                                    setMonthlyTomorrowTasks(updated);
                                  }}
                                  placeholder="Next project..."
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.details}
                                  onChange={(e) => {
                                    const updated = [...monthlyTomorrowTasks];
                                    updated[index].details = e.target.value;
                                    setMonthlyTomorrowTasks(updated);
                                  }}
                                  placeholder="Describe tomorrow's task..."
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.notes}
                                  onChange={(e) => {
                                    const updated = [...monthlyTomorrowTasks];
                                    updated[index].notes = e.target.value;
                                    setMonthlyTomorrowTasks(updated);
                                  }}
                                  placeholder="Notes..."
                                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeMonthlyTomorrowRow(index)}
                                  disabled={monthlyTomorrowTasks.length === 1}
                                  className="text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-colors"
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
                )}

                {monthlyActiveTab === 'approval' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest">
                      Consolidated Approval Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designer Name</label>
                        <input
                          type="text"
                          value={monthlyApproval.designerName || ''}
                          onChange={(e) => setMonthlyApproval({ ...monthlyApproval, designerName: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designer Signature (Initials)</label>
                        <SignatureUpload
                          value={monthlyApproval.designerSignature || ''}
                          onChange={(val) => setMonthlyApproval({ ...monthlyApproval, designerSignature: val })}
                          placeholder="Upload signature"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Submitted At (Date)</label>
                        <input
                          type="text"
                          value={monthlyApproval.submittedAt || ''}
                          onChange={(e) => setMonthlyApproval({ ...monthlyApproval, submittedAt: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Team Leader Name</label>
                        <input
                          type="text"
                          value={monthlyApproval.teamLeaderName || ''}
                          onChange={(e) => setMonthlyApproval({ ...monthlyApproval, teamLeaderName: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Approved On (Date)</label>
                        <input
                          type="text"
                          value={monthlyApproval.approvedOn || ''}
                          onChange={(e) => setMonthlyApproval({ ...monthlyApproval, approvedOn: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
                
                <button
                  type="button"
                  onClick={handleDownloadMonthlyPDF}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10"
                >
                  <Download size={16} />
                  Download Monthly PDF
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

export default GraphicDesignerReportPage;
