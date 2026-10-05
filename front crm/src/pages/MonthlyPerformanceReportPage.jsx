import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, FileText, Plus, Trash2, Save, Download, RefreshCw, 
  CheckCircle, AlertTriangle, ArrowLeft, ShieldCheck, UserCheck, Award, Loader2, Send, Sparkles, TrendingUp, DollarSign, Users
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

const getISTMonthBounds = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const formatIST = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  return {
    start: formatIST(firstDay),
    end: formatIST(lastDay)
  };
};

const getISTToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export default function MonthlyPerformanceReportPage() {
  const navigate = useNavigate();
  const { user } = useUser();

  const defaultBounds = getISTMonthBounds();
  const [startDate, setStartDate] = useState(defaultBounds.start);
  const [endDate, setEndDate] = useState(defaultBounds.end);
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

  const isMdUser = user?.role === 'Super Admin' || user?.role === 'MD' || user?.designation?.toLowerCase().includes('director') || user?.designation?.toLowerCase().includes('managing');

  // Form State
  const [reportId, setReportId] = useState(null);
  const [basicDetails, setBasicDetails] = useState({
    monthYear: new Date(defaultBounds.start).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    employeeName: user?.name || '',
    designation: user?.designationName || user?.designation || '',
    employeeId: user?.employeeId || '',
    department: user?.departmentName || user?.department || '',
    hodTeamLead: user?.reportingManager || user?.name || '',
    totalTeamMembers: '1'
  });

  const [overallKpiSummary, setOverallKpiSummary] = useState([]);
  const [keyAchievements, setKeyAchievements] = useState([]);
  const [projectCampaignStatus, setProjectCampaignStatus] = useState([]);
  const [financialSummary, setFinancialSummary] = useState([
    { particulars: 'Revenue Billed', amountCount: '', remarks: '' },
    { particulars: 'Revenue Received', amountCount: '', remarks: '' },
    { particulars: 'Expenses / Ad Spend', amountCount: '', remarks: '' },
    { particulars: 'Receivables / Pending', amountCount: '', remarks: '' },
    { particulars: 'Profit / Contribution', amountCount: '', remarks: '' }
  ]);
  const [teamHrOperationalSummary, setTeamHrOperationalSummary] = useState([
    { metric: 'Headcount / Active Staff', countResult: '', remarks: '' },
    { metric: 'Attendance / Productivity', countResult: '', remarks: '' },
    { metric: 'Leaves / WFH', countResult: '', remarks: '' },
    { metric: 'New Joiners / Exits', countResult: '', remarks: '' },
    { metric: 'Major Operational Issues', countResult: '', remarks: '' }
  ]);
  const [nextMonthPlan, setNextMonthPlan] = useState([]);
  const [studentLeadsSummary, setStudentLeadsSummary] = useState([]);
  const [clientLeadsSummary, setClientLeadsSummary] = useState([]);

  const [hodSubmission, setHodSubmission] = useState({
    submittedBy: user?.name || '',
    date: getISTToday(),
    hodComments: ''
  });

  const [mdApproval, setMdApproval] = useState({
    mdCommentsDirection: '',
    correctiveActionsDecisions: '',
    mdName: '',
    mdNameSignature: '',
    approvalDate: ''
  });

  const [reportStatus, setReportStatus] = useState('Submitted');

  // Fetch report on date change
  const fetchReport = async () => {
    try {
      setLoading(true);
      setMessage({ text: '', type: '' });
      const res = await axios.get(`${API_URL}/v1/monthly-performance-reports/get?startDate=${startDate}&endDate=${endDate}`, { headers: getAuthHeaders() });
      if (res.data && res.data.success) {
        if (res.data.data) {
          const r = res.data.data;
          setReportId(r._id);
          if (r.basicDetails) setBasicDetails(r.basicDetails);
          setOverallKpiSummary(r.overallKpiSummary || []);
          setKeyAchievements(r.keyAchievements || []);
          setProjectCampaignStatus(r.projectCampaignStatus || []);
          if (Array.isArray(r.financialSummary) && r.financialSummary.length > 0) setFinancialSummary(r.financialSummary);
          if (Array.isArray(r.teamHrOperationalSummary) && r.teamHrOperationalSummary.length > 0) setTeamHrOperationalSummary(r.teamHrOperationalSummary);
          setNextMonthPlan(r.nextMonthPlan || []);
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
      console.error('Failed to fetch monthly report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

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

  // Auto-Compile from Daily Shift Reports
  const handleAutoCompile = async () => {
    try {
      setCompiling(true);
      setMessage({ text: 'Auto-compiling from month daily shift reports...', type: 'info' });
      const res = await axios.get(`${API_URL}/v1/monthly-performance-reports/compile?startDate=${startDate}&endDate=${endDate}`, { headers: getAuthHeaders() });
      if (res.data && res.data.success && res.data.data) {
        const d = res.data.data;
        if (d.basicDetails) setBasicDetails(d.basicDetails);
        setOverallKpiSummary(d.overallKpiSummary || []);
        setKeyAchievements(d.keyAchievements || []);
        setProjectCampaignStatus(d.projectCampaignStatus || []);
        if (Array.isArray(d.financialSummary) && d.financialSummary.length > 0) setFinancialSummary(d.financialSummary);
        if (Array.isArray(d.teamHrOperationalSummary) && d.teamHrOperationalSummary.length > 0) setTeamHrOperationalSummary(d.teamHrOperationalSummary);
        setNextMonthPlan(d.nextMonthPlan || []);
        setStudentLeadsSummary(d.studentLeadsSummary || []);
        setClientLeadsSummary(d.clientLeadsSummary || []);
        if (d.hodSubmission) setHodSubmission(d.hodSubmission);
        if (d.mdApproval) setMdApproval(d.mdApproval);
        setMessage({ text: 'Successfully compiled monthly performance report from daily shift entries!', type: 'success' });
      }
    } catch (err) {
      console.error('Failed to auto compile monthly report:', err);
      setMessage({ text: 'Failed to auto-compile monthly data.', type: 'error' });
    } finally {
      setCompiling(false);
    }
  };

  // Generate Vector PDF (Matching exact Monthly Performance Report paper layout)
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
    const reportTitleText = isCounselorRole ? "ACADEMIC COUNSELOR MONTHLY PERFORMANCE REPORT" : "MONTHLY PERFORMANCE REPORT";
    doc.setFontSize(isCounselorRole ? 11 : 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(reportTitleText, isCounselorRole ? 65 : 82, 16);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text("Performance | Insight | Next Level | Management Review", 82, 21);

    currentY = 27;

    // 1. BASIC DETAILS
    drawSectionHeader("1. BASIC DETAILS", 35);
    const detailsRows = [
      ["Employee Name", basicDetails.employeeName || user?.name || ''],
      ["Designation", basicDetails.designation || ''],
      ["Employee ID", basicDetails.employeeId || ''],
      ["Month / Year", basicDetails.monthYear || ''],
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

    // 2. OVERALL KPI SUMMARY
    drawSectionHeader("2. OVERALL KPI SUMMARY", 30);
    const kpiHeaders = [["KPI / Key Metric", "Monthly Target", "Actual Achieved", "Achievement %", "Status / Trend"]];
    const kpiRows = (overallKpiSummary.length ? overallKpiSummary : [{ kpi: '-', monthlyTarget: '-', actual: '-', achievementPct: '-', statusTrend: '-' }]).map(k => [
      k.kpi || '',
      k.monthlyTarget || '',
      k.actual || '',
      k.achievementPct || '',
      k.statusTrend || ''
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
        4: { width: 37 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 3. KEY ACHIEVEMENTS & BUSINESS IMPACT
    drawSectionHeader("3. KEY ACHIEVEMENTS & BUSINESS IMPACT", 25);
    const achHeaders = [["Achievement", "Evidence / Business Impact"]];
    const achRows = (keyAchievements.length ? keyAchievements : [{ achievement: '-', evidenceImpact: '-' }]).map(a => [
      a.achievement || '',
      a.evidenceImpact || ''
    ]);

    autoTable(doc, {
      head: achHeaders,
      body: achRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { width: 80 },
        1: { width: 102 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 4. PROJECT / CAMPAIGN / DELIVERY STATUS
    drawSectionHeader("4. PROJECT / CAMPAIGN / DELIVERY STATUS", 30);
    const projHeaders = [["Project / Campaign", "Planned", "Actual / %", "Status", "Client / Owner", "Remarks"]];
    const projRows = (projectCampaignStatus.length ? projectCampaignStatus : [{ projectCampaign: '-', planned: '-', actualPct: '-', status: '-', clientOwner: '-', remarks: '-' }]).map(p => [
      p.projectCampaign || '',
      p.planned || '',
      p.actualPct || '',
      p.status || '',
      p.clientOwner || '',
      p.remarks || ''
    ]);

    autoTable(doc, {
      head: projHeaders,
      body: projRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { width: 45 },
        1: { width: 25, halign: 'center' },
        2: { width: 25, halign: 'center' },
        3: { width: 25, halign: 'center', fontStyle: 'bold' },
        4: { width: 30 },
        5: { width: 32 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // LEAD INTELLIGENCE SECTION (For Academic Counselors / Telecallers)
    if (isCounselorRole) {
      drawSectionHeader("LEAD INTELLIGENCE & CONSOLIDATION SUMMARY", 30);
      
      const leadHeaders = [["Lead Category / Activity", "Monthly Total", "Remarks"]];
      const combinedLeadRows = [
        ...studentLeadsSummary.map(s => [`[Student] ${s.activity}`, s.monthlyTotal, s.remarks || '']),
        ...clientLeadsSummary.map(c => [`[Client] ${c.activity}`, c.monthlyTotal, c.remarks || ''])
      ];

      autoTable(doc, {
        head: leadHeaders,
        body: combinedLeadRows.length ? combinedLeadRows : [["No lead records logged", "-", "-"]],
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
        columnStyles: {
          0: { width: 75, fontStyle: 'bold' },
          1: { width: 35, halign: 'center' },
          2: { width: 72 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 4;
    }

    // 5. FINANCIAL / COMMERCIAL SUMMARY
    drawSectionHeader("5. FINANCIAL / COMMERCIAL SUMMARY", 25);
    const finHeaders = [["Particulars", "Amount / Count", "Remarks"]];
    const finRows = (financialSummary.length ? financialSummary : [{ particulars: '-', amountCount: '-', remarks: '-' }]).map(f => [
      f.particulars || '',
      f.amountCount || '',
      f.remarks || ''
    ]);

    autoTable(doc, {
      head: finHeaders,
      body: finRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { width: 60, fontStyle: 'bold' },
        1: { width: 45, halign: 'center' },
        2: { width: 77 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 6. TEAM / HR & OPERATIONAL SUMMARY
    drawSectionHeader("6. TEAM / HR & OPERATIONAL SUMMARY", 25);
    const hrHeaders = [["Metric", "Count / Result", "Remarks"]];
    const hrRows = (teamHrOperationalSummary.length ? teamHrOperationalSummary : [{ metric: '-', countResult: '-', remarks: '-' }]).map(h => [
      h.metric || '',
      h.countResult || '',
      h.remarks || ''
    ]);

    autoTable(doc, {
      head: hrHeaders,
      body: hrRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.15 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { width: 60, fontStyle: 'bold' },
        1: { width: 45, halign: 'center' },
        2: { width: 77 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 7. NEXT MONTH PLAN
    drawSectionHeader("7. NEXT MONTH PLAN", 25);
    const planHeaders = [["Priority / Objective", "Owner", "Target Result", "Deadline"]];
    const planRows = (nextMonthPlan.length ? nextMonthPlan : [{ priorityObjective: '-', owner: '-', targetResult: '-', deadline: '-' }]).map(p => [
      p.priorityObjective || '',
      p.owner || '',
      p.targetResult || '',
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
        0: { width: 45, fontStyle: 'bold' },
        1: { width: 35 },
        2: { width: 70 },
        3: { width: 32, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 8. HOD COMMENTS & SUBMISSION
    drawSectionHeader("8. HOD COMMENTS & SUBMISSION", 25);
    const hodRows = [
      ["Submitted By", hodSubmission.submittedBy || basicDetails.hodTeamLead || ''],
      ["Submission Date", hodSubmission.date || endDate],
      ["HOD Comments / Explanation", hodSubmission.hodComments || '']
    ];

    autoTable(doc, {
      body: hodRows,
      startY: currentY,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.15 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [245, 245, 247], width: 55 },
        1: { width: 127 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 9. MD APPROVAL & COMMENTS
    drawSectionHeader("9. MD APPROVAL & COMMENTS", 25);
    const mdRows = [
      ["MD Comments / Strategic Direction", mdApproval.mdCommentsDirection || ''],
      ["Corrective Actions / Decisions", mdApproval.correctiveActionsDecisions || ''],
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
              console.error('Failed to add MD signature image to monthly PDF:', e);
            }
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    // Tagline: "Clear Goals. Stronger Teams. Bigger Futures."
    currentY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('"Clear Goals. Stronger Teams. Bigger Futures."', 105, currentY, { align: 'center' });

    // Add Page Numbers and Official Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(`KOD.BRAND Digital Marketing Solutions Pvt Ltd | Official CRM Reporting Template`, 14, 287);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${totalPages}`, 196, 287, { align: 'right' });
    }

    return doc;
  };

  // UNIFIED BUTTON ACTION: Submit & Save Report
  const handleSubmitAndSaveReport = async () => {
    try {
      setSaving(true);
      setMessage({ text: 'Saving monthly performance report to system...', type: 'info' });
      
      const payload = {
        monthStartDate: startDate,
        monthEndDate: endDate,
        basicDetails,
        overallKpiSummary,
        keyAchievements,
        projectCampaignStatus,
        financialSummary,
        teamHrOperationalSummary,
        nextMonthPlan,
        studentLeadsSummary,
        clientLeadsSummary,
        hodSubmission,
        mdApproval,
        status: reportStatus || 'Submitted'
      };

      // 1. Save JSON report data into CRM system database
      const res = await axios.post(`${API_URL}/v1/monthly-performance-reports/save`, payload, { headers: getAuthHeaders() });
      if (res.data && res.data.success && res.data.data?._id) {
        setReportId(res.data.data._id);
      }

      setMessage({ text: 'Generating vector PDF for system download & Employee Reports upload...', type: 'info' });

      // 2. Generate crisp vector PDF
      const doc = await generateNativePDF();

      const isCounselorRole = isAcademicCounselor;
      const reportPrefix = isCounselorRole ? 'Academic_Counselor_Monthly_Report' : 'Monthly_Performance_Report';
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
          await uploadCompiledPDFReport(targetUserId, endDate, pdfBlob, filename, 'monthly_performance', 'monthly');
        } catch (uploadErr) {
          console.error('Failed to upload compiled PDF to Employee Reports:', uploadErr);
        }
      }

      setMessage({ 
        text: '🎉 Monthly Performance Report saved to system, downloaded to device, and uploaded to Employee Reports successfully!', 
        type: 'success' 
      });
    } catch (err) {
      console.error('Error submitting and saving monthly report:', err);
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
      const res = await axios.post(`${API_URL}/v1/monthly-performance-reports/md-approval`, {
        reportId,
        mdCommentsDirection: mdApproval.mdCommentsDirection,
        correctiveActionsDecisions: mdApproval.correctiveActionsDecisions,
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
      {/* Top Action Bar */}
      <div className="no-print mb-6 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/weekly-performance-report')}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            title="Back to Weekly Performance Report"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Award className="w-6 h-6 text-indigo-500" />
              {isAcademicCounselor ? "Academic Counselor Monthly Performance Report" : "Monthly Performance Report"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Performance | Insight | Next Level | Management Review</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Range Date Pickers */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-600 dark:text-slate-400">Month Range:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent border-none text-slate-800 dark:text-slate-200 font-bold focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent border-none text-slate-800 dark:text-slate-200 font-bold focus:outline-none"
            />
          </div>

          <button
            onClick={handleAutoCompile}
            disabled={compiling}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Auto compile monthly data from 30-day shift reports"
          >
            {compiling ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>Auto-Compile 30-Days</span>
          </button>

          <button
            onClick={handleSubmitAndSaveReport}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>Submit & Save Report</span>
          </button>
        </div>
      </div>

      {/* Alert / Notification Bar */}
      {message.text && (
        <div className={`max-w-7xl mx-auto mb-6 p-4 rounded-xl flex items-center justify-between text-xs font-bold shadow-sm ${
          message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
          'bg-indigo-50 text-indigo-700 border border-indigo-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ text: '', type: '' })} className="underline text-slate-500 cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Main Document Body */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10 space-y-8">
        
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo3.png" alt="KOD.BRAND" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                {isAcademicCounselor ? "ACADEMIC COUNSELOR MONTHLY PERFORMANCE REPORT" : "MONTHLY PERFORMANCE REPORT"}
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                Month: {basicDetails.monthYear || `${startDate} to ${endDate}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
              reportStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              {reportStatus}
            </span>
          </div>
        </div>

        {/* SECTION 1: BASIC DETAILS */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
              <h2 className="text-xs font-black uppercase tracking-wider">BASIC DETAILS</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 text-xs">
            <div>
              <label className="block font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1">Employee Name</label>
              <input 
                type="text" 
                value={basicDetails.employeeName || ''} 
                onChange={e => setBasicDetails(prev => ({ ...prev, employeeName: e.target.value }))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-bold"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1">Designation</label>
              <input 
                type="text" 
                value={basicDetails.designation || ''} 
                onChange={e => setBasicDetails(prev => ({ ...prev, designation: e.target.value }))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-bold"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1">Employee ID</label>
              <input 
                type="text" 
                value={basicDetails.employeeId || ''} 
                onChange={e => setBasicDetails(prev => ({ ...prev, employeeId: e.target.value }))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-bold"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1">Month / Year</label>
              <input 
                type="text" 
                value={basicDetails.monthYear} 
                onChange={e => setBasicDetails(prev => ({ ...prev, monthYear: e.target.value }))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-bold"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1">Department</label>
              <input 
                type="text" 
                value={basicDetails.department} 
                onChange={e => setBasicDetails(prev => ({ ...prev, department: e.target.value }))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-bold"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1">HOD / Team Lead</label>
              <input 
                type="text" 
                value={basicDetails.hodTeamLead} 
                onChange={e => setBasicDetails(prev => ({ ...prev, hodTeamLead: e.target.value }))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-bold"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1">Total Team Members</label>
              <input 
                type="text" 
                value={basicDetails.totalTeamMembers} 
                onChange={e => setBasicDetails(prev => ({ ...prev, totalTeamMembers: e.target.value }))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-bold"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: OVERALL KPI SUMMARY */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
              <h2 className="text-xs font-black uppercase tracking-wider">OVERALL KPI SUMMARY</h2>
            </div>
            <button 
              onClick={() => setOverallKpiSummary([...overallKpiSummary, { kpi: '', monthlyTarget: '', actual: '', achievementPct: '', statusTrend: 'On Track' }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add KPI
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700">KPI / Key Metric</th>
                  <th className="p-2.5 border-r border-slate-700 w-32 text-center">Monthly Target</th>
                  <th className="p-2.5 border-r border-slate-700 w-32 text-center">Actual Achieved</th>
                  <th className="p-2.5 border-r border-slate-700 w-32 text-center">Achievement %</th>
                  <th className="p-2.5 border-r border-slate-700 w-36 text-center">Status / Trend</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {overallKpiSummary.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-slate-400 font-medium">
                      No KPIs logged. Click <span className="font-bold text-indigo-500">Auto-Compile 30-Days</span> or <span className="font-bold text-indigo-500">+ Add KPI</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  overallKpiSummary.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-bold">
                        <input 
                          type="text" 
                          value={row.kpi} 
                          onChange={e => {
                            const updated = [...overallKpiSummary];
                            updated[index].kpi = e.target.value;
                            setOverallKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none font-bold text-slate-800 dark:text-slate-200"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="text" 
                          value={row.monthlyTarget} 
                          onChange={e => {
                            const updated = [...overallKpiSummary];
                            updated[index].monthlyTarget = e.target.value;
                            setOverallKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-semibold"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="text" 
                          value={row.actual} 
                          onChange={e => {
                            const updated = [...overallKpiSummary];
                            updated[index].actual = e.target.value;
                            setOverallKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-semibold"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center font-black">
                        <input 
                          type="text" 
                          value={row.achievementPct} 
                          onChange={e => {
                            const updated = [...overallKpiSummary];
                            updated[index].achievementPct = e.target.value;
                            setOverallKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-black text-indigo-600 dark:text-indigo-400"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="text" 
                          value={row.statusTrend} 
                          onChange={e => {
                            const updated = [...overallKpiSummary];
                            updated[index].statusTrend = e.target.value;
                            setOverallKpiSummary(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-bold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => setOverallKpiSummary(overallKpiSummary.filter((_, i) => i !== index))}
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

        {/* SECTION 3: KEY ACHIEVEMENTS & BUSINESS IMPACT */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
              <h2 className="text-xs font-black uppercase tracking-wider">KEY ACHIEVEMENTS & BUSINESS IMPACT</h2>
            </div>
            <button 
              onClick={() => setKeyAchievements([...keyAchievements, { achievement: '', evidenceImpact: '' }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Achievement
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700 w-1/2">Achievement</th>
                  <th className="p-2.5 border-r border-slate-700 w-1/2">Evidence / Business Impact</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {keyAchievements.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-slate-400 font-medium">
                      No achievements logged. Click <span className="font-bold text-indigo-500">+ Add Achievement</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  keyAchievements.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-bold">
                        <input 
                          type="text" 
                          value={row.achievement} 
                          onChange={e => {
                            const updated = [...keyAchievements];
                            updated[index].achievement = e.target.value;
                            setKeyAchievements(updated);
                          }}
                          className="w-full bg-transparent border-none font-bold text-slate-800 dark:text-slate-200"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.evidenceImpact} 
                          onChange={e => {
                            const updated = [...keyAchievements];
                            updated[index].evidenceImpact = e.target.value;
                            setKeyAchievements(updated);
                          }}
                          className="w-full bg-transparent border-none font-medium text-slate-700 dark:text-slate-300"
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

        {/* SECTION 4: PROJECT / CAMPAIGN / DELIVERY STATUS */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">4</span>
              <h2 className="text-xs font-black uppercase tracking-wider">PROJECT / CAMPAIGN / DELIVERY STATUS</h2>
            </div>
            <button 
              onClick={() => setProjectCampaignStatus([...projectCampaignStatus, { projectCampaign: '', planned: '', actualPct: '', status: 'In Progress', clientOwner: '', remarks: '' }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Project
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700">Project / Campaign</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Planned</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Actual / %</th>
                  <th className="p-2.5 border-r border-slate-700 w-32 text-center">Status</th>
                  <th className="p-2.5 border-r border-slate-700 w-36">Client / Owner</th>
                  <th className="p-2.5 border-r border-slate-700">Remarks</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projectCampaignStatus.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-4 text-center text-slate-400 font-medium">
                      No project status logged. Click <span className="font-bold text-indigo-500">Auto-Compile 30-Days</span> or <span className="font-bold text-indigo-500">+ Add Project</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  projectCampaignStatus.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-bold">
                        <input 
                          type="text" 
                          value={row.projectCampaign} 
                          onChange={e => {
                            const updated = [...projectCampaignStatus];
                            updated[index].projectCampaign = e.target.value;
                            setProjectCampaignStatus(updated);
                          }}
                          className="w-full bg-transparent border-none font-bold"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="text" 
                          value={row.planned} 
                          onChange={e => {
                            const updated = [...projectCampaignStatus];
                            updated[index].planned = e.target.value;
                            setProjectCampaignStatus(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-medium"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="text" 
                          value={row.actualPct} 
                          onChange={e => {
                            const updated = [...projectCampaignStatus];
                            updated[index].actualPct = e.target.value;
                            setProjectCampaignStatus(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-bold"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <select
                          value={row.status}
                          onChange={e => {
                            const updated = [...projectCampaignStatus];
                            updated[index].status = e.target.value;
                            setProjectCampaignStatus(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-bold cursor-pointer"
                        >
                          <option value="Completed">Completed</option>
                          <option value="In Progress">In Progress</option>
                          <option value="On Hold">On Hold</option>
                          <option value="Delayed">Delayed</option>
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.clientOwner} 
                          onChange={e => {
                            const updated = [...projectCampaignStatus];
                            updated[index].clientOwner = e.target.value;
                            setProjectCampaignStatus(updated);
                          }}
                          className="w-full bg-transparent border-none font-medium"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.remarks} 
                          onChange={e => {
                            const updated = [...projectCampaignStatus];
                            updated[index].remarks = e.target.value;
                            setProjectCampaignStatus(updated);
                          }}
                          className="w-full bg-transparent border-none font-medium"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => setProjectCampaignStatus(projectCampaignStatus.filter((_, i) => i !== index))}
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

        {/* LEAD INTELLIGENCE & CONSOLIDATION (For Academic Counselors / Telecallers) */}
        {isAcademicCounselor && (
          <div className="space-y-6 pt-2">
            <div>
              <div className="flex items-center justify-between mb-3 bg-indigo-900 text-white px-4 py-2 rounded-lg shadow-xs">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-xs font-black uppercase tracking-wider">STUDENT LEADS MONTHLY CONSOLIDATION</h2>
                </div>
                <button 
                  onClick={() => setStudentLeadsSummary([...studentLeadsSummary, { activity: '', monthlyTotal: '0', remarks: '' }])}
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
                      <th className="p-2.5 border-r border-indigo-800 w-32 text-center">Monthly Total</th>
                      <th className="p-2.5 border-r border-indigo-800">Remarks</th>
                      <th className="p-2.5 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-100 dark:divide-slate-800">
                    {studentLeadsSummary.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400 font-medium">
                          No student lead metrics logged. Click <span className="font-bold text-indigo-500">Auto-Compile 30-Days</span> or <span className="font-bold text-indigo-500">+ Add Metric</span> to insert entries.
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
                              value={row.monthlyTotal} 
                              onChange={e => {
                                const updated = [...studentLeadsSummary];
                                updated[index].monthlyTotal = e.target.value;
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

            <div>
              <div className="flex items-center justify-between mb-3 bg-teal-900 text-white px-4 py-2 rounded-lg shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-teal-400" />
                  <h2 className="text-xs font-black uppercase tracking-wider">CLIENT LEADS MONTHLY CONSOLIDATION</h2>
                </div>
                <button 
                  onClick={() => setClientLeadsSummary([...clientLeadsSummary, { activity: '', monthlyTotal: '0', remarks: '' }])}
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
                      <th className="p-2.5 border-r border-teal-800 w-32 text-center">Monthly Total</th>
                      <th className="p-2.5 border-r border-teal-800">Remarks</th>
                      <th className="p-2.5 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100 dark:divide-slate-800">
                    {clientLeadsSummary.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400 font-medium">
                          No client lead metrics logged. Click <span className="font-bold text-teal-500">Auto-Compile 30-Days</span> or <span className="font-bold text-teal-500">+ Add Metric</span> to insert entries.
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
                              value={row.monthlyTotal} 
                              onChange={e => {
                                const updated = [...clientLeadsSummary];
                                updated[index].monthlyTotal = e.target.value;
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
        )}

        {/* SECTION 5: FINANCIAL / COMMERCIAL SUMMARY */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">5</span>
              <h2 className="text-xs font-black uppercase tracking-wider">FINANCIAL / COMMERCIAL SUMMARY (WHERE APPLICABLE)</h2>
            </div>
            <button 
              onClick={() => setFinancialSummary([...financialSummary, { particulars: '', amountCount: '', remarks: '' }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700 w-1/3">Particulars</th>
                  <th className="p-2.5 border-r border-slate-700 w-1/4 text-center">Amount / Count</th>
                  <th className="p-2.5 border-r border-slate-700">Remarks</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {financialSummary.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-bold">
                      <input 
                        type="text" 
                        value={row.particulars} 
                        onChange={e => {
                          const updated = [...financialSummary];
                          updated[index].particulars = e.target.value;
                          setFinancialSummary(updated);
                        }}
                        className="w-full bg-transparent border-none font-bold"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                      <input 
                        type="text" 
                        value={row.amountCount} 
                        onChange={e => {
                          const updated = [...financialSummary];
                          updated[index].amountCount = e.target.value;
                          setFinancialSummary(updated);
                        }}
                        className="w-full bg-transparent border-none text-center font-bold text-emerald-600 dark:text-emerald-400"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                      <input 
                        type="text" 
                        value={row.remarks} 
                        onChange={e => {
                          const updated = [...financialSummary];
                          updated[index].remarks = e.target.value;
                          setFinancialSummary(updated);
                        }}
                        className="w-full bg-transparent border-none font-medium"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => setFinancialSummary(financialSummary.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
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

        {/* SECTION 6: TEAM / HR & OPERATIONAL SUMMARY */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">6</span>
              <h2 className="text-xs font-black uppercase tracking-wider">TEAM / HR & OPERATIONAL SUMMARY</h2>
            </div>
            <button 
              onClick={() => setTeamHrOperationalSummary([...teamHrOperationalSummary, { metric: '', countResult: '', remarks: '' }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Metric
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700 w-1/3">Metric</th>
                  <th className="p-2.5 border-r border-slate-700 w-1/4 text-center">Count / Result</th>
                  <th className="p-2.5 border-r border-slate-700">Remarks</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {teamHrOperationalSummary.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-bold">
                      <input 
                        type="text" 
                        value={row.metric} 
                        onChange={e => {
                          const updated = [...teamHrOperationalSummary];
                          updated[index].metric = e.target.value;
                          setTeamHrOperationalSummary(updated);
                        }}
                        className="w-full bg-transparent border-none font-bold"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                      <input 
                        type="text" 
                        value={row.countResult} 
                        onChange={e => {
                          const updated = [...teamHrOperationalSummary];
                          updated[index].countResult = e.target.value;
                          setTeamHrOperationalSummary(updated);
                        }}
                        className="w-full bg-transparent border-none text-center font-semibold"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                      <input 
                        type="text" 
                        value={row.remarks} 
                        onChange={e => {
                          const updated = [...teamHrOperationalSummary];
                          updated[index].remarks = e.target.value;
                          setTeamHrOperationalSummary(updated);
                        }}
                        className="w-full bg-transparent border-none font-medium"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => setTeamHrOperationalSummary(teamHrOperationalSummary.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
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

        {/* SECTION 7: NEXT MONTH PLAN */}
        <div>
          <div className="flex items-center justify-between mb-3 bg-slate-800 text-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded bg-slate-600 text-white font-black text-xs flex items-center justify-center shrink-0">7</span>
              <h2 className="text-xs font-black uppercase tracking-wider">NEXT MONTH PLAN</h2>
            </div>
            <button 
              onClick={() => setNextMonthPlan([...nextMonthPlan, { priorityObjective: 'High', owner: user?.name || '', targetResult: '', deadline: endDate }])}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Objective
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-extrabold uppercase border-b border-slate-700">
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Priority</th>
                  <th className="p-2.5 border-r border-slate-700 w-32">Owner</th>
                  <th className="p-2.5 border-r border-slate-700">Target Result</th>
                  <th className="p-2.5 border-r border-slate-700 w-28 text-center">Deadline</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nextMonthPlan.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-slate-400 font-medium">
                      No plan logged yet. Click <span className="font-bold text-indigo-500">Auto-Compile 30-Days</span> or <span className="font-bold text-indigo-500">+ Add Objective</span> to insert entries.
                    </td>
                  </tr>
                ) : (
                  nextMonthPlan.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <select
                          value={row.priorityObjective}
                          onChange={e => {
                            const updated = [...nextMonthPlan];
                            updated[index].priorityObjective = e.target.value;
                            setNextMonthPlan(updated);
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
                            const updated = [...nextMonthPlan];
                            updated[index].owner = e.target.value;
                            setNextMonthPlan(updated);
                          }}
                          className="w-full bg-transparent border-none font-bold"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                        <input 
                          type="text" 
                          value={row.targetResult} 
                          onChange={e => {
                            const updated = [...nextMonthPlan];
                            updated[index].targetResult = e.target.value;
                            setNextMonthPlan(updated);
                          }}
                          className="w-full bg-transparent border-none font-medium"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input 
                          type="date" 
                          value={row.deadline} 
                          onChange={e => {
                            const updated = [...nextMonthPlan];
                            updated[index].deadline = e.target.value;
                            setNextMonthPlan(updated);
                          }}
                          className="w-full bg-transparent border-none text-center font-medium"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => setNextMonthPlan(nextMonthPlan.filter((_, i) => i !== index))}
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
          {/* SECTION 8: HOD COMMENTS & SUBMISSION */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-700">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                8. HOD COMMENTS & SUBMISSION
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
                  <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Submission Date</label>
                  <input 
                    type="date" 
                    value={hodSubmission.date} 
                    onChange={e => setHodSubmission(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">HOD Comments / Explanation</label>
                <textarea 
                  rows="3"
                  value={hodSubmission.hodComments} 
                  onChange={e => setHodSubmission(prev => ({ ...prev, hodComments: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* SECTION 9: MD APPROVAL & COMMENTS */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-700">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                9. MD APPROVAL & COMMENTS
              </h2>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">MD Comments / Strategic Direction</label>
                <textarea 
                  rows="2"
                  readOnly={!isMdUser}
                  value={mdApproval.mdCommentsDirection || ''} 
                  onChange={e => setMdApproval(prev => ({ ...prev, mdCommentsDirection: e.target.value }))}
                  placeholder={isMdUser ? "Enter strategic direction and guidance..." : "MD feedback will appear here."}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] mb-1">Corrective Actions / Decisions</label>
                <textarea 
                  rows="2"
                  readOnly={!isMdUser}
                  value={mdApproval.correctiveActionsDecisions || ''} 
                  onChange={e => setMdApproval(prev => ({ ...prev, correctiveActionsDecisions: e.target.value }))}
                  placeholder={isMdUser ? "Enter required corrective actions..." : "MD decisions will appear here."}
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
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0 w-full sm:w-auto"
            title="Saves report to system, downloads PDF to your computer, and uploads to Employee Reports"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            <span>Submit & Save Report</span>
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400 font-medium">
          KOD.BRAND Digital Marketing Solutions Pvt Ltd • Official CRM Reporting Template
        </div>
      </div>
    </div>
  );
}
