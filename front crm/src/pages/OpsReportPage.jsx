import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { uploadCompiledPDFReport } from '../services/departmentService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, Plus, Trash2, Save, Download, 
  CheckCircle, HelpCircle, Loader2, User, ChevronLeft, ChevronRight, ChevronDown, Pencil, X, Maximize2,
  MinusCircle, PlusCircle
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompletedTasks, fetchDelegatedTasks } from '../utils/taskUtils';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

const API_BASE = import.meta.env.VITE_API_URL;

// Default data for Operations Manager Shift Report
const DEFAULT_KPI_TRACKING = [
  { project: '', kpi: '', target: '', achieved: '' },
  { project: '', kpi: '', target: '', achieved: '' },
  { project: '', kpi: '', target: '', achieved: '' }
];

const DEFAULT_DAILY_OPERATIONS = [
  { activity: 'Team Attendance Verified', status: '', dueDate: '', remarks: '', isTodoTask: false },
  { activity: 'Daily Sales Targets Assigned', status: '', dueDate: '', remarks: '', isTodoTask: false },
  { activity: 'Lead Follow-up Reviewed', status: '', dueDate: '', remarks: '', isTodoTask: false },
  { activity: 'Client Meetings Conducted', status: '', dueDate: '', remarks: '', isTodoTask: false },
  { activity: 'Academy Coordination Completed', status: '', dueDate: '', remarks: '', isTodoTask: false },
  { activity: 'Reports Collected from Team', status: '', dueDate: '', remarks: '', isTodoTask: false }
];

const DEFAULT_SALES_ACTIVITY = [
  { activity: 'New Leads Generated', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Qualified Lead', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Total Calls Made', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Total Follow up', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Hot Leads', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Warm Leads', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Cold Leads', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  // { activity: 'Call back Leads', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'RNT Leads (Ring Next Time)', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Switch Off Leads', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Wrong leads', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  // { activity: 'Total Pending Follow-ups', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Total Pending Leads', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Client/Student Meetings Fixed', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' },
  { activity: 'Admissions/Closings Done', count: '', digitalMktg: '', web: '', dueDate: '', remarks: '' }
];

const DEFAULT_SALES_PERFORMANCE = [
  { staffName: 'Sales Executive', taskAssigned: '', leads: '', closings: '', status: '' },
  { staffName: 'Tele Caller', taskAssigned: '', leads: '', closings: '', status: '' },
  { staffName: 'Freelance Exec.', taskAssigned: '', leads: '', closings: '', status: '' },
  { staffName: 'Intern/Trainee', taskAssigned: '', leads: '', closings: '', status: '' }
];

const DEFAULT_REVENUE_TRACKING = [
  { category: 'Sales Revenue', amount: '' },
  { category: 'Academy Revenue', amount: '' },
  { category: 'Pending Payments', amount: '' },
  { category: 'Total Revenue', amount: '' }
];

const DEFAULT_ACADEMY_STATUS = [
  { activity: 'Classes Conducted', status: '', dueDate: '', remarks: '' },
  { activity: 'Mentor Coordination', status: '', dueDate: '', remarks: '' },
  { activity: 'Student Follow-up', status: '', dueDate: '', remarks: '' },
  { activity: 'Admissions Follow-up', status: '', dueDate: '', remarks: '' }
];

const OpsReportPage = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [isPrivileged, setIsPrivileged] = useState(false);

  const [hiddenSections, setHiddenSections] = useState({});

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Weekly Report States
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [weeklyEndDate, setWeeklyEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [weeklyActiveTab, setWeeklyActiveTab] = useState("range");
  
  const [weeklyBasicDetails, setWeeklyBasicDetails] = useState({
    dateRange: '',
    employeeName: '',
    employeeId: '',
    department: 'Sales & Growth',
    designation: 'Manager - OPS',
    shiftTiming: '9:30 AM - 5:30 PM',
    reportingTo: 'Executive Director'
  });
  const [weeklySalesActivity, setWeeklySalesActivity] = useState(DEFAULT_SALES_ACTIVITY);
  const [weeklySalesPerformance, setWeeklySalesPerformance] = useState(DEFAULT_SALES_PERFORMANCE);
  const [weeklyRevenueTracking, setWeeklyRevenueTracking] = useState(DEFAULT_REVENUE_TRACKING);
  const [weeklyAcademyStatus, setWeeklyAcademyStatus] = useState(DEFAULT_ACADEMY_STATUS);
  const [weeklyKpiTracking, setWeeklyKpiTracking] = useState([]);
  const [weeklyIssuesEscalations, setWeeklyIssuesEscalations] = useState({
    issue: '',
    priority: '',
    actionTaken: ''
  });
  const [weeklyHandover, setWeeklyHandover] = useState({
    pendingLeadsShared: 'Yes',
    crmUpdated: 'Yes',
    reportsSubmitted: 'Yes',
    teamUpdated: 'Yes'
  });
  const [weeklyApproval, setWeeklyApproval] = useState({
    opsName: '',
    directorName: 'Executive Director Approval'
  });

  const [weeklyAchievements, setWeeklyAchievements] = useState('');
  const [weeklyImprovements, setWeeklyImprovements] = useState('');
  const [weeklyNextWeekPlanning, setWeeklyNextWeekPlanning] = useState('');

  // Monthly Report States
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);

  const [monthlyStartDate, setMonthlyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [monthlyEndDate, setMonthlyEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [monthlyActiveTab, setMonthlyActiveTab] = useState("range");
  
  const [monthlyBasicDetails, setMonthlyBasicDetails] = useState({
    dateRange: '',
    employeeName: '',
    employeeId: '',
    department: 'Sales & Growth',
    designation: 'Manager - OPS',
    shiftTiming: '9:30 AM - 5:30 PM',
    reportingTo: 'Executive Director'
  });
  const [monthlySalesActivity, setMonthlySalesActivity] = useState(DEFAULT_SALES_ACTIVITY);
  const [monthlySalesPerformance, setMonthlySalesPerformance] = useState(DEFAULT_SALES_PERFORMANCE);
  const [monthlyRevenueTracking, setMonthlyRevenueTracking] = useState(DEFAULT_REVENUE_TRACKING);
  const [monthlyAcademyStatus, setMonthlyAcademyStatus] = useState(DEFAULT_ACADEMY_STATUS);
  const [monthlyKpiTracking, setMonthlyKpiTracking] = useState([]);
  const [monthlyIssuesEscalations, setMonthlyIssuesEscalations] = useState({
    issue: '',
    priority: '',
    actionTaken: ''
  });
  const [monthlyHandover, setMonthlyHandover] = useState({
    pendingLeadsShared: 'Yes',
    crmUpdated: 'Yes',
    reportsSubmitted: 'Yes',
    teamUpdated: 'Yes'
  });
  const [monthlyApproval, setMonthlyApproval] = useState({
    opsName: '',
    directorName: 'Executive Director Approval'
  });

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
  const [opsStaff, setOpsStaff] = useState([]);

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
  const [submittedDates, setSubmittedDates] = useState([]);

  // Form States
  const [basicDetails, setBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: 'Sales & Growth',
    designation: 'Manager - OPS',
    shiftTiming: '9:30 AM - 5:30 PM',
    reportingTo: 'Executive Director',
    preparedTime: ''
  });

  const [dailyOperations, setDailyOperations] = useState(DEFAULT_DAILY_OPERATIONS);
  const [selectedActivityText, setSelectedActivityText] = useState(null);
  const [salesActivity, setSalesActivity] = useState(DEFAULT_SALES_ACTIVITY);
  const [salesPerformance, setSalesPerformance] = useState(DEFAULT_SALES_PERFORMANCE);
  const [revenueTracking, setRevenueTracking] = useState(DEFAULT_REVENUE_TRACKING);
  const [academyStatus, setAcademyStatus] = useState(DEFAULT_ACADEMY_STATUS);
  const [kpiTracking, setKpiTracking] = useState(DEFAULT_KPI_TRACKING);
  
  const [issuesEscalations, setIssuesEscalations] = useState({
    issue: '',
    priority: '',
    actionTaken: ''
  });

  const [handover, setHandover] = useState({
    pendingLeadsShared: 'Yes',
    crmUpdated: 'Yes / No- NA',
    reportsSubmitted: 'Yes',
    teamUpdated: 'Yes'
  });

  const [approval, setApproval] = useState({
    opsName: '',
    opsSignature: '',
    opsDate: '',
    directorName: 'Executive Director Approval',
    directorSignature: '',
    directorDate: ''
  });

  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

  // Get Auth Headers Helper
  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

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

  // Fetch Ops Staff List (For Admins)
  useEffect(() => {
    if (isPrivileged) {
      const fetchOpsStaff = async () => {
        try {
          const res = await fetch(`${API_BASE}/v1/ops-reports/ops-staff`, {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setOpsStaff(data.data);
            if (data.data.length > 0 && !selectedUserId) {
              setSelectedUserId(data.data[0]._id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch Ops Staff list:", e);
        }
      };
      fetchOpsStaff();
    }
  }, [isPrivileged, getAuthHeaders, selectedUserId]);

  // Fetch submitted dates
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/ops-reports/submitted-dates?userId=${userId}`, {
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

  // Fetch Ops report data
  const fetchReport = async (userId, dateStr) => {
    if (!userId || !dateStr) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/v1/ops-reports/by-date?userId=${userId}&dateString=${dateStr}`, {
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

        setDailyOperations(Array.isArray(report.dailyOperations) ? report.dailyOperations : []);
        setSalesActivity(Array.isArray(report.salesActivity) ? report.salesActivity : []);
        setSalesPerformance(Array.isArray(report.salesPerformance) ? report.salesPerformance : []);
        setRevenueTracking(Array.isArray(report.revenueTracking) ? report.revenueTracking : []);
        setAcademyStatus(Array.isArray(report.academyStatus) ? report.academyStatus : []);

        const savedKpis = Array.isArray(report.kpiTracking) ? report.kpiTracking : [];
        const hasMeaningfulKpi = savedKpis.some(item => (item.project && item.project.trim()) || (item.kpi && item.kpi.trim()));

        if (hasMeaningfulKpi) {
          setKpiTracking(savedKpis);
        } else {
          try {
            const delegatedTasks = await fetchDelegatedTasks(userId, dateStr);
            if (delegatedTasks && delegatedTasks.length > 0) {
              setKpiTracking(delegatedTasks);
            } else {
              setKpiTracking(savedKpis.length > 0 ? savedKpis : DEFAULT_KPI_TRACKING);
            }
          } catch(e) {
            setKpiTracking(savedKpis.length > 0 ? savedKpis : DEFAULT_KPI_TRACKING);
          }
        }

        setIssuesEscalations(report.issuesEscalations || { issue: '', priority: '', actionTaken: '' });
        setHandover(report.handover || { pendingLeadsShared: 'Yes', crmUpdated: 'Yes / No- NA', reportsSubmitted: 'Yes', teamUpdated: 'Yes' });
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
              remarks: t.description || '',
              isTodoTask: true
            }));
            setDailyOperations([...mappedTasks, ...DEFAULT_DAILY_OPERATIONS]);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
        }

        try {
          const delegatedTasks = await fetchDelegatedTasks(userId, dateStr);
          if (delegatedTasks && delegatedTasks.length > 0) {
            setKpiTracking(delegatedTasks);
          }
        } catch(e) {
          console.error("Error auto-fetching delegated tasks:", e);
        }

      }
    } catch (e) {
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
              remarks: t.description || '',
              isTodoTask: true
            }));
            setDailyOperations([...mappedTasks, ...DEFAULT_DAILY_OPERATIONS]);
          }
        } catch(e) {
          console.error("Error auto-fetching tasks:", e);
        }

        try {
          const delegatedTasks = await fetchDelegatedTasks(userId, dateStr);
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
        localStorage.setItem(`cachedBasicDetails_Ops_${selectedUserId}`, JSON.stringify(persistent));
      }
    }
  }, [basicDetails, selectedUserId]);

  const getDatesInRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    let curr = new Date(start);
    let count = 0;
    while (curr <= end && count < 31) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return dates;
  };

  const getMonthlyDatesInRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    let curr = new Date(start);
    let count = 0;
    while (curr <= end && count < 366) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return dates;
  };

  const handleFetchMonthlyData = async () => {
    if (!monthlyStartDate || !monthlyEndDate) {
      showToast("Please select both start and end dates.", "error");
      return;
    }
    if (new Date(monthlyStartDate) > new Date(monthlyEndDate)) {
      showToast("Start date cannot be after end date.", "error");
      return;
    }

    setIsMonthlyLoading(true);
    try {
      const dates = getMonthlyDatesInRange(monthlyStartDate, monthlyEndDate);
      const promises = dates.map(dateStr => 
        fetch(`${API_BASE}/v1/ops-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
          headers: getAuthHeaders()
        }).then(res => res.json())
      );

      const results = await Promise.all(promises);
      const validReports = results.filter(r => r.success && r.data).map(r => r.data);

      let userDetail = currentUser;
      if (opsStaff.length > 0) {
        userDetail = opsStaff.find(u => (u._id || u.id) === selectedUserId) || currentUser;
      }

      const aggregatedSalesActivity = DEFAULT_SALES_ACTIVITY.map(item => ({ ...item, count: 0, digitalMktg: 0, web: 0 }));
      const aggregatedRevenue = DEFAULT_REVENUE_TRACKING.map(item => ({ ...item, amount: 0 }));
      
      const performanceMap = {};
      DEFAULT_SALES_PERFORMANCE.forEach(p => {
        performanceMap[p.staffName] = { ...p, leads: 0, closings: 0 };
      });

      const aggregatedAcademyStatus = DEFAULT_ACADEMY_STATUS.map(item => ({ ...item, status: 'No', remarks: [] }));

      let consolidatedIssues = [];
      let consolidatedActionTaken = [];
      
      validReports.forEach(report => {
        if (Array.isArray(report.salesActivity)) {
          report.salesActivity.forEach(activity => {
            const matchingIndex = aggregatedSalesActivity.findIndex(a => a.activity.trim().toLowerCase() === activity.activity.trim().toLowerCase());
            if (matchingIndex !== -1) {
              const getVal = (val) => {
                if (!val) return 0;
                const matches = String(val).match(/\d+/);
                return matches ? parseInt(matches[0], 10) : 0;
              };
              aggregatedSalesActivity[matchingIndex].count += getVal(activity.count);
              aggregatedSalesActivity[matchingIndex].digitalMktg += getVal(activity.digitalMktg);
              aggregatedSalesActivity[matchingIndex].web += getVal(activity.web);
              if (activity.remarks) {
                const prevRemarks = aggregatedSalesActivity[matchingIndex].remarks;
                aggregatedSalesActivity[matchingIndex].remarks = prevRemarks ? `${prevRemarks}; ${activity.remarks}` : activity.remarks;
              }
            }
          });
        }

        if (Array.isArray(report.revenueTracking)) {
          report.revenueTracking.forEach(rev => {
            const matchingIndex = aggregatedRevenue.findIndex(r => r.category.trim().toLowerCase() === rev.category.trim().toLowerCase());
            if (matchingIndex !== -1) {
              const getAmountVal = (val) => {
                if (!val) return 0;
                const clean = String(val).replace(/[₹,]/g, '').trim();
                const num = parseFloat(clean);
                return isNaN(num) ? 0 : num;
              };
              aggregatedRevenue[matchingIndex].amount += getAmountVal(rev.amount);
            }
          });
        }

        if (Array.isArray(report.salesPerformance)) {
          report.salesPerformance.forEach(p => {
            if (performanceMap[p.staffName]) {
              const getVal = (val) => {
                if (!val) return 0;
                const matches = String(val).match(/\d+/);
                return matches ? parseInt(matches[0], 10) : 0;
              };
              performanceMap[p.staffName].leads += getVal(p.leads);
              performanceMap[p.staffName].closings += getVal(p.closings);
              if (p.taskAssigned && p.taskAssigned !== 'NIL') {
                if (!performanceMap[p.staffName].taskAssigned || performanceMap[p.staffName].taskAssigned === 'NIL') {
                  performanceMap[p.staffName].taskAssigned = p.taskAssigned;
                } else if (!performanceMap[p.staffName].taskAssigned.includes(p.taskAssigned)) {
                  performanceMap[p.staffName].taskAssigned += `, ${p.taskAssigned}`;
                }
              }
            }
          });
        }

        if (Array.isArray(report.academyStatus)) {
          report.academyStatus.forEach(a => {
            const matchingIndex = aggregatedAcademyStatus.findIndex(ac => ac.activity.trim().toLowerCase() === a.activity.trim().toLowerCase());
            if (matchingIndex !== -1) {
              if (a.status === 'Yes' || a.status === 'Done') {
                aggregatedAcademyStatus[matchingIndex].status = 'Yes';
              }
              if (a.remarks) {
                aggregatedAcademyStatus[matchingIndex].remarks.push(a.remarks);
              }
            }
          });
        }

        if (report.issuesEscalations) {
          if (report.issuesEscalations.issue && report.issuesEscalations.issue !== 'None' && report.issuesEscalations.issue !== 'NIL') {
            consolidatedIssues.push(report.issuesEscalations.issue);
          }
          if (report.issuesEscalations.actionTaken && report.issuesEscalations.actionTaken !== 'None' && report.issuesEscalations.actionTaken !== 'NIL') {
            consolidatedActionTaken.push(report.issuesEscalations.actionTaken);
          }
        }
      });

      const finalSalesActivity = aggregatedSalesActivity.map(a => ({
        ...a,
        count: String(a.count),
        digitalMktg: a.digitalMktg > 0 ? String(a.digitalMktg) : '',
        web: a.web > 0 ? String(a.web) : '',
        remarks: a.remarks || ''
      }));

      const finalRevenue = aggregatedRevenue.map(r => ({
        ...r,
        amount: `₹${r.amount.toLocaleString('en-IN')}`
      }));

      const finalPerformance = Object.values(performanceMap).map(p => ({
        ...p,
        leads: String(p.leads),
        closings: String(p.closings),
        status: p.leads > 0 ? 'DONE' : 'NIL'
      }));

      const finalAcademyStatus = aggregatedAcademyStatus.map(a => ({
        ...a,
        remarks: a.remarks.filter(Boolean).join('; ')
      }));

      setMonthlyBasicDetails({
        dateRange: `${monthlyStartDate} to ${monthlyEndDate}`,
        employeeName: userDetail.name || '',
        employeeId: userDetail.employeeId || '',
        department: 'Sales & Growth',
        designation: userDetail.designationName || userDetail.designation || 'Manager - OPS',
        shiftTiming: '9:30 AM - 5:30 PM',
        reportingTo: 'Executive Director'
      });

      setMonthlySalesActivity(finalSalesActivity);
      setMonthlySalesPerformance(finalPerformance);
      setMonthlyRevenueTracking(finalRevenue);
      setMonthlyAcademyStatus(finalAcademyStatus);

      // Sum KPI Tracking
      const monthlyKpiMap = {};
      validReports.forEach(report => {
        const items = report.kpiTracking || [];
        items.forEach(item => {
          const projectKey = (item.project || '').trim() || 'General';
          const kpiKey = (item.kpi || '').trim();
          if (!kpiKey) return;
          const compositeKey = `${projectKey}::${kpiKey}`;
          if (!monthlyKpiMap[compositeKey]) {
            monthlyKpiMap[compositeKey] = { project: projectKey, kpi: kpiKey, targets: [], achieveds: [] };
          }
          if (item.target) monthlyKpiMap[compositeKey].targets.push(item.target.trim());
          if (item.achieved) monthlyKpiMap[compositeKey].achieveds.push(item.achieved.trim());
        });
      });
      const consolidatedMonthlyKpi = Object.values(monthlyKpiMap).map(group => {
        const target = Array.from(new Set(group.targets)).filter(Boolean).join('; ');
        const achieved = Array.from(new Set(group.achieveds)).filter(Boolean).join('; ');
        return { project: group.project, kpi: group.kpi, target, achieved };
      });
      setMonthlyKpiTracking(consolidatedMonthlyKpi.length > 0 ? consolidatedMonthlyKpi : DEFAULT_KPI_TRACKING);

      setMonthlyIssuesEscalations({
        issue: consolidatedIssues.length > 0 ? consolidatedIssues.join('\n') : 'None reported',
        priority: consolidatedIssues.length > 0 ? 'Medium' : 'None',
        actionTaken: consolidatedActionTaken.length > 0 ? consolidatedActionTaken.join('\n') : 'N/A'
      });

      setMonthlyHandover({
        pendingLeadsShared: 'Yes',
        crmUpdated: 'Yes',
        reportsSubmitted: 'Yes',
        teamUpdated: 'Yes'
      });

      setMonthlyApproval({
        opsName: userDetail.name || '',
        directorName: 'Executive Director Approval'
      });

      setMonthlyActiveTab("sales");

      if (validReports.length === 0) {
        showToast(`No daily reports found in date range. Initialized empty monthly report.`, 'warning');
      } else {
        showToast(`Successfully consolidated ${validReports.length} daily reports!`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast("Error aggregating monthly data.", "error");
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const handleFetchWeeklyData = async () => {
    if (!weeklyStartDate || !weeklyEndDate) {
      showToast("Please select both start and end dates.", "error");
      return;
    }
    if (new Date(weeklyStartDate) > new Date(weeklyEndDate)) {
      showToast("Start date cannot be after end date.", "error");
      return;
    }

    setIsWeeklyLoading(true);
    try {
      const dates = getDatesInRange(weeklyStartDate, weeklyEndDate);
      const promises = dates.map(dateStr => 
        fetch(`${API_BASE}/v1/ops-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
          headers: getAuthHeaders()
        }).then(res => res.json())
      );

      const results = await Promise.all(promises);
      const validReports = results.filter(r => r.success && r.data).map(r => r.data);

      let userDetail = currentUser;
      if (opsStaff.length > 0) {
        userDetail = opsStaff.find(u => (u._id || u.id) === selectedUserId) || currentUser;
      }

      const aggregatedSalesActivity = DEFAULT_SALES_ACTIVITY.map(item => ({ ...item, count: 0, digitalMktg: 0, web: 0 }));
      const aggregatedRevenue = DEFAULT_REVENUE_TRACKING.map(item => ({ ...item, amount: 0 }));
      
      const performanceMap = {};
      DEFAULT_SALES_PERFORMANCE.forEach(p => {
        performanceMap[p.staffName] = { ...p, leads: 0, closings: 0 };
      });

      const aggregatedAcademyStatus = DEFAULT_ACADEMY_STATUS.map(item => ({ ...item, status: 'No', remarks: [] }));

      let consolidatedIssues = [];
      let consolidatedActionTaken = [];
      
      validReports.forEach(report => {
        if (Array.isArray(report.salesActivity)) {
          report.salesActivity.forEach(activity => {
            const matchingIndex = aggregatedSalesActivity.findIndex(a => a.activity.trim().toLowerCase() === activity.activity.trim().toLowerCase());
            if (matchingIndex !== -1) {
              const getVal = (val) => {
                if (!val) return 0;
                const matches = String(val).match(/\d+/);
                return matches ? parseInt(matches[0], 10) : 0;
              };
              aggregatedSalesActivity[matchingIndex].count += getVal(activity.count);
              aggregatedSalesActivity[matchingIndex].digitalMktg += getVal(activity.digitalMktg);
              aggregatedSalesActivity[matchingIndex].web += getVal(activity.web);
              if (activity.remarks) {
                const prevRemarks = aggregatedSalesActivity[matchingIndex].remarks;
                aggregatedSalesActivity[matchingIndex].remarks = prevRemarks ? `${prevRemarks}; ${activity.remarks}` : activity.remarks;
              }
            }
          });
        }

        if (Array.isArray(report.revenueTracking)) {
          report.revenueTracking.forEach(rev => {
            const matchingIndex = aggregatedRevenue.findIndex(r => r.category.trim().toLowerCase() === rev.category.trim().toLowerCase());
            if (matchingIndex !== -1) {
              const getAmountVal = (val) => {
                if (!val) return 0;
                const clean = String(val).replace(/[₹,]/g, '').trim();
                const num = parseFloat(clean);
                return isNaN(num) ? 0 : num;
              };
              aggregatedRevenue[matchingIndex].amount += getAmountVal(rev.amount);
            }
          });
        }

        if (Array.isArray(report.salesPerformance)) {
          report.salesPerformance.forEach(p => {
            if (performanceMap[p.staffName]) {
              const getVal = (val) => {
                if (!val) return 0;
                const matches = String(val).match(/\d+/);
                return matches ? parseInt(matches[0], 10) : 0;
              };
              performanceMap[p.staffName].leads += getVal(p.leads);
              performanceMap[p.staffName].closings += getVal(p.closings);
              if (p.taskAssigned && p.taskAssigned !== 'NIL') {
                if (!performanceMap[p.staffName].taskAssigned || performanceMap[p.staffName].taskAssigned === 'NIL') {
                  performanceMap[p.staffName].taskAssigned = p.taskAssigned;
                } else if (!performanceMap[p.staffName].taskAssigned.includes(p.taskAssigned)) {
                  performanceMap[p.staffName].taskAssigned += `, ${p.taskAssigned}`;
                }
              }
            }
          });
        }

        if (Array.isArray(report.academyStatus)) {
          report.academyStatus.forEach(a => {
            const matchingIndex = aggregatedAcademyStatus.findIndex(ac => ac.activity.trim().toLowerCase() === a.activity.trim().toLowerCase());
            if (matchingIndex !== -1) {
              if (a.status === 'Yes' || a.status === 'Done') {
                aggregatedAcademyStatus[matchingIndex].status = 'Yes';
              }
              if (a.remarks) {
                aggregatedAcademyStatus[matchingIndex].remarks.push(a.remarks);
              }
            }
          });
        }

        if (report.issuesEscalations) {
          if (report.issuesEscalations.issue && report.issuesEscalations.issue !== 'None' && report.issuesEscalations.issue !== 'NIL') {
            consolidatedIssues.push(report.issuesEscalations.issue);
          }
          if (report.issuesEscalations.actionTaken && report.issuesEscalations.actionTaken !== 'None' && report.issuesEscalations.actionTaken !== 'NIL') {
            consolidatedActionTaken.push(report.issuesEscalations.actionTaken);
          }
        }
      });

      const finalSalesActivity = aggregatedSalesActivity.map(a => ({
        ...a,
        count: String(a.count),
        digitalMktg: a.digitalMktg > 0 ? String(a.digitalMktg) : '',
        web: a.web > 0 ? String(a.web) : '',
        remarks: a.remarks || ''
      }));

      const finalRevenue = aggregatedRevenue.map(r => ({
        ...r,
        amount: `₹${r.amount.toLocaleString('en-IN')}`
      }));

      const finalPerformance = Object.values(performanceMap).map(p => ({
        ...p,
        leads: String(p.leads),
        closings: String(p.closings),
        status: p.leads > 0 ? 'DONE' : 'NIL'
      }));

      const finalAcademyStatus = aggregatedAcademyStatus.map(a => ({
        ...a,
        remarks: a.remarks.filter(Boolean).join('; ')
      }));

      setWeeklyBasicDetails({
        dateRange: `${weeklyStartDate} to ${weeklyEndDate}`,
        employeeName: userDetail.name || '',
        employeeId: userDetail.employeeId || '',
        department: 'Sales & Growth',
        designation: userDetail.designationName || userDetail.designation || 'Manager - OPS',
        shiftTiming: '9:30 AM - 5:30 PM',
        reportingTo: 'Executive Director'
      });

      setWeeklySalesActivity(finalSalesActivity);
      setWeeklySalesPerformance(finalPerformance);
      setWeeklyRevenueTracking(finalRevenue);
      setWeeklyAcademyStatus(finalAcademyStatus);

      // Sum KPI Tracking
      const weeklyKpiMap = {};
      validReports.forEach(report => {
        const items = report.kpiTracking || [];
        items.forEach(item => {
          const projectKey = (item.project || '').trim() || 'General';
          const kpiKey = (item.kpi || '').trim();
          if (!kpiKey) return;
          const compositeKey = `${projectKey}::${kpiKey}`;
          if (!weeklyKpiMap[compositeKey]) {
            weeklyKpiMap[compositeKey] = { project: projectKey, kpi: kpiKey, targets: [], achieveds: [] };
          }
          if (item.target) weeklyKpiMap[compositeKey].targets.push(item.target.trim());
          if (item.achieved) weeklyKpiMap[compositeKey].achieveds.push(item.achieved.trim());
        });
      });
      const consolidatedWeeklyKpi = Object.values(weeklyKpiMap).map(group => {
        const target = Array.from(new Set(group.targets)).filter(Boolean).join('; ');
        const achieved = Array.from(new Set(group.achieveds)).filter(Boolean).join('; ');
        return { project: group.project, kpi: group.kpi, target, achieved };
      });
      setWeeklyKpiTracking(consolidatedWeeklyKpi.length > 0 ? consolidatedWeeklyKpi : DEFAULT_KPI_TRACKING);

      setWeeklyIssuesEscalations({
        issue: consolidatedIssues.length > 0 ? consolidatedIssues.join('\n') : 'None reported',
        priority: consolidatedIssues.length > 0 ? 'Medium' : 'None',
        actionTaken: consolidatedActionTaken.length > 0 ? consolidatedActionTaken.join('\n') : 'N/A'
      });

      setWeeklyHandover({
        pendingLeadsShared: 'Yes',
        crmUpdated: 'Yes',
        reportsSubmitted: 'Yes',
        teamUpdated: 'Yes'
      });

      setWeeklyApproval({
        opsName: userDetail.name || '',
        directorName: 'Executive Director Approval'
      });

      setWeeklyActiveTab("sales");

      if (validReports.length === 0) {
        showToast(`No daily reports found in date range. Initialized empty weekly report.`, 'warning');
      } else {
        showToast(`Successfully consolidated ${validReports.length} daily reports!`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast("Error aggregating weekly data.", "error");
    } finally {
      setIsWeeklyLoading(false);
    }
  };

  const handleDownloadWeeklyPDF = async (weeklyData) => {
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
          if (typeof drawHeader === 'function') drawHeader();
          currentY = 27;
        }
        doc.setFillColor(60, 35, 117);
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(132, 204, 22); // Lime Green
        doc.text("KOD.", 14, 21);
        
        doc.setTextColor(60, 35, 117);
        doc.text("brand", 34, 21);

        doc.setFontSize(15);
        doc.setTextColor(60, 35, 117);
        doc.text("WEEKLY OPERATIONS REPORT", 95, 16);
        
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text("WEEKLY CONSOLIDATION", 145, 22);
      };

      drawHeader();
      currentY = 27;

      drawSectionHeader("1. WEEKLY DETAILS");
      const basicDetailsRows = [
        ["Date Range", weeklyData.basicDetails.dateRange || ''],
        ["Employee Name:", weeklyData.basicDetails.employeeName || ''],
        ["Employee ID", weeklyData.basicDetails.employeeId || ''],
        ["Department", weeklyData.basicDetails.department || ''],
        ["Designation", weeklyData.basicDetails.designation || ''],
        ["Shift Timing", weeklyData.basicDetails.shiftTiming || ''],
        ["Reporting To", weeklyData.basicDetails.reportingTo || '']
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

      drawSectionHeader("2. WEEKLY SALES ACTIVITY (CONSOLIDATED)");
      const counselingHeaders = [["Activity", "Count", "Digital Mktg", "Web", "Remarks"]];
      const counselingRows = weeklyData.salesActivity.map(s => [s.activity || '', s.count || '', s.digitalMktg || '', s.web || '', s.remarks || '']);

      autoTable(doc, {
        head: counselingHeaders,
        body: counselingRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 68 },
          1: { width: 28, halign: 'center' },
          2: { width: 24, halign: 'center' },
          3: { width: 24, halign: 'center' },
          4: { width: 38 }
        },
        margin: { left: 14, right: 14 }
      });

      doc.addPage();
      currentY = 15;
      drawHeader();
      currentY = 27;

      drawSectionHeader("3. WEEKLY SALES TEAM PERFORMANCE");
      const perfHeaders = [["Staff Name", "Task Assigned", "Leads", "Closings", "Status"]];
      const perfRows = weeklyData.salesPerformance.map(p => [p.staffName || '', p.taskAssigned || '', p.leads || '', p.closings || '', p.status || '']);

      autoTable(doc, {
        head: perfHeaders,
        body: perfRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 45 },
          1: { width: 45 },
          2: { width: 30, halign: 'center' },
          3: { width: 30, halign: 'center' },
          4: { width: 32, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("4. WEEKLY REVENUE TRACKING");
      const revHeaders = [["Revenue Category", "Amount"]];
      const revRows = weeklyData.revenueTracking.map(r => [r.category || '', r.amount || '']);

      autoTable(doc, {
        head: revHeaders,
        body: revRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 110 },
          1: { width: 72, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("5. WEEKLY ACADEMY STATUS");
      const academyHeaders = [["Activity", "Status", "Remarks"]];
      const academyRows = weeklyData.academyStatus.map(a => [a.activity || '', a.status || '', a.remarks || '']);

      autoTable(doc, {
        head: academyHeaders,
        body: academyRows,
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

      drawSectionHeader("6. WEEKLY ISSUES / ESCALATIONS");
      const issuesRows = [
        ["Issues / Escalations:", weeklyData.issuesEscalations.issue || ''],
        ["Priority:", weeklyData.issuesEscalations.priority || ''],
        ["Action Taken:", weeklyData.issuesEscalations.actionTaken || '']
      ];
      autoTable(doc, {
        body: issuesRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 45 },
          1: { width: 137 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("7. WEEKLY SUMMARY & PLANNING");
      const summaryRows = [
        ["Achievements:", weeklyData.achievements || ''],
        ["Improvements Needed:", weeklyData.improvements || ''],
        ["Next Week Planning:", weeklyData.nextWeekPlanning || '']
      ];
      autoTable(doc, {
        body: summaryRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 45 },
          1: { width: 137 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("8. WEEKLY HANDOVER");
      const handoverRows = [
        ["Pending Leads Shared:", weeklyData.handover.pendingLeadsShared || ''],
        ["CRM Updated: Yes / No - NA", weeklyData.handover.crmUpdated || ''],
        ["Reports Submitted: Yes", weeklyData.handover.reportsSubmitted || ''],
        ["Team Updated: Yes", weeklyData.handover.teamUpdated || '']
      ];
      autoTable(doc, {
        body: handoverRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 65 },
          1: { width: 117 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 35, 117);
      doc.text(weeklyData.approval.opsName || '', 30, currentY);
      doc.text(weeklyData.approval.directorName || '', 130, currentY);

      doc.setDrawColor(60, 35, 117);
      doc.line(20, currentY + 1.5, 75, currentY + 1.5);
      doc.line(120, currentY + 1.5, 175, currentY + 1.5);

      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Manager - OPS Sales & Growth", 25, currentY + 5.5);
      doc.text("Executive Director Approval", 127, currentY + 5.5);

      const pdfBlob = doc.output('blob');
      const filename = `Operations_Weekly_Report_${weeklyData.basicDetails.employeeName || 'Ops'}_${weeklyData.basicDetails.dateRange.replace(/ /g, '_')}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, weeklyData.basicDetails.dateRange, pdfBlob, filename, 'ops', 'weekly');
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

  const handleDownloadMonthlyPDF = async (monthlyData) => {
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
          if (typeof drawHeader === 'function') drawHeader();
          currentY = 27;
        }
        doc.setFillColor(60, 35, 117);
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(132, 204, 22); // Lime Green
        doc.text("KOD.", 14, 21);
        
        doc.setTextColor(60, 35, 117);
        doc.text("brand", 34, 21);

        doc.setFontSize(14);
        doc.setTextColor(60, 35, 117);
        doc.text("MONTHLY CONSOLIDATED OPERATIONS REPORT", 75, 16);
        
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text("MONTHLY CONSOLIDATION", 145, 22);
      };

      drawHeader();
      currentY = 27;

      drawSectionHeader("1. MONTHLY DETAILS");
      const basicDetailsRows = [
        ["Date Range", monthlyData.basicDetails.dateRange || ''],
        ["Employee Name:", monthlyData.basicDetails.employeeName || ''],
        ["Employee ID", monthlyData.basicDetails.employeeId || ''],
        ["Department", monthlyData.basicDetails.department || ''],
        ["Designation", monthlyData.basicDetails.designation || ''],
        ["Shift Timing", monthlyData.basicDetails.shiftTiming || ''],
        ["Reporting To", monthlyData.basicDetails.reportingTo || '']
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

      drawSectionHeader("2. MONTHLY SALES ACTIVITY (CONSOLIDATED)");
      const counselingHeaders = [["Activity", "Count", "Digital Mktg", "Web", "Remarks"]];
      const counselingRows = monthlyData.salesActivity.map(s => [s.activity || '', s.count || '', s.digitalMktg || '', s.web || '', s.remarks || '']);

      autoTable(doc, {
        head: counselingHeaders,
        body: counselingRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 68 },
          1: { width: 28, halign: 'center' },
          2: { width: 24, halign: 'center' },
          3: { width: 24, halign: 'center' },
          4: { width: 38 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("3. MONTHLY SALES TEAM PERFORMANCE");
      const perfHeaders = [["Staff Name", "Task Assigned", "Leads", "Closings", "Status"]];
      const perfRows = monthlyData.salesPerformance.map(p => [p.staffName || '', p.taskAssigned || '', p.leads || '', p.closings || '', p.status || '']);

      autoTable(doc, {
        head: perfHeaders,
        body: perfRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 45 },
          1: { width: 45 },
          2: { width: 30, halign: 'center' },
          3: { width: 30, halign: 'center' },
          4: { width: 32, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("4. MONTHLY REVENUE TRACKING");
      const revHeaders = [["Revenue Category", "Amount"]];
      const revRows = monthlyData.revenueTracking.map(r => [r.category || '', r.amount || '']);

      autoTable(doc, {
        head: revHeaders,
        body: revRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 110 },
          1: { width: 72, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("5. MONTHLY ACADEMY STATUS");
      const academyHeaders = [["Activity", "Status", "Remarks"]];
      const academyRows = monthlyData.academyStatus.map(a => [a.activity || '', a.status || '', a.remarks || '']);

      autoTable(doc, {
        head: academyHeaders,
        body: academyRows,
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

      drawSectionHeader("6. MONTHLY ISSUES / ESCALATIONS");
      const issuesRows = [
        ["Issues / Escalations:", monthlyData.issuesEscalations.issue || ''],
        ["Priority:", monthlyData.issuesEscalations.priority || ''],
        ["Action Taken:", monthlyData.issuesEscalations.actionTaken || '']
      ];
      autoTable(doc, {
        body: issuesRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 45 },
          1: { width: 137 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      drawSectionHeader("7. MONTHLY HANDOVER");
      const handoverRows = [
        ["Pending Leads Shared:", monthlyData.handover.pendingLeadsShared || ''],
        ["CRM Updated: Yes / No - NA", monthlyData.handover.crmUpdated || ''],
        ["Reports Submitted: Yes", monthlyData.handover.reportsSubmitted || ''],
        ["Team Updated: Yes", monthlyData.handover.teamUpdated || '']
      ];
      autoTable(doc, {
        body: handoverRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 65 },
          1: { width: 117 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 35, 117);
      doc.text(monthlyData.approval.opsName || '', 30, currentY);
      doc.text(monthlyData.approval.directorName || '', 130, currentY);

      doc.setDrawColor(60, 35, 117);
      doc.line(20, currentY + 1.5, 75, currentY + 1.5);
      doc.line(120, currentY + 1.5, 175, currentY + 1.5);

      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Manager - OPS Sales & Growth", 25, currentY + 5.5);
      doc.text("Executive Director Approval", 127, currentY + 5.5);

      const pdfBlob = doc.output('blob');
      const filename = `Operations_Monthly_Report_${monthlyData.basicDetails.employeeName || 'Ops'}_${monthlyData.basicDetails.dateRange.replace(/ /g, '_')}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, monthlyData.basicDetails.dateRange, pdfBlob, filename, 'ops', 'monthly');
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

    const initializeBlankReport = async (userId, dateStr) => {
    let freshestUser = currentUser;
    try {
      const su = localStorage.getItem('user');
      if (su) freshestUser = JSON.parse(su);
    } catch(e){}

    let userDetail = freshestUser;
    if (isPrivileged && opsStaff.length > 0) {
      userDetail = opsStaff.find(u => (u._id || u.id) === userId) || freshestUser;
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
    const cached = localStorage.getItem(`cachedBasicDetails_Ops_${userId}`);
    const parsedCached = cached ? JSON.parse(cached) : null;

    setBasicDetails({
      date: formattedDateString,
      day: dayName,
      employeeName: userDetail.name || parsedCached?.employeeName || '',
      employeeId: userDetail.employeeId || parsedCached?.employeeId || '',
      department: parsedCached?.department || 'Sales & Growth',
      designation: userDetail.designationName || userDetail.designation || parsedCached?.designation || 'Manager - OPS',
      shiftTiming: parsedCached?.shiftTiming || '9:30 AM - 5:30 PM',
      reportingTo: userDetail.reportingManager || parsedCached?.reportingTo || 'Executive Director',
      preparedTime: parsedCached?.preparedTime || timeStr
    });

    setDailyOperations(DEFAULT_DAILY_OPERATIONS);

    // Auto-fetch lead stats from CRM for the selected date
    try {
      const res = await fetch(`${API_BASE}/v1/ops-reports/lead-stats?date=${dateStr}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSalesActivity(data.data);
      } else {
        setSalesActivity(DEFAULT_SALES_ACTIVITY);
      }
    } catch (e) {
      console.error('Failed to auto-fetch lead stats:', e);
      setSalesActivity(DEFAULT_SALES_ACTIVITY);
    }

    setSalesPerformance(DEFAULT_SALES_PERFORMANCE);
    setRevenueTracking(DEFAULT_REVENUE_TRACKING);
    setAcademyStatus(DEFAULT_ACADEMY_STATUS);
    try {
      const delegatedTasks = await fetchDelegatedTasks(userId, dateStr);
      if (delegatedTasks && delegatedTasks.length > 0) {
        setKpiTracking(delegatedTasks);
      } else {
        setKpiTracking(DEFAULT_KPI_TRACKING);
      }
    } catch(e) {
      setKpiTracking(DEFAULT_KPI_TRACKING);
    }
    setIssuesEscalations({
      issue: '',
      priority: '',
      actionTaken: ''
    });
    setHandover({
      pendingLeadsShared: 'Yes',
      crmUpdated: 'Yes / No- NA',
      reportsSubmitted: 'Yes',
      teamUpdated: 'Yes'
    });
    setApproval({
      opsName: userDetail.name || '',
      opsSignature: '',
      opsDate: formattedDateString,
      directorName: 'Executive Director Approval',
      directorSignature: '',
      directorDate: ''
    });
  };

  const handleSaveReport = async () => {
    try {
      setSaving(true);

      const cleanDailyOperations = Array.isArray(dailyOperations) ? dailyOperations.filter(t => (t.activity || '').trim() !== '') : [];
      const cleanSalesActivity = Array.isArray(salesActivity) ? salesActivity.filter(t => (t.activity || '').trim() !== '' || (t.count || '').trim() !== '') : [];
      const cleanSalesPerformance = Array.isArray(salesPerformance) ? salesPerformance.filter(t => (t.staffName || '').trim() !== '' || (t.taskAssigned || '').trim() !== '') : [];
      const cleanRevenueTracking = Array.isArray(revenueTracking) ? revenueTracking.filter(t => (t.category || '').trim() !== '' || (t.amount || '').trim() !== '') : [];
      const cleanAcademyStatus = Array.isArray(academyStatus) ? academyStatus.filter(t => (t.activity || '').trim() !== '') : [];
      const cleanKpiTracking = Array.isArray(kpiTracking) ? kpiTracking.filter(t => (t.project || '').trim() !== '' || (t.kpi || '').trim() !== '') : [];
      const cleanIssuesEscalations = Array.isArray(issuesEscalations) ? issuesEscalations.filter(t => (t.issue || '').trim() !== '') : issuesEscalations;
      const cleanHandover = Array.isArray(handover) ? handover.filter(t => (t.particulars || '').trim() !== '') : handover;

      const excludedSections = Object.entries(hiddenSections).filter(([_, h]) => h).map(([k]) => k);

      const payload = {
        userId: selectedUserId,
        dateString: selectedDate,
        basicDetails,
        dailyOperations: cleanDailyOperations,
        salesActivity: cleanSalesActivity,
        salesPerformance: cleanSalesPerformance,
        revenueTracking: cleanRevenueTracking,
        academyStatus: cleanAcademyStatus,
        kpiTracking: cleanKpiTracking,
        issuesEscalations: cleanIssuesEscalations,
        handover: cleanHandover,
        approval,
        excludedSections,
        hiddenSections
      };

      const res = await fetch(`${API_BASE}/v1/ops-reports`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Operations Daily Shift Report saved successfully!", 'success');
        fetchSubmittedDates(selectedUserId);
        return true;
      } else {
        showToast(data.message || "Failed to save the report.", 'error');
        return false;
      }
    } catch (e) {
      console.error(e);
      showToast("Server error. Please try again.", 'error');
      return false;
    } finally {
      setSaving(false);
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

  const addWeeklyKpiRow = () => {
    setWeeklyKpiTracking([...weeklyKpiTracking, { project: '', kpi: '', target: '', achieved: '' }]);
  };

  const removeWeeklyKpiRow = (index) => {
    if (weeklyKpiTracking.length > 1) {
      setWeeklyKpiTracking(weeklyKpiTracking.filter((_, i) => i !== index));
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

  const handleDownloadPDF = async () => {
    const reportType = 'ops';
    // Automatically save report as well
    const saved = await handleSaveReport();
    if (!saved) return;

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

      {/* RIGHT PANEL: Form Details */}
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
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Operations Daily Shift Report
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fill, review, and download operations daily reports.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 text-white font-semibold text-sm transition-all shadow-md"
                >
                  <Calendar size={16} />
                  Weekly Report
                </button>

                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white font-semibold text-sm transition-all shadow-md"
                >
                  <Calendar size={16} />
                  Monthly Report
                </button>

                

                <AiAnalyzeButton
                  onClick={() => {
                    setAiModalContext({
                      employeeName: basicDetails.employeeName,
                      department: 'Operations & Management',
                      designation: basicDetails.designation,
                      date: selectedDate,
                      actualReportContentText: JSON.stringify({ basicDetails, kpiTracking, projectOperations, clientInteractions, taskDelegation, teamPerformance, issuesEscalation, nextDayPlanning, opsComments: comments })
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
              title="Operations Report AI Analysis"
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
                  onClick={() => setDailyOperations([...dailyOperations, { activity: '', dueDate: '', startDate: '', endDate: '', status: 'ongoing', remarks: '' }])}
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
                      <th className="px-4 py-3 w-44">Start Date</th>
                      <th className="px-4 py-3 w-44">End Date</th>
                      <th className="px-4 py-3 w-40">Status</th>
                      <th className="px-4 py-3">Remarks</th>
                      <th className="px-4 py-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {dailyOperations.map((row, i) => {
                      const isTodo = Boolean(row.isTodoTask || row.startDate || row.endDate);
                      return (
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
                            {isTodo ? (
                              <input
                                type="text"
                                value={row.dueDate || ''}
                                onChange={(e) => {
                                  const newArr = [...dailyOperations];
                                  newArr[i].dueDate = e.target.value;
                                  setDailyOperations(newArr);
                                }}
                                className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                                placeholder="Due date"
                              />
                            ) : (
                              <span className="text-slate-400 text-xs font-medium text-center block">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {isTodo ? (
                              <input
                                type="text"
                                value={row.startDate || ''}
                                onChange={(e) => {
                                  const newArr = [...dailyOperations];
                                  newArr[i].startDate = e.target.value;
                                  setDailyOperations(newArr);
                                }}
                                className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                                placeholder="DD-MM-YYYY HH:mm"
                              />
                            ) : (
                              <span className="text-slate-400 text-xs font-medium text-center block">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {isTodo ? (
                              <input
                                type="text"
                                value={row.endDate || ''}
                                onChange={(e) => {
                                  const newArr = [...dailyOperations];
                                  newArr[i].endDate = e.target.value;
                                  setDailyOperations(newArr);
                                }}
                                className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                                placeholder="DD-MM-YYYY HH:mm"
                              />
                            ) : (
                              <span className="text-slate-400 text-xs font-medium text-center block">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {isTodo ? (
                              <input
                                type="text"
                                value={row.status || ''}
                                onChange={(e) => {
                                  const newArr = [...dailyOperations];
                                  newArr[i].status = e.target.value;
                                  setDailyOperations(newArr);
                                }}
                                className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-medium"
                                placeholder="Status"
                              />
                            ) : (
                              <select
                                value={row.status || ''}
                                onChange={(e) => {
                                  const newArr = [...dailyOperations];
                                  newArr[i].status = e.target.value;
                                  setDailyOperations(newArr);
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                {row.status && row.status !== 'Yes' && row.status !== 'No' && (
                                  <option value={row.status}>{row.status}</option>
                                )}
                              </select>
                            )}
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
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. DAILY COURSE COUNSELING & SALES ACTIVITY */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">3</span>
                Daily Course Counseling & Sales Activity
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3 w-32 text-center">Count</th>
                      <th className="px-4 py-3 w-32 text-center">Digital Mktg</th>
                      <th className="px-4 py-3 w-32 text-center">Web</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {salesActivity.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.count}
                            onChange={(e) => {
                              const newArr = [...salesActivity];
                              newArr[i].count = e.target.value;
                              setSalesActivity(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-center"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.digitalMktg}
                            onChange={(e) => {
                              const newArr = [...salesActivity];
                              newArr[i].digitalMktg = e.target.value;
                              setSalesActivity(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-center"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.web}
                            onChange={(e) => {
                              const newArr = [...salesActivity];
                              newArr[i].web = e.target.value;
                              setSalesActivity(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-center"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => {
                              const newArr = [...salesActivity];
                              newArr[i].remarks = e.target.value;
                              setSalesActivity(newArr);
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

            {/* 4. SALES TEAM PERFORMANCE */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">4</span>
                Sales Team Performance
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Staff Name</th>
                      <th className="px-4 py-3">Task Assigned</th>
                      <th className="px-4 py-3 w-32 text-center">Leads</th>
                      <th className="px-4 py-3 w-32 text-center">Closings</th>
                      <th className="px-4 py-3 w-32 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {salesPerformance.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500">{row.staffName}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.taskAssigned}
                            onChange={(e) => {
                              const newArr = [...salesPerformance];
                              newArr[i].taskAssigned = e.target.value;
                              setSalesPerformance(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.leads}
                            onChange={(e) => {
                              const newArr = [...salesPerformance];
                              newArr[i].leads = e.target.value;
                              setSalesPerformance(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-center"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.closings}
                            onChange={(e) => {
                              const newArr = [...salesPerformance];
                              newArr[i].closings = e.target.value;
                              setSalesPerformance(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-center"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.status}
                            onChange={(e) => {
                              const newArr = [...salesPerformance];
                              newArr[i].status = e.target.value;
                              setSalesPerformance(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-center"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. KPI TRACKING (TASKS ASSIGNED TO OTHERS) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5</span>
                  KPI Tracking (Tasks Assigned to Others)
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const delegatedTasks = await fetchDelegatedTasks(selectedUserId, selectedDate);
                        if (delegatedTasks && delegatedTasks.length > 0) {
                          setKpiTracking(delegatedTasks);
                          showToast(`Fetched ${delegatedTasks.length} delegated tasks!`, 'success');
                        } else {
                          showToast('No delegated tasks found for this date.', 'info');
                        }
                      } catch (e) {
                        console.error(e);
                        showToast('Error refreshing tasks', 'error');
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-lime-400 font-bold transition-all cursor-pointer"
                    title="Auto-fetch delegated tasks for this date"
                  >
                    <Loader2 size={13} className="hover:rotate-180 transition-transform" /> Refresh Tasks
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

              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
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
                            placeholder="Staff name / Project"
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
                              placeholder="Task details"
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
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={item.achieved}
                            onChange={(e) => {
                              const updated = [...kpiTracking];
                              updated[index].achieved = e.target.value;
                              setKpiTracking(updated);
                            }}
                            placeholder="Status"
                            className="w-full bg-transparent border-none focus:outline-none text-center text-sm text-slate-700 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeKpiRow(index)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                            title="Remove Row"
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

            {/* 6. REVENUE TRACKING */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">6</span>
                Revenue Tracking
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Revenue Category</th>
                      <th className="px-4 py-3 w-48 text-center">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {revenueTracking.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500">{row.category}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.amount}
                            onChange={(e) => {
                              const newArr = [...revenueTracking];
                              newArr[i].amount = e.target.value;
                              setRevenueTracking(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-center"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. ACADEMY STATUS */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">6</span>
                Academy Status
              </h2>
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3 w-40">Status</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {academyStatus.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-xs text-slate-500 cursor-pointer hover:text-indigo-600 dark:hover:text-lime-400 transition-colors" onClick={() => setSelectedActivityText(row.activity)}>{row.activity}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.status}
                            onChange={(e) => {
                              const newArr = [...academyStatus];
                              newArr[i].status = e.target.value;
                              setAcademyStatus(newArr);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none p-0 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => {
                              const newArr = [...academyStatus];
                              newArr[i].remarks = e.target.value;
                              setAcademyStatus(newArr);
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

            {/* 7. ISSUES / Escalations */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">7</span>
                Issues / Escalations
              </h2>
              <div className="grid grid-cols-1 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Issues/Escalations</label>
                  <textarea
                    value={issuesEscalations.issue || ''}
                    onChange={(e) => setIssuesEscalations({ ...issuesEscalations, issue: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                  <input
                    type="text"
                    value={issuesEscalations.priority || ''}
                    onChange={(e) => setIssuesEscalations({ ...issuesEscalations, priority: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. High / Medium / Low"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Action Taken</label>
                  <textarea
                    value={issuesEscalations.actionTaken || ''}
                    onChange={(e) => setIssuesEscalations({ ...issuesEscalations, actionTaken: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px]"
                  />
                </div>
              </div>
            </div>

            {/* 8. HANDOVER */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">8</span>
                Handover Status
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Pending Leads Shared</label>
                  <input
                    type="text"
                    value={handover.pendingLeadsShared || ''}
                    onChange={(e) => setHandover({ ...handover, pendingLeadsShared: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">CRM Updated: Yes / No - NA</label>
                  <input
                    type="text"
                    value={handover.crmUpdated || ''}
                    onChange={(e) => setHandover({ ...handover, crmUpdated: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Reports Submitted: Yes</label>
                  <input
                    type="text"
                    value={handover.reportsSubmitted || ''}
                    onChange={(e) => setHandover({ ...handover, reportsSubmitted: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Team Updated: Yes</label>
                  <input
                    type="text"
                    value={handover.teamUpdated || ''}
                    onChange={(e) => setHandover({ ...handover, teamUpdated: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 9. APPROVAL */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">9</span>
                Approval Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Manager - OPS</h4>
                  <div>
                    <label className="block text-xs mb-1">Name</label>
                    <input
                      type="text"
                      value={approval.opsName || ''}
                      onChange={(e) => setApproval({ ...approval, opsName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Signature</label>
                    <SignatureUpload
                      value={approval.opsSignature || ''}
                      onChange={(val) => setApproval({ ...approval, opsSignature: val })}
                      placeholder="Upload ops signature"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Date</label>
                    <input
                      type="text"
                      value={approval.opsDate || ''}
                      onChange={(e) => setApproval({ ...approval, opsDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Executive Director</h4>
                  <div>
                    <label className="block text-xs mb-1">Name</label>
                    <input
                      type="text"
                      value={approval.directorName || ''}
                      onChange={(e) => setApproval({ ...approval, directorName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Signature</label>
                    <SignatureUpload
                      value={approval.directorSignature || ''}
                      onChange={(val) => setApproval({ ...approval, directorSignature: val })}
                      placeholder="Upload director signature"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Date</label>
                    <input
                      type="text"
                      value={approval.directorDate || ''}
                      onChange={(e) => setApproval({ ...approval, directorDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 w-full">
              

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

        <AnimatePresence>
          {isWeeklyModalOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col my-8 max-h-[90vh]"
              >
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Weekly Operations Consolidation</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Consolidate daily shift reports into weekly numbers</p>
                  </div>
                  <button
                    onClick={() => setIsWeeklyModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors text-sm font-semibold"
                  >
                    Close
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 gap-1 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
                  <button
                    onClick={() => setWeeklyActiveTab("range")}
                    className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === "range" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    1. Choose Date Range
                  </button>
                  <button
                    onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab("sales") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === "sales" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    2. Sales Activity
                  </button>
                  <button
                    onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab("performance") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === "performance" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    3. Team & Academy
                  </button>
                  <button
                    onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab("kpi") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === "kpi" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    4. KPI Tracking
                  </button>
                  <button
                    onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab("revenue") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === "revenue" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    5. Revenue
                  </button>
                  <button
                    onClick={() => weeklyBasicDetails.dateRange ? setWeeklyActiveTab("issues") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${weeklyActiveTab === "issues" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    6. Issues & Handover
                  </button>
                </div>

                {/* Content body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {weeklyActiveTab === "range" && (
                    <div className="space-y-4 max-w-md mx-auto py-8">
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Select weekly report duration</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
                          <input
                            type="date"
                            value={weeklyStartDate}
                            onChange={(e) => setWeeklyStartDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
                          <input
                            type="date"
                            value={weeklyEndDate}
                            onChange={(e) => setWeeklyEndDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleFetchWeeklyData}
                        disabled={isWeeklyLoading}
                        className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md disabled:opacity-50"
                      >
                        {isWeeklyLoading ? "Consolidating Daily Reports..." : "Fetch & Consolidate Weekly Report"}
                      </button>
                    </div>
                  )}

                  {weeklyActiveTab === "sales" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Consolidated Weekly Sales Activity</h4>
                        <span className="text-xs text-indigo-500 font-semibold bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-full">Date Range: {weeklyBasicDetails.dateRange}</span>
                      </div>
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                              <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3">Due Date</th>
                              <th className="px-4 py-3 text-center w-24">Count</th>
                              <th className="px-4 py-3 text-center w-24">Digital Mktg</th>
                              <th className="px-4 py-3 text-center w-24">Web</th>
                              <th className="px-4 py-3">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {weeklySalesActivity.map((activity, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                                <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-350 text-xs">{activity.activity}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    value={activity.count}
                                    onChange={(e) => {
                                      const updated = [...weeklySalesActivity];
                                      updated[idx].count = e.target.value;
                                      setWeeklySalesActivity(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    value={activity.digitalMktg}
                                    onChange={(e) => {
                                      const updated = [...weeklySalesActivity];
                                      updated[idx].digitalMktg = e.target.value;
                                      setWeeklySalesActivity(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    value={activity.web}
                                    onChange={(e) => {
                                      const updated = [...weeklySalesActivity];
                                      updated[idx].web = e.target.value;
                                      setWeeklySalesActivity(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5">
                                  <input
                                    type="text"
                                    value={activity.remarks}
                                    onChange={(e) => {
                                      const updated = [...weeklySalesActivity];
                                      updated[idx].remarks = e.target.value;
                                      setWeeklySalesActivity(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {weeklyActiveTab === "performance" && (
                    <div className="space-y-6">
                      {/* Performance */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-850 pb-2">Weekly Sales Team Performance</h4>
                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                                <th className="px-4 py-3">Staff Role</th>
                                <th className="px-4 py-3">Task Assigned / Employee Name</th>
                                <th className="px-4 py-3 text-center w-24">Leads</th>
                                <th className="px-4 py-3 text-center w-24">Closings</th>
                                <th className="px-4 py-3 text-center w-24">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {weeklySalesPerformance.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-350 text-xs">{item.staffName}</td>
                                  <td className="px-4 py-2.5">
                                    <input
                                      type="text"
                                      value={item.taskAssigned}
                                      onChange={(e) => {
                                        const updated = [...weeklySalesPerformance];
                                        updated[idx].taskAssigned = e.target.value;
                                        setWeeklySalesPerformance(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <input
                                      type="text"
                                      value={item.leads}
                                      onChange={(e) => {
                                        const updated = [...weeklySalesPerformance];
                                        updated[idx].leads = e.target.value;
                                        setWeeklySalesPerformance(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <input
                                      type="text"
                                      value={item.closings}
                                      onChange={(e) => {
                                        const updated = [...weeklySalesPerformance];
                                        updated[idx].closings = e.target.value;
                                        setWeeklySalesPerformance(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <input
                                      type="text"
                                      value={item.status}
                                      onChange={(e) => {
                                        const updated = [...weeklySalesPerformance];
                                        updated[idx].status = e.target.value;
                                        setWeeklySalesPerformance(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Academy Status */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-850 pb-2">Weekly Academy Status</h4>
                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                                <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3">Due Date</th>
                                <th className="px-4 py-3 text-center w-28">Status</th>
                                <th className="px-4 py-3">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {weeklyAcademyStatus.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-350 text-xs">{item.activity}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <select
                                      value={item.status}
                                      onChange={(e) => {
                                        const updated = [...weeklyAcademyStatus];
                                        updated[idx].status = e.target.value;
                                        setWeeklyAcademyStatus(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-205"
                                    >
                                      <option value="Yes">Yes</option>
                                      <option value="No">No</option>
                                      <option value="Done">Done</option>
                                      <option value="NA">NA</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <input
                                      type="text"
                                      value={item.remarks}
                                      onChange={(e) => {
                                        const updated = [...weeklyAcademyStatus];
                                        updated[idx].remarks = e.target.value;
                                        setWeeklyAcademyStatus(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
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

                  {weeklyActiveTab === "kpi" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Consolidated Weekly KPI Tracking (Tasks Assigned to Others)</h4>
                        <button
                          type="button"
                          onClick={addWeeklyKpiRow}
                          className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold"
                        >
                          <Plus size={14} /> Add Row
                        </button>
                      </div>
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                              <th className="px-4 py-3 w-[20%]">Assigned To</th>
                              <th className="px-4 py-3 w-[40%]">Task</th>
                              <th className="px-4 py-3 w-[20%]">Due Date</th>
                              <th className="px-4 py-3 w-[15%] text-center">Status</th>
                              <th className="px-4 py-3 w-[5%] text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {weeklyKpiTracking.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                                <td className="px-4 py-2.5">
                                  <input
                                    type="text"
                                    value={item.project}
                                    onChange={(e) => {
                                      const updated = [...weeklyKpiTracking];
                                      updated[idx].project = e.target.value;
                                      setWeeklyKpiTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5">
                                  <input
                                    type="text"
                                    value={item.kpi}
                                    onChange={(e) => {
                                      const updated = [...weeklyKpiTracking];
                                      updated[idx].kpi = e.target.value;
                                      setWeeklyKpiTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5">
                                  <input
                                    type="text"
                                    value={item.target}
                                    onChange={(e) => {
                                      const updated = [...weeklyKpiTracking];
                                      updated[idx].target = e.target.value;
                                      setWeeklyKpiTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    value={item.achieved}
                                    onChange={(e) => {
                                      const updated = [...weeklyKpiTracking];
                                      updated[idx].achieved = e.target.value;
                                      setWeeklyKpiTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeWeeklyKpiRow(idx)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
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

                  {weeklyActiveTab === "revenue" && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-850 pb-2">Weekly Revenue tracking (Sums)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {weeklyRevenueTracking.map((rev, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{rev.category}</label>
                            <input
                              type="text"
                              value={rev.amount}
                              onChange={(e) => {
                                const updated = [...weeklyRevenueTracking];
                                updated[idx].amount = e.target.value;
                                setWeeklyRevenueTracking(updated);
                              }}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-right font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {weeklyActiveTab === "issues" && (
                    <div className="space-y-6">
                      {/* Issues */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-850 pb-2">Consolidated Weekly Issues / Blocking</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Consolidated Blockers / Issues</label>
                            <textarea
                              value={weeklyIssuesEscalations.issue}
                              onChange={(e) => setWeeklyIssuesEscalations({ ...weeklyIssuesEscalations, issue: e.target.value })}
                              rows={4}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Weekly Action Taken</label>
                            <textarea
                              value={weeklyIssuesEscalations.actionTaken}
                              onChange={(e) => setWeeklyIssuesEscalations({ ...weeklyIssuesEscalations, actionTaken: e.target.value })}
                              rows={4}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Handover & Approval */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-850 pb-2">Weekly Handover & Approval</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Consolidated Handover Status</label>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span>Pending Leads Shared:</span>
                                <input
                                  type="text"
                                  value={weeklyHandover.pendingLeadsShared}
                                  onChange={(e) => setWeeklyHandover({ ...weeklyHandover, pendingLeadsShared: e.target.value })}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-center w-28"
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span>CRM Updated:</span>
                                <input
                                  type="text"
                                  value={weeklyHandover.crmUpdated}
                                  onChange={(e) => setWeeklyHandover({ ...weeklyHandover, crmUpdated: e.target.value })}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-center w-28"
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Reports Submitted:</span>
                                <input
                                  type="text"
                                  value={weeklyHandover.reportsSubmitted}
                                  onChange={(e) => setWeeklyHandover({ ...weeklyHandover, reportsSubmitted: e.target.value })}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-center w-28"
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Team Updated:</span>
                                <input
                                  type="text"
                                  value={weeklyHandover.teamUpdated}
                                  onChange={(e) => setWeeklyHandover({ ...weeklyHandover, teamUpdated: e.target.value })}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-center w-28"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Weekly Approvals Signatures</label>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Manager Signature Name</label>
                                <input
                                  type="text"
                                  value={weeklyApproval.opsName}
                                  onChange={(e) => setWeeklyApproval({ ...weeklyApproval, opsName: e.target.value })}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-750 dark:text-slate-250"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Director Signature Name</label>
                                <input
                                  type="text"
                                  value={weeklyApproval.directorName}
                                  onChange={(e) => setWeeklyApproval({ ...weeklyApproval, directorName: e.target.value })}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-750 dark:text-slate-250"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Weekly Summary & Planning */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-850 pb-2">Weekly Summary & Planning</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Achievements</label>
                            <textarea
                              value={weeklyAchievements}
                              onChange={(e) => setWeeklyAchievements(e.target.value)}
                              rows={4}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Enter achievements..."
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Improvements</label>
                            <textarea
                              value={weeklyImprovements}
                              onChange={(e) => setWeeklyImprovements(e.target.value)}
                              rows={4}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Enter improvements needed..."
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Next Week Planning</label>
                            <textarea
                              value={weeklyNextWeekPlanning}
                              onChange={(e) => setWeeklyNextWeekPlanning(e.target.value)}
                              rows={4}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Enter next week planning..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsWeeklyModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all border border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </button>

                  {weeklyBasicDetails.dateRange && (
                    <button
                      type="button"
                      onClick={() => handleDownloadWeeklyPDF({
                        basicDetails: weeklyBasicDetails,
                        salesActivity: weeklySalesActivity,
                        salesPerformance: weeklySalesPerformance,
                        revenueTracking: weeklyRevenueTracking,
                        academyStatus: weeklyAcademyStatus,
                        issuesEscalations: weeklyIssuesEscalations,
                        handover: weeklyHandover,
                        approval: weeklyApproval,
                        achievements: weeklyAchievements,
                        improvements: weeklyImprovements,
                        nextWeekPlanning: weeklyNextWeekPlanning
                      })}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-md"
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

        <AnimatePresence>
          {isMonthlyModalOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col my-8 max-h-[90vh]"
              >
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Monthly Operations Consolidation</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Consolidate daily shift reports into monthly numbers</p>
                  </div>
                  <button
                    onClick={() => setIsMonthlyModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors text-sm font-semibold"
                  >
                    Close
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 gap-1 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
                  <button
                    onClick={() => setMonthlyActiveTab("range")}
                    className={`px-4 py-2 rounded-xl transition-all ${monthlyActiveTab === "range" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    1. Choose Date Range
                  </button>
                  <button
                    onClick={() => monthlyBasicDetails.dateRange ? setMonthlyActiveTab("sales") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${monthlyActiveTab === "sales" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    2. Sales Activity
                  </button>
                  <button
                    onClick={() => monthlyBasicDetails.dateRange ? setMonthlyActiveTab("performance") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${monthlyActiveTab === "performance" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    3. Team & Academy
                  </button>
                  <button
                    onClick={() => monthlyBasicDetails.dateRange ? setMonthlyActiveTab("kpi") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${monthlyActiveTab === "kpi" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    4. KPI Tracking
                  </button>
                  <button
                    onClick={() => monthlyBasicDetails.dateRange ? setMonthlyActiveTab("revenue") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${monthlyActiveTab === "revenue" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    5. Revenue
                  </button>
                  <button
                    onClick={() => monthlyBasicDetails.dateRange ? setMonthlyActiveTab("issues") : showToast("Please fetch data first", "warning")}
                    className={`px-4 py-2 rounded-xl transition-all ${monthlyActiveTab === "issues" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-lime-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    6. Issues & Handover
                  </button>
                </div>

                {/* Content body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {monthlyActiveTab === "range" && (
                    <div className="space-y-4 max-w-md mx-auto py-8">
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Select monthly report duration</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
                          <input
                            type="date"
                            value={monthlyStartDate}
                            onChange={(e) => setMonthlyStartDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
                          <input
                            type="date"
                            value={monthlyEndDate}
                            onChange={(e) => setMonthlyEndDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleFetchMonthlyData}
                        disabled={isMonthlyLoading}
                        className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md disabled:opacity-50"
                      >
                        {isMonthlyLoading ? "Consolidating Daily Reports..." : "Fetch & Consolidate Monthly Report"}
                      </button>
                    </div>
                  )}

                  {monthlyActiveTab === "sales" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-855 pb-2">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Consolidated Monthly Sales Activity</h4>
                        <span className="text-xs text-indigo-500 font-semibold bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-full">Date Range: {monthlyBasicDetails.dateRange}</span>
                      </div>
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                              <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3">Due Date</th>
                              <th className="px-4 py-3 text-center w-24">Count</th>
                              <th className="px-4 py-3 text-center w-24">Digital Mktg</th>
                              <th className="px-4 py-3 text-center w-24">Web</th>
                              <th className="px-4 py-3">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {monthlySalesActivity.map((activity, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                                <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-350 text-xs">{activity.activity}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    value={activity.count}
                                    onChange={(e) => {
                                      const updated = [...monthlySalesActivity];
                                      updated[idx].count = e.target.value;
                                      setMonthlySalesActivity(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    value={activity.digitalMktg}
                                    onChange={(e) => {
                                      const updated = [...monthlySalesActivity];
                                      updated[idx].digitalMktg = e.target.value;
                                      setMonthlySalesActivity(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    value={activity.web}
                                    onChange={(e) => {
                                      const updated = [...monthlySalesActivity];
                                      updated[idx].web = e.target.value;
                                      setMonthlySalesActivity(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5">
                                  <input
                                    type="text"
                                    value={activity.remarks}
                                    onChange={(e) => {
                                      const updated = [...monthlySalesActivity];
                                      updated[idx].remarks = e.target.value;
                                      setMonthlySalesActivity(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {monthlyActiveTab === "performance" && (
                    <div className="space-y-6">
                      {/* Performance */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-855 pb-2">Monthly Sales Team Performance</h4>
                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                                <th className="px-4 py-3">Staff Role</th>
                                <th className="px-4 py-3">Task Assigned / Employee Name</th>
                                <th className="px-4 py-3 text-center w-24">Leads</th>
                                <th className="px-4 py-3 text-center w-24">Closings</th>
                                <th className="px-4 py-3 text-center w-24">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {monthlySalesPerformance.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-350 text-xs">{item.staffName}</td>
                                  <td className="px-4 py-2.5">
                                    <input
                                      type="text"
                                      value={item.taskAssigned}
                                      onChange={(e) => {
                                        const updated = [...monthlySalesPerformance];
                                        updated[idx].taskAssigned = e.target.value;
                                        setMonthlySalesPerformance(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <input
                                      type="text"
                                      value={item.leads}
                                      onChange={(e) => {
                                        const updated = [...monthlySalesPerformance];
                                        updated[idx].leads = e.target.value;
                                        setMonthlySalesPerformance(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <input
                                      type="text"
                                      value={item.closings}
                                      onChange={(e) => {
                                        const updated = [...monthlySalesPerformance];
                                        updated[idx].closings = e.target.value;
                                        setMonthlySalesPerformance(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <input
                                      type="text"
                                      value={item.status}
                                      onChange={(e) => {
                                        const updated = [...monthlySalesPerformance];
                                        updated[idx].status = e.target.value;
                                        setMonthlySalesPerformance(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Academy Status */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-855 pb-2">Monthly Academy Status</h4>
                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                                <th className="px-4 py-3 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-3">Due Date</th>
                                <th className="px-4 py-3 text-center w-28">Status</th>
                                <th className="px-4 py-3">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {monthlyAcademyStatus.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-350 text-xs">{item.activity}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <select
                                      value={item.status}
                                      onChange={(e) => {
                                        const updated = [...monthlyAcademyStatus];
                                        updated[idx].status = e.target.value;
                                        setMonthlyAcademyStatus(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                    >
                                      <option value="Yes">Yes</option>
                                      <option value="No">No</option>
                                      <option value="Done">Done</option>
                                      <option value="NA">NA</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <input
                                      type="text"
                                      value={item.remarks}
                                      onChange={(e) => {
                                        const updated = [...monthlyAcademyStatus];
                                        updated[idx].remarks = e.target.value;
                                        setMonthlyAcademyStatus(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
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

                  {monthlyActiveTab === "kpi" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Consolidated Monthly KPI Tracking (Tasks Assigned to Others)</h4>
                        <button
                          type="button"
                          onClick={addMonthlyKpiRow}
                          className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold"
                        >
                          <Plus size={14} /> Add Row
                        </button>
                      </div>
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                              <th className="px-4 py-3 w-[20%]">Assigned To</th>
                              <th className="px-4 py-3 w-[40%]">Task</th>
                              <th className="px-4 py-3 w-[20%]">Due Date</th>
                              <th className="px-4 py-3 w-[15%] text-center">Status</th>
                              <th className="px-4 py-3 w-[5%] text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {monthlyKpiTracking.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-950/5">
                                <td className="px-4 py-2.5">
                                  <input
                                    type="text"
                                    value={item.project}
                                    onChange={(e) => {
                                      const updated = [...monthlyKpiTracking];
                                      updated[idx].project = e.target.value;
                                      setMonthlyKpiTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5">
                                  <input
                                    type="text"
                                    value={item.kpi}
                                    onChange={(e) => {
                                      const updated = [...monthlyKpiTracking];
                                      updated[idx].kpi = e.target.value;
                                      setMonthlyKpiTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5">
                                  <input
                                    type="text"
                                    value={item.target}
                                    onChange={(e) => {
                                      const updated = [...monthlyKpiTracking];
                                      updated[idx].target = e.target.value;
                                      setMonthlyKpiTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    value={item.achieved}
                                    onChange={(e) => {
                                      const updated = [...monthlyKpiTracking];
                                      updated[idx].achieved = e.target.value;
                                      setMonthlyKpiTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1 px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeMonthlyKpiRow(idx)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
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

                  {monthlyActiveTab === "revenue" && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-855 pb-2">Monthly Revenue Tracking (Sums)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {monthlyRevenueTracking.map((rev, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-855 flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{rev.category}</label>
                            <input
                              type="text"
                              value={rev.amount}
                              onChange={(e) => {
                                const updated = [...monthlyRevenueTracking];
                                updated[idx].amount = e.target.value;
                                setMonthlyRevenueTracking(updated);
                              }}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm text-right font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {monthlyActiveTab === "issues" && (
                    <div className="space-y-6">
                      {/* Issues */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-855 pb-2">Consolidated Monthly Issues / Blocking</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Consolidated Blockers / Issues</label>
                            <textarea
                              value={monthlyIssuesEscalations.issue}
                              onChange={(e) => setMonthlyIssuesEscalations({ ...monthlyIssuesEscalations, issue: e.target.value })}
                              rows={4}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monthly Action Taken</label>
                            <textarea
                              value={monthlyIssuesEscalations.actionTaken}
                              onChange={(e) => setMonthlyIssuesEscalations({ ...monthlyIssuesEscalations, actionTaken: e.target.value })}
                              rows={4}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Handover & Approval */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-855 pb-2">Monthly Handover & Approval</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-855 space-y-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Consolidated Handover Status</label>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span>Pending Leads Shared:</span>
                                <input
                                  type="text"
                                  value={monthlyHandover.pendingLeadsShared}
                                  onChange={(e) => setMonthlyHandover({ ...monthlyHandover, pendingLeadsShared: e.target.value })}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-center w-28"
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span>CRM Updated:</span>
                                <input
                                  type="text"
                                  value={monthlyHandover.crmUpdated}
                                  onChange={(e) => setMonthlyHandover({ ...monthlyHandover, crmUpdated: e.target.value })}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-center w-28"
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Reports Submitted:</span>
                                <input
                                  type="text"
                                  value={monthlyHandover.reportsSubmitted}
                                  onChange={(e) => setMonthlyHandover({ ...monthlyHandover, reportsSubmitted: e.target.value })}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-center w-28"
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Team Updated:</span>
                                <input
                                  type="text"
                                  value={monthlyHandover.teamUpdated}
                                  onChange={(e) => setMonthlyHandover({ ...monthlyHandover, teamUpdated: e.target.value })}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-center w-28"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-855 space-y-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monthly Approvals Signatures</label>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Manager Signature Name</label>
                                <input
                                  type="text"
                                  value={monthlyApproval.opsName}
                                  onChange={(e) => setMonthlyApproval({ ...monthlyApproval, opsName: e.target.value })}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-750 dark:text-slate-250"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Director Signature Name</label>
                                <input
                                  type="text"
                                  value={monthlyApproval.directorName}
                                  onChange={(e) => setMonthlyApproval({ ...monthlyApproval, directorName: e.target.value })}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-750 dark:text-slate-250"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsMonthlyModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all border border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </button>

                  {monthlyBasicDetails.dateRange && (
                    <button
                      type="button"
                      onClick={() => handleDownloadMonthlyPDF({
                        basicDetails: monthlyBasicDetails,
                        salesActivity: monthlySalesActivity,
                        salesPerformance: monthlySalesPerformance,
                        revenueTracking: monthlyRevenueTracking,
                        academyStatus: monthlyAcademyStatus,
                        issuesEscalations: monthlyIssuesEscalations,
                        handover: monthlyHandover,
                        approval: monthlyApproval
                      })}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-md"
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

      </div>

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

export default OpsReportPage;
