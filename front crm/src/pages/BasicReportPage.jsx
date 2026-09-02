import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { uploadCompiledPDFReport } from '../services/departmentService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, Plus, Trash2, Save, Download, 
  CheckCircle, HelpCircle, Loader2, User, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft,
  X, Maximize2, Trash, ClipboardList, PenTool, BookOpen,
  MinusCircle, PlusCircle
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureUpload from '../components/SignatureUpload';
import { useNavigate } from 'react-router-dom';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

import { isUserAssigned } from '../utils/taskUtils';

const RAW_API_BASE = import.meta.env.VITE_API_URL || '/api';
const API_BASE = RAW_API_BASE.replace(/\/v1\/?$/, '').replace(/\/+$/, '');

const isRowEmpty = (item) => {
  if (!item || typeof item !== 'object') return true;
  const skipKeys = new Set(['_id', 'id', '__v']);
  return !Object.entries(item).some(([k, v]) => {
    if (skipKeys.has(k)) return false;
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
};

const DEFAULT_BLOCKERS_PLAN = {
  blockersToday: '',
  priority: 'Medium',
  tomorrowMainTask: '',
  notes: ''
};

const BasicReportPage = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [submittedDates, setSubmittedDates] = useState([]);
  
  // Form states
  const [basicDetails, setBasicDetails] = useState({
    employeeName: '',
    employeeId: '',
    designation: '',
    department: '',
    date: '',
    shiftTiming: '9:00 AM – 6:00 PM',
    preparedTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  });

  const [taskSummary, setTaskSummary] = useState([]);
  const [blockersTomorrowPlan, setBlockersTomorrowPlan] = useState(DEFAULT_BLOCKERS_PLAN);
  const [staffSignature, setStaffSignature] = useState('');

  const [hiddenSections, setHiddenSections] = useState({});
  const [selectedActivityText, setSelectedActivityText] = useState(null);

  const toggleSectionHidden = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // AI Analysis Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState(null);

  const getAuthHeaders = useCallback(() => {
    const raw = localStorage.getItem('token');
    const tk  = raw ? raw.replace(/"/g, '') : '';
    return { Authorization: tk.startsWith('Bearer ') ? tk : `Bearer ${tk}`, 'Content-Type': 'application/json' };
  }, []);

  const fetchSubmittedDates = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/employee-reports/list?userId=${userId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const dates = data.data.map(r => r.report_date).filter(Boolean);
          setSubmittedDates(dates);
        }
      }
    } catch (e) {
      console.error('Failed to fetch submitted dates:', e);
    }
  }, [getAuthHeaders]);

  // Fetch tasks and initialize report form
  useEffect(() => {
    const loadUserDataAndTasks = async () => {
      setLoading(true);
      try {
        const saved = localStorage.getItem('user');
        const userId = (localStorage.getItem('user_id') || '').replace(/"/g, '').trim();
        let userObj = {};
        if (saved) {
          try {
            userObj = JSON.parse(saved);
          } catch (e) {}
        }
        const realUserId = userObj._id || userObj.id || userId;
        userObj.user_id = realUserId;
        setCurrentUser(userObj);
        fetchSubmittedDates(realUserId);

        const deptName = userObj.departmentId?.name || userObj.department || 'General';
        const desigName = userObj.designationId?.name || userObj.designation || 'Staff';

        setBasicDetails({
          employeeName: userObj.name || 'Employee',
          employeeId: userObj.employeeId || 'N/A',
          designation: desigName,
          department: deptName,
          date: selectedDate,
          shiftTiming: '9:00 AM – 6:00 PM',
          preparedTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        });

        // Try load draft / saved report from localStorage
        const draftKey = `basic_report_draft_${realUserId}_${selectedDate}`;
        const savedKey = `basic_report_saved_${realUserId}_${selectedDate}`;
        const savedData = localStorage.getItem(savedKey) || localStorage.getItem(draftKey);

        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            setTaskSummary(parsed.taskSummary || []);
            setBlockersTomorrowPlan(parsed.blockersTomorrowPlan || DEFAULT_BLOCKERS_PLAN);
            setStaffSignature(parsed.staffSignature || '');
            if (parsed.basicDetails) {
              setBasicDetails(prev => ({ ...prev, ...parsed.basicDetails, date: selectedDate }));
            }
            showToast('Loaded saved report data', 'success');
            setLoading(false);
            return;
          } catch (e) {
            console.error('Failed parsing draft:', e);
          }
        }

        // No draft: fetch tasks assigned to user
        const res = await fetch(`${API_BASE}/tasks/all`, { headers: getAuthHeaders() });
        if (res.ok) {
          const d = await res.json();
          const allTasks = Array.isArray(d) ? d : d?.data || [];
          
          // Filter tasks for current user (excluding tasks completed prior to today)
          const todayStr = new Date().toISOString().split('T')[0];
          const myTasks = allTasks.filter(t => {
            if (!isUserAssigned(t.assigned_to || t.assignedTo, userId)) return false;

            const statusLower = String(t.status || '').toLowerCase();
            const isDone = ['done', 'completed'].includes(statusLower);
            if (isDone) {
              const compDate = t.completedAt || t.updatedAt;
              if (!compDate) return false;
              try {
                const dObj = new Date(compDate);
                if (isNaN(dObj.getTime())) return false;
                const locY = dObj.getFullYear();
                const locM = String(dObj.getMonth() + 1).padStart(2, '0');
                const locD = String(dObj.getDate()).padStart(2, '0');
                const locStr = `${locY}-${locM}-${locD}`;

                const utcY = dObj.getUTCFullYear();
                const utcM = String(dObj.getUTCMonth() + 1).padStart(2, '0');
                const utcD = String(dObj.getUTCDate()).padStart(2, '0');
                const utcStr = `${utcY}-${utcM}-${utcD}`;

                if (locStr !== selectedDate && utcStr !== selectedDate) {
                  return false;
                }
              } catch (e) {
                return false;
              }
            }
            return true;
          });

          // Map to report task summary format
          const formattedTasks = myTasks.map(t => {
            const formatDisplayDateTime = (dVal) => {
              if (!dVal) return '';
              try {
                const d = new Date(dVal);
                if (isNaN(d.getTime())) return '';
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `${day}-${month}-${year} ${timePart}`;
              } catch (e) {
                return '';
              }
            };
            return {
              task: t.title || '',
              detailsNotes: t.description || 'Auto-fetched',
              status: t.status || 'pending',
              startDate: formatDisplayDateTime(t.createdAt || t.startDate || t.startTime),
              endDate: formatDisplayDateTime(t.updatedAt || t.endDate || t.endTime),
              dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '',
              remarks: t.remarks || '',
              isBackendTask: true,
              backendTaskId: t._id
            };
          });

          // Fallback if no tasks
          if (formattedTasks.length === 0) {
            setTaskSummary([{ task: '', detailsNotes: '', status: 'pending', startDate: '', endDate: '', dueDate: '', remarks: '' }]);
          } else {
            setTaskSummary(formattedTasks);
          }
        } else {
          setTaskSummary([{ task: '', detailsNotes: '', status: 'pending', startDate: '', endDate: '', dueDate: '', remarks: '' }]);
        }
      } catch (err) {
        console.error('Error fetching data for basic report:', err);
        setTaskSummary([{ task: '', detailsNotes: '', status: 'pending', startDate: '', endDate: '', dueDate: '', remarks: '' }]);
      } finally {
        setLoading(false);
      }
    };

    loadUserDataAndTasks();
  }, [selectedDate, getAuthHeaders, showToast]);

  // Auto-save edits to localStorage whenever fields change
  useEffect(() => {
    if (loading || !currentUser) return;
    const realUserId = currentUser._id || currentUser.id || currentUser.user_id || (localStorage.getItem('user_id') || '').replace(/"/g, '').trim();
    if (!realUserId) return;

    const draftKey = `basic_report_draft_${realUserId}_${selectedDate}`;
    const savedKey = `basic_report_saved_${realUserId}_${selectedDate}`;
    const dataToSave = {
      taskSummary,
      blockersTomorrowPlan,
      staffSignature,
      basicDetails
    };
    localStorage.setItem(draftKey, JSON.stringify(dataToSave));
    localStorage.setItem(savedKey, JSON.stringify(dataToSave));
  }, [taskSummary, blockersTomorrowPlan, staffSignature, basicDetails, selectedDate, currentUser, loading]);

  // Save draft locally
  const handleSaveDraft = () => {
    const realUserId = currentUser._id || currentUser.id || currentUser.user_id || (localStorage.getItem('user_id') || '').replace(/"/g, '').trim() || 'guest';
    const draftKey = `basic_report_draft_${realUserId}_${selectedDate}`;
    const savedKey = `basic_report_saved_${realUserId}_${selectedDate}`;
    const draftData = {
      taskSummary,
      blockersTomorrowPlan,
      staffSignature,
      basicDetails
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    localStorage.setItem(savedKey, JSON.stringify(draftData));
    showToast('Report saved to browser storage', 'success');
  };

  // Add a new manual activity row
  const handleAddRow = () => {
    setTaskSummary([
      ...taskSummary,
      { task: '', detailsNotes: '', status: 'pending', startDate: '', endDate: '', dueDate: '', remarks: '' }
    ]);
  };

  // Delete activity row
  const handleDeleteRow = (index) => {
    const next = [...taskSummary];
    next.splice(index, 1);
    setTaskSummary(next.length ? next : [{ task: '', detailsNotes: '', status: 'pending', startDate: '', endDate: '', dueDate: '', remarks: '' }]);
  };

  // Update cell values
  const handleUpdateCell = (index, field, value) => {
    const next = [...taskSummary];
    next[index][field] = value;
    setTaskSummary(next);
  };

  // Generate jsPDF instance
  const buildPDFDoc = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();

    // Clean brand accents
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, pageW, 40, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('DAILY WORK REPORT', 15, 25);

    // Meta details on header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`DATE: ${basicDetails.date}`, pageW - 75, 20);
    doc.text(`TIMING: ${basicDetails.shiftTiming}`, pageW - 75, 26);
    doc.text(`PREPARED TIME: ${basicDetails.preparedTime}`, pageW - 75, 32);

    // Employee profile cards block
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(15, 48, pageW - 30, 28, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(15, 48, pageW - 30, 28, 'S');

    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE DETAILS', 18, 54);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`Name: ${basicDetails.employeeName}`, 18, 62);
    doc.text(`Employee ID: ${basicDetails.employeeId}`, 18, 68);
    
    doc.text(`Department: ${basicDetails.department}`, pageW / 2 + 10, 62);
    doc.text(`Designation: ${basicDetails.designation}`, pageW / 2 + 10, 68);

    // Tasks Table
    const tableBody = taskSummary.map((t, i) => [
      i + 1,
      t.task || '—',
      t.startDate || '—',
      t.endDate || '—',
      t.dueDate || '—',
      t.detailsNotes || '—',
      String(t.status).toUpperCase(),
      t.remarks || '—'
    ]);

    autoTable(doc, {
      startY: 84,
      head: [['#', 'Activity / Task', 'Start Date', 'End Date', 'Due Date', 'Details / Progress Notes', 'Status', 'Remarks']],
      body: tableBody,
      headStyles: {
        fillColor: [79, 70, 229], // Indigo-600
        textColor: 255,
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        valign: 'top'
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 40 }, // Expanded activity field
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 50 }, // Details column width
        6: { cellWidth: 20 },
        7: { cellWidth: 18 }
      },
      margin: { left: 15, right: 15 },
      theme: 'grid',
      styles: { overflow: 'linebreak' }
    });

    let currentY = doc.lastAutoTable.finalY + 12;

    // Check pagination room
    if (currentY > 230) {
      doc.addPage();
      currentY = 25;
    }

    // Blocker / Tomorrow main task section
    doc.setFillColor(253, 244, 245); // light reddish background
    doc.rect(15, currentY, pageW - 30, 36, 'F');
    doc.setDrawColor(254, 226, 226);
    doc.rect(15, currentY, pageW - 30, 36, 'S');

    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('BLOCKERS & TOMORROW\'S PLAN', 18, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Blockers Today: ${blockersTomorrowPlan.blockersToday || 'None'}`, 18, currentY + 14);
    doc.text(`Priority Level: ${blockersTomorrowPlan.priority}`, 18, currentY + 20);
    doc.text(`Main Task Tomorrow: ${blockersTomorrowPlan.tomorrowMainTask || 'Same as today / Continue ongoing tasks'}`, 18, currentY + 26);
    doc.text(`Notes: ${blockersTomorrowPlan.notes || '—'}`, 18, currentY + 32);

    currentY += 46;

    // Check pagination room
    if (currentY > 240) {
      doc.addPage();
      currentY = 25;
    }

    // Signatures
    doc.setDrawColor(226, 232, 240);
    doc.line(15, currentY, pageW - 15, currentY);

    currentY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('PREPARED BY (STAFF)', 15, currentY);
    doc.text('REVIEWED BY (MANAGER)', pageW - 65, currentY);

    if (staffSignature) {
      try {
        doc.addImage(staffSignature, 'PNG', 15, currentY + 2, 35, 14);
      } catch (err) {
        console.error('Error rendering signature to PDF:', err);
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(basicDetails.employeeName, 15, currentY + 20);
    doc.text('Date signed: ' + basicDetails.date, 15, currentY + 24);

    doc.text('Status: Awaiting Review', pageW - 65, currentY + 20);

    return doc;
  };

  // Combined Save & Download Report function (downloads locally & uploads to server for Employee Reports)
  const handleSaveAndDownloadReport = async () => {
    // Basic verification
    const hasNotes = taskSummary.some(t => t.detailsNotes && t.detailsNotes.trim().length > 0);
    if (!hasNotes) {
      showToast('Please add progress details / notes in at least one activity row before saving.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const doc = buildPDFDoc();
      const filename = `daily_report_${currentUser.name?.replace(/\s+/g, '_') || 'employee'}_${selectedDate}.pdf`;

      // 1. Download PDF to user's computer
      doc.save(filename);

      // 2. Upload PDF to server to store under Employee Reports
      const pdfBlob = doc.output('blob');
      const targetUserId = currentUser?._id || currentUser?.id || currentUser?.user_id || (localStorage.getItem('user_id') || '').replace(/"/g, '').trim();
      const reportType = String(basicDetails.department).toLowerCase().replace(/[^a-z0-9]/g, '') || 'basic';

      const response = await uploadCompiledPDFReport(
        targetUserId,
        selectedDate,
        pdfBlob,
        filename,
        reportType,
        'daily'
      );

      if (response.status === 201 || response.status === 200 || response.data?.success) {
        // Persist saved report to local storage so page reload/navigation preserves it
        const draftKey = `basic_report_draft_${targetUserId}_${selectedDate}`;
        const savedKey = `basic_report_saved_${targetUserId}_${selectedDate}`;
        const reportData = {
          taskSummary,
          blockersTomorrowPlan,
          staffSignature,
          basicDetails,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(draftKey, JSON.stringify(reportData));
        localStorage.setItem(savedKey, JSON.stringify(reportData));

        fetchSubmittedDates(targetUserId);

        showToast('Report saved & downloaded successfully!', 'success');
      } else {
        showToast('PDF downloaded locally, but failed to save to server.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving report: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSubmitting(false);
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <ClipboardList size={40} className="text-indigo-500 animate-bounce" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="text-indigo-400 animate-spin" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Preparing Report Sheet...</p>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="p-3 lg:p-5 w-full min-w-0 max-w-full space-y-4 max-h-screen overflow-y-auto overflow-x-hidden">
      
      {/* ══ HEADER ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/common-dashboard')}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-slate-500 hover:text-indigo-500 transition-all shadow-sm cursor-pointer">
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="text-lg lg:text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
              <FileText size={18} className="text-indigo-500" />
              Daily Work Report
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Submit and log your work activities for today</p>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-sm self-start sm:self-auto">
          <Calendar size={13} className="text-slate-400 ml-2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-xs font-black text-slate-700 dark:text-slate-350 focus:outline-none pr-2 py-0.5"
          />
        </div>
      </div>

      {/* ══ MAIN FLEX WRAPPER WITH DATE SIDEBAR ══ */}
      <div className="flex gap-4 items-start w-full relative flex-col lg:flex-row">
        {/* LEFT PANEL: Date Select Sidebar */}
        <div className={`transition-all duration-300 ease-in-out shrink-0 bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md rounded-2xl p-4 shadow-sm relative max-h-[calc(100vh-7rem)] overflow-y-auto ${
          isSidebarOpen 
            ? 'w-full lg:w-56 opacity-100 translate-x-0' 
            : 'w-0 lg:w-0 opacity-0 -translate-x-12 overflow-hidden p-0 border-none pointer-events-none'
        }`}>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Calendar size={13} className="text-indigo-500" />
            Report Log (Monthly)
          </h3>

          <div className="space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto pr-0.5 scrollbar-thin">
            {recentMonths.map(m => {
              const isExpanded = expandedMonth === m.monthKey;
              return (
                <div key={m.monthKey} className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => setExpandedMonth(isExpanded ? null : m.monthKey)}
                    className={`w-full px-3 py-2 flex items-center justify-between font-bold text-xs transition cursor-pointer ${
                      isExpanded 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className={isExpanded ? 'text-white' : 'text-indigo-500'} />
                      <span className="text-[11px]">{m.monthName}</span>
                    </div>
                    <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="p-1 space-y-1 bg-white/70 dark:bg-slate-900/70 border-t border-slate-200/50 dark:border-slate-800/50 max-h-56 overflow-y-auto">
                      {m.dates.map(dateObj => {
                        const isSelected = selectedDate === dateObj.dateString;
                        const isSubmitted = submittedDates.includes(dateObj.dateString);
                        return (
                          <button
                            key={dateObj.dateString}
                            onClick={() => setSelectedDate(dateObj.dateString)}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className={`text-[9px] ${isSelected ? 'text-indigo-200 font-semibold' : 'text-slate-400'}`}>
                                {dateObj.dayName}
                              </span>
                              <span className="font-bold text-[11px] mt-0.5">
                                {dateObj.displayDate}
                              </span>
                            </div>
                            {isSubmitted && (
                              <CheckCircle size={12} className={isSelected ? 'text-white' : 'text-emerald-500'} />
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
          className="mt-4 z-30 flex items-center justify-center w-7 h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-slate-600 dark:text-slate-350 hover:text-indigo-600 rounded-full shadow-sm transition-all shrink-0 cursor-pointer"
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* RIGHT PANEL: Form Content */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* ══ DETAILS CARD ══ */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-2xl p-4 shadow-sm">
            <h2 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <User size={12} /> Employee Profile Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Employee Name</label>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 mt-0.5">{basicDetails.employeeName}</p>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Employee ID</label>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 mt-0.5">{basicDetails.employeeId}</p>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Department</label>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 mt-0.5">{basicDetails.department}</p>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Designation</label>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 mt-0.5">{basicDetails.designation}</p>
              </div>
            </div>
          </div>

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

          {/* ══ TASKS SUMMARY TABLE ══ */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                <ClipboardList size={13} /> Work Activity & Progress Summary
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('taskSummary')}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title="Exclude this table section from report & PDF (-)"
                >
                  <MinusCircle size={14} /> Exclude Table
                </button>
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold hover:bg-indigo-100 transition-all cursor-pointer"
                >
                  <Plus size={12} /> Add Row
                </button>
              </div>
            </div>

            {hiddenSections.taskSummary ? (
              <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <MinusCircle size={14} className="text-rose-400" />
                  Work Activity & Progress Summary (Excluded from Report & PDF)
                </span>
                <button
                  type="button"
                  onClick={() => toggleSectionHidden('taskSummary')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle size={14} /> Restore Section
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <th className="pb-2 px-1.5 w-7">#</th>
                    <th className="pb-2 px-1.5 min-w-[200px]">Activity / Task <span className="text-rose-500">*</span></th>
                    <th className="pb-2 px-1.5 w-24">Start Date</th>
                    <th className="pb-2 px-1.5 w-24">End Date</th>
                    <th className="pb-2 px-1.5 w-24">Due Date</th>
                    <th className="pb-2 px-1.5 min-w-[220px]">Details / Notes <span className="text-rose-500">*</span></th>
                    <th className="pb-2 px-1.5 w-24">Status</th>
                    <th className="pb-2 px-1.5 min-w-[100px]">Remarks</th>
                    <th className="pb-2 px-1.5 w-8 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {taskSummary.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-1.5 px-1.5 font-bold text-slate-400 text-[10px]">{idx + 1}</td>
                      <td className="py-1.5 px-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={row.task}
                            onChange={(e) => handleUpdateCell(idx, 'task', e.target.value)}
                            placeholder="Task description..."
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-0.5 text-xs font-semibold"
                          />
                          {row.task && (
                            <button
                              type="button"
                              onClick={() => setSelectedActivityText(row.task)}
                              className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-0.5 shrink-0"
                              title="Expand / View Full Text"
                            >
                              <Maximize2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-1.5">
                        <input
                          type="text"
                          placeholder="DD-MM-YYYY HH:mm"
                          value={row.startDate || ''}
                          onChange={(e) => handleUpdateCell(idx, 'startDate', e.target.value)}
                          className="bg-transparent text-[10px] font-medium text-slate-600 dark:text-slate-400 focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-1.5">
                        <input
                          type="text"
                          placeholder="DD-MM-YYYY HH:mm"
                          value={row.endDate || ''}
                          onChange={(e) => handleUpdateCell(idx, 'endDate', e.target.value)}
                          className="bg-transparent text-[10px] font-medium text-slate-600 dark:text-slate-400 focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-1.5">
                        <input
                          type="date"
                          value={row.dueDate}
                          onChange={(e) => handleUpdateCell(idx, 'dueDate', e.target.value)}
                          className="bg-transparent text-[10px] font-medium text-slate-600 dark:text-slate-400 focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={row.detailsNotes}
                            onChange={(e) => handleUpdateCell(idx, 'detailsNotes', e.target.value)}
                            placeholder="Progress details / notes..."
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-0.5 text-xs"
                          />
                          {row.detailsNotes && (
                            <button
                              type="button"
                              onClick={() => setSelectedActivityText(row.detailsNotes)}
                              className="text-slate-400 hover:text-indigo-600 dark:hover:text-lime-400 p-0.5 shrink-0"
                              title="Expand / View Full Text"
                            >
                              <Maximize2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-1.5">
                        <select
                          value={row.status}
                          onChange={(e) => handleUpdateCell(idx, 'status', e.target.value)}
                          className="bg-transparent border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-semibold focus:outline-none"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-1.5">
                        <input
                          type="text"
                          value={row.remarks}
                          onChange={(e) => handleUpdateCell(idx, 'remarks', e.target.value)}
                          placeholder="Remarks..."
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-1.5 text-right">
                        {taskSummary.length > 1 && (
                          <button
                            onClick={() => handleDeleteRow(idx)}
                            className="text-slate-400 hover:text-rose-500 transition-colors p-0.5"
                            title="Remove row"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* ══ BLOCKERS & SIGNATURE CARD ══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-2xl p-4 shadow-sm space-y-2.5">
              <h2 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                <PenTool size={12} /> Blockers & Tomorrow's Plan
              </h2>
              
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Blockers Today</label>
                  <textarea
                    rows={1}
                    value={blockersTomorrowPlan.blockersToday}
                    onChange={(e) => setBlockersTomorrowPlan({ ...blockersTomorrowPlan, blockersToday: e.target.value })}
                    placeholder="Any blockers or issues faced today..."
                    className="w-full mt-0.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Priority Level</label>
                    <select
                      value={blockersTomorrowPlan.priority}
                      onChange={(e) => setBlockersTomorrowPlan({ ...blockersTomorrowPlan, priority: e.target.value })}
                      className="w-full mt-0.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Main Task Tomorrow</label>
                    <input
                      type="text"
                      value={blockersTomorrowPlan.tomorrowMainTask}
                      onChange={(e) => setBlockersTomorrowPlan({ ...blockersTomorrowPlan, tomorrowMainTask: e.target.value })}
                      placeholder="Main task planned..."
                      className="w-full mt-0.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/70 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-2">
              <div>
                <h2 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <BookOpen size={12} /> Staff Authorization Signature
                </h2>
                <SignatureUpload
                  value={staffSignature}
                  onChange={setStaffSignature}
                  placeholder="Sign here (Upload PNG signature)"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[9px] font-medium text-amber-600/90 dark:text-amber-500/95 leading-tight">
                <strong>Verification Notice:</strong> Saving this report compiles and uploads a signed PDF to employee records.
              </div>
            </div>

          </div>

          {/* ══ ACTIONS BAR ══ */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear this entire form draft?')) {
                  setTaskSummary([{ task: '', detailsNotes: '', status: 'pending', startDate: '', endDate: '', dueDate: '', remarks: '' }]);
                  setBlockersTomorrowPlan(DEFAULT_BLOCKERS_PLAN);
                  setStaffSignature('');
                }
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Clear Draft
            </button>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 hover:border-slate-300 text-slate-600 dark:text-slate-400 hover:text-indigo-500 text-[11px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              >
                <Save size={12} />
                Save Draft
              </button>

              <button
                onClick={handleSaveAndDownloadReport}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Saving & Downloading...
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <Download size={13} />
                    Save & Download Report
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
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

export default BasicReportPage;
