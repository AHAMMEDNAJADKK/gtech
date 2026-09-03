import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { uploadCompiledPDFReport } from '../services/departmentService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, CalendarDays, Plus, Trash2, Save, Download, 
  CheckCircle, HelpCircle, Loader2, User, ChevronLeft, ChevronRight, ChevronDown, Pencil, RefreshCw, X, Maximize2,
  MinusCircle, PlusCircle
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompletedTasks } from '../utils/taskUtils';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) {
    return `${API_BASE}${cleanPath}`;
  }
  if (API_BASE.endsWith('/api')) {
    return `${API_BASE}/v1${cleanPath}`;
  }
  return `${API_BASE}/api/v1${cleanPath}`;
};

// Default items for Daily Course Counseling & Sales Activity
const DEFAULT_SALES_ACTIVITY = [
  { activity: 'New Leads Generated', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Qualified Lead', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Calls Made', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Follow up', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Hot Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Warm Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Cold Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  // { activity: 'Call back Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'RNT Leads (Ring Next Time)', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Switch Off Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Wrong leads', count: '', digitalMktg: '', web: '', remarks: '' },
  // { activity: 'Total Pending Follow-ups', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Pending Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Client/Student Meetings Fixed', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Admissions/Closings Done', count: '', digitalMktg: '', web: '', remarks: '' }
];

// Default items for Daily Client Leads Activity & Updates
const DEFAULT_CLIENT_SALES_ACTIVITY = [
  { activity: 'New Client Leads Generated', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Qualified Client Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Client Calls / Contacted', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Client Follow ups', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Hot Client Leads (High Priority)', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Warm Client Leads (Medium Priority)', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Cold Client Leads (Low Priority)', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Total Pending Client Leads', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Client Meetings Fixed', count: '', digitalMktg: '', web: '', remarks: '' },
  { activity: 'Client Closings / Onboarding Done', count: '', digitalMktg: '', web: '', remarks: '' }
];

// Default items for Daily Operations Summary
const DEFAULT_DAILY_OPERATIONS = [
  { activity: 'Team Attendance Verified', status: '', dueDate: '', startDate: '', endDate: '', remarks: '' },
  { activity: 'Daily Sales Targets Assigned', status: '', dueDate: '', startDate: '', endDate: '', remarks: '' },
  { activity: 'Lead Follow-up Reviewed', status: '', dueDate: '', startDate: '', endDate: '', remarks: '' },
  { activity: 'Client Meetings Conducted', status: '', dueDate: '', startDate: '', endDate: '', remarks: '' }
];

// Default items for Performance KPI
const DEFAULT_PERFORMANCE_KPIS = [
  { kpi: 'Calls Target', target: '', achieved: '' },
  { kpi: 'Counseling Target', target: '', achieved: '' },
  { kpi: 'Follow-up Target', target: '', achieved: '' },
  { kpi: 'Admissions/Closings', target: '', achieved: '' }
];

const AcademicCounselorReportPage = () => {
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
  const [counselors, setCounselors] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);
  
  // Form State
  const [basicDetails, setBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    designation: 'Sales Executive / Tele Caller & Academic Counselor',
    department: 'Sales & Growth / Academy',
    shiftTiming: '9:00 AM - 5.00 PM',
    reportingTo: 'Manager - OPS Sales & Growth'
  });
  
  const [salesActivity, setSalesActivity] = useState(DEFAULT_SALES_ACTIVITY);
  const [clientSalesActivity, setClientSalesActivity] = useState(DEFAULT_CLIENT_SALES_ACTIVITY);
  const [activeLeadTab, setActiveLeadTab] = useState('telecaller');
  const [dailyOperations, setDailyOperations] = useState(DEFAULT_DAILY_OPERATIONS);
  const [reportsCollectedDone, setReportsCollectedDone] = useState(false);
  const [performanceKpis, setPerformanceKpis] = useState(DEFAULT_PERFORMANCE_KPIS);
  const [issuesFeedback, setIssuesFeedback] = useState([{ issue: '', priority: 'Medium', supportNeeded: '' }]);
  const [finalHandover, setFinalHandover] = useState({ crmUpdated: 'No', reportsSubmitted: 'No' });
  const [approval, setApproval] = useState({
    counselorName: '',
    counselorSignature: '',
    counselorDate: '',
    managerName: 'Manager Approval',
    managerSignature: '',
    managerDate: ''
  });

  const [hiddenSections, setHiddenSections] = useState({});
  const [selectedActivityText, setSelectedActivityText] = useState(null);

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Monthly Report States
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);
  const [monthlyStartDate, setMonthlyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [monthlyEndDate, setMonthlyEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [monthlyActiveTab, setMonthlyActiveTab] = useState('range');
  const [monthlyBasicDetails, setMonthlyBasicDetails] = useState({
    employeeName: '',
    designation: '',
    department: '',
    shiftTiming: '',
    reportingTo: '',
    dateRange: ''
  });
  const [monthlySalesActivity, setMonthlySalesActivity] = useState([]);
  const [monthlyClientSalesActivity, setMonthlyClientSalesActivity] = useState([]);
  const [monthlyPerformanceKpis, setMonthlyPerformanceKpis] = useState([]);
  const [monthlyDailyOperations, setMonthlyDailyOperations] = useState([]);
  const [monthlyReportsCollectedDone, setMonthlyReportsCollectedDone] = useState(false);
  const [monthlyIssuesFeedback, setMonthlyIssuesFeedback] = useState([]);
  const [isMonthlyConsolidated, setIsMonthlyConsolidated] = useState(false);

  // Weekly Report States
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [weeklyEndDate, setWeeklyEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [weeklyActiveTab, setWeeklyActiveTab] = useState('range');
  const [weeklyBasicDetails, setWeeklyBasicDetails] = useState({
    employeeName: '',
    designation: '',
    department: '',
    shiftTiming: '',
    reportingTo: '',
    dateRange: ''
  });
  const [weeklySalesActivity, setWeeklySalesActivity] = useState([]);
  const [weeklyClientSalesActivity, setWeeklyClientSalesActivity] = useState([]);
  const [weeklyPerformanceKpis, setWeeklyPerformanceKpis] = useState([]);
  const [weeklyDailyOperations, setWeeklyDailyOperations] = useState([]);
  const [weeklyReportsCollectedDone, setWeeklyReportsCollectedDone] = useState(false);
  const [weeklyIssuesFeedback, setWeeklyIssuesFeedback] = useState([]);
  const [isWeeklyConsolidated, setIsWeeklyConsolidated] = useState(false);

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

  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

  // Fetch counselors list (for selection dropdown)
  useEffect(() => {
    const fetchCounselors = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/academic-counselor-reports/counselors`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setCounselors(data.data);
          
          const savedUser = localStorage.getItem('user');
          let myId = '';
          if (savedUser) {
            const userObj = JSON.parse(savedUser);
            myId = userObj.id || userObj._id;
          }
          
          if (myId && data.data.some(d => d._id === myId) && !new URLSearchParams(window.location.search).get('userId')) {
            setSelectedUserId(myId);
          } else if (data.data.length > 0 && !selectedUserId) {
            setSelectedUserId(data.data[0]._id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch counselors list:", e);
      }
    };
    fetchCounselors();
  }, [getAuthHeaders, selectedUserId]);

  // Auto-open weekly/monthly modals from URL parameters
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

  // Fetch submitted report dates list for highlighting
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(getApiEndpoint(`/academic-counselor-reports/submitted-dates?userId=${userId}`), {
        headers: getAuthHeaders()
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setSubmittedDates(data.data);
        }
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

  // Auto-fetch Telecaller Leads & Client Leads stats from CRM
  const autoFetchLeadStats = useCallback(async (dateStr = selectedDate, showNotification = true) => {
    try {
      const [resTele, resClient] = await Promise.all([
        fetch(getApiEndpoint(`/ops-reports/lead-stats?date=${dateStr}`), { headers: getAuthHeaders() }),
        fetch(getApiEndpoint(`/ops-reports/client-lead-stats?date=${dateStr}`), { headers: getAuthHeaders() })
      ]);

      const contentTypeTele = resTele.headers.get('content-type') || '';
      if (contentTypeTele.includes('application/json')) {
        const dataTele = await resTele.json();
        if (dataTele.success && Array.isArray(dataTele.data)) {
          setSalesActivity(dataTele.data);
        } else {
          setSalesActivity(DEFAULT_SALES_ACTIVITY);
        }
      } else {
        setSalesActivity(DEFAULT_SALES_ACTIVITY);
      }

      const contentTypeClient = resClient.headers.get('content-type') || '';
      if (contentTypeClient.includes('application/json')) {
        const dataClient = await resClient.json();
        if (dataClient.success && Array.isArray(dataClient.data)) {
          setClientSalesActivity(dataClient.data);
        } else {
          setClientSalesActivity(DEFAULT_CLIENT_SALES_ACTIVITY);
        }
      } else {
        setClientSalesActivity(DEFAULT_CLIENT_SALES_ACTIVITY);
      }

      if (showNotification) {
        showToast('Lead stats auto-fetched successfully from CRM!', 'success');
      }
    } catch (e) {
      console.error('Failed to auto-fetch lead stats:', e);
      setSalesActivity(DEFAULT_SALES_ACTIVITY);
      setClientSalesActivity(DEFAULT_CLIENT_SALES_ACTIVITY);
      if (showNotification) {
        showToast('Failed to auto-fetch lead stats from CRM', 'error');
      }
    }
  }, [selectedDate, getAuthHeaders, showToast]);

  // Fetch report data for selected date and user
  const fetchReport = async (userId, dateStr) => {
    if (!userId || !dateStr) return;
    try {
      setLoading(true);
      const res = await fetch(getApiEndpoint(`/academic-counselor-reports/by-date?userId=${userId}&dateString=${dateStr}`), {
        headers: getAuthHeaders()
      });
      
      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      }
      
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

        setSalesActivity(report.salesActivity && report.salesActivity.length > 0 ? report.salesActivity : DEFAULT_SALES_ACTIVITY);
        setClientSalesActivity(report.clientSalesActivity && report.clientSalesActivity.length > 0 ? report.clientSalesActivity : DEFAULT_CLIENT_SALES_ACTIVITY);
        setDailyOperations(report.dailyOperations || []);
        setReportsCollectedDone(report.reportsCollectedDone || false);
        setPerformanceKpis(report.performanceKpis || []);
        setIssuesFeedback(report.issuesFeedback || []);
        setFinalHandover(report.finalHandover || { crmUpdated: 'No', reportsSubmitted: 'No' });
        setApproval(report.approval || {});
      } else {
        await initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({
              activity: t.title,
              dueDate: t.dueDate || '',
              startDate: t.startDate || t.startTime || t.startDateTimeLocal || '',
              endDate: t.endDate || t.endTime || t.endDateTimeLocal || '',
              status: t.status || 'Done',
              remarks: t.description || ''
            }));
            setDailyOperations(mappedTasks);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
        }

      }
    } catch (err) {
      await initializeBlankReport(userId, dateStr);
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
        localStorage.setItem(`cachedBasicDetails_AcademicCounselor_${selectedUserId}`, JSON.stringify(persistent));
      }
    }
  }, [basicDetails, selectedUserId]);

    const initializeBlankReport = async (userId, dateStr) => {
    let freshestUser = currentUser;
    try {
      const su = localStorage.getItem('user');
      if (su) freshestUser = JSON.parse(su);
    } catch(e){}

    let userDetail = freshestUser;
    if (isPrivileged && counselors.length > 0) {
      userDetail = counselors.find(d => (d._id || d.id) === userId) || freshestUser;
    }

    const dateObj = new Date(dateStr);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDateString = dateObj.toLocaleDateString('en-GB').replace(/\//g, '-'); // DD-MM-YYYY

    // Load from cache if exists
    const cached = localStorage.getItem(`cachedBasicDetails_AcademicCounselor_${userId}`);
    const parsedCached = cached ? JSON.parse(cached) : null;

    setBasicDetails({
      date: formattedDateString,
      day: dayName,
      employeeName: userDetail.name || parsedCached?.employeeName || '',
      employeeId: userDetail.employeeId || parsedCached?.employeeId || '',
      designation: userDetail.designationName || userDetail.designation || parsedCached?.designation || 'Sales Executive / Tele Caller & Academic Counselor',
      department: userDetail.department || parsedCached?.department || 'Sales & Growth / Academy',
      shiftTiming: parsedCached?.shiftTiming || '9:00 AM - 5.00 PM',
      reportingTo: userDetail.reportingManager || parsedCached?.reportingTo || 'Manager - OPS Sales & Growth'
    });

    // Auto-fetch lead stats from CRM for the selected date (Telecaller Leads & Client Leads)
    await autoFetchLeadStats(dateStr, false);

    setDailyOperations(DEFAULT_DAILY_OPERATIONS);
    setReportsCollectedDone(false);
    setPerformanceKpis(DEFAULT_PERFORMANCE_KPIS);
    setIssuesFeedback([{ issue: '', priority: 'Medium', supportNeeded: '' }]);
    setFinalHandover({ crmUpdated: 'No', reportsSubmitted: 'No' });
    setApproval({
      counselorName: userDetail.name || '',
      counselorSignature: '',
      counselorDate: formattedDateString,
      managerName: 'Manager Approval',
      managerSignature: '',
      managerDate: ''
    });
  };

  // Submit report to backend
  const handleSaveReport = async () => {
    try {
      setSaving(true);

      const cleanSalesActivity = salesActivity.filter(t => (t.activity || '').trim() !== '');
      const cleanClientSalesActivity = clientSalesActivity.filter(t => (t.activity || '').trim() !== '');
      const cleanDailyOperations = dailyOperations.filter(t => (t.activity || '').trim() !== '');
      const cleanIssuesFeedback = issuesFeedback.filter(t => (t.issue || '').trim() !== '');

      const excludedSections = Object.entries(hiddenSections).filter(([_, h]) => h).map(([k]) => k);

      const payload = {
        userId: selectedUserId,
        dateString: selectedDate,
        basicDetails,
        salesActivity: cleanSalesActivity,
        clientSalesActivity: cleanClientSalesActivity,
        dailyOperations: cleanDailyOperations,
        reportsCollectedDone,
        performanceKpis,
        issuesFeedback: cleanIssuesFeedback,
        finalHandover,
        approval,
        excludedSections,
        hiddenSections
      };

      const res = await fetch(getApiEndpoint('/academic-counselor-reports'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Academic Counselor shift report saved successfully!", 'success');
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
    const reportType = 'academiccounselor';
    // Automatically save report as well
    await handleSaveReport();

    try {
      showToast("Generating PDF on server...", "info");
      const token = localStorage.getItem('token');
      const cleanToken = token ? token.replace(/"/g, '') : '';
      
      const url = getApiEndpoint(`/employee-reports/generate-pdf?userId=${selectedUserId}&dateString=${selectedDate}&reportType=${reportType}`);
      
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
  };

  const parseNumber = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const handleFetchMonthlyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a counselor first.", "error");
      return;
    }
    setIsMonthlyLoading(true);
    try {
      let validReports = [];
      try {
        const res = await fetch(getApiEndpoint(`/academic-counselor-reports/range?userId=${selectedUserId}&startDate=${monthlyStartDate}&endDate=${monthlyEndDate}`), {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          validReports = data.data;
        }
      } catch (e) {
        console.error("Error fetching monthly reports range:", e);
      }

      if (validReports.length === 0) {
        const start = new Date(monthlyStartDate);
        const end = new Date(monthlyEndDate);
        const dates = [];
        let temp = new Date(start);
        while (temp <= end) {
          dates.push(temp.toISOString().split('T')[0]);
          temp.setDate(temp.getDate() + 1);
        }
        const fetchedResults = await Promise.all(
          dates.map(async (d) => {
            try {
              const res = await fetch(getApiEndpoint(`/academic-counselor-reports/by-date?userId=${selectedUserId}&dateString=${d}`), {
                headers: getAuthHeaders()
              });
              const data = await res.json();
              if (data.success && data.data) return data.data;
            } catch (err) {}
            return null;
          })
        );
        validReports = fetchedResults.filter(Boolean);
      }

      if (validReports.length === 0) {
        showToast("No saved reports found in selected monthly date range.", "warning");
      }

      const lastReport = validReports[validReports.length - 1];
      const selectedCounselor = counselors.find(c => (c._id || c.id) === selectedUserId);
      const details = lastReport?.basicDetails || {
        employeeName: selectedCounselor?.name || basicDetails.employeeName || '',
        designation: selectedCounselor?.designation || basicDetails.designation || 'Sales Executive / Tele Caller & Academic Counselor',
        department: selectedCounselor?.department || basicDetails.department || 'Sales & Growth / Academy',
        shiftTiming: basicDetails.shiftTiming || '9:00 AM - 5.00 PM',
        reportingTo: selectedCounselor?.reportingManager || basicDetails.reportingTo || 'Manager - OPS Sales & Growth'
      };

      setMonthlyBasicDetails({
        employeeName: details.employeeName || '',
        designation: details.designation || 'Sales Executive / Tele Caller & Academic Counselor',
        department: details.department || 'Sales & Growth / Academy',
        shiftTiming: details.shiftTiming || '9:00 AM - 5.00 PM',
        reportingTo: details.reportingTo || 'Manager - OPS Sales & Growth',
        dateRange: `${new Date(monthlyStartDate).toLocaleDateString('en-GB')} to ${new Date(monthlyEndDate).toLocaleDateString('en-GB')}`
      });

      const consolidatedSales = DEFAULT_SALES_ACTIVITY.map(item => {
        let totalCount = 0;
        let totalDigitalMktg = 0;
        let totalWeb = 0;
        const remarksList = [];

        validReports.forEach(report => {
          const activityItem = report.salesActivity?.find(a => a.activity === item.activity);
          if (activityItem) {
            totalCount += parseNumber(activityItem.count);
            totalDigitalMktg += parseNumber(activityItem.digitalMktg);
            totalWeb += parseNumber(activityItem.web);
            if (activityItem.remarks) remarksList.push(activityItem.remarks);
          }
        });

        return {
          activity: item.activity,
          count: totalCount || '',
          digitalMktg: totalDigitalMktg || '',
          web: totalWeb || '',
          dueDate: '', remarks: Array.from(new Set(remarksList)).join('; ')
        };
      });
      setMonthlySalesActivity(consolidatedSales);

      const consolidatedClientSales = DEFAULT_CLIENT_SALES_ACTIVITY.map(item => {
        let totalCount = 0;
        let totalDigitalMktg = 0;
        let totalWeb = 0;
        const remarksList = [];

        validReports.forEach(report => {
          const activityItem = report.clientSalesActivity?.find(a => a.activity === item.activity);
          if (activityItem) {
            totalCount += parseNumber(activityItem.count);
            totalDigitalMktg += parseNumber(activityItem.digitalMktg);
            totalWeb += parseNumber(activityItem.web);
            if (activityItem.remarks) remarksList.push(activityItem.remarks);
          }
        });

        return {
          activity: item.activity,
          count: totalCount || '',
          digitalMktg: totalDigitalMktg || '',
          web: totalWeb || '',
          dueDate: '', remarks: Array.from(new Set(remarksList)).join('; ')
        };
      });
      setMonthlyClientSalesActivity(consolidatedClientSales);

      const consolidatedKpis = DEFAULT_PERFORMANCE_KPIS.map(item => {
        let totalTarget = 0;
        let totalAchieved = 0;

        validReports.forEach(report => {
          const kpiItem = report.performanceKpis?.find(k => k.kpi === item.kpi);
          if (kpiItem) {
            totalTarget += parseNumber(kpiItem.target);
            totalAchieved += parseNumber(kpiItem.achieved);
          }
        });

        return {
          kpi: item.kpi,
          target: totalTarget || '',
          achieved: totalAchieved || ''
        };
      });
      setMonthlyPerformanceKpis(consolidatedKpis);

      const consolidatedOps = DEFAULT_DAILY_OPERATIONS.map(item => {
        const remarksList = [];
        let doneCount = 0;
        let pendingCount = 0;
        let naCount = 0;
        let dueDateVal = '';
        let startDateVal = '';
        let endDateVal = '';

        validReports.forEach(report => {
          const opsItem = report.dailyOperations?.find(o => o.activity === item.activity);
          if (opsItem) {
            if (opsItem.status === 'Done') doneCount++;
            else if (opsItem.status === 'Pending') pendingCount++;
            else naCount++;
            
            if (opsItem.remarks) remarksList.push(opsItem.remarks);
            if (opsItem.dueDate && !dueDateVal) dueDateVal = opsItem.dueDate;
            if (opsItem.startDate && !startDateVal) startDateVal = opsItem.startDate;
            if (opsItem.endDate && !endDateVal) endDateVal = opsItem.endDate;
          }
        });

        let finalStatus = 'Done';
        if (pendingCount > 0) finalStatus = 'Pending';
        else if (doneCount === 0 && naCount > 0) finalStatus = 'NA';

        return {
          activity: item.activity,
          status: finalStatus,
          dueDate: dueDateVal,
          startDate: startDateVal,
          endDate: endDateVal,
          remarks: Array.from(new Set(remarksList)).join('; ')
        };
      });
      setMonthlyDailyOperations(consolidatedOps);

      const collectedCount = validReports.filter(r => r.reportsCollectedDone).length;
      setMonthlyReportsCollectedDone(collectedCount > 0);

      const mergedIssues = [];
      validReports.forEach(report => {
        if (Array.isArray(report.issuesFeedback)) {
          report.issuesFeedback.forEach(issue => {
            if (issue.issue) {
              mergedIssues.push({
                issue: issue.issue,
                priority: issue.priority || 'Medium',
                supportNeeded: issue.supportNeeded || ''
              });
            }
          });
        }
      });
      if (mergedIssues.length === 0) {
        mergedIssues.push({ issue: '', priority: 'Medium', supportNeeded: '' });
      }
      setMonthlyIssuesFeedback(mergedIssues);

      showToast(`Successfully consolidated ${validReports.length} reports!`, 'success');
    } catch (error) {
      console.error("Consolidation error:", error);
      showToast("Failed to fetch and consolidate data.", "error");
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const handleFetchAndConsolidate = async () => {
    await handleFetchMonthlyData();
    setIsMonthlyConsolidated(true);
    setMonthlyActiveTab('basicDetails');
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
        if (currentY + 25 > 280) {
          doc.addPage();
          currentY = 15;
        }
        doc.setFillColor(60, 35, 117);
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(132, 204, 22);
      doc.text("KOD.", 14, 21);
      
      doc.setTextColor(60, 35, 117);
      doc.text("brand", 34, 21);

      doc.setFontSize(14);
      doc.setTextColor(60, 35, 117);
      doc.text("MONTHLY CONSOLIDATED REPORT", 100, 16);
      
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text("SALES EXECUTIVE / TELE CALLER & ACADEMIC COUNSELOR", 100, 22);

      currentY = 27;

      drawSectionHeader("1. BASIC DETAILS");
      
      const basicDetailsRows = [
        ["Date Range", monthlyBasicDetails.dateRange || '', "Employee Name", monthlyBasicDetails.employeeName || ''],
        ["Designation", monthlyBasicDetails.designation || '', "Department", monthlyBasicDetails.department || ''],
        ["Shift Timing", monthlyBasicDetails.shiftTiming || '', "Reporting To", monthlyBasicDetails.reportingTo || '']
      ];

      autoTable(doc, {
        body: basicDetailsRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 30 },
          1: { width: 61 },
          2: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 30 },
          3: { width: 61 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("2. STUDENT LEADS UPDATE (CONSOLIDATED)");
      
      const salesHeaders = [["Activity", "Count", "Digital Mktg", "Web", "Remarks"]];
      const salesRows = monthlySalesActivity.map(t => [
        t.activity || '',
        t.count || '',
        t.digitalMktg || '',
        t.web || '',
        t.remarks || ''
      ]);

      autoTable(doc, {
        head: salesHeaders,
        body: salesRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 60 },
          1: { width: 18, halign: 'center' },
          2: { width: 22, halign: 'center' },
          3: { width: 22, halign: 'center' },
          4: { width: 60 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("3. CLIENT LEADS UPDATE (CONSOLIDATED)");

      const clientSalesRows = (monthlyClientSalesActivity || []).map(t => [
        t.activity || '',
        t.count || '',
        t.digitalMktg || '',
        t.web || '',
        t.remarks || ''
      ]);

      autoTable(doc, {
        head: salesHeaders,
        body: clientSalesRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 60 },
          1: { width: 18, halign: 'center' },
          2: { width: 22, halign: 'center' },
          3: { width: 22, halign: 'center' },
          4: { width: 60 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("4. OPERATIONS SUMMARY (CONSOLIDATED)");
      
      const opsHeaders = [["Activity", "Due Date", "Start Date", "End Date", "Status", "Remarks"]];
      const opsRows = monthlyDailyOperations.map(t => [
        t.activity || '',
        t.dueDate || '',
        t.startDate || '',
        t.endDate || '',
        t.status || '',
        t.remarks || ''
      ]);
      
      opsRows.push([
        "Reports Collected from Team",
        "",
        "",
        "",
        monthlyReportsCollectedDone ? "Done" : "Pending",
        ""
      ]);

      autoTable(doc, {
        head: opsHeaders,
        body: opsRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 50 },
          1: { width: 25, halign: 'center' },
          2: { width: 25, halign: 'center' },
          3: { width: 25, halign: 'center' },
          4: { width: 25, halign: 'center' },
          5: { width: 32 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("5. PERFORMANCE KPI (CONSOLIDATED)");
      
      const kpiHeaders = [["KPI", "Target", "Achieved"]];
      const kpiRows = monthlyPerformanceKpis.map(t => [
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
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 70 },
          1: { width: 56, halign: 'center' },
          2: { width: 56, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("6. ISSUES & FEEDBACK (CONSOLIDATED)");
      
      const issueHeaders = [["Issue", "Priority", "Support Needed"]];
      const issueRows = monthlyIssuesFeedback.map(t => [
        t.issue || '',
        t.priority || '',
        t.supportNeeded || ''
      ]);

      autoTable(doc, {
        head: issueHeaders,
        body: issueRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 70 },
          1: { width: 35, halign: 'center' },
          2: { width: 77 }
        },
        margin: { left: 14, right: 14 }
      });

      const pdfBlob = doc.output('blob');
      const filename = `Monthly_Consolidated_Report_Counseling_${monthlyBasicDetails.employeeName || 'Counselor'}_${monthlyStartDate}_to_${monthlyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${monthlyStartDate}_to_${monthlyEndDate}`, pdfBlob, filename, 'academiccounselor', 'monthly');
        console.log("Monthly PDF saved successfully");
      } catch (uploadErr) {
        console.error("Failed to upload monthly PDF:", uploadErr);
      }
      doc.save(filename);
      showToast("Monthly PDF report downloaded successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to generate monthly PDF.", "error");
    }
  };

  const addMonthlyIssueRow = () => {
    setMonthlyIssuesFeedback([...monthlyIssuesFeedback, { issue: '', priority: 'Medium', supportNeeded: '' }]);
  };

  const removeMonthlyIssueRow = (index) => {
    if (monthlyIssuesFeedback.length > 1) {
      setMonthlyIssuesFeedback(monthlyIssuesFeedback.filter((_, i) => i !== index));
    }
  };

  // Weekly Consolidation Logic
  const handleFetchWeeklyData = async () => {
    if (!selectedUserId) {
      showToast("Please select an Academic Counselor first", "warning");
      return;
    }

    try {
      setIsWeeklyLoading(true);
      let validReports = [];
      try {
        const res = await fetch(getApiEndpoint(`/academic-counselor-reports/range?userId=${selectedUserId}&startDate=${weeklyStartDate}&endDate=${weeklyEndDate}`), {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          validReports = data.data;
        }
      } catch (e) {
        console.error("Error fetching weekly reports range:", e);
      }

      if (validReports.length === 0) {
        const start = new Date(weeklyStartDate);
        const end = new Date(weeklyEndDate);
        const datesList = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          datesList.push(d.toISOString().split('T')[0]);
        }
        const fetchedResults = await Promise.all(
          datesList.map(async (d) => {
            try {
              const res = await fetch(getApiEndpoint(`/academic-counselor-reports/by-date?userId=${selectedUserId}&dateString=${d}`), {
                headers: getAuthHeaders()
              });
              const data = await res.json();
              if (data.success && data.data) return data.data;
            } catch (err) {}
            return null;
          })
        );
        validReports = fetchedResults.filter(Boolean);
      }

      if (validReports.length === 0) {
        showToast("No saved reports found in the selected weekly date range.", "warning");
      }

      const lastReport = validReports[validReports.length - 1];
      const selectedCounselor = counselors.find(c => (c._id || c.id) === selectedUserId);
      const details = lastReport?.basicDetails || {
        employeeName: selectedCounselor?.name || basicDetails.employeeName || '',
        designation: selectedCounselor?.designation || basicDetails.designation || 'Sales Executive / Tele Caller & Academic Counselor',
        department: selectedCounselor?.department || basicDetails.department || 'Sales & Growth / Academy',
        shiftTiming: basicDetails.shiftTiming || '9:00 AM - 5.00 PM',
        reportingTo: selectedCounselor?.reportingManager || basicDetails.reportingTo || 'Manager - OPS Sales & Growth'
      };

      setWeeklyBasicDetails({
        employeeName: details.employeeName || '',
        designation: details.designation || 'Sales Executive / Tele Caller & Academic Counselor',
        department: details.department || 'Sales & Growth / Academy',
        shiftTiming: details.shiftTiming || '9:00 AM - 5.00 PM',
        reportingTo: details.reportingTo || 'Manager - OPS Sales & Growth',
        dateRange: `${new Date(weeklyStartDate).toLocaleDateString('en-GB')} to ${new Date(weeklyEndDate).toLocaleDateString('en-GB')}`
      });

      const consolidatedSales = DEFAULT_SALES_ACTIVITY.map(item => {
        let totalCount = 0;
        let totalDigitalMktg = 0;
        let totalWeb = 0;
        const remarksList = [];

        validReports.forEach(report => {
          const activityItem = report.salesActivity?.find(a => a.activity === item.activity);
          if (activityItem) {
            totalCount += parseNumber(activityItem.count);
            totalDigitalMktg += parseNumber(activityItem.digitalMktg);
            totalWeb += parseNumber(activityItem.web);
            if (activityItem.remarks) remarksList.push(activityItem.remarks);
          }
        });

        return {
          activity: item.activity,
          count: totalCount || '',
          digitalMktg: totalDigitalMktg || '',
          web: totalWeb || '',
          dueDate: '', remarks: Array.from(new Set(remarksList)).join('; ')
        };
      });
      setWeeklySalesActivity(consolidatedSales);

      const consolidatedClientSales = DEFAULT_CLIENT_SALES_ACTIVITY.map(item => {
        let totalCount = 0;
        let totalDigitalMktg = 0;
        let totalWeb = 0;
        const remarksList = [];

        validReports.forEach(report => {
          const activityItem = report.clientSalesActivity?.find(a => a.activity === item.activity);
          if (activityItem) {
            totalCount += parseNumber(activityItem.count);
            totalDigitalMktg += parseNumber(activityItem.digitalMktg);
            totalWeb += parseNumber(activityItem.web);
            if (activityItem.remarks) remarksList.push(activityItem.remarks);
          }
        });

        return {
          activity: item.activity,
          count: totalCount || '',
          digitalMktg: totalDigitalMktg || '',
          web: totalWeb || '',
          dueDate: '', remarks: Array.from(new Set(remarksList)).join('; ')
        };
      });
      setWeeklyClientSalesActivity(consolidatedClientSales);

      const consolidatedKpis = DEFAULT_PERFORMANCE_KPIS.map(item => {
        let totalTarget = 0;
        let totalAchieved = 0;

        validReports.forEach(report => {
          const kpiItem = report.performanceKpis?.find(k => k.kpi === item.kpi);
          if (kpiItem) {
            totalTarget += parseNumber(kpiItem.target);
            totalAchieved += parseNumber(kpiItem.achieved);
          }
        });

        return {
          kpi: item.kpi,
          target: totalTarget || '',
          achieved: totalAchieved || ''
        };
      });
      setWeeklyPerformanceKpis(consolidatedKpis);

      const consolidatedOps = DEFAULT_DAILY_OPERATIONS.map(item => {
        const remarksList = [];
        let doneCount = 0;
        let pendingCount = 0;
        let naCount = 0;
        let dueDateVal = '';
        let startDateVal = '';
        let endDateVal = '';

        validReports.forEach(report => {
          const opsItem = report.dailyOperations?.find(o => o.activity === item.activity);
          if (opsItem) {
            if (opsItem.status === 'Done') doneCount++;
            else if (opsItem.status === 'Pending') pendingCount++;
            else naCount++;
            
            if (opsItem.remarks) remarksList.push(opsItem.remarks);
            if (opsItem.dueDate && !dueDateVal) dueDateVal = opsItem.dueDate;
            if (opsItem.startDate && !startDateVal) startDateVal = opsItem.startDate;
            if (opsItem.endDate && !endDateVal) endDateVal = opsItem.endDate;
          }
        });

        let finalStatus = 'Done';
        if (pendingCount > 0) finalStatus = 'Pending';
        else if (doneCount === 0 && naCount > 0) finalStatus = 'NA';

        return {
          activity: item.activity,
          status: finalStatus,
          dueDate: dueDateVal,
          startDate: startDateVal,
          endDate: endDateVal,
          remarks: Array.from(new Set(remarksList)).join('; ')
        };
      });
      setWeeklyDailyOperations(consolidatedOps);

      const collectedCount = validReports.filter(r => r.reportsCollectedDone).length;
      setWeeklyReportsCollectedDone(collectedCount > 0);

      const mergedIssues = [];
      validReports.forEach(report => {
        if (Array.isArray(report.issuesFeedback)) {
          report.issuesFeedback.forEach(issue => {
            if (issue.issue) {
              mergedIssues.push({
                issue: issue.issue,
                priority: issue.priority || 'Medium',
                supportNeeded: issue.supportNeeded || ''
              });
            }
          });
        }
      });
      if (mergedIssues.length === 0) {
        mergedIssues.push({ issue: '', priority: 'Medium', supportNeeded: '' });
      }
      setWeeklyIssuesFeedback(mergedIssues);

      showToast(`Successfully consolidated ${validReports.length} reports for weekly view!`, 'success');
    } catch (error) {
      console.error("Weekly Consolidation error:", error);
      showToast("Failed to fetch and consolidate weekly data.", "error");
    } finally {
      setIsWeeklyLoading(false);
    }
  };

  const handleFetchAndConsolidateWeekly = async () => {
    await handleFetchWeeklyData();
    setIsWeeklyConsolidated(true);
    setWeeklyActiveTab('basicDetails');
  };

  const handleDownloadWeeklyPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let currentY = 15;
      
      const drawSectionHeader = (title) => {
        if (currentY + 25 > 280) {
          doc.addPage();
          currentY = 15;
        }
        doc.setFillColor(60, 35, 117);
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(132, 204, 22);
      doc.text("KOD.", 14, 21);
      
      doc.setTextColor(60, 35, 117);
      doc.text("brand", 34, 21);

      doc.setFontSize(14);
      doc.setTextColor(60, 35, 117);
      doc.text("WEEKLY CONSOLIDATED REPORT", 100, 16);
      
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text("SALES EXECUTIVE / TELE CALLER & ACADEMIC COUNSELOR", 100, 22);

      currentY = 27;

      drawSectionHeader("1. BASIC DETAILS");
      
      const basicDetailsRows = [
        ["Date Range", weeklyBasicDetails.dateRange || '', "Employee Name", weeklyBasicDetails.employeeName || ''],
        ["Designation", weeklyBasicDetails.designation || '', "Department", weeklyBasicDetails.department || ''],
        ["Shift Timing", weeklyBasicDetails.shiftTiming || '', "Reporting To", weeklyBasicDetails.reportingTo || '']
      ];

      autoTable(doc, {
        body: basicDetailsRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 30 },
          1: { width: 61 },
          2: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 30 },
          3: { width: 61 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("2. STUDENT LEADS UPDATE (CONSOLIDATED)");
      
      const salesHeaders = [["Activity", "Count", "Digital Mktg", "Web", "Remarks"]];
      const salesRows = weeklySalesActivity.map(t => [
        t.activity || '',
        t.count || '',
        t.digitalMktg || '',
        t.web || '',
        t.remarks || ''
      ]);

      autoTable(doc, {
        head: salesHeaders,
        body: salesRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 60 },
          1: { width: 18, halign: 'center' },
          2: { width: 22, halign: 'center' },
          3: { width: 22, halign: 'center' },
          4: { width: 60 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("3. CLIENT LEADS UPDATE (CONSOLIDATED)");

      const clientSalesRows = (weeklyClientSalesActivity || []).map(t => [
        t.activity || '',
        t.count || '',
        t.digitalMktg || '',
        t.web || '',
        t.remarks || ''
      ]);

      autoTable(doc, {
        head: salesHeaders,
        body: clientSalesRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 60 },
          1: { width: 18, halign: 'center' },
          2: { width: 22, halign: 'center' },
          3: { width: 22, halign: 'center' },
          4: { width: 60 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("4. OPERATIONS SUMMARY (CONSOLIDATED)");
      
      const opsHeaders = [["Activity", "Due Date", "Start Date", "End Date", "Status", "Remarks"]];
      const opsRows = weeklyDailyOperations.map(t => [
        t.activity || '',
        t.dueDate || '',
        t.startDate || '',
        t.endDate || '',
        t.status || '',
        t.remarks || ''
      ]);
      
      opsRows.push([
        "Reports Collected from Team",
        "",
        "",
        "",
        weeklyReportsCollectedDone ? "Done" : "Pending",
        ""
      ]);

      autoTable(doc, {
        head: opsHeaders,
        body: opsRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 50 },
          1: { width: 25, halign: 'center' },
          2: { width: 25, halign: 'center' },
          3: { width: 25, halign: 'center' },
          4: { width: 25, halign: 'center' },
          5: { width: 32 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("5. PERFORMANCE KPI (CONSOLIDATED)");
      
      const kpiHeaders = [["KPI", "Target", "Achieved"]];
      const kpiRows = weeklyPerformanceKpis.map(t => [
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
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 70 },
          1: { width: 56, halign: 'center' },
          2: { width: 56, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("6. ISSUES & FEEDBACK (CONSOLIDATED)");
      
      const issueHeaders = [["Issue", "Priority", "Support Needed"]];
      const issueRows = weeklyIssuesFeedback.map(t => [
        t.issue || '',
        t.priority || '',
        t.supportNeeded || ''
      ]);

      autoTable(doc, {
        head: issueHeaders,
        body: issueRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 70 },
          1: { width: 35, halign: 'center' },
          2: { width: 77 }
        },
        margin: { left: 14, right: 14 }
      });

      const pdfBlob = doc.output('blob');
      const filename = `Weekly_Consolidated_Report_Counseling_${weeklyBasicDetails.employeeName || 'Counselor'}_${weeklyStartDate}_to_${weeklyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${weeklyStartDate}_to_${weeklyEndDate}`, pdfBlob, filename, 'academiccounselor', 'weekly');
        console.log("Weekly PDF saved successfully");
      } catch (uploadErr) {
        console.error("Failed to upload weekly PDF:", uploadErr);
      }
      doc.save(filename);
      showToast("Weekly PDF report downloaded successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to generate weekly PDF.", "error");
    }
  };

  const addWeeklyIssueRow = () => {
    setWeeklyIssuesFeedback([...weeklyIssuesFeedback, { issue: '', priority: 'Medium', supportNeeded: '' }]);
  };

  const removeWeeklyIssueRow = (index) => {
    if (weeklyIssuesFeedback.length > 1) {
      setWeeklyIssuesFeedback(weeklyIssuesFeedback.filter((_, i) => i !== index));
    }
  };

  // Generate months starting from April 2026 up to current month
  const getRecentMonths = () => {
    const months = [];
    const now = new Date();
    const startYear = 2026;
    const startMonth = 3; // April (0-indexed)

    let y = now.getFullYear();
    let m = now.getMonth();

    while (y > startYear || (y === startYear && m >= startMonth)) {
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

  useEffect(() => {
    if (selectedDate) {
      const sel = new Date(selectedDate);
      if (!isNaN(sel.getTime())) {
        const mKey = `${sel.getFullYear()}-${String(sel.getMonth() + 1).padStart(2, '0')}`;
        setExpandedMonth(mKey);
      }
    }
  }, [selectedDate]);

  // Helper row handlers for dynamic tables
  const addIssueRow = () => {
    setIssuesFeedback([...issuesFeedback, { issue: '', priority: 'Medium', supportNeeded: '' }]);
  };

  const removeIssueRow = (index) => {
    if (issuesFeedback.length > 1) {
      setIssuesFeedback(issuesFeedback.filter((_, i) => i !== index));
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
            {/* Form Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Academic Counselor Shift Report
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fill daily course counseling logs, verify team metrics, and download reports.
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

                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all"
                >
                  <CalendarDays size={16} />
                  Weekly Report
                </button>

                

                <AiAnalyzeButton
                  onClick={() => {
                    setAiModalContext({
                      employeeName: basicDetails.employeeName,
                      department: 'Academic Counseling & Sales',
                      designation: basicDetails.designation,
                      date: selectedDate,
                      actualReportContentText: JSON.stringify({ basicDetails, salesActivity, leadConversion, admissionMetrics, counselorComments: comments })
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
              title="Academic Counselor Report AI Analysis"
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
              </div>
            </div>

            {/* 2. DAILY COUNSELING & SALES ACTIVITY (TELECALLER + CLIENT LEADS IN SAME ROW) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">2</span>
                  Student & Client Leads Update
                </h2>
                <button
                  type="button"
                  onClick={() => autoFetchLeadStats(selectedDate, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <RefreshCw size={13} />
                  Auto-Fetch Counts from CRM
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Table 1: Telecaller / Course Counseling Leads */}
                <div className="space-y-2">
                  <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    STUDENT LEADS UPDATE
                  </h3>
                  <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                          <th className="px-3 py-3 w-[45%]">Activity</th>
                          <th className="px-2 py-3 text-center">Count</th>
                          <th className="px-2 py-3 text-center">Digital Mktg</th>
                          <th className="px-2 py-3 text-center">Web</th>
                          <th className="px-3 py-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {salesActivity.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                            <td className="px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="text"
                                value={item.count}
                                onChange={(e) => {
                                  const updated = [...salesActivity];
                                  updated[index].count = e.target.value;
                                  setSalesActivity(updated);
                                }}
                                placeholder="-"
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200 font-bold"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="text"
                                value={item.digitalMktg}
                                onChange={(e) => {
                                  const updated = [...salesActivity];
                                  updated[index].digitalMktg = e.target.value;
                                  setSalesActivity(updated);
                                }}
                                placeholder="-"
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="text"
                                value={item.web}
                                onChange={(e) => {
                                  const updated = [...salesActivity];
                                  updated[index].web = e.target.value;
                                  setSalesActivity(updated);
                                }}
                                placeholder="-"
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="text"
                                value={item.remarks}
                                onChange={(e) => {
                                  const updated = [...salesActivity];
                                  updated[index].remarks = e.target.value;
                                  setSalesActivity(updated);
                                }}
                                placeholder="Remarks..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 2: Client Leads Activity & Sales Updates */}
                <div className="space-y-2">
                  <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    CLIENT LEADS UPDATE
                  </h3>
                  <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                          <th className="px-3 py-3 w-[45%]">Activity</th>
                          <th className="px-2 py-3 text-center">Count</th>
                          <th className="px-2 py-3 text-center">Digital Mktg</th>
                          <th className="px-2 py-3 text-center">Web</th>
                          <th className="px-3 py-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {clientSalesActivity.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                            <td className="px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="text"
                                value={item.count}
                                onChange={(e) => {
                                  const updated = [...clientSalesActivity];
                                  updated[index].count = e.target.value;
                                  setClientSalesActivity(updated);
                                }}
                                placeholder="-"
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200 font-bold"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="text"
                                value={item.digitalMktg}
                                onChange={(e) => {
                                  const updated = [...clientSalesActivity];
                                  updated[index].digitalMktg = e.target.value;
                                  setClientSalesActivity(updated);
                                }}
                                placeholder="-"
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="text"
                                value={item.web}
                                onChange={(e) => {
                                  const updated = [...clientSalesActivity];
                                  updated[index].web = e.target.value;
                                  setClientSalesActivity(updated);
                                }}
                                placeholder="-"
                                className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="text"
                                value={item.remarks}
                                onChange={(e) => {
                                  const updated = [...clientSalesActivity];
                                  updated[index].remarks = e.target.value;
                                  setClientSalesActivity(updated);
                                }}
                                placeholder="Remarks..."
                                className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. DAILY OPERATIONS SUMMARY */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">3</span>
                  Daily Operations Summary
                </h2>
                <button
                  type="button"
                  onClick={() => setDailyOperations([...dailyOperations, { activity: '', dueDate: '', startDate: '', endDate: '', status: 'Pending', remarks: '' }])}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-4 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-5 py-4 w-36">Due Date</th>
                      <th className="px-5 py-4 w-44">Start Date</th>
                      <th className="px-5 py-4 w-44">End Date</th>
                      <th className="px-5 py-4 w-40 text-center">Status</th>
                      <th className="px-5 py-4">Remarks</th>
                      <th className="px-5 py-4 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {dailyOperations.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.activity || ''}
                            onChange={(e) => {
                              const updated = [...dailyOperations];
                              updated[index].activity = e.target.value;
                              setDailyOperations(updated);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-semibold text-slate-700 dark:text-slate-300"
                            placeholder="Activity name"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.dueDate || ''}
                            onChange={(e) => {
                              const updated = [...dailyOperations];
                              updated[index].dueDate = e.target.value;
                              setDailyOperations(updated);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                            placeholder="Due date"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.startDate || ''}
                            onChange={(e) => {
                              const updated = [...dailyOperations];
                              updated[index].startDate = e.target.value;
                              setDailyOperations(updated);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                            placeholder="DD-MM-YYYY HH:mm"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.endDate || ''}
                            onChange={(e) => {
                              const updated = [...dailyOperations];
                              updated[index].endDate = e.target.value;
                              setDailyOperations(updated);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-slate-700 dark:text-slate-200"
                            placeholder="DD-MM-YYYY HH:mm"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <select
                            value={item.status || 'Pending'}
                            onChange={(e) => {
                              const updated = [...dailyOperations];
                              updated[index].status = e.target.value;
                              setDailyOperations(updated);
                            }}
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                          >
                            <option value="Done">Done</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="NA">NA</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.remarks || ''}
                            onChange={(e) => {
                              const updated = [...dailyOperations];
                              updated[index].remarks = e.target.value;
                              setDailyOperations(updated);
                            }}
                            placeholder="Add details..."
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...dailyOperations];
                              updated.splice(index, 1);
                              setDailyOperations(updated);
                            }}
                            className="text-rose-500 hover:text-rose-600 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Inline Reports Collected row */}
                    <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                      <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-300">Reports Collected from Team</td>
                      <td className="px-5 py-4 text-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reportsCollectedDone}
                            onChange={(e) => setReportsCollectedDone(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Done</span>
                        </label>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-400">Select if team submissions are fully gathered.</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. PERFORMANCE KPI */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">4</span>
                Performance KPI
              </h2>

              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-4 w-[40%]">KPI</th>
                      <th className="px-5 py-4 w-[30%] text-center">Target</th>
                      <th className="px-5 py-4 w-[30%] text-center">Achieved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {performanceKpis.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.kpi}</td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="text"
                            value={item.target}
                            onChange={(e) => {
                              const updated = [...performanceKpis];
                              updated[index].target = e.target.value;
                              setPerformanceKpis(updated);
                            }}
                            placeholder="Target count..."
                            className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="text"
                            value={item.achieved}
                            onChange={(e) => {
                              const updated = [...performanceKpis];
                              updated[index].achieved = e.target.value;
                              setPerformanceKpis(updated);
                            }}
                            placeholder="Actual count..."
                            className="w-full bg-transparent border-none text-center focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. ISSUES & FEEDBACK */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5</span>
                  Issues & Feedback
                </h2>
                <button
                  type="button"
                  onClick={addIssueRow}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-4 w-[40%]">Issue</th>
                      <th className="px-5 py-4 w-[25%] text-center">Priority</th>
                      <th className="px-5 py-4 w-[30%]">Support Needed</th>
                      <th className="px-5 py-4 w-[5%] text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {issuesFeedback.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.issue}
                            onChange={(e) => {
                              const updated = [...issuesFeedback];
                              updated[index].issue = e.target.value;
                              setIssuesFeedback(updated);
                            }}
                            placeholder="Describe issue..."
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <select
                            value={item.priority}
                            onChange={(e) => {
                              const updated = [...issuesFeedback];
                              updated[index].priority = e.target.value;
                              setIssuesFeedback(updated);
                            }}
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.supportNeeded}
                            onChange={(e) => {
                              const updated = [...issuesFeedback];
                              updated[index].supportNeeded = e.target.value;
                              setIssuesFeedback(updated);
                            }}
                            placeholder="What help is required?"
                            className="w-full bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeIssueRow(index)}
                            disabled={issuesFeedback.length === 1}
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
            </div>

            {/* 6. FINAL HANDOVER & APPROVAL */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">6</span>
                Final Handover & Approval
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                
                {/* Handover checklists */}
                <div className="space-y-4 border-r border-slate-200/50 dark:border-slate-800/50 pr-0 lg:pr-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Handover Items</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">CRM Updated</span>
                      <select
                        value={finalHandover.crmUpdated}
                        onChange={(e) => setFinalHandover({ ...finalHandover, crmUpdated: e.target.value })}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Reports Submitted</span>
                      <select
                        value={finalHandover.reportsSubmitted}
                        onChange={(e) => setFinalHandover({ ...finalHandover, reportsSubmitted: e.target.value })}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Signatures</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Academic Counselor Name</label>
                      <input
                        type="text"
                        value={approval.counselorName || ''}
                        onChange={(e) => setApproval({ ...approval, counselorName: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Counselor Initials / Sign</label>
                      <SignatureUpload
                        value={approval.counselorSignature || ''}
                        onChange={(val) => setApproval({ ...approval, counselorSignature: val })}
                        placeholder="Upload signature"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Date</label>
                      <input
                        type="text"
                        value={approval.counselorDate || ''}
                        onChange={(e) => setApproval({ ...approval, counselorDate: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Manager Name</label>
                      <input
                        type="text"
                        value={approval.managerName || ''}
                        onChange={(e) => setApproval({ ...approval, managerName: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                      />
                    </div>
                  </div>
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

      {/* Monthly Consolidation Modal */}
      <AnimatePresence>
        {isMonthlyModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-center items-start pt-10 overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col mb-10 text-slate-700 dark:text-slate-200"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="text-indigo-500" size={18} />
                    Monthly Consolidated Report
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidate daily shift reports for counselor: {counselors.find(c => c._id === selectedUserId)?.name || basicDetails.employeeName || 'Selected User'}
                  </p>
                </div>
                <button
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-2xl font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Modal Tabs / Controls */}
              <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setMonthlyActiveTab('range')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    monthlyActiveTab === 'range'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  1. Date Range
                </button>
                
                {isMonthlyConsolidated && (
                  <>
                    <button
                      onClick={() => setMonthlyActiveTab('basicDetails')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        monthlyActiveTab === 'basicDetails'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-655 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      2. Basic Details
                    </button>
                    <button
                      onClick={() => setMonthlyActiveTab('salesActivity')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        monthlyActiveTab === 'salesActivity'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-655 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      3. Student Leads
                    </button>
                    <button
                      onClick={() => setMonthlyActiveTab('clientSalesActivity')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        monthlyActiveTab === 'clientSalesActivity'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-655 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      4. Client Leads
                    </button>
                    <button
                      onClick={() => setMonthlyActiveTab('dailyOperations')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        monthlyActiveTab === 'dailyOperations'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-655 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      5. Daily Operations
                    </button>
                    <button
                      onClick={() => setMonthlyActiveTab('performanceKpis')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        monthlyActiveTab === 'performanceKpis'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-655 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      6. Performance KPIs
                    </button>
                    <button
                      onClick={() => setMonthlyActiveTab('issuesFeedback')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        monthlyActiveTab === 'issuesFeedback'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-655 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      7. Issues & Feedback
                    </button>
                  </>
                )}
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {monthlyActiveTab === 'range' && (
                  <div className="space-y-6 max-w-xl mx-auto py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
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
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
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

                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={handleFetchAndConsolidate}
                        disabled={isMonthlyLoading}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-md shadow-indigo-600/10"
                      >
                        {isMonthlyLoading ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            Consolidating...
                          </>
                        ) : (
                          <>
                            <FileText size={16} />
                            Fetch & Consolidate Data
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {isMonthlyConsolidated && (
                  <>
                    {monthlyActiveTab === 'basicDetails' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Date Range</label>
                          <input
                            type="text"
                            value={monthlyBasicDetails.dateRange || ''}
                            onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, dateRange: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Employee Name</label>
                          <input
                            type="text"
                            value={monthlyBasicDetails.employeeName || ''}
                            onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, employeeName: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
                          <input
                            type="text"
                            value={monthlyBasicDetails.designation || ''}
                            onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, designation: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
                          <input
                            type="text"
                            value={monthlyBasicDetails.department || ''}
                            onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, department: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Shift Timing</label>
                          <input
                            type="text"
                            value={monthlyBasicDetails.shiftTiming || ''}
                            onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, shiftTiming: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Reporting Manager</label>
                          <input
                            type="text"
                            value={monthlyBasicDetails.reportingTo || ''}
                            onChange={(e) => setMonthlyBasicDetails({ ...monthlyBasicDetails, reportingTo: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    {monthlyActiveTab === 'salesActivity' && (
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="px-5 py-4 w-[40%]">Activity</th>
                              <th className="px-5 py-4 w-[15%] text-center">Count</th>
                              <th className="px-5 py-4 w-[15%] text-center">Digital Mktg</th>
                              <th className="px-5 py-4 w-[15%] text-center">Web</th>
                              <th className="px-5 py-4 w-[15%]">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {monthlySalesActivity.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.count}
                                    onChange={(e) => {
                                      const updated = [...monthlySalesActivity];
                                      updated[index].count = e.target.value;
                                      setMonthlySalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.digitalMktg}
                                    onChange={(e) => {
                                      const updated = [...monthlySalesActivity];
                                      updated[index].digitalMktg = e.target.value;
                                      setMonthlySalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.web}
                                    onChange={(e) => {
                                      const updated = [...monthlySalesActivity];
                                      updated[index].web = e.target.value;
                                      setMonthlySalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.remarks}
                                    onChange={(e) => {
                                      const updated = [...monthlySalesActivity];
                                      updated[index].remarks = e.target.value;
                                      setMonthlySalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {monthlyActiveTab === 'clientSalesActivity' && (
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="px-5 py-4 w-[40%]">Activity</th>
                              <th className="px-5 py-4 w-[15%] text-center">Count</th>
                              <th className="px-5 py-4 w-[15%] text-center">Digital Mktg</th>
                              <th className="px-5 py-4 w-[15%] text-center">Web</th>
                              <th className="px-5 py-4 w-[15%]">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {monthlyClientSalesActivity.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.count}
                                    onChange={(e) => {
                                      const updated = [...monthlyClientSalesActivity];
                                      updated[index].count = e.target.value;
                                      setMonthlyClientSalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.digitalMktg}
                                    onChange={(e) => {
                                      const updated = [...monthlyClientSalesActivity];
                                      updated[index].digitalMktg = e.target.value;
                                      setMonthlyClientSalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.web}
                                    onChange={(e) => {
                                      const updated = [...monthlyClientSalesActivity];
                                      updated[index].web = e.target.value;
                                      setMonthlyClientSalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.remarks}
                                    onChange={(e) => {
                                      const updated = [...monthlyClientSalesActivity];
                                      updated[index].remarks = e.target.value;
                                      setMonthlyClientSalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {monthlyActiveTab === 'dailyOperations' && (
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="px-5 py-4 w-[35%] min-w-[280px]">Activity</th>
                              <th className="px-5 py-4 w-36">Due Date</th>
                              <th className="px-5 py-4 w-44">Start Date</th>
                              <th className="px-5 py-4 w-44">End Date</th>
                              <th className="px-5 py-4 w-40 text-center">Status</th>
                              <th className="px-5 py-4">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {monthlyDailyOperations.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.dueDate || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyDailyOperations];
                                      updated[index].dueDate = e.target.value;
                                      setMonthlyDailyOperations(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    placeholder="Due date"
                                  />
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.startDate || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyDailyOperations];
                                      updated[index].startDate = e.target.value;
                                      setMonthlyDailyOperations(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    placeholder="Start date"
                                  />
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.endDate || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyDailyOperations];
                                      updated[index].endDate = e.target.value;
                                      setMonthlyDailyOperations(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    placeholder="End date"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <select
                                    value={item.status || 'Pending'}
                                    onChange={(e) => {
                                      const updated = [...monthlyDailyOperations];
                                      updated[index].status = e.target.value;
                                      setMonthlyDailyOperations(updated);
                                    }}
                                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                                  >
                                    <option value="Done">Done</option>
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="NA">NA</option>
                                  </select>
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.remarks || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyDailyOperations];
                                      updated[index].remarks = e.target.value;
                                      setMonthlyDailyOperations(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                            <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                              <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-300">Reports Collected from Team</td>
                              <td className="px-5 py-4 text-center">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={monthlyReportsCollectedDone}
                                    onChange={(e) => setMonthlyReportsCollectedDone(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                  />
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Done</span>
                                </label>
                              </td>
                              <td className="px-5 py-4">
                                <span className="text-xs text-slate-400">Select if team submissions are fully gathered.</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {monthlyActiveTab === 'performanceKpis' && (
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="px-5 py-4 w-[40%]">KPI</th>
                              <th className="px-5 py-4 w-[30%] text-center">Target</th>
                              <th className="px-5 py-4 w-[30%] text-center">Achieved</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {monthlyPerformanceKpis.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.kpi}</td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.target}
                                    onChange={(e) => {
                                      const updated = [...monthlyPerformanceKpis];
                                      updated[index].target = e.target.value;
                                      setMonthlyPerformanceKpis(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.achieved}
                                    onChange={(e) => {
                                      const updated = [...monthlyPerformanceKpis];
                                      updated[index].achieved = e.target.value;
                                      setMonthlyPerformanceKpis(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {monthlyActiveTab === 'issuesFeedback' && (
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={addMonthlyIssueRow}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                          >
                            <Plus size={14} /> Add Row
                          </button>
                        </div>
                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                <th className="px-5 py-4 w-[40%]">Issue</th>
                                <th className="px-5 py-4 w-[25%] text-center">Priority</th>
                                <th className="px-5 py-4 w-[30%]">Support Needed</th>
                                <th className="px-5 py-4 w-[5%] text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {monthlyIssuesFeedback.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                  <td className="px-5 py-3">
                                    <input
                                      type="text"
                                      value={item.issue}
                                      onChange={(e) => {
                                        const updated = [...monthlyIssuesFeedback];
                                        updated[index].issue = e.target.value;
                                        setMonthlyIssuesFeedback(updated);
                                      }}
                                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-5 py-3 text-center">
                                    <select
                                      value={item.priority}
                                      onChange={(e) => {
                                        const updated = [...monthlyIssuesFeedback];
                                        updated[index].priority = e.target.value;
                                        setMonthlyIssuesFeedback(updated);
                                      }}
                                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                                    >
                                      <option value="High">High</option>
                                      <option value="Medium">Medium</option>
                                      <option value="Low">Low</option>
                                    </select>
                                  </td>
                                  <td className="px-5 py-3">
                                    <input
                                      type="text"
                                      value={item.supportNeeded}
                                      onChange={(e) => {
                                        const updated = [...monthlyIssuesFeedback];
                                        updated[index].supportNeeded = e.target.value;
                                        setMonthlyIssuesFeedback(updated);
                                      }}
                                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-5 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeMonthlyIssueRow(index)}
                                      disabled={monthlyIssuesFeedback.length === 1}
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
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <button
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-355 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900"
                >
                  Close
                </button>

                {isMonthlyConsolidated && (
                  <button
                    onClick={handleDownloadMonthlyPDF}
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

        {/* WEEKLY CONSOLIDATION MODAL */}
        {isWeeklyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 sm:pt-10 overflow-y-auto bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col mb-10 max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Weekly Academic Counselor Consolidation</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Aggregate multiple daily reports into a single weekly shift report</p>
                </div>
                <button
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex bg-slate-100 dark:bg-slate-950 p-1 gap-1 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
                <button
                  onClick={() => setWeeklyActiveTab('range')}
                  className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === 'range' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  1. Choose Date Range
                </button>
                <button
                  onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab('basicDetails') : showToast("Please fetch data first", "warning")}
                  className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === 'basicDetails' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  2. Basic Details
                </button>
                <button
                  onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab('salesActivity') : showToast("Please fetch data first", "warning")}
                  className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === 'salesActivity' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  3. Student Leads
                </button>
                <button
                  onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab('clientSalesActivity') : showToast("Please fetch data first", "warning")}
                  className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === 'clientSalesActivity' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  4. Client Leads
                </button>
                <button
                  onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab('dailyOperations') : showToast("Please fetch data first", "warning")}
                  className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === 'dailyOperations' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  5. Operations Summary
                </button>
                <button
                  onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab('performanceKpis') : showToast("Please fetch data first", "warning")}
                  className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === 'performanceKpis' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  6. Performance KPI
                </button>
                <button
                  onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab('issuesFeedback') : showToast("Please fetch data first", "warning")}
                  className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === 'issuesFeedback' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  7. Issues & Feedback
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {weeklyActiveTab === 'range' && (
                  <div className="space-y-5 max-w-md mx-auto py-6">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Select weekly report duration</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                        <input
                          type="date"
                          value={weeklyStartDate}
                          onChange={(e) => setWeeklyStartDate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                        <input
                          type="date"
                          value={weeklyEndDate}
                          onChange={(e) => setWeeklyEndDate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchAndConsolidateWeekly}
                      disabled={isWeeklyLoading}
                      className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isWeeklyLoading ? <Loader2 className="animate-spin" size={16} /> : <CalendarDays size={16} />}
                      Fetch & Consolidate Weekly Data
                    </button>
                  </div>
                )}

                {isWeeklyConsolidated && (
                  <>
                    {weeklyActiveTab === 'basicDetails' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Date Range</label>
                          <input
                            type="text"
                            value={weeklyBasicDetails.dateRange || ''}
                            onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, dateRange: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Employee Name</label>
                          <input
                            type="text"
                            value={weeklyBasicDetails.employeeName || ''}
                            onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, employeeName: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
                          <input
                            type="text"
                            value={weeklyBasicDetails.designation || ''}
                            onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, designation: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
                          <input
                            type="text"
                            value={weeklyBasicDetails.department || ''}
                            onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, department: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Shift Timing</label>
                          <input
                            type="text"
                            value={weeklyBasicDetails.shiftTiming || ''}
                            onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, shiftTiming: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Reporting Manager</label>
                          <input
                            type="text"
                            value={weeklyBasicDetails.reportingTo || ''}
                            onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, reportingTo: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    {weeklyActiveTab === 'salesActivity' && (
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="px-5 py-4 w-[40%]">Activity</th>
                              <th className="px-5 py-4 w-[15%] text-center">Count</th>
                              <th className="px-5 py-4 w-[15%] text-center">Digital Mktg</th>
                              <th className="px-5 py-4 w-[15%] text-center">Web</th>
                              <th className="px-5 py-4 w-[15%]">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {weeklySalesActivity.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.count}
                                    onChange={(e) => {
                                      const updated = [...weeklySalesActivity];
                                      updated[index].count = e.target.value;
                                      setWeeklySalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.digitalMktg}
                                    onChange={(e) => {
                                      const updated = [...weeklySalesActivity];
                                      updated[index].digitalMktg = e.target.value;
                                      setWeeklySalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.web}
                                    onChange={(e) => {
                                      const updated = [...weeklySalesActivity];
                                      updated[index].web = e.target.value;
                                      setWeeklySalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.remarks}
                                    onChange={(e) => {
                                      const updated = [...weeklySalesActivity];
                                      updated[index].remarks = e.target.value;
                                      setWeeklySalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {weeklyActiveTab === 'clientSalesActivity' && (
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="px-5 py-4 w-[40%]">Activity</th>
                              <th className="px-5 py-4 w-[15%] text-center">Count</th>
                              <th className="px-5 py-4 w-[15%] text-center">Digital Mktg</th>
                              <th className="px-5 py-4 w-[15%] text-center">Web</th>
                              <th className="px-5 py-4 w-[15%]">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {weeklyClientSalesActivity.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.count}
                                    onChange={(e) => {
                                      const updated = [...weeklyClientSalesActivity];
                                      updated[index].count = e.target.value;
                                      setWeeklyClientSalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.digitalMktg}
                                    onChange={(e) => {
                                      const updated = [...weeklyClientSalesActivity];
                                      updated[index].digitalMktg = e.target.value;
                                      setWeeklyClientSalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.web}
                                    onChange={(e) => {
                                      const updated = [...weeklyClientSalesActivity];
                                      updated[index].web = e.target.value;
                                      setWeeklyClientSalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.remarks}
                                    onChange={(e) => {
                                      const updated = [...weeklyClientSalesActivity];
                                      updated[index].remarks = e.target.value;
                                      setWeeklyClientSalesActivity(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {weeklyActiveTab === 'dailyOperations' && (
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="px-5 py-4 w-[35%] min-w-[280px]">Activity</th>
                              <th className="px-5 py-4 w-36">Due Date</th>
                              <th className="px-5 py-4 w-44">Start Date</th>
                              <th className="px-5 py-4 w-44">End Date</th>
                              <th className="px-5 py-4 w-40 text-center">Status</th>
                              <th className="px-5 py-4">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {weeklyDailyOperations.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.dueDate || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyDailyOperations];
                                      updated[index].dueDate = e.target.value;
                                      setWeeklyDailyOperations(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    placeholder="Due date"
                                  />
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.startDate || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyDailyOperations];
                                      updated[index].startDate = e.target.value;
                                      setWeeklyDailyOperations(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    placeholder="Start date"
                                  />
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.endDate || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyDailyOperations];
                                      updated[index].endDate = e.target.value;
                                      setWeeklyDailyOperations(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    placeholder="End date"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <select
                                    value={item.status || 'Pending'}
                                    onChange={(e) => {
                                      const updated = [...weeklyDailyOperations];
                                      updated[index].status = e.target.value;
                                      setWeeklyDailyOperations(updated);
                                    }}
                                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                                  >
                                    <option value="Done">Done</option>
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="NA">NA</option>
                                  </select>
                                </td>
                                <td className="px-5 py-3">
                                  <input
                                    type="text"
                                    value={item.remarks}
                                    onChange={(e) => {
                                      const updated = [...weeklyDailyOperations];
                                      updated[index].remarks = e.target.value;
                                      setWeeklyDailyOperations(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                            <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                              <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-300">Reports Collected from Team</td>
                              <td colSpan={3}></td>
                              <td className="px-5 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={weeklyReportsCollectedDone}
                                  onChange={(e) => setWeeklyReportsCollectedDone(e.target.checked)}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                              </td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {weeklyActiveTab === 'performanceKpis' && (
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="px-5 py-4 w-[40%]">KPI</th>
                              <th className="px-5 py-4 w-[30%] text-center">Target</th>
                              <th className="px-5 py-4 w-[30%] text-center">Achieved</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {weeklyPerformanceKpis.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.kpi}</td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.target}
                                    onChange={(e) => {
                                      const updated = [...weeklyPerformanceKpis];
                                      updated[index].target = e.target.value;
                                      setWeeklyPerformanceKpis(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.achieved}
                                    onChange={(e) => {
                                      const updated = [...weeklyPerformanceKpis];
                                      updated[index].achieved = e.target.value;
                                      setWeeklyPerformanceKpis(updated);
                                    }}
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none text-slate-700 dark:text-slate-200 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {weeklyActiveTab === 'issuesFeedback' && (
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={addWeeklyIssueRow}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all"
                          >
                            <Plus size={14} /> Add Row
                          </button>
                        </div>
                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                <th className="px-5 py-4 w-[40%]">Issue</th>
                                <th className="px-5 py-4 w-[20%] text-center">Priority</th>
                                <th className="px-5 py-4 w-[35%]">Support Needed</th>
                                <th className="px-5 py-4 w-[5%] text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {weeklyIssuesFeedback.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                                  <td className="px-5 py-3">
                                    <input
                                      type="text"
                                      value={item.issue}
                                      onChange={(e) => {
                                        const updated = [...weeklyIssuesFeedback];
                                        updated[index].issue = e.target.value;
                                        setWeeklyIssuesFeedback(updated);
                                      }}
                                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-5 py-3 text-center">
                                    <select
                                      value={item.priority}
                                      onChange={(e) => {
                                        const updated = [...weeklyIssuesFeedback];
                                        updated[index].priority = e.target.value;
                                        setWeeklyIssuesFeedback(updated);
                                      }}
                                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                                    >
                                      <option value="High">High</option>
                                      <option value="Medium">Medium</option>
                                      <option value="Low">Low</option>
                                    </select>
                                  </td>
                                  <td className="px-5 py-3">
                                    <input
                                      type="text"
                                      value={item.supportNeeded}
                                      onChange={(e) => {
                                        const updated = [...weeklyIssuesFeedback];
                                        updated[index].supportNeeded = e.target.value;
                                        setWeeklyIssuesFeedback(updated);
                                      }}
                                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-5 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeWeeklyIssueRow(index)}
                                      disabled={weeklyIssuesFeedback.length === 1}
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
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <button
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-355 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900"
                >
                  Close
                </button>

                {isWeeklyConsolidated && (
                  <button
                    onClick={handleDownloadWeeklyPDF}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10"
                  >
                    <Download size={16} />
                    Download Weekly PDF
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

export default AcademicCounselorReportPage;
