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
import { fetchCompletedTasks } from '../utils/taskUtils';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

// Defaults from mockup
const DEFAULT_ACCOUNTING_SUMMARY = [
  { activity: 'Daily Entries Updated', status: '', remarks: '' },
  { activity: 'Cash Book Updated', status: '', remarks: '' },
  { activity: 'Bank Transactions Verified', status: '', remarks: '' },
  { activity: 'Invoices Generated', status: '', remarks: '' },
  { activity: 'Payment Follow-up Completed', status: '', remarks: '' },
  { activity: 'Expense Records Updated', status: '', remarks: '' }
];

const DEFAULT_TRANSACTIONS = [
  { transactionType: 'Cash', amount: '', incomes: '', expense: '' },
  { transactionType: 'UPI', amount: '', incomes: '', expense: '' },
  { transactionType: 'Bank Transfer', amount: '', incomes: '', expense: '' },
  { transactionType: 'Client Payments', amount: '', incomes: '', expense: '' },
  { transactionType: 'Vendor Payments', amount: '', incomes: '', expense: '' }
];

const DEFAULT_PAYROLL_STATUS = [
  { activity: 'Salary Processing', amount: '', status: '', remarks: '' },
  { activity: 'Freelancer Payments', amount: '', status: '', remarks: '' },
  { activity: 'Incentives', amount: '', status: '', remarks: '' },
  { activity: 'Reimbursements', amount: '', status: '', remarks: '' }
];

const DEFAULT_EXPENSES = [
  { category: 'Office', amount: '', remarks: '' },
  { category: 'Marketing', amount: '', remarks: '' },
  { category: 'Utilities', amount: '', remarks: '' },
  { category: 'Software', amount: '', remarks: '' },
  { category: 'Misc', amount: '', remarks: '' }
];

const DEFAULT_COMPLIANCE = [
  { activity: 'Receipts Uploaded', status: '' },
  { activity: 'Ledger Updated', status: '' },
  { activity: 'Bank Statements Filed', status: '' },
  { activity: 'Tax Docs Updated', status: '' },
  { activity: 'Backup Completed', status: '' }
];

const DEFAULT_KPI = [
  { kpi: 'Entries Completed', targetAchieved: '' },
  { kpi: 'Invoices', targetAchieved: '' },
  { kpi: 'Follow-ups', targetAchieved: '' },
  { kpi: 'Accuracy', targetAchieved: '' }
];

const DEFAULT_HANDOVER = [
  { item: 'Entries Updated', status: '' },
  { item: 'Reports Submitted', status: '' },
  { item: 'Files Uploaded', status: '' },
  { item: 'Pending Payments Shared', status: '' }
];

const AccountantReportPage = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [isPrivileged, setIsPrivileged] = useState(false);

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
  const [monthlyEndDate, setMonthlyEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [monthlyActiveTab, setMonthlyActiveTab] = useState('summary');

  // Consolidated Form States (Editable inside the Modal)
  const [monthlyBasicDetails, setMonthlyBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: 'Accounts & Finance',
    designation: 'Accountant / Accounts Executive',
    shiftTiming: '9:00 TO 05:00',
    reportingTo: 'Accounts Manager / COO',
    preparedTime: ''
  });
  const [monthlyDailyAccountingSummary, setMonthlyDailyAccountingSummary] = useState([]);
  const [monthlyTransactionReport, setMonthlyTransactionReport] = useState([]);
  const [monthlyInvoiceBillingReport, setMonthlyInvoiceBillingReport] = useState([]);
  const [monthlyPayrollPaymentStatus, setMonthlyPayrollPaymentStatus] = useState([]);
  const [monthlyExpenseTracking, setMonthlyExpenseTracking] = useState([]);
  const [monthlyDocumentationCompliance, setMonthlyDocumentationCompliance] = useState([]);
  const [monthlyKpiTracking, setMonthlyKpiTracking] = useState([]);
  const [monthlyIssuesSupportRequired, setMonthlyIssuesSupportRequired] = useState([]);
  const [monthlyNextDayTaskPlan, setMonthlyNextDayTaskPlan] = useState(['', '', '', '']);
  const [monthlyFinalShiftHandover, setMonthlyFinalShiftHandover] = useState([]);
  const [monthlyAccountantComments, setMonthlyAccountantComments] = useState('');

  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [weeklyEndDate, setWeeklyEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [weeklyActiveTab, setWeeklyActiveTab] = useState('summary');

  // Consolidated Form States (Editable inside the Modal)
  const [weeklyBasicDetails, setWeeklyBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: 'Accounts & Finance',
    designation: 'Accountant / Accounts Executive',
    shiftTiming: '9:00 TO 05:00',
    reportingTo: 'Accounts Manager / COO',
    preparedTime: ''
  });
  const [weeklyDailyAccountingSummary, setWeeklyDailyAccountingSummary] = useState([]);
  const [weeklyTransactionReport, setWeeklyTransactionReport] = useState([]);
  const [weeklyInvoiceBillingReport, setWeeklyInvoiceBillingReport] = useState([]);
  const [weeklyPayrollPaymentStatus, setWeeklyPayrollPaymentStatus] = useState([]);
  const [weeklyExpenseTracking, setWeeklyExpenseTracking] = useState([]);
  const [weeklyDocumentationCompliance, setWeeklyDocumentationCompliance] = useState([]);
  const [weeklyKpiTracking, setWeeklyKpiTracking] = useState([]);
  const [weeklyIssuesSupportRequired, setWeeklyIssuesSupportRequired] = useState([]);
  const [weeklyNextDayTaskPlan, setWeeklyNextDayTaskPlan] = useState(['', '', '', '']);
  const [weeklyFinalShiftHandover, setWeeklyFinalShiftHandover] = useState([]);
  const [weeklyAccountantComments, setWeeklyAccountantComments] = useState('');
  const [weeklyAchievements, setWeeklyAchievements] = useState('');
  const [weeklyImprovements, setWeeklyImprovements] = useState('');
  const [weeklyNextWeekPlanning, setWeeklyNextWeekPlanning] = useState('');

  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

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
  const [accountantStaff, setAccountantStaff] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);

  // Form States
  const [basicDetails, setBasicDetails] = useState({
    date: '',
    day: '',
    employeeName: '',
    employeeId: '',
    department: 'Accounts & Finance',
    designation: 'Accountant / Accounts Executive',
    shiftTiming: '9:00 TO 05:00',
    reportingTo: 'Accounts Manager / COO',
    preparedTime: ''
  });

  const [dailyAccountingSummary, setDailyAccountingSummary] = useState(DEFAULT_ACCOUNTING_SUMMARY);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [transactionReport, setTransactionReport] = useState(DEFAULT_TRANSACTIONS);
  const [invoiceBillingReport, setInvoiceBillingReport] = useState([]);
  const [payrollPaymentStatus, setPayrollPaymentStatus] = useState(DEFAULT_PAYROLL_STATUS);
  const [expenseTracking, setExpenseTracking] = useState(DEFAULT_EXPENSES);
  const [documentationCompliance, setDocumentationCompliance] = useState(DEFAULT_COMPLIANCE);
  const [kpiTracking, setKpiTracking] = useState(DEFAULT_KPI);
  const [issuesSupportRequired, setIssuesSupportRequired] = useState([]);
  const [nextDayTaskPlan, setNextDayTaskPlan] = useState(['', '', '', '']);
  const [finalShiftHandover, setFinalShiftHandover] = useState(DEFAULT_HANDOVER);
  const [accountantComments, setAccountantComments] = useState('');
  
  const [approval, setApproval] = useState({
    accountantName: '',
    accountantSignature: '',
    accountantDate: '',
    managerName: 'Accounts Manager / COO Approval',
    managerSignature: '',
    managerDate: ''
  });

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

  // Fetch Accountant Staff (For Admins)
  useEffect(() => {
    if (isPrivileged) {
      const fetchAccountants = async () => {
        try {
          const res = await fetch(`${API_BASE}/v1/accountant-reports/accountant-staff`, {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setAccountantStaff(data.data);
            if (data.data.length > 0 && !selectedUserId) {
              setSelectedUserId(data.data[0]._id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch accountant staff list:", e);
        }
      };
      fetchAccountants();
    }
  }, [isPrivileged, getAuthHeaders, selectedUserId]);

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

  // Fetch submitted dates
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/accountant-reports/submitted-dates?userId=${userId}`, {
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

  // Fetch Accountant report data
  const fetchReport = async (userId, dateStr) => {
    if (!userId || !dateStr) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/v1/accountant-reports/by-date?userId=${userId}&dateString=${dateStr}`, {
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

        setDailyAccountingSummary(report.dailyAccountingSummary || DEFAULT_ACCOUNTING_SUMMARY);
        setDailyTasks(report.dailyTasks || []);
        setTransactionReport(report.transactionReport || []);
        setInvoiceBillingReport(report.invoiceBillingReport || []);
        setPayrollPaymentStatus(report.payrollPaymentStatus || []);
        setExpenseTracking(report.expenseTracking || []);
        setDocumentationCompliance(report.documentationCompliance || []);
        setKpiTracking(report.kpiTracking || []);
        setIssuesSupportRequired(report.issuesSupportRequired || []);
        
        let plan = report.nextDayTaskPlan || [];
        while (plan.length < 4) plan.push('');
        setNextDayTaskPlan(plan);

        setFinalShiftHandover(report.finalShiftHandover || []);
        setAccountantComments(report.accountantComments || '');
        setApproval(report.approval || {});
      } else {
        initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({ activity: t.title, status: t.status || 'Done', dueDate: t.dueDate || '', startDate: t.startDate || t.startTime || t.startDateTimeLocal || '', endDate: t.endDate || t.endTime || t.endDateTimeLocal || '', remarks: t.description || 'Auto-fetched' }));
            setDailyTasks(mappedTasks);
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
            setDailyTasks(mappedTasks);
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
        localStorage.setItem(`cachedBasicDetails_Accountant_${selectedUserId}`, JSON.stringify(persistent));
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
    if (isPrivileged && accountantStaff.length > 0) {
      userDetail = accountantStaff.find(u => (u._id || u.id) === userId) || freshestUser;
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
    const timeStr = `${hours}.${minutes} ${ampm}`;

    // Load from cache if exists
    const cached = localStorage.getItem(`cachedBasicDetails_Accountant_${userId}`);
    const parsedCached = cached ? JSON.parse(cached) : null;

    setBasicDetails({
      date: formattedDateString,
      day: dayName.toUpperCase(),
      employeeName: userDetail.name || parsedCached?.employeeName || '',
      employeeId: userDetail.employeeId || parsedCached?.employeeId || '',
      department: userDetail.department || parsedCached?.department || 'Accounts & Finance',
      designation: userDetail.designationName || userDetail.designation || parsedCached?.designation || 'Accountant / Accounts Executive',
      shiftTiming: parsedCached?.shiftTiming || '9:00 TO 05:00',
      reportingTo: userDetail.reportingManager || parsedCached?.reportingTo || 'Accounts Manager / COO',
      preparedTime: parsedCached?.preparedTime || timeStr
    });

    setDailyAccountingSummary(DEFAULT_ACCOUNTING_SUMMARY);
    setDailyTasks([]);
    setTransactionReport(DEFAULT_TRANSACTIONS);
    setInvoiceBillingReport([]);
    setPayrollPaymentStatus(DEFAULT_PAYROLL_STATUS);
    setExpenseTracking(DEFAULT_EXPENSES);
    setDocumentationCompliance(DEFAULT_COMPLIANCE);
    setKpiTracking(DEFAULT_KPI);
    setIssuesSupportRequired([]);
    setNextDayTaskPlan(['', '', '', '']);
    setFinalShiftHandover(DEFAULT_HANDOVER);
    setAccountantComments('');
    setApproval({
      accountantName: userDetail.name || '',
      accountantSignature: '',
      accountantDate: formattedDateString,
      managerName: 'Accounts Manager / COO Approval',
      managerSignature: '',
      managerDate: ''
    });
  };

  const handleSaveReport = async () => {
    try {
      setSaving(true);

      const cleanDailyAccountingSummary = dailyAccountingSummary.filter(t => (t.activity || '').trim() !== '');
      const cleanDailyTasks = dailyTasks.filter(t => (t.activity || '').trim() !== '');
      const cleanTransactionReport = transactionReport.filter(t => (t.transactionType || '').trim() !== '' || (t.amount || '').trim() !== '' || (t.incomes || '').trim() !== '' || (t.expense || '').trim() !== '');
      const cleanInvoiceBillingReport = invoiceBillingReport.filter(t => (t.clientVendor || t.clientName || '').trim() !== '' || (t.amount || '').trim() !== '');
      const cleanPayrollPaymentStatus = payrollPaymentStatus.filter(t => (t.activity || t.employeeName || '').trim() !== '');
      const cleanExpenseTracking = expenseTracking.filter(t => (t.category || t.expenseParticulars || '').trim() !== '' || (t.amount || '').trim() !== '');
      const cleanDocumentationCompliance = documentationCompliance.filter(t => (t.activity || t.particulars || '').trim() !== '');
      const cleanKpiTracking = kpiTracking.filter(t => (t.kpi || '').trim() !== '');
      const cleanIssuesSupportRequired = issuesSupportRequired.filter(t => (t.issue || '').trim() !== '');
      const cleanFinalShiftHandover = finalShiftHandover.filter(t => (t.item || t.particulars || '').trim() !== '');

      const excludedSections = Object.entries(hiddenSections).filter(([_, h]) => h).map(([k]) => k);

      const payload = {
        userId: selectedUserId,
        dateString: selectedDate,
        basicDetails,
        dailyAccountingSummary: cleanDailyAccountingSummary,
        dailyTasks: cleanDailyTasks,
        transactionReport: cleanTransactionReport,
        invoiceBillingReport: cleanInvoiceBillingReport,
        payrollPaymentStatus: cleanPayrollPaymentStatus,
        expenseTracking: cleanExpenseTracking,
        documentationCompliance: cleanDocumentationCompliance,
        kpiTracking: cleanKpiTracking,
        issuesSupportRequired: cleanIssuesSupportRequired,
        nextDayTaskPlan,
        finalShiftHandover: cleanFinalShiftHandover,
        accountantComments,
        approval,
        excludedSections,
        hiddenSections
      };

      const res = await fetch(`${API_BASE}/v1/accountant-reports`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Accountant Daily Shift Report saved successfully!", 'success');
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

  const handleFetchMonthlyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a user first.", "error");
      return;
    }
    try {
      setIsMonthlyLoading(true);
      
      const start = new Date(monthlyStartDate);
      const end = new Date(monthlyEndDate);
      
      if (end < start) {
        showToast("End date must be after or equal to start date.", "error");
        setIsMonthlyLoading(false);
        return;
      }
      
      const dates = [];
      let current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      
      if (dates.length > 90) {
        showToast("Date range cannot exceed 90 days.", "warning");
      }
      
      const fetchedReports = await Promise.all(
        dates.map(async (dateStr) => {
          try {
            const res = await fetch(`${API_BASE}/v1/accountant-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
              headers: getAuthHeaders()
            });
            const data = await res.json();
            return data.success && data.data ? data.data : null;
          } catch (e) {
            return null;
          }
        })
      );
      
      const validReports = fetchedReports.filter(Boolean);
      
      if (validReports.length === 0) {
        showToast("No submitted reports found in the selected range.", "warning");
        setMonthlyDailyAccountingSummary(DEFAULT_ACCOUNTING_SUMMARY.map(item => ({ ...item, status: '', remarks: '' })));
        setMonthlyTransactionReport(DEFAULT_TRANSACTIONS.map(item => ({ ...item, count: '0', amount: '-' })));
        setMonthlyInvoiceBillingReport([]);
        setMonthlyPayrollPaymentStatus(DEFAULT_PAYROLL_STATUS.map(item => ({ ...item, status: '', remarks: '' })));
        setMonthlyExpenseTracking(DEFAULT_EXPENSES.map(item => ({ ...item, amount: '', remarks: '' })));
        setMonthlyDocumentationCompliance(DEFAULT_COMPLIANCE.map(item => ({ ...item, status: '' })));
        setMonthlyKpiTracking(DEFAULT_KPI.map(item => ({ ...item, targetAchieved: '' })));
        setMonthlyIssuesSupportRequired([]);
        setMonthlyNextDayTaskPlan(['', '', '', '']);
        setMonthlyFinalShiftHandover(DEFAULT_HANDOVER.map(item => ({ ...item, status: '' })));
        setMonthlyAccountantComments('No reports found in range.');
        
        let userDetail = currentUser;
        if (isPrivileged && accountantStaff.length > 0) {
          userDetail = accountantStaff.find(u => u._id === selectedUserId) || currentUser;
        }
        
        setMonthlyBasicDetails({
          date: `${start.toLocaleDateString('en-GB').replace(/\//g, '-')} to ${end.toLocaleDateString('en-GB').replace(/\//g, '-')}`,
          day: 'MONTHLY REPORT',
          employeeName: userDetail.name || '',
          employeeId: userDetail.employeeId || '',
          department: 'Accounts & Finance',
          designation: userDetail.designationName || userDetail.designation || 'Accountant / Accounts Executive',
          shiftTiming: '9:00 TO 05:00',
          reportingTo: 'Accounts Manager / COO',
          preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
        
        setIsMonthlyLoading(false);
        return;
      }
      
      showToast(`Consolidating ${validReports.length} reports...`, "success");
      
      let userDetail = currentUser;
      if (isPrivileged && accountantStaff.length > 0) {
        userDetail = accountantStaff.find(u => u._id === selectedUserId) || currentUser;
      }
      
      setMonthlyBasicDetails({
        date: `${start.toLocaleDateString('en-GB').replace(/\//g, '-')} to ${end.toLocaleDateString('en-GB').replace(/\//g, '-')}`,
        day: 'MONTHLY REPORT',
        employeeName: validReports[0].basicDetails?.employeeName || userDetail.name || '',
        employeeId: validReports[0].basicDetails?.employeeId || userDetail.employeeId || '',
        department: validReports[0].basicDetails?.department || 'Accounts & Finance',
        designation: validReports[0].basicDetails?.designation || userDetail.designation || 'Accountant / Accounts Executive',
        shiftTiming: validReports[0].basicDetails?.shiftTiming || '9:00 TO 05:00',
        reportingTo: validReports[0].basicDetails?.reportingTo || 'Accounts Manager / COO',
        preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });
      
      const summaryMap = {};
      DEFAULT_ACCOUNTING_SUMMARY.forEach(item => {
        summaryMap[item.activity] = { statuses: [], remarks: [] };
      });
      validReports.forEach(report => {
        const list = report.dailyAccountingSummary || [];
        list.forEach(row => {
          const act = row.activity || 'Unknown';
          if (!summaryMap[act]) {
            summaryMap[act] = { statuses: [], remarks: [] };
          }
          if (row.status && row.status.trim()) summaryMap[act].statuses.push(row.status.trim());
          if (row.remarks && row.remarks.trim()) summaryMap[act].remarks.push(row.remarks.trim());
        });
      });
      const consolidatedSummary = Object.keys(summaryMap).map(act => ({
        activity: act,
        status: Array.from(new Set(summaryMap[act].statuses)).join('; '),
        dueDate: '', remarks: Array.from(new Set(summaryMap[act].remarks)).join('; ')
      }));
      setMonthlyDailyAccountingSummary(consolidatedSummary);
      
      const transMap = {};
      DEFAULT_TRANSACTIONS.forEach(t => {
        transMap[t.transactionType] = { count: 0, amount: 0, hasValues: false };
      });
      validReports.forEach(report => {
        const list = report.transactionReport || [];
        list.forEach(row => {
          const type = row.transactionType || 'Unknown';
          if (!transMap[type]) {
            transMap[type] = { count: 0, amount: 0, hasValues: false };
          }
          
          if (row.count !== undefined && row.count !== null && String(row.count).trim() !== '') {
            const parsedCount = parseInt(String(row.count).replace(/,/g, ''), 10);
            if (!isNaN(parsedCount)) {
              transMap[type].count += parsedCount;
              transMap[type].hasValues = true;
            }
          }
          
          if (row.amount !== undefined && row.amount !== null && String(row.amount).trim() !== '' && String(row.amount).trim() !== '-') {
            const parsedAmount = parseFloat(String(row.amount).replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsedAmount)) {
              transMap[type].amount += parsedAmount;
              transMap[type].hasValues = true;
            }
          }
        });
      });
      const consolidatedTrans = Object.keys(transMap).map(type => ({
        transactionType: type,
        count: String(transMap[type].count),
        amount: transMap[type].hasValues && transMap[type].amount !== 0
          ? transMap[type].amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '-'
      }));
      setMonthlyTransactionReport(consolidatedTrans);
      
      const consolidatedInvoices = [];
      validReports.forEach(report => {
        const list = report.invoiceBillingReport || [];
        list.forEach(row => {
          if (row.clientVendor || row.type || row.amount || row.status || row.remarks) {
            consolidatedInvoices.push({
              clientVendor: row.clientVendor || '',
              type: row.type || '',
              amount: row.amount || '',
              status: row.status || '',
              remarks: row.remarks || ''
            });
          }
        });
      });
      setMonthlyInvoiceBillingReport(consolidatedInvoices);
      
      const payrollMap = {};
      DEFAULT_PAYROLL_STATUS.forEach(item => {
        payrollMap[item.activity] = { amounts: [], statuses: [], remarks: [] };
      });
      validReports.forEach(report => {
        const list = report.payrollPaymentStatus || [];
        list.forEach(row => {
          const act = row.activity || 'Unknown';
          if (!payrollMap[act]) {
            payrollMap[act] = { amounts: [], statuses: [], remarks: [] };
          }
          if (row.amount && String(row.amount).trim()) payrollMap[act].amounts.push(String(row.amount).trim());
          if (row.status && row.status.trim()) payrollMap[act].statuses.push(row.status.trim());
          if (row.remarks && row.remarks.trim()) payrollMap[act].remarks.push(row.remarks.trim());
        });
      });
      const consolidatedPayroll = Object.keys(payrollMap).map(act => ({
        activity: act,
        amount: Array.from(new Set(payrollMap[act].amounts)).join('; '),
        status: Array.from(new Set(payrollMap[act].statuses)).join('; '),
        dueDate: '', remarks: Array.from(new Set(payrollMap[act].remarks)).join('; ')
      }));
      setMonthlyPayrollPaymentStatus(consolidatedPayroll);
      
      const expMap = {};
      DEFAULT_EXPENSES.forEach(e => {
        expMap[e.category] = { amount: 0, remarksList: [], hasAmount: false };
      });
      validReports.forEach(report => {
        const list = report.expenseTracking || [];
        list.forEach(row => {
          const cat = row.category || 'Unknown';
          if (!expMap[cat]) {
            expMap[cat] = { amount: 0, remarksList: [], hasAmount: false };
          }
          
          if (row.amount !== undefined && row.amount !== null && String(row.amount).trim() !== '') {
            const parsedAmount = parseFloat(String(row.amount).replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsedAmount)) {
              expMap[cat].amount += parsedAmount;
              expMap[cat].hasAmount = true;
            }
          }
          if (row.remarks && row.remarks.trim()) {
            expMap[cat].remarksList.push(row.remarks.trim());
          }
        });
      });
      const consolidatedExpenses = Object.keys(expMap).map(cat => ({
        category: cat,
        amount: expMap[cat].hasAmount && expMap[cat].amount !== 0
          ? expMap[cat].amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '',
        remarks: Array.from(new Set(expMap[cat].remarksList)).join('; ')
      }));
      setMonthlyExpenseTracking(consolidatedExpenses);
      
      const complianceMap = {};
      DEFAULT_COMPLIANCE.forEach(item => {
        complianceMap[item.activity] = { statuses: [] };
      });
      validReports.forEach(report => {
        const list = report.documentationCompliance || [];
        list.forEach(row => {
          const act = row.activity || 'Unknown';
          if (!complianceMap[act]) {
            complianceMap[act] = { statuses: [] };
          }
          if (row.status && row.status.trim()) complianceMap[act].statuses.push(row.status.trim());
        });
      });
      const consolidatedCompliance = Object.keys(complianceMap).map(act => ({
        activity: act,
        dueDate: '', status: Array.from(new Set(complianceMap[act].statuses)).join('; ')
      }));
      setMonthlyDocumentationCompliance(consolidatedCompliance);
      
      const kpiMap = {};
      DEFAULT_KPI.forEach(k => {
        kpiMap[k.kpi] = { values: [] };
      });
      validReports.forEach(report => {
        const list = report.kpiTracking || [];
        list.forEach(row => {
          const k = row.kpi || 'Unknown';
          if (!kpiMap[k]) {
            kpiMap[k] = { values: [] };
          }
          if (row.targetAchieved !== undefined && row.targetAchieved !== null && String(row.targetAchieved).trim() !== '') {
            kpiMap[k].values.push(String(row.targetAchieved).trim());
          }
        });
      });
      const consolidatedKpi = Object.keys(kpiMap).map(k => {
        const vals = kpiMap[k].values;
        if (vals.length === 0) {
          return { kpi: k, targetAchieved: '' };
        }
        
        const isPercent = k.toLowerCase().includes('accuracy') || vals.every(v => v.endsWith('%'));
        const numericVals = vals.map(v => parseFloat(v.replace(/[^0-9.-]/g, ''))).filter(n => !isNaN(n));
        
        if (numericVals.length === vals.length && numericVals.length > 0) {
          if (isPercent) {
            const avg = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
            return { kpi: k, targetAchieved: `${avg.toFixed(1)}%` };
          } else {
            const sum = numericVals.reduce((a, b) => a + b, 0);
            return { kpi: k, targetAchieved: String(sum) };
          }
        } else {
          return { kpi: k, targetAchieved: Array.from(new Set(vals)).join('; ') };
        }
      });
      setMonthlyKpiTracking(consolidatedKpi);
      
      const consolidatedIssues = [];
      validReports.forEach(report => {
        const list = report.issuesSupportRequired || [];
        list.forEach(row => {
          if (row.issue || row.priority || row.action) {
            consolidatedIssues.push({
              issue: row.issue || '',
              priority: row.priority || '',
              action: row.action || ''
            });
          }
        });
      });
      setMonthlyIssuesSupportRequired(consolidatedIssues);
      
      const planTasks = [];
      validReports.forEach(report => {
        const list = report.nextDayTaskPlan || [];
        list.forEach(task => {
          if (task && task.trim()) {
            planTasks.push(task.trim());
          }
        });
      });
      const consolidatedPlan = Array.from(new Set(planTasks));
      while (consolidatedPlan.length < 4) {
        consolidatedPlan.push('');
      }
      setMonthlyNextDayTaskPlan(consolidatedPlan);
      
      const handoverMap = {};
      DEFAULT_HANDOVER.forEach(item => {
        handoverMap[item.item] = { statuses: [] };
      });
      validReports.forEach(report => {
        const list = report.finalShiftHandover || [];
        list.forEach(row => {
          const it = row.item || 'Unknown';
          if (!handoverMap[it]) {
            handoverMap[it] = { statuses: [] };
          }
          if (row.status && row.status.trim()) handoverMap[it].statuses.push(row.status.trim());
        });
      });
      const consolidatedHandover = Object.keys(handoverMap).map(it => ({
        item: it,
        status: Array.from(new Set(handoverMap[it].statuses)).join('; ')
      }));
      setMonthlyFinalShiftHandover(consolidatedHandover);
      
      const commentsList = [];
      validReports.forEach((report, index) => {
        if (report.accountantComments && report.accountantComments.trim()) {
          commentsList.push(`[${report.basicDetails?.date || index}] ${report.accountantComments.trim()}`);
        }
      });
      setMonthlyAccountantComments(commentsList.join('\n'));
      
      showToast("Consolidation complete! You can now review and edit the data across tabs.", "success");
      
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch and consolidate data.", "error");
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const handleFetchWeeklyData = async () => {
    if (!selectedUserId) {
      showToast("Please select a user first.", "error");
      return;
    }
    try {
      setIsWeeklyLoading(true);
      
      const start = new Date(weeklyStartDate);
      const end = new Date(weeklyEndDate);
      
      if (end < start) {
        showToast("End date must be after or equal to start date.", "error");
        setIsWeeklyLoading(false);
        return;
      }
      
      const dates = [];
      let current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      
      if (dates.length > 90) {
        showToast("Date range cannot exceed 90 days.", "warning");
      }
      
      const fetchedReports = await Promise.all(
        dates.map(async (dateStr) => {
          try {
            const res = await fetch(`${API_BASE}/v1/accountant-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
              headers: getAuthHeaders()
            });
            const data = await res.json();
            return data.success && data.data ? data.data : null;
          } catch (e) {
            return null;
          }
        })
      );
      
      const validReports = fetchedReports.filter(Boolean);
      
      if (validReports.length === 0) {
        showToast("No submitted reports found in the selected range.", "warning");
        setWeeklyDailyAccountingSummary(DEFAULT_ACCOUNTING_SUMMARY.map(item => ({ ...item, status: '', remarks: '' })));
        setWeeklyTransactionReport(DEFAULT_TRANSACTIONS.map(item => ({ ...item, count: '0', amount: '-' })));
        setWeeklyInvoiceBillingReport([]);
        setWeeklyPayrollPaymentStatus(DEFAULT_PAYROLL_STATUS.map(item => ({ ...item, status: '', remarks: '' })));
        setWeeklyExpenseTracking(DEFAULT_EXPENSES.map(item => ({ ...item, amount: '', remarks: '' })));
        setWeeklyDocumentationCompliance(DEFAULT_COMPLIANCE.map(item => ({ ...item, status: '' })));
        setWeeklyKpiTracking(DEFAULT_KPI.map(item => ({ ...item, targetAchieved: '' })));
        setWeeklyIssuesSupportRequired([]);
        setWeeklyNextDayTaskPlan(['', '', '', '']);
        setWeeklyFinalShiftHandover(DEFAULT_HANDOVER.map(item => ({ ...item, status: '' })));
        setWeeklyAccountantComments('No reports found in range.');
        
        let userDetail = currentUser;
        if (isPrivileged && accountantStaff.length > 0) {
          userDetail = accountantStaff.find(u => u._id === selectedUserId) || currentUser;
        }
        
        setWeeklyBasicDetails({
          date: `${start.toLocaleDateString('en-GB').replace(/\//g, '-')} to ${end.toLocaleDateString('en-GB').replace(/\//g, '-')}`,
          day: 'MONTHLY REPORT',
          employeeName: userDetail.name || '',
          employeeId: userDetail.employeeId || '',
          department: 'Accounts & Finance',
          designation: userDetail.designationName || userDetail.designation || 'Accountant / Accounts Executive',
          shiftTiming: '9:00 TO 05:00',
          reportingTo: 'Accounts Manager / COO',
          preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
        
        setIsWeeklyLoading(false);
        return;
      }
      
      showToast(`Consolidating ${validReports.length} reports...`, "success");
      
      let userDetail = currentUser;
      if (isPrivileged && accountantStaff.length > 0) {
        userDetail = accountantStaff.find(u => u._id === selectedUserId) || currentUser;
      }
      
      setWeeklyBasicDetails({
        date: `${start.toLocaleDateString('en-GB').replace(/\//g, '-')} to ${end.toLocaleDateString('en-GB').replace(/\//g, '-')}`,
        day: 'MONTHLY REPORT',
        employeeName: validReports[0].basicDetails?.employeeName || userDetail.name || '',
        employeeId: validReports[0].basicDetails?.employeeId || userDetail.employeeId || '',
        department: validReports[0].basicDetails?.department || 'Accounts & Finance',
        designation: validReports[0].basicDetails?.designation || userDetail.designation || 'Accountant / Accounts Executive',
        shiftTiming: validReports[0].basicDetails?.shiftTiming || '9:00 TO 05:00',
        reportingTo: validReports[0].basicDetails?.reportingTo || 'Accounts Manager / COO',
        preparedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });
      
      const summaryMap = {};
      DEFAULT_ACCOUNTING_SUMMARY.forEach(item => {
        summaryMap[item.activity] = { statuses: [], remarks: [] };
      });
      validReports.forEach(report => {
        const list = report.dailyAccountingSummary || [];
        list.forEach(row => {
          const act = row.activity || 'Unknown';
          if (!summaryMap[act]) {
            summaryMap[act] = { statuses: [], remarks: [] };
          }
          if (row.status && row.status.trim()) summaryMap[act].statuses.push(row.status.trim());
          if (row.remarks && row.remarks.trim()) summaryMap[act].remarks.push(row.remarks.trim());
        });
      });
      const consolidatedSummary = Object.keys(summaryMap).map(act => ({
        activity: act,
        status: Array.from(new Set(summaryMap[act].statuses)).join('; '),
        dueDate: '', remarks: Array.from(new Set(summaryMap[act].remarks)).join('; ')
      }));
      setWeeklyDailyAccountingSummary(consolidatedSummary);
      
      const transMap = {};
      DEFAULT_TRANSACTIONS.forEach(t => {
        transMap[t.transactionType] = { count: 0, amount: 0, hasValues: false };
      });
      validReports.forEach(report => {
        const list = report.transactionReport || [];
        list.forEach(row => {
          const type = row.transactionType || 'Unknown';
          if (!transMap[type]) {
            transMap[type] = { count: 0, amount: 0, hasValues: false };
          }
          
          if (row.count !== undefined && row.count !== null && String(row.count).trim() !== '') {
            const parsedCount = parseInt(String(row.count).replace(/,/g, ''), 10);
            if (!isNaN(parsedCount)) {
              transMap[type].count += parsedCount;
              transMap[type].hasValues = true;
            }
          }
          
          if (row.amount !== undefined && row.amount !== null && String(row.amount).trim() !== '' && String(row.amount).trim() !== '-') {
            const parsedAmount = parseFloat(String(row.amount).replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsedAmount)) {
              transMap[type].amount += parsedAmount;
              transMap[type].hasValues = true;
            }
          }
        });
      });
      const consolidatedTrans = Object.keys(transMap).map(type => ({
        transactionType: type,
        count: String(transMap[type].count),
        amount: transMap[type].hasValues && transMap[type].amount !== 0
          ? transMap[type].amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '-'
      }));
      setWeeklyTransactionReport(consolidatedTrans);
      
      const consolidatedInvoices = [];
      validReports.forEach(report => {
        const list = report.invoiceBillingReport || [];
        list.forEach(row => {
          if (row.clientVendor || row.type || row.amount || row.status || row.remarks) {
            consolidatedInvoices.push({
              clientVendor: row.clientVendor || '',
              type: row.type || '',
              amount: row.amount || '',
              status: row.status || '',
              remarks: row.remarks || ''
            });
          }
        });
      });
      setWeeklyInvoiceBillingReport(consolidatedInvoices);
      
      const payrollMap = {};
      DEFAULT_PAYROLL_STATUS.forEach(item => {
        payrollMap[item.activity] = { amounts: [], statuses: [], remarks: [] };
      });
      validReports.forEach(report => {
        const list = report.payrollPaymentStatus || [];
        list.forEach(row => {
          const act = row.activity || 'Unknown';
          if (!payrollMap[act]) {
            payrollMap[act] = { amounts: [], statuses: [], remarks: [] };
          }
          if (row.amount && String(row.amount).trim()) payrollMap[act].amounts.push(String(row.amount).trim());
          if (row.status && row.status.trim()) payrollMap[act].statuses.push(row.status.trim());
          if (row.remarks && row.remarks.trim()) payrollMap[act].remarks.push(row.remarks.trim());
        });
      });
      const consolidatedPayroll = Object.keys(payrollMap).map(act => ({
        activity: act,
        amount: Array.from(new Set(payrollMap[act].amounts)).join('; '),
        status: Array.from(new Set(payrollMap[act].statuses)).join('; '),
        dueDate: '', remarks: Array.from(new Set(payrollMap[act].remarks)).join('; ')
      }));
      setWeeklyPayrollPaymentStatus(consolidatedPayroll);
      
      const expMap = {};
      DEFAULT_EXPENSES.forEach(e => {
        expMap[e.category] = { amount: 0, remarksList: [], hasAmount: false };
      });
      validReports.forEach(report => {
        const list = report.expenseTracking || [];
        list.forEach(row => {
          const cat = row.category || 'Unknown';
          if (!expMap[cat]) {
            expMap[cat] = { amount: 0, remarksList: [], hasAmount: false };
          }
          
          if (row.amount !== undefined && row.amount !== null && String(row.amount).trim() !== '') {
            const parsedAmount = parseFloat(String(row.amount).replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsedAmount)) {
              expMap[cat].amount += parsedAmount;
              expMap[cat].hasAmount = true;
            }
          }
          if (row.remarks && row.remarks.trim()) {
            expMap[cat].remarksList.push(row.remarks.trim());
          }
        });
      });
      const consolidatedExpenses = Object.keys(expMap).map(cat => ({
        category: cat,
        amount: expMap[cat].hasAmount && expMap[cat].amount !== 0
          ? expMap[cat].amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '',
        remarks: Array.from(new Set(expMap[cat].remarksList)).join('; ')
      }));
      setWeeklyExpenseTracking(consolidatedExpenses);
      
      const complianceMap = {};
      DEFAULT_COMPLIANCE.forEach(item => {
        complianceMap[item.activity] = { statuses: [] };
      });
      validReports.forEach(report => {
        const list = report.documentationCompliance || [];
        list.forEach(row => {
          const act = row.activity || 'Unknown';
          if (!complianceMap[act]) {
            complianceMap[act] = { statuses: [] };
          }
          if (row.status && row.status.trim()) complianceMap[act].statuses.push(row.status.trim());
        });
      });
      const consolidatedCompliance = Object.keys(complianceMap).map(act => ({
        activity: act,
        dueDate: '', status: Array.from(new Set(complianceMap[act].statuses)).join('; ')
      }));
      setWeeklyDocumentationCompliance(consolidatedCompliance);
      
      const kpiMap = {};
      DEFAULT_KPI.forEach(k => {
        kpiMap[k.kpi] = { values: [] };
      });
      validReports.forEach(report => {
        const list = report.kpiTracking || [];
        list.forEach(row => {
          const k = row.kpi || 'Unknown';
          if (!kpiMap[k]) {
            kpiMap[k] = { values: [] };
          }
          if (row.targetAchieved !== undefined && row.targetAchieved !== null && String(row.targetAchieved).trim() !== '') {
            kpiMap[k].values.push(String(row.targetAchieved).trim());
          }
        });
      });
      const consolidatedKpi = Object.keys(kpiMap).map(k => {
        const vals = kpiMap[k].values;
        if (vals.length === 0) {
          return { kpi: k, targetAchieved: '' };
        }
        
        const isPercent = k.toLowerCase().includes('accuracy') || vals.every(v => v.endsWith('%'));
        const numericVals = vals.map(v => parseFloat(v.replace(/[^0-9.-]/g, ''))).filter(n => !isNaN(n));
        
        if (numericVals.length === vals.length && numericVals.length > 0) {
          if (isPercent) {
            const avg = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
            return { kpi: k, targetAchieved: `${avg.toFixed(1)}%` };
          } else {
            const sum = numericVals.reduce((a, b) => a + b, 0);
            return { kpi: k, targetAchieved: String(sum) };
          }
        } else {
          return { kpi: k, targetAchieved: Array.from(new Set(vals)).join('; ') };
        }
      });
      setWeeklyKpiTracking(consolidatedKpi);
      
      const consolidatedIssues = [];
      validReports.forEach(report => {
        const list = report.issuesSupportRequired || [];
        list.forEach(row => {
          if (row.issue || row.priority || row.action) {
            consolidatedIssues.push({
              issue: row.issue || '',
              priority: row.priority || '',
              action: row.action || ''
            });
          }
        });
      });
      setWeeklyIssuesSupportRequired(consolidatedIssues);
      
      const planTasks = [];
      validReports.forEach(report => {
        const list = report.nextDayTaskPlan || [];
        list.forEach(task => {
          if (task && task.trim()) {
            planTasks.push(task.trim());
          }
        });
      });
      const consolidatedPlan = Array.from(new Set(planTasks));
      while (consolidatedPlan.length < 4) {
        consolidatedPlan.push('');
      }
      setWeeklyNextDayTaskPlan(consolidatedPlan);
      
      const handoverMap = {};
      DEFAULT_HANDOVER.forEach(item => {
        handoverMap[item.item] = { statuses: [] };
      });
      validReports.forEach(report => {
        const list = report.finalShiftHandover || [];
        list.forEach(row => {
          const it = row.item || 'Unknown';
          if (!handoverMap[it]) {
            handoverMap[it] = { statuses: [] };
          }
          if (row.status && row.status.trim()) handoverMap[it].statuses.push(row.status.trim());
        });
      });
      const consolidatedHandover = Object.keys(handoverMap).map(it => ({
        item: it,
        status: Array.from(new Set(handoverMap[it].statuses)).join('; ')
      }));
      setWeeklyFinalShiftHandover(consolidatedHandover);
      
      const commentsList = [];
      validReports.forEach((report, index) => {
        if (report.accountantComments && report.accountantComments.trim()) {
          commentsList.push(`[${report.basicDetails?.date || index}] ${report.accountantComments.trim()}`);
        }
      });
      setWeeklyAccountantComments(commentsList.join('\n'));
      
      showToast("Consolidation complete! You can now review and edit the data across tabs.", "success");
      
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch and consolidate data.", "error");
    } finally {
      setIsWeeklyLoading(false);
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
        doc.setFillColor(60, 35, 117);
        doc.rect(14, currentY, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 5);
        currentY += 7;
      };

      const drawHeader = () => {
        // Logo
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          doc.addImage(logoImg, 'PNG', 14, 10, 32, 12);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(22);
          doc.setTextColor(132, 204, 22); // Lime Green
          doc.text("KOD.", 14, 21);
          
          doc.setTextColor(60, 35, 117);
          doc.text("brand", 34, 21);
        }

        // Title
        doc.setFontSize(14);
        doc.setTextColor(60, 35, 117);
        doc.text("MONTHLY CONSOLIDATED REPORT", 110, 16);
        
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text("ACCOUNTANT / ACCOUNTS EXECUTIVE", 128, 22);
      };

      // ================= PAGE 1 =================
      drawHeader();
      currentY = 27;

      // 1. BASIC DETAILS
      drawSectionHeader("1. BASIC DETAILS");
      const basicDetailsRows = [
        ["Date Range", monthlyBasicDetails.date || ''],
        ["Report Type", monthlyBasicDetails.day || ''],
        ["Employee Name", monthlyBasicDetails.employeeName || ''],
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

      // 2. MONTHLY ACCOUNTING SUMMARY
      drawSectionHeader("2. MONTHLY ACCOUNTING SUMMARY");
      const summaryHeaders = [["Activity", "Status", "Remarks"]];
      const summaryRows = monthlyDailyAccountingSummary.map(o => [
        o.activity || '', 
        o.status || '', 
        o.remarks || ''
      ]);

      autoTable(doc, {
        head: summaryHeaders,
        body: summaryRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 90 },
          1: { width: 40, halign: 'center' },
          2: { width: 52 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 3. TRANSACTION REPORT
      drawSectionHeader("3. CONSOLIDATED TRANSACTION REPORT");
      const transactionHeaders = [["Transaction Type", "Total Amount", "Incomes", "Expense"]];
      const transactionRows = monthlyTransactionReport.map(t => [t.transactionType || '', t.amount || '', t.incomes || '', t.expense || '']);

      autoTable(doc, {
        head: transactionHeaders,
        body: transactionRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 60 },
          1: { width: 40, halign: 'right' },
          2: { width: 41, halign: 'right' },
          3: { width: 41, halign: 'right' }
        },
      });

      // ================= PAGE 2 =================
      doc.addPage();
      currentY = 15;
      drawHeader();
      currentY = 27;

      // 4. INVOICE & BILLING REPORT
      drawSectionHeader("4. CONSOLIDATED INVOICE & BILLING REPORT");
      const invoiceHeaders = [["Client/Vendor", "Type", "Amount", "Status", "Remarks"]];
      const invoiceRows = monthlyInvoiceBillingReport.length > 0 
        ? monthlyInvoiceBillingReport.map(i => [i.clientVendor || '', i.type || '', i.amount || '', i.status || '', i.remarks || ''])
        : [["No invoices logged", "", "", "", ""]];

      autoTable(doc, {
        head: invoiceHeaders,
        body: invoiceRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 50 },
          1: { width: 25 },
          2: { width: 30, halign: 'right' },
          3: { width: 30, halign: 'center' },
          4: { width: 47 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 5. PAYROLL & PAYMENT STATUS
      drawSectionHeader("5. CONSOLIDATED PAYROLL & PAYMENT STATUS");
      const payrollHeaders = [["Activity", "Amount", "Status Summary", "Remarks"]];
      const payrollRows = monthlyPayrollPaymentStatus.map(p => [p.activity || '', p.amount || '', p.status || '', p.remarks || '']);

      autoTable(doc, {
        head: payrollHeaders,
        body: payrollRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 55 },
          1: { width: 35, halign: 'right' },
          2: { width: 45, halign: 'center' },
          3: { width: 47 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 6. EXPENSE TRACKING
      drawSectionHeader("6. CONSOLIDATED EXPENSE TRACKING");
      const expenseHeaders = [["Expense Category", "Total Amount", "Remarks"]];
      const expenseRows = monthlyExpenseTracking.map(e => [e.category || '', e.amount || '', e.remarks || '']);

      autoTable(doc, {
        head: expenseHeaders,
        body: expenseRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 60 },
          1: { width: 40, halign: 'right' },
          2: { width: 82 }
        },
        margin: { left: 14, right: 14 }
      });

      // ================= PAGE 3 =================
      doc.addPage();
      currentY = 15;
      drawHeader();
      currentY = 27;

      // 7. DOCUMENTATION & COMPLIANCE
      drawSectionHeader("7. CONSOLIDATED DOCUMENTATION & COMPLIANCE");
      const complianceHeaders = [["Activity", "Status Summary"]];
      const complianceRows = monthlyDocumentationCompliance.map(c => [c.activity || '', c.status || '']);

      autoTable(doc, {
        head: complianceHeaders,
        body: complianceRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 120 },
          1: { width: 62, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 8. KPI TRACKING
      drawSectionHeader("8. CONSOLIDATED KPI TRACKING");
      const kpiHeaders = [["KPI", "Target Achieved Summary"]];
      const kpiRows = monthlyKpiTracking.map(k => [k.kpi || '', k.targetAchieved || '']);

      autoTable(doc, {
        head: kpiHeaders,
        body: kpiRows,
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

      // 9. ISSUES / SUPPORT REQUIRED
      drawSectionHeader("9. CONSOLIDATED ISSUES / SUPPORT REQUIRED");
      const issuesHeaders = [["Issue", "Priority", "Action"]];
      const issuesRows = monthlyIssuesSupportRequired.length > 0
        ? monthlyIssuesSupportRequired.map(i => [i.issue || '', i.priority || '', i.action || ''])
        : [["No active issues logged", "", ""]];

      autoTable(doc, {
        head: issuesHeaders,
        body: issuesRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 80 },
          1: { width: 35, halign: 'center' },
          2: { width: 67 }
        },
        margin: { left: 14, right: 14 }
      });

      // ================= PAGE 4 =================
      doc.addPage();
      currentY = 15;
      drawHeader();
      currentY = 27;

      // 10. NEXT DAY TASK PLAN
      drawSectionHeader("10. MONTHLY TASKS / PLANS");
      const planRows = monthlyNextDayTaskPlan.map((p, idx) => [`${idx + 1}.`, p || '']);

      autoTable(doc, {
        body: planRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 15, halign: 'center' },
          1: { width: 167 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 11. FINAL SHIFT HANDOVER
      drawSectionHeader("11. CONSOLIDATED HANDOVER ITEMS");
      const handoverHeaders = [["Handover Item", "Status Summary"]];
      const handoverRows = monthlyFinalShiftHandover.map(h => [h.item || '', h.status || '']);

      autoTable(doc, {
        head: handoverHeaders,
        body: handoverRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 120 },
          1: { width: 62, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 12. COMMENTS
      drawSectionHeader("12. CONSOLIDATED ACCOUNTANT COMMENTS");
      const commentRows = [[monthlyAccountantComments || 'No comments.']];
      autoTable(doc, {
        body: commentRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 10;

      // 13. APPROVAL
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 35, 117);
      doc.text(approval.accountantName || '', 30, currentY);
      doc.text(approval.managerName || '', 130, currentY);

      doc.setDrawColor(60, 35, 117);
      doc.line(20, currentY + 1.5, 75, currentY + 1.5);
      doc.line(120, currentY + 1.5, 175, currentY + 1.5);

      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Accountant Signature & Date", 28, currentY + 5.5);
      doc.text("Manager Signature & Date", 132, currentY + 5.5);

      const pdfBlob = doc.output('blob');
      const filename = `Accountant_Monthly_Consolidated_Report_${monthlyBasicDetails.employeeName || 'Accountant'}_${monthlyStartDate}_to_${monthlyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${monthlyStartDate}_to_${monthlyEndDate}`, pdfBlob, filename, 'accountant', 'monthly');
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
        // Logo
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          doc.addImage(logoImg, 'PNG', 14, 10, 32, 12);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(22);
          doc.setTextColor(132, 204, 22); // Lime Green
          doc.text("KOD.", 14, 21);
          
          doc.setTextColor(60, 35, 117);
          doc.text("brand", 34, 21);
        }

        // Title
        doc.setFontSize(14);
        doc.setTextColor(60, 35, 117);
        doc.text("MONTHLY CONSOLIDATED REPORT", 110, 16);
        
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text("ACCOUNTANT / ACCOUNTS EXECUTIVE", 128, 22);
      };

      // ================= PAGE 1 =================
      drawHeader();
      currentY = 27;

      // 1. BASIC DETAILS
      drawSectionHeader("1. BASIC DETAILS");
      const basicDetailsRows = [
        ["Date Range", weeklyBasicDetails.date || ''],
        ["Report Type", weeklyBasicDetails.day || ''],
        ["Employee Name", weeklyBasicDetails.employeeName || ''],
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

      // 2. WEEKLY ACCOUNTING SUMMARY
      drawSectionHeader("2. WEEKLY ACCOUNTING SUMMARY");
      const summaryHeaders = [["Activity", "Status", "Remarks"]];
      const summaryRows = weeklyDailyAccountingSummary.map(o => [
        o.activity || '', 
        o.status || '', 
        o.remarks || ''
      ]);

      autoTable(doc, {
        head: summaryHeaders,
        body: summaryRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 90 },
          1: { width: 40, halign: 'center' },
          2: { width: 52 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 3. TRANSACTION REPORT
      drawSectionHeader("3. CONSOLIDATED TRANSACTION REPORT");
      const transactionHeaders = [["Transaction Type", "Total Amount", "Incomes", "Expense"]];
      const transactionRows = weeklyTransactionReport.map(t => [t.transactionType || '', t.amount || '', t.incomes || '', t.expense || '']);

      autoTable(doc, {
        head: transactionHeaders,
        body: transactionRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 60 },
          1: { width: 40, halign: 'right' },
          2: { width: 41, halign: 'right' },
          3: { width: 41, halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });

      // ================= PAGE 2 =================
      doc.addPage();
      currentY = 15;
      drawHeader();
      currentY = 27;

      // 4. INVOICE & BILLING REPORT
      drawSectionHeader("4. CONSOLIDATED INVOICE & BILLING REPORT");
      const invoiceHeaders = [["Client/Vendor", "Type", "Amount", "Status", "Remarks"]];
      const invoiceRows = weeklyInvoiceBillingReport.length > 0 
        ? weeklyInvoiceBillingReport.map(i => [i.clientVendor || '', i.type || '', i.amount || '', i.status || '', i.remarks || ''])
        : [["No invoices logged", "", "", "", ""]];

      autoTable(doc, {
        head: invoiceHeaders,
        body: invoiceRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 50 },
          1: { width: 25 },
          2: { width: 30, halign: 'right' },
          3: { width: 30, halign: 'center' },
          4: { width: 47 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 5. PAYROLL & PAYMENT STATUS
      drawSectionHeader("5. CONSOLIDATED PAYROLL & PAYMENT STATUS");
      const payrollHeaders = [["Activity", "Amount", "Status Summary", "Remarks"]];
      const payrollRows = weeklyPayrollPaymentStatus.map(p => [p.activity || '', p.amount || '', p.status || '', p.remarks || '']);

      autoTable(doc, {
        head: payrollHeaders,
        body: payrollRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 55 },
          1: { width: 35, halign: 'right' },
          2: { width: 45, halign: 'center' },
          3: { width: 47 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 6. EXPENSE TRACKING
      drawSectionHeader("6. CONSOLIDATED EXPENSE TRACKING");
      const expenseHeaders = [["Expense Category", "Total Amount", "Remarks"]];
      const expenseRows = weeklyExpenseTracking.map(e => [e.category || '', e.amount || '', e.remarks || '']);

      autoTable(doc, {
        head: expenseHeaders,
        body: expenseRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 60 },
          1: { width: 40, halign: 'right' },
          2: { width: 82 }
        },
        margin: { left: 14, right: 14 }
      });

      // ================= PAGE 3 =================
      doc.addPage();
      currentY = 15;
      drawHeader();
      currentY = 27;

      // 7. DOCUMENTATION & COMPLIANCE
      drawSectionHeader("7. CONSOLIDATED DOCUMENTATION & COMPLIANCE");
      const complianceHeaders = [["Activity", "Status Summary"]];
      const complianceRows = weeklyDocumentationCompliance.map(c => [c.activity || '', c.status || '']);

      autoTable(doc, {
        head: complianceHeaders,
        body: complianceRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 120 },
          1: { width: 62, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 8. KPI TRACKING
      drawSectionHeader("8. CONSOLIDATED KPI TRACKING");
      const kpiHeaders = [["KPI", "Target Achieved Summary"]];
      const kpiRows = weeklyKpiTracking.map(k => [k.kpi || '', k.targetAchieved || '']);

      autoTable(doc, {
        head: kpiHeaders,
        body: kpiRows,
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

      // 9. ISSUES / SUPPORT REQUIRED
      drawSectionHeader("9. CONSOLIDATED ISSUES / SUPPORT REQUIRED");
      const issuesHeaders = [["Issue", "Priority", "Action"]];
      const issuesRows = weeklyIssuesSupportRequired.length > 0
        ? weeklyIssuesSupportRequired.map(i => [i.issue || '', i.priority || '', i.action || ''])
        : [["No active issues logged", "", ""]];

      autoTable(doc, {
        head: issuesHeaders,
        body: issuesRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 80 },
          1: { width: 35, halign: 'center' },
          2: { width: 67 }
        },
        margin: { left: 14, right: 14 }
      });

      // ================= PAGE 4 =================
      doc.addPage();
      currentY = 15;
      drawHeader();
      currentY = 27;

      // 10. NEXT DAY TASK PLAN
      drawSectionHeader("10. MONTHLY TASKS / PLANS");
      const planRows = weeklyNextDayTaskPlan.map((p, idx) => [`${idx + 1}.`, p || '']);

      autoTable(doc, {
        body: planRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 15, halign: 'center' },
          1: { width: 167 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 11. FINAL SHIFT HANDOVER
      drawSectionHeader("11. CONSOLIDATED HANDOVER ITEMS");
      const handoverHeaders = [["Handover Item", "Status Summary"]];
      const handoverRows = weeklyFinalShiftHandover.map(h => [h.item || '', h.status || '']);

      autoTable(doc, {
        head: handoverHeaders,
        body: handoverRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 120 },
          1: { width: 62, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 12. COMMENTS
      drawSectionHeader("12. CONSOLIDATED ACCOUNTANT COMMENTS");
      const commentRows = [[weeklyAccountantComments || 'No comments.']];
      autoTable(doc, {
        body: commentRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 13. SUMMARY & PLANNING
      drawSectionHeader("13. WEEKLY SUMMARY & PLANNING");
      const weeklySummaryPlanningRows = [
        ["Achievements:", weeklyAchievements || ''],
        ["Improvements Needed:", weeklyImprovements || ''],
        ["Next Week Planning:", weeklyNextWeekPlanning || '']
      ];
      autoTable(doc, {
        body: weeklySummaryPlanningRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 45 },
          1: { width: 137 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 10;

      // 13. APPROVAL
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 35, 117);
      doc.text(approval.accountantName || '', 30, currentY);
      doc.text(approval.managerName || '', 130, currentY);

      doc.setDrawColor(60, 35, 117);
      doc.line(20, currentY + 1.5, 75, currentY + 1.5);
      doc.line(120, currentY + 1.5, 175, currentY + 1.5);

      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Accountant Signature & Date", 28, currentY + 5.5);
      doc.text("Manager Signature & Date", 132, currentY + 5.5);

      const pdfBlob = doc.output('blob');
      const filename = `Accountant_Weekly_Consolidated_Report_${weeklyBasicDetails.employeeName || 'Accountant'}_${weeklyStartDate}_to_${weeklyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${weeklyStartDate}_to_${weeklyEndDate}`, pdfBlob, filename, 'accountant', 'weekly');
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

  const handleDownloadPDF = async () => {
    const reportType = 'accountant';
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

  const handleInvoiceChange = (index, field, value) => {
    const updated = [...invoiceBillingReport];
    updated[index][field] = value;
    setInvoiceBillingReport(updated);
  };

  const addInvoiceRow = () => {
    setInvoiceBillingReport([
      ...invoiceBillingReport,
      { clientVendor: '', type: '', amount: '', status: '', remarks: '' }
    ]);
  };

  const removeInvoiceRow = (index) => {
    const updated = invoiceBillingReport.filter((_, idx) => idx !== index);
    setInvoiceBillingReport(updated);
  };

  const handleIssueChange = (index, field, value) => {
    const updated = [...issuesSupportRequired];
    updated[index][field] = value;
    setIssuesSupportRequired(updated);
  };

  const addIssueRow = () => {
    setIssuesSupportRequired([
      ...issuesSupportRequired,
      { issue: '', priority: '', action: '' }
    ]);
  };

  const removeIssueRow = (index) => {
    const updated = issuesSupportRequired.filter((_, idx) => idx !== index);
    setIssuesSupportRequired(updated);
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
                  Accountant Daily Shift Report
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fill, review, and download daily accounting shift reports.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Weekly Report
                </button>
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Monthly Report
                </button>

                

                <AiAnalyzeButton
                  onClick={() => {
                    setAiModalContext({
                      employeeName: basicDetails.employeeName,
                      department: 'Accounts & Finance',
                      designation: basicDetails.designation,
                      date: selectedDate,
                      actualReportContentText: JSON.stringify({ basicDetails, dailyAccountingSummary, dailyTasks, transactionReport, payrollPaymentStatus, expenseTracking, documentationCompliance, accountantComments })
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
              title="Accountant Report AI Analysis"
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

            {/* 2. DAILY ACCOUNTING SUMMARY */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">2</span>
                  Daily Accounting Summary
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('dailyAccountingSummary')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyAccountingSummary([...dailyAccountingSummary, { activity: '', status: '', remarks: '' }])}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.dailyAccountingSummary ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Daily Accounting Summary (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('dailyAccountingSummary')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[40%] min-w-[280px]">Activity</th>
                        <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">Status</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Remarks</th>
                        <th className="px-3 py-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {dailyAccountingSummary.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={item.activity || ''}
                              onChange={(e) => {
                                const updated = [...dailyAccountingSummary];
                                updated[idx].activity = e.target.value;
                                setDailyAccountingSummary(updated);
                              }}
                              className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-semibold text-slate-700 dark:text-slate-300"
                              placeholder="Activity name"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.status || ''}
                              onChange={(e) => {
                                const updated = [...dailyAccountingSummary];
                                updated[idx].status = e.target.value;
                                setDailyAccountingSummary(updated);
                              }}
                              className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                              placeholder="e.g. completed"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.remarks || ''}
                              onChange={(e) => {
                                const updated = [...dailyAccountingSummary];
                                updated[idx].remarks = e.target.value;
                                setDailyAccountingSummary(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                              placeholder="Add remarks..."
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...dailyAccountingSummary];
                                updated.splice(idx, 1);
                                setDailyAccountingSummary(updated);
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
              )}
            </div>

            {/* 3. DAILY TASKS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">3</span>
                  Daily Tasks
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('dailyTasks')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyTasks([...dailyTasks, { activity: '', dueDate: '', startDate: '', endDate: '', status: '', remarks: '' }])}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-lime-400 hover:opacity-80 font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Task
                  </button>
                </div>
              </div>
              {hiddenSections.dailyTasks ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Daily Tasks (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('dailyTasks')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[30%] min-w-[240px]">Activity</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">Due Date</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">Start Date</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">End Date</th>
                        <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-32">Status</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Remarks</th>
                        <th className="px-3 py-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {dailyTasks.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={item.activity || ''}
                              onChange={(e) => {
                                const updated = [...dailyTasks];
                                updated[idx].activity = e.target.value;
                                setDailyTasks(updated);
                              }}
                              className="w-full bg-transparent border-none focus:outline-none p-0 text-sm font-semibold text-slate-700 dark:text-slate-300"
                              placeholder="Task title"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="date"
                              value={item.dueDate || ''}
                              onChange={(e) => {
                                const updated = [...dailyTasks];
                                updated[idx].dueDate = e.target.value;
                                setDailyTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.startDate || ''}
                              onChange={(e) => {
                                const updated = [...dailyTasks];
                                updated[idx].startDate = e.target.value;
                                setDailyTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                              placeholder="DD-MM-YYYY HH:mm"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.endDate || ''}
                              onChange={(e) => {
                                const updated = [...dailyTasks];
                                updated[idx].endDate = e.target.value;
                                setDailyTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                              placeholder="DD-MM-YYYY HH:mm"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.status || ''}
                              onChange={(e) => {
                                const updated = [...dailyTasks];
                                updated[idx].status = e.target.value;
                                setDailyTasks(updated);
                              }}
                              className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                              placeholder="Done / Pending"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.remarks || ''}
                              onChange={(e) => {
                                const updated = [...dailyTasks];
                                updated[idx].remarks = e.target.value;
                                setDailyTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                              placeholder="Task remarks..."
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...dailyTasks];
                                updated.splice(idx, 1);
                                setDailyTasks(updated);
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
              )}
            </div>

            {/* 4. TRANSACTION REPORT */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">4</span>
                  Transaction Report
                </h2>
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('transactionReport')}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title="Exclude this table section from report & PDF (-)"
                >
                  <MinusCircle size={14} /> Exclude Table
                </button>
              </div>

              {hiddenSections.transactionReport ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Transaction Report (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('transactionReport')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/3">Transaction Type</th>
                        <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Count</th>
                        <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Incomes</th>
                        <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Expense</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {transactionReport.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.transactionType}</td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.amount || ''}
                              onChange={(e) => {
                                const updated = [...transactionReport];
                                updated[idx].amount = e.target.value;
                                setTransactionReport(updated);
                              }}
                              className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none font-mono"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.incomes || ''}
                              onChange={(e) => {
                                const updated = [...transactionReport];
                                updated[idx].incomes = e.target.value;
                                setTransactionReport(updated);
                              }}
                              className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none font-mono"
                              placeholder="Income amount"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.expense || ''}
                              onChange={(e) => {
                                const updated = [...transactionReport];
                                updated[idx].expense = e.target.value;
                                setTransactionReport(updated);
                              }}
                              className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none font-mono"
                              placeholder="Expense amount"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 5. INVOICE & BILLING REPORT */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5</span>
                  Invoice & Billing Report
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('invoiceBillingReport')}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Exclude this table section from report & PDF (-)"
                  >
                    <MinusCircle size={14} /> Exclude Table
                  </button>
                  <button
                    type="button"
                    onClick={addInvoiceRow}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 dark:hover:text-lime-500 uppercase tracking-wider cursor-pointer"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              {hiddenSections.invoiceBillingReport ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Invoice & Billing Report (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('invoiceBillingReport')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Client/Vendor</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-32">Type</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">Amount</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">Status</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Remarks</th>
                      <th className="px-3 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {invoiceBillingReport.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-slate-400 dark:text-slate-600 italic">
                          No invoices or bills logged. Click "Add Row" to create logs.
                        </td>
                      </tr>
                    ) : (
                      invoiceBillingReport.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.clientVendor || ''}
                              onChange={(e) => handleInvoiceChange(idx, 'clientVendor', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.type || ''}
                              onChange={(e) => handleInvoiceChange(idx, 'type', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.amount || ''}
                              onChange={(e) => handleInvoiceChange(idx, 'amount', e.target.value)}
                              className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none font-mono"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.status || ''}
                              onChange={(e) => handleInvoiceChange(idx, 'status', e.target.value)}
                              className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.remarks || ''}
                              onChange={(e) => handleInvoiceChange(idx, 'remarks', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeInvoiceRow(idx)}
                              className="text-rose-500 hover:text-rose-600 transition"
                            >
                              <Trash2 size={16} />
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

            {/* 6. PAYROLL & PAYMENT STATUS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">6</span>
                  Payroll & Payment Status
                </h2>
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('payrollPaymentStatus')}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title="Exclude this table section from report & PDF (-)"
                >
                  <MinusCircle size={14} /> Exclude Table
                </button>
              </div>

              {hiddenSections.payrollPaymentStatus ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Payroll & Payment Status (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('payrollPaymentStatus')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[35%] min-w-[240px]">Activity</th>
                        <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">Amount</th>
                        <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-32">Status</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {payrollPaymentStatus.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.amount || ''}
                              onChange={(e) => {
                                const updated = [...payrollPaymentStatus];
                                updated[idx].amount = e.target.value;
                                setPayrollPaymentStatus(updated);
                              }}
                              className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none font-mono"
                              placeholder="Amount"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.status || ''}
                              onChange={(e) => {
                                const updated = [...payrollPaymentStatus];
                                updated[idx].status = e.target.value;
                                setPayrollPaymentStatus(updated);
                              }}
                              className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                              placeholder="Status"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.remarks || ''}
                              onChange={(e) => {
                                const updated = [...payrollPaymentStatus];
                                updated[idx].remarks = e.target.value;
                                setPayrollPaymentStatus(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                              placeholder="Remarks"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 7. EXPENSE TRACKING */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">7</span>
                  Expense Tracking
                </h2>
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('expenseTracking')}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title="Exclude this table section from report & PDF (-)"
                >
                  <MinusCircle size={14} /> Exclude Table
                </button>
              </div>

              {hiddenSections.expenseTracking ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Expense Tracking (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('expenseTracking')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/3">Expense Category</th>
                        <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/4">Amount</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {expenseTracking.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.category}</td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.amount || ''}
                              onChange={(e) => {
                                const updated = [...expenseTracking];
                                updated[idx].amount = e.target.value;
                                setExpenseTracking(updated);
                              }}
                              className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none font-mono"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.remarks || ''}
                              onChange={(e) => {
                                const updated = [...expenseTracking];
                                updated[idx].remarks = e.target.value;
                                setExpenseTracking(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 8. DOCUMENTATION & COMPLIANCE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">8</span>
                  Documentation & Compliance
                </h2>
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('documentationCompliance')}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title="Exclude this table section from report & PDF (-)"
                >
                  <MinusCircle size={14} /> Exclude Table
                </button>
              </div>

              {hiddenSections.documentationCompliance ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Documentation & Compliance (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('documentationCompliance')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-2/3">Activity</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {documentationCompliance.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={item.status || ''}
                            onChange={(e) => {
                              const updated = [...documentationCompliance];
                              updated[idx].status = e.target.value;
                              setDocumentationCompliance(updated);
                            }}
                            className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                            placeholder="Done / Pending"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            {/* 9. KPI TRACKING */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">9</span>
                  KPI Tracking
                </h2>
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('kpiTracking')}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title="Exclude this table section from report & PDF (-)"
                >
                  <MinusCircle size={14} /> Exclude Table
                </button>
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
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-2/3">KPI</th>
                        <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Target Achieved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {kpiTracking.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.kpi}</td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.targetAchieved || ''}
                              onChange={(e) => {
                                const updated = [...kpiTracking];
                                updated[idx].targetAchieved = e.target.value;
                                setKpiTracking(updated);
                              }}
                              className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 10. ISSUES / SUPPORT REQUIRED */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">10</span>
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
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 dark:hover:text-lime-500 uppercase tracking-wider cursor-pointer"
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
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/3">Issue</th>
                        <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-40">Priority</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Action Taken / Required</th>
                        <th className="px-3 py-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {issuesSupportRequired.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-slate-400 dark:text-slate-600 italic">
                            No issues logged. Click "Add Row" to report issues.
                          </td>
                        </tr>
                      ) : (
                        issuesSupportRequired.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={row.issue || ''}
                                onChange={(e) => handleIssueChange(idx, 'issue', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={row.priority || ''}
                                onChange={(e) => handleIssueChange(idx, 'priority', e.target.value)}
                                className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                                placeholder="e.g. High / Med / Low"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={row.action || ''}
                                onChange={(e) => handleIssueChange(idx, 'action', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeIssueRow(idx)}
                                className="text-rose-500 hover:text-rose-600 transition"
                              >
                                <Trash2 size={16} />
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

            {/* 10. NEXT DAY TASK PLAN */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">10</span>
                Next Day Task Plan
              </h2>
              <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                {nextDayTaskPlan.map((plan, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="font-bold text-slate-400 dark:text-slate-600 w-5 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={plan || ''}
                      onChange={(e) => {
                        const updated = [...nextDayTaskPlan];
                        updated[idx] = e.target.value;
                        setNextDayTaskPlan(updated);
                      }}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder={`Task ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 11. FINAL SHIFT HANDOVER */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">11</span>
                  Final Shift Handover
                </h2>
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('finalShiftHandover')}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title="Exclude this table section from report & PDF (-)"
                >
                  <MinusCircle size={14} /> Exclude Table
                </button>
              </div>

              {hiddenSections.finalShiftHandover ? (
                <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <MinusCircle size={14} className="text-rose-400" />
                    Final Shift Handover (Excluded from Report & PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSectionHidden('finalShiftHandover')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Restore Section
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-2/3">Handover Item</th>
                        <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {finalShiftHandover.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.item}</td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={item.status || ''}
                              onChange={(e) => {
                                const updated = [...finalShiftHandover];
                                updated[idx].status = e.target.value;
                                setFinalShiftHandover(updated);
                              }}
                              className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 12. ACCOUNTANT COMMENTS */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">12</span>
                Accountant Comments
              </h2>
              <textarea
                value={accountantComments}
                onChange={(e) => setAccountantComments(e.target.value)}
                className="w-full h-28 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Enter comments, handover notes or highlights..."
              />
            </div>

            {/* 13. APPROVAL SIGN-OFFS */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">13</span>
                Approval Sign-Offs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-200/50 dark:border-slate-800/50">
                    Accountant Verification
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name</label>
                    <input
                      type="text"
                      value={approval.accountantName || ''}
                      onChange={(e) => setApproval({ ...approval, accountantName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Signature</label>
                    <SignatureUpload
                      value={approval.accountantSignature || ''}
                      onChange={(val) => setApproval({ ...approval, accountantSignature: val })}
                      placeholder="Upload accountant signature"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                    <input
                      type="text"
                      value={approval.accountantDate || ''}
                      onChange={(e) => setApproval({ ...approval, accountantDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-200/50 dark:border-slate-800/50">
                    Manager Review Approval
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name / Title</label>
                    <input
                      type="text"
                      value={approval.managerName || ''}
                      onChange={(e) => setApproval({ ...approval, managerName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Signature</label>
                    <SignatureUpload
                      value={approval.managerSignature || ''}
                      onChange={(val) => setApproval({ ...approval, managerSignature: val })}
                      placeholder="Upload manager signature"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date Approved</label>
                    <input
                      type="text"
                      value={approval.managerDate || ''}
                      onChange={(e) => setApproval({ ...approval, managerDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                      disabled={!isPrivileged}
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
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-all"
              >
                <Calendar size={16} />
                Weekly Report
              </button>
              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-all"
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

      {/* Monthly Report Modal */}
      <AnimatePresence>
        {isMonthlyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 bg-slate-900/60 backdrop-blur-sm overflow-y-auto px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl flex flex-col my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="text-indigo-600 dark:text-lime-400" size={20} />
                    Monthly Report Consolidation
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate, review, and download a consolidated report for a date range.
                  </p>
                </div>
                <button
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 transition"
                >
                  &times;
                </button>
              </div>

              {/* Date Picker Section */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={monthlyStartDate}
                    onChange={(e) => setMonthlyStartDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={monthlyEndDate}
                    onChange={(e) => setMonthlyEndDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchMonthlyData}
                  disabled={isMonthlyLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all disabled:opacity-50 h-10"
                >
                  {isMonthlyLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Consolidating...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Fetch & Consolidate
                    </>
                  )}
                </button>
              </div>

              {/* Interactive Tabs */}
              <div className="px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/10 flex gap-2 overflow-x-auto py-3">
                {[
                  { id: 'summary', label: 'Accounting Summary' },
                  { id: 'transactions', label: 'Transaction Report' },
                  { id: 'expenses', label: 'Expenses & Payroll' },
                  { id: 'invoices', label: 'Invoices & Compliance' },
                  { id: 'kpis', label: 'KPIs & Issues' },
                  { id: 'comments', label: 'Comments & Handover' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMonthlyActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                      monthlyActiveTab === tab.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Content - Tabs container */}
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                {monthlyActiveTab === 'summary' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Accounting Summary</h3>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-950">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase w-1/3">Due Date</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-1/4">Status Summary</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Remarks Summary</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {monthlyDailyAccountingSummary.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.status || ''}
                                  onChange={(e) => {
                                    const updated = [...monthlyDailyAccountingSummary];
                                    updated[idx].status = e.target.value;
                                    setMonthlyDailyAccountingSummary(updated);
                                  }}
                                  className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.remarks || ''}
                                  onChange={(e) => {
                                    const updated = [...monthlyDailyAccountingSummary];
                                    updated[idx].remarks = e.target.value;
                                    setMonthlyDailyAccountingSummary(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {monthlyActiveTab === 'transactions' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Transaction Report</h3>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-950">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-1/3">Transaction Type</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-1/4">Total Count</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-slate-400">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {monthlyTransactionReport.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.transactionType}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.count || ''}
                                  onChange={(e) => {
                                    const updated = [...monthlyTransactionReport];
                                    updated[idx].count = e.target.value;
                                    setMonthlyTransactionReport(updated);
                                  }}
                                  className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.amount || ''}
                                  onChange={(e) => {
                                    const updated = [...monthlyTransactionReport];
                                    updated[idx].amount = e.target.value;
                                    setMonthlyTransactionReport(updated);
                                  }}
                                  className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200 font-mono"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {monthlyActiveTab === 'expenses' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Expense Tracking</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-1/3">Expense Category</th>
                              <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 w-1/4">Total Amount</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Remarks Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {monthlyExpenseTracking.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.category}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.amount || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyExpenseTracking];
                                      updated[idx].amount = e.target.value;
                                      setMonthlyExpenseTracking(updated);
                                    }}
                                    className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200 font-mono"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.remarks || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyExpenseTracking];
                                      updated[idx].remarks = e.target.value;
                                      setMonthlyExpenseTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Payroll & Payment Status</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-1/3">Due Date</th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-1/4">Status Summary</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Remarks Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {monthlyPayrollPaymentStatus.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.status || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyPayrollPaymentStatus];
                                      updated[idx].status = e.target.value;
                                      setMonthlyPayrollPaymentStatus(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.remarks || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyPayrollPaymentStatus];
                                      updated[idx].remarks = e.target.value;
                                      setMonthlyPayrollPaymentStatus(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
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

                {monthlyActiveTab === 'invoices' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Invoice & Billing Report</h3>
                      <button
                        type="button"
                        onClick={() => setMonthlyInvoiceBillingReport([...monthlyInvoiceBillingReport, { clientVendor: '', type: '', amount: '', status: '', remarks: '' }])}
                        className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 uppercase tracking-wider"
                      >
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-950">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Client/Vendor</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-32">Type</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 w-36">Amount</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-36">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Remarks</th>
                            <th className="px-3 py-2 text-center w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {monthlyInvoiceBillingReport.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="px-6 py-8 text-center text-slate-400 italic">
                                No invoices logged for the month. Click "Add Row" to add.
                              </td>
                            </tr>
                          ) : (
                            monthlyInvoiceBillingReport.map((row, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.clientVendor || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyInvoiceBillingReport];
                                      updated[idx].clientVendor = e.target.value;
                                      setMonthlyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.type || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyInvoiceBillingReport];
                                      updated[idx].type = e.target.value;
                                      setMonthlyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.amount || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyInvoiceBillingReport];
                                      updated[idx].amount = e.target.value;
                                      setMonthlyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200 font-mono"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.status || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyInvoiceBillingReport];
                                      updated[idx].status = e.target.value;
                                      setMonthlyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.remarks || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyInvoiceBillingReport];
                                      updated[idx].remarks = e.target.value;
                                      setMonthlyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setMonthlyInvoiceBillingReport(monthlyInvoiceBillingReport.filter((_, i) => i !== idx))}
                                    className="text-rose-500 hover:text-rose-600 transition"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {monthlyActiveTab === 'kpis' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">KPI Tracking</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-2/3">KPI</th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-slate-400">Target Achieved Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {monthlyKpiTracking.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.kpi}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.targetAchieved || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyKpiTracking];
                                      updated[idx].targetAchieved = e.target.value;
                                      setMonthlyKpiTracking(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Documentation & Compliance</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-2/3">Activity</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-2/3">Due Date</th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-slate-400">Status Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {monthlyDocumentationCompliance.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.status || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyDocumentationCompliance];
                                      updated[idx].status = e.target.value;
                                      setMonthlyDocumentationCompliance(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
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

                {monthlyActiveTab === 'comments' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Issues / Support Required</h3>
                        <button
                          type="button"
                          onClick={() => setMonthlyIssuesSupportRequired([...monthlyIssuesSupportRequired, { issue: '', priority: '', action: '' }])}
                          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 uppercase tracking-wider"
                        >
                          <Plus size={14} /> Add Row
                        </button>
                      </div>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-1/3">Issue</th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-40">Priority</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Action Taken / Required</th>
                              <th className="px-3 py-2 text-center w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {monthlyIssuesSupportRequired.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-slate-400 italic">
                                  No issues logged for this month.
                                </td>
                              </tr>
                            ) : (
                              monthlyIssuesSupportRequired.map((row, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={row.issue || ''}
                                      onChange={(e) => {
                                        const updated = [...monthlyIssuesSupportRequired];
                                        updated[idx].issue = e.target.value;
                                        setMonthlyIssuesSupportRequired(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={row.priority || ''}
                                      onChange={(e) => {
                                        const updated = [...monthlyIssuesSupportRequired];
                                        updated[idx].priority = e.target.value;
                                        setMonthlyIssuesSupportRequired(updated);
                                      }}
                                      className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                      placeholder="High / Med / Low"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={row.action || ''}
                                      onChange={(e) => {
                                        const updated = [...monthlyIssuesSupportRequired];
                                        updated[idx].action = e.target.value;
                                        setMonthlyIssuesSupportRequired(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setMonthlyIssuesSupportRequired(monthlyIssuesSupportRequired.filter((_, i) => i !== idx))}
                                      className="text-rose-500 hover:text-rose-600 transition"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Next Day Task Plan</h3>
                      <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        {monthlyNextDayTaskPlan.map((plan, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="font-bold text-slate-400 dark:text-slate-600 w-5 text-right">{idx + 1}.</span>
                            <input
                              type="text"
                              value={plan || ''}
                              onChange={(e) => {
                                const updated = [...monthlyNextDayTaskPlan];
                                updated[idx] = e.target.value;
                                setMonthlyNextDayTaskPlan(updated);
                              }}
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                              placeholder={`Task ${idx + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Final Shift Handover</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 w-2/3">Handover Item</th>
                              <th className="px-6 py-3 text-center text-xs font-bold text-slate-400">Status Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {monthlyFinalShiftHandover.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.item}</td>
                                <td className="px-6 py-3">
                                  <input
                                    type="text"
                                    value={item.status || ''}
                                    onChange={(e) => {
                                      const updated = [...monthlyFinalShiftHandover];
                                      updated[idx].status = e.target.value;
                                      setMonthlyFinalShiftHandover(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Accountant Comments</h3>
                      <textarea
                        value={monthlyAccountantComments}
                        onChange={(e) => setMonthlyAccountantComments(e.target.value)}
                        className="w-full h-36 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                        placeholder="Enter consolidated comments..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMonthlyPDF}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-md shadow-indigo-600/10"
                >
                  <Download size={16} />
                  Download Monthly PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isWeeklyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 bg-slate-900/60 backdrop-blur-sm overflow-y-auto px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl flex flex-col my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="text-indigo-600 dark:text-lime-400" size={20} />
                    Weekly Report Consolidation
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate, review, and download a consolidated report for a date range.
                  </p>
                </div>
                <button
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 transition"
                >
                  &times;
                </button>
              </div>

              {/* Date Picker Section */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={weeklyStartDate}
                    onChange={(e) => setWeeklyStartDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={weeklyEndDate}
                    onChange={(e) => setWeeklyEndDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchWeeklyData}
                  disabled={isWeeklyLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all disabled:opacity-50 h-10"
                >
                  {isWeeklyLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Consolidating...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Fetch & Consolidate
                    </>
                  )}
                </button>
              </div>

              {/* Interactive Tabs */}
              <div className="px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/10 flex gap-2 overflow-x-auto py-3">
                {[
                  { id: 'summary', label: 'Accounting Summary' },
                  { id: 'transactions', label: 'Transaction Report' },
                  { id: 'expenses', label: 'Expenses & Payroll' },
                  { id: 'invoices', label: 'Invoices & Compliance' },
                  { id: 'kpis', label: 'KPIs & Issues' },
                  { id: 'comments', label: 'Comments & Handover' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setWeeklyActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                      weeklyActiveTab === tab.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Content - Tabs container */}
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                {weeklyActiveTab === 'summary' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Accounting Summary</h3>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-950">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase w-1/3">Due Date</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-1/4">Status Summary</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Remarks Summary</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {weeklyDailyAccountingSummary.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.status || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyDailyAccountingSummary];
                                    updated[idx].status = e.target.value;
                                    setWeeklyDailyAccountingSummary(updated);
                                  }}
                                  className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.remarks || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyDailyAccountingSummary];
                                    updated[idx].remarks = e.target.value;
                                    setWeeklyDailyAccountingSummary(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'transactions' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Transaction Report</h3>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-950">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-1/3">Transaction Type</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-1/4">Total Count</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-slate-400">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {weeklyTransactionReport.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.transactionType}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.count || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyTransactionReport];
                                    updated[idx].count = e.target.value;
                                    setWeeklyTransactionReport(updated);
                                  }}
                                  className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={item.amount || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyTransactionReport];
                                    updated[idx].amount = e.target.value;
                                    setWeeklyTransactionReport(updated);
                                  }}
                                  className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200 font-mono"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'expenses' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Expense Tracking</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-1/3">Expense Category</th>
                              <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 w-1/4">Total Amount</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Remarks Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {weeklyExpenseTracking.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.category}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.amount || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyExpenseTracking];
                                      updated[idx].amount = e.target.value;
                                      setWeeklyExpenseTracking(updated);
                                    }}
                                    className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200 font-mono"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.remarks || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyExpenseTracking];
                                      updated[idx].remarks = e.target.value;
                                      setWeeklyExpenseTracking(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Payroll & Payment Status</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-[35%] min-w-[280px]">Activity</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-1/3">Due Date</th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-1/4">Status Summary</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Remarks Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {weeklyPayrollPaymentStatus.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.status || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyPayrollPaymentStatus];
                                      updated[idx].status = e.target.value;
                                      setWeeklyPayrollPaymentStatus(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.remarks || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyPayrollPaymentStatus];
                                      updated[idx].remarks = e.target.value;
                                      setWeeklyPayrollPaymentStatus(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
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

                {weeklyActiveTab === 'invoices' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Invoice & Billing Report</h3>
                      <button
                        type="button"
                        onClick={() => setWeeklyInvoiceBillingReport([...weeklyInvoiceBillingReport, { clientVendor: '', type: '', amount: '', status: '', remarks: '' }])}
                        className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 uppercase tracking-wider"
                      >
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-950">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Client/Vendor</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-32">Type</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 w-36">Amount</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-36">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Remarks</th>
                            <th className="px-3 py-2 text-center w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {weeklyInvoiceBillingReport.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="px-6 py-8 text-center text-slate-400 italic">
                                No invoices logged for the month. Click "Add Row" to add.
                              </td>
                            </tr>
                          ) : (
                            weeklyInvoiceBillingReport.map((row, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.clientVendor || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyInvoiceBillingReport];
                                      updated[idx].clientVendor = e.target.value;
                                      setWeeklyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.type || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyInvoiceBillingReport];
                                      updated[idx].type = e.target.value;
                                      setWeeklyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.amount || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyInvoiceBillingReport];
                                      updated[idx].amount = e.target.value;
                                      setWeeklyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200 font-mono"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.status || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyInvoiceBillingReport];
                                      updated[idx].status = e.target.value;
                                      setWeeklyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.remarks || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyInvoiceBillingReport];
                                      updated[idx].remarks = e.target.value;
                                      setWeeklyInvoiceBillingReport(updated);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setWeeklyInvoiceBillingReport(weeklyInvoiceBillingReport.filter((_, i) => i !== idx))}
                                    className="text-rose-500 hover:text-rose-600 transition"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'kpis' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">KPI Tracking</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-2/3">KPI</th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-slate-400">Target Achieved Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {weeklyKpiTracking.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.kpi}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.targetAchieved || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyKpiTracking];
                                      updated[idx].targetAchieved = e.target.value;
                                      setWeeklyKpiTracking(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Documentation & Compliance</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-2/3">Activity</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-2/3">Due Date</th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-slate-400">Status Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {weeklyDocumentationCompliance.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.activity}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.status || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyDocumentationCompliance];
                                      updated[idx].status = e.target.value;
                                      setWeeklyDocumentationCompliance(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
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

                {weeklyActiveTab === 'comments' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Issues / Support Required</h3>
                        <button
                          type="button"
                          onClick={() => setWeeklyIssuesSupportRequired([...weeklyIssuesSupportRequired, { issue: '', priority: '', action: '' }])}
                          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 uppercase tracking-wider"
                        >
                          <Plus size={14} /> Add Row
                        </button>
                      </div>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 w-1/3">Issue</th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-40">Priority</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-400">Action Taken / Required</th>
                              <th className="px-3 py-2 text-center w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {weeklyIssuesSupportRequired.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-slate-400 italic">
                                  No issues logged for this month.
                                </td>
                              </tr>
                            ) : (
                              weeklyIssuesSupportRequired.map((row, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={row.issue || ''}
                                      onChange={(e) => {
                                        const updated = [...weeklyIssuesSupportRequired];
                                        updated[idx].issue = e.target.value;
                                        setWeeklyIssuesSupportRequired(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={row.priority || ''}
                                      onChange={(e) => {
                                        const updated = [...weeklyIssuesSupportRequired];
                                        updated[idx].priority = e.target.value;
                                        setWeeklyIssuesSupportRequired(updated);
                                      }}
                                      className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                      placeholder="High / Med / Low"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={row.action || ''}
                                      onChange={(e) => {
                                        const updated = [...weeklyIssuesSupportRequired];
                                        updated[idx].action = e.target.value;
                                        setWeeklyIssuesSupportRequired(updated);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setWeeklyIssuesSupportRequired(weeklyIssuesSupportRequired.filter((_, i) => i !== idx))}
                                      className="text-rose-500 hover:text-rose-600 transition"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Next Day Task Plan</h3>
                      <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        {weeklyNextDayTaskPlan.map((plan, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="font-bold text-slate-400 dark:text-slate-600 w-5 text-right">{idx + 1}.</span>
                            <input
                              type="text"
                              value={plan || ''}
                              onChange={(e) => {
                                const updated = [...weeklyNextDayTaskPlan];
                                updated[idx] = e.target.value;
                                setWeeklyNextDayTaskPlan(updated);
                              }}
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                              placeholder={`Task ${idx + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Final Shift Handover</h3>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 w-2/3">Handover Item</th>
                              <th className="px-6 py-3 text-center text-xs font-bold text-slate-400">Status Summary</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {weeklyFinalShiftHandover.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.item}</td>
                                <td className="px-6 py-3">
                                  <input
                                    type="text"
                                    value={item.status || ''}
                                    onChange={(e) => {
                                      const updated = [...weeklyFinalShiftHandover];
                                      updated[idx].status = e.target.value;
                                      setWeeklyFinalShiftHandover(updated);
                                    }}
                                    className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Accountant Comments</h3>
                      <textarea
                        value={weeklyAccountantComments}
                        onChange={(e) => setWeeklyAccountantComments(e.target.value)}
                        className="w-full h-36 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                        placeholder="Enter consolidated comments..."
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Achievements</h3>
                      <textarea
                        value={weeklyAchievements}
                        onChange={(e) => setWeeklyAchievements(e.target.value)}
                        className="w-full h-36 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                        placeholder="Enter achievements..."
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Improvements</h3>
                      <textarea
                        value={weeklyImprovements}
                        onChange={(e) => setWeeklyImprovements(e.target.value)}
                        className="w-full h-36 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                        placeholder="Enter improvements needed..."
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider">Next Week Planning</h3>
                      <textarea
                        value={weeklyNextWeekPlanning}
                        onChange={(e) => setWeeklyNextWeekPlanning(e.target.value)}
                        className="w-full h-36 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none text-slate-800 dark:text-slate-200"
                        placeholder="Enter next week planning..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadWeeklyPDF}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-md shadow-indigo-600/10"
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

export default AccountantReportPage;
