import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Megaphone, Calendar, Plus, Trash2, Save, Download, 
  CheckCircle, HelpCircle, Loader2, User, Pencil, X, Maximize2,
  Paintbrush, TrendingUp, DollarSign, Target, Award, Eye, EyeOff, FileText, Check, AlertCircle,
  CheckSquare, UsersRound, ListTodo, RefreshCw, FileVideo, Video, ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';
import { fetchCompletedTasks, fetchDelegatedTasks } from '../utils/taskUtils';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const isRowEmpty = (item) => {
  if (!item || typeof item !== 'object') return true;
  const skipKeys = new Set(['_id', 'id', '__v']);
  return !Object.entries(item).some(([k, v]) => {
    if (skipKeys.has(k)) return false;
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
};

const HodMarketingReportPage = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fetchingTasks, setFetchingTasks] = useState(false);
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

  const [hodUsers, setHodUsers] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Generate months starting from April 2026 up to current month for monthly log sidebar
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
        setExpandedMonth(`${sel.getFullYear()}-${String(sel.getMonth() + 1).padStart(2, '0')}`);
      }
    }
  }, [selectedDate]);

  // Report Data State
  const [basicDetails, setBasicDetails] = useState({
    date: selectedDate,
    day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    employeeName: '',
    employeeId: '',
    department: 'Marketing & Creative',
    designation: 'HOD Marketing',
    shiftTiming: '9:00 AM - 5:00 PM',
    reportingTo: 'CMO / Director',
    reportingTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    preparedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  // Dynamic KPI Summary Metrics (No Hardcoding)
  const [kpiSummary, setKpiSummary] = useState({
    totalAdSpend: '0',
    totalLeadsGenerated: '0',
    costPerLead: '0',
    avgCtr: '0%',
    graphicsCreated: '0',
    revisionsRate: '0',
    conversionRate: '0%',
    returnOnAdSpend: '0x',
    tasksAssignedByCount: '0',
    tasksAssignedToCount: '0',
    completedTasksCount: '0'
  });

  // Tables State
  const [dailyTaskSummary, setDailyTaskSummary] = useState([]);
  const [tasksAssignedByUser, setTasksAssignedByUser] = useState([]);
  const [kpiTracking, setKpiTracking] = useState([]);
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);
  const [graphicDesignTasks, setGraphicDesignTasks] = useState([]);
  const [videoDeliverables, setVideoDeliverables] = useState([]);
  const [blockersTomorrowPlan, setBlockersTomorrowPlan] = useState([]);

  // Exclude Tables Option State
  const [excludeTables, setExcludeTables] = useState(false);

  const [approval, setApproval] = useState({
    hodName: '',
    hodSignature: '',
    hodDate: selectedDate,
    cmoName: 'CMO / Executive',
    cmoApproval: 'Pending',
    approvedOn: ''
  });

  // AI Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  // Fetch Current User Details & Privilege
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        const role = String(u.role_id || u.role || '').toLowerCase().trim();
        const privileged = u.isSuperAdmin === true || ['0', '1', '2', 'admin', 'hr', 'superadmin'].includes(role);
        setIsPrivileged(privileged);
        
        if (!selectedUserId && !privileged) {
          setSelectedUserId(u.id || u._id);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Fetch Team HOD List for privileged users
  useEffect(() => {
    if (!isPrivileged) return;
    const fetchHods = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/hod-marketing-reports/hods`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setHodUsers(json.data);
        }
      } catch (err) {
        console.error('Error fetching HOD users:', err);
      }
    };
    fetchHods();
  }, [isPrivileged, getAuthHeaders]);

  // Fetch Submitted Dates for selected user
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/hod-marketing-reports/submitted-dates?userId=${userId}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSubmittedDates(json.data);
      }
    } catch (err) {
      console.error('Error fetching submitted dates:', err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const targetUser = selectedUserId || currentUser.id || currentUser._id;
    if (targetUser) {
      fetchSubmittedDates(targetUser);
    }
  }, [selectedUserId, currentUser, fetchSubmittedDates]);

  // Auto-fetch real tasks assigned to user & assigned by user from Task Management System
  const loadTasksFromSystem = useCallback(async (targetUser, dateStr) => {
    setFetchingTasks(true);
    try {
      const [assignedTasksRaw, delegatedTasksRaw] = await Promise.all([
        fetchCompletedTasks(targetUser, dateStr),
        fetchDelegatedTasks(targetUser, dateStr, hodUsers)
      ]);

      const formatDateForInput = (dStr, fallback) => {
        if (!dStr) return fallback;
        try {
          const d = new Date(dStr);
          if (isNaN(d.getTime())) return fallback;
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        } catch (e) {
          return fallback;
        }
      };

      const mappedAssigned = (assignedTasksRaw || []).map(t => {
        let cleanTitle = t.taskTitle || t.title || t.task || t.description || 'Task';
        if (typeof cleanTitle === 'string' && cleanTitle.includes(' [')) {
          cleanTitle = cleanTitle.split(' [')[0];
        }
        const stDate = formatDateForInput(t.startDate || t.createdAt || t.startTime, dateStr);
        const edDate = formatDateForInput(t.endDate || t.dueDate || t.endTime || t.updatedAt, dateStr);

        return {
          taskTitle: cleanTitle,
          startDate: stDate,
          endDate: edDate,
          dueDate: edDate,
          status: t.status && t.status !== 'N/A' ? t.status : 'Pending',
          remarks: t.remarks || t.notes || t.description || ''
        };
      });

      const mappedDelegated = (delegatedTasksRaw || []).map(t => {
        let cleanTitle = t.taskTitle || t.title || t.task || t.kpi || t.description || 'Delegated Task';
        if (typeof cleanTitle === 'string' && cleanTitle.includes(' [')) {
          cleanTitle = cleanTitle.split(' [')[0];
        }
        const stDate = formatDateForInput(t.startDate || t.createdAt || t.startTime, dateStr);
        const edDate = formatDateForInput(t.endDate || t.dueDate || t.target || t.endTime || t.updatedAt, dateStr);
        const rawAssigned = t.assignedToName || t.assignedTo || t.project || 'Team Member';
        const assignedName = typeof rawAssigned === 'object' ? (rawAssigned.name || rawAssigned.employeeName || 'Team Member') : String(rawAssigned);

        return {
          taskTitle: cleanTitle,
          assignedToName: assignedName && assignedName !== 'N/A' ? assignedName : 'Team Member',
          startDate: stDate,
          endDate: edDate,
          dueDate: edDate,
          status: t.status && t.status !== 'N/A' ? t.status : (t.achieved || 'Pending'),
          remarks: t.remarks || t.notes || t.description || ''
        };
      });

      return { assigned: mappedAssigned, delegated: mappedDelegated };
    } catch (err) {
      console.error('Error auto-fetching tasks:', err);
      return { assigned: [], delegated: [] };
    } finally {
      setFetchingTasks(false);
    }
  }, []);

  // Fetch Report for Selected Date & User
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const targetUser = selectedUserId || currentUser.id || currentUser._id;
      const selectedUserObj = hodUsers.find(u => String(u._id || u.id) === String(targetUser)) || currentUser;

      const url = `${API_BASE}/v1/hod-marketing-reports/by-date?dateString=${selectedDate}${targetUser ? `&userId=${targetUser}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();

      const systemTasks = await loadTasksFromSystem(targetUser, selectedDate);

      // Auto-populate / auto-fetch basic details for target user
      setBasicDetails(prev => ({
        ...prev,
        date: selectedDate,
        day: new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }),
        employeeName: json.data?.basicDetails?.employeeName || selectedUserObj.name || currentUser.name || '',
        employeeId: json.data?.basicDetails?.employeeId || selectedUserObj.employee_id || selectedUserObj.employeeId || currentUser.employee_id || currentUser.employeeId || '',
        designation: json.data?.basicDetails?.designation || selectedUserObj.designation || selectedUserObj.role || 'HOD Marketing',
        department: json.data?.basicDetails?.department || selectedUserObj.department || 'Marketing & Creative',
        shiftTiming: json.data?.basicDetails?.shiftTiming || '9:00 AM - 5:00 PM',
        reportingTo: json.data?.basicDetails?.reportingTo || selectedUserObj.reportingTo || 'CMO / Director',
        reportingTime: json.data?.basicDetails?.reportingTime || prev.reportingTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        preparedTime: json.data?.basicDetails?.preparedTime || prev.preparedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));

      // Helper to check if task was completed prior to selected report date
      const isTaskDoneYesterdayOrEarlier = (t, reportDateStr) => {
        const statusLower = String(t.status || '').toLowerCase().trim();
        const isDone = ['done', 'completed'].includes(statusLower);
        if (!isDone) return false;

        const endVal = t.endDate || t.dueDate || t.updatedAt || t.completedAt;
        if (!endVal) return false;

        let formattedEnd = '';
        try {
          const d = new Date(endVal);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            formattedEnd = `${y}-${m}-${day}`;
          }
        } catch (e) {}

        if (!formattedEnd) {
          formattedEnd = String(endVal).substring(0, 10);
        }

        return formattedEnd < reportDateStr;
      };

      // ALWAYS merge auto-fetched system tasks so new tasks assigned in system always appear!
      const savedAssigned = Array.isArray(json.data?.dailyTaskSummary) ? json.data.dailyTaskSummary : [];
      const mergedAssigned = [...systemTasks.assigned];
      savedAssigned.forEach(savedTask => {
        if (!savedTask.taskTitle) return;
        const exists = mergedAssigned.some(t => t.taskTitle.trim().toLowerCase() === savedTask.taskTitle.trim().toLowerCase());
        if (!exists) {
          mergedAssigned.push(savedTask);
        }
      });
      const finalAssigned = mergedAssigned.filter(t => !isTaskDoneYesterdayOrEarlier(t, selectedDate));
      setDailyTaskSummary(finalAssigned);

      const savedDelegated = Array.isArray(json.data?.tasksAssignedByUser) ? json.data.tasksAssignedByUser : [];
      const mergedDelegated = [...systemTasks.delegated];
      savedDelegated.forEach(savedTask => {
        if (!savedTask.taskTitle) return;
        const exists = mergedDelegated.some(t => t.taskTitle.trim().toLowerCase() === savedTask.taskTitle.trim().toLowerCase());
        if (!exists) {
          mergedDelegated.push(savedTask);
        }
      });
      const finalDelegated = mergedDelegated.filter(t => !isTaskDoneYesterdayOrEarlier(t, selectedDate));
      setTasksAssignedByUser(finalDelegated);

      if (json.success && json.data) {
        const data = json.data;
        if (data.kpiSummary) setKpiSummary(data.kpiSummary);
        if (Array.isArray(data.kpiTracking)) setKpiTracking(data.kpiTracking);
        if (Array.isArray(data.marketingCampaigns)) setMarketingCampaigns(data.marketingCampaigns);
        if (Array.isArray(data.graphicDesignTasks)) setGraphicDesignTasks(data.graphicDesignTasks);
        if (Array.isArray(data.videoDeliverables)) setVideoDeliverables(data.videoDeliverables);
        if (Array.isArray(data.blockersTomorrowPlan)) setBlockersTomorrowPlan(data.blockersTomorrowPlan);
        if (data.excludeTables !== undefined) setExcludeTables(data.excludeTables);
        if (data.approval) setApproval(data.approval);
      } else {
        setKpiSummary({
          totalAdSpend: '0',
          totalLeadsGenerated: '0',
          costPerLead: '0',
          avgCtr: '0%',
          graphicsCreated: '0',
          videosDeliveredCount: '0',
          revisionsRate: '0',
          conversionRate: '0%',
          returnOnAdSpend: '0x',
          tasksAssignedByCount: String(mergedDelegated.length),
          tasksAssignedToCount: String(mergedAssigned.length),
          completedTasksCount: String(mergedAssigned.filter(t => ['done', 'completed'].includes(String(t.status).toLowerCase())).length)
        });

        setKpiTracking([
          { kpiName: 'Tasks Assigned BY User (Delegated)', target: 'Dynamic', achievedToday: String(mergedDelegated.length), remarks: 'Auto-fetched from tasks system' },
          { kpiName: 'Tasks Assigned TO User', target: 'Dynamic', achievedToday: String(mergedAssigned.length), remarks: 'Auto-fetched from tasks system' },
          { kpiName: 'Tasks Completed Today', target: '100%', achievedToday: String(mergedAssigned.filter(t => ['done', 'completed'].includes(String(t.status).toLowerCase())).length), remarks: 'Completed shift deliverables' }
        ]);

        setMarketingCampaigns([]);
        setGraphicDesignTasks([]);
        setVideoDeliverables([]);
        setBlockersTomorrowPlan([]);
        setExcludeTables(false);
      }
    } catch (err) {
      console.error('Error fetching HOD Marketing report:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedUserId, currentUser, hodUsers, getAuthHeaders, loadTasksFromSystem]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Recalculate Live KPI Metrics from Dynamic Tables
  useEffect(() => {
    let totalSpend = 0;
    let totalLeads = 0;

    marketingCampaigns.forEach(m => {
      totalSpend += Number(m.adSpend || 0);
      totalLeads += Number(m.leadsGenerated || 0);
    });

    const calculatedCpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0';
    const totalGraphics = graphicDesignTasks.filter(g => !isRowEmpty(g)).length;
    const totalVideos = videoDeliverables.filter(v => !isRowEmpty(v)).length;
    const completedCount = dailyTaskSummary.filter(t => ['done', 'completed'].includes(String(t.status || '').toLowerCase())).length;

    setKpiSummary(prev => ({
      ...prev,
      totalAdSpend: String(totalSpend),
      totalLeadsGenerated: String(totalLeads),
      costPerLead: calculatedCpl,
      graphicsCreated: String(totalGraphics),
      videosDeliveredCount: String(totalVideos),
      tasksAssignedByCount: String(tasksAssignedByUser.length),
      tasksAssignedToCount: String(dailyTaskSummary.length),
      completedTasksCount: String(completedCount)
    }));
  }, [marketingCampaigns, graphicDesignTasks, videoDeliverables, dailyTaskSummary, tasksAssignedByUser]);

  // Manual Refresh Tasks Handler
  const handleRefreshTasks = async () => {
    const targetUser = selectedUserId || currentUser.id || currentUser._id;
    const systemTasks = await loadTasksFromSystem(targetUser, selectedDate);
    setDailyTaskSummary(systemTasks.assigned);
    setTasksAssignedByUser(systemTasks.delegated);
    showToast(`Refreshed ${systemTasks.assigned.length} assigned tasks & ${systemTasks.delegated.length} delegated tasks.`, 'success');
  };

  // Report Period Mode: 'daily', 'weekly', 'monthly'
  const [reportPeriod, setReportPeriod] = useState('daily');

  // Weekly & Monthly Date Range Pickers
  const formatIsoDate = (d) => d.toISOString().split('T')[0];
  const todayDateObj = new Date();
  const sevenDaysAgoObj = new Date();
  sevenDaysAgoObj.setDate(todayDateObj.getDate() - 6);

  const [weeklyStartDate, setWeeklyStartDate] = useState(formatIsoDate(sevenDaysAgoObj));
  const [weeklyEndDate, setWeeklyEndDate] = useState(formatIsoDate(todayDateObj));
  const [monthlyMonth, setMonthlyMonth] = useState(`${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}`);
  const [consolidating, setConsolidating] = useState(false);

  // Synchronize basicDetails.date with reportPeriod & date range pickers
  useEffect(() => {
    if (reportPeriod === 'weekly') {
      const rangeStr = `${weeklyStartDate} to ${weeklyEndDate}`;
      setBasicDetails(prev => ({
        ...prev,
        date: rangeStr,
        day: 'Weekly Consolidation'
      }));
    } else if (reportPeriod === 'monthly') {
      setBasicDetails(prev => ({
        ...prev,
        date: monthlyMonth,
        day: 'Monthly Consolidation'
      }));
    } else {
      setBasicDetails(prev => ({
        ...prev,
        date: selectedDate,
        day: new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })
      }));
    }
  }, [reportPeriod, weeklyStartDate, weeklyEndDate, monthlyMonth, selectedDate]);

  // Fetch & Consolidate Weekly or Monthly Reports
  const handleFetchAndConsolidate = async () => {
    let startDateStr = '';
    let endDateStr = '';
    let periodName = '';

    if (reportPeriod === 'weekly') {
      if (!weeklyStartDate || !weeklyEndDate) {
        showToast('Please select start and end dates for weekly consolidation.', 'error');
        return;
      }
      startDateStr = weeklyStartDate;
      endDateStr = weeklyEndDate;
      periodName = 'Weekly';
    } else if (reportPeriod === 'monthly') {
      if (!monthlyMonth) {
        showToast('Please select a month for monthly consolidation.', 'error');
        return;
      }
      const [year, month] = monthlyMonth.split('-');
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      startDateStr = formatIsoDate(firstDay);
      endDateStr = formatIsoDate(lastDay);
      periodName = 'Monthly';
    } else {
      return;
    }

    setConsolidating(true);
    setLoading(true);
    try {
      const targetUser = selectedUserId || currentUser.id || currentUser._id;
      const dates = [];
      let cur = new Date(startDateStr);
      const end = new Date(endDateStr);
      while (cur <= end) {
        dates.push(formatIsoDate(cur));
        cur.setDate(cur.getDate() + 1);
      }

      const fetchPromises = dates.map(async (dStr) => {
        try {
          const res = await fetch(`${API_BASE}/v1/hod-marketing-reports/by-date?dateString=${dStr}&userId=${targetUser}`, {
            headers: getAuthHeaders()
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) return json.data;
          }
        } catch (err) {}
        return null;
      });

      const results = await Promise.all(fetchPromises);
      const validReports = results.filter(Boolean);

      if (validReports.length === 0) {
        showToast(`No saved daily reports found for ${startDateStr} to ${endDateStr}.`, 'warning');
        setLoading(false);
        setConsolidating(false);
        return;
      }

      // 1. Basic Details
      setBasicDetails(prev => ({
        ...prev,
        date: `${startDateStr} to ${endDateStr}`,
        day: `${periodName} Consolidation`,
        employeeName: validReports[0]?.basicDetails?.employeeName || prev.employeeName || '',
        employeeId: validReports[0]?.basicDetails?.employeeId || prev.employeeId || ''
      }));

      // 2. Consolidate dailyTaskSummary (Assigned Tasks)
      const assignedMap = new Map();
      validReports.forEach(r => {
        (r.dailyTaskSummary || []).forEach(t => {
          if (!t.taskTitle) return;
          const key = t.taskTitle.trim().toLowerCase();
          if (!assignedMap.has(key)) {
            assignedMap.set(key, { ...t });
          }
        });
      });
      setDailyTaskSummary(Array.from(assignedMap.values()));

      // 3. Consolidate tasksAssignedByUser (Delegated Tasks)
      const delegatedMap = new Map();
      validReports.forEach(r => {
        (r.tasksAssignedByUser || []).forEach(t => {
          if (!t.taskTitle) return;
          const key = `${t.taskTitle.trim().toLowerCase()}_${(t.assignedToName || '').trim().toLowerCase()}`;
          if (!delegatedMap.has(key)) {
            delegatedMap.set(key, { ...t });
          }
        });
      });
      setTasksAssignedByUser(Array.from(delegatedMap.values()));

      // 4. Consolidate marketingCampaigns
      const mktMap = new Map();
      validReports.forEach(r => {
        (r.marketingCampaigns || []).forEach(m => {
          if (!m.campaignName) return;
          const key = `${m.campaignName.trim().toLowerCase()}_${(m.channel || '').trim().toLowerCase()}`;
          if (!mktMap.has(key)) {
            mktMap.set(key, { ...m, adSpend: Number(m.adSpend || 0), leadsGenerated: Number(m.leadsGenerated || 0) });
          } else {
            const existing = mktMap.get(key);
            existing.adSpend += Number(m.adSpend || 0);
            existing.leadsGenerated += Number(m.leadsGenerated || 0);
            existing.cpl = existing.leadsGenerated > 0 ? (existing.adSpend / existing.leadsGenerated).toFixed(2) : '0';
          }
        });
      });
      setMarketingCampaigns(Array.from(mktMap.values()));

      // 5. Consolidate graphicDesignTasks
      const gdMap = new Map();
      validReports.forEach(r => {
        (r.graphicDesignTasks || []).forEach(g => {
          if (!g.graphicTitle) return;
          const key = g.graphicTitle.trim().toLowerCase();
          if (!gdMap.has(key)) {
            gdMap.set(key, { ...g });
          }
        });
      });
      setGraphicDesignTasks(Array.from(gdMap.values()));

      // 6. Consolidate videoDeliverables
      const vidMap = new Map();
      validReports.forEach(r => {
        (r.videoDeliverables || []).forEach(v => {
          if (!v.videoTitle) return;
          const key = v.videoTitle.trim().toLowerCase();
          if (!vidMap.has(key)) {
            vidMap.set(key, { ...v });
          }
        });
      });
      setVideoDeliverables(Array.from(vidMap.values()));

      // 7. Consolidate blockersTomorrowPlan
      const blockerMap = new Map();
      validReports.forEach(r => {
        (r.blockersTomorrowPlan || []).forEach(b => {
          if (!b.blockerIssue && !b.tomorrowPlan) return;
          const key = (b.blockerIssue || b.tomorrowPlan || '').trim().toLowerCase();
          if (!blockerMap.has(key)) {
            blockerMap.set(key, { ...b });
          }
        });
      });
      setBlockersTomorrowPlan(Array.from(blockerMap.values()));

      showToast(`Successfully consolidated ${validReports.length} daily reports for ${periodName} view! You can edit any fields before saving.`, 'success');
    } catch (err) {
      console.error('Error consolidating reports:', err);
      showToast('Error consolidating reports.', 'error');
    } finally {
      setLoading(false);
      setConsolidating(false);
    }
  };

  // Save Report Handler (saves to DB, syncs to Employee Reports, & auto-downloads PDF with Logo)
  const handleSaveReport = async () => {
    setSaving(true);
    try {
      const targetUser = selectedUserId || currentUser.id || currentUser._id;
      const targetDateStr = reportPeriod === 'weekly'
        ? `${weeklyStartDate}_to_${weeklyEndDate}`
        : (reportPeriod === 'monthly' ? `${monthlyMonth}_consolidated` : selectedDate);

      const datePeriodLabel = reportPeriod === 'weekly'
        ? `${weeklyStartDate} to ${weeklyEndDate}`
        : (reportPeriod === 'monthly' ? monthlyMonth : selectedDate);

      const payload = {
        dateString: targetDateStr,
        reportPeriod,
        userId: targetUser,
        basicDetails: {
          ...basicDetails,
          date: datePeriodLabel
        },
        kpiSummary,
        dailyTaskSummary: dailyTaskSummary.filter(r => !isRowEmpty(r)),
        tasksAssignedByUser: tasksAssignedByUser.filter(r => !isRowEmpty(r)),
        marketingCampaigns: marketingCampaigns.filter(r => !isRowEmpty(r)),
        graphicDesignTasks: graphicDesignTasks.filter(r => !isRowEmpty(r)),
        videoDeliverables: videoDeliverables.filter(r => !isRowEmpty(r)),
        blockersTomorrowPlan: blockersTomorrowPlan.filter(r => !isRowEmpty(r)),
        excludeTables,
        approval
      };

      // 1. Save Report Payload to DB
      const res = await fetch(`${API_BASE}/v1/hod-marketing-reports`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!json.success) {
        showToast(json.message || 'Failed to save report.', 'error');
        setSaving(false);
        return;
      }

      fetchSubmittedDates(targetUser);
      showToast(`Report saved! Generating ${reportPeriod.toUpperCase()} PDF with Logo & saving to Employee Reports...`, 'info');

      // 2. Automatically generate PDF with Logo via server endpoint (saves to Employee Reports & Cloudinary)
      try {
        const token = localStorage.getItem('token');
        const cleanToken = token ? token.replace(/"/g, '') : '';
        const pdfUrl = `${API_BASE}/v1/employee-reports/generate-pdf?userId=${targetUser}&dateString=${targetDateStr}&reportType=hod-marketing&reportPeriod=${reportPeriod}`;

        const pdfRes = await fetch(pdfUrl, {
          headers: {
            'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
          }
        });

        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          const empNameClean = (basicDetails.employeeName || currentUser.name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
          const periodTag = reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1);
          const filename = `HOD_Marketing_${periodTag}_Report_${empNameClean}_${targetDateStr}.pdf`;

          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
          }, 10000);

          showToast(`HOD Marketing ${reportPeriod} report saved & PDF downloaded with logo!`, 'success');
        } else {
          // Fallback to client PDF if server endpoint fails
          handleDownloadPDF();
          showToast('Report saved & PDF generated successfully!', 'success');
        }
      } catch (pdfErr) {
        console.error('Server PDF generation error, falling back to local generator:', pdfErr);
        handleDownloadPDF();
        showToast('Report saved & PDF generated successfully!', 'success');
      }
    } catch (err) {
      console.error('Error saving HOD Marketing report:', err);
      showToast('Error saving report.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Download PDF Handler with Exclude Table Option support
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('HOD MARKETING DAILY SHIFT REPORT', 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`Date: ${selectedDate}  |  Generated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 14, 21);

      // Basic Details Table
      autoTable(doc, {
        startY: 32,
        head: [['Employee Name', 'Employee ID', 'Designation', 'Reporting To', 'Reporting Time']],
        body: [[
          basicDetails.employeeName || 'N/A',
          basicDetails.employeeId || 'N/A',
          basicDetails.designation || 'HOD Marketing',
          basicDetails.reportingTo || 'CMO',
          basicDetails.reportingTime || basicDetails.preparedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ]],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' }
      });

      let currentY = doc.lastAutoTable.finalY + 6;

      // Executive KPI Summary Cards Section
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, currentY, pageWidth - 28, 28, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('KEY PERFORMANCE INDICATORS (KPI METRICS)', 18, currentY + 6);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tasks Assigned BY User: ${kpiSummary.tasksAssignedByCount}`, 18, currentY + 13);
      doc.text(`Tasks Assigned TO User: ${kpiSummary.tasksAssignedToCount}`, 18, currentY + 19);

      doc.text(`Completed Tasks: ${kpiSummary.completedTasksCount}`, 78, currentY + 13);
      doc.text(`Total Ad Spend: Rs. ${Number(kpiSummary.totalAdSpend || 0).toLocaleString('en-IN')}`, 78, currentY + 19);

      doc.text(`Leads Generated: ${kpiSummary.totalLeadsGenerated}`, 138, currentY + 13);
      doc.text(`Cost Per Lead (CPL): Rs. ${kpiSummary.costPerLead}`, 138, currentY + 19);

      currentY += 34;

      // Check Exclude Tables Option!
      if (excludeTables) {
        doc.setFillColor(254, 242, 242);
        doc.rect(14, currentY, pageWidth - 28, 10, 'F');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(185, 28, 28);
        doc.text('[Note: Detailed Data Tables Excluded by Executive User Preference.]', 18, currentY + 6);
        currentY += 14;
      } else {
        // Render Auto-Fetched Daily Tasks Assigned to User
        if (dailyTaskSummary.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);
          doc.text('1. DAILY TASKS ASSIGNED TO USER (AUTO-FETCHED)', 14, currentY);
          currentY += 3;

          autoTable(doc, {
            startY: currentY,
            head: [['Task Title / Activity', 'Start Date', 'End Date', 'Due Date', 'Status', 'Remarks']],
            body: dailyTaskSummary.map(t => [t.taskTitle, t.startDate || selectedDate, t.endDate || selectedDate, t.dueDate || selectedDate, t.status, t.remarks]),
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' } // teal-700
          });
          currentY = doc.lastAutoTable.finalY + 6;
        }

        // Render Tasks Assigned BY User (Delegated)
        if (tasksAssignedByUser.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);
          doc.text('2. TASKS DELEGATED / ASSIGNED BY USER TO TEAM', 14, currentY);
          currentY += 3;

          autoTable(doc, {
            startY: currentY,
            head: [['Task Title', 'Assigned To', 'Start Date', 'End Date', 'Due Date', 'Status', 'Remarks']],
            body: tasksAssignedByUser.map(t => [t.taskTitle, t.assignedToName, t.startDate || selectedDate, t.endDate || selectedDate, t.dueDate || selectedDate, t.status, t.remarks]),
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold' } // indigo-700
          });
          currentY = doc.lastAutoTable.finalY + 6;
        }

        // Render Marketing Campaigns Mix Table
        if (marketingCampaigns.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);
          doc.text('3. MARKETING CAMPAIGNS & AD PERFORMANCE', 14, currentY);
          currentY += 3;

          autoTable(doc, {
            startY: currentY,
            head: [['Campaign Name', 'Channel', 'Ad Spend (Rs.)', 'Leads', 'CPL (Rs.)', 'Status', 'Remarks']],
            body: marketingCampaigns.map(m => [
              m.campaignName,
              m.channel,
              `Rs. ${(Number(m.adSpend) || 0).toLocaleString('en-IN')}`,
              m.leadsGenerated,
              `Rs. ${m.cpl || 0}`,
              m.status,
              m.remarks
            ]),
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }
          });
          currentY = doc.lastAutoTable.finalY + 6;
        }

        // Render Graphic Design Deliverables Table
        if (graphicDesignTasks.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);
          doc.text('4. GRAPHIC DESIGN & CREATIVE DELIVERABLES', 14, currentY);
          currentY += 3;

          autoTable(doc, {
            startY: currentY,
            head: [['Project / Task Name', 'Asset Type', 'Due Date', 'Revisions', 'Status', 'Remarks']],
            body: graphicDesignTasks.map(g => [
              g.taskProjectName,
              g.assetType,
              g.dueDate,
              g.revisions,
              g.status,
              g.remarks
            ]),
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [147, 51, 234], textColor: 255, fontStyle: 'bold' }
          });
          currentY = doc.lastAutoTable.finalY + 6;
        }

        // Render Video Production & Media Deliverables Table
        if (videoDeliverables.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);
          doc.text('5. VIDEO PRODUCTION & MEDIA DELIVERABLES', 14, currentY);
          currentY += 3;

          autoTable(doc, {
            startY: currentY,
            head: [['Video Title / Campaign', 'Video Type', 'Duration', 'Due Date', 'Status', 'Remarks']],
            body: videoDeliverables.map(v => [
              v.videoTitle,
              v.videoType,
              v.duration,
              v.dueDate,
              v.status,
              v.remarks
            ]),
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [225, 29, 72], textColor: 255, fontStyle: 'bold' }
          });
          currentY = doc.lastAutoTable.finalY + 6;
        }
      }

      // Render Blockers & Tomorrow's Plan Table
      if (blockersTomorrowPlan.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text('6. BLOCKERS & TOMORROW\'S PLAN', 14, currentY);
        currentY += 3;

        autoTable(doc, {
          startY: currentY,
          head: [['Blocker / Issue', 'Priority', 'Tomorrow\'s Main Task', 'Notes']],
          body: blockersTomorrowPlan.map(b => [
            b.blockerIssue,
            b.priority,
            b.tomorrowPlan,
            b.notes
          ]),
          theme: 'striped',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' }
        });
        currentY = doc.lastAutoTable.finalY + 12;
      }

      // Signatures
      if (currentY + 25 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`HOD Signature: ${approval.hodName || basicDetails.employeeName}`, 14, currentY);
      doc.text(`CMO / Approver: ${approval.cmoName}`, 130, currentY);

      doc.save(`HOD_Marketing_Report_${selectedDate}.pdf`);
      showToast('PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      showToast('Failed to generate PDF.', 'error');
    }
  };

  return (
    <div className="flex gap-6 items-start w-full relative flex-col lg:flex-row pb-12">
      {/* LEFT PANEL: Monthly Date Select Sidebar */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md rounded-3xl p-5 shadow-sm relative ${
        isSidebarOpen 
          ? 'w-full lg:w-72 opacity-100 translate-x-0' 
          : 'w-0 lg:w-0 opacity-0 -translate-x-12 overflow-hidden p-0 border-none pointer-events-none'
      }`}>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
          <Calendar size={14} className="text-amber-500" />
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
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className={isExpanded ? 'text-white' : 'text-amber-500'} />
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
                              ? 'bg-amber-600 text-white font-bold shadow-xs'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className={`text-[10px] ${isSelected ? 'text-amber-200 font-semibold' : 'text-slate-400'}`}>
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
        className="mt-6 z-30 flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 text-slate-600 dark:text-slate-300 hover:text-amber-600 rounded-full shadow-md transition-all shrink-0 cursor-pointer active:scale-95"
      >
        {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* RIGHT PANEL: Main Report Content */}
      <div className="flex-1 w-full space-y-5">
        {/* Top Header Navbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                HOD Marketing Shift Report
              </h1>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md ${
                reportPeriod === 'weekly' 
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' 
                  : (reportPeriod === 'monthly' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')
              }`}>
                {reportPeriod === 'weekly' ? 'Weekly Consolidated' : (reportPeriod === 'monthly' ? 'Monthly Consolidated' : 'Daily Shift')}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Auto-Fetched Tasks, Marketing Performance & Graphic Design Output
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          {/* Mode Switcher Toggle Buttons */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setReportPeriod('daily')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                reportPeriod === 'daily'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setReportPeriod('weekly')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                reportPeriod === 'weekly'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Weekly Report
            </button>
            <button
              type="button"
              onClick={() => setReportPeriod('monthly')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                reportPeriod === 'monthly'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Report
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefreshTasks}
            disabled={fetchingTasks}
            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer"
            title="Auto-fetch latest tasks from System"
          >
            <RefreshCw size={14} className={fetchingTasks ? 'animate-spin text-amber-600' : ''} />
          </button>

          <AiAnalyzeButton onClick={() => setIsAiModalOpen(true)} />

          <button
            onClick={handleSaveReport}
            disabled={saving}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-98"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save Report</span>
          </button>
        </div>
      </div>

      {/* Weekly Date Range Consolidation Control Bar */}
      {reportPeriod === 'weekly' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Weekly Consolidated Report Generator
              </h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                Select start & end date range to auto-fetch and consolidate saved daily shift reports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <span className="text-slate-400 text-[10px] uppercase font-bold">From:</span>
              <input
                type="date"
                value={weeklyStartDate}
                onChange={(e) => setWeeklyStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <span className="text-slate-400 text-[10px] uppercase font-bold">To:</span>
              <input
                type="date"
                value={weeklyEndDate}
                onChange={(e) => setWeeklyEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={handleFetchAndConsolidate}
              disabled={consolidating}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              {consolidating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>Fetch & Consolidate Weekly</span>
            </button>
          </div>
        </div>
      )}

      {/* Monthly Consolidation Control Bar */}
      {reportPeriod === 'monthly' && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                Monthly Consolidated Report Generator
              </h3>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">
                Select target month to auto-fetch and consolidate saved daily shift reports into a monthly summary.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Month:</span>
              <input
                type="month"
                value={monthlyMonth}
                onChange={(e) => setMonthlyMonth(e.target.value)}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={handleFetchAndConsolidate}
              disabled={consolidating}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              {consolidating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>Fetch & Consolidate Monthly</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
          <p className="text-xs font-bold text-slate-500">Auto-fetching Tasks & Loading HOD Marketing Report Data...</p>
        </div>
      ) : (
        <>
          {/* Basic Details Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <User size={14} className="text-amber-500" /> Executive Details
              </h2>
              <button
                type="button"
                onClick={() => setIsEditingBasic(!isEditingBasic)}
                className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Pencil size={12} />
                <span>{isEditingBasic ? 'Close Edit' : 'Edit Basic Details'}</span>
              </button>
            </div>

            {isEditingBasic ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">HOD Name</label>
                  <input
                    type="text"
                    value={basicDetails.employeeName}
                    onChange={(e) => setBasicDetails({ ...basicDetails, employeeName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={basicDetails.employeeId}
                    onChange={(e) => setBasicDetails({ ...basicDetails, employeeId: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reporting To</label>
                  <input
                    type="text"
                    value={basicDetails.reportingTo}
                    onChange={(e) => setBasicDetails({ ...basicDetails, reportingTo: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reporting Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 9:00 AM"
                    value={basicDetails.reportingTime || basicDetails.preparedTime || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, reportingTime: e.target.value, preparedTime: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Name</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{basicDetails.employeeName || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Employee ID</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{basicDetails.employeeId || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Designation</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{basicDetails.designation || 'HOD Marketing'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Reporting To</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{basicDetails.reportingTo || 'CMO'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Shift</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{basicDetails.shiftTiming || '9:00 - 5:00'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Reporting Time</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{basicDetails.reportingTime || basicDetails.preparedTime || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Exclude Tables Option Bar */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                {excludeTables ? <EyeOff size={16} /> : <Eye size={16} />}
              </div>
              <div>
                <p className="text-xs font-extrabold text-amber-900 dark:text-amber-200">
                  Exclude Data Tables Option
                </p>
                <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  Enable to export/view high-level KPI cards & summary metrics, hiding detailed campaign & graphic design tables.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={excludeTables}
                onChange={(e) => setExcludeTables(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500 border-slate-300 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Exclude Tables
              </span>
            </label>
          </div>

          {/* Dynamic KPI Metrics Summary Cards Grid (No Hardcoding) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <UsersRound size={12} className="text-indigo-500" /> Tasks Assigned BY User
              </span>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
                {kpiSummary.tasksAssignedByCount || '0'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <ListTodo size={12} className="text-teal-500" /> Tasks Assigned TO User
              </span>
              <p className="text-base font-black text-teal-600 dark:text-teal-400">
                {kpiSummary.tasksAssignedToCount || '0'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <CheckSquare size={12} className="text-emerald-500" /> Completed Tasks
              </span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {kpiSummary.completedTasksCount || '0'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <DollarSign size={12} className="text-blue-500" /> Total Ad Spend
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white">
                ₹{Number(kpiSummary.totalAdSpend || 0).toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-500" /> Total Leads
              </span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {kpiSummary.totalLeadsGenerated || '0'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Target size={12} className="text-amber-500" /> Cost Per Lead (CPL)
              </span>
              <p className="text-base font-black text-amber-600 dark:text-amber-400">
                ₹{kpiSummary.costPerLead || '0'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Paintbrush size={12} className="text-purple-500" /> Graphics Created
              </span>
              <p className="text-base font-black text-purple-600 dark:text-purple-400">
                {kpiSummary.graphicsCreated || '0'}
              </p>
            </div>
          </div>

          {/* Section 1: Auto-Fetched Daily Tasks Assigned TO User */}
          {!excludeTables ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-2">
                  <ListTodo size={14} /> 1. Daily Shift Tasks Assigned TO User (Auto-Fetched)
                </h2>
                <button
                  type="button"
                  onClick={() => setDailyTaskSummary([...dailyTaskSummary, { taskTitle: '', startDate: selectedDate, endDate: selectedDate, dueDate: selectedDate, status: 'Pending', remarks: '' }])}
                  className="px-2.5 py-1 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 font-bold text-xs rounded-lg hover:bg-teal-100 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus size={12} /> Add Task Row
                </button>
              </div>

              {dailyTaskSummary.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 py-3 text-center">No tasks assigned to user on this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                        <th className="py-2 px-3">Task Title / Activity</th>
                        <th className="py-2 px-3">Start Date</th>
                        <th className="py-2 px-3">End Date</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Remarks / Notes</th>
                        <th className="py-2 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dailyTaskSummary.map((t, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Task title"
                              value={t.taskTitle}
                              onChange={(e) => {
                                const updated = [...dailyTaskSummary];
                                updated[idx].taskTitle = e.target.value;
                                setDailyTaskSummary(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={t.startDate || selectedDate}
                              onChange={(e) => {
                                const updated = [...dailyTaskSummary];
                                updated[idx].startDate = e.target.value;
                                setDailyTaskSummary(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={t.endDate || selectedDate}
                              onChange={(e) => {
                                const updated = [...dailyTaskSummary];
                                updated[idx].endDate = e.target.value;
                                setDailyTaskSummary(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={t.dueDate || selectedDate}
                              onChange={(e) => {
                                const updated = [...dailyTaskSummary];
                                updated[idx].dueDate = e.target.value;
                                setDailyTaskSummary(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-amber-600"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={t.status}
                              onChange={(e) => {
                                const updated = [...dailyTaskSummary];
                                updated[idx].status = e.target.value;
                                setDailyTaskSummary(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            >
                              <option value="Done">Done / Completed</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Pending">Pending</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Remarks"
                              value={t.remarks}
                              onChange={(e) => {
                                const updated = [...dailyTaskSummary];
                                updated[idx].remarks = e.target.value;
                                setDailyTaskSummary(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setDailyTaskSummary(dailyTaskSummary.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition cursor-pointer"
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
            </div>
          ) : null}

          {/* Section 2: Tasks Delegated / Assigned BY User (KPI) */}
          {!excludeTables ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <UsersRound size={14} /> 2. Tasks Delegated / Assigned BY User to Team
                </h2>
                <button
                  type="button"
                  onClick={() => setTasksAssignedByUser([...tasksAssignedByUser, { taskTitle: '', assignedToName: '', startDate: selectedDate, endDate: selectedDate, dueDate: selectedDate, status: 'Pending', remarks: '' }])}
                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold text-xs rounded-lg hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus size={12} /> Add Delegated Task
                </button>
              </div>

              {tasksAssignedByUser.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 py-3 text-center">No tasks assigned by user to team members on this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                        <th className="py-2 px-3">Task Title</th>
                        <th className="py-2 px-3">Assigned To</th>
                        <th className="py-2 px-3">Start Date</th>
                        <th className="py-2 px-3">End Date</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Remarks / Notes</th>
                        <th className="py-2 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {tasksAssignedByUser.map((t, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Delegated task title"
                              value={t.taskTitle}
                              onChange={(e) => {
                                const updated = [...tasksAssignedByUser];
                                updated[idx].taskTitle = e.target.value;
                                setTasksAssignedByUser(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Team member name"
                              value={t.assignedToName}
                              onChange={(e) => {
                                const updated = [...tasksAssignedByUser];
                                updated[idx].assignedToName = e.target.value;
                                setTasksAssignedByUser(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={t.startDate || selectedDate}
                              onChange={(e) => {
                                const updated = [...tasksAssignedByUser];
                                updated[idx].startDate = e.target.value;
                                setTasksAssignedByUser(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={t.endDate || selectedDate}
                              onChange={(e) => {
                                const updated = [...tasksAssignedByUser];
                                updated[idx].endDate = e.target.value;
                                setTasksAssignedByUser(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={t.dueDate || selectedDate}
                              onChange={(e) => {
                                const updated = [...tasksAssignedByUser];
                                updated[idx].dueDate = e.target.value;
                                setTasksAssignedByUser(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-amber-600"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={t.status}
                              onChange={(e) => {
                                const updated = [...tasksAssignedByUser];
                                updated[idx].status = e.target.value;
                                setTasksAssignedByUser(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            >
                              <option value="Done">Done / Completed</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Pending">Pending</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Remarks"
                              value={t.remarks}
                              onChange={(e) => {
                                const updated = [...tasksAssignedByUser];
                                updated[idx].remarks = e.target.value;
                                setTasksAssignedByUser(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setTasksAssignedByUser(tasksAssignedByUser.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition cursor-pointer"
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
            </div>
          ) : null}

          {/* Section 3: Marketing Campaigns Mix */}
          {!excludeTables ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Megaphone size={14} /> 3. Marketing Campaigns & Ad Spend Mix
                </h2>
                <button
                  type="button"
                  onClick={() => setMarketingCampaigns([...marketingCampaigns, { campaignName: '', channel: 'Meta Ads', adSpend: 0, leadsGenerated: 0, cpl: 0, status: 'Active', remarks: '' }])}
                  className="px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold text-xs rounded-lg hover:bg-blue-100 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus size={12} /> Add Campaign Row
                </button>
              </div>

              {marketingCampaigns.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 py-3 text-center">No campaign records added yet. Click "Add Campaign Row" to begin.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                        <th className="py-2 px-3">Campaign Name</th>
                        <th className="py-2 px-3">Channel</th>
                        <th className="py-2 px-3">Ad Spend (₹)</th>
                        <th className="py-2 px-3">Leads</th>
                        <th className="py-2 px-3">CPL (₹)</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Remarks</th>
                        <th className="py-2 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {marketingCampaigns.map((m, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Campaign title"
                              value={m.campaignName}
                              onChange={(e) => {
                                const updated = [...marketingCampaigns];
                                updated[idx].campaignName = e.target.value;
                                setMarketingCampaigns(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={m.channel}
                              onChange={(e) => {
                                const updated = [...marketingCampaigns];
                                updated[idx].channel = e.target.value;
                                setMarketingCampaigns(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            >
                              <option value="Meta Ads">Meta Ads</option>
                              <option value="Google Ads">Google Ads</option>
                              <option value="LinkedIn">LinkedIn</option>
                              <option value="Email">Email</option>
                              <option value="Organic">Organic / SEO</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={m.adSpend}
                              onChange={(e) => {
                                const updated = [...marketingCampaigns];
                                updated[idx].adSpend = Number(e.target.value) || 0;
                                if (updated[idx].leadsGenerated > 0) {
                                  updated[idx].cpl = Number((updated[idx].adSpend / updated[idx].leadsGenerated).toFixed(2));
                                }
                                setMarketingCampaigns(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={m.leadsGenerated}
                              onChange={(e) => {
                                const updated = [...marketingCampaigns];
                                updated[idx].leadsGenerated = Number(e.target.value) || 0;
                                if (updated[idx].leadsGenerated > 0) {
                                  updated[idx].cpl = Number((updated[idx].adSpend / updated[idx].leadsGenerated).toFixed(2));
                                }
                                setMarketingCampaigns(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-600"
                            />
                          </td>
                          <td className="py-2 px-3 font-bold text-amber-600">
                            ₹{m.cpl || (m.leadsGenerated > 0 ? (m.adSpend / m.leadsGenerated).toFixed(2) : '0')}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={m.status}
                              onChange={(e) => {
                                const updated = [...marketingCampaigns];
                                updated[idx].status = e.target.value;
                                setMarketingCampaigns(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            >
                              <option value="Active">Active</option>
                              <option value="Completed">Completed</option>
                              <option value="Paused">Paused</option>
                              <option value="In Review">In Review</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Remarks"
                              value={m.remarks}
                              onChange={(e) => {
                                const updated = [...marketingCampaigns];
                                updated[idx].remarks = e.target.value;
                                setMarketingCampaigns(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setMarketingCampaigns(marketingCampaigns.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition cursor-pointer"
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
            </div>
          ) : null}

          {/* Section 4: Graphic Design & Creative Deliverables Mix */}
          {!excludeTables ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-2">
                  <Paintbrush size={14} /> 4. Graphic Design & Creative Deliverables Mix
                </h2>
                <button
                  type="button"
                  onClick={() => setGraphicDesignTasks([...graphicDesignTasks, { taskProjectName: '', assetType: 'Poster/Banner', dueDate: selectedDate, assetLink: '', revisions: '0', status: 'Completed', remarks: '' }])}
                  className="px-2.5 py-1 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold text-xs rounded-lg hover:bg-purple-100 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus size={12} /> Add Design Row
                </button>
              </div>

              {graphicDesignTasks.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 py-3 text-center">No graphic design deliverables added yet. Click "Add Design Row" to begin.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                        <th className="py-2 px-3">Project / Task Name</th>
                        <th className="py-2 px-3">Asset Type</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3">Revisions</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Asset Drive/File Link</th>
                        <th className="py-2 px-3">Remarks</th>
                        <th className="py-2 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {graphicDesignTasks.map((g, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Design task title"
                              value={g.taskProjectName}
                              onChange={(e) => {
                                const updated = [...graphicDesignTasks];
                                updated[idx].taskProjectName = e.target.value;
                                setGraphicDesignTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={g.assetType}
                              onChange={(e) => {
                                const updated = [...graphicDesignTasks];
                                updated[idx].assetType = e.target.value;
                                setGraphicDesignTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            >
                              <option value="Social Media Graphic">Social Media Graphic</option>
                              <option value="Poster/Banner">Poster / Banner</option>
                              <option value="Ad Creative">Ad Creative</option>
                              <option value="Video Thumbnail">Video Thumbnail</option>
                              <option value="Branding">Branding & Logo</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={g.dueDate}
                              onChange={(e) => {
                                const updated = [...graphicDesignTasks];
                                updated[idx].dueDate = e.target.value;
                                setGraphicDesignTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="0"
                              value={g.revisions}
                              onChange={(e) => {
                                const updated = [...graphicDesignTasks];
                                updated[idx].revisions = e.target.value;
                                setGraphicDesignTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={g.status}
                              onChange={(e) => {
                                const updated = [...graphicDesignTasks];
                                updated[idx].status = e.target.value;
                                setGraphicDesignTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            >
                              <option value="Completed">Completed</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Pending">Pending</option>
                              <option value="Re-design">Re-design</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Drive or Figma Link"
                              value={g.assetLink}
                              onChange={(e) => {
                                const updated = [...graphicDesignTasks];
                                updated[idx].assetLink = e.target.value;
                                setGraphicDesignTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-blue-600"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Remarks"
                              value={g.remarks}
                              onChange={(e) => {
                                const updated = [...graphicDesignTasks];
                                updated[idx].remarks = e.target.value;
                                setGraphicDesignTasks(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setGraphicDesignTasks(graphicDesignTasks.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition cursor-pointer"
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
            </div>
          ) : null}

          {/* Section 5: Video Production & Media Deliverables Mix */}
          {!excludeTables ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <FileVideo size={14} /> 5. Video Production & Media Deliverables Mix
                </h2>
                <button
                  type="button"
                  onClick={() => setVideoDeliverables([...videoDeliverables, { videoTitle: '', videoType: 'Ad Video', duration: '30s', dueDate: selectedDate, videoLink: '', status: 'Completed', remarks: '' }])}
                  className="px-2.5 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs rounded-lg hover:bg-rose-100 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus size={12} /> Add Video Row
                </button>
              </div>

              {videoDeliverables.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 py-3 text-center">No video deliverables added yet. Click "Add Video Row" to begin.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                        <th className="py-2 px-3">Video Title / Campaign</th>
                        <th className="py-2 px-3">Video Type</th>
                        <th className="py-2 px-3">Duration</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Video Drive / File Link</th>
                        <th className="py-2 px-3">Remarks</th>
                        <th className="py-2 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {videoDeliverables.map((v, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Video title"
                              value={v.videoTitle}
                              onChange={(e) => {
                                const updated = [...videoDeliverables];
                                updated[idx].videoTitle = e.target.value;
                                setVideoDeliverables(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={v.videoType}
                              onChange={(e) => {
                                const updated = [...videoDeliverables];
                                updated[idx].videoType = e.target.value;
                                setVideoDeliverables(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            >
                              <option value="Reel / Short">Reel / Short (Vertical)</option>
                              <option value="Ad Video">Ad Video / Promo</option>
                              <option value="YouTube Video">YouTube Video (Longform)</option>
                              <option value="Brand Story">Brand Story / Film</option>
                              <option value="Explainer">Explainer / Tutorial</option>
                              <option value="Testimonial">Customer Testimonial</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="e.g. 30s"
                              value={v.duration}
                              onChange={(e) => {
                                const updated = [...videoDeliverables];
                                updated[idx].duration = e.target.value;
                                setVideoDeliverables(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={v.dueDate}
                              onChange={(e) => {
                                const updated = [...videoDeliverables];
                                updated[idx].dueDate = e.target.value;
                                setVideoDeliverables(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={v.status}
                              onChange={(e) => {
                                const updated = [...videoDeliverables];
                                updated[idx].status = e.target.value;
                                setVideoDeliverables(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            >
                              <option value="Completed">Completed</option>
                              <option value="Editing">Editing</option>
                              <option value="In Review">In Review</option>
                              <option value="Scripting">Scripting</option>
                              <option value="Shooting">Shooting</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Drive / YouTube Link"
                              value={v.videoLink}
                              onChange={(e) => {
                                const updated = [...videoDeliverables];
                                updated[idx].videoLink = e.target.value;
                                setVideoDeliverables(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-blue-600"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Remarks"
                              value={v.remarks}
                              onChange={(e) => {
                                const updated = [...videoDeliverables];
                                updated[idx].remarks = e.target.value;
                                setVideoDeliverables(updated);
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setVideoDeliverables(videoDeliverables.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition cursor-pointer"
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
            </div>
          ) : null}

          {/* Exclude Tables Notice when Exclude Tables option is ON */}
          {excludeTables && (
            <div className="bg-slate-100 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                <EyeOff size={14} className="text-amber-500" />
                Detailed Data Tables Excluded from View & Export (Showing High-Level Executive KPI Summary Only)
              </p>
            </div>
          )}

          {/* Section 5: Blockers & Tomorrow's Plan */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText size={14} /> 5. Blockers & Tomorrow's Action Plan
              </h2>
              <button
                type="button"
                onClick={() => setBlockersTomorrowPlan([...blockersTomorrowPlan, { blockerIssue: '', priority: 'Medium', tomorrowPlan: '', notes: '' }])}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg hover:bg-slate-200 transition cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} /> Add Plan Row
              </button>
            </div>

            {blockersTomorrowPlan.length === 0 ? (
              <p className="text-xs font-medium text-slate-400 py-3 text-center">No blockers or tomorrow's plan recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                      <th className="py-2 px-3">Blocker / Issue Faced Today</th>
                      <th className="py-2 px-3">Priority</th>
                      <th className="py-2 px-3">Tomorrow's Main Task / Action Plan</th>
                      <th className="py-2 px-3">Notes</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {blockersTomorrowPlan.map((b, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Issue details"
                            value={b.blockerIssue}
                            onChange={(e) => {
                              const updated = [...blockersTomorrowPlan];
                              updated[idx].blockerIssue = e.target.value;
                              setBlockersTomorrowPlan(updated);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={b.priority}
                            onChange={(e) => {
                              const updated = [...blockersTomorrowPlan];
                              updated[idx].priority = e.target.value;
                              setBlockersTomorrowPlan(updated);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Action plan for tomorrow"
                            value={b.tomorrowPlan}
                            onChange={(e) => {
                              const updated = [...blockersTomorrowPlan];
                              updated[idx].tomorrowPlan = e.target.value;
                              setBlockersTomorrowPlan(updated);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Notes"
                            value={b.notes}
                            onChange={(e) => {
                              const updated = [...blockersTomorrowPlan];
                              updated[idx].notes = e.target.value;
                              setBlockersTomorrowPlan(updated);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setBlockersTomorrowPlan(blockersTomorrowPlan.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition cursor-pointer"
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
          </div>

          {/* Signature & Approval Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              Signature & Approval Sign-off
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">HOD Marketing Digital Signature</label>
                <SignatureUpload
                  value={approval.hodSignature}
                  onChange={(sig) => setApproval({ ...approval, hodSignature: sig, hodName: basicDetails.employeeName })}
                  label="HOD Signature"
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">CMO / Approval Status</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${approval.cmoApproval === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {approval.cmoApproval || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Approver Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{approval.cmoName || 'CMO'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* AI Analysis Modal */}
      {isAiModalOpen && (
        <AiAnalyzeModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          title="HOD Marketing Daily Report AI Analysis"
          data={{
            basicDetails,
            kpiSummary,
            dailyTaskSummary,
            tasksAssignedByUser,
            kpiTracking,
            marketingCampaigns,
            graphicDesignTasks,
            videoDeliverables,
            blockersTomorrowPlan,
            excludeTables
          }}
        />
      )}
    </div>
  );
};

export default HodMarketingReportPage;
