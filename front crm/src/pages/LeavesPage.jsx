import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  FileText,
  Send,
  Loader2,
  User,
  Users,
  UserPlus,
  Filter,
  X,
  History,
  TrendingUp,
  CheckSquare,
  AlertCircle,
  LayoutGrid,
  List,
  Edit3,
  Trash2,
  Crown
} from 'lucide-react';

import { useToast } from '../components/ToastProvider';

const rawApiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_BASE = rawApiBase.endsWith('/v1') ? rawApiBase : `${rawApiBase}/v1`;

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem('token');
  const cleanToken = rawToken ? rawToken.replace(/"/g, '').trim() : '';
  return {
    'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
    'Content-Type': 'application/json'
  };
};

const LEAVE_TYPES = [
  'Personal Leave',
  'Sick Leave',
  'Half Day',
  'Other'
];

export default function LeavesPage() {
  const { user } = useUser();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user'));
      const role = String(u?.role || '').toLowerCase().trim();
      const roleId = String(u?.role_id || u?.roleId || '').trim();
      const dept = String(u?.department || '').toLowerCase().trim();
      const desig = String(u?.designation || '').toLowerCase().trim();
      const isHr = u?.isSuperAdmin === true || ['1', '2', 'admin', 'hr'].includes(role) || ['1', '2'].includes(roleId) || dept.includes('hr') || dept.includes('admin') || desig.includes('hr');
      return isHr ? 'all' : 'my';
    } catch (e) {
      return 'my';
    }
  }); // 'all' | 'my' | 'team' | 'history'
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  
  // History Summary Metrics State
  const [historySummary, setHistorySummary] = useState({
    totalRequests: 0,
    totalDaysApproved: 0,
    approvedCount: 0,
    rejectedCount: 0,
    cancelledCount: 0,
    pendingCount: 0
  });

  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Modal & Form State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [staffUsers, setStaffUsers] = useState([]);
  const [selectedCcUsers, setSelectedCcUsers] = useState([]);
  const [showCcPicker, setShowCcPicker] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: 'Personal Leave',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Action Modal (Approve / Reject) State
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [actionModalType, setActionModalType] = useState(null); // 'APPROVED' | 'REJECTED'
  const [actionRole, setActionRole] = useState('team_lead'); // 'team_lead' | 'hr'
  const [actionComment, setActionComment] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Cancel Confirmation Modal State
  const [cancelModalLeave, setCancelModalLeave] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Role & SuperAdmin / MD Check
  const userRole = String(user?.role || '').toLowerCase().trim();
  const userRoleId = String(user?.role_id || user?.roleId || '').trim();
  const userDept = String(user?.department || '').toLowerCase().trim();
  const userDesig = String(user?.designation || '').toLowerCase().trim();
  const isSuperAdmin = user?.isSuperAdmin === true || userRole === 'superadmin' || userRole === 'md' || userRoleId === '0' || userRoleId === 'md' || userDesig === 'md' || userDesig.includes('md') || userDesig.includes('managing director');

  // SuperAdmin Edit Modal State
  const [editModalLeave, setEditModalLeave] = useState(null);
  const [editFormData, setEditFormData] = useState({
    leaveType: 'Personal Leave',
    startDate: '',
    endDate: '',
    reason: '',
    teamLeadStatus: 'PENDING',
    hrStatus: 'PENDING',
    finalStatus: 'PENDING'
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // SuperAdmin Delete Confirm State
  const [deleteModalLeave, setDeleteModalLeave] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const handleOpenEditModal = (leave) => {
    setEditModalLeave(leave);
    setEditFormData({
      leaveType: leave.leaveType || 'Personal Leave',
      startDate: leave.startDate ? new Date(leave.startDate).toISOString().split('T')[0] : '',
      endDate: leave.endDate ? new Date(leave.endDate).toISOString().split('T')[0] : '',
      reason: leave.reason || '',
      teamLeadStatus: leave.teamLeadStatus || 'PENDING',
      hrStatus: leave.hrStatus || 'PENDING',
      finalStatus: leave.finalStatus || 'PENDING'
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editModalLeave) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leaves/${editModalLeave._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editFormData)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Leave request updated successfully!');
        setEditModalLeave(null);
        fetchLeaves();
      } else {
        showToast(data.message || 'Failed to update leave request.', 'error');
      }
    } catch (err) {
      console.error('Error updating leave:', err);
      showToast('Error updating leave request.', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteModalLeave) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leaves/${deleteModalLeave._id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast('Leave request deleted successfully!');
        setDeleteModalLeave(null);
        fetchLeaves();
      } else {
        showToast(data.message || 'Failed to delete leave request.', 'error');
      }
    } catch (err) {
      console.error('Error deleting leave:', err);
      showToast('Error deleting leave request.', 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // HR Overview Filters State
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDept, setFilterDept] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // History Filters State
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyLeaveType, setHistoryLeaveType] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Fetch staff list for CC dropdown
  useEffect(() => {
    if (isApplyModalOpen && staffUsers.length === 0) {
      fetch(`${API_BASE}/users/list`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data) ? data : (data.success && Array.isArray(data.data) ? data.data : (Array.isArray(data.data) ? data.data : []));
          if (list.length > 0) {
            setStaffUsers(list);
          } else {
            return fetch(`${API_BASE}/users`, { headers: getAuthHeaders() }).then(r => r.json());
          }
        })
        .then(fallbackData => {
          if (fallbackData) {
            const list = Array.isArray(fallbackData) ? fallbackData : (fallbackData.success && Array.isArray(fallbackData.data) ? fallbackData.data : (Array.isArray(fallbackData.data) ? fallbackData.data : []));
            setStaffUsers(list);
          }
        })
        .catch(err => console.error("Error fetching staff list for CC:", err));
    }
  }, [isApplyModalOpen, staffUsers.length]);


  // Explicit Team Lead check: false in login response/user object overrides designation
  const isTeamLeadUser = useMemo(() => {
    if (user?.isTeamLead === false || user?.is_team_lead === false || String(user?.isTeamLead).toLowerCase() === 'false' || String(user?.is_team_lead).toLowerCase() === 'false') {
      return false;
    }
    if (user?.isTeamLead === true || user?.is_team_lead === true || String(user?.isTeamLead).toLowerCase() === 'true' || String(user?.is_team_lead).toLowerCase() === 'true') {
      return true;
    }
    return ['3', 'manager', 'team_lead', 'teamlead', 'tl', 'hod'].includes(userRole) || ['3', '10'].includes(userRoleId);
  }, [user, userRole, userRoleId]);

  const isHrOrAdmin = isSuperAdmin || ['1', '2', 'admin', 'hr'].includes(userRole) || ['1', '2'].includes(userRoleId) || userDept.includes('hr') || userDept.includes('admin') || userDesig.includes('hr');
  const isManagerOrTl = isHrOrAdmin || isTeamLeadUser;

  // Guard: Non-Team Lead / non-HR users can only access 'my' or 'history'
  useEffect(() => {
    if (!isHrOrAdmin && !isTeamLeadUser && (activeTab === 'all' || activeTab === 'team')) {
      setActiveTab('my');
    }
  }, [isHrOrAdmin, isTeamLeadUser, activeTab]);

  // Fetch Leaves based on active tab
  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = `${API_BASE}/leaves/my`;
      if (activeTab === 'team') {
        endpoint = `${API_BASE}/leaves/team`;
      } else if (activeTab === 'all') {
        endpoint = `${API_BASE}/leaves/all?status=${filterStatus}&department=${filterDept}&search=${encodeURIComponent(searchQuery)}`;
      } else if (activeTab === 'history') {
        endpoint = `${API_BASE}/leaves/history?status=${historyStatus}&leaveType=${historyLeaveType}&search=${encodeURIComponent(historySearch)}`;
      }

      const res = await fetch(endpoint, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setLeaves(data.data || []);
        if (data.summary) {
          setHistorySummary(data.summary);
        }
      } else {
        setLeaves([]);
      }
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterStatus, filterDept, searchQuery, historyStatus, historyLeaveType, historySearch]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // Handle Form Change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCcUserToggle = (userId) => {
    setSelectedCcUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Calculate Total Days
  const calculatedDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 1;
    if (formData.leaveType === 'Half Day') return 0.5;
    const s = new Date(formData.startDate);
    const e = new Date(formData.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diff = Math.abs(e - s);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [formData.startDate, formData.endDate, formData.leaveType]);

  // Handle Apply Leave Submit
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!formData.startDate || !formData.endDate || !formData.reason.trim()) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leaves`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          ccUserIds: selectedCcUsers
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsApplyModalOpen(false);
        setSelectedCcUsers([]);
        setShowCcPicker(false);
        setFormData({
          leaveType: 'Personal Leave',
          startDate: '',
          endDate: '',
          reason: ''
        });
        showToast("Leave request submitted successfully!", "success");
        fetchLeaves();
      } else {
        showToast(data.message || "Failed to submit leave request.", "error");
      }
    } catch (err) {
      console.error("Error applying leave:", err);
      showToast("An unexpected error occurred.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Action Modal
  const openActionModal = (leave, action, role) => {
    setSelectedLeave(leave);
    setActionModalType(action);
    setActionRole(role);
    setActionComment('');
  };

  // Submit Action (Approve / Reject)
  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeave || !actionModalType) return;

    setActionSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leaves/${selectedLeave._id}/action`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: actionModalType,
          comment: actionComment,
          approvalType: actionRole
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Leave request ${actionModalType.toLowerCase()} successfully!`, "success");
        setSelectedLeave(null);
        setActionModalType(null);
        fetchLeaves();
      } else {
        showToast(data.message || "Failed to update leave status.", "error");
      }
    } catch (err) {
      console.error("Error updating leave action:", err);
      showToast("An unexpected error occurred.", "error");
    } finally {
      setActionSubmitting(false);
    }
  };

  // Confirm & Delete Cancel Leave
  const handleConfirmCancelLeave = async () => {
    if (!cancelModalLeave) return;
    setCancelSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leaves/${cancelModalLeave._id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast("Leave request cancelled successfully.", "info");
        setCancelModalLeave(null);
        fetchLeaves();
      } else {
        showToast(data.message || "Failed to cancel leave request.", "error");
      }
    } catch (err) {
      console.error("Error cancelling leave:", err);
      showToast("Error cancelling leave request.", "error");
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status, stageName) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 p-4 md:p-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Leave Requests & History</h1>
            <p className="text-xs text-slate-500 font-normal">
              2-Stage Sequential Approval Workflow (Stage 1: Team Lead ➔ Stage 2: HR)
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsApplyModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Apply for Leave
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/50 p-1 rounded-xl border border-slate-200/60">
          {/* Navigation Tabs based on User Role */}
          {isHrOrAdmin ? (
            <>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Employee Leave Requests
              </button>

              <button
                onClick={() => setActiveTab('my')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'my'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Leave Requests
              </button>

              <button
                onClick={() => setActiveTab('team')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Team Leave Requests (TL Stage 1)
              </button>
            </>
          ) : isTeamLeadUser ? (
            <>
              <button
                onClick={() => setActiveTab('my')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'my'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Leave Requests
              </button>

              <button
                onClick={() => setActiveTab('team')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Team Leave Requests (TL Stage 1)
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'my'
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Leave Requests
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Leave History
          </button>
        </div>

        {/* View Mode Switcher (Grid vs List) */}
        <div className="flex items-center bg-slate-200/50 p-1 rounded-xl border border-slate-200/60">
          <button
            onClick={() => setViewMode('grid')}
            title="Grid View"
            className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List View"
            className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* HR Filter Controls */}
        {activeTab === 'all' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}

        {/* History Filter Controls */}
        {activeTab === 'history' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>

            <select
              value={historyLeaveType}
              onChange={(e) => setHistoryLeaveType(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Leave Types</option>
              {LEAVE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        )}
      </div>

      {/* LEAVE HISTORY SUMMARY METRICS (Active when Tab === 'history') */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Records</p>
              <h4 className="text-lg font-extrabold text-slate-800">{historySummary.totalRequests}</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Approved Days</p>
              <h4 className="text-lg font-extrabold text-slate-800">{historySummary.totalDaysApproved} Days</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Approved</p>
              <h4 className="text-lg font-extrabold text-emerald-700">{historySummary.approvedCount}</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending</p>
              <h4 className="text-lg font-extrabold text-amber-600">{historySummary.pendingCount}</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rejected / Cancelled</p>
              <h4 className="text-lg font-extrabold text-rose-700">{historySummary.rejectedCount + historySummary.cancelledCount}</h4>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
          <p className="text-xs font-medium">Loading leave requests...</p>
        </div>
      ) : leaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center gap-3 shadow-xs">
          <FileText className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No leave requests found</p>
          <p className="text-xs text-slate-400">Apply for a leave or adjust filter parameters.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Type & Days</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Stage 1 (TL)</th>
                  <th className="py-3.5 px-4">Stage 2 (HR)</th>
                  <th className="py-3.5 px-4">Final Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {leaves.map((leave) => {
                  const hasReportingManager = leave.reportingManager && 
                    leave.reportingManager.trim() !== '' && 
                    leave.reportingManager.toLowerCase() !== 'unassigned';

                  const isStage1Approved = leave.teamLeadStatus === 'APPROVED' || !hasReportingManager;
                  const isPendingStage1 = leave.teamLeadStatus === 'PENDING' && hasReportingManager;

                  return (
                    <tr key={leave._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {leave.userName ? leave.userName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{leave.userName || 'Employee'}</div>
                            <div className="text-[10px] text-slate-400">
                              {(leave.department && leave.department !== 'General' ? leave.department : (leave.user?.departmentId?.name || leave.user?.department || leave.department || 'General'))} {leave.reportingManager ? `• TL: ${leave.reportingManager}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-indigo-700 block">{leave.leaveType}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{leave.totalDays} Day(s)</span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600 whitespace-nowrap">
                        {new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ➔ {new Date(leave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <p className="text-[11px] text-slate-600 truncate" title={leave.reason}>
                          "{leave.reason}"
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(leave.teamLeadStatus)}
                      </td>
                      <td className="py-3.5 px-4">
                        {isPendingStage1 ? (
                          <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-300" /> Awaiting Stage 1
                          </span>
                        ) : (
                          renderStatusBadge(leave.hrStatus)
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(leave.finalStatus)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSuperAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(leave)}
                                title="Edit Leave Request (SuperAdmin)"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => setDeleteModalLeave(leave)}
                                title="Delete Leave Request (SuperAdmin)"
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                          {activeTab === 'my' && leave.finalStatus === 'PENDING' && (
                            <button
                              onClick={() => setCancelModalLeave(leave)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}

                        {activeTab === 'team' && leave.finalStatus === 'PENDING' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openActionModal(leave, 'REJECTED', isHrOrAdmin ? 'hr' : 'team_lead')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => openActionModal(leave, 'APPROVED', isHrOrAdmin ? 'hr' : 'team_lead')}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                          </div>
                        )}

                        {activeTab === 'all' && leave.finalStatus === 'PENDING' && (
                          isStage1Approved ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {leave.isHrRequest && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 mr-1">
                                  👑 Needs MD Approval
                                </span>
                              )}
                              <button
                                onClick={() => openActionModal(leave, 'REJECTED', 'hr')}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => openActionModal(leave, 'APPROVED', 'hr')}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-600 font-medium">Awaiting Stage 1</span>
                          )
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {leaves.map((leave) => {
              const isRequesterTl = leave.teamLeadComment && leave.teamLeadComment.includes('Requester is Team Lead');
              const isStage1Approved = leave.teamLeadStatus === 'APPROVED' || isRequesterTl;
              const isPendingStage1 = leave.teamLeadStatus === 'PENDING' && !isRequesterTl;

              return (
                <motion.div
                  key={leave._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:shadow-md transition-all space-y-4 shadow-xs"
                >
                  <div className="space-y-3.5">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {leave.userName ? leave.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{leave.userName || 'Employee'}</h3>
                          <p className="text-[11px] text-slate-500">
                            {(leave.department && leave.department !== 'General' ? leave.department : (leave.user?.departmentId?.name || leave.user?.department || leave.department || 'General'))} {leave.reportingManager ? `• TL: ${leave.reportingManager}` : ''}
                          </p>
                        </div>
                      </div>
                      {renderStatusBadge(leave.finalStatus)}
                    </div>

                    {/* Leave Details Sub-Card */}
                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-800">
                        <span className="font-semibold text-indigo-700">{leave.leaveType}</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200/80 rounded-md font-bold text-slate-700 text-[11px]">
                          {leave.totalDays} Day(s)
                        </span>
                      </div>

                      <div className="text-[11px] font-medium text-slate-500 pt-0.5">
                        📅 {new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ➔ {new Date(leave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>

                      <div className="text-slate-600 text-xs italic bg-white p-2.5 rounded-lg border border-slate-200/60 font-normal">
                        "{leave.reason}"
                      </div>

                      {leave.ccUsers && leave.ccUsers.length > 0 && (
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1 pt-1">
                          <span className="font-semibold text-slate-600">CC:</span>
                          {leave.ccUsers.map((cc, idx) => {
                            const isMe = (cc.userId?._id || cc.userId)?.toString() === (user?.id || user?._id)?.toString();
                            return (
                              <span key={idx} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isMe ? 'bg-purple-100 text-purple-700 font-bold border border-purple-200 shadow-2xs' : 'bg-white border border-slate-200/80 text-slate-600'}`}>
                                {cc.name} {isMe ? '(You)' : ''}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Sequential 2-Stage Status Cards */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Stage 1: Team Lead Box */}
                      <div className={`p-2.5 rounded-xl border flex flex-col justify-between space-y-1.5 ${
                        leave.teamLeadStatus === 'APPROVED' 
                          ? 'bg-emerald-50/40 border-emerald-100' 
                          : leave.teamLeadStatus === 'REJECTED'
                          ? 'bg-rose-50/40 border-rose-100'
                          : 'bg-amber-50/30 border-amber-100'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Stage 1: Team Lead</span>
                        </div>
                        <div>
                          {renderStatusBadge(leave.teamLeadStatus)}
                        </div>
                        {leave.teamLeadActionBy?.name && (
                          <p className="text-[10px] text-slate-500 font-medium">By: {leave.teamLeadActionBy.name}</p>
                        )}
                        {leave.teamLeadComment && (
                          <p className="text-[10px] text-slate-500 italic line-clamp-1">"{leave.teamLeadComment}"</p>
                        )}
                      </div>

                      {/* Stage 2: HR / Admin Box */}
                      <div className={`p-2.5 rounded-xl border flex flex-col justify-between space-y-1.5 ${
                        leave.hrStatus === 'APPROVED' 
                          ? 'bg-emerald-50/40 border-emerald-100' 
                          : leave.hrStatus === 'REJECTED'
                          ? 'bg-rose-50/40 border-rose-100'
                          : isPendingStage1
                          ? 'bg-slate-50/50 border-slate-200/60 text-slate-400'
                          : 'bg-amber-50/30 border-amber-100'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                            {leave.isHrRequest || leave.requiresMdApproval ? 'Stage 2: MD' : 'Stage 2: HR'}
                          </span>
                        </div>
                        <div>
                          {isPendingStage1 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                              <Clock className="w-3 h-3 text-slate-300" /> Awaiting Stage 1
                            </span>
                          ) : (
                            renderStatusBadge(leave.hrStatus)
                          )}
                        </div>
                        {leave.hrActionBy?.name && (
                          <p className="text-[10px] text-slate-500 font-medium">By: {leave.hrActionBy.name}</p>
                        )}
                        {leave.hrComment && (
                          <p className="text-[10px] text-slate-500 italic line-clamp-1">"{leave.hrComment}"</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400">
                      Applied: {new Date(leave.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      {isSuperAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(leave)}
                            title="Edit Leave Request (Admin)"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteModalLeave(leave)}
                            title="Delete Leave Request (Admin)"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}

                      {activeTab === 'my' && leave.finalStatus === 'PENDING' && (
                        <button
                          onClick={() => setCancelModalLeave(leave)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        >
                          Cancel Request
                        </button>
                      )}

                      {/* Stage 1: Team Lead Action Buttons */}
                      {activeTab === 'team' && leave.finalStatus === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openActionModal(leave, 'REJECTED', isHrOrAdmin ? 'hr' : 'team_lead')}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => openActionModal(leave, 'APPROVED', isHrOrAdmin ? 'hr' : 'team_lead')}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      )}

                      {/* Stage 2: HR Action Buttons (Requires Stage 1 Approval) */}
                      {activeTab === 'all' && leave.finalStatus === 'PENDING' && (
                        isStage1Approved ? (
                          <div className="flex items-center gap-2">
                            {leave.isHrRequest && (
                              <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-bold">
                                👑 Needs MD Approval
                              </span>
                            )}
                            <button
                              onClick={() => openActionModal(leave, 'REJECTED', 'hr')}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => openActionModal(leave, 'APPROVED', 'hr')}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[11px] font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Awaiting Team Lead Approval
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* APPLY LEAVE MODAL */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsApplyModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md my-auto rounded-3xl shadow-2xl p-6 space-y-4 text-slate-800 dark:text-slate-100 overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Apply for Leave
              </h2>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Leave Type</label>
                <select
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  {LEAVE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-slate-700 dark:text-slate-300 font-semibold">
                <span>Calculated Duration:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{calculatedDays} Day(s)</span>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Reason for Leave</label>
                <textarea
                  name="reason"
                  rows={3}
                  value={formData.reason}
                  onChange={handleInputChange}
                  placeholder="Explain why you are taking leave..."
                  required
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">CC / Copy To (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setShowCcPicker(prev => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700"
                  >
                    <UserPlus className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    {showCcPicker ? 'Close List' : `+ Add CC ${selectedCcUsers.length > 0 ? `(${selectedCcUsers.length})` : ''}`}
                  </button>
                </div>

                {showCcPicker && (
                  <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-950/50 space-y-1 mt-1">
                    {staffUsers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 p-1">Loading staff list...</p>
                    ) : (
                      staffUsers.map(st => (
                        <label
                          key={st._id || st.id}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-white dark:hover:bg-slate-900 rounded-lg cursor-pointer text-xs transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCcUsers.includes(st._id || st.id)}
                            onChange={() => handleCcUserToggle(st._id || st.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-slate-800 dark:text-slate-200 font-medium">{st.name}</span>
                          <span className="text-[10px] text-slate-400">({st.department || st.role || 'Staff'})</span>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {!showCcPicker && selectedCcUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedCcUsers.map(id => {
                      const u = staffUsers.find(s => (s._id || s.id) === id);
                      return u ? (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-md text-[10px] font-medium">
                          {u.name}
                          <button type="button" onClick={() => handleCcUserToggle(id)} className="hover:text-rose-600 ml-0.5 font-bold cursor-pointer">✕</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer text-xs"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Request
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ACTION MODAL (Approve / Reject) */}
      {selectedLeave && actionModalType && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 text-slate-800 dark:text-slate-100 max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {actionModalType === 'APPROVED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                )}
                {actionRole === 'hr' ? 'Stage 2: HR Action' : 'Stage 1: Team Lead Action'} — {actionModalType}
              </h2>
              <button
                onClick={() => setSelectedLeave(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <p><strong>Employee:</strong> {selectedLeave.userName}</p>
              <p><strong>Type & Duration:</strong> {selectedLeave.leaveType} ({selectedLeave.totalDays} day(s))</p>
              <p><strong>Reason:</strong> "{selectedLeave.reason}"</p>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {actionRole === 'hr' ? 'HR Remarks' : 'Team Lead Remarks'} (Optional)
                </label>
                <textarea
                  rows={3}
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder="Enter remarks or approval notes..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLeave(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className={`px-5 py-2 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer text-xs ${
                    actionModalType === 'APPROVED'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm {actionModalType}
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* CANCEL LEAVE CONFIRMATION MODAL */}
      {cancelModalLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setCancelModalLeave(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md my-auto rounded-3xl shadow-2xl p-6 space-y-5 text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Cancel Leave Request?
                </h2>
              </div>
              <button
                onClick={() => setCancelModalLeave(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Are you sure you want to cancel and delete this leave request? This action cannot be undone.
              </p>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{cancelModalLeave.leaveType}</span>
                  <span className="px-2.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md font-extrabold text-slate-700 dark:text-slate-300 text-[11px] font-mono">
                    {cancelModalLeave.totalDays} Day(s)
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  📅 {new Date(cancelModalLeave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ➔ {new Date(cancelModalLeave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                {cancelModalLeave.reason && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    "{cancelModalLeave.reason}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalLeave(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                No, Keep Request
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelLeave}
                disabled={cancelSubmitting}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                {cancelSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Yes, Cancel Request
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SUPERADMIN EDIT LEAVE MODAL */}
      {editModalLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setEditModalLeave(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-6 space-y-4 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" /> Edit Leave Request (Admin)
              </h3>
              <button onClick={() => setEditModalLeave(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Leave Type</label>
                <select
                  value={editFormData.leaveType}
                  onChange={(e) => setEditFormData({ ...editFormData, leaveType: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none font-medium"
                >
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editFormData.endDate}
                    onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason</label>
                <textarea
                  rows={2}
                  value={editFormData.reason}
                  onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none font-medium resize-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">TL Status</label>
                  <select
                    value={editFormData.teamLeadStatus}
                    onChange={(e) => setEditFormData({ ...editFormData, teamLeadStatus: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-[11px] font-bold"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">HR Status</label>
                  <select
                    value={editFormData.hrStatus}
                    onChange={(e) => setEditFormData({ ...editFormData, hrStatus: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-[11px] font-bold"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Final Status</label>
                  <select
                    value={editFormData.finalStatus}
                    onChange={(e) => setEditFormData({ ...editFormData, finalStatus: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-[11px] font-bold"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalLeave(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  {editSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPERADMIN DELETE LEAVE MODAL */}
      {deleteModalLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setDeleteModalLeave(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-4 z-10">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Leave Request</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete the leave request for <strong>{deleteModalLeave.userName}</strong> ({deleteModalLeave.leaveType})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalLeave(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleteSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                {deleteSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Request</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
