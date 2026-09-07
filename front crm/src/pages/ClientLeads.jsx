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
import { formatApiError } from '../utils/errorUtils';
import ConfirmModal from '../components/ConfirmModal';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function ClientLeads() {
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
  // Debounce timer ref for remarks inline update
  const remarksDebounceRef = React.useRef({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [activePriority, setActivePriority] = useState('all');

  const [staffFilter, setStaffFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    const todayStr = getISTDate();

    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === 'thisWeek') {
      const d = new Date();
      const first = d.getDate() - d.getDay();
      const firstDay = new Date(d.setDate(first)).toISOString().split('T')[0];
      setDateFrom(firstDay);
      setDateTo(todayStr);
    } else if (preset === 'thisMonth') {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      setDateFrom(firstDay);
      setDateTo(todayStr);
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (preset === 'custom') {
      setDateFrom('');
      setDateTo('');
    }
  };
  const [sortOrder, setSortOrder] = useState('desc');
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState('list');
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

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const userDeptName = useMemo(() => {
    if (!currentUser) return '';
    return String(currentUser.department || currentUser.departmentId?.name || '').toLowerCase().trim();
  }, [currentUser]);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const roleId = String(currentUser.role_id || currentUser.roleId || currentUser.role || '').toLowerCase().trim();
    const designation = String(currentUser.designation || currentUser.designationId?.name || currentUser.designation_id || '').toLowerCase().trim();
    const isOps = designation.includes('operation') || designation.includes('ops');
    return (['1', '2', 'admin', 'superadmin'].includes(roleId) || designation.includes('admin')) && !isOps;
  }, [currentUser]);

  const isMarketing = useMemo(() => {
    if (!currentUser) return false;
    const roleId = String(currentUser.role_id || currentUser.roleId || currentUser.role || '').toLowerCase().trim();
    const isOpsOrAdmin = ['1', '2', 'admin', 'superadmin', 'manager', 'hr'].includes(roleId);
    if (isOpsOrAdmin) return false;
    return userDeptName.includes('marketing');
  }, [currentUser, userDeptName]);

  const isAcademicCounselor = useMemo(() => {
    if (!currentUser) return false;
    const designation = String(currentUser.designation || currentUser.designationId?.name || currentUser.designation_id || '').toLowerCase().trim();
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
    return designation.includes('counselor') || designation.includes('academic') || designation.includes('tele');
  }, [currentUser]);

  const isOperationManager = useMemo(() => {
    if (!currentUser) return false;
    if (isAcademicCounselor) return false;
    const roleId = String(currentUser.role_id || currentUser.roleId || currentUser.role || '').toLowerCase().trim();
    const designation = String(currentUser.designation || currentUser.designationId?.name || currentUser.designation_id || '').toLowerCase().trim();
    return (
      ['1', '2', 'admin', 'superadmin', 'manager'].includes(roleId) ||
      designation.includes('operation') ||
      designation.includes('ops') ||
      designation.includes('manager') ||
      userDeptName.includes('operation') ||
      userDeptName.includes('ops') ||
      !!currentUser.isTeamLead
    );
  }, [currentUser, userDeptName, isAcademicCounselor]);

  const canEditLead = useMemo(() => {
    if (isAdmin) return false;
    if (isMarketing) return false;
    return true;
  }, [isAdmin, isMarketing]);

  const canEditAssignedTo = useMemo(() => {
    if (isAdmin) return false;
    if (isAcademicCounselor) return false;
    return isOperationManager;
  }, [isAdmin, isAcademicCounselor, isOperationManager]);

  const canDeleteLead = useMemo(() => {
    if (!currentUser) return true;
    const roleId = String(currentUser.role_id || currentUser.roleId || currentUser.role || '').toLowerCase().trim();
    return (
      currentUser.isSuperAdmin ||
      ['0', '1', '2', 'admin', 'superadmin', 'manager', 'team_lead', 'teamlead', 'tl', 'hr'].includes(roleId) ||
      isOperationManager ||
      canEditLead
    );
  }, [currentUser, isOperationManager, canEditLead]);

  // Form State
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
    status: 'New',
    priority: 'Medium',
    clientMeetingFixed: 'Pending',
    clientOnboarding: 'Pending',
    remarks: '',
    nextFollowUpDate: '',
    leadsReceivedDate: getISTDate()
  });

  const [followUpData, setFollowUpData] = useState({
    followUpNum: '1',
    date: getISTDate(),
    remarks: ''
  });

  const [importCsvText, setImportCsvText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Fetch Staff
  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch(getApiEndpoint('/users'), { headers: getAuthHeaders() });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setStaff(data.data);
      }
    } catch (e) {
      console.error("Error fetching staff:", e);
    }
  }, [getAuthHeaders]);

  // Filter Sales & Growth Department Staff ONLY
  const salesGrowthStaff = useMemo(() => {
    if (!staff || !Array.isArray(staff)) return [];
    return staff.filter(member => {
      const deptName = String(
        member.department ||
        member.departmentId?.name ||
        member.department_name ||
        ''
      ).toLowerCase().trim();

      const desigName = String(
        member.designation ||
        member.designationId?.name ||
        member.designation_name ||
        ''
      ).toLowerCase().trim();

      const desigId = String(member.designationId?._id || member.designationId || member.designation_id || '');

      return (
        deptName.includes('sales') ||
        deptName.includes('growth') ||
        deptName.includes('counselor') ||
        deptName.includes('telecaller') ||
        deptName.includes('academy') ||
        desigName.includes('sales') ||
        desigName.includes('growth') ||
        desigName.includes('telecaller')
      );
    });
  }, [staff]);

  // Fetch Client Leads
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiEndpoint('/client-leads?limit=1000'), { headers: getAuthHeaders() });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setLeads(data.data);
      }
    } catch (error) {
      console.error("Error fetching client leads:", error);
      showToast("Failed to load client leads", "error");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, showToast]);

  useEffect(() => {
    fetchStaff();
    fetchLeads();
  }, [fetchStaff, fetchLeads]);

  // Fetch details for view modal
  const fetchLeadDetails = async (id) => {
    setDetailsLoading(true);
    try {
      const res = await fetch(getApiEndpoint(`/client-leads/${id}`), { headers: getAuthHeaders() });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setSelectedLeadDetails(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch lead details:", e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      assignedTo: formData.assignedTo && formData.assignedTo.trim() ? formData.assignedTo : null
    };
    try {
      const res = await fetch(getApiEndpoint('/client-leads'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (data.success) {
        showToast("Client lead created successfully!", "success");
        setIsCreateOpen(false);
        resetFormData();
        fetchLeads();
      } else {
        showToast(formatApiError(data, "Failed to create client lead"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast(formatApiError(e, "Server error during client lead creation"), "error");
    }
  };

  const handleUpdateLead = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    const payload = {
      ...formData,
      assignedTo: formData.assignedTo && formData.assignedTo.trim() ? formData.assignedTo : null
    };
    try {
      const res = await fetch(getApiEndpoint(`/client-leads/${selectedLead.id || selectedLead._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (data.success) {
        showToast("Client lead updated successfully!", "success");
        setIsEditOpen(false);
        fetchLeads();
      } else {
        showToast(formatApiError(data, "Failed to update client lead"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast(formatApiError(e, "Server error during lead update"), "error");
    }
  };

  const handleInlineUpdate = async (leadId, field, value) => {
    if (!canEditLead && !(field === 'assignedTo' && canEditAssignedTo)) {
      showToast("Editing is restricted for your role.", "warning");
      return;
    }
    const cleanValue = (field === 'assignedTo' && (!value || !String(value).trim())) ? null : value;
    // Optimistic state update: change field color instantly on click
    const extraFields = field === 'interestedService' ? { courseIntrests: cleanValue, courseInterests: cleanValue } : {};
    setLeads(prev => prev.map(l => ((l.id === leadId || l._id === leadId) ? { ...l, [field]: cleanValue, ...extraFields } : l)));

    try {
      const res = await fetch(getApiEndpoint(`/client-leads/${leadId}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ [field]: cleanValue, ...extraFields })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (data.success) {
        showToast(`Client lead ${field} updated!`, "success");
        setLeads(prev => prev.map(l => ((l.id === leadId || l._id === leadId) ? data.data : l)));
      } else {
        showToast(formatApiError(data, "Update failed"), "error");
        fetchLeads();
      }
    } catch (e) {
      console.error(e);
      showToast(formatApiError(e, "Server error during update"), "error");
      fetchLeads();
    }
  };

  const handleAddFollowUp = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    const fieldKey = `followUpDate${followUpData.followUpNum}`;
    const updateObj = {
      [fieldKey]: followUpData.date,
      remarks: followUpData.remarks ? `${selectedLead.remarks ? selectedLead.remarks + ' | ' : ''}FollowUp ${followUpData.followUpNum}: ${followUpData.remarks}` : selectedLead.remarks
    };

    try {
      const res = await fetch(getApiEndpoint(`/client-leads/${selectedLead.id || selectedLead._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateObj)
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (data.success) {
        showToast(`Follow-up ${followUpData.followUpNum} updated!`, "success");
        setIsFollowUpOpen(false);
        fetchLeads();
      } else {
        showToast(formatApiError(data, "Failed to add follow-up"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast(formatApiError(e, "Failed to add follow-up"), "error");
    }
  };

  const handleDeleteLead = async () => {
    if (!deleteConfirm.id) return;
    try {
      const res = await fetch(getApiEndpoint(`/client-leads/${deleteConfirm.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (data.success) {
        showToast("Client lead deleted successfully", "success");
        setDeleteConfirm({ isOpen: false, id: null, name: '' });
        fetchLeads();
      } else {
        showToast(formatApiError(data, "Failed to delete lead"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast(formatApiError(e, "Error deleting lead"), "error");
    }
  };

  const handleExportExcel = () => {
    try {
      if (!filteredLeads || filteredLeads.length === 0) {
        showToast("No leads available to export", "warning");
        return;
      }

      const exportData = filteredLeads.map((lead, index) => {
        const assignedName = typeof lead.assignedTo === 'object'
          ? (lead.assignedTo?.name || 'Unassigned')
          : (staff.find(s => String(s.id || s._id) === String(lead.assignedTo))?.name || lead.assignedTo || 'Unassigned');

        return {
          'S.No': index + 1,
          'Lead Name': lead.leadName || '',
          'Company Name': lead.companyName || '',
          'Phone': lead.phone || '',
          'Email': lead.email || '',
          'City / Place': lead.city || '',
          'Interest': lead.interestedService || lead.courseIntrests || lead.courseInterests || '',
          'Source': lead.source || '',
          'Status': lead.status || 'New',
          'Priority': lead.priority || 'Medium',
          'Assigned To': assignedName,
          'Client Meeting Fixed': lead.clientMeetingFixed || 'Pending',
          'Client Onboarding': lead.clientOnboarding || 'Pending',
          'Leads Received Date': formatDate(lead.leadsReceivedDate),
          '1st Followup Date': formatDate(lead.followUpDate1),
          '2nd Followup Date': formatDate(lead.followUpDate2),
          '3rd Followup Date': formatDate(lead.followUpDate3),
          'Remarks': lead.remarks || '',
          'Created Date': formatDate(lead.createdAt)
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Client Leads');

      const fileName = `Client_Leads_${getISTDate()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast(`Successfully exported ${exportData.length} client leads to Excel!`, "success");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      showToast("Failed to export Excel file", "error");
    }
  };

  const processAndUploadLeads = async (parsedLeads) => {
    if (parsedLeads.length === 0) {
      showToast("No valid leads found (Name and Phone required).", "warning");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/v1/client-leads/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ leads: parsedLeads })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully imported ${data.data.length} client leads!`, "success");
        setIsImportOpen(false);
        setSelectedFile(null);
        setImportCsvText('');
        fetchLeads();
      } else {
        showToast(data.message || "Import failed", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error importing leads", "error");
    }
  };

  const handleImportExcelSubmit = async (e) => {
    e.preventDefault();

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (rawRows.length < 2) {
            showToast("Excel file must contain a header row and data rows.", "error");
            return;
          }

          const headers = rawRows[0].map(h => String(h || '').toLowerCase().trim());
          const parsedLeads = [];

          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;
            const leadObj = {};
            headers.forEach((h, idx) => {
              const val = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
              if (h.includes('name')) leadObj.leadName = val;
              else if (h.includes('company')) leadObj.companyName = val;
              else if (h.includes('phone') || h.includes('mobile') || h.includes('contact')) leadObj.phone = val;
              else if (h.includes('email')) leadObj.email = val;
              else if (h.includes('city') || h.includes('place')) leadObj.city = val;
              else if (h.includes('service') || h.includes('course') || h.includes('interest')) leadObj.interestedService = val;
              else if (h.includes('source')) leadObj.source = val;
              else if (h.includes('campaign')) leadObj.campaignName = val;
              else if (h.includes('platform')) leadObj.leadPlatform = val;
              else if (h.includes('remark')) leadObj.remarks = val;
            });

            if (leadObj.leadName && leadObj.phone) {
              if (isMarketing || !leadObj.source) {
                leadObj.source = 'MARKETING';
              }
              parsedLeads.push(leadObj);
            }
          }

          await processAndUploadLeads(parsedLeads);
        } catch (err) {
          console.error(err);
          showToast("Failed to parse Excel file", "error");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
      return;
    }

    if (importCsvText.trim()) {
      try {
        const lines = importCsvText.trim().split('\n');
        if (lines.length < 2) {
          showToast("Data must contain a header row and data rows.", "error");
          return;
        }

        const parseCsvLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if ((ch === ',' || ch === '\t') && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += ch;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        const parsedLeads = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = parseCsvLine(lines[i]);
          const leadObj = {};
          headers.forEach((h, idx) => {
            const val = values[idx] || '';
            if (h.includes('name')) leadObj.leadName = val;
            else if (h.includes('company')) leadObj.companyName = val;
            else if (h.includes('phone') || h.includes('mobile') || h.includes('contact')) leadObj.phone = val;
            else if (h.includes('email')) leadObj.email = val;
            else if (h.includes('city') || h.includes('place')) leadObj.city = val;
            else if (h.includes('service') || h.includes('course') || h.includes('interest')) leadObj.interestedService = val;
            else if (h.includes('source')) leadObj.source = val;
            else if (h.includes('campaign')) leadObj.campaignName = val;
            else if (h.includes('platform')) leadObj.leadPlatform = val;
            else if (h.includes('remark')) leadObj.remarks = val;
          });

          if (leadObj.leadName && leadObj.phone) {
            if (isMarketing || !leadObj.source) {
              leadObj.source = 'MARKETING';
            }
            parsedLeads.push(leadObj);
          }
        }

        await processAndUploadLeads(parsedLeads);
      } catch (e) {
        console.error(e);
        showToast("Error processing text data", "error");
      }
      return;
    }

    showToast("Please select an Excel/CSV file or paste lead data.", "warning");
  };

  const openEditModal = (lead) => {
    setSelectedLead(lead);
    setFormData({
      leadName: lead.leadName || '',
      companyName: lead.companyName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      city: lead.city || '',
      source: lead.source || '',
      interestedService: lead.interestedService || '',
      campaignName: lead.campaignName || '',
      leadPlatform: lead.leadPlatform || '',
      assignedTo: typeof lead.assignedTo === 'object' ? (lead.assignedTo?._id || lead.assignedTo?.id || '') : (lead.assignedTo || ''),
      status: lead.status || 'New',
      priority: lead.priority || 'Medium',
      clientMeetingFixed: lead.clientMeetingFixed || 'Pending',
      clientOnboarding: lead.clientOnboarding || 'Pending',
      remarks: lead.remarks || '',
      nextFollowUpDate: formatDateForInput(lead.nextFollowUpDate),
      leadsReceivedDate: formatDateForInput(lead.leadsReceivedDate) || getISTDate()
    });
    setIsEditOpen(true);
  };

  const resetFormData = () => {
    setFormData({
      leadName: '',
      companyName: '',
      email: '',
      phone: '',
      city: '',
      source: isMarketing ? 'MARKETING' : '',
      interestedService: '',
      campaignName: '',
      leadPlatform: '',
      assignedTo: '',
      status: 'New',
      priority: 'Medium',
      clientMeetingFixed: 'Pending',
      clientOnboarding: 'Pending',
      remarks: '',
      nextFollowUpDate: '',
      leadsReceivedDate: getISTDate()
    });
  };

  // Filtered Leads Calculation
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        (lead.leadName && lead.leadName.toLowerCase().includes(query)) ||
        (lead.phone && lead.phone.toLowerCase().includes(query)) ||
        (lead.email && lead.email.toLowerCase().includes(query)) ||
        (lead.city && lead.city.toLowerCase().includes(query)) ||
        (lead.companyName && lead.companyName.toLowerCase().includes(query));

      let matchesTab = true;
      if (activeTab !== 'all') {
        matchesTab = lead.status === activeTab;
      }

      let matchesPriority = true;
      if (activePriority !== 'all') {
        matchesPriority = lead.priority === activePriority;
      }

      let matchesStaff = true;
      if (staffFilter !== 'all') {
        const assignedId = typeof lead.assignedTo === 'object' ? (lead.assignedTo?._id || lead.assignedTo?.id) : lead.assignedTo;
        matchesStaff = String(assignedId) === String(staffFilter);
      }

      let matchesCity = true;
      if (cityFilter !== 'all') {
        matchesCity = String(lead.city || '').toLowerCase().trim() === String(cityFilter).toLowerCase().trim();
      }

      let matchesDate = true;
      if (dateFrom || dateTo) {
        const leadDate = lead.leadsReceivedDate || lead.createdAt;
        if (leadDate) {
          const lDateStr = new Date(leadDate).toISOString().split('T')[0];
          if (dateFrom && lDateStr < dateFrom) matchesDate = false;
          if (dateTo && lDateStr > dateTo) matchesDate = false;
        }
      }

      return matchesSearch && matchesTab && matchesPriority && matchesStaff && matchesCity && matchesDate;
    }).sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [leads, searchQuery, activeTab, activePriority, staffFilter, cityFilter, dateFrom, dateTo, sortOrder]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  const uniqueCities = useMemo(() => {
    const cities = leads.map(l => l.city).filter(Boolean);
    return Array.from(new Set(cities)).sort();
  }, [leads]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg shadow-indigo-500/25">
            <Briefcase size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Client Leads Directory
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              {isMarketing ? 'Marketing View — Add & Import Client Leads' : 'Sales & Growth View — Complete Lead Pipeline'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setSelectedFile(null); setImportCsvText(''); setIsImportOpen(true); }}
            className="px-3.5 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <FileDown size={14} />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => { resetFormData(); setIsCreateOpen(true); }}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Add Client Lead</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Client Leads</p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{filteredLeads.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">New Leads</p>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">{leads.filter(l => l.status === 'New').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Contacted</p>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{leads.filter(l => l.status === 'Contacted').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Converted</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{leads.filter(l => l.status === 'Converted').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Meetings Fixed</p>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">{leads.filter(l => l.clientMeetingFixed === 'Yes').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Client Onboarding</p>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{leads.filter(l => l.clientOnboarding === 'Yes').length}</p>
        </div>
      </div>

      {/* Search & Filter Container (just above the table) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-6 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by name, phone, email, company, city..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-none rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                isFilterOpen
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
            </button>

            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                title="List View"
              >
                <LayoutList size={15} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                title="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {isFilterOpen && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</label>
              <select
                value={activeTab}
                onChange={e => setActiveTab(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Interested">Interested</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Priority</label>
              <select
                value={activePriority}
                onChange={e => setActivePriority(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assigned Staff</label>
              <select
                value={staffFilter}
                onChange={e => setStaffFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">All Sales & Growth Staff</option>
                {salesGrowthStaff.map(s => (
                  <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">City / Place</label>
              <select
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">All Cities</option>
                {uniqueCities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date Range Preset</label>
              <select
                value={datePreset}
                onChange={e => handleDatePresetChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="last30">Last 30 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>
            {datePreset === 'custom' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Order</label>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Table / Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-400">Loading Client Leads...</p>
        </div>
      ) : paginatedLeads.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 p-12 text-center">
          <Briefcase size={32} className="mx-auto text-slate-400 mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Client Leads Found</h3>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search query.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedLeads.map(lead => {
            const statusMeta = STATUS_META[lead.status] || { label: lead.status, color: 'bg-slate-100 text-slate-600 border-slate-200' };

            return (
              <div key={lead.id || lead._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4
                        className="font-bold text-sm text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        onClick={() => { setSelectedLead(lead); fetchLeadDetails(lead.id || lead._id); setIsViewOpen(true); }}
                      >{lead.leadName}</h4>
                      {lead.companyName && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                          <Briefcase size={11} /> {lead.companyName}
                        </p>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border" style={getStatusStyle(lead.status)}>
                      {lead.status || 'New'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 font-medium mb-4">
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400" />
                      <span>{lead.phone}</span>
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-slate-400" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.city && (
                      <div className="flex items-center gap-2">
                        <Tag size={13} className="text-slate-400" />
                        <span>{lead.city}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Interest:</span>
                      <span className="font-bold border px-1.5 py-0.5 rounded" style={getCourseInterestStyle(lead.interestedService || lead.courseIntrests || lead.courseInterests)}>
                        {lead.interestedService || lead.courseIntrests || lead.courseInterests || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Client Onboarding:</span>
                      <span className={`font-bold ${lead.clientOnboarding === 'Yes' ? 'text-emerald-600' : lead.clientOnboarding === 'No' ? 'text-rose-500' : 'text-amber-500'}`}>
                        {lead.clientOnboarding || 'Pending'}
                      </span>
                    </div>

                    <div className="pt-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">ASSIGNED TO</label>
                      {canEditAssignedTo ? (
                        <select
                          value={typeof lead.assignedTo === 'object' ? (lead.assignedTo?._id || lead.assignedTo?.id || '') : (lead.assignedTo || '')}
                          onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'assignedTo', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                        >
                          <option value="">Unassigned</option>
                          {salesGrowthStaff.map(member => (
                            <option key={member.id || member._id} value={member.id || member._id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <User size={12} className="text-slate-400" />
                          {typeof lead.assignedTo === 'object' ? (lead.assignedTo?.name || 'Unassigned') : (staff.find(s => String(s.id || s._id) === String(lead.assignedTo))?.name || lead.assignedTo || 'Unassigned')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <Calendar size={11} /> {formatDate(lead.createdAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setSelectedLead(lead); fetchLeadDetails(lead.id || lead._id); setIsViewOpen(true); }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      title="View Details"
                    >
                      <Eye size={15} />
                    </button>
                    {canEditLead && (
                      <>
                        <button
                          onClick={() => openEditModal(lead)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                          title="Edit Lead"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => { setSelectedLead(lead); setIsFollowUpOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                          title="Add Follow-up"
                        >
                          <MessageSquare size={15} />
                        </button>
                      </>
                    )}
                    {canDeleteLead && (
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, id: lead.id || lead._id, name: lead.leadName })}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        title="Delete Lead"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View Mode (Table) */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead Info</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact Details</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">City / Place</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Campaign/platform</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned To</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 min-w-[170px]">Interest</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Source</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Leads Received</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">1st Followup</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">2nd Followup</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">3rd Followup</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">4th Followup</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">5th Followup</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Remarks</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Client Meeting</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Client Onboarding</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Created</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedLeads.map((lead) => {
                  const statusMeta = STATUS_META[lead.status] || { label: lead.status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
                  return (
                    <tr key={lead.id || lead._id} className={getRowClass()}>
                      <td className="px-6 py-4.5">
                        <div
                          className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 cursor-pointer hover:underline"
                          onClick={() => { setSelectedLead(lead); fetchLeadDetails(lead.id || lead._id); setIsViewOpen(true); }}
                        >
                          {lead.leadName}
                        </div>
                        {lead.companyName && (
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Briefcase size={10} /> {lead.companyName}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4.5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                          <Phone size={12} className="text-slate-400" /> {lead.phone}
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                            <Mail size={12} className="text-slate-400" /> {lead.email}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {lead.city || <span className="text-[10px] text-slate-400 italic">Not Specified</span>}
                      </td>

                      <td className="px-6 py-4.5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                          <Tag size={12} className="text-slate-400" /> {lead.campaignName || 'No Campaign'}
                        </div>
                      </td>

                      <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                        {canEditLead ? (
                          <select
                            value={lead.status || 'New'}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'status', e.target.value)}
                            className="w-full min-w-[150px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Follow Up">Follow Up</option>
                            <option value="Interested">Interested</option>
                            <option value="Converted">Converted</option>
                            <option value="Lost">Lost</option>
                          </select>
                        ) : (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.color}`}>
                            {statusMeta.label}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                        {canEditAssignedTo ? (
                          <select
                            value={typeof lead.assignedTo === 'object' ? (lead.assignedTo?._id || lead.assignedTo?.id || '') : (lead.assignedTo || '')}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'assignedTo', e.target.value)}
                            className="w-full min-w-[150px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="">Unassigned</option>
                            {salesGrowthStaff.map(member => (
                              <option key={member.id || member._id} value={member.id || member._id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                            <User size={12} className="text-slate-400" />
                            {typeof lead.assignedTo === 'object' ? (lead.assignedTo?.name || 'Unassigned') : (staff.find(s => String(s.id || s._id) === String(lead.assignedTo))?.name || lead.assignedTo || 'Unassigned')}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                        {canEditLead ? (
                          <InterestDropdown
                            value={lead.interestedService || lead.courseIntrests || lead.courseInterests || ''}
                            onChange={(val) => handleInlineUpdate(lead.id || lead._id, 'interestedService', val)}
                            disabled={false}
                          />
                        ) : (
                          <span
                            className="inline-block px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm"
                            style={getCourseInterestStyle(lead.interestedService || lead.courseIntrests || lead.courseInterests)}
                          >
                            {lead.interestedService || lead.courseIntrests || lead.courseInterests || '—'}
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                        <select
                          value={lead.source || ''}
                          onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'source', e.target.value)}
                          disabled={!canEditLead}
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
                      <td className="px-6 py-4.5 text-xs">
                        <input
                          type="date"
                          value={formatDateForInput(lead.leadsReceivedDate)}
                          onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'leadsReceivedDate', e.target.value || null)}
                          disabled={!canEditLead}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* 1st Followup Date */}
                      <td className="px-6 py-4.5 text-xs">
                        <input
                          type="date"
                          value={formatDateForInput(lead.followUpDate1)}
                          onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate1', e.target.value || null)}
                          disabled={!canEditLead}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* 2nd Followup Date */}
                      <td className="px-6 py-4.5 text-xs">
                        <input
                          type="date"
                          value={formatDateForInput(lead.followUpDate2)}
                          onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate2', e.target.value || null)}
                          disabled={!canEditLead}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* 3rd Followup Date */}
                      <td className="px-6 py-4.5 text-xs">
                        <input
                          type="date"
                          value={formatDateForInput(lead.followUpDate3)}
                          onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate3', e.target.value || null)}
                          disabled={!canEditLead}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* 4th Followup Date */}
                      <td className="px-6 py-4.5 text-xs">
                        <input
                          type="date"
                          value={formatDateForInput(lead.followUpDate4)}
                          onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate4', e.target.value || null)}
                          disabled={!canEditLead}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* 5th Followup Date */}
                      <td className="px-6 py-4.5 text-xs">
                        <input
                          type="date"
                          value={formatDateForInput(lead.followUpDate5)}
                          onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'followUpDate5', e.target.value || null)}
                          disabled={!canEditLead}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Remarks */}
                      <td className="px-6 py-4.5 text-xs">
                         <textarea
                           rows={1}
                           defaultValue={lead.remarks || ''}
                           onChange={(e) => {
                             const leadId = lead.id || lead._id;
                             const val = e.target.value;
                             if (remarksDebounceRef.current[leadId]) {
                               clearTimeout(remarksDebounceRef.current[leadId]);
                             }
                             remarksDebounceRef.current[leadId] = setTimeout(() => {
                               handleInlineUpdate(leadId, 'remarks', val);
                             }, 800);
                           }}
                           disabled={!canEditLead}
                           className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none cursor-pointer min-w-[150px] disabled:opacity-75 disabled:cursor-not-allowed"
                           placeholder="Remarks..."
                         />
                      </td>

                      <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                        {canEditLead ? (
                          <select
                            value={lead.clientMeetingFixed || 'Pending'}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'clientMeetingFixed', e.target.value)}
                            className="w-full min-w-[150px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{lead.clientMeetingFixed || 'Pending'}</span>
                        )}
                      </td>

                      <td className="px-6 py-4.5 text-xs font-semibold min-w-[170px]">
                        {canEditLead ? (
                          <select
                            value={lead.clientOnboarding || 'Pending'}
                            onChange={(e) => handleInlineUpdate(lead.id || lead._id, 'clientOnboarding', e.target.value)}
                            className="w-full min-w-[150px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            lead.clientOnboarding === 'Yes' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                            lead.clientOnboarding === 'No' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}>
                            {lead.clientOnboarding || 'Pending'}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4.5 text-xs text-slate-400 font-medium">
                        {formatDate(lead.createdAt)}
                      </td>

                      <td className="px-6 py-4.5 text-xs text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setSelectedLead(lead); fetchLeadDetails(lead.id || lead._id); setIsViewOpen(true); }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                            title="View details"
                          >
                            <Eye size={15} />
                          </button>
                          {canEditLead && (
                            <>
                              <button
                                onClick={() => openEditModal(lead)}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                                title="Edit Lead"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => { setSelectedLead(lead); setIsFollowUpOpen(true); }}
                                className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                                title="Add Follow-up"
                              >
                                <MessageSquare size={15} />
                              </button>
                            </>
                          )}
                          {canDeleteLead && (
                            <button
                              onClick={() => setDeleteConfirm({ isOpen: true, id: lead.id || lead._id, name: lead.leadName })}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                              title="Delete Lead"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE LEAD MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" /> Add New Client Lead
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.leadName}
                    onChange={e => setFormData({ ...formData, leadName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                    placeholder="Company / Organization"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                    placeholder="Contact Number"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                    placeholder="Email Address"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">City / Place</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Interest</label>
                  <select
                    value={formData.interestedService}
                    onChange={e => setFormData({ ...formData, interestedService: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  >
                    <option value="">Select Interest</option>
                    <option value="HOT LEAD">HOT LEAD</option>
                    <option value="WARM LEAD">WARM LEAD</option>
                    <option value="COLD LEAD">COLD LEAD</option>
                    <option value="RNT">RNT</option>
                    <option value="SWITCHED OFF">SWITCHED OFF</option>
                    <option value="WRONG LEAD">WRONG LEAD</option>
                    <option value="CALL BACK">CALL BACK</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Source</label>
                  <select
                    value={formData.source}
                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  >
                    <option value="">Select Source</option>
                    <option value="REFERENCE">REFERENCE</option>
                    <option value="INBOUND CALLS">INBOUND CALLS</option>
                    <option value="INBOUND MSG">INBOUND MSG</option>
                    <option value="MARKETING">MARKETING</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Client Meeting Fixed</label>
                  <select
                    value={formData.clientMeetingFixed}
                    onChange={e => setFormData({ ...formData, clientMeetingFixed: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Client Onboarding</label>
                  <select
                    value={formData.clientOnboarding}
                    onChange={e => setFormData({ ...formData, clientOnboarding: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              {canEditAssignedTo && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assign to Staff / Academic Counselor</label>
                  <select
                    value={formData.assignedTo}
                    onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  >
                    <option value="">Unassigned</option>
                    {salesGrowthStaff.map(s => (
                      <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  placeholder="Additional remarks..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 shadow-md"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LEAD MODAL */}
      {isEditOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 size={18} className="text-blue-600" /> Edit Client Lead
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateLead} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.leadName}
                    onChange={e => setFormData({ ...formData, leadName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Source</label>
                  <select
                    value={formData.source}
                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  >
                    <option value="">Select Source</option>
                    <option value="REFERENCE">REFERENCE</option>
                    <option value="INBOUND CALLS">INBOUND CALLS</option>
                    <option value="INBOUND MSG">INBOUND MSG</option>
                    <option value="MARKETING">MARKETING</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Client Onboarding</label>
                  <select
                    value={formData.clientOnboarding}
                    onChange={e => setFormData({ ...formData, clientOnboarding: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              {canEditAssignedTo && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assign to Staff / Academic Counselor</label>
                  <select
                    value={formData.assignedTo}
                    onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                  >
                    <option value="">Unassigned</option>
                    {salesGrowthStaff.map(s => (
                      <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Remarks</label>
                <textarea
                  rows={3}
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                {canDeleteLead ? (
                  <button
                    type="button"
                    onClick={() => {
                      const lId = selectedLead?.id || selectedLead?._id;
                      const lName = selectedLead?.leadName || 'Lead';
                      setIsEditOpen(false);
                      setDeleteConfirm({ isOpen: true, id: lId, name: lName });
                    }}
                    className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} /> Delete Lead
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 shadow-md cursor-pointer"
                  >
                    Update Lead
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {isViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye size={18} className="text-indigo-600" /> Client Lead Details
              </h3>
              <button onClick={() => setIsViewOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {detailsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : selectedLeadDetails ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Lead Name</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedLeadDetails.leadName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Company</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedLeadDetails.companyName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Phone</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{selectedLeadDetails.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Email</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{selectedLeadDetails.email || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">City / Place</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{selectedLeadDetails.city || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Status</span>
                    <div className="mt-0.5">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg border inline-block" style={getStatusStyle(selectedLeadDetails.status)}>
                        {selectedLeadDetails.status || 'New'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Interest</span>
                    <div className="mt-0.5">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg border inline-block" style={getCourseInterestStyle(selectedLeadDetails.interestedService || selectedLeadDetails.courseIntrests || selectedLeadDetails.courseInterests)}>
                        {selectedLeadDetails.interestedService || selectedLeadDetails.courseIntrests || selectedLeadDetails.courseInterests || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Client Onboarding</span>
                    <p className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">{selectedLeadDetails.clientOnboarding || 'Pending'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Assigned To</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                      {typeof selectedLeadDetails.assignedTo === 'object' ? (selectedLeadDetails.assignedTo?.name || 'Unassigned') : (staff.find(s => String(s.id || s._id) === String(selectedLeadDetails.assignedTo))?.name || selectedLeadDetails.assignedTo || 'Unassigned')}
                    </p>
                  </div>
                </div>

                {selectedLeadDetails.remarks && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Remarks</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{selectedLeadDetails.remarks}</p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {canDeleteLead ? (
                <button
                  type="button"
                  onClick={() => {
                    const lId = selectedLeadDetails?.id || selectedLeadDetails?._id || selectedLead?.id || selectedLead?._id;
                    const lName = selectedLeadDetails?.leadName || selectedLead?.leadName || 'Lead';
                    setIsViewOpen(false);
                    setDeleteConfirm({ isOpen: true, id: lId, name: lName });
                  }}
                  className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} /> Delete Lead
                </button>
              ) : <div />}
              <button
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD FOLLOW-UP MODAL */}
      {isFollowUpOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-amber-500" /> Add Follow-up
              </h3>
              <button onClick={() => setIsFollowUpOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFollowUp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Follow-up Number</label>
                <select
                  value={followUpData.followUpNum}
                  onChange={e => setFollowUpData({ ...followUpData, followUpNum: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                >
                  <option value="1">1st Follow-up</option>
                  <option value="2">2nd Follow-up</option>
                  <option value="3">3rd Follow-up</option>
                  <option value="4">4th Follow-up</option>
                  <option value="5">5th Follow-up</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Follow-up Date</label>
                <input
                  type="date"
                  required
                  value={followUpData.date}
                  onChange={e => setFollowUpData({ ...followUpData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Follow-up Remarks</label>
                <textarea
                  rows={3}
                  value={followUpData.remarks}
                  onChange={e => setFollowUpData({ ...followUpData, remarks: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                  placeholder="Notes from call/meeting..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFollowUpOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-500 shadow-md"
                >
                  Save Follow-up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL / CSV IMPORT MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-indigo-600" /> Import Client Leads (Excel / CSV)
              </h3>
              <button onClick={() => { setIsImportOpen(false); setSelectedFile(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportExcelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                  Upload Excel File (.xlsx, .xls, .csv)
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={e => setSelectedFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-slate-800 dark:file:text-indigo-400 cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-[11px] font-semibold text-emerald-600 mt-1">
                    Selected file: {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400">or paste raw text</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Paste comma/tab-separated lead data:
                </label>
                <textarea
                  rows={4}
                  value={importCsvText}
                  onChange={e => setImportCsvText(e.target.value)}
                  placeholder={`Name,Company,Phone,Email,City,Interest\nJohn Doe,Acme Corp,9876543210,john@acme.com,Mumbai,HOT LEAD`}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsImportOpen(false); setSelectedFile(null); setImportCsvText(''); }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>Import Excel Leads</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Client Lead"
        message={`Are you sure you want to delete lead "${deleteConfirm.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteLead}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
      />
    </div>
  );
}
