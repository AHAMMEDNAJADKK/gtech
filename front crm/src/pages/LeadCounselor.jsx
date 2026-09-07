import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit3, Trash2, Eye, X, Mail, Phone,
  Folder, User, ChevronRight, CheckCircle2, AlertTriangle,
  FileSpreadsheet, FileDown, FileText, Loader2, Calendar,
  TrendingUp, Clock, Tag, MessageSquare, Briefcase, RefreshCw, Send,
  UserCheck, Shield, HelpCircle, SlidersHorizontal, ChevronDown,
  LayoutList, LayoutGrid
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // 👈 Import it as a direct function
const API_BASE = import.meta.env.VITE_API_URL;

const getISTDate = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(new Date());
};

const STATUS_META = {
  'New': { label: 'New', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400', dot: 'bg-blue-500' },
  'Contacted': { label: 'Contacted', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400', dot: 'bg-indigo-500' },
  'Follow Up': { label: 'Follow Up', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400', dot: 'bg-amber-500' },
  'Interested': { label: 'Interested', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400', dot: 'bg-purple-500' },
  'Converted': { label: 'Converted', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Lost': { label: 'Lost', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400', dot: 'bg-rose-500' }
};

const STATUS_COLORS = {
  'NEW':        { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  'CONTACTED':  { bg: '#e0e7ff', text: '#4338ca', border: '#a5b4fc' },
  'FOLLOW UP':  { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  'INTERESTED': { bg: '#f3e8ff', text: '#6b21a8', border: '#c4b5fd' },
  'CONVERTED':  { bg: '#d1fae5', text: '#047857', border: '#6ee7b7' },
  'LOST':       { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' }
};

const getStatusStyle = (value) => {
  const key = String(value || '').trim().toUpperCase();
  const colors = STATUS_COLORS[key];
  if (!colors) return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' };
  return { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border };
};

const PRIORITY_META = {
  'Low': { label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  'Medium': { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400' },
  'High': { label: 'High', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400' }
};

const COURSE_INTEREST_COLORS = {
  'HOT LEAD':     { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  'WARM LEAD':    { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
  'COLD LEAD':    { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  'WRONG LEAD':   { bg: '#fef9c3', text: '#a16207', border: '#fde047' },
  'RNT':          { bg: '#f3e8ff', text: '#6b21a8', border: '#c4b5fd' },
  'SWITCHED OFF': { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' },
  'CALL BACK':    { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
  'HIGH':         { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  'MEDIUM':       { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
  'LOW':          { bg: '#fef9c3', text: '#a16207', border: '#fde047' },
};

const getCourseInterestStyle = (value) => {
  const key = String(value || '').trim().toUpperCase();
  const colors = COURSE_INTEREST_COLORS[key];
  if (!colors) return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' };
  return { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border };
};

const INTEREST_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'HOT LEAD', label: 'HOT LEAD' },
  { value: 'WARM LEAD', label: 'WARM LEAD' },
  { value: 'COLD LEAD', label: 'COLD LEAD' },
  { value: 'RNT', label: 'RNT' },
  { value: 'SWITCHED OFF', label: 'SWITCHED OFF' },
  { value: 'WRONG LEAD', label: 'WRONG LEAD' },
  { value: 'CALL BACK', label: 'CALL BACK' },
];

const InterestDropdown = ({ value, onChange, disabled }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const style = getCourseInterestStyle(value);
  const label = INTEREST_OPTIONS.find(o => o.value === value)?.label || value || 'Select';

  return (
    <div ref={ref} className="relative inline-block w-full min-w-[150px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className="w-full flex items-center justify-between gap-1 border rounded-lg px-3 py-1.5 text-xs font-bold outline-none cursor-pointer shadow-sm transition-all duration-200 disabled:opacity-75 disabled:cursor-not-allowed"
        style={style}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 max-h-60 overflow-auto">
          {INTEREST_OPTIONS.map((opt) => {
            const optStyle = opt.value ? getCourseInterestStyle(opt.value) : {};
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-bold transition-colors duration-150 ${isSelected ? 'ring-1 ring-inset ring-slate-400' : 'hover:brightness-95'}`}
                style={opt.value ? { backgroundColor: optStyle.backgroundColor, color: optStyle.color } : {}}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const getRowClass = () => {
  return 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all duration-200 border-b border-slate-200/60 dark:border-slate-800';
};

const Leads = () => {
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return '—';
    }
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const [leads, setLeads] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, assigned, follow-up, converted, lost, or specific statuses
const [activePriority, setActivePriority] = useState('all');

  const [staffFilter, setStaffFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // desc = newest first
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const { showToast } = useToast();

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  // Operator checks
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error("Error reading operator profile info:", e);
    }
  }, []);

  const isPrivilegedUser = useMemo(() => {
    if (!currentUser) return false;
    const roleId = String(currentUser.role_id || currentUser.roleId || currentUser.role || '').toLowerCase().trim();
    return ['1', '2', 'hr', 'admin', 'superadmin'].includes(roleId);
  }, [currentUser]);

  const isAcademicCounselor = useMemo(() => {
    if (!currentUser) return false;
    const roleId = String(currentUser.role_id || currentUser.roleId || currentUser.role || '').toLowerCase().trim();
    const designation = String(currentUser.designation || currentUser.designationId?.name || currentUser.designation_id || '').toLowerCase().trim();
    const deptName = String(currentUser.department || currentUser.departmentId?.name || '').toLowerCase().trim();

    let desigId = '';
    if (currentUser.designationId) {
      if (typeof currentUser.designationId === 'object' && currentUser.designationId._id) {
        desigId = String(currentUser.designationId._id).trim();
      } else {
        desigId = String(currentUser.designationId).trim();
      }
    } else if (currentUser.designation_id) {
      desigId = String(currentUser.designation_id).trim();
    }

    const isCounselorOrTelecaller = (
      roleId === '3' ||
      designation.includes('counselor') ||
      designation.includes('telecaller') ||
      designation.includes('academic') ||
      designation.includes('sales') ||
      deptName.includes('counselor') ||
      deptName.includes('telecaller')
    );

    const isOps = designation.includes('operation') || designation.includes('ops') || deptName.includes('operation') || deptName.includes('ops');

    return isCounselorOrTelecaller && !isOps;
  }, [currentUser]);

  const isOperationManager = useMemo(() => {
    if (!currentUser) return false;
    if (isAcademicCounselor) return false;

    const roleId = String(currentUser.role_id || currentUser.roleId || currentUser.role || '').toLowerCase().trim();
    const designation = String(currentUser.designation || currentUser.designationId?.name || currentUser.designation_id || '').toLowerCase().trim();
    const deptName = String(currentUser.department || currentUser.departmentId?.name || '').toLowerCase().trim();

    return (
      ['1', '2', 'admin', 'superadmin', 'manager'].includes(roleId) ||
      designation.includes('operation') ||
      designation.includes('ops') ||
      designation.includes('manager') ||
      deptName.includes('operation') ||
      deptName.includes('ops') ||
      !!currentUser.isTeamLead
    );
  }, [currentUser, isAcademicCounselor]);

  const canEditAssignedTo = useMemo(() => {
    if (!currentUser) return false;
    if (isAcademicCounselor) return false;
    return isOperationManager;
  }, [isAcademicCounselor, isOperationManager]);

  const hasAccess = useMemo(() => {
    return true;
  }, []);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Fetch leads from backend
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (activeTab !== 'all') {
        queryParams.append('status', activeTab);
      }
      // Send date range to backend for server-side filtering only when both are present
      if (dateFrom && dateTo) {
        queryParams.append('dateFrom', dateFrom);
        queryParams.append('dateTo', dateTo);
      }

      const res = await fetch(`${API_BASE}/v1/leads?${queryParams.toString()}`, {
        headers: getAuthHeaders()
      });
      const resJson = await res.json();

      const isLeadRelevantForCounselor = (l) => {
        const interest = (l.interestedService || '').trim().toUpperCase();
        if (!interest || interest === 'SELECT' || interest === '—' || interest.includes('SOFTWARE DEVELOPMENT')) {
          return false;
        }
        return true;
      };

      if (resJson.success && Array.isArray(resJson.data)) {
        setLeads(resJson.data.filter(isLeadRelevantForCounselor));
      } else if (Array.isArray(resJson)) {
        setLeads(resJson.filter(isLeadRelevantForCounselor));
      } else {
        setLeads([]);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      showToast('Could not reload leads list.', 'error');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, staffFilter, dateFrom, dateTo, getAuthHeaders, showToast]);

  // Fetch staff list for assignments
  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/users/list`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setStaff(data);
      } else if (data && Array.isArray(data.data)) {
        setStaff(data.data);
      } else {
        setStaff([]);
      }
    } catch (error) {
      console.error('Failed to fetch staff list:', error);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (hasAccess) {
      fetchLeads();
    }
  }, [fetchLeads, hasAccess]);

  useEffect(() => {
    if (hasAccess) {
      fetchStaff();
    }
  }, [fetchStaff, hasAccess]);

  // Fetch lead timeline/details
  const fetchLeadDetails = async (leadId) => {
    try {
      setDetailsLoading(true);
      const res = await fetch(`${API_BASE}/v1/leads/${leadId}`, {
        headers: getAuthHeaders()
      });
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        setSelectedLeadDetails(resJson.data);
      } else {
        showToast('Failed to load lead followups history.', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch lead details:', error);
      showToast('Error loading details.', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleInlineUpdate = async (leadId, fieldName, value) => {
    try {
      const res = await fetch(`${API_BASE}/v1/leads/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: leadId,
          [fieldName]: value
        })
      });
      const data = await res.json();
      if (res.ok || data.success) {
        showToast('Lead updated successfully!', 'success');
        setLeads(prevLeads => prevLeads.map(l => {
          const lId = l.id || l._id;
          if (lId === leadId) {
            return { ...l, [fieldName]: value };
          }
          return l;
        }));
      } else {
        showToast(data.message || 'Failed to update lead.', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to update lead.', 'error');
    }
  };

  // Tab counts
  const tabCounts = useMemo(() => {
    const leadsForStatusCounting = leads.filter(lead => {
      // City dropdown filter
      if (cityFilter !== 'all' && lead.city?.trim().toLowerCase() !== cityFilter.toLowerCase()) return false;
      // Date range filter
      if (dateFrom && new Date(lead.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(lead.createdAt) > toDate) return false;
      }
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          lead.leadName?.toLowerCase().includes(query) ||
          lead.phone?.toLowerCase().includes(query) ||
          lead.email?.toLowerCase().includes(query) ||
          lead.companyName?.toLowerCase().includes(query) ||
          lead.city?.toLowerCase().includes(query) ||
          lead.source?.toLowerCase().includes(query) ||
          lead.interestedService?.toLowerCase().includes(query)
        );
      }
      return true;
    });

    const counts = {
      all: leadsForStatusCounting.length,
      assigned: leadsForStatusCounting.filter(l => l.assignedTo).length,
      'follow-up': leadsForStatusCounting.filter(l => l.status === 'Follow Up').length,
      converted: leadsForStatusCounting.filter(l => l.status === 'Converted').length,
      lost: leadsForStatusCounting.filter(l => l.status === 'Lost').length
    };

    return counts;
  }, [leads, cityFilter, dateFrom, dateTo, searchQuery]);

  // Unique cities extracted from loaded leads for the city dropdown
  const uniqueCities = useMemo(() => {
    const cities = leads
      .map(l => l.city)
      .filter(c => c && c.trim())
      .map(c => c.trim());
    return [...new Set(cities)].sort();
  }, [leads]);

  const filteredCities = useMemo(() => {
    const query = citySearchQuery.toLowerCase().trim();
    if (!query) return uniqueCities;
    return uniqueCities.filter(c => c.toLowerCase().includes(query));
  }, [uniqueCities, citySearchQuery]);

  // Filtered, searched & sorted leads
 const filteredLeads = useMemo(() => {
  let result = leads.filter(lead => {
    // Local tab filter (backup check)
    if (activeTab === 'assigned' && !lead.assignedTo) return false;
    if (activeTab === 'follow-up' && lead.status !== 'Follow Up') return false;
    if (activeTab === 'converted' && lead.status !== 'Converted') return false;
    if (activeTab === 'lost' && lead.status !== 'Lost') return false;
    if (activeTab !== 'all' && activeTab !== 'assigned' && activeTab !== 'follow-up' && activeTab !== 'converted' && activeTab !== 'lost') {
      if (lead.status !== activeTab) return false;
    }



    // City dropdown filter (client-side)
    if (cityFilter !== 'all') {
      if (lead.city?.trim().toLowerCase() !== cityFilter.toLowerCase()) return false;
    }

    // Date range filter (client-side backup – backend already filters, but keep for safety)
    if (dateFrom && dateTo) {
      const leadDate = new Date(lead.createdAt);
      const fromDate = new Date(dateFrom);
      if (leadDate < fromDate) return false;

      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (leadDate > toDate) return false;
    }

    // Search query filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.leadName?.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.companyName?.toLowerCase().includes(query) ||
      lead.city?.toLowerCase().includes(query) ||
      lead.source?.toLowerCase().includes(query) ||
      lead.interestedService?.toLowerCase().includes(query)
    );
  });

  // Sort
  result = [...result].sort((a, b) => {
    if (sortOrder === 'name_asc') {
      return (a.leadName || '').localeCompare(b.leadName || '');
    } else if (sortOrder === 'name_desc') {
      return (b.leadName || '').localeCompare(a.leadName || '');
    } else if (sortOrder === 'asc') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    } else {
      // desc — newest first (default)
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  return result;
}, [leads, activeTab, searchQuery, cityFilter, dateFrom, dateTo, sortOrder]);

  const paginatedLeads = useMemo(() => {
    const offset = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(offset, offset + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredLeads.length / itemsPerPage);
  }, [filteredLeads, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, cityFilter, dateFrom, dateTo, sortOrder, staffFilter]);

  const handleDeleteLead = (id, name) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    const { id, name } = deleteConfirm;
    setDeleteConfirm({ isOpen: false, id: null, name: '' });
    try {
      const res = await fetch(`${API_BASE}/v1/leads/delete/${id}`, {
        method: 'POST', // Supports POST/DELETE
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok || data.success) {
        setLeads(prev => prev.filter(l => l.id !== id && l._id !== id));
        showToast('Lead records cleared successfully.', 'success');
      } else {
        showToast(data.message || 'Deletion failed.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Internal server error during deletion.', 'error');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredLeads.length === 0) {
      showToast('No leads available to export.', 'warning');
      return;
    }

    const exportData = filteredLeads.map((l, index) => ({
      'S.No': index + 1,
      'Lead Name': l.leadName || '',
      'Company Name': l.companyName || '',
      'Phone Number': l.phone || '',
      'Email': l.email || '',
      'Source': l.source || '',
      'Interested Service': l.interestedService || '',
      'Status': l.status || 'New',
      'Priority': l.priority || 'Medium',
      'City / Place': l.city || 'N/A',
      'Client Meeting Fixed': l.clientMeetingFixed || 'Pending',
      'Admission Status': l.admissionYesNo || 'Pending',
      'Leads Received Date': l.leadsReceivedDate ? new Date(l.leadsReceivedDate).toLocaleDateString() : 'N/A',
      '1st Follow Up Date': l.followUpDate1 ? new Date(l.followUpDate1).toLocaleDateString() : 'N/A',
      '2nd Follow Up Date': l.followUpDate2 ? new Date(l.followUpDate2).toLocaleDateString() : 'N/A',
      '3rd Follow Up Date': l.followUpDate3 ? new Date(l.followUpDate3).toLocaleDateString() : 'N/A',
      '4th Follow Up Date': l.followUpDate4 ? new Date(l.followUpDate4).toLocaleDateString() : 'N/A',
      '5th Follow Up Date': l.followUpDate5 ? new Date(l.followUpDate5).toLocaleDateString() : 'N/A',
      'Next Follow Up': l.nextFollowUpDate ? new Date(l.nextFollowUpDate).toLocaleDateString() : 'N/A',
      'Remarks': l.remarks || '',
      'Created Date': new Date(l.createdAt).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, `CRM_Leads_${activeTab}_Export.xlsx`);
    showToast('Excel report downloaded successfully!', 'success');
  };

  const handleExportPDF = () => {
  if (filteredLeads.length === 0) {
    showToast('No leads available to export.', 'warning');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('KOD.BRAND CRM - Leads Directory', 14, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Export Tab: ${activeTab.toUpperCase()} | Generated: ${new Date().toLocaleString()}`, 14, 21);

  const headers = [['Lead Name', 'Phone', 'Source', 'Service', 'Leads Received', '1st Followup', '2nd Followup', '3rd Followup', '4th Followup', '5th Followup', 'Remarks', 'Meeting', 'Admission', 'Status']];
  const body = filteredLeads.map(l => [
    l.leadName || '',
    l.phone || '',
    l.source || '',
    l.interestedService || '',
    l.leadsReceivedDate ? new Date(l.leadsReceivedDate).toLocaleDateString() : 'N/A',
    l.followUpDate1 ? new Date(l.followUpDate1).toLocaleDateString() : 'N/A',
    l.followUpDate2 ? new Date(l.followUpDate2).toLocaleDateString() : 'N/A',
    l.followUpDate3 ? new Date(l.followUpDate3).toLocaleDateString() : 'N/A',
    l.followUpDate4 ? new Date(l.followUpDate4).toLocaleDateString() : 'N/A',
    l.followUpDate5 ? new Date(l.followUpDate5).toLocaleDateString() : 'N/A',
    l.remarks || '',
    l.clientMeetingFixed || 'Pending',
    l.admissionYesNo || 'Pending',
    l.status || 'New'
  ]);

  // ✅ FIX: Pass 'doc' explicitly as the first argument
  autoTable(doc, {
    startY: 25,
    head: headers,
    body: body,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] }, // Indigo
    styles: { fontSize: 8 },
    margin: { top: 25 }
  });

  doc.save(`CRM_Leads_${activeTab}_Report.pdf`);
  showToast('PDF report generated successfully!', 'success');
};

  if (!currentUser) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-950/20">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">Loading Telecaller Leads Directory...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 text-slate-800 dark:text-slate-100">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center backdrop-blur-md"
        >
          <div className="mx-auto w-16 h-16 bg-red-500/10 dark:bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-6">
            <Shield size={36} />
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white mb-2">
            Access <span className="text-red-500">Restricted</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            This Leads Directory is reserved exclusively for the <strong>Telecallers Department</strong> or operators with <strong>Role 3</strong> access. Your current profile does not have authorization to view this data.
          </p>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95"
          >
            Return to Command Center
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8 bg-slate-50/50 dark:bg-slate-950/20 text-slate-800 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 italic tracking-tighter leading-none">
              LEADS <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-900/80 via-purple-700/60 to-slate-400 dark:from-purple-400 dark:to-slate-500">DIRECTORY</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <FileDown size={16} />
              Export Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <FileText size={16} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          {[
            { id: 'all', label: 'All Leads', count: tabCounts.all },
            // { id: 'assigned', label: 'Assigned Leads', count: tabCounts.assigned },
            // { id: 'follow-up', label: 'Follow-Up', count: tabCounts['follow-up'] },
            // { id: 'converted', label: 'Converted', count: tabCounts.converted },
            // { id: 'lost', label: 'Lost', count: tabCounts.lost }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id
                  ? 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar + Filter Button Row */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">

            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name, phone, email, company, city, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filters Button */}
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(prev => !prev)}
                className={`relative flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm ${
                  isFilterOpen
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/25'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800/80 hover:border-indigo-400 hover:text-indigo-600'
                }`}
              >
                <SlidersHorizontal size={15} />
                Filters
                <ChevronDown size={13} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                {/* Active filter count badge */}
                {(() => {
                  const count = [
                    activeTab !== 'all',
                    staffFilter !== 'all',
                    cityFilter !== 'all',
                    !!dateFrom,
                    !!dateTo,
                    sortOrder !== 'desc'
                  ].filter(Boolean).length;
                  return count > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center bg-rose-500 text-white text-[9px] font-bold rounded-full">
                      {count}
                    </span>
                  ) : null;
                })()}
              </button>

              {/* Filter Dropdown Panel */}
              {isFilterOpen && (
                <>
                  {/* Backdrop to close */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsFilterOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-[calc(100%+8px)] z-40 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/10 p-4 space-y-4"
                  >
                    {/* Panel Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <SlidersHorizontal size={13} className="text-indigo-500" />
                        Filter & Sort
                      </span>
                      <button
                        onClick={() => {
                          setActiveTab('all');
                          setActivePriority('all');
                          setStaffFilter('all');
                          setCityFilter('all');
                          setCitySearchQuery('');
                          setIsCityDropdownOpen(false);
                          setDateFrom('');
                          setDateTo(getISTDate());
                          setSortOrder('desc');
                        }}
                        className="text-[10px] text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        Reset all
                      </button>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800" />

                    {/* Sort Order */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sort By</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { val: 'desc', label: '🕐 Newest First' },
                          { val: 'asc',  label: '🕐 Oldest First' },
                          { val: 'name_asc',  label: '🔤 Name A–Z' },
                          { val: 'name_desc', label: '🔤 Name Z–A' }
                        ].map(opt => (
                          <button
                            key={opt.val}
                            onClick={() => setSortOrder(opt.val)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-semibold text-left transition-all cursor-pointer ${
                              sortOrder === opt.val
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* City Filter */}
                    <div className="space-y-1.5 relative">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">City / Place</label>
                      <button
                        type="button"
                        onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-left flex items-center justify-between focus:ring-2 focus:ring-indigo-500 outline-none transition cursor-pointer"
                      >
                        <span className="truncate">{cityFilter === 'all' ? '📍 All Cities' : `📍 ${cityFilter}`}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isCityDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 space-y-2 max-h-60 flex flex-col">
                          <input
                            type="text"
                            placeholder="🔍 Search city..."
                            value={citySearchQuery}
                            onChange={(e) => setCitySearchQuery(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-755 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            autoFocus
                          />
                          <div className="overflow-y-auto flex-1 max-h-40 space-y-0.5 pr-1 scrollbar-thin">
                            <button
                              type="button"
                              onClick={() => {
                                setCityFilter('all');
                                setIsCityDropdownOpen(false);
                                setCitySearchQuery('');
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                                cityFilter === 'all'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-bold'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-355'
                              }`}
                            >
                              📍 All Cities
                            </button>
                            {filteredCities.length === 0 ? (
                              <p className="text-[10px] text-slate-450 text-center py-2 uppercase font-semibold">No cities found</p>
                            ) : (
                              filteredCities.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => {
                                    setCityFilter(c);
                                    setIsCityDropdownOpen(false);
                                    setCitySearchQuery('');
                                  }}
                                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition truncate cursor-pointer ${
                                    cityFilter.toLowerCase() === c.toLowerCase()
                                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-bold'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-355'
                                  }`}
                                >
                                  {c}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { val: 'all',       label: 'All' },
                          { val: 'New',       label: 'New' },
                          { val: 'Contacted', label: 'Contacted' },
                          { val: 'Follow Up', label: 'Follow Up' },
                          { val: 'Interested',label: 'Interested' },
                          { val: 'Converted', label: 'Converted' },
                          { val: 'Lost',      label: 'Lost' }
                        ].map(opt => (
                          <button
                            key={opt.val}
                            onClick={() => { setActiveTab(opt.val === 'all' ? 'all' : opt.val); }}
                            className={`py-2 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
                              activeTab === opt.val
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Staff Filter (privileged only) */}
                    {isPrivilegedUser && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Staff</label>
                        <select
                          value={staffFilter}
                          onChange={(e) => setStaffFilter(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        >
                          <option value="all">All Assigned Staff</option>
                          {staff.map(member => (
                            <option key={member.id || member._id} value={member.id || member._id}>
                              {member.name} ({member.designation || 'Staff'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Date Range */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Range</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="block text-[9px] text-slate-400 mb-1 font-semibold">FROM</span>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            max={dateTo || getISTDate()}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] focus:ring-2 focus:ring-indigo-500 outline-none transition"
                          />
                        </div>
                        <div>
                          <span className="block text-[9px] text-slate-400 mb-1 font-semibold">TO</span>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            min={dateFrom || undefined}
                            max={getISTDate()}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] focus:ring-2 focus:ring-indigo-500 outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Apply / Close */}
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Apply Filters
                    </button>
                  </motion.div>
                </>
              )}
            </div>

            {/* View Mode Toggle (List / Grid) */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-1 rounded-2xl shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#3b1263] text-white shadow-md shadow-purple-950/30'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="List View"
              >
                <LayoutList size={15} />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#3b1263] text-white shadow-md shadow-purple-950/30'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={15} />
                <span>Grid</span>
              </button>
            </div>

            {/* Page Size Selector */}
            {filteredLeads.length > 10 && (
              <select
                value={itemsPerPage === 100000 ? 'all' : itemsPerPage}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemsPerPage(val === 'all' ? 100000 : parseInt(val, 10));
                  setCurrentPage(1);
                }}
                className="px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-400 hover:text-indigo-600 focus:outline-none shadow-sm cursor-pointer transition-all outline-none"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value="all">Show All</option>
              </select>
            )}
          </div>          {(activeTab !== 'all' || activePriority !== 'all' || staffFilter !== 'all' || cityFilter !== 'all' || (dateFrom && dateTo) || sortOrder !== 'desc') && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Active:</span>
              {activeTab !== 'all' && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-full text-[10px] font-semibold">
                  📋 {activeTab === 'follow-up' ? 'Follow Up' : activeTab === 'assigned' ? 'Assigned' : activeTab}
                  <button onClick={() => setActiveTab('all')} className="ml-0.5 hover:text-indigo-800 cursor-pointer leading-none">×</button>
                </span>
              )}
              {cityFilter !== 'all' && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20 rounded-full text-[10px] font-semibold">
                  📍 {cityFilter}
                  <button onClick={() => { setCityFilter('all'); setCitySearchQuery(''); setIsCityDropdownOpen(false); }} className="ml-0.5 hover:text-teal-800 cursor-pointer leading-none">×</button>
                </span>
              )}
              {staffFilter !== 'all' && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20 rounded-full text-[10px] font-semibold">
                  👤 {staff.find(m => (m.id || m._id) === staffFilter)?.name || 'Staff'}
                  <button onClick={() => setStaffFilter('all')} className="ml-0.5 hover:text-teal-800 cursor-pointer leading-none">×</button>
                </span>
              )}
              {sortOrder !== 'desc' && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-[10px] font-semibold">
                  {{ asc: '🕐 Oldest First', name_asc: '🔤 A–Z', name_desc: '🔤 Z–A' }[sortOrder]}
                  <button onClick={() => setSortOrder('desc')} className="ml-0.5 hover:text-slate-800 cursor-pointer leading-none">×</button>
                </span>
              )}
              {dateFrom && dateTo && (
                <>
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-full text-[10px] font-semibold">
                    From {new Date(dateFrom + 'T00:00:00').toLocaleDateString()}
                    <button onClick={() => { setDateFrom(''); setDateTo(getISTDate()); }} className="ml-0.5 hover:text-amber-800 cursor-pointer leading-none">×</button>
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-full text-[10px] font-semibold">
                    To {new Date(dateTo + 'T00:00:00').toLocaleDateString()}
                    <button onClick={() => { setDateFrom(''); setDateTo(getISTDate()); }} className="ml-0.5 hover:text-amber-800 cursor-pointer leading-none">×</button>
                  </span>
                </>
              )}
              <button
                onClick={() => { setActiveTab('all'); setActivePriority('all');setStaffFilter('all'); setCityFilter('all'); setCitySearchQuery(''); setIsCityDropdownOpen(false); setDateFrom(''); setDateTo(getISTDate()); setSortOrder('desc'); }}
                className="text-[10px] text-slate-400 hover:text-rose-500 underline cursor-pointer transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Lead Table Container */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
            <p className="text-xs text-slate-500">Loading leads index records...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm text-center px-4">
            <AlertTriangle className="text-slate-300 dark:text-slate-700 mb-4" size={48} />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No leads found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              There are no leads matched for the current selection. Click "Add Lead" or import an Excel spreadsheet sheet to add leads to your dashboard.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Mode */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedLeads.map((lead) => {
                const courseStyle = getCourseInterestStyle(lead.interestedService);
                return (
                  <div
                    key={lead.id || lead._id}
                    className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Top Header & Status */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            {lead.leadName}
                          </h3>
                          {lead.companyName && !lead.companyName.toLowerCase().includes('software development leads form') && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Briefcase size={12} />
                              {lead.companyName}
                            </p>
                          )}
                        </div>

                        {(() => {
                          const ciVal = (lead.interestedService || lead.courseIntrests || '').trim();
                          const isUpdated = ciVal && ciVal.toLowerCase() !== 'select' && ciVal !== '—' && !ciVal.toLowerCase().includes('software development');
                          return isUpdated ? (
                            <span 
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider border shrink-0"
                              style={courseStyle}
                            >
                              {ciVal}
                            </span>
                          ) : null;
                        })()}
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                            <Phone size={13} className="text-slate-400" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 truncate">
                            <Mail size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                        {lead.city && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                            <span className="text-slate-400">📍</span>
                            <span>{lead.city}</span>
                          </div>
                        )}
                      </div>

                      {/* Campaign & Platform Badges */}
                      {((lead.campaignName && !lead.campaignName.toLowerCase().includes('software development leads form')) || lead.leadPlatform || lead.source) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          {lead.campaignName && !lead.campaignName.toLowerCase().includes('software development leads form') && (
                            <span 
                              className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 rounded-md font-semibold text-[9px] uppercase truncate max-w-[220px]"
                              title={lead.campaignName}
                            >
                              Campaign: {lead.campaignName}
                            </span>
                          )}
                          {lead.leadPlatform && !lead.leadPlatform.toLowerCase().includes('software development leads form') && (
                            <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/50 rounded-md font-semibold text-[9px] uppercase">
                              Platform: {lead.leadPlatform}
                            </span>
                          )}
                          {lead.source && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-semibold text-[9px] uppercase">
                              Source: {lead.source}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Inline Dropdowns for Counselor */}
                      <div className="grid grid-cols-2 gap-2 pt-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 mb-1">STATUS</label>
                          <select
                            value={lead.status || ''}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'status', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          >
                            <option value="" disabled>Select</option>
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Follow Up">Follow Up</option>
                            <option value="Interested">Interested</option>
                            <option value="Converted">Converted</option>
                            <option value="Lost">Lost</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 mb-1">COURSE INT.</label>
                          <select
                            value={lead.interestedService || ''}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'interestedService', e.target.value)}
                            className="w-full border rounded-lg px-2 py-1 text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                            style={lead.interestedService ? getCourseInterestStyle(lead.interestedService) : {}}
                          >
                            <option value="">Select</option>
                            <option value="HOT LEAD">HOT LEAD</option>
                            <option value="WARM LEAD">WARM LEAD</option>
                            <option value="COLD LEAD">COLD LEAD</option>
                            <option value="RNT">RNT</option>
                            <option value="SWITCHED OFF">SWITCHED OFF</option>
                            <option value="WRONG LEAD">WRONG LEAD</option>
                            <option value="CALL BACK">CALL BACK</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                        <Calendar size={12} />
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            fetchLeadDetails(lead.id || lead._id);
                            setIsViewOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsFollowUpOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                          title="Add Follow-up"
                        >
                          <Clock size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsEditOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                          title="Edit Lead"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead.id || lead._id, lead.leadName)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                          title="Delete Lead"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls for Grid View */}
            {filteredLeads.length > 10 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4.5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                <div className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-700 dark:text-slate-350">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-700 dark:text-slate-350">{Math.min(currentPage * itemsPerPage, filteredLeads.length)}</span> of <span className="font-semibold text-slate-700 dark:text-slate-350">{filteredLeads.length}</span> leads
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                            currentPage === pageNum
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-500/50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* List View Mode (Table) */
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead Info</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact Details</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">City / Place</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Campaign/platform</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Interest</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Source</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Leads Received</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">1st Followup</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">2nd Followup</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">3rd Followup</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">4th Followup</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">5th Followup</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Remarks</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Client Meeting</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Admission</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Created</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedLeads.map((lead) => {
                    const statusMeta = STATUS_META[lead.status] || { label: lead.status, color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
                    const priorityMeta = PRIORITY_META[lead.priority] || { label: lead.priority, color: 'bg-slate-100 text-slate-600' };

                    return (
                      <tr key={lead.id || lead._id} className={getRowClass()}>
                        {/* Name & Company */}
                        <td className="px-6 py-4.5">
                          <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            {lead.leadName}
                          </div>
                          {lead.companyName && (
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <Briefcase size={10} />
                              {lead.companyName}
                            </div>
                          )}
                          {/* <div className="flex flex-wrap items-center gap-1 mt-1.5 max-w-[180px]">
                            {lead.leadPlatform && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/30 rounded font-semibold text-[8px] uppercase">
                                {lead.leadPlatform}
                              </span>
                            )}
                            {lead.campaignName && (
                              <span className="px-1.5 py-0.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/30 rounded font-semibold text-[8px] uppercase">
                                {lead.campaignName}
                              </span>
                            )}
                          </div> */}
                        </td>

                        {/* Contact */}
                        <td className="px-6 py-4.5 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                            <Phone size={12} className="text-slate-400" />
                            {lead.phone}
                          </div>
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                              <Mail size={12} className="text-slate-400" />
                              {lead.email}
                            </div>
                          )}
                        </td>

                        {/* City / Place */}
                        <td className="px-6 py-4.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {lead.city || (
                            <span className="text-[10px] font-medium text-slate-400 italic">
                              Not Specified
                            </span>
                          )}
                        </td>
 {/* Source & Interested Service */}
                        <td className="px-6 py-4.5 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                            <Tag size={12} className="text-slate-400" />
                            {lead.campaignName || 'No Campaign'}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {/* {lead.source && (
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-[8px] uppercase">
                                Source: {lead.source}
                              </span>
                            )} */}
                            {lead.leadPlatform && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/30 rounded font-semibold text-[8px] uppercase">
                                Platform: {lead.leadPlatform}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                          <select
                            value={lead.status || ''}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'status', e.target.value)}
                            className="w-full min-w-[150px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="" disabled>Select</option>
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Follow Up">Follow Up</option>
                            <option value="Interested">Interested</option>
                            <option value="Converted">Converted</option>
                            <option value="Lost">Lost</option>
                          </select>
                        </td>
                        <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                          <InterestDropdown
                            value={lead.interestedService || lead.courseIntrests || lead.courseInterests || ''}
                            onChange={(val) => handleInlineUpdate(lead.id || lead._id, 'interestedService', val)}
                            disabled={false}
                          />
                        </td>

                        {/* Source */}
                        <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                          <select
                            value={lead.source || ''}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'source', e.target.value)}
                            className="w-full min-w-[150px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="" disabled>Select</option>
                            <option value="REFERENCE">REFERENCE</option>
                            <option value="INBOUND CALLS">INBOUND CALLS</option>
                            <option value="INBOUND MSG">INBOUND MSG</option>
                            <option value="MARKETING">MARKETING</option>
                          </select>
                        </td>

                        {/* Leads Received Date */}
                        <td className="px-6 py-4.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="date"
                            value={formatDateForInput(lead.leadsReceivedDate)}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'leadsReceivedDate', e.target.value || null)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          />
                        </td>

                        {/* 1st Followup Date */}
                        <td className="px-6 py-4.5 text-xs">
                          <input
                            type="date"
                            value={formatDateForInput(lead.followUpDate1)}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate1', e.target.value || null)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          />
                        </td>

                        {/* 2nd Followup Date */}
                        <td className="px-6 py-4.5 text-xs">
                          <input
                            type="date"
                            value={formatDateForInput(lead.followUpDate2)}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate2', e.target.value || null)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          />
                        </td>

                        {/* 3rd Followup Date */}
                        <td className="px-6 py-4.5 text-xs">
                          <input
                            type="date"
                            value={formatDateForInput(lead.followUpDate3)}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate3', e.target.value || null)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          />
                        </td>

                        {/* 4th Followup Date */}
                        <td className="px-6 py-4.5 text-xs">
                          <input
                            type="date"
                            value={formatDateForInput(lead.followUpDate4)}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate4', e.target.value || null)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          />
                        </td>

                        {/* 5th Followup Date */}
                        <td className="px-6 py-4.5 text-xs">
                          <input
                            type="date"
                            value={formatDateForInput(lead.followUpDate5)}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate5', e.target.value || null)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          />
                        </td>

                        {/* Remarks */}
                        <td className="px-6 py-4.5 text-xs text-slate-600 dark:text-slate-350 max-w-xs truncate">
                          {lead.remarks || '—'}
                        </td>

                        {/* Client Meeting Fixed */}
                        <td className="px-6 py-4.5 text-xs">
                          <select
                            value={lead.clientMeetingFixed || ''}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'clientMeetingFixed', e.target.value)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          >
                            <option value="" disabled>Select</option>
                            <option value="Pending">Pending</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </td>

                        {/* Admission Status */}
                        <td className="px-6 py-4.5 text-xs">
                          <select
                            value={lead.admissionYesNo || ''}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'admissionYesNo', e.target.value)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                          >
                            <option value="" disabled>Select</option>
                            <option value="Pending">Pending</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </td>

                        {/* Created Date */}
                        <td className="px-6 py-4.5 text-xs">
                          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Calendar size={11} className="text-slate-400" />
                            {lead.createdAt
                              ? new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'
                            }
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedLead(lead);
                                fetchLeadDetails(lead.id || lead._id);
                                setIsViewOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-150 cursor-pointer"
                              title="View details & history"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLead(lead);
                                setIsFollowUpOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-150 cursor-pointer"
                              title="Add follow-up log"
                            >
                              <Clock size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLead(lead);
                                setIsEditOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-150 cursor-pointer"
                              title="Edit Lead"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead.id || lead._id, lead.leadName)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-150 cursor-pointer"
                              title="Delete Lead"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4.5 bg-slate-50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-700 dark:text-slate-350">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-700 dark:text-slate-350">{Math.min(currentPage * itemsPerPage, filteredLeads.length)}</span> of <span className="font-semibold text-slate-700 dark:text-slate-350">{filteredLeads.length}</span> leads
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-0.5">
                    {/* First Page */}
                    {currentPage > 2 && (
                      <button
                        onClick={() => setCurrentPage(1)}
                        className="w-8 h-8 rounded-xl text-xs font-bold transition bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-500/50 cursor-pointer"
                      >
                        1
                      </button>
                    )}
                    {currentPage > 3 && <span className="px-1.5 text-slate-400 text-xs">...</span>}
                    
                    {/* Dynamic Page Range */}
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      if (pageNum >= currentPage - 1 && pageNum <= currentPage + 1) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                              currentPage === pageNum
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-500/50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                      return null;
                    })}
                    
                    {currentPage < totalPages - 2 && <span className="px-1.5 text-slate-400 text-xs">...</span>}
                    {currentPage < totalPages - 1 && (
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="w-8 h-8 rounded-xl text-xs font-bold transition bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-500/50 cursor-pointer"
                      >
                        {totalPages}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* CREATE MODAL */}
      <CreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={fetchLeads}
        staff={staff}
        getAuthHeaders={getAuthHeaders}
        showToast={showToast}
        isPrivilegedUser={isPrivilegedUser}
      />

      {/* EDIT MODAL */}
      <EditModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedLead(null);
        }}
        onUpdated={fetchLeads}
        lead={selectedLead}
        staff={staff}
        getAuthHeaders={getAuthHeaders}
        showToast={showToast}
        isPrivilegedUser={isPrivilegedUser}
      />

      {/* VIEW / TIMELINE MODAL */}
      <ViewModal
        isOpen={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setSelectedLead(null);
          setSelectedLeadDetails(null);
        }}
        lead={selectedLead}
        details={selectedLeadDetails}
        loading={detailsLoading}
        showToast={showToast}
      />

      {/* ADD FOLLOWUP MODAL */}
      <FollowUpModal
        isOpen={isFollowUpOpen}
        onClose={() => {
          setIsFollowUpOpen(false);
          setSelectedLead(null);
        }}
        onFollowedUp={fetchLeads}
        lead={selectedLead}
        getAuthHeaders={getAuthHeaders}
        showToast={showToast}
      />

      {/* EXCEL IMPORT MODAL */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={fetchLeads}
        getAuthHeaders={getAuthHeaders}
        showToast={showToast}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Lead"
        message={`Are you sure you want to delete lead "${deleteConfirm.name}"? This will clear all follow-up history.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        type="danger"
      />

    </div>
  );
};

/* ==========================================
   CREATE LEAD MODAL COMPONENT
   ========================================== */
const CreateModal = ({ isOpen, onClose, onCreated, staff, getAuthHeaders, showToast, isPrivilegedUser }) => {
  const [formData, setFormData] = useState({
    leadName: '',
    companyName: '',
    email: '',
    phone: '',
    city: '',
    source: '',
    interestedService: '',
    campaignName: '',
    leadPlatform: '',
    assignedTo: '',
    status: '',
    priority: '',
    clientMeetingFixed: '',
    admissionYesNo: '',
    remarks: '',
    leadsReceivedDate: new Date().toISOString().split('T')[0],
    followUpDate1: '',
    followUpDate2: '',
    followUpDate3: '',
    followUpDate4: '',
    followUpDate5: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0 });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leadName || !formData.phone) {
      showToast('Lead name and phone number are required.', 'warning');
      return;
    }
    if (!/^\d{10}$/.test(formData.phone)) {
      showToast('Phone number must be exactly 10 digits.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/v1/leads/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok || data.success) {
        showToast('Lead record created successfully!', 'success');
        onCreated();
        onClose();
        // Reset form
        setFormData({
          leadName: '',
          companyName: '',
          email: '',
          phone: '',
          city: '',
          source: '',
          interestedService: '',
          campaignName: '',
          leadPlatform: '',
          assignedTo: '',
          status: '',
          priority: '',
          clientMeetingFixed: '',
          admissionYesNo: '',
          remarks: '',
          leadsReceivedDate: new Date().toISOString().split('T')[0],
          followUpDate1: '',
          followUpDate2: '',
          followUpDate3: '',
          followUpDate4: '',
          followUpDate5: ''
        });
      } else {
        showToast(data.message || 'Failed to create lead.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Internal Server Error.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 pt-16 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <Plus className="text-indigo-600" size={18} />
            Create Lead Profile
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Name *</label>
              <input
                type="text"
                required
                value={formData.leadName}
                onChange={e => setFormData({ ...formData, leadName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Company Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                maxLength={10}
                value={formData.phone}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData({ ...formData, phone: digits });
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border rounded-xl text-xs focus:ring-1 outline-none transition ${
                  formData.phone && formData.phone.length !== 10
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-slate-200 dark:border-slate-800 focus:ring-indigo-500'
                }`}
                placeholder="10-digit number"
              />
              {formData.phone && formData.phone.length !== 10 && (
                <p className="text-[10px] text-red-500 mt-1 ml-1">Must be exactly 10 digits.</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. john@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">City / Place</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. London"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Source</label>
              <select
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="" disabled>Select</option>
                <option value="REFERENCE">REFERENCE</option>
                <option value="INBOUND CALLS">INBOUND CALLS</option>
                <option value="INBOUND MSG">INBOUND MSG</option>
                <option value="MARKETING">MARKETING</option>
              </select>
            </div>
             <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Course Interest (Service)</label>
              <select
                value={formData.interestedService}
                onChange={e => setFormData({ ...formData, interestedService: e.target.value })}
                className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none transition"
                style={formData.interestedService ? getCourseInterestStyle(formData.interestedService) : {}}
              >
                <option value="">Select</option>
                <option value="HOT LEAD" style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}>🔥 HOT LEAD</option>
                <option value="WARM LEAD" style={{ backgroundColor: '#F0F9FF', color: '#0369A1' }}>🌤 WARM LEAD</option>
                <option value="COLD LEAD" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>❄️ COLD LEAD</option>
                <option value="RNT" style={{ backgroundColor: '#FAF5FF', color: '#7C3AED' }}>📵 RNT</option>
                <option value="SWITCHED OFF" style={{ backgroundColor: '#FDF2F8', color: '#DB2777' }}>📴 SWITCHED OFF</option>
                <option value="WRONG LEAD" style={{ backgroundColor: '#FEFCE8', color: '#A16207' }}>❌ WRONG LEAD</option>
                <option value="CALL BACK">📞 CALL BACK</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Platform</label>
              <input
                type="text"
                value={formData.leadPlatform}
                onChange={e => setFormData({ ...formData, leadPlatform: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. Facebook Ads"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Campaign Name</label>
              <input
                type="text"
                value={formData.campaignName}
                onChange={e => setFormData({ ...formData, campaignName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. Summer Campaign"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Client Meeting Fixed</label>
              <select
                value={formData.clientMeetingFixed}
                onChange={e => setFormData({ ...formData, clientMeetingFixed: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="" disabled>Select</option>
                <option value="Pending">Pending</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Admission Status</label>
              <select
                value={formData.admissionYesNo}
                onChange={e => setFormData({ ...formData, admissionYesNo: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="" disabled>Select</option>
                <option value="Pending">Pending</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            {canEditAssignedTo && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assign to Representative</label>
                <select
                  value={formData.assignedTo}
                  onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="">Unassigned</option>
                  {staff.map(member => (
                    <option key={member.id || member._id} value={member.id || member._id}>
                      {member.name} ({member.role === '1' || member.role === 'hr' ? 'HR' : member.role === '2' || member.role === 'admin' ? 'Admin' : 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Leads Received Date</label>
              <input
                type="date"
                value={formData.leadsReceivedDate}
                onChange={e => setFormData({ ...formData, leadsReceivedDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">1st Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate1}
                onChange={e => setFormData({ ...formData, followUpDate1: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">2nd Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate2}
                onChange={e => setFormData({ ...formData, followUpDate2: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">3rd Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate3}
                onChange={e => setFormData({ ...formData, followUpDate3: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">4th Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate4}
                onChange={e => setFormData({ ...formData, followUpDate4: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">5th Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate5}
                onChange={e => setFormData({ ...formData, followUpDate5: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Remarks / Description</label>
            <textarea
              rows={3}
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none"
              placeholder="e.g. Met at trade show. Needs quote by Friday."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition flex items-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Save Lead
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ==========================================
   EDIT LEAD MODAL COMPONENT
   ========================================== */
const EditModal = ({ isOpen, onClose, onUpdated, lead, staff, getAuthHeaders, showToast, isPrivilegedUser }) => {
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    leadName: '',
    companyName: '',
    email: '',
    phone: '',
    city: '',
    source: '',
    interestedService: '',
    campaignName: '',
    leadPlatform: '',
    assignedTo: '',
    status: '',
    priority: '',
    clientMeetingFixed: '',
    admissionYesNo: '',
    remarks: '',
    lostReason: '',
    leadsReceivedDate: '',
    followUpDate1: '',
    followUpDate2: '',
    followUpDate3: '',
    followUpDate4: '',
    followUpDate5: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        leadName: lead.leadName || '',
        companyName: lead.companyName || '',
        email: lead.email || '',
        phone: lead.phone || '',
        city: lead.city || '',
        source: lead.source || 'REFERENCE',
        interestedService: lead.interestedService || '',
        campaignName: lead.campaignName || '',
        leadPlatform: lead.leadPlatform || '',
        assignedTo: lead.assignedTo?._id || lead.assignedTo || '',
        status: lead.status || 'New',
        priority: lead.priority || 'Medium',
        clientMeetingFixed: lead.clientMeetingFixed || 'Pending',
        admissionYesNo: lead.admissionYesNo || 'Pending',
        remarks: lead.remarks || '',
        lostReason: lead.lostReason || '',
        leadsReceivedDate: formatDateForInput(lead.leadsReceivedDate),
        followUpDate1: formatDateForInput(lead.followUpDate1),
        followUpDate2: formatDateForInput(lead.followUpDate2),
        followUpDate3: formatDateForInput(lead.followUpDate3),
        followUpDate4: formatDateForInput(lead.followUpDate4),
        followUpDate5: formatDateForInput(lead.followUpDate5)
      });
    }
  }, [lead]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leadName || !formData.phone) {
      showToast('Lead name and phone are required.', 'warning');
      return;
    }
    if (!/^\d{10}$/.test(formData.phone)) {
      showToast('Phone number must be exactly 10 digits.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/v1/leads/update`, {
        method: 'POST', // Supports POST update with body id
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          id: lead.id || lead._id
        })
      });
      const data = await res.json();
      if (res.ok || data.success) {
        showToast('Lead details updated successfully!', 'success');
        onUpdated();
        onClose();
      } else {
        showToast(data.message || 'Failed to update lead.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Internal Server Error.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
<div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 pt-16 overflow-y-auto">    
  <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <Edit3 className="text-indigo-600" size={18} />
            Modify Lead Profile
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Name *</label>
              <input
                type="text"
                required
                value={formData.leadName}
                onChange={e => setFormData({ ...formData, leadName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Company Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                maxLength={10}
                value={formData.phone}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData({ ...formData, phone: digits });
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border rounded-xl text-xs focus:ring-1 outline-none transition ${
                  formData.phone && formData.phone.length !== 10
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-slate-200 dark:border-slate-800 focus:ring-indigo-500'
                }`}
                placeholder="10-digit number"
              />
              {formData.phone && formData.phone.length !== 10 && (
                <p className="text-[10px] text-red-500 mt-1 ml-1">Must be exactly 10 digits.</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">City / Place</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Source</label>
              <select
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="" disabled>Select</option>
                <option value="REFERENCE">REFERENCE</option>
                <option value="INBOUND CALLS">INBOUND CALLS</option>
                <option value="INBOUND MSG">INBOUND MSG</option>
                <option value="MARKETING">MARKETING</option>
              </select>
            </div>
             <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Course Interest (Service)</label>
              <select
                value={formData.interestedService}
                onChange={e => setFormData({ ...formData, interestedService: e.target.value })}
                className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none transition"
                style={formData.interestedService ? getCourseInterestStyle(formData.interestedService) : {}}
              >
                <option value="">Select</option>
                <option value="HOT LEAD" style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}>🔥 HOT LEAD</option>
                <option value="WARM LEAD" style={{ backgroundColor: '#F0F9FF', color: '#0369A1' }}>🌤 WARM LEAD</option>
                <option value="COLD LEAD" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>❄️ COLD LEAD</option>
                <option value="RNT" style={{ backgroundColor: '#FAF5FF', color: '#7C3AED' }}>📵 RNT</option>
                <option value="SWITCHED OFF" style={{ backgroundColor: '#FDF2F8', color: '#DB2777' }}>📴 SWITCHED OFF</option>
                <option value="WRONG LEAD" style={{ backgroundColor: '#FEFCE8', color: '#A16207' }}>❌ WRONG LEAD</option>
                <option value="CALL BACK">📞 CALL BACK</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Platform</label>
              <input
                type="text"
                value={formData.leadPlatform}
                onChange={e => setFormData({ ...formData, leadPlatform: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. Facebook Ads"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Campaign Name</label>
              <input
                type="text"
                value={formData.campaignName}
                onChange={e => setFormData({ ...formData, campaignName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. Summer Campaign"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Client Meeting Fixed</label>
              <select
                value={formData.clientMeetingFixed}
                onChange={e => setFormData({ ...formData, clientMeetingFixed: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="" disabled>Select</option>
                <option value="Pending">Pending</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Admission Status</label>
              <select
                value={formData.admissionYesNo}
                onChange={e => setFormData({ ...formData, admissionYesNo: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="" disabled>Select</option>
                <option value="Pending">Pending</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            {canEditAssignedTo && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assign to Representative</label>
                <select
                  value={formData.assignedTo}
                  onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="">Unassigned</option>
                  {staff.map(member => (
                    <option key={member.id || member._id} value={member.id || member._id}>
                      {member.name} ({member.role === '1' || member.role === 'hr' ? 'HR' : member.role === '2' || member.role === 'admin' ? 'Admin' : 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Leads Received Date</label>
              <input
                type="date"
                value={formData.leadsReceivedDate}
                onChange={e => setFormData({ ...formData, leadsReceivedDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">1st Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate1}
                onChange={e => setFormData({ ...formData, followUpDate1: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">2nd Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate2}
                onChange={e => setFormData({ ...formData, followUpDate2: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">3rd Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate3}
                onChange={e => setFormData({ ...formData, followUpDate3: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">4th Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate4}
                onChange={e => setFormData({ ...formData, followUpDate4: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">5th Followup Date</label>
              <input
                type="date"
                value={formData.followUpDate5}
                onChange={e => setFormData({ ...formData, followUpDate5: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
          </div>

          {formData.status === 'Lost' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Reason for Lost Status</label>
              <input
                type="text"
                required
                value={formData.lostReason}
                onChange={e => setFormData({ ...formData, lostReason: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="e.g. Budget constraints, chose competitor"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Remarks / Notes</label>
            <textarea
              rows={3}
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition flex items-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ==========================================
   VIEW DETAILS & HISTORY MODAL
   ========================================== */
const ViewModal = ({ isOpen, onClose, lead, details, loading }) => {
  if (!isOpen || !lead) return null;

  return (
<div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 pt-16 overflow-y-auto">      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <TrendingUp className="text-indigo-600" size={18} />
            Lead Timeline Profile
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Top Lead Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Lead Name</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">{lead.leadName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Phone Number</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.phone}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Email Address</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Company Name</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.companyName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">City / Place</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.city || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Client Meeting Fixed</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.clientMeetingFixed || 'Pending'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Admission Status</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.admissionYesNo || 'Pending'}</span>
              </div>
            </div>

             <div className="space-y-2.5">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Source</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 dark:bg-slate-750 text-slate-750 dark:text-slate-250 rounded uppercase inline-block mt-0.5">{lead.source || 'Manual'}</span>
              </div>
              {lead.leadPlatform && (
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Lead Platform</span>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{lead.leadPlatform}</span>
                </div>
              )}
              {lead.campaignName && (
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Campaign Name</span>
                  <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">{lead.campaignName}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Interested Service</span>
                <span className="text-xs font-semibold text-slate-750 dark:text-slate-200">{lead.interestedService || 'General Sales Inquiry'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Assigned Staff</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.assignedTo?.name || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Next Follow Up</span>
                <span className="text-xs font-semibold text-amber-500">{lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toLocaleDateString() : 'None Scheduled'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Leads Received Date</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.leadsReceivedDate ? new Date(lead.leadsReceivedDate).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">1st Follow Up Date</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.followUpDate1 ? new Date(lead.followUpDate1).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">2nd Follow Up Date</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.followUpDate2 ? new Date(lead.followUpDate2).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">3rd Follow Up Date</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.followUpDate3 ? new Date(lead.followUpDate3).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">4th Follow Up Date</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.followUpDate4 ? new Date(lead.followUpDate4).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">5th Follow Up Date</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lead.followUpDate5 ? new Date(lead.followUpDate5).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Remarks</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{lead.remarks || '—'}</span>
              </div>
            </div>
          </div>

          {/* Timeline History Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock size={14} className="text-indigo-500" />
              Follow-Up Activity logs & History
            </h3>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-indigo-500" size={24} />
              </div>
            ) : !details || !details.followups || details.followups.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 pl-2">No follow-ups recorded yet for this lead.</p>
            ) : (
              <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 pl-5 space-y-5">
                {details.followups.map((item, idx) => (
                  <div key={item.id || item._id} className="relative group">
                    {/* Timeline Node Icon */}
                    <span className="absolute -left-[26px] top-1 h-3 w-3 bg-indigo-500 border-2 border-white dark:border-slate-900 rounded-full group-hover:scale-125 transition duration-150 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />

                    <div className="bg-slate-50 dark:bg-slate-800/25 border border-slate-200/50 dark:border-slate-800/40 p-4 rounded-2xl">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {item.createdBy?.name || 'System Operator'} ({item.createdBy?.role === '1' || item.createdBy?.role === 'hr' ? 'HR' : item.createdBy?.role === '2' || item.createdBy?.role === 'admin' ? 'Admin' : 'Staff'})
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-850 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                        {item.remarks}
                      </p>

                      {(item.callSummary || item.meetingNotes) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/40 grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                          {item.callSummary && (
                            <div className="bg-slate-100/50 dark:bg-slate-900/40 p-2 rounded-lg">
                              <span className="font-bold text-indigo-500 block">📞 Call Summary</span>
                              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{item.callSummary}</p>
                            </div>
                          )}
                          {item.meetingNotes && (
                            <div className="bg-slate-100/50 dark:bg-slate-900/40 p-2 rounded-lg">
                              <span className="font-bold text-indigo-500 block">👥 Meeting Notes</span>
                              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{item.meetingNotes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2 text-[8px] font-bold">
                        {item.statusChangedTo && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200/30">
                            Status: {item.statusChangedTo}
                          </span>
                        )}
                        {item.nextFollowUpDate && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/30 flex items-center gap-1">
                            <Calendar size={8} />
                            Next: {new Date(item.nextFollowUpDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close Timeline
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ==========================================
   FOLLOW UP LOGGING MODAL
   ========================================== */
const FollowUpModal = ({ isOpen, onClose, onFollowedUp, lead, getAuthHeaders, showToast }) => {
  const [formData, setFormData] = useState({
    remarks: '',
    nextFollowUpDate: '',
    callSummary: '',
    meetingNotes: '',
    statusChangedTo: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        remarks: '',
        nextFollowUpDate: lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().split('T')[0] : '',
        callSummary: '',
        meetingNotes: '',
        statusChangedTo: lead.status || 'Follow Up'
      });
    }
  }, [lead]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.remarks && !formData.callSummary && !formData.meetingNotes && !formData.statusChangedTo) {
      showToast('Please log some comments or status changes.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/v1/leads/followup`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          leadId: lead.id || lead._id
        })
      });
      const data = await res.json();
      if (res.ok || data.success) {
        showToast('Follow-up activity recorded successfully!', 'success');
        onFollowedUp();
        onClose();
      } else {
        showToast(data.message || 'Failed to submit follow-up.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error recording followup details.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
<div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 pt-16 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <Clock className="text-indigo-600" size={18} />
            Log Follow-Up Activity: {lead.leadName}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Interaction Notes / Remarks *</label>
            <textarea
              rows={3}
              required
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none"
              placeholder="Detail conversation, comments, or client reactions..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Update Status</label>
              <select
                value={formData.statusChangedTo}
                onChange={e => setFormData({ ...formData, statusChangedTo: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Interested">Interested</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Next Follow-Up Date</label>
              <input
                type="date"
                value={formData.nextFollowUpDate}
                onChange={e => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Call Details Summary (Optional)</label>
            <input
              type="text"
              value={formData.callSummary}
              onChange={e => setFormData({ ...formData, callSummary: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              placeholder="e.g. Called at 2PM, answered. Discussed pricing details."
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Meeting Notes / Agenda (Optional)</label>
            <input
              type="text"
              value={formData.meetingNotes}
              onChange={e => setFormData({ ...formData, meetingNotes: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition"
              placeholder="e.g. Schedule Google Meet for Friday 10AM."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition flex items-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Save History
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ==========================================
   DYNAMIC EXCEL IMPORT MAPPING MODAL
   ========================================== */
const ImportModal = ({ isOpen, onClose, onImported, getAuthHeaders, showToast }) => {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [excelRows, setExcelRows] = useState([]);
  const [mapping, setMapping] = useState({
    leadName: '',
    phone: '',
    email: '',
    companyName: '',
    city: '',
    source: '',
    interestedService: '',
    campaignName: '',
    leadPlatform: '',
    clientMeetingFixed: '',
    admissionYesNo: '',
    remarks: '',
    leadsReceivedDate: '',
    followUpDate1: '',
    followUpDate2: '',
    followUpDate3: '',
    followUpDate4: '',
    followUpDate5: ''
  });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const resetImportState = () => {
    setFile(null);
    setHeaders([]);
    setExcelRows([]);
    setMapping({
      leadName: '',
      phone: '',
      email: '',
      companyName: '',
      city: '',
      source: '',
      interestedService: '',
      campaignName: '',
      leadPlatform: '',
      clientMeetingFixed: '',
      admissionYesNo: '',
      remarks: '',
      leadsReceivedDate: '',
      followUpDate1: '',
      followUpDate2: '',
      followUpDate3: '',
      followUpDate4: '',
      followUpDate5: ''
    });
  };

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setLoading(true);
    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Fetch sheet rows as nested arrays to fetch exact headers!
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length === 0) {
          showToast('The uploaded Excel sheet is empty.', 'warning');
          setLoading(false);
          return;
        }

        const rawHeaders = jsonData[0].map(h => String(h).trim());
        setHeaders(rawHeaders);

        // Save sheet row records
        const rows = XLSX.utils.sheet_to_json(worksheet);
        setExcelRows(rows);

        // Attempt smart auto-mapping for social ads sheets and general formats
        const newMapping = {
          leadName: '',
          phone: '',
          email: '',
          companyName: '',
          city: '',
          source: '',
          interestedService: '',
          campaignName: '',
          leadPlatform: '',
          clientMeetingFixed: '',
          admissionYesNo: '',
          remarks: '',
          leadsReceivedDate: '',
          followUpDate1: '',
          followUpDate2: '',
          followUpDate3: '',
          followUpDate4: '',
          followUpDate5: ''
        };

        rawHeaders.forEach(header => {
          const lower = header.toLowerCase();
          if (lower === 'leadname' || lower.includes('full_name') || lower.includes('lead name') || lower === 'name' || lower.includes('customer name')) {
            newMapping.leadName = header;
          } else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact') || lower === 'tel') {
            newMapping.phone = header;
          } else if (lower.includes('email') || lower.includes('mail')) {
            newMapping.email = header;
          } else if (lower.includes('city') || lower.includes('place') || lower.includes('location') || lower.includes('town')) {
            newMapping.city = header;
          } else if (lower.includes('company') || lower.includes('organization') || lower.includes('firm')) {
            newMapping.companyName = header;
          } else if (lower.includes('source') || lower === 'utm_source') {
            newMapping.source = header;
          } else if (lower.includes('platform') || lower.includes('lead_platform') || lower.includes('lead platform')) {
            newMapping.leadPlatform = header;
          } else if (lower.includes('campaign') || lower.includes('campaign_name') || lower.includes('campaign name') || lower === 'utm_campaign') {
            newMapping.campaignName = header;
          } else if (lower.includes('service') || lower.includes('interested') || lower.includes('form') || lower.includes('service_interested')) {
            newMapping.interestedService = header;
          } else if (lower.includes('meeting') || lower.includes('client_meeting') || lower.includes('client meeting')) {
            newMapping.clientMeetingFixed = header;
          } else if (lower.includes('admission') || lower.includes('admitted')) {
            newMapping.admissionYesNo = header;
          } else if (lower.includes('remark') || lower.includes('note') || lower.includes('comment')) {
            newMapping.remarks = header;
          } else if (lower.includes('received') || lower.includes('uploaded') || lower.includes('received date')) {
            newMapping.leadsReceivedDate = header;
          } else if (lower.includes('followup date 1') || lower.includes('1st followup') || lower.includes('1 st followup')) {
            newMapping.followUpDate1 = header;
          } else if (lower.includes('followup date 2') || lower.includes('2nd followup') || lower.includes('2 nd followup')) {
            newMapping.followUpDate2 = header;
          } else if (lower.includes('followup date 3') || lower.includes('3rd followup') || lower.includes('3 rd followup')) {
            newMapping.followUpDate3 = header;
          } else if (lower.includes('followup date 4') || lower.includes('4th followup') || lower.includes('4 th followup')) {
            newMapping.followUpDate4 = header;
          } else if (lower.includes('followup date 5') || lower.includes('5th followup') || lower.includes('5 th followup')) {
            newMapping.followUpDate5 = header;
          }
        });

        // Set mapping state
        setMapping(newMapping);
      } catch (err) {
        console.error(err);
        showToast('Failed to parse Excel file.', 'error');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  // Preview mapped values
  const previewData = useMemo(() => {
    if (excelRows.length === 0) return [];
    return excelRows.slice(0, 3).map(row => ({
      leadName: row[mapping.leadName] || '—',
      phone: row[mapping.phone] || '—',
      email: row[mapping.email] || '—',
      city: row[mapping.city] || '—',
      companyName: row[mapping.companyName] || '—',
      source: row[mapping.source] || '—',
      interestedService: row[mapping.interestedService] || '—',
      campaignName: row[mapping.campaignName] || '—',
      leadPlatform: row[mapping.leadPlatform] || '—',
      clientMeetingFixed: row[mapping.clientMeetingFixed] || '—',
      admissionYesNo: row[mapping.admissionYesNo] || '—'
    }));
  }, [excelRows, mapping]);

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!mapping.leadName || !mapping.phone) {
      showToast('You must map the Lead Name and Phone Number fields.', 'warning');
      return;
    }

    try {
      setImporting(true);

      // Parse and construct the final payload
      const parseExcelDate = (val) => {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      const payloadLeads = excelRows.map(row => {
        // Retrieve source platform values, e.g. ig -> Instagram, fb -> Facebook
        let rawSource = row[mapping.source] || 'MARKETING';
        if (rawSource.toLowerCase() === 'ig') rawSource = 'Instagram';
        else if (rawSource.toLowerCase() === 'fb') rawSource = 'Facebook';

        // Clean phone number (strip 'p:' prepended by FB leads or spaces)
        let rawPhone = String(row[mapping.phone] || '').replace(/^p:/i, '').trim();

        return {
          leadName: row[mapping.leadName] || 'Unnamed Lead',
          phone: rawPhone,
          email: row[mapping.email] || '',
          companyName: row[mapping.companyName] || '',
          city: row[mapping.city] || '',
          source: rawSource,
          interestedService: row[mapping.interestedService] || '',
          campaignName: (row[mapping.campaignName] || '').trim().toLowerCase() === 'software development' ? '' : (row[mapping.campaignName] || ''),
          leadPlatform: row[mapping.leadPlatform] || '',
          clientMeetingFixed: row[mapping.clientMeetingFixed] || '',
          admissionYesNo: row[mapping.admissionYesNo] || '',
          remarks: row[mapping.remarks] || 'Imported from Excel spreadsheet.',
          leadsReceivedDate: parseExcelDate(row[mapping.leadsReceivedDate]),
          followUpDate1: parseExcelDate(row[mapping.followUpDate1]),
          followUpDate2: parseExcelDate(row[mapping.followUpDate2]),
          followUpDate3: parseExcelDate(row[mapping.followUpDate3]),
          followUpDate4: parseExcelDate(row[mapping.followUpDate4]),
          followUpDate5: parseExcelDate(row[mapping.followUpDate5])
        };
      }).filter(item => item.leadName && item.phone); // Filter out rows missing core details

      if (payloadLeads.length === 0) {
        showToast('No valid leads matching mapping credentials found.', 'warning');
        setImporting(false);
        return;
      }

      const res = await fetch(`${API_BASE}/v1/leads/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ leads: payloadLeads })
      });
      const data = await res.json();

      if (res.ok || data.success) {
        showToast(data.message || `Successfully imported ${payloadLeads.length} leads!`, 'success');
        onImported();
        onClose();
        resetImportState();
      } else {
        showToast(data.message || 'Import failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Internal Server Error.', 'error');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
<div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 pt-16 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="text-indigo-600" size={18} />
            Excel Data Import Mapper
          </h2>
          <button
            onClick={() => {
              onClose();
              resetImportState();
            }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* File Picker */}
          {!file ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center">
              <FileSpreadsheet className="text-slate-300 dark:text-slate-700 mb-3" size={40} />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Upload your Leads spreadsheet</p>
              <p className="text-[10px] text-slate-400 mt-1 mb-4">Supports .xlsx, .xls, and .csv files.</p>
              <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition">
                Select File
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <FileSpreadsheet className="text-emerald-500" size={16} />
                  <span>{file.name}</span>
                  <span className="text-[10px] text-slate-400">({excelRows.length} rows loaded)</span>
                </div>
                <button
                  type="button"
                  onClick={resetImportState}
                  className="text-rose-500 hover:underline text-[10px] font-bold cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {/* Mapper Fields */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Map excel headers to CRM fields:</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Name field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Lead Name *</label>
                    <select
                      value={mapping.leadName}
                      onChange={e => setMapping({ ...mapping, leadName: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Choose Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Phone field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone Number *</label>
                    <select
                      value={mapping.phone}
                      onChange={e => setMapping({ ...mapping, phone: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Choose Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Email field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Email Address</label>
                    <select
                      value={mapping.email}
                      onChange={e => setMapping({ ...mapping, email: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Company Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Company Name</label>
                    <select
                      value={mapping.companyName}
                      onChange={e => setMapping({ ...mapping, companyName: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* City/Place field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">City / Place</label>
                    <select
                      value={mapping.city}
                      onChange={e => setMapping({ ...mapping, city: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Source */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Lead Source</label>
                    <select
                      value={mapping.source}
                      onChange={e => setMapping({ ...mapping, source: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Default Source --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                   {/* Interested Service */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Interested Service</label>
                    <select
                      value={mapping.interestedService}
                      onChange={e => setMapping({ ...mapping, interestedService: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Lead Platform */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Lead Platform</label>
                    <select
                      value={mapping.leadPlatform}
                      onChange={e => setMapping({ ...mapping, leadPlatform: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Campaign Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Campaign Name</label>
                    <select
                      value={mapping.campaignName}
                      onChange={e => setMapping({ ...mapping, campaignName: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Client Meeting Fixed */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Client Meeting Fixed</label>
                    <select
                      value={mapping.clientMeetingFixed}
                      onChange={e => setMapping({ ...mapping, clientMeetingFixed: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Admission Yes/No */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Admission Status</label>
                    <select
                      value={mapping.admissionYesNo}
                      onChange={e => setMapping({ ...mapping, admissionYesNo: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Leads Received Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Leads Received Date</label>
                    <select
                      value={mapping.leadsReceivedDate}
                      onChange={e => setMapping({ ...mapping, leadsReceivedDate: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* 1st Followup Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">1st Followup Date</label>
                    <select
                      value={mapping.followUpDate1}
                      onChange={e => setMapping({ ...mapping, followUpDate1: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* 2nd Followup Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">2nd Followup Date</label>
                    <select
                      value={mapping.followUpDate2}
                      onChange={e => setMapping({ ...mapping, followUpDate2: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* 3rd Followup Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">3rd Followup Date</label>
                    <select
                      value={mapping.followUpDate3}
                      onChange={e => setMapping({ ...mapping, followUpDate3: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* 4th Followup Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">4th Followup Date</label>
                    <select
                      value={mapping.followUpDate4}
                      onChange={e => setMapping({ ...mapping, followUpDate4: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* 5th Followup Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">5th Followup Date</label>
                    <select
                      value={mapping.followUpDate5}
                      onChange={e => setMapping({ ...mapping, followUpDate5: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Preview Grid */}
              {previewData.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-bold text-slate-450 uppercase">Mapped Leads Preview (First 3 Rows):</h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-[10px]">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                        <tr>
                          <th className="p-2 border-b dark:border-slate-800">Lead Name</th>
                          <th className="p-2 border-b dark:border-slate-800">Phone</th>
                          <th className="p-2 border-b dark:border-slate-800">Meeting</th>
                          <th className="p-2 border-b dark:border-slate-800">Admission</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {previewData.map((preview, i) => (
                          <tr key={i} className="dark:text-slate-300">
                            <td className="p-2">{preview.leadName}</td>
                            <td className="p-2">{preview.phone}</td>
                            <td className="p-2">{preview.clientMeetingFixed}</td>
                            <td className="p-2">{preview.admissionYesNo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onClose();
              resetImportState();
            }}
            className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            Cancel
          </button>
          {file && (
            <button
              onClick={handleImportSubmit}
              disabled={importing || loading || !mapping.leadName || !mapping.phone}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing && <Loader2 size={14} className="animate-spin" />}
              Confirm Bulk Import
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Leads;