import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar, FileText, Plus, PlusCircle, Trash2, Save, Download, RefreshCw, 
  CheckCircle, AlertTriangle, ArrowLeft, ShieldCheck, UserCheck, Layers, Award, Loader2, Send, CheckCircle2, Pencil, Sparkles, TrendingUp, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUser } from '../contexts/UserContext';
import { uploadCompiledPDFReport } from '../services/departmentService';
import SignatureUpload from '../components/SignatureUpload';

const RAW_API_URL = import.meta.env?.VITE_API_URL || import.meta.env?.REACT_APP_API_URL || '/api';
const API_URL = RAW_API_URL.replace(/\/v1\/?$/, '').replace(/\/+$/, '');

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem('token');
  const token = rawToken ? rawToken.replace(/"/g, '') : '';
  return {
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

const getISTDateStr = (offsetDays = 0) => {
  const d = new Date();
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
};

// Helper to group rows by project (Task / Project Name)
const getProjectGroups = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const groups = [];
  let currentGroup = null;

  rows.forEach((row, index) => {
    const rawName = (row.taskProject || row.taskActivity || '').trim();

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

export default function WeeklyPerformanceReportPage() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [startDate, setStartDate] = useState(getISTDateStr(-6));
  const [endDate, setEndDate] = useState(getISTDateStr(0));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Academic Counselor Designation Check
  const isAcademicCounselor = useMemo(() => {
    const desig = (user?.designationName || user?.designation || '').toLowerCase().trim();
    const dept = (user?.departmentName || user?.department || '').toLowerCase().trim();
    return desig.includes('counselor') || desig.includes('telecaller') || dept.includes('counselor') || dept.includes('academic');
  }, [user]);

  // 8-Section Weekly Report State - Fully Dynamic Initial State
  const [reportId, setReportId] = useState(null);
  const [basicDetails, setBasicDetails] = useState({
    weekPeriod: `${getISTDateStr(-6)} to ${getISTDateStr(0)}`,
    employeeName: user?.name || '',
    designation: user?.designationName || user?.designation || '',
    employeeId: user?.employeeId || '',
    department: user?.departmentName || user?.department || '',
    hodTeamLead: user?.reportingManager || user?.name || '',
    totalTeamMembers: '1'
  });

  const [weeklyKpiSummary, setWeeklyKpiSummary] = useState([]);
  const [keyAchievements, setKeyAchievements] = useState([]);
  const [majorTasksProjects, setMajorTasksProjects] = useState([]);
  const [challengesSupport, setChallengesSupport] = useState([]);
  const [nextWeekPlan, setNextWeekPlan] = useState([]);

  // Academic Counselor Extension States
  const [studentLeadsSummary, setStudentLeadsSummary] = useState([]);
  const [clientLeadsSummary, setClientLeadsSummary] = useState([]);

  const [hodSubmission, setHodSubmission] = useState({
    submittedBy: user?.name || '',
    date: getISTDateStr(0),
    hodComments: ''
  });

  const [mdApproval, setMdApproval] = useState({
    mdCommentsDirection: '',
    priorityDecisionsApprovals: '',
    mdName: '',
    mdNameSignature: '',
    approvalDate: ''
  });

  const [reportStatus, setReportStatus] = useState('Submitted');

  const isMdUser = user?.role === 'Super Admin' || user?.role === 'MD' || user?.designation?.toLowerCase().includes('director') || user?.designation?.toLowerCase().includes('managing');

  // Helpers for Major Tasks / Projects grouping
  const handleProjectNameChangeWeekly = (group, newName) => {
    setMajorTasksProjects(prev => {
      const updated = [...prev];
      group.rows.forEach(r => {
        updated[r.originalIndex] = {
          ...updated[r.originalIndex],
          taskProject: newName
        };
      });
      return updated;
    });
  };

  const addNewProjectWeekly = () => {
    setMajorTasksProjects(prev => {
      const existingGroups = getProjectGroups(prev);
      const projectNum = existingGroups.length + 1;
      const newProjectName = `New Project ${projectNum}`;
      return [
        ...prev,
        { taskProject: newProjectName, plannedDate: '', actualCurrent: '', status: 'In Progress', ownerRemarks: '' }
      ];
    });
  };

  const addTaskToProjectWeekly = (projectName = '', insertAfterIndex = -1) => {
    setMajorTasksProjects(prev => {
      const updated = [...prev];
      let targetName = projectName;
      if (!targetName && updated.length > 0) {
        targetName = updated[updated.length - 1].taskProject || '';
      }
      const newRow = {
        taskProject: targetName,
        plannedDate: '',
        actualCurrent: '',
        status: 'In Progress',
        ownerRemarks: ''
      };

      if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0 && insertAfterIndex < updated.length) {
        updated.splice(insertAfterIndex + 1, 0, newRow);
      } else {
        updated.push(newRow);
      }
      return updated;
    });
  };

  // Sync basic details when user loads
  useEffect(() => {
    if (user) {
      setBasicDetails(prev => ({
        ...prev,
        employeeName: prev.employeeName || user.name || '',
        designation: prev.designation || user.designationName || user.designation || '',
        employeeId: prev.employeeId || user.employeeId || '',
        department: prev.department || user.departmentName || user.department || '',
        hodTeamLead: prev.hodTeamLead || user.reportingManager || user.name || ''
      }));
      setHodSubmission(prev => ({
        ...prev,
        submittedBy: prev.submittedBy || user.name || ''
      }));
    }
  }, [user]);

  // Fetch report on date change
  const fetchReport = async () => {
    try {
      setLoading(true);
      setMessage({ text: '', type: '' });
      const res = await axios.get(`${API_URL}/v1/weekly-performance-reports/get?startDate=${startDate}&endDate=${endDate}`, { headers: getAuthHeaders() });
      if (res.data && res.data.success) {
        if (res.data.data) {
          const r = res.data.data;
          setReportId(r._id);
          if (r.basicDetails) setBasicDetails(r.basicDetails);
          setWeeklyKpiSummary(r.weeklyKpiSummary || []);
          setKeyAchievements(r.keyAchievements || []);
          setMajorTasksProjects(r.majorTasksProjects || []);
          setChallengesSupport(r.challengesSupport || []);
          setNextWeekPlan(r.nextWeekPlan || []);
          setStudentLeadsSummary(r.studentLeadsSummary || []);
          setClientLeadsSummary(r.clientLeadsSummary || []);
          if (r.hodSubmission) setHodSubmission(r.hodSubmission);
          if (r.mdApproval) setMdApproval(r.mdApproval);
          if (r.status) setReportStatus(r.status);
        } else {
          setReportId(null);
          if (res.data.defaultBasicDetails) {
            setBasicDetails(prev => ({ ...prev, ...res.data.defaultBasicDetails }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch weekly report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  // Auto-Compile from Daily Shift Reports
  const handleAutoCompile = async () => {
    try {
      setCompiling(true);
      setMessage({ text: 'Auto-compiling from 7-day shift reports...', type: 'info' });
      const res = await axios.get(`${API_URL}/v1/weekly-performance-reports/compile?startDate=${startDate}&endDate=${endDate}`, { headers: getAuthHeaders() });
      if (res.data && res.data.success && res.data.data) {
        const d = res.data.data;
        if (d.basicDetails) setBasicDetails(d.basicDetails);
        setWeeklyKpiSummary(d.weeklyKpiSummary || []);
        setKeyAchievements(d.keyAchievements || []);
        setMajorTasksProjects(d.majorTasksProjects || []);
        setChallengesSupport(d.challengesSupport || []);
        setNextWeekPlan(d.nextWeekPlan || []);
        setStudentLeadsSummary(d.studentLeadsSummary || []);
        setClientLeadsSummary(d.clientLeadsSummary || []);
        if (d.hodSubmission) setHodSubmission(d.hodSubmission);
        if (d.mdApproval) setMdApproval(d.mdApproval);
        setMessage({ text: 'Successfully compiled report from 7-day daily shift entries!', type: 'success' });
      }
    } catch (err) {
      console.error('Failed to auto compile:', err);
      setMessage({ text: 'Failed to auto-compile data. Please try again.', type: 'error' });
    } finally {
      setCompiling(false);
    }
  };

  // Generate Vector PDF (Matching exact Daily Shift Report PDF layout & styling)
  const generateNativePDF = async () => {
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

    // Header Logo
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

    // Document Title
    const isCounselorRole = isAcademicCounselor;
    const reportTitleText = isCounselorRole ? "ACADEMIC COUNSELOR WEEKLY PERFORMANCE REPORT" : "WEEKLY PERFORMANCE REPORT";
    doc.setFontSize(isCounselorRole ? 12 : 14);
    doc.setTextColor(30, 41, 59);
    doc.text(reportTitleText, isCounselorRole ? 68 : 85, 17);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${basicDetails.weekPeriod || `${startDate} to ${endDate}`}`, 85, 22);

    currentY = 27;

    // 1. BASIC DETAILS
    drawSectionHeader("1. BASIC DETAILS", 35);
    const detailsRows = [
      ["Employee Name", basicDetails.employeeName || user?.name || ''],
      ["Designation", basicDetails.designation || ''],
      ["Employee ID", basicDetails.employeeId || ''],
      ["Week Period", basicDetails.weekPeriod || `${startDate} to ${endDate}`],
      ["Department", basicDetails.department || ''],
      ["HOD / Team Lead", basicDetails.hodTeamLead || ''],
      ["Total Team Members", basicDetails.totalTeamMembers || '1']
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

    // 2. WEEKLY KPI SUMMARY
    drawSectionHeader("2. WEEKLY KPI SUMMARY", 30);
    const kpiHeaders = [["KPI / Key Metric", "Weekly Target", "Actual Achieved", "Achievement %", "Trend / Status"]];
    const kpiRows = (weeklyKpiSummary.length ? weeklyKpiSummary : [{ kpi: '-', weeklyTarget: '-', actual: '-', achievementPct: '-', trendStatus: '-' }]).map(k => [
      k.kpi || '',
      k.weeklyTarget || '',
      k.actual || '',
      k.achievementPct || '',
      k.trendStatus || ''
    ]);

    autoTable(doc, {
      head: kpiHeaders,
      body: kpiRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { width: 55 },
        1: { width: 30, halign: 'center' },
        2: { width: 30, halign: 'center' },
        3: { width: 30, halign: 'center', fontStyle: 'bold' },
        4: { width: 37, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // ACADEMIC COUNSELOR LEAD PIPELINE PERFORMANCE (IF APPLICABLE)
    if (isAcademicCounselor) {
      drawSectionHeader("ACADEMIC COUNSELOR 7-DAY LEADS PIPELINE SUMMARY", 30);
      
      if (studentLeadsSummary.length > 0) {
        const stHeaders = [["Student Lead Activity", "Weekly Total Count", "Remarks"]];
        const stRows = studentLeadsSummary.map(s => [s.activity || '', s.weeklyTotal || '0', s.remarks || '']);
        autoTable(doc, {
          head: stHeaders,
          body: stRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { width: 75, fontStyle: 'bold' },
            1: { width: 30, halign: 'center', fontStyle: 'bold' },
            2: { width: 77 }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 4;
      }

      if (clientLeadsSummary.length > 0) {
        const clHeaders = [["Client Lead Activity", "Weekly Total Count", "Remarks"]];
        const clRows = clientLeadsSummary.map(c => [c.activity || '', c.weeklyTotal || '0', c.remarks || '']);
        autoTable(doc, {
          head: clHeaders,
          body: clRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
          styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
          columnStyles: {
            0: { width: 75, fontStyle: 'bold' },
            1: { width: 30, halign: 'center', fontStyle: 'bold' },
            2: { width: 77 }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 4;
      }
    }

    // 3. KEY ACHIEVEMENTS & BUSINESS IMPACT
    drawSectionHeader("3. KEY ACHIEVEMENTS & BUSINESS IMPACT", 30);
    const achHeaders = [["Achievement / Deliverable", "Evidence / Result / Business Impact"]];
    const achRows = (keyAchievements.length ? keyAchievements : [{ achievement: '-', evidenceResultImpact: '-' }]).map(a => [
      a.achievement || '',
      a.evidenceResultImpact || ''
    ]);

    autoTable(doc, {
      head: achHeaders,
      body: achRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { width: 90 },
        1: { width: 92 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 4. MAJOR TASKS / PROJECTS
    drawSectionHeader("4. MAJOR TASKS / PROJECTS", 30);
    const taskHeaders = [["Task / Project Name", "Planned Date", "Actual / Current Output", "Status", "Owner / Remarks"]];
    const taskRows = [];
    const projectGroupsWeekly = getProjectGroups(majorTasksProjects);

    if (projectGroupsWeekly.length === 0) {
      taskRows.push(['-', '-', '-', '-', '-']);
    } else {
      projectGroupsWeekly.forEach(group => {
        group.rows.forEach((t, gIdx) => {
          if (gIdx === 0) {
            taskRows.push([
              { content: group.projectName || t.taskProject || '', rowSpan: group.rows.length },
              t.plannedDate || '',
              t.actualCurrent || '',
              t.status || '',
              t.ownerRemarks || ''
            ]);
          } else {
            taskRows.push([
              t.plannedDate || '',
              t.actualCurrent || '',
              t.status || '',
              t.ownerRemarks || ''
            ]);
          }
        });
      });
    }

    autoTable(doc, {
      head: taskHeaders,
      body: taskRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15, overflow: 'linebreak' },
      columnStyles: {
        0: { width: 50 },
        1: { width: 25, halign: 'center' },
        2: { width: 45 },
        3: { width: 25, halign: 'center', fontStyle: 'bold' },
        4: { width: 37 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 5. CHALLENGES / SUPPORT NEEDED
    drawSectionHeader("5. CHALLENGES / SUPPORT NEEDED", 30);
    const chalHeaders = [["Issue / Challenge", "Business Impact", "Support / Decision Required", "Resolution Date"]];
    const chalRows = (challengesSupport.length ? challengesSupport : [{ issueChallenge: '-', impact: '-', supportRequired: '-', resolutionDate: '-' }]).map(c => [
      c.issueChallenge || '',
      c.impact || '',
      c.supportRequired || '',
      c.resolutionDate || ''
    ]);

    autoTable(doc, {
      head: chalHeaders,
      body: chalRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { width: 45 },
        1: { width: 50 },
        2: { width: 55 },
        3: { width: 32, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 6. NEXT WEEK EXECUTION PLAN
    drawSectionHeader("6. NEXT WEEK EXECUTION PLAN", 30);
    const planHeaders = [["Priority", "Owner", "Target / Expected Result", "Deadline"]];
    const planRows = (nextWeekPlan.length ? nextWeekPlan : [{ priority: '-', owner: '-', targetExpectedResult: '-', deadline: '-' }]).map(p => [
      p.priority || '',
      p.owner || '',
      p.targetExpectedResult || '',
      p.deadline || ''
    ]);

    autoTable(doc, {
      head: planHeaders,
      body: planRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { width: 25, halign: 'center', fontStyle: 'bold' },
        1: { width: 35 },
        2: { width: 90 },
        3: { width: 32, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 7. HOD SUBMISSION & COMMENTS
    drawSectionHeader("7. HOD SUBMISSION & COMMENTS", 25);
    const hodRows = [
      ["Submitted By", hodSubmission.submittedBy || basicDetails.hodTeamLead || ''],
      ["Submission Date", hodSubmission.date || endDate],
      ["HOD Comments / Summary", hodSubmission.hodComments || '']
    ];

    autoTable(doc, {
      body: hodRows,
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

    // 8. MD APPROVAL & COMMENTS
    drawSectionHeader("8. MD APPROVAL & COMMENTS", 25);
    const mdRows = [
      ["Priority Decisions / Approvals", mdApproval.priorityDecisionsApprovals || ''],
      ["MD Comments / Direction", mdApproval.mdCommentsDirection || ''],
      ["MD Name", mdApproval.mdName || ''],
      ["MD Signature", mdApproval.mdNameSignature ? '' : 'Not Signed'],
      ["Approval Date", mdApproval.approvalDate || '']
    ];

    autoTable(doc, {
      body: mdRows,
      startY: currentY,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 55 },
        1: { width: 127 }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 1 && data.row.index === 3) {
          const sigImg = mdApproval.mdNameSignature;
          if (sigImg && sigImg.startsWith('data:image/')) {
            data.cell.text = [];
            const x = data.cell.x + 2;
            const y = data.cell.y + 1;
            const w = Math.min(data.cell.width - 4, 35);
            const h = Math.min(data.cell.height - 2, 10);
            try {
              doc.addImage(sigImg, 'PNG', x, y, w, h);
            } catch (e) {
              console.error('Failed to add MD signature image to PDF:', e);
            }
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    // Tagline: "Review. Improve. Grow Together."
    currentY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('"Review. Improve. Grow Together."', 105, currentY, { align: 'center' });

    // Add Page Numbers and Official Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(`KOD.BRAND Digital Marketing Solutions Pvt Ltd | Official CRM Report`, 14, 287);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${totalPages}`, 196, 287, { align: 'right' });
    }

    return doc;
  };

  // UNIFIED SINGLE BUTTON ACTION: Submit & Save Report (Saves to System DB + System Device Download + Employee Reports Upload)
  const handleSubmitAndSaveReport = async () => {
    try {
      setSaving(true);
      setMessage({ text: 'Saving weekly performance report to system...', type: 'info' });
      
      const payload = {
        weekStartDate: startDate,
        weekEndDate: endDate,
        basicDetails,
        weeklyKpiSummary,
        keyAchievements,
        majorTasksProjects,
        challengesSupport,
        nextWeekPlan,
        studentLeadsSummary,
        clientLeadsSummary,
        hodSubmission,
        mdApproval,
        status: reportStatus || 'Submitted'
      };

      // 1. Save JSON report data into CRM system database
      const res = await axios.post(`${API_URL}/v1/weekly-performance-reports/save`, payload, { headers: getAuthHeaders() });
      if (res.data && res.data.success && res.data.data?._id) {
        setReportId(res.data.data._id);
      }

      setMessage({ text: 'Generating vector PDF for system download & Employee Reports upload...', type: 'info' });

      // 2. Generate crisp vector PDF (matching Daily Shift Report styling)
      const doc = await generateNativePDF();

      const isCounselorRole = isAcademicCounselor;
      const reportPrefix = isCounselorRole ? 'Academic_Counselor_Weekly_Report' : 'Weekly_Performance_Report';
      const employeeName = basicDetails.hodTeamLead || user?.name || 'Employee';
      const cleanName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${reportPrefix}_${cleanName}_${startDate}_to_${endDate}.pdf`;

      // 3. Save PDF directly to local user system device
      doc.save(filename);

      // 4. Upload PDF to Employee Reports section
      const pdfBlob = doc.output('blob');
      const targetUserId = user?._id || user?.id || localStorage.getItem('user_id') || '';
      if (targetUserId) {
        try {
          await uploadCompiledPDFReport(targetUserId, endDate, pdfBlob, filename, 'weekly_performance', 'weekly');
        } catch (uploadErr) {
          console.error('Failed to upload compiled PDF to Employee Reports:', uploadErr);
        }
      }

      setMessage({ 
        text: '🎉 Weekly Performance Report saved to system, downloaded to device, and uploaded to Employee Reports successfully!', 
        type: 'success' 
      });
    } catch (err) {
      console.error('Error submitting and saving report:', err);
      setMessage({ text: err.response?.data?.message || err.message || 'Error submitting and saving report.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Save MD Approval
  const handleMDApprovalSave = async () => {
    if (!reportId) {
      alert('Please save the report first before submitting MD approval.');
      return;
    }
    try {
      setSaving(true);
      const res = await axios.post(`${API_URL}/v1/weekly-performance-reports/md-approval`, {
        reportId,
        mdCommentsDirection: mdApproval.mdCommentsDirection,
        priorityDecisionsApprovals: mdApproval.priorityDecisionsApprovals,
        mdName: mdApproval.mdName,
        mdNameSignature: mdApproval.mdNameSignature,
        approvalDate: mdApproval.approvalDate
      }, { headers: getAuthHeaders() });
      if (res.data && res.data.success) {
        setReportStatus('Approved');
        setMessage({ text: 'MD Approval updated successfully!', type: 'success' });
      }
    } catch (err) {
      console.error('Failed to update MD approval:', err);
      setMessage({ text: 'Failed to update MD approval.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 md:p-8">
      {/* Top Action Bar (No Print) */}
      <div className="no-print mb-6 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/daily-shift-report')}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            title="Back to Daily Shift Report"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Award className="w-6 h-6 text-amber-500" />
              Weekly Performance Report
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Review | Align | Accelerate | HOD & Department Consolidated Format</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/monthly-performance-report')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg text-xs font-bold transition border border-indigo-200 dark:border-indigo-800 cursor-pointer"
            title="Go to Monthly Performance Report"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Monthly Report</span>
          </button>

          {/* Week Date Picker */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-600 dark:text-slate-300">Week:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => {
                setStartDate(e.target.value);
                setBasicDetails(prev => ({ ...prev, weekPeriod: `${e.target.value} to ${endDate}` }));
              }}
              className="bg-transparent border-none text-slate-800 dark:text-slate-100 font-medium focus:ring-0"
            />
            <span>to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => {
                setEndDate(e.target.value);
                setBasicDetails(prev => ({ ...prev, weekPeriod: `${startDate} to ${e.target.value}` }));
              }}
              className="bg-transparent border-none text-slate-800 dark:text-slate-100 font-medium focus:ring-0"
            />
          </div>

          <button
            onClick={handleAutoCompile}
            disabled={compiling}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${compiling ? 'animate-spin' : ''}`} />
            {compiling ? 'Compiling...' : 'Auto-Compile 7-Days'}
          </button>

          {/* UNIFIED SINGLE BUTTON FOR SUBMIT & SAVE */}
          <button
            onClick={handleSubmitAndSaveReport}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-extrabold shadow-md transition transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
            title="Saves report to system, downloads vector PDF to your computer, and uploads to Employee Reports"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{saving ? 'Submitting & Saving...' : 'Submit & Save Report'}</span>
          </button>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {message.text && (
        <div className={`no-print max-w-7xl mx-auto mb-4 p-3.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs ${
          message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          message.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ text: '', type: '' })} className="font-bold ml-4 text-slate-500 hover:text-slate-800">✕</button>
        </div>
      )}

      {/* ON-SCREEN PRINTABLE DOCUMENT CONTAINER (Matching Daily Shift Report paper UI) */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-xl p-6 lg:p-10 space-y-6">

        {/* LOGO & TITLE HEADER */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-slate-900 dark:border-slate-700 pb-5 gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo3.png" alt="KOD.BRAND Logo" className="h-12 sm:h-14 w-auto object-contain" />
          </div>

          <div className="text-right sm:text-right text-center">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              WEEKLY PERFORMANCE REPORT
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Review | Align | Accelerate | HOD & Department Consolidated Format
            </p>
          </div>
        </div>

        {/* SECTION 1: BASIC DETAILS */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider">BASIC DETAILS</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Employee Name</label>
              <input 
                type="text" 
                value={basicDetails.employeeName || ''} 
                onChange={e => setBasicDetails(prev => ({ ...prev, employeeName: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Designation</label>
              <input 
                type="text" 
                value={basicDetails.designation || ''} 
                onChange={e => setBasicDetails(prev => ({ ...prev, designation: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Employee ID</label>
              <input 
                type="text" 
                value={basicDetails.employeeId || ''} 
                onChange={e => setBasicDetails(prev => ({ ...prev, employeeId: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Week Period</label>
              <input 
                type="text" 
                value={basicDetails.weekPeriod} 
                onChange={e => setBasicDetails(prev => ({ ...prev, weekPeriod: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Department</label>
              <input 
                type="text" 
                value={basicDetails.department} 
                onChange={e => setBasicDetails(prev => ({ ...prev, department: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">HOD / Team Lead</label>
              <input 
                type="text" 
                value={basicDetails.hodTeamLead} 
                onChange={e => setBasicDetails(prev => ({ ...prev, hodTeamLead: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Total Team Members</label>
              <input 
                type="text" 
                value={basicDetails.totalTeamMembers} 
                onChange={e => setBasicDetails(prev => ({ ...prev, totalTeamMembers: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: WEEKLY KPI SUMMARY */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider">WEEKLY KPI SUMMARY</h2>
            </div>
            <button 
              onClick={() => setWeeklyKpiSummary([...weeklyKpiSummary, { kpi: '', weeklyTarget: '', actual: '', achievementPct: '', trendStatus: 'On Track' }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700">KPI / Key Metric</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Weekly Target</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Actual Achieved</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Achievement %</th>
                  <th className="p-2.5 border-r border-slate-700 w-32">Trend / Status</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {weeklyKpiSummary.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-slate-400 font-medium">
                      No KPIs logged yet. Click <span className="font-bold text-indigo-500">Auto-Compile 7-Days</span> or <span className="font-bold text-indigo-500">+ Add Row</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  weeklyKpiSummary.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.kpi} 
                          onChange={e => {
                            const updated = [...weeklyKpiSummary];
                            updated[index].kpi = e.target.value;
                            setWeeklyKpiSummary(updated);
                          }}
                          placeholder="e.g. Total Revenue / Completed Tasks"
                          className="w-full bg-transparent border-none font-semibold text-slate-800 dark:text-slate-200"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="text" 
                          value={row.weeklyTarget} 
                          onChange={e => {
                            const updated = [...weeklyKpiSummary];
                            updated[index].weeklyTarget = e.target.value;
                            setWeeklyKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-bold"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="text" 
                          value={row.actual} 
                          onChange={e => {
                            const updated = [...weeklyKpiSummary];
                            updated[index].actual = e.target.value;
                            setWeeklyKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-bold"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="text" 
                          value={row.achievementPct} 
                          onChange={e => {
                            const updated = [...weeklyKpiSummary];
                            updated[index].achievementPct = e.target.value;
                            setWeeklyKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-black text-emerald-600 dark:text-emerald-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <select
                          value={row.trendStatus}
                          onChange={e => {
                            const updated = [...weeklyKpiSummary];
                            updated[index].trendStatus = e.target.value;
                            setWeeklyKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none font-bold cursor-pointer"
                        >
                          <option value="On Track">On Track</option>
                          <option value="Behind Schedule">Behind Schedule</option>
                          <option value="Exceeded">Exceeded</option>
                          <option value="At Risk">At Risk</option>
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => setWeeklyKpiSummary(weeklyKpiSummary.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACADEMIC COUNSELOR LEAD PIPELINE SUMMARY SECTION (STRICTLY FOR COUNSELORS) */}
        {isAcademicCounselor && (
          <div className="space-y-6 p-6 bg-slate-900/5 dark:bg-slate-900/40 rounded-2xl border border-indigo-500/20 shadow-xs">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-xs font-black uppercase tracking-wider">
                ACADEMIC COUNSELOR 7-DAY LEADS CONSOLIDATION SUMMARY
              </h2>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* STUDENT LEADS 7-DAY SUMMARY */}
              <div>
                <div className="flex items-center justify-between mb-3 bg-indigo-900 text-white px-4 py-2 rounded-lg shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-xs font-black uppercase tracking-wider">STUDENT LEADS WEEKLY CONSOLIDATION</h2>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setStudentLeadsSummary([...studentLeadsSummary, { activity: '', weeklyTotal: '0', remarks: '' }])}
                    className="flex items-center gap-1 text-xs bg-indigo-800 hover:bg-indigo-700 px-2.5 py-1 rounded font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Metric
                  </button>
                </div>

                <div className="overflow-x-auto border border-indigo-200 dark:border-indigo-900 rounded-xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-indigo-900 text-white font-extrabold uppercase border-b border-indigo-800">
                        <th className="p-2.5 border-r border-indigo-800">Activity / Lead Metric</th>
                        <th className="p-2.5 border-r border-indigo-800 w-32 text-center">Weekly Total</th>
                        <th className="p-2.5 border-r border-indigo-800">Remarks</th>
                        <th className="p-2.5 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-100 dark:divide-slate-800">
                      {studentLeadsSummary.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-slate-400 font-medium">
                            No student lead metrics logged. Click <span className="font-bold text-indigo-500">Auto-Compile 7-Days</span> or <span className="font-bold text-indigo-500">+ Add Metric</span> to insert entries.
                          </td>
                        </tr>
                      ) : (
                        studentLeadsSummary.map((row, index) => (
                          <tr key={index} className="hover:bg-indigo-50/50 dark:hover:bg-slate-800/40">
                            <td className="p-1.5">
                              <input 
                                type="text" 
                                value={row.activity} 
                                onChange={e => {
                                  const updated = [...studentLeadsSummary];
                                  updated[index].activity = e.target.value;
                                  setStudentLeadsSummary(updated);
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <input 
                                type="text" 
                                value={row.weeklyTotal} 
                                onChange={e => {
                                  const updated = [...studentLeadsSummary];
                                  updated[index].weeklyTotal = e.target.value;
                                  setStudentLeadsSummary(updated);
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-center font-extrabold text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="text" 
                                value={row.remarks || ''} 
                                onChange={e => {
                                  const updated = [...studentLeadsSummary];
                                  updated[index].remarks = e.target.value;
                                  setStudentLeadsSummary(updated);
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200 shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <button 
                                type="button"
                                onClick={() => setStudentLeadsSummary(studentLeadsSummary.filter((_, i) => i !== index))}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CLIENT LEADS 7-DAY SUMMARY */}
              <div>
                <div className="flex items-center justify-between mb-3 bg-teal-900 text-white px-4 py-2 rounded-lg shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-teal-400" />
                    <h2 className="text-xs font-black uppercase tracking-wider">CLIENT LEADS WEEKLY CONSOLIDATION</h2>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setClientLeadsSummary([...clientLeadsSummary, { activity: '', weeklyTotal: '0', remarks: '' }])}
                    className="flex items-center gap-1 text-xs bg-teal-800 hover:bg-teal-700 px-2.5 py-1 rounded font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Metric
                  </button>
                </div>

                <div className="overflow-x-auto border border-teal-200 dark:border-teal-900 rounded-xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-teal-900 text-white font-extrabold uppercase border-b border-teal-800">
                        <th className="p-2.5 border-r border-teal-800">Activity / Lead Metric</th>
                        <th className="p-2.5 border-r border-teal-800 w-32 text-center">Weekly Total</th>
                        <th className="p-2.5 border-r border-teal-800">Remarks</th>
                        <th className="p-2.5 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-100 dark:divide-slate-800">
                      {clientLeadsSummary.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-slate-400 font-medium">
                            No client lead metrics logged. Click <span className="font-bold text-teal-500">Auto-Compile 7-Days</span> or <span className="font-bold text-teal-500">+ Add Metric</span> to insert entries.
                          </td>
                        </tr>
                      ) : (
                        clientLeadsSummary.map((row, index) => (
                          <tr key={index} className="hover:bg-teal-50/50 dark:hover:bg-slate-800/40">
                            <td className="p-1.5">
                              <input 
                                type="text" 
                                value={row.activity} 
                                onChange={e => {
                                  const updated = [...clientLeadsSummary];
                                  updated[index].activity = e.target.value;
                                  setClientLeadsSummary(updated);
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <input 
                                type="text" 
                                value={row.weeklyTotal} 
                                onChange={e => {
                                  const updated = [...clientLeadsSummary];
                                  updated[index].weeklyTotal = e.target.value;
                                  setClientLeadsSummary(updated);
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-center font-extrabold text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="text" 
                                value={row.remarks || ''} 
                                onChange={e => {
                                  const updated = [...clientLeadsSummary];
                                  updated[index].remarks = e.target.value;
                                  setClientLeadsSummary(updated);
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200 shadow-2xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <button 
                                type="button"
                                onClick={() => setClientLeadsSummary(clientLeadsSummary.filter((_, i) => i !== index))}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: KEY ACHIEVEMENTS & BUSINESS IMPACT */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider">KEY ACHIEVEMENTS & BUSINESS IMPACT</h2>
            </div>
            <button 
              onClick={() => setKeyAchievements([...keyAchievements, { achievement: '', evidenceResultImpact: '' }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700 w-1/2">Achievement / Deliverable</th>
                  <th className="p-2.5 border-r border-slate-700 w-1/2">Evidence / Result / Business Impact</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {keyAchievements.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-slate-400 font-medium">
                      No key achievements logged yet. Click <span className="font-bold text-indigo-500">Auto-Compile 7-Days</span> or <span className="font-bold text-indigo-500">+ Add Row</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  keyAchievements.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <textarea 
                          rows="2"
                          value={row.achievement} 
                          onChange={e => {
                            const updated = [...keyAchievements];
                            updated[index].achievement = e.target.value;
                            setKeyAchievements(updated);
                          }}
                          className="w-full bg-transparent border-none font-semibold text-slate-800 dark:text-slate-200 resize-y focus:outline-none"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <textarea 
                          rows="2"
                          value={row.evidenceResultImpact} 
                          onChange={e => {
                            const updated = [...keyAchievements];
                            updated[index].evidenceResultImpact = e.target.value;
                            setKeyAchievements(updated);
                          }}
                          className="w-full bg-transparent border-none font-semibold text-slate-800 dark:text-slate-200 resize-y focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => setKeyAchievements(keyAchievements.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: MAJOR TASKS / PROJECTS */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                4
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider">MAJOR TASKS / PROJECTS</h2>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700 w-36 sm:w-44">Task / Project Name</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Planned Date</th>
                  <th className="p-2.5 border-r border-slate-700">Actual / Current Output</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Status</th>
                  <th className="p-2.5 border-r border-slate-700">Owner / Remarks</th>
                  <th className="p-2.5 text-center w-28 print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {majorTasksProjects.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-slate-400 font-medium">
                      No major tasks logged yet. Click <span className="font-bold text-indigo-500">Auto-Compile 7-Days</span> or <span className="font-bold text-indigo-500">+ Add Project</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  getProjectGroups(majorTasksProjects).map((group) => {
                    return group.rows.map((row, rowInGroupIdx) => {
                      const idx = row.originalIndex;
                      const isFirstInGroup = rowInGroupIdx === 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          {isFirstInGroup && (
                            <td 
                              rowSpan={group.rows.length} 
                              className="p-2.5 border-r border-slate-200 dark:border-slate-800 align-top bg-slate-50/40 dark:bg-slate-900/40 font-bold"
                            >
                              <textarea
                                rows={Math.max(2, group.rows.length * 2)}
                                placeholder="Project Name..."
                                value={group.projectName || row.taskProject || ''}
                                onChange={(e) => handleProjectNameChangeWeekly(group, e.target.value)}
                                className="w-full bg-transparent font-bold border-none focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs resize-y"
                              />
                            </td>
                          )}
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center align-top">
                            <input 
                              type="date" 
                              value={row.plannedDate || ''} 
                              onChange={e => {
                                const updated = [...majorTasksProjects];
                                updated[idx].plannedDate = e.target.value;
                                setMajorTasksProjects(updated);
                              }}
                              className="w-full bg-transparent border-none text-center font-medium"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                            <textarea 
                              rows="2"
                              value={row.actualCurrent || ''} 
                              onChange={e => {
                                const updated = [...majorTasksProjects];
                                updated[idx].actualCurrent = e.target.value;
                                setMajorTasksProjects(updated);
                              }}
                              className="w-full bg-transparent border-none font-medium resize-y focus:outline-none"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center align-top">
                            <select
                              value={row.status || 'In Progress'}
                              onChange={e => {
                                const updated = [...majorTasksProjects];
                                updated[idx].status = e.target.value;
                                setMajorTasksProjects(updated);
                              }}
                              className="w-full bg-transparent border-none font-black cursor-pointer text-center"
                            >
                              <option value="Completed">Completed</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Delayed">Delayed</option>
                              <option value="On Hold">On Hold</option>
                            </select>
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 align-top">
                            <textarea 
                              rows="2"
                              value={row.ownerRemarks || ''} 
                              onChange={e => {
                                const updated = [...majorTasksProjects];
                                updated[idx].ownerRemarks = e.target.value;
                                setMajorTasksProjects(updated);
                              }}
                              className="w-full bg-transparent border-none font-medium resize-y focus:outline-none"
                            />
                          </td>
                          <td className="p-2 text-center print:hidden align-top whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => addTaskToProjectWeekly(group.projectName || row.taskProject, idx)}
                                className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all cursor-pointer shadow-2xs"
                                title={`Add target under ${group.projectName || 'this project'}`}
                              >
                                <Plus size={10} />  Add Target
                              </button>
                              <button 
                                type="button"
                                onClick={() => setMajorTasksProjects(majorTasksProjects.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:text-red-700 cursor-pointer p-1"
                                title="Delete row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2.5 print:hidden">
            <button
              type="button"
              onClick={addNewProjectWeekly}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <PlusCircle size={14} /> Add Project
            </button>
          </div>
        </div>

        {/* SECTION 5: CHALLENGES / SUPPORT NEEDED */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                5
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider">CHALLENGES / SUPPORT NEEDED</h2>
            </div>
            <button 
              onClick={() => setChallengesSupport([...challengesSupport, { issueChallenge: '', impact: '', supportRequired: '', resolutionDate: '' }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700">Issue / Challenge</th>
                  <th className="p-2.5 border-r border-slate-700">Business Impact</th>
                  <th className="p-2.5 border-r border-slate-700">Support / Decision Required</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Resolution Date</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {challengesSupport.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-slate-400 font-medium">
                      No challenges logged yet. Click <span className="font-bold text-indigo-500">Auto-Compile 7-Days</span> or <span className="font-bold text-indigo-500">+ Add Row</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  challengesSupport.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.issueChallenge} 
                          onChange={e => {
                            const updated = [...challengesSupport];
                            updated[index].issueChallenge = e.target.value;
                            setChallengesSupport(updated);
                          }}
                          className="w-full bg-transparent border-none font-semibold text-slate-800 dark:text-slate-200"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.impact} 
                          onChange={e => {
                            const updated = [...challengesSupport];
                            updated[index].impact = e.target.value;
                            setChallengesSupport(updated);
                          }}
                          className="w-full bg-transparent border-none font-medium"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.supportRequired} 
                          onChange={e => {
                            const updated = [...challengesSupport];
                            updated[index].supportRequired = e.target.value;
                            setChallengesSupport(updated);
                          }}
                          className="w-full bg-transparent border-none font-medium"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="date" 
                          value={row.resolutionDate} 
                          onChange={e => {
                            const updated = [...challengesSupport];
                            updated[index].resolutionDate = e.target.value;
                            setChallengesSupport(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-medium"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => setChallengesSupport(challengesSupport.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 6: NEXT WEEK EXECUTION PLAN */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                6
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider">NEXT WEEK EXECUTION PLAN</h2>
            </div>
            <button 
              onClick={() => setNextWeekPlan([...nextWeekPlan, { priority: 'Medium', owner: user?.name || '', targetExpectedResult: '', deadline: getISTDateStr(7) }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700 w-24 text-center">Priority</th>
                  <th className="p-2.5 border-r border-slate-700 w-32">Owner</th>
                  <th className="p-2.5 border-r border-slate-700">Target / Expected Result</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Deadline</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nextWeekPlan.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-slate-400 font-medium">
                      No execution plan logged yet. Click <span className="font-bold text-indigo-500">Auto-Compile 7-Days</span> or <span className="font-bold text-indigo-500">+ Add Row</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  nextWeekPlan.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <select
                          value={row.priority}
                          onChange={e => {
                            const updated = [...nextWeekPlan];
                            updated[index].priority = e.target.value;
                            setNextWeekPlan(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-black cursor-pointer"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.owner} 
                          onChange={e => {
                            const updated = [...nextWeekPlan];
                            updated[index].owner = e.target.value;
                            setNextWeekPlan(updated);
                          }}
                          className="w-full bg-transparent border-none font-bold"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.targetExpectedResult} 
                          onChange={e => {
                            const updated = [...nextWeekPlan];
                            updated[index].targetExpectedResult = e.target.value;
                            setNextWeekPlan(updated);
                          }}
                          className="w-full bg-transparent border-none font-medium"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="date" 
                          value={row.deadline} 
                          onChange={e => {
                            const updated = [...nextWeekPlan];
                            updated[index].deadline = e.target.value;
                            setNextWeekPlan(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-medium"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => setNextWeekPlan(nextWeekPlan.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TWO COLUMN GRID FOR HOD SUBMISSION & MD APPROVAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          {/* SECTION 7: HOD SUBMISSION & COMMENTS */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-700">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                7. HOD SUBMISSION & COMMENTS
              </h2>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Submitted By</label>
                  <input 
                    type="text" 
                    value={hodSubmission.submittedBy} 
                    onChange={e => setHodSubmission(prev => ({ ...prev, submittedBy: e.target.value }))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Date</label>
                  <input 
                    type="date" 
                    value={hodSubmission.date} 
                    onChange={e => setHodSubmission(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">HOD Comments / Overview</label>
                <textarea 
                  rows="3"
                  value={hodSubmission.hodComments} 
                  onChange={e => setHodSubmission(prev => ({ ...prev, hodComments: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* SECTION 8: MD APPROVAL & COMMENTS */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-700">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                8. MD APPROVAL & COMMENTS
              </h2>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Priority Decisions / Approvals</label>
                <textarea 
                  rows="2"
                  readOnly={!isMdUser}
                  value={mdApproval.priorityDecisionsApprovals || ''} 
                  onChange={e => setMdApproval(prev => ({ ...prev, priorityDecisionsApprovals: e.target.value }))}
                  placeholder={isMdUser ? "Enter key priority decisions or approvals..." : "MD priority decisions will appear here after review."}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">MD Comments / Direction</label>
                <textarea 
                  rows="2"
                  readOnly={!isMdUser}
                  value={mdApproval.mdCommentsDirection || ''} 
                  onChange={e => setMdApproval(prev => ({ ...prev, mdCommentsDirection: e.target.value }))}
                  placeholder={isMdUser ? "Enter MD feedback and instructions..." : "MD review comments will appear here after review."}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">MD Name</label>
                  <input 
                    type="text"
                    readOnly={!isMdUser}
                    value={mdApproval.mdName || ''} 
                    onChange={e => setMdApproval(prev => ({ ...prev, mdName: e.target.value }))}
                    placeholder={isMdUser ? "Enter MD Name" : "MD Name"}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Approval Date</label>
                  <input 
                    type="date"
                    readOnly={!isMdUser}
                    value={mdApproval.approvalDate || ''} 
                    onChange={e => setMdApproval(prev => ({ ...prev, approvalDate: e.target.value }))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">MD Signature (Upload Image)</label>
                <SignatureUpload 
                  value={mdApproval.mdNameSignature || ''}
                  onChange={val => setMdApproval(prev => ({ ...prev, mdNameSignature: val }))}
                  placeholder="Upload MD Signature PNG/JPG"
                  disabled={!isMdUser}
                />
              </div>
              {isMdUser && (
                <div className="pt-1 text-right">
                  <button
                    onClick={handleMDApprovalSave}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-extrabold transition shadow cursor-pointer"
                  >
                    Submit MD Review
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Document Footer & Bottom Action Bar */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Ready to submit? Clicking <span className="font-bold text-slate-700 dark:text-slate-300">Submit & Save Report</span> will save to CRM system database, download PDF to your device, and upload to Employee Reports.
          </p>
          <button
            onClick={handleSubmitAndSaveReport}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0 w-full sm:w-auto"
            title="Saves report to system, downloads PDF to your computer, and uploads to Employee Reports"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            <span>Submit & Save Report</span>
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400 font-medium">
          KOD.BRAND Internal Operating System • Weekly Performance Report Management
        </div>
      </div>
    </div>
  );
}
