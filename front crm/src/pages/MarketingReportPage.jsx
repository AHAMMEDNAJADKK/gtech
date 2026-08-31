import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { uploadCompiledPDFReport } from '../services/departmentService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, Plus, Trash2, Save, Download, 
  CheckCircle, HelpCircle, Loader2, User, ChevronLeft, ChevronRight, Pencil,
  X, Maximize2, MinusCircle, PlusCircle
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompletedTasks } from '../utils/taskUtils';
import SignatureUpload from '../components/SignatureUpload';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

const API_BASE = import.meta.env.VITE_API_URL;

// Defaults from mockup
const DEFAULT_TASK_SUMMARY = [
  { task: '', detailsNotes: '', status: '', dueDate: '', startDate: '', endDate: '', remarks: '' }
];

const DEFAULT_KPI_TRACKING = [
  { kpi: 'Leads generated', target: '', achievedToday: '', notes: '' },
  { kpi: 'Ad reach', target: '', achievedToday: '', notes: '' },
  { kpi: 'Ad spend (₹)', target: '', achievedToday: '', notes: '' },
  { kpi: 'Engagement rate (%)', target: '', achievedToday: '', notes: '' },
  { kpi: 'Posts published', target: '', achievedToday: '', notes: '' },
  { kpi: 'Videos delivered', target: '', achievedToday: '', notes: '' }
];

const DEFAULT_BLOCKERS_PLAN = [
  { blockersToday: '', priority: '', tomorrowMainTask: '', notes: '' }
];

const MarketingReportPage = () => {
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
  const [marketingStaff, setMarketingStaff] = useState([]);
  const [submittedDates, setSubmittedDates] = useState([]);

  // Form States
  const [basicDetails, setBasicDetails] = useState({
    employeeName: '',
    employeeId: '',
    designation: 'Digital Marketer',
    reportingTo: 'CMO',
    date: '',
    day: '',
    shiftTiming: '9:00 AM – 6:00 PM',
    preparedTime: ''
  });

  const [taskSummary, setTaskSummary] = useState(DEFAULT_TASK_SUMMARY);
  const [keyNumbers, setKeyNumbers] = useState(DEFAULT_KPI_TRACKING);
  const [blockersTomorrowPlan, setBlockersTomorrowPlan] = useState(DEFAULT_BLOCKERS_PLAN);
  const [selectedActivityText, setSelectedActivityText] = useState(null);

  const [hiddenSections, setHiddenSections] = useState({});

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };
  
  const [approval, setApproval] = useState({
    staffName: '',
    staffSignature: '',
    submittedAt: '',
    leaderName: '',
    leaderApproval: '',
    approvedOn: ''
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
  const [monthlyEndDate, setMonthlyEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [monthlyActiveTab, setMonthlyActiveTab] = useState('taskSummary');
  const [monthlyBasicDetails, setMonthlyBasicDetails] = useState({
    employeeName: '',
    employeeId: '',
    designation: '',
    reportingTo: '',
    dateRange: '',
    shiftTiming: ''
  });
  const [monthlyTaskSummary, setMonthlyTaskSummary] = useState([]);
  const [monthlyKeyNumbers, setMonthlyKeyNumbers] = useState([]);
  const [monthlyBlockersTomorrowPlan, setMonthlyBlockersTomorrowPlan] = useState([]);

  // Weekly States
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [weeklyEndDate, setWeeklyEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [weeklyActiveTab, setWeeklyActiveTab] = useState('taskSummary');
  const [weeklyBasicDetails, setWeeklyBasicDetails] = useState({
    employeeName: '',
    employeeId: '',
    designation: '',
    reportingTo: '',
    dateRange: '',
    shiftTiming: ''
  });
  const [weeklyTaskSummary, setWeeklyTaskSummary] = useState([]);
  const [weeklyKeyNumbers, setWeeklyKeyNumbers] = useState([]);
  const [weeklyBlockersTomorrowPlan, setWeeklyBlockersTomorrowPlan] = useState([]);

  const [weeklyAchievements, setWeeklyAchievements] = useState('');
  const [weeklyImprovements, setWeeklyImprovements] = useState('');
  const [weeklyNextWeekPlanning, setWeeklyNextWeekPlanning] = useState('');

  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

  const handleMonthlyTaskChange = (index, field, value) => {
    const updated = [...monthlyTaskSummary];
    updated[index][field] = value;
    setMonthlyTaskSummary(updated);
  };

  const addMonthlyTaskRow = () => {
    setMonthlyTaskSummary([
      ...monthlyTaskSummary,
      { task: '', detailsNotes: '', status: 'Done', dueDate: '', startDate: '', endDate: '', remarks: '' }
    ]);
  };

  const removeMonthlyTaskRow = (index) => {
    const updated = monthlyTaskSummary.filter((_, idx) => idx !== index);
    setMonthlyTaskSummary(updated);
  };

  const handleMonthlyBlockerChange = (index, field, value) => {
    const updated = [...monthlyBlockersTomorrowPlan];
    updated[index][field] = value;
    setMonthlyBlockersTomorrowPlan(updated);
  };

  const addMonthlyBlockerRow = () => {
    setMonthlyBlockersTomorrowPlan([
      ...monthlyBlockersTomorrowPlan,
      { blockersToday: '', priority: '', tomorrowMainTask: '', notes: '' }
    ]);
  };

  const removeMonthlyBlockerRow = (index) => {
    const updated = monthlyBlockersTomorrowPlan.filter((_, idx) => idx !== index);
    setMonthlyBlockersTomorrowPlan(updated);
  };

  const handleMonthlyKPIChange = (index, field, value) => {
    const updated = [...monthlyKeyNumbers];
    updated[index][field] = value;
    setMonthlyKeyNumbers(updated);
  };

  const handleFetchMonthlyData = async () => {
    if (!selectedUserId || !monthlyStartDate || !monthlyEndDate) return;
    try {
      setIsMonthlyLoading(true);
      const start = new Date(monthlyStartDate);
      const end = new Date(monthlyEndDate);
      const dateList = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dateList.push(d.toISOString().split('T')[0]);
      }

      const requests = dateList.map(dateStr =>
        fetch(`${API_BASE}/v1/marketing-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
          headers: getAuthHeaders()
        }).then(res => res.json())
      );

      const responses = await Promise.all(requests);
      const validReports = responses
        .filter(res => res.success && res.data)
        .map(res => res.data);

      if (validReports.length === 0) {
        showToast("No reports found in the selected date range.", "warning");
        setIsMonthlyLoading(false);
        return;
      }

      const firstReportBasic = validReports[0].basicDetails || {};
      setMonthlyBasicDetails({
        employeeName: firstReportBasic.employeeName || basicDetails.employeeName || '',
        employeeId: firstReportBasic.employeeId || basicDetails.employeeId || '',
        designation: firstReportBasic.designation || basicDetails.designation || 'Digital Marketer',
        reportingTo: firstReportBasic.reportingTo || basicDetails.reportingTo || 'CMO',
        dateRange: `${new Date(monthlyStartDate).toLocaleDateString('en-GB')} - ${new Date(monthlyEndDate).toLocaleDateString('en-GB')}`,
        shiftTiming: firstReportBasic.shiftTiming || basicDetails.shiftTiming || '9:00 AM – 6:00 PM'
      });

      const taskMap = {};
      validReports.forEach(report => {
        const tasks = report.taskSummary || [];
        tasks.forEach(t => {
          const taskName = (t.task || '').trim();
          if (!taskName) return;
           if (!taskMap[taskName]) {
            taskMap[taskName] = {
              task: taskName,
              detailsNotes: [],
              status: t.status || 'Done',
              dueDate: t.dueDate || '',
              startDate: t.startDate || '',
              endDate: t.endDate || '',
              remarks: []
            };
          }
          if (t.detailsNotes && !taskMap[taskName].detailsNotes.includes(t.detailsNotes.trim())) {
            taskMap[taskName].detailsNotes.push(t.detailsNotes.trim());
          }
          if (t.remarks && !taskMap[taskName].remarks.includes(t.remarks.trim())) {
            taskMap[taskName].remarks.push(t.remarks.trim());
          }
          if (t.status && t.status.toLowerCase() === 'done') {
            taskMap[taskName].status = 'Done';
          }
          // Preserve dates if not set yet
          if (t.dueDate && !taskMap[taskName].dueDate) taskMap[taskName].dueDate = t.dueDate;
          if (t.startDate && !taskMap[taskName].startDate) taskMap[taskName].startDate = t.startDate;
          if (t.endDate && !taskMap[taskName].endDate) taskMap[taskName].endDate = t.endDate;
        });
      });

      const consolidatedTasks = Object.values(taskMap).map(item => ({
        task: item.task,
        dueDate: item.dueDate,
        startDate: item.startDate,
        endDate: item.endDate,
        detailsNotes: item.detailsNotes.filter(Boolean).join('; '),
        status: item.status,
        remarks: item.remarks.filter(Boolean).join('; ')
      }));

      if (consolidatedTasks.length === 0) {
        consolidatedTasks.push({ task: '', detailsNotes: '', status: 'N/A', dueDate: '', startDate: '', endDate: '', remarks: '' });
      }
      setMonthlyTaskSummary(consolidatedTasks);

      const kpisMap = {};
      DEFAULT_KPI_TRACKING.forEach(k => {
        kpisMap[k.kpi] = { kpi: k.kpi, target: 0, achievedToday: 0, notes: [], count: 0 };
      });

      validReports.forEach(report => {
        const kpis = report.keyNumbers || [];
        kpis.forEach(k => {
          const name = (k.kpi || '').trim();
          if (!name) return;
          if (!kpisMap[name]) {
            kpisMap[name] = { kpi: name, target: 0, achievedToday: 0, notes: [], count: 0 };
          }
          
          const parseVal = (val) => {
            if (!val) return 0;
            const cleaned = val.toString().replace(/[₹%,]/g, '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
          };

          const tVal = parseVal(k.target);
          const aVal = parseVal(k.achievedToday);

          kpisMap[name].target += tVal;
          kpisMap[name].achievedToday += aVal;
          kpisMap[name].count += 1;

          if (k.notes && !kpisMap[name].notes.includes(k.notes.trim())) {
            kpisMap[name].notes.push(k.notes.trim());
          }
        });
      });

      const consolidatedKPIs = Object.values(kpisMap).map(k => {
        let displayTarget = k.target;
        let displayAchieved = k.achievedToday;
        
        if (k.kpi.toLowerCase().includes('%') || k.kpi.toLowerCase().includes('rate')) {
          displayTarget = k.count > 0 ? (k.target / k.count).toFixed(2) : 0;
          displayAchieved = k.count > 0 ? (k.achievedToday / k.count).toFixed(2) : 0;
          if (displayTarget.endsWith('.00')) displayTarget = displayTarget.slice(0, -3);
          if (displayAchieved.endsWith('.00')) displayAchieved = displayAchieved.slice(0, -3);
          displayTarget = `${displayTarget}%`;
          displayAchieved = `${displayAchieved}%`;
        } else if (k.kpi.toLowerCase().includes('₹') || k.kpi.toLowerCase().includes('spend') || k.kpi.toLowerCase().includes('budget')) {
          displayTarget = `₹${k.target}`;
          displayAchieved = `₹${k.achievedToday}`;
        } else {
          displayTarget = k.target || '';
          displayAchieved = k.achievedToday || '';
        }

        return {
          kpi: k.kpi,
          target: displayTarget,
          achievedToday: displayAchieved,
          notes: k.notes.filter(Boolean).join('; ')
        };
      });

      setMonthlyKeyNumbers(consolidatedKPIs);

      const consolidatedBlockers = [];
      validReports.forEach(report => {
        const items = report.blockersTomorrowPlan || [];
        items.forEach(item => {
          if (item.blockersToday || item.tomorrowMainTask || item.notes) {
            consolidatedBlockers.push({
              blockersToday: item.blockersToday || '',
              priority: item.priority || '',
              tomorrowMainTask: item.tomorrowMainTask || '',
              notes: item.notes || ''
            });
          }
        });
      });

      if (consolidatedBlockers.length === 0) {
        consolidatedBlockers.push({ blockersToday: '', priority: '', tomorrowMainTask: '', notes: '' });
      }
      setMonthlyBlockersTomorrowPlan(consolidatedBlockers);

      showToast(`Consolidated ${validReports.length} daily reports!`, "success");
    } catch (e) {
      console.error(e);
      showToast("Error consolidating monthly report data.", "error");
    } finally {
      setIsMonthlyLoading(false);
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
        doc.rect(14, currentY, 182, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 4.2);
        currentY += 6;
      };

      const drawHeader = () => {
        // Logo
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          doc.addImage(logoImg, 'PNG', 14, 10, 32, 12);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(20);
          doc.setTextColor(132, 204, 22); // Lime Green
          doc.text("KOD.", 14, 21);
          
          doc.setTextColor(60, 35, 117);
          doc.text("brand", 32, 21);
        }

        // Title
        doc.setFontSize(14);
        doc.setTextColor(60, 35, 117);
        doc.text("MONTHLY CONSOLIDATED REPORT", 95, 16);
        
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text("DIGITAL MARKETER · CMO / CREATIVE & MARKETING", 112, 22);
      };

      drawHeader();
      currentY = 25;

      // 1. BASIC DETAILS
      drawSectionHeader("1. Basic details");
      const basicRows = [
        [
          "Employee name", monthlyBasicDetails.employeeName || '',
          "Date range", monthlyBasicDetails.dateRange || ''
        ],
        [
          "Employee ID", monthlyBasicDetails.employeeId || '',
          "Designation", monthlyBasicDetails.designation || ''
        ],
        [
          "Reporting to", monthlyBasicDetails.reportingTo || '',
          "Shift timing", monthlyBasicDetails.shiftTiming || ''
        ]
      ];

      autoTable(doc, {
        body: basicRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 35 },
          1: { width: 56 },
          2: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 35 },
          3: { width: 56 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 2. TASK SUMMARY
      drawSectionHeader("2. Consolidated Task summary");
      const taskHeaders = [["Task", "Due Date", "Start Date", "End Date", "Details / notes", "Status", "Remarks"]];
      const taskRows = monthlyTaskSummary.map(t => [t.task || '', t.dueDate || '', t.startDate || '', t.endDate || '', t.detailsNotes || '', t.status || '', t.remarks || '']);

      autoTable(doc, {
        head: taskHeaders,
        body: taskRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 35 },
          1: { width: 20 },
          2: { width: 20 },
          3: { width: 20 },
          4: { width: 45 },
          5: { width: 20, halign: 'center' },
          6: { width: 22 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 3. KEY NUMBERS (KPIs)
      drawSectionHeader("3. Consolidated Key numbers (KPIs)");
      const kpiHeaders = [["KPI", "Target (Sum/Avg)", "Achieved (Sum/Avg)", "Notes"]];
      const kpiRows = monthlyKeyNumbers.map(k => [k.kpi || '', k.target || '', k.achievedToday || '', k.notes || '']);

      autoTable(doc, {
        head: kpiHeaders,
        body: kpiRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 45 },
          1: { width: 45, halign: 'center' },
          2: { width: 45, halign: 'center' },
          3: { width: 47 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 4. BLOCKERS & NEXT PLAN
      drawSectionHeader("4. Consolidated Blockers & next plans");
      const blockersHeaders = [["Any blockers?", "Priority", "Next main tasks", "Notes"]];
      const blockersRows = monthlyBlockersTomorrowPlan.map(b => [b.blockersToday || '', b.priority || '', b.tomorrowMainTask || '', b.notes || '']);

      autoTable(doc, {
        head: blockersHeaders,
        body: blockersRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 45 },
          1: { width: 30, halign: 'center' },
          2: { width: 62 },
          3: { width: 45 }
        },
        margin: { left: 14, right: 14 }
      });

      const pdfBlob = doc.output('blob');
      const filename = `Marketing_Monthly_Report_${monthlyBasicDetails.employeeName || 'Marketer'}_${monthlyStartDate}_to_${monthlyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${monthlyStartDate}_to_${monthlyEndDate}`, pdfBlob, filename, 'marketing', 'monthly');
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

  const handleFetchWeeklyData = async () => {
    if (!selectedUserId || !weeklyStartDate || !weeklyEndDate) return;
    try {
      setIsWeeklyLoading(true);
      const start = new Date(weeklyStartDate);
      const end = new Date(weeklyEndDate);
      const dateList = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dateList.push(d.toISOString().split('T')[0]);
      }

      const requests = dateList.map(dateStr =>
        fetch(`${API_BASE}/v1/marketing-reports/by-date?userId=${selectedUserId}&dateString=${dateStr}`, {
          headers: getAuthHeaders()
        }).then(res => res.json())
      );

      const responses = await Promise.all(requests);
      const validReports = responses
        .filter(res => res.success && res.data)
        .map(res => res.data);

      if (validReports.length === 0) {
        showToast("No reports found in the selected date range.", "warning");
        setIsWeeklyLoading(false);
        return;
      }

      const firstReportBasic = validReports[0].basicDetails || {};
      setWeeklyBasicDetails({
        employeeName: firstReportBasic.employeeName || basicDetails.employeeName || '',
        employeeId: firstReportBasic.employeeId || basicDetails.employeeId || '',
        designation: firstReportBasic.designation || basicDetails.designation || 'Digital Marketer',
        reportingTo: firstReportBasic.reportingTo || basicDetails.reportingTo || 'CMO',
        dateRange: `${new Date(weeklyStartDate).toLocaleDateString('en-GB')} - ${new Date(weeklyEndDate).toLocaleDateString('en-GB')}`,
        shiftTiming: firstReportBasic.shiftTiming || basicDetails.shiftTiming || '9:00 AM – 6:00 PM'
      });

      const taskMap = {};
      validReports.forEach(report => {
        const tasks = report.taskSummary || [];
        tasks.forEach(t => {
          const taskName = (t.task || '').trim();
          if (!taskName) return;
          if (!taskMap[taskName]) {
            taskMap[taskName] = {
              task: taskName,
              detailsNotes: [],
              status: t.status || 'Done',
              dueDate: t.dueDate || '',
              startDate: t.startDate || '',
              endDate: t.endDate || '',
              remarks: []
            };
          }
          if (t.detailsNotes && !taskMap[taskName].detailsNotes.includes(t.detailsNotes.trim())) {
            taskMap[taskName].detailsNotes.push(t.detailsNotes.trim());
          }
          if (t.remarks && !taskMap[taskName].remarks.includes(t.remarks.trim())) {
            taskMap[taskName].remarks.push(t.remarks.trim());
          }
          if (t.status && t.status.toLowerCase() === 'done') {
            taskMap[taskName].status = 'Done';
          }
          if (t.dueDate && !taskMap[taskName].dueDate) taskMap[taskName].dueDate = t.dueDate;
          if (t.startDate && !taskMap[taskName].startDate) taskMap[taskName].startDate = t.startDate;
          if (t.endDate && !taskMap[taskName].endDate) taskMap[taskName].endDate = t.endDate;
        });
      });

      const consolidatedTasks = Object.values(taskMap).map(item => ({
        task: item.task,
        dueDate: item.dueDate,
        startDate: item.startDate,
        endDate: item.endDate,
        detailsNotes: item.detailsNotes.filter(Boolean).join('; '),
        status: item.status,
        remarks: item.remarks.filter(Boolean).join('; ')
      }));

      if (consolidatedTasks.length === 0) {
        consolidatedTasks.push({ task: '', detailsNotes: '', status: 'N/A', dueDate: '', startDate: '', endDate: '', remarks: '' });
      }
      setWeeklyTaskSummary(consolidatedTasks);

      const kpisMap = {};
      DEFAULT_KPI_TRACKING.forEach(k => {
        kpisMap[k.kpi] = { kpi: k.kpi, target: 0, achievedToday: 0, notes: [], count: 0 };
      });

      validReports.forEach(report => {
        const kpis = report.keyNumbers || [];
        kpis.forEach(k => {
          const name = (k.kpi || '').trim();
          if (!name) return;
          if (!kpisMap[name]) {
            kpisMap[name] = { kpi: name, target: 0, achievedToday: 0, notes: [], count: 0 };
          }
          
          const parseVal = (val) => {
            if (!val) return 0;
            const cleaned = val.toString().replace(/[₹%,]/g, '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
          };

          const tVal = parseVal(k.target);
          const aVal = parseVal(k.achievedToday);

          kpisMap[name].target += tVal;
          kpisMap[name].achievedToday += aVal;
          kpisMap[name].count += 1;

          if (k.notes && !kpisMap[name].notes.includes(k.notes.trim())) {
            kpisMap[name].notes.push(k.notes.trim());
          }
        });
      });

      const consolidatedKPIs = Object.values(kpisMap).map(k => {
        let displayTarget = k.target;
        let displayAchieved = k.achievedToday;
        
        if (k.kpi.toLowerCase().includes('%') || k.kpi.toLowerCase().includes('rate')) {
          displayTarget = k.count > 0 ? (k.target / k.count).toFixed(2) : 0;
          displayAchieved = k.count > 0 ? (k.achievedToday / k.count).toFixed(2) : 0;
          if (displayTarget.endsWith('.00')) displayTarget = displayTarget.slice(0, -3);
          if (displayAchieved.endsWith('.00')) displayAchieved = displayAchieved.slice(0, -3);
          displayTarget = `${displayTarget}%`;
          displayAchieved = `${displayAchieved}%`;
        } else if (k.kpi.toLowerCase().includes('₹') || k.kpi.toLowerCase().includes('spend') || k.kpi.toLowerCase().includes('budget')) {
          displayTarget = `₹${k.target}`;
          displayAchieved = `₹${k.achievedToday}`;
        } else {
          displayTarget = k.target || '';
          displayAchieved = k.achievedToday || '';
        }

        return {
          kpi: k.kpi,
          target: displayTarget,
          achievedToday: displayAchieved,
          notes: k.notes.filter(Boolean).join('; ')
        };
      });

      setWeeklyKeyNumbers(consolidatedKPIs);

      const consolidatedBlockers = [];
      validReports.forEach(report => {
        const items = report.blockersTomorrowPlan || [];
        items.forEach(item => {
          if (item.blockersToday || item.tomorrowMainTask || item.notes) {
            consolidatedBlockers.push({
              blockersToday: item.blockersToday || '',
              priority: item.priority || '',
              tomorrowMainTask: item.tomorrowMainTask || '',
              notes: item.notes || ''
            });
          }
        });
      });

      if (consolidatedBlockers.length === 0) {
        consolidatedBlockers.push({ blockersToday: '', priority: '', tomorrowMainTask: '', notes: '' });
      }
      setWeeklyBlockersTomorrowPlan(consolidatedBlockers);

      showToast(`Consolidated ${validReports.length} daily reports!`, "success");
    } catch (e) {
      console.error(e);
      showToast("Error consolidating weekly report data.", "error");
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
        doc.rect(14, currentY, 182, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 17, currentY + 4.2);
        currentY += 6;
      };

      const drawHeader = () => {
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          doc.addImage(logoImg, 'PNG', 14, 10, 32, 12);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(20);
          doc.setTextColor(132, 204, 22);
          doc.text("KOD.", 14, 21);
          
          doc.setTextColor(60, 35, 117);
          doc.text("brand", 32, 21);
        }

        doc.setFontSize(14);
        doc.setTextColor(60, 35, 117);
        doc.text("WEEKLY CONSOLIDATED REPORT", 95, 16);
        
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text("DIGITAL MARKETER · CMO / CREATIVE & MARKETING", 112, 22);
      };

      drawHeader();
      currentY = 25;

      // 1. BASIC DETAILS
      drawSectionHeader("1. Basic details");
      const basicRows = [
        [
          "Employee name", weeklyBasicDetails.employeeName || '',
          "Date range", weeklyBasicDetails.dateRange || ''
        ],
        [
          "Employee ID", weeklyBasicDetails.employeeId || '',
          "Designation", weeklyBasicDetails.designation || ''
        ],
        [
          "Reporting to", weeklyBasicDetails.reportingTo || '',
          "Shift timing", weeklyBasicDetails.shiftTiming || ''
        ]
      ];

      autoTable(doc, {
        body: basicRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 35 },
          1: { width: 56 },
          2: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 35 },
          3: { width: 56 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 2. TASK SUMMARY
      drawSectionHeader("2. Consolidated Task summary");
      const taskHeaders = [["Task", "Due Date", "Start Date", "End Date", "Details / notes", "Status", "Remarks"]];
      const taskRows = weeklyTaskSummary.map(t => [t.task || '', t.dueDate || '', t.startDate || '', t.endDate || '', t.detailsNotes || '', t.status || '', t.remarks || '']);

      autoTable(doc, {
        head: taskHeaders,
        body: taskRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 35 },
          1: { width: 20 },
          2: { width: 20 },
          3: { width: 20 },
          4: { width: 45 },
          5: { width: 20, halign: 'center' },
          6: { width: 22 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 3. KEY NUMBERS (KPIs)
      drawSectionHeader("3. Consolidated Key numbers (KPIs)");
      const kpiHeaders = [["KPI", "Target (Sum/Avg)", "Achieved (Sum/Avg)", "Notes"]];
      const kpiRows = weeklyKeyNumbers.map(k => [k.kpi || '', k.target || '', k.achievedToday || '', k.notes || '']);

      autoTable(doc, {
        head: kpiHeaders,
        body: kpiRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 45 },
          1: { width: 45, halign: 'center' },
          2: { width: 45, halign: 'center' },
          3: { width: 47 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 4. BLOCKERS & NEXT PLAN
      drawSectionHeader("4. Consolidated Blockers & next plans");
      const blockersHeaders = [["Any blockers?", "Priority", "Next main tasks", "Notes"]];
      const blockersRows = weeklyBlockersTomorrowPlan.map(b => [b.blockersToday || '', b.priority || '', b.tomorrowMainTask || '', b.notes || '']);

      autoTable(doc, {
        head: blockersHeaders,
        body: blockersRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [60, 35, 117], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 45 },
          1: { width: 30, halign: 'center' },
          2: { width: 62 },
          3: { width: 45 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 5. ACHIEVEMENTS, IMPROVEMENTS & NEXT WEEK PLANNING
      if (weeklyAchievements || weeklyImprovements || weeklyNextWeekPlanning) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 15;
        }
        drawSectionHeader("5. Achievements, Improvements & Next Week Planning");
        const weeklySummaryRows = [
          ["Achievements", weeklyAchievements || 'N/A'],
          ["Improvements Needed", weeklyImprovements || 'N/A'],
          ["Next Week Planning", weeklyNextWeekPlanning || 'N/A']
        ];

        autoTable(doc, {
          body: weeklySummaryRows,
          startY: currentY,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 45 },
            1: { width: 137 }
          },
          margin: { left: 14, right: 14 }
        });
      }

      const pdfBlob = doc.output('blob');
      const filename = `Marketing_Weekly_Report_${weeklyBasicDetails.employeeName || 'Marketer'}_${weeklyStartDate}_to_${weeklyEndDate}.pdf`;
      try {
        await uploadCompiledPDFReport(selectedUserId, `${weeklyStartDate}_to_${weeklyEndDate}`, pdfBlob, filename, 'marketing', 'weekly');
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

  // Fetch Marketing Staff (For Admins)
  useEffect(() => {
    if (isPrivileged) {
      const fetchMarketingStaff = async () => {
        try {
          const res = await fetch(`${API_BASE}/v1/marketing-reports/marketing-staff`, {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setMarketingStaff(data.data);
            if (data.data.length > 0 && !selectedUserId) {
              setSelectedUserId(data.data[0]._id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch marketing staff list:", e);
        }
      };
      fetchMarketingStaff();
    }
  }, [isPrivileged, getAuthHeaders, selectedUserId]);

  // Fetch submitted dates
  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/marketing-reports/submitted-dates?userId=${userId}`, {
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

  // Fetch Marketing report data
  const fetchReport = async (userId, dateStr) => {
    if (!userId || !dateStr) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/v1/marketing-reports/by-date?userId=${userId}&dateString=${dateStr}`, {
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

        setTaskSummary(report.taskSummary || []);
        setKeyNumbers(report.keyNumbers || []);
        setBlockersTomorrowPlan(report.blockersTomorrowPlan || []);
        setApproval(report.approval || {});
      } else {
        initializeBlankReport(userId, dateStr);
        // Auto-fetch completed tasks for new blank reports
        try {
          const completedTasks = await fetchCompletedTasks(userId, dateStr);
          if (completedTasks && completedTasks.length > 0) {
            const mappedTasks = completedTasks.map(t => ({
              task: t.title,
              dueDate: t.dueDate || '',
              startDate: t.startDate || t.startTime || t.startDateTimeLocal || '',
              endDate: t.endDate || t.endTime || t.endDateTimeLocal || '',
              detailsNotes: t.description || 'Auto-fetched',
              status: t.status || 'Pending',
              remarks: ''
            }));
            setTaskSummary(mappedTasks);
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
            const mappedTasks = completedTasks.map(t => ({
              task: t.title,
              dueDate: t.dueDate || '',
              startDate: t.startDate || t.startTime || t.startDateTimeLocal || '',
              endDate: t.endDate || t.endTime || t.endDateTimeLocal || '',
              detailsNotes: t.description || 'Auto-fetched',
              status: t.status || 'Pending',
              remarks: ''
            }));
            setTaskSummary(mappedTasks);
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
        localStorage.setItem(`cachedBasicDetails_Marketing_${selectedUserId}`, JSON.stringify(persistent));
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
    if (isPrivileged && marketingStaff.length > 0) {
      userDetail = marketingStaff.find(u => (u._id || u.id) === userId) || freshestUser;
    }

    const dateObj = new Date(dateStr);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDateString = dateObj.toLocaleDateString('en-GB').replace(/\//g, '/'); // DD/MM/YYYY

    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    // Load from cache if exists
    const cached = localStorage.getItem(`cachedBasicDetails_Marketing_${userId}`);
    const parsedCached = cached ? JSON.parse(cached) : null;

    setBasicDetails({
      employeeName: userDetail.name || parsedCached?.employeeName || '',
      employeeId: userDetail.employeeId || parsedCached?.employeeId || '',
      designation: userDetail.designationName || userDetail.designation || parsedCached?.designation || 'Digital Marketer',
      reportingTo: userDetail.reportingManager || parsedCached?.reportingTo || 'CMO',
      date: formattedDateString,
      day: dayName.toLowerCase(),
      shiftTiming: parsedCached?.shiftTiming || '9:00 AM – 6:00 PM',
      preparedTime: parsedCached?.preparedTime || timeStr
    });

    setTaskSummary(DEFAULT_TASK_SUMMARY);
    setKeyNumbers(DEFAULT_KPI_TRACKING);
    setBlockersTomorrowPlan(DEFAULT_BLOCKERS_PLAN);
    setApproval({
      staffName: userDetail.name || '',
      staffSignature: '',
      submittedAt: timeStr,
      leaderName: '',
      leaderApproval: '',
      approvedOn: ''
    });
  };

  const handleSaveReport = async () => {
    try {
      setSaving(true);

      const cleanTaskSummary = taskSummary.filter(t => (t.task || '').trim() !== '' || (t.detailsNotes || '').trim() !== '');
      const cleanBlockersTomorrowPlan = blockersTomorrowPlan.filter(b => (b.blockersToday || '').trim() !== '' || (b.tomorrowMainTask || '').trim() !== '');

      const excludedSections = Object.entries(hiddenSections).filter(([_, h]) => h).map(([k]) => k);

      const payload = {
        userId: selectedUserId,
        dateString: selectedDate,
        basicDetails,
        taskSummary: cleanTaskSummary,
        keyNumbers,
        blockersTomorrowPlan: cleanBlockersTomorrowPlan,
        approval,
        excludedSections,
        hiddenSections
      };

      const res = await fetch(`${API_BASE}/v1/marketing-reports`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Marketing Daily Report saved successfully!", 'success');
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
    const reportType = 'marketing';
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

  const handleTaskChange = (index, field, value) => {
    const updated = [...taskSummary];
    updated[index][field] = value;
    setTaskSummary(updated);
  };

  const addTaskRow = () => {
    setTaskSummary([
      ...taskSummary,
      { task: '', detailsNotes: '', status: '', dueDate: '', startDate: '', endDate: '', remarks: '' }
    ]);
  };

  const removeTaskRow = (index) => {
    const updated = taskSummary.filter((_, idx) => idx !== index);
    setTaskSummary(updated);
  };

  const handleBlockerChange = (index, field, value) => {
    const updated = [...blockersTomorrowPlan];
    updated[index][field] = value;
    setBlockersTomorrowPlan(updated);
  };

  const addBlockerRow = () => {
    setBlockersTomorrowPlan([
      ...blockersTomorrowPlan,
      { blockersToday: '', priority: '', tomorrowMainTask: '', notes: '' }
    ]);
  };

  const removeBlockerRow = (index) => {
    const updated = blockersTomorrowPlan.filter((_, idx) => idx !== index);
    setBlockersTomorrowPlan(updated);
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
                  Marketing Daily Report
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fill, review, and download digital marketer shift reports.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Weekly Report
                </button>

                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-all"
                >
                  <Calendar size={16} />
                  Monthly Report
                </button>

                

                <AiAnalyzeButton
                  onClick={() => {
                    setAiModalContext({
                      employeeName: basicDetails.employeeName,
                      department: 'Marketing & Digital Strategy',
                      designation: basicDetails.designation,
                      date: selectedDate,
                      actualReportContentText: JSON.stringify({ basicDetails, taskSummary, keyNumbers, blockersTomorrowPlan, marketingComments: comments })
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
              title="Marketing Report AI Analysis"
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
                    value={basicDetails.preparedTime || ''}
                    onChange={(e) => setBasicDetails({ ...basicDetails, preparedTime: e.target.value })}
                    readOnly={!isEditingBasic}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isEditingBasic ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  />
                </div>
              </div>
            </div>

            {/* 2. TASK SUMMARY */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">2</span>
                  Task Summary
                </h2>
                <button
                  type="button"
                  onClick={addTaskRow}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 dark:hover:text-lime-500 uppercase tracking-wider"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[35%] min-w-[280px]">Task</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Due Date</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Start Date</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">End Date</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/3">Details / Notes</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-32">Status</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Remarks</th>
                      <th className="px-3 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {taskSummary.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.task || ''}
                            onChange={(e) => handleTaskChange(idx, 'task', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            placeholder="e.g. Stories uploaded"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.dueDate || ''}
                            onChange={(e) => handleTaskChange(idx, 'dueDate', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            placeholder="Due date"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.startDate || ''}
                            onChange={(e) => handleTaskChange(idx, 'startDate', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            placeholder="DD-MM-YYYY HH:mm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.endDate || ''}
                            onChange={(e) => handleTaskChange(idx, 'endDate', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            placeholder="DD-MM-YYYY HH:mm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.detailsNotes || ''}
                            onChange={(e) => handleTaskChange(idx, 'detailsNotes', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.status || ''}
                            onChange={(e) => handleTaskChange(idx, 'status', e.target.value)}
                            className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.remarks || ''}
                            onChange={(e) => handleTaskChange(idx, 'remarks', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeTaskRow(idx)}
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

            {/* 3. KEY NUMBERS (KPIs) */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">3</span>
                Key Numbers (KPIs)
              </h2>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/4">KPI</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/4">Target</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/4">Achieved Today</th>
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {keyNumbers.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.kpi}</td>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={item.target || ''}
                            onChange={(e) => {
                              const updated = [...keyNumbers];
                              updated[idx].target = e.target.value;
                              setKeyNumbers(updated);
                            }}
                            className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={item.achievedToday || ''}
                            onChange={(e) => {
                              const updated = [...keyNumbers];
                              updated[idx].achievedToday = e.target.value;
                              setKeyNumbers(updated);
                            }}
                            className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => {
                              const updated = [...keyNumbers];
                              updated[idx].notes = e.target.value;
                              setKeyNumbers(updated);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. BLOCKERS & TOMORROW'S PLAN */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">4</span>
                  Blockers & Tomorrow's Plan
                </h2>
                <button
                  type="button"
                  onClick={addBlockerRow}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 dark:hover:text-lime-500 uppercase tracking-wider"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Any blockers today?</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">Priority</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tomorrow's main task</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notes</th>
                      <th className="px-3 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {blockersTomorrowPlan.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.blockersToday || ''}
                            onChange={(e) => handleBlockerChange(idx, 'blockersToday', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            placeholder="e.g. None"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.priority || ''}
                            onChange={(e) => handleBlockerChange(idx, 'priority', e.target.value)}
                            className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                            placeholder="High / Med / Low"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.tomorrowMainTask || ''}
                            onChange={(e) => handleBlockerChange(idx, 'tomorrowMainTask', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleBlockerChange(idx, 'notes', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeBlockerRow(idx)}
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

            {/* 5. APPROVAL */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-lime-950/50 text-[10px]">5</span>
                Approval Sign-Offs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-200/50 dark:border-slate-800/50">
                    Staff Verification
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Staff Name</label>
                    <input
                      type="text"
                      value={approval.staffName || ''}
                      onChange={(e) => setApproval({ ...approval, staffName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Staff Signature</label>
                    <SignatureUpload
                      value={approval.staffSignature || ''}
                      onChange={(val) => setApproval({ ...approval, staffSignature: val })}
                      placeholder="Upload staff signature"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Submitted At</label>
                    <input
                      type="text"
                      value={approval.submittedAt || ''}
                      onChange={(e) => setApproval({ ...approval, submittedAt: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-200/50 dark:border-slate-800/50">
                    Team Leader Approval
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Team Leader Name</label>
                    <input
                      type="text"
                      value={approval.leaderName || ''}
                      onChange={(e) => setApproval({ ...approval, leaderName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Team Leader Approval Signature</label>
                    <SignatureUpload
                      value={approval.leaderApproval || ''}
                      onChange={(val) => setApproval({ ...approval, leaderApproval: val })}
                      placeholder="Upload leader signature"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Approved On Date</label>
                    <input
                      type="text"
                      value={approval.approvedOn || ''}
                      onChange={(e) => setApproval({ ...approval, approvedOn: e.target.value })}
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

      {/* Monthly Consolidation Modal */}
      <AnimatePresence>
        {isMonthlyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm pt-10 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden mb-10 text-slate-900 dark:text-white"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="text-indigo-600 dark:text-lime-400" size={20} />
                    Monthly Report Consolidation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                    Consolidate daily reports into a monthly overview.
                  </p>
                </div>
                <button
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  <Plus className="rotate-45" size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Date Selection Range */}
                <div className="flex flex-wrap items-end gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
                  <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Start Date</label>
                    <input
                      type="date"
                      value={monthlyStartDate}
                      onChange={(e) => setMonthlyStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 font-sans">End Date</label>
                    <input
                      type="date"
                      value={monthlyEndDate}
                      onChange={(e) => setMonthlyEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchMonthlyData}
                    disabled={isMonthlyLoading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isMonthlyLoading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Fetch & Consolidate
                  </button>
                </div>

                {monthlyTaskSummary.length > 0 && (
                  <div className="space-y-4">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => setMonthlyActiveTab('taskSummary')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                          monthlyActiveTab === 'taskSummary'
                            ? 'border-indigo-600 text-indigo-600 dark:border-lime-400 dark:text-lime-400'
                            : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        Task Summary
                      </button>
                      <button
                        onClick={() => setMonthlyActiveTab('keyNumbers')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                          monthlyActiveTab === 'keyNumbers'
                            ? 'border-indigo-600 text-indigo-600 dark:border-lime-400 dark:text-lime-400'
                            : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        Key Numbers (KPIs)
                      </button>
                      <button
                        onClick={() => setMonthlyActiveTab('blockersTomorrowPlan')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                          monthlyActiveTab === 'blockersTomorrowPlan'
                            ? 'border-indigo-600 text-indigo-600 dark:border-lime-400 dark:text-lime-400'
                            : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        Blockers & Next Plan
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-slate-950/10 min-h-[300px]">
                      {monthlyActiveTab === 'taskSummary' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Edit Consolidated Tasks</h4>
                            <button
                              type="button"
                              onClick={addMonthlyTaskRow}
                              className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 dark:hover:text-lime-500 uppercase tracking-wider"
                            >
                              <Plus size={14} /> Add Row
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                              <thead className="bg-slate-50 dark:bg-slate-950">
                                <tr>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[35%] min-w-[280px]">Task</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Due Date</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Start Date</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">End Date</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/3">Details / Notes</th>
                                  <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-28">Status</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Remarks</th>
                                  <th className="px-2 py-2 text-center w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {monthlyTaskSummary.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.task || ''}
                                        onChange={(e) => handleMonthlyTaskChange(idx, 'task', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.dueDate || ''}
                                        onChange={(e) => handleMonthlyTaskChange(idx, 'dueDate', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                        placeholder="Due date"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.startDate || ''}
                                        onChange={(e) => handleMonthlyTaskChange(idx, 'startDate', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                        placeholder="Start date"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.endDate || ''}
                                        onChange={(e) => handleMonthlyTaskChange(idx, 'endDate', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                        placeholder="End date"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <textarea
                                        rows={2}
                                        value={item.detailsNotes || ''}
                                        onChange={(e) => handleMonthlyTaskChange(idx, 'detailsNotes', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200 resize-y"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.status || ''}
                                        onChange={(e) => handleMonthlyTaskChange(idx, 'status', e.target.value)}
                                        className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.remarks || ''}
                                        onChange={(e) => handleMonthlyTaskChange(idx, 'remarks', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => removeMonthlyTaskRow(idx)}
                                        className="text-rose-500 hover:text-rose-600 transition"
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

                      {monthlyActiveTab === 'keyNumbers' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Edit Consolidated KPI Metrics</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                              <thead className="bg-slate-50 dark:bg-slate-950">
                                <tr>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/4">KPI</th>
                                  <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/4">Target (Sum/Avg)</th>
                                  <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-1/4">Achieved Today</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {monthlyKeyNumbers.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-2 font-semibold text-xs text-slate-700 dark:text-slate-300">{item.kpi}</td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.target || ''}
                                        onChange={(e) => handleMonthlyKPIChange(idx, 'target', e.target.value)}
                                        className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.achievedToday || ''}
                                        onChange={(e) => handleMonthlyKPIChange(idx, 'achievedToday', e.target.value)}
                                        className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.notes || ''}
                                        onChange={(e) => handleMonthlyKPIChange(idx, 'notes', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {monthlyActiveTab === 'blockersTomorrowPlan' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Edit Consolidated Blockers & Next Plans</h4>
                            <button
                              type="button"
                              onClick={addMonthlyBlockerRow}
                              className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-lime-400 dark:hover:text-lime-500 uppercase tracking-wider"
                            >
                              <Plus size={14} /> Add Row
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                              <thead className="bg-slate-50 dark:bg-slate-950">
                                <tr>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Any blockers?</th>
                                  <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-28">Priority</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Next main tasks</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notes</th>
                                  <th className="px-2 py-2 text-center w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {monthlyBlockersTomorrowPlan.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.blockersToday || ''}
                                        onChange={(e) => handleMonthlyBlockerChange(idx, 'blockersToday', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.priority || ''}
                                        onChange={(e) => handleMonthlyBlockerChange(idx, 'priority', e.target.value)}
                                        className="w-full text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.tomorrowMainTask || ''}
                                        onChange={(e) => handleMonthlyBlockerChange(idx, 'tomorrowMainTask', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={item.notes || ''}
                                        onChange={(e) => handleMonthlyBlockerChange(idx, 'notes', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => removeMonthlyBlockerRow(idx)}
                                        className="text-rose-500 hover:text-rose-600 transition"
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
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <button
                  type="button"
                  onClick={() => setIsMonthlyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 font-semibold text-sm transition-all"
                >
                  Close
                </button>
                {monthlyTaskSummary.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadMonthlyPDF}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10"
                  >
                    <Download size={16} />
                    Download Monthly PDF
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
        {isWeeklyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm pt-10 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden mb-10 text-slate-900 dark:text-white"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="text-indigo-600 dark:text-lime-400" size={20} />
                    Weekly Report Consolidation
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Select a date range to consolidate marketing reports into a single weekly report.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Date Filter & Consolidate Controls */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/10 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={weeklyStartDate}
                    onChange={(e) => setWeeklyStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={weeklyEndDate}
                    onChange={(e) => setWeeklyEndDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={handleFetchWeeklyData}
                    disabled={isWeeklyLoading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
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

              {/* Modal Body / Tab View */}
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800 pb-3 gap-2 scrollbar-none">
                  {[
                    { id: 'basic', label: '1. Basic Details' },
                    { id: 'taskSummary', label: '2. Task Summary' },
                    { id: 'keyNumbers', label: '3. Key Numbers (KPIs)' },
                    { id: 'blockers', label: '4. Blockers & Next Plan' },
                    { id: 'summary', label: '5. Achievements & Planning' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setWeeklyActiveTab(tab.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        weeklyActiveTab === tab.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                          : 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Contents */}
                {weeklyActiveTab === 'basic' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Employee Name</label>
                      <input
                        type="text"
                        value={weeklyBasicDetails.employeeName || ''}
                        onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, employeeName: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Employee ID</label>
                      <input
                        type="text"
                        value={weeklyBasicDetails.employeeId || ''}
                        onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, employeeId: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Designation</label>
                      <input
                        type="text"
                        value={weeklyBasicDetails.designation || ''}
                        onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, designation: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reporting To</label>
                      <input
                        type="text"
                        value={weeklyBasicDetails.reportingTo || ''}
                        onChange={(e) => setWeeklyBasicDetails({ ...weeklyBasicDetails, reportingTo: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200"
                      />
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'taskSummary' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consolidated Task Summary</h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-3 py-2.5">Task</th>
                            <th className="px-3 py-2.5">Details / Notes</th>
                            <th className="px-3 py-2.5 w-24 text-center">Status</th>
                            <th className="px-3 py-2.5">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {weeklyTaskSummary.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.task || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyTaskSummary];
                                    updated[idx].task = e.target.value;
                                    setWeeklyTaskSummary(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <textarea
                                  value={item.detailsNotes || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyTaskSummary];
                                    updated[idx].detailsNotes = e.target.value;
                                    setWeeklyTaskSummary(updated);
                                  }}
                                  rows={1}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none resize-y"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <select
                                  value={item.status || 'Done'}
                                  onChange={(e) => {
                                    const updated = [...weeklyTaskSummary];
                                    updated[idx].status = e.target.value;
                                    setWeeklyTaskSummary(updated);
                                  }}
                                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-center"
                                >
                                  <option value="Done">Done</option>
                                  <option value="Ongoing">Ongoing</option>
                                  <option value="Pending">Pending</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.remarks || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyTaskSummary];
                                    updated[idx].remarks = e.target.value;
                                    setWeeklyTaskSummary(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'keyNumbers' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consolidated KPIs (Key Numbers)</h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-3 py-2.5">KPI</th>
                            <th className="px-3 py-2.5 w-32 text-center">Target (Aggregated)</th>
                            <th className="px-3 py-2.5 w-32 text-center">Achieved (Aggregated)</th>
                            <th className="px-3 py-2.5">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {weeklyKeyNumbers.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{item.kpi}</td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="text"
                                  value={item.target || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyKeyNumbers];
                                    updated[idx].target = e.target.value;
                                    setWeeklyKeyNumbers(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-center focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="text"
                                  value={item.achievedToday || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyKeyNumbers];
                                    updated[idx].achievedToday = e.target.value;
                                    setWeeklyKeyNumbers(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-center focus:outline-none font-bold text-indigo-600 dark:text-lime-400"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.notes || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyKeyNumbers];
                                    updated[idx].notes = e.target.value;
                                    setWeeklyKeyNumbers(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'blockers' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consolidated Blockers & Next Plans</h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-3 py-2.5">Blockers</th>
                            <th className="px-3 py-2.5 w-24 text-center">Priority</th>
                            <th className="px-3 py-2.5">Next Main Task</th>
                            <th className="px-3 py-2.5">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {weeklyBlockersTomorrowPlan.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.blockersToday || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyBlockersTomorrowPlan];
                                    updated[idx].blockersToday = e.target.value;
                                    setWeeklyBlockersTomorrowPlan(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <select
                                  value={item.priority || 'Medium'}
                                  onChange={(e) => {
                                    const updated = [...weeklyBlockersTomorrowPlan];
                                    updated[idx].priority = e.target.value;
                                    setWeeklyBlockersTomorrowPlan(updated);
                                  }}
                                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-center"
                                >
                                  <option value="High">High</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Low">Low</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.tomorrowMainTask || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyBlockersTomorrowPlan];
                                    updated[idx].tomorrowMainTask = e.target.value;
                                    setWeeklyBlockersTomorrowPlan(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.notes || ''}
                                  onChange={(e) => {
                                    const updated = [...weeklyBlockersTomorrowPlan];
                                    updated[idx].notes = e.target.value;
                                    setWeeklyBlockersTomorrowPlan(updated);
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {weeklyActiveTab === 'summary' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest mb-2">Achievements</label>
                      <textarea
                        value={weeklyAchievements}
                        onChange={(e) => setWeeklyAchievements(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                        placeholder="Enter key achievements during this week..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest mb-2">Improvements Needed</label>
                      <textarea
                        value={weeklyImprovements}
                        onChange={(e) => setWeeklyImprovements(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                        placeholder="Enter areas for improvement..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-widest mb-2">Next Week Planning</label>
                      <textarea
                        value={weeklyNextWeekPlanning}
                        onChange={(e) => setWeeklyNextWeekPlanning(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-y"
                        placeholder="Enter plans and goals for next week..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 font-semibold text-sm transition-all"
                >
                  Close
                </button>
                {weeklyTaskSummary.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadWeeklyPDF}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/10"
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

export default MarketingReportPage;
