import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Download, Loader2, FileDown, AlertCircle, ChevronDown, ChevronUp,
  CalendarDays, CalendarRange, BarChart3, SlidersHorizontal, X, Eye, FileText, Sparkles, Brain
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useToast } from '../components/ToastProvider';
import { AiAnalyzeButton, AiAnalyzeModal } from '../components/AiAnalyzeModal';

const rawApiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const API_BASE = rawApiBase.endsWith('/v1') ? rawApiBase.slice(0, -3) : rawApiBase;

// Map designation IDs to API endpoint prefixes
const DESIGNATION_API_MAP = {
  'developer':         { name: 'Developer',          apiPrefix: 'developer-reports',          byDate: 'by-date' },
  'hodrd':             { name: 'HOD R&D',            apiPrefix: 'hod-rd-reports',             byDate: 'by-date' },
  'hodmarketing':      { name: 'HOD Marketing',      apiPrefix: 'hod-marketing-reports',      byDate: 'by-date' },
  'graphicdesigner':   { name: 'Graphic Designer',   apiPrefix: 'graphic-designer-reports',   byDate: 'by-date' },
  'academiccounselor': { name: 'Academic Counselor', apiPrefix: 'academic-counselor-reports', byDate: 'by-date' },
  'videographer':      { name: 'Videographer',       apiPrefix: 'videographer-reports',       byDate: 'by-date' },
  'hr':                { name: 'HR',                 apiPrefix: 'hr-reports',                 byDate: 'by-date' },
  'ops':               { name: 'Ops',                apiPrefix: 'ops-reports',                byDate: 'by-date' },
  'accountant':        { name: 'Accountant',         apiPrefix: 'accountant-reports',         byDate: 'by-date' },
  'marketing':         { name: 'Marketing',          apiPrefix: 'marketing-reports',          byDate: 'by-date' },
};

// Badge config for report periods
const PERIOD_CONFIG = {
  daily:   { label: 'Daily',   icon: CalendarDays,  color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/50' },
  weekly:  { label: 'Weekly',  icon: CalendarRange,  color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50' },
  monthly: { label: 'Monthly', icon: BarChart3,      color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800/50' },
};

const EmployeeReports = () => {
  const location = useLocation();
  const isTeamReports = location.pathname.includes('team-reports');

  const savedUser = localStorage.getItem('user');
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const deptName = loggedInUser ? (loggedInUser.department || loggedInUser.departmentId?.name || '') : '';
  const isNonOperational = String(deptName).toLowerCase().trim() === 'non-operational';

  const isMonthlyReports = location.pathname.includes('monthly-reports');

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloading, setDownloading] = useState(null); // empId being downloaded
  const [downloadingReportId, setDownloadingReportId] = useState(null); // specific saved report being downloaded
  const [loadingPreviewId, setLoadingPreviewId] = useState(null); // reportId or empId being previewed
  const [previewPdfModal, setPreviewPdfModal] = useState({ isOpen: false, url: null, title: '', report: null, emp: null });
  const [isEmployeeAiOpen, setIsEmployeeAiOpen] = useState(false);
  const [employeeAiContext, setEmployeeAiContext] = useState(null);
  const [employeeAiTitle, setEmployeeAiTitle] = useState('Employee Reports Analysis');
  const [errorMsg, setErrorMsg] = useState(null);

  const [expandedEmpId, setExpandedEmpId] = useState(null);
  const [sortOrders, setSortOrders] = useState({}); // empId -> 'newest' | 'oldest'
  const [periodFilters, setPeriodFilters] = useState({}); // empId -> 'all' | 'daily' | 'weekly' | 'monthly'
  const [uploadedReportsMap, setUploadedReportsMap] = useState({});
  const [loadingReportsMap, setLoadingReportsMap] = useState({});

  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedDesignation, setSelectedDesignation] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [viewMode, setViewMode] = useState('employees'); // 'employees' | 'reports'
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // 'all' | 'daily' | 'weekly' | 'monthly'
  const [globalSort, setGlobalSort] = useState('newest'); // 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'monthly_first' | 'weekly_first' | 'daily_first'
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const { showToast } = useToast();

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchUploadedReports = useCallback(async (empId, sortOrder = 'newest') => {
    try {
      setLoadingReportsMap(prev => ({ ...prev, [empId]: true }));
      const res = await fetch(`${API_BASE}/v1/employee-reports/list?userId=${empId}&sort=${sortOrder}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setUploadedReportsMap(prev => ({ ...prev, [empId]: data.data }));
        }
      }
    } catch (err) {
      console.error(`Failed to fetch PDF reports for ${empId}:`, err);
    } finally {
      setLoadingReportsMap(prev => ({ ...prev, [empId]: false }));
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        let res = await fetch(`${API_BASE}/v1/users/list`, { headers: getAuthHeaders() });
        if (!res.ok) {
          res = await fetch(`${API_BASE}/v1/users`, { headers: getAuthHeaders() });
        }
        if (res.ok) {
          const data = await res.json();
          const emps = Array.isArray(data) 
            ? data 
            : (Array.isArray(data.data) 
              ? data.data 
              : (Array.isArray(data.data?.users) 
                ? data.data.users 
                : (Array.isArray(data.users) ? data.users : [])));
          setEmployees(emps);
          emps.forEach(emp => {
            const empId = emp._id || emp.id;
            if (empId) {
              fetchUploadedReports(empId, 'newest');
            }
          });
        }
      } catch (err) {
        console.error('Failed to load employee list:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, [getAuthHeaders, fetchUploadedReports]);

  const uniqueDepartments = Array.from(new Set(
    employees.map(emp => emp.departmentId?.name || emp.department || '').filter(Boolean)
  )).sort();

  const uniqueDesignations = Array.from(new Set(
    employees.map(emp => emp.designationId?.name || emp.designation || '').filter(Boolean)
  )).sort();

  const isSuperAdmin = true;

  const filteredEmployees = employees.filter(emp => {
    const nameMatch = (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = (emp.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const searchMatch = nameMatch || emailMatch;

    const deptName = emp.departmentId?.name || emp.department || '';
    const deptMatch = selectedDepartment === 'all' || deptName.toLowerCase().trim() === selectedDepartment.toLowerCase().trim();

    const desigName = emp.designationId?.name || emp.designation || '';
    const desigMatch = selectedDesignation === 'all' || desigName.toLowerCase().trim() === selectedDesignation.toLowerCase().trim();

    if (!isSuperAdmin && userDept) {
      const empIdStr = String(emp._id || emp.id || '');
      const loggedInIdStr = String(loggedInUser?._id || loggedInUser?.id || '');
      if (empIdStr !== loggedInIdStr && deptName.toLowerCase().trim() !== userDept.toLowerCase().trim()) {
        return false;
      }
    }

    return searchMatch && deptMatch && desigMatch;
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    const aId = a._id || a.id;
    const bId = b._id || b.id;
    const aReports = uploadedReportsMap[aId] || [];
    const bReports = uploadedReportsMap[bId] || [];

    const aLatest = aReports.length > 0 ? new Date(aReports[0].created_at || aReports[0].report_date) : new Date(0);
    const bLatest = bReports.length > 0 ? new Date(bReports[0].created_at || bReports[0].report_date) : new Date(0);

    if (globalSort === 'newest') {
      return bLatest - aLatest;
    } else if (globalSort === 'oldest') {
      return aLatest - bLatest;
    } else if (globalSort === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '');
    } else if (globalSort === 'name_desc') {
      return (b.name || '').localeCompare(a.name || '');
    } else if (globalSort === 'monthly_first') {
      const aMonthly = aReports.filter(r => r.report_period === 'monthly').length;
      const bMonthly = bReports.filter(r => r.report_period === 'monthly').length;
      return bMonthly - aMonthly;
    } else if (globalSort === 'weekly_first') {
      const aWeekly = aReports.filter(r => r.report_period === 'weekly').length;
      const bWeekly = bReports.filter(r => r.report_period === 'weekly').length;
      return bWeekly - aWeekly;
    } else if (globalSort === 'daily_first') {
      const aDaily = aReports.filter(r => r.report_period === 'daily').length;
      const bDaily = bReports.filter(r => r.report_period === 'daily').length;
      return bDaily - aDaily;
    }
    return 0;
  });

  const flattenedReports = Object.entries(uploadedReportsMap).flatMap(([empId, reports]) => {
    const emp = employees.find(e => (e._id || e.id) === empId);
    let filtered = reports || [];
    if (isNonOperational) {
      filtered = filtered.filter(r => r.report_period !== 'daily');
    }
    return filtered.map(r => ({
      ...r,
      employee: emp
    }));
  }).filter(r => r.employee);

  const filteredReports = flattenedReports.filter(report => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = (report.employee.name || '').toLowerCase().includes(searchLower);
    const emailMatch = (report.employee.email || '').toLowerCase().includes(searchLower);
    const filenameMatch = (report.filename || '').toLowerCase().includes(searchLower);
    const searchMatch = nameMatch || emailMatch || filenameMatch;

    const deptName = report.employee.departmentId?.name || report.employee.department || '';
    const deptMatch = selectedDepartment === 'all' || deptName.toLowerCase().trim() === selectedDepartment.toLowerCase().trim();

    const desigName = report.employee.designationId?.name || report.employee.designation || '';
    const desigMatch = selectedDesignation === 'all' || desigName.toLowerCase().trim() === selectedDesignation.toLowerCase().trim();

    const periodMatch = selectedPeriod === 'all' || report.report_period === selectedPeriod;

    return searchMatch && deptMatch && desigMatch && periodMatch;
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    const aDate = new Date(a.created_at || a.report_date);
    const bDate = new Date(b.created_at || b.report_date);

    if (globalSort === 'newest') {
      return bDate - aDate;
    } else if (globalSort === 'oldest') {
      return aDate - bDate;
    } else if (globalSort === 'name_asc') {
      return (a.employee?.name || '').localeCompare(b.employee?.name || '');
    } else if (globalSort === 'name_desc') {
      return (b.employee?.name || '').localeCompare(a.employee?.name || '');
    } else if (globalSort === 'monthly_first') {
      if (a.report_period === 'monthly' && b.report_period !== 'monthly') return -1;
      if (a.report_period !== 'monthly' && b.report_period === 'monthly') return 1;
      return bDate - aDate;
    } else if (globalSort === 'weekly_first') {
      if (a.report_period === 'weekly' && b.report_period !== 'weekly') return -1;
      if (a.report_period !== 'weekly' && b.report_period === 'weekly') return 1;
      return bDate - aDate;
    } else if (globalSort === 'daily_first') {
      if (a.report_period === 'daily' && b.report_period !== 'daily') return -1;
      if (a.report_period !== 'daily' && b.report_period === 'daily') return 1;
      return bDate - aDate;
    }
    return 0;
  });

  const paginatedEmployees = sortedEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedReports = sortedReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDepartment, selectedDesignation, selectedPeriod, globalSort, viewMode]);

  const getDesignationConfig = (emp) => {
    const desigName = String(emp.designation || emp.designationId?.name || '').toLowerCase();
    if (desigName.includes('developer')) return DESIGNATION_API_MAP['developer'];
    if (desigName.includes('hod') || desigName.includes('r&d')) return DESIGNATION_API_MAP['hodrd'];
    if (desigName.includes('graphic') || desigName.includes('designer')) return DESIGNATION_API_MAP['graphicdesigner'];
    if (desigName.includes('counselor') || desigName.includes('academic')) return DESIGNATION_API_MAP['academiccounselor'];
    if (desigName.includes('video') || desigName.includes('editor')) return DESIGNATION_API_MAP['videographer'];
    if (desigName.includes('hr') || desigName.includes('recruiter')) return DESIGNATION_API_MAP['hr'];
    if (desigName.includes('ops') || desigName.includes('operations')) return DESIGNATION_API_MAP['ops'];
    if (desigName.includes('accountant') || desigName.includes('finance')) return DESIGNATION_API_MAP['accountant'];
    if (desigName.includes('marketing') || desigName.includes('marketer') || desigName.includes('digital')) return DESIGNATION_API_MAP['marketing'];
    return null;
  };

  // Download latest daily report for an employee
  const handleDownload = async (emp) => {
    const config = getDesignationConfig(emp);
    if (!config) {
      setErrorMsg(`No report template configured for ${emp.name || 'this employee'} (${emp.designationId?.name || 'unknown designation'}).`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const empId = emp._id || emp.id;
    setDownloading(empId);
    setErrorMsg(null);
    showToast("Generating PDF on server...", "info");

    try {
      const today = new Date().toISOString().split('T')[0];
      const token = localStorage.getItem('token');
      const cleanToken = token ? token.replace(/"/g, '') : '';
      const headers = {
        'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
      };

      const reportTypeSlug = config.apiPrefix.replace('-reports', '');
      let url = `${API_BASE}/v1/employee-reports/generate-pdf?userId=${empId}&dateString=${today}&reportType=${reportTypeSlug}`;
      let res = await fetch(url, { headers });

      if (!res.ok) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        url = `${API_BASE}/v1/employee-reports/generate-pdf?userId=${empId}&dateString=${yStr}&reportType=${reportTypeSlug}`;
        res = await fetch(url, { headers });
      }

      if (res.ok) {
        const blob = await res.blob();
        const filename = `${config.name.replace(/\s+/g, '_')}_Report_${(emp.name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_')}_Daily.pdf`;
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
        const currentSort = sortOrders[empId] || 'newest';
        fetchUploadedReports(empId, currentSort);
        showToast(`PDF report generated and downloaded successfully! (Size: ${blob.size} bytes)`, "success");
      } else {
        setErrorMsg(`No report found for ${emp.name || 'this employee'} for today or yesterday.`);
        setTimeout(() => setErrorMsg(null), 5000);
      }
    } catch (err) {
      console.error('Download failed:', err);
      setErrorMsg('Failed to generate PDF. Please try again.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setDownloading(null);
    }
  };

  // Download a specific saved report (daily/weekly/monthly) from the history list
  const handleDownloadSavedReport = async (emp, report) => {
    const token = localStorage.getItem('token');
    const cleanToken = token ? token.replace(/"/g, '') : '';
    const headers = {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
    };

    setDownloadingReportId(report._id);
    showToast(`Downloading ${report.report_period || 'report'} PDF...`, "info");

    try {
      let res;
      let filename;

      // Stream the saved PDF file (daily/weekly/monthly) from storage via backend proxy
      const url = `${API_BASE}/v1/employee-reports/stream/${report._id}`;
      res = await fetch(url, { headers });
      filename = report.filename || `${report.report_period || 'daily'}_Report_${report.report_date}.pdf`;

      if (res.ok) {
        const blob = await res.blob();
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
        showToast(`Report downloaded successfully! (Size: ${blob.size} bytes)`, "success");
      } else {
        showToast("Failed to download report. Please try again.", "error");
      }
    } catch (err) {
      console.error('Download saved report failed:', err);
      showToast("Error downloading report.", "error");
    } finally {
      setDownloadingReportId(null);
    }
  };

  // Preview/View a specific saved report (PDF) without forced download
  const handleViewReport = async (emp, report) => {
    const token = localStorage.getItem('token');
    const cleanToken = token ? token.replace(/"/g, '') : '';
    const headers = {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
    };

    setLoadingPreviewId(report._id);
    showToast(`Loading ${report.report_period || 'report'} preview...`, "info");

    try {
      const url = `${API_BASE}/v1/employee-reports/stream/${report._id}`;
      const res = await fetch(url, { headers });

      if (res.ok) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPreviewPdfModal({
          isOpen: true,
          url: objectUrl,
          title: `${emp.name || 'Employee'} — ${report.report_period || 'Daily'} Report (${report.report_date})`,
          report,
          emp
        });
      } else {
        showToast("Could not load PDF preview for this report.", "error");
      }
    } catch (err) {
      console.error('Preview report error:', err);
      showToast("Failed to load PDF preview.", "error");
    } finally {
      setLoadingPreviewId(null);
    }
  };

  // Preview latest daily report for an employee directly
  const handleViewLatest = async (emp) => {
    const config = getDesignationConfig(emp);
    if (!config) {
      setErrorMsg(`No report template configured for ${emp.name || 'this employee'}.`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const empId = emp._id || emp.id;
    setLoadingPreviewId(empId);
    showToast("Generating PDF report preview...", "info");

    try {
      const today = new Date().toISOString().split('T')[0];
      const token = localStorage.getItem('token');
      const cleanToken = token ? token.replace(/"/g, '') : '';
      const headers = {
        'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
      };

      const reportTypeSlug = config.apiPrefix.replace('-reports', '');
      let url = `${API_BASE}/v1/employee-reports/generate-pdf?userId=${empId}&dateString=${today}&reportType=${reportTypeSlug}`;
      let res = await fetch(url, { headers });

      if (!res.ok) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        url = `${API_BASE}/v1/employee-reports/generate-pdf?userId=${empId}&dateString=${yStr}&reportType=${reportTypeSlug}`;
        res = await fetch(url, { headers });
      }

      if (res.ok) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPreviewPdfModal({
          isOpen: true,
          url: objectUrl,
          title: `${emp.name || 'Employee'} — Latest Daily Report`,
          report: { report_date: 'Latest', report_period: 'daily' },
          emp
        });
      } else {
        showToast(`No report found for ${emp.name || 'this employee'} for today or yesterday.`, "error");
      }
    } catch (err) {
      console.error('View latest failed:', err);
      showToast('Failed to load PDF report preview.', 'error');
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const handleSortChange = (empId, newSortOrder) => {
    setSortOrders(prev => ({ ...prev, [empId]: newSortOrder }));
    if (newSortOrder === 'newest' || newSortOrder === 'oldest') {
      fetchUploadedReports(empId, newSortOrder);
    } else {
      fetchUploadedReports(empId, 'newest');
    }
  };

  const handlePeriodFilterChange = (empId, period) => {
    setPeriodFilters(prev => ({ ...prev, [empId]: period }));
  };

  const toggleExpand = (empId) => {
    setExpandedEmpId(prev => prev === empId ? null : empId);
  };

  const getFilteredReports = (empId) => {
    let allReports = uploadedReportsMap[empId] || [];
    if (isNonOperational) {
      allReports = allReports.filter(r => r.report_period !== 'daily');
    }

    // Client-side deduplication by report_date + report_period
    const dedupMap = new Map();
    allReports.forEach(r => {
      const key = `${r.report_date || 'nodate'}_${r.report_period || 'daily'}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, r);
      } else {
        const existing = dedupMap.get(key);
        if (!existing.pdf_url && r.pdf_url) {
          dedupMap.set(key, r);
        }
      }
    });
    allReports = Array.from(dedupMap.values());

    const filter = periodFilters[empId] || 'all';
    let reports = filter === 'all' ? allReports : allReports.filter(r => r.report_period === filter);
    const sort = sortOrders[empId] || 'newest';

    return [...reports].sort((a, b) => {
      const aDate = new Date(a.created_at || a.report_date);
      const bDate = new Date(b.created_at || b.report_date);
      if (sort === 'newest') {
        return bDate - aDate;
      } else if (sort === 'oldest') {
        return aDate - bDate;
      } else if (sort === 'monthly_first') {
        if (a.report_period === 'monthly' && b.report_period !== 'monthly') return -1;
        if (a.report_period !== 'monthly' && b.report_period === 'monthly') return 1;
        return bDate - aDate;
      } else if (sort === 'weekly_first') {
        if (a.report_period === 'weekly' && b.report_period !== 'weekly') return -1;
        if (a.report_period !== 'weekly' && b.report_period === 'weekly') return 1;
        return bDate - aDate;
      } else if (sort === 'daily_first') {
        if (a.report_period === 'daily' && b.report_period !== 'daily') return -1;
        if (a.report_period !== 'daily' && b.report_period === 'daily') return 1;
        return bDate - aDate;
      }
      return 0;
    });
  };

  const getReportCounts = (empId) => {
    let all = getFilteredReports(empId);
    return {
      all: all.length,
      daily: all.filter(r => r.report_period === 'daily').length,
      weekly: all.filter(r => r.report_period === 'weekly').length,
      monthly: all.filter(r => r.report_period === 'monthly').length,
    };
  };

  // AI Report Analysis Handler for Directory
  const handleAnalyzeAllEmployeeReports = () => {
    const totalEmps = employees.length;
    const totalReportsCount = flattenedReports.length;
    
    const deptSummary = {};
    employees.forEach(emp => {
      const dept = emp.departmentId?.name || emp.department || 'General';
      const empId = emp._id || emp.id;
      const reports = uploadedReportsMap[empId] || [];
      if (!deptSummary[dept]) {
        deptSummary[dept] = { employeeCount: 0, totalReports: 0 };
      }
      deptSummary[dept].employeeCount += 1;
      deptSummary[dept].totalReports += reports.length;
    });

    const contextObj = {
      target: 'Overall Employee Reports Directory',
      totalEmployees: totalEmps,
      totalSavedReports: totalReportsCount,
      departmentBreakdown: deptSummary,
      activeDepartmentFilter: selectedDepartment,
      activeDesignationFilter: selectedDesignation,
      recentReportsSample: sortedReports.slice(0, 15).map(r => ({
        employeeName: r.employee?.name,
        designation: r.employee?.designationId?.name || r.employee?.designation,
        reportPeriod: r.report_period,
        reportDate: r.report_date,
        filename: r.filename
      }))
    };

    setEmployeeAiContext(contextObj);
    setEmployeeAiTitle('Employee Reports Directory Intelligence');
    setIsEmployeeAiOpen(true);
  };

  // AI Report Analysis Handler for Single Employee (Fetches ALL reports in active sort order)
  const handleAnalyzeSingleEmployee = async (emp, report = null) => {
    const config = getDesignationConfig(emp);
    const empId = emp._id || emp.id;
    
    // Get all reports for this employee respecting active period filter and sort order
    const filteredSortedReports = getFilteredReports(empId);
    
    // If a specific report was targeted (e.g. from PDF preview modal), analyze that one. Otherwise, analyze ALL sorted reports!
    const reportsToAnalyze = report ? [report] : filteredSortedReports;
    const sortOrderLabel = sortOrders[empId] || 'newest';
    const periodFilterLabel = periodFilters[empId] || 'all';

    showToast(`Fetching content across ${reportsToAnalyze.length} report(s) for ${emp.name}...`, "info");
    setLoadingPreviewId(empId);

    const token = localStorage.getItem('token');
    const cleanToken = token ? token.replace(/"/g, '') : '';
    const headers = {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
    };

    // Analyze up to top 15 reports in active sorted order
    const targetReportsSample = reportsToAnalyze.slice(0, 15);

    const fetchedContentPromises = targetReportsSample.map(async (rpt) => {
      let contentText = "";
      if (config && rpt.report_date) {
        try {
          const res = await fetch(`${API_BASE}/v1/${config.apiPrefix}/by-date?userId=${empId}&dateString=${rpt.report_date}`, { headers });
          if (res.ok) {
            const resJson = await res.json();
            if (resJson.success && resJson.data) {
              const d = resJson.data;
              const parts = [
                d.workDone && `Work Accomplished: ${typeof d.workDone === 'object' ? JSON.stringify(d.workDone) : d.workDone}`,
                d.tasks && `Tasks Logged: ${typeof d.tasks === 'object' ? JSON.stringify(d.tasks) : d.tasks}`,
                d.dailyTasks && `Daily Work Entries: ${typeof d.dailyTasks === 'object' ? JSON.stringify(d.dailyTasks) : d.dailyTasks}`,
                d.deliverables && `Deliverables: ${typeof d.deliverables === 'object' ? JSON.stringify(d.deliverables) : d.deliverables}`,
                d.projects && `Projects: ${typeof d.projects === 'object' ? JSON.stringify(d.projects) : d.projects}`,
                d.remarks && `Remarks: ${d.remarks}`,
                d.challenges && `Challenges & Blockers: ${d.challenges}`,
                d.learnings && `Learnings: ${d.learnings}`,
                d.hoursWorked && `Hours Worked: ${d.hoursWorked} hrs`,
                d.totalCalls !== undefined && `Total Calls: ${d.totalCalls}`,
                d.conversions !== undefined && `Conversions: ${d.conversions}`,
                d.summary && `Summary Notes: ${d.summary}`
              ].filter(Boolean);
              if (parts.length > 0) {
                contentText = parts.join(" | ");
              }
            }
          }
        } catch (e) {
          console.warn(`Failed fetching report content for date ${rpt.report_date}:`, e);
        }
      }

      if (!contentText) {
        contentText = `Report File: ${rpt.filename || 'PDF Report'}, Period: ${rpt.report_period || 'Daily'}`;
      }

      return `[REPORT DATE: ${rpt.report_date || 'N/A'} | PERIOD: ${(rpt.report_period || 'daily').toUpperCase()}]\n${contentText}`;
    });

    const compiledReportEntries = await Promise.all(fetchedContentPromises);
    const fullCompiledContentText = compiledReportEntries.join("\n\n---\n\n");

    const contextObj = {
      target: `Comprehensive Multi-Report Content Analysis: ${emp.name}`,
      employeeName: emp.name,
      email: emp.email,
      designation: emp.designationId?.name || emp.designation || config?.name || 'Staff',
      department: emp.departmentId?.name || emp.department || 'General',
      totalReportsAnalyzed: targetReportsSample.length,
      totalReportsInDirectory: filteredSortedReports.length,
      activeSortOrder: sortOrderLabel,
      activePeriodFilter: periodFilterLabel,
      actualReportContentText: fullCompiledContentText || 'No text content available in employee reports.'
    };

    setEmployeeAiContext(contextObj);
    setEmployeeAiTitle(`AI Content Summary: ${emp.name}`);
    setIsEmployeeAiOpen(true);
    setLoadingPreviewId(null);
  };

  // AI Conclude Handler: Fetches ALL reports for an employee across their entire history & generates a final work conclusion
  const handleAiConcludeEmployee = async (emp) => {
    const config = getDesignationConfig(emp);
    const empId = emp._id || emp.id;
    
    // Fetch all uploaded reports for this employee
    let allReports = uploadedReportsMap[empId] || [];
    if (isNonOperational) {
      allReports = allReports.filter(r => r.report_period !== 'daily');
    }

    if (allReports.length === 0) {
      showToast(`No saved reports found for ${emp.name}.`, "warning");
      return;
    }

    showToast(`Fetching all ${allReports.length} reports of ${emp.name} for AI Conclusion...`, "info");
    setLoadingPreviewId(empId);

    const token = localStorage.getItem('token');
    const cleanToken = token ? token.replace(/"/g, '') : '';
    const headers = {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
    };

    // Sort reports chronologically
    const sortedReportsList = [...allReports].sort((a, b) => new Date(b.created_at || b.report_date) - new Date(a.created_at || a.report_date));
    
    // Sample up to 20 reports across their history for deep evaluation
    const sampleReports = sortedReportsList.slice(0, 20);

    const fetchedPromises = sampleReports.map(async (rpt) => {
      let contentText = "";
      if (config && rpt.report_date) {
        try {
          const res = await fetch(`${API_BASE}/v1/${config.apiPrefix}/by-date?userId=${empId}&dateString=${rpt.report_date}`, { headers });
          if (res.ok) {
            const resJson = await res.json();
            if (resJson.success && resJson.data) {
              const d = resJson.data;
              const parts = [
                d.workDone && `Work Accomplished: ${typeof d.workDone === 'object' ? JSON.stringify(d.workDone) : d.workDone}`,
                d.tasks && `Tasks Logged: ${typeof d.tasks === 'object' ? JSON.stringify(d.tasks) : d.tasks}`,
                d.dailyTasks && `Daily Entries: ${typeof d.dailyTasks === 'object' ? JSON.stringify(d.dailyTasks) : d.dailyTasks}`,
                d.deliverables && `Deliverables: ${typeof d.deliverables === 'object' ? JSON.stringify(d.deliverables) : d.deliverables}`,
                d.projects && `Projects: ${typeof d.projects === 'object' ? JSON.stringify(d.projects) : d.projects}`,
                d.remarks && `Remarks: ${d.remarks}`,
                d.challenges && `Challenges: ${d.challenges}`,
                d.hoursWorked && `Hours: ${d.hoursWorked}h`,
                d.totalCalls !== undefined && `Calls: ${d.totalCalls}`,
                d.conversions !== undefined && `Conversions: ${d.conversions}`,
                d.summary && `Summary: ${d.summary}`
              ].filter(Boolean);
              if (parts.length > 0) {
                contentText = parts.join(" | ");
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch report for date ${rpt.report_date}:`, e);
        }
      }

      if (!contentText) {
        contentText = `Report File: ${rpt.filename || 'PDF Report'}, Period: ${rpt.report_period || 'Daily'}`;
      }

      return `[DATE: ${rpt.report_date || 'N/A'} | TYPE: ${(rpt.report_period || 'daily').toUpperCase()}]\n${contentText}`;
    });

    const reportContents = await Promise.all(fetchedPromises);
    const compiledFullText = reportContents.join("\n\n---\n\n");

    const contextObj = {
      isConclusionMode: true,
      target: `AI Final Work Conclusion for ${emp.name}`,
      employeeName: emp.name,
      email: emp.email,
      designation: emp.designationId?.name || emp.designation || config?.name || 'Staff Member',
      department: emp.departmentId?.name || emp.department || 'General',
      totalSubmittedReports: allReports.length,
      reportsAnalyzedCount: sampleReports.length,
      actualReportContentText: compiledFullText
    };

    setEmployeeAiContext(contextObj);
    setEmployeeAiTitle(`AI Work Conclusion: ${emp.name}`);
    setIsEmployeeAiOpen(true);
    setLoadingPreviewId(null);
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            {/* <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/70 dark:text-indigo-400/80">
              {isMonthlyReports ? 'Monthly Directory' : (isTeamReports ? 'Team Directory' : 'Admin Directory')}
            </span> */}
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter leading-none text-slate-900 dark:text-white">
            {isMonthlyReports ? 'Monthly' : (isTeamReports ? 'Team' : 'Employee')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Reports</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Click on a {isMonthlyReports || isTeamReports ? 'team member' : 'employee'} card to reveal their saved {isMonthlyReports ? '' : <><span className="font-semibold text-indigo-500">Daily</span>, <span className="font-semibold text-emerald-500">Weekly</span> &amp; </>}<span className="font-semibold text-violet-500">Monthly</span> PDF reports.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 w-full md:w-auto">
          <button
            onClick={() => { setViewMode('employees'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              viewMode === 'employees'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-750 dark:hover:text-slate-300'
            }`}
          >
            Employees
          </button>
          <button
            onClick={() => { setViewMode('reports'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              viewMode === 'reports'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-750 dark:hover:text-slate-300'
            }`}
          >
            All Reports
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              placeholder={viewMode === 'employees' ? (isMonthlyReports || isTeamReports ? "Search team..." : "Search employees...") : "Search reports & staff..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all shadow-sm"
            />
          </div>

          {/* Unified Filters Toggle Modal Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsFiltersOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-sm"
            >
              <SlidersHorizontal size={13} />
              <span>Filter &amp; Sort</span>
              {(selectedDepartment !== 'all' || selectedDesignation !== 'all' || (viewMode === 'reports' && selectedPeriod !== 'all') || globalSort !== 'newest') && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </button>

            {/* Global Viewport Filter Dropdown */}
            <AnimatePresence>
              {isFiltersOpen && (
                <>
                  {/* Invisible Backdrop Click Closer */}
                  <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={() => setIsFiltersOpen(false)} />
                  
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 w-72 shadow-xl space-y-4"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Filter &amp; Sort</h3>
                      </div>
                      <button
                        onClick={() => setIsFiltersOpen(false)}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* Department Filter */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Department</label>
                      <div className="relative">
                        <select
                          value={selectedDepartment}
                          onChange={(e) => setSelectedDepartment(e.target.value)}
                          className="w-full appearance-none bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-4 pr-10 py-2 text-xs font-semibold text-slate-705 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="all">All Departments</option>
                          {uniqueDepartments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none" size={13} />
                      </div>
                    </div>

                    {/* Designation Filter */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Designation</label>
                      <div className="relative">
                        <select
                          value={selectedDesignation}
                          onChange={(e) => setSelectedDesignation(e.target.value)}
                          className="w-full appearance-none bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-4 pr-10 py-2 text-xs font-semibold text-slate-705 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="all">All Designations</option>
                          {uniqueDesignations.map(desig => (
                            <option key={desig} value={desig}>{desig}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-455 pointer-events-none" size={13} />
                      </div>
                    </div>

                    {/* Period Filter (only in Reports viewMode) */}
                    {viewMode === 'reports' && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Period</label>
                        <div className="relative">
                          <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="w-full appearance-none bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-4 pr-10 py-2 text-xs font-semibold text-slate-705 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="all">All Periods</option>
                            {!isNonOperational && <option value="daily">Daily Only</option>}
                            <option value="weekly">Weekly Only</option>
                            <option value="monthly">Monthly Only</option>
                          </select>
                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none" size={13} />
                        </div>
                      </div>
                    )}

                    {/* Global Sort Order */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sort By</label>
                      <div className="relative">
                        <select
                          value={globalSort}
                          onChange={(e) => setGlobalSort(e.target.value)}
                          className="w-full appearance-none bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-4 pr-10 py-2 text-xs font-semibold text-slate-705 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="newest">Newest Reports</option>
                          <option value="oldest">Oldest Reports</option>
                          <option value="name_asc">Name (A-Z)</option>
                          <option value="name_desc">Name (Z-A)</option>
                          <option value="monthly_first">Monthly First</option>
                          <option value="weekly_first">Weekly First</option>
                          <option value="daily_first">Daily First</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-455 pointer-events-none" size={13} />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setSelectedDepartment('all');
                          setSelectedDesignation('all');
                          setSelectedPeriod('all');
                          setGlobalSort('newest');
                          setIsFiltersOpen(false);
                        }}
                        className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-205 bg-slate-150 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                      >
                        Reset
                      </button>
                      {/* <button
                        onClick={() => setIsFiltersOpen(false)}
className="flex-1 py-2 text-xs font-bold uppercase tracking-wider bg-indigo-650 hover:bg-indigo-700 text-indigo-200 hover:text-white rounded-xl transition-all shadow-md shadow-indigo-850/10 cursor-pointer">                      </button> */}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-2xl px-5 py-4 text-sm text-red-700 dark:text-red-400"
        >
          <AlertCircle size={18} className="shrink-0" />
          {errorMsg}
        </motion.div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={36} />
          <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider">
            Retrieving {isMonthlyReports || isTeamReports ? 'team roster...' : 'employee roster...'}
          </p>
        </div>
      ) : (viewMode === 'employees' ? filteredEmployees.length === 0 : sortedReports.length === 0) ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 p-8 shadow-sm">
          <Users size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {viewMode === 'employees' ? (isMonthlyReports || isTeamReports ? 'No Team Members Found' : 'No Employees Found') : 'No Reports Found'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {viewMode === 'employees' ? 'Try adjusting your search query or filters.' : 'No saved PDF reports match your active filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-sm">
          <table className="w-full text-left border-collapse">
            {viewMode === 'employees' ? (
              <>
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="px-6 py-4">{isMonthlyReports || isTeamReports ? 'Team Member' : 'Employee'}</th>
                    <th className="px-6 py-4">Designation</th>
                    <th className="px-6 py-4">Saved Reports</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {paginatedEmployees.map((emp) => {
                    const config = getDesignationConfig(emp);
                    const initial = emp.name ? emp.name.charAt(0).toUpperCase() : '?';
                    const empId = emp._id || emp.id;
                    const isDownloading = downloading === empId;
                    const isExpanded = expandedEmpId === empId;
                    const sortOrder = sortOrders[empId] || 'newest';
                    const periodFilter = periodFilters[empId] || 'all';
                    const counts = getReportCounts(empId);
                    const visibleReports = getFilteredReports(empId);

                    return (
                      <React.Fragment key={empId}>
                        {/* Main Employee Row */}
                        <tr 
                          onClick={() => toggleExpand(empId)}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 flex items-center justify-center text-sm font-bold border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {emp.name}
                                </div>
                                <div className="text-xs text-slate-400 truncate mt-0.5">{emp.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider bg-indigo-50/50 dark:bg-lime-950/20 px-2.5 py-0.5 rounded-full inline-block">
                              {emp.designationId?.name || emp.designation || emp.role || 'Staff Member'}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {counts.all === 0 ? (
                                <span className="text-xs text-slate-400 dark:text-slate-650 italic">No reports yet</span>
                              ) : (
                                <>
                                  {counts.daily > 0 && (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50">
                                      {counts.daily} Daily
                                    </span>
                                  )}
                                  {counts.weekly > 0 && (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50">
                                      {counts.weekly} Weekly
                                    </span>
                                  )}
                                  {counts.monthly > 0 && (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50">
                                      {counts.monthly} Monthly
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {/* AI Insight Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAiConcludeEmployee(emp);
                                }}
                                disabled={loadingPreviewId === empId}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-purple-200/50 dark:border-purple-800/50 bg-gradient-to-r from-purple-700 via-indigo-600 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white shadow-sm hover:shadow-md cursor-pointer shrink-0"
                                title={`Fetch all reports of ${emp.name} and generate AI Insights`}
                              >
                                {loadingPreviewId === empId ? (
                                  <Loader2 size={13} className="animate-spin text-amber-300" />
                                ) : (
                                  <Brain size={13} className="text-amber-300 animate-pulse shrink-0" />
                                )}
                                <span>Insight</span>
                              </button>

                              {/* Toggle Expand Arrow */}
                              <button
                                onClick={() => toggleExpand(empId)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-300 transition-colors"
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable History Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/30 dark:bg-slate-900/10">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                {/* Header row: count + sort */}
                                <div className="flex items-center justify-between border-t border-slate-150/40 dark:border-slate-800/30 pt-3 mb-3">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Saved Reports ({counts.all})
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">Sort:</span>
                                    <select
                                      value={sortOrder}
                                      onChange={(e) => handleSortChange(empId, e.target.value)}
                                      className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 border-none rounded-lg px-2 py-1 outline-none cursor-pointer transition-colors"
                                    >
                                      <option value="newest">Newest First</option>
                                      <option value="oldest">Oldest First</option>
                                      <option value="monthly_first">Monthly First</option>
                                      <option value="weekly_first">Weekly First</option>
                                      <option value="daily_first">Daily First</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Period filter tabs */}
                                {!isMonthlyReports && (
                                  <div className="flex items-center gap-1 mb-3 flex-wrap">
                                    {[
                                      { value: 'all',     label: `All (${counts.all})`,           cls: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
                                      { value: 'daily',   label: `Daily (${counts.daily})`,        cls: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
                                      { value: 'weekly',  label: `Weekly (${counts.weekly})`,      cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
                                      { value: 'monthly', label: `Monthly (${counts.monthly})`,    cls: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800' },
                                    ].filter(tab => !isNonOperational || tab.value !== 'daily').map(tab => (
                                      <button
                                        key={tab.value}
                                        onClick={() => handlePeriodFilterChange(empId, tab.value)}
                                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                                          periodFilter === tab.value
                                            ? `${tab.cls} ring-1 ring-current`
                                            : 'text-slate-450 dark:text-slate-650 bg-transparent border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                      >
                                        {tab.label}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Reports list */}
                                {loadingReportsMap[empId] ? (
                                  <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                                    <Loader2 size={12} className="animate-spin text-indigo-500" />
                                    <span>Loading reports...</span>
                                  </div>
                                ) : visibleReports.length === 0 ? (
                                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                                    {counts.all === 0 ? 'No PDF reports saved yet.' : `No ${periodFilter} reports found.`}
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1 py-1">
                                    {visibleReports.map((report) => {
                                      const period = report.report_period || 'daily';
                                      const pConf = PERIOD_CONFIG[period] || PERIOD_CONFIG.daily;
                                      const PeriodIcon = pConf.icon;
                                      const isThisDownloading = downloadingReportId === report._id;
                                      const isThisPreviewing = loadingPreviewId === report._id;

                                      return (
                                        <div
                                          key={report._id}
                                          className="flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800/30 dark:hover:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl text-left transition-all hover:shadow-sm group/row"
                                        >
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0 ${pConf.color}`}>
                                              <PeriodIcon size={9} />
                                              {pConf.label}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-355 truncate">
                                              {report.report_date}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {/* View Button */}
                                            <button
                                              onClick={() => handleViewReport(emp, report)}
                                              disabled={isThisPreviewing}
                                              className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                                              title={`View ${period} report (${report.report_date})`}
                                            >
                                              {isThisPreviewing ? (
                                                <Loader2 size={12} className="animate-spin text-purple-500" />
                                              ) : (
                                                <Eye size={13} />
                                              )}
                                            </button>
                                            {/* Download Button */}
                                            <button
                                              onClick={() => handleDownloadSavedReport(emp, report)}
                                              disabled={isThisDownloading}
                                              className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                              title={`Download ${period} report (${report.report_date})`}
                                            >
                                              {isThisDownloading ? (
                                                <Loader2 size={12} className="animate-spin text-indigo-500" />
                                              ) : (
                                                <FileDown size={13} />
                                              )}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="px-6 py-4">Report Date</th>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Designation</th>
                    <th className="px-6 py-4">Period</th>
                    <th className="px-6 py-4">Filename</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {paginatedReports.map((report) => {
                    const emp = report.employee;
                    const initial = emp.name ? emp.name.charAt(0).toUpperCase() : '?';
                    const period = report.report_period || 'daily';
                    const pConf = PERIOD_CONFIG[period] || PERIOD_CONFIG.daily;
                    const PeriodIcon = pConf.icon;
                    const isThisDownloading = downloadingReportId === report._id;

                    return (
                      <tr key={report._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 font-semibold text-xs text-slate-700 dark:text-slate-350">
                          {report.report_date}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {emp.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-lime-400 uppercase tracking-wider bg-indigo-50/50 dark:bg-lime-950/20 px-2.5 py-0.5 rounded-full inline-block">
                            {emp.designationId?.name || emp.designation || emp.role || 'Staff Member'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0 ${pConf.color}`}>
                            <PeriodIcon size={9} />
                            {pConf.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                          {report.filename}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewReport(emp, report)}
                              disabled={loadingPreviewId === report._id}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-purple-100 dark:border-purple-900/40 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-950/60 text-purple-600 dark:text-purple-400 hover:shadow-sm cursor-pointer"
                              title="View PDF report without downloading"
                            >
                              {loadingPreviewId === report._id ? (
                                <Loader2 size={12} className="animate-spin text-purple-500" />
                              ) : (
                                <Eye size={12} />
                              )}
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => handleDownloadSavedReport(emp, report)}
                              disabled={isThisDownloading}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:shadow-sm cursor-pointer"
                              title="Download PDF report"
                            >
                              {isThisDownloading ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <FileDown size={12} />
                              )}
                              <span>Download</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            )}
          </table>

          {/* Pagination Controls */}
          {((viewMode === 'employees' ? filteredEmployees.length : sortedReports.length) > itemsPerPage) && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, viewMode === 'employees' ? filteredEmployees.length : sortedReports.length)} of {viewMode === 'employees' ? filteredEmployees.length : sortedReports.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil((viewMode === 'employees' ? filteredEmployees.length : sortedReports.length) / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil((viewMode === 'employees' ? filteredEmployees.length : sortedReports.length) / itemsPerPage)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* PDF Report Preview Modal */}
      {previewPdfModal.isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-5xl h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl border border-purple-500/20">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    {previewPdfModal.title}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400">
                    {previewPdfModal.emp?.name} — {previewPdfModal.emp?.designationId?.name || previewPdfModal.emp?.designation || 'Staff Report'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAnalyzeSingleEmployee(previewPdfModal.emp, previewPdfModal.report)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  title="Generate AI summary of this employee report"
                >
                  <Sparkles size={14} className="text-amber-300 animate-pulse" />
                  <span>AI Summarize</span>
                </button>
                <a
                  href={previewPdfModal.url}
                  download={previewPdfModal.report?.filename || `Report_${previewPdfModal.report?.report_date || 'preview'}.pdf`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <FileDown size={14} />
                  <span>Download PDF</span>
                </a>
                <button
                  onClick={() => {
                    if (previewPdfModal.url) URL.revokeObjectURL(previewPdfModal.url);
                    setPreviewPdfModal({ isOpen: false, url: null, title: '', report: null, emp: null });
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* PDF Viewer Canvas Body */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden">
              <iframe
                src={previewPdfModal.url}
                className="w-full h-full rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-inner"
                title="PDF Document Preview"
              />
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Dedicated Employee Reports AI Analysis Modal */}
      <AiAnalyzeModal
        isOpen={isEmployeeAiOpen}
        onClose={() => setIsEmployeeAiOpen(false)}
        contextData={employeeAiContext}
        title={employeeAiTitle}
      />
    </div>
  );
};

export default EmployeeReports;
