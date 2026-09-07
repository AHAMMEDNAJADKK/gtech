import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit3, Trash2, Eye, X, Mail, Phone,
  Briefcase, Folder, UserCheck, ShieldAlert, Image as ImageIcon,
  Loader2, User, ChevronRight, CheckCircle2, AlertTriangle, Shield, BarChart3,
  ShieldCheck, KeyRound, Lock
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import PerformanceTab from '../components/PerformanceTab';
import PerformanceDashboard from './PerformanceDashboard';
const RAW_API_BASE = import.meta.env.VITE_API_URL || '/api';
const API_BASE = (RAW_API_BASE.endsWith('/') ? RAW_API_BASE.slice(0, -1) : RAW_API_BASE).replace(/\/+$/, '');
const ROLES = [
  { id: "0", name: "superadmin" },
  { id: "1", name: "hr" },
  { id: "2", name: "admin" },
  { id: "3", name: "employee" }
];

const ALL_SIDEBAR_ITEMS = [
  // --- OVERVIEW & GENERAL ---
  { label: 'Admin Dashboard', path: '/dashboard', category: 'Overview' },
  { label: 'Approvals', path: '/approvals', category: 'Overview' },
  { label: 'Leave Requests', path: '/leaves', category: 'Overview' },
  { label: 'Notifications', path: '/notifications', category: 'Overview' },

  // --- DASHBOARDS ---
  { label: 'MD Dashboard', path: '/md-dashboard', category: 'Dashboards' },
  { label: 'HR Dashboard', path: '/hr-dashboard', category: 'Dashboards' },
  { label: 'Lead Dashboard', path: '/lead-dashboard', category: 'Dashboards' },
  { label: 'Marketing Dashboard', path: '/marketing-dashboard', category: 'Dashboards' },
  { label: 'Dev Dashboard', path: '/developer-dashboard', category: 'Dashboards' },
  { label: 'GD Dashboard', path: '/graphic-designer-dashboard', category: 'Dashboards' },
  { label: 'Video Dashboard', path: '/videographer-dashboard', category: 'Dashboards' },
  { label: 'Counselor Dashboard', path: '/counselor-dashboard', category: 'Dashboards' },

  // --- PEOPLE & HR ---
  { label: 'Users', path: '/users', category: 'People & HR' },
  { label: 'Departments', path: '/departments', category: 'People & HR' },
  { label: 'Recruitment', path: '/recruitment', category: 'People & HR' },
  { label: 'Attendance', path: '/attendance', category: 'People & HR' },
  { label: 'Sidebar Permissions', path: '/sidebar-permissions', category: 'People & HR' },

  // --- SALES & CRM ---
  { label: 'Clients', path: '/clients', category: 'Sales & CRM' },
  { label: 'Leads Directory', path: '/leads', category: 'Sales & CRM' },
  { label: 'Client Leads', path: '/client-leads', category: 'Sales & CRM' },
  { label: 'Student Leads', path: '/leads-telecaller', category: 'Sales & CRM' },
  { label: 'Lead Counselor', path: '/lead-counselor', category: 'Sales & CRM' },

  // --- MARKETING & WORK ---
  { label: 'Projects', path: '/projects', category: 'Marketing & Work' },
  { label: 'Task Assign', path: '/todo', category: 'Marketing & Work' },
  { label: 'Content Calendar', path: '/calendar-work', category: 'Marketing & Work' },

  // --- FINANCE & PAYROLL ---
  { label: 'Accounts', path: '/accounts', category: 'Finance & Payroll' },
  { label: 'Sales', path: '/accounts/income', category: 'Finance & Payroll' },
  { label: 'Income', path: '/accounts/sales', category: 'Finance & Payroll' },
  { label: 'Purchase', path: '/accounts/purchase', category: 'Finance & Payroll' },
  { label: 'Create Invoice', path: '/accounts/create-invoice', category: 'Finance & Payroll' },
  { label: 'Expense Categories', path: '/accounts/categories', category: 'Finance & Payroll' },
  { label: 'Expense', path: '/accounts/expenses', category: 'Finance & Payroll' },
  { label: 'Salary Payment', path: '/accounts/salary', category: 'Finance & Payroll' },
  { label: 'Cash & Bank', path: '/accounts/cash-book', category: 'Finance & Payroll' },
  { label: 'Operation', path: '/accounts/operation', category: 'Finance & Payroll' },
  { label: 'Financial Report', path: '/accounts/reports', category: 'Finance & Payroll' },
  { label: 'Payslips', path: '/payslips', category: 'Finance & Payroll' },
  { label: 'Personal Payslip', path: '/my-payslip', category: 'Finance & Payroll' },

  // --- ACADEMY & LMS ---
  { label: 'Course Management', path: '/academy/courses', category: 'Academy & LMS' },
  { label: 'Batches', path: '/academy/batches', category: 'Academy & LMS' },
  { label: 'Enrollment Tracking', path: '/academy/enrollments', category: 'Academy & LMS' },
  { label: 'Student Attendance', path: '/student-attendance', category: 'Academy & LMS' },
  { label: 'My LMS Learning', path: '/academy/learning', category: 'Academy & LMS' },

  // --- REPORTS & ANALYTICS ---
  { label: 'KPI Analytics', path: '/performance-dashboard', category: 'Reports' },
  { label: 'AI Reports', path: '/ai-report', category: 'Reports' },
  { label: 'Employee Reports', path: '/employee-reports', category: 'Reports' },
  { label: 'Daily Report', path: '/basic-report', category: 'Reports' },
  { label: 'Team Reports', path: '/team-reports', category: 'Reports' },
  { label: 'HR Shift Report', path: '/hr-report', category: 'Reports' },
  { label: 'Ops Shift Report', path: '/ops-report', category: 'Reports' },
  { label: 'Accountant Shift Report', path: '/accountant-report', category: 'Reports' },
  { label: 'Marketing Shift Report', path: '/marketing-report', category: 'Reports' },
  { label: 'Developer Report', path: '/developer-report', category: 'Reports' },
  { label: 'Graphic Designer Report', path: '/graphic-designer-report', category: 'Reports' },
  { label: 'Videographer Report', path: '/videographer-report', category: 'Reports' },
  { label: 'Academic Counselor Report', path: '/academic-counselor-report', category: 'Reports' },
  { label: 'HOD R&D Report', path: '/hod-rd-report', category: 'Reports' },
  { label: 'HOD Marketing Report', path: '/hod-marketing-report', category: 'Reports' }
];

const STATUS_META = {
  active: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400', dot: 'bg-emerald-500' },
  inactive: { label: 'Inactive', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400', dot: 'bg-amber-500' },
  blocked: { label: 'Blocked', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400', dot: 'bg-rose-500' }
};

const PermissionModal = ({ isOpen, onClose, user, onSave, showToast, getAuthHeaders }) => {
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedPermissions(user.permissions || []);
      setIsSuperAdmin(Boolean(user.isSuperAdmin || user.role === 'superadmin'));
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const togglePermission = (label) => {
    setSelectedPermissions(prev =>
      prev.includes(label) ? prev.filter(p => p !== label) : [...prev, label]
    );
  };

  const handleSelectAll = () => {
    setSelectedPermissions(ALL_SIDEBAR_ITEMS.map(i => i.label));
  };

  const handleDeselectAll = () => {
    setSelectedPermissions([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = user.id || user._id;
      const res = await fetch(`${API_BASE}/v1/users/${userId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          permissions: selectedPermissions,
          isSuperAdmin,
          role: isSuperAdmin ? 'superadmin' : (user.role === 'superadmin' ? 'admin' : user.role)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Sidebar permissions updated successfully!", "success");

        // If editing self, update localStorage.user and notify app
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUserId = currentUser._id || currentUser.id;
        if (String(currentUserId) === String(userId)) {
          const updatedLocalUser = {
            ...currentUser,
            permissions: selectedPermissions,
            isSuperAdmin,
            role: isSuperAdmin ? 'superadmin' : currentUser.role
          };
          localStorage.setItem('user', JSON.stringify(updatedLocalUser));
          window.dispatchEvent(new Event('storage'));
        }

        onSave();
        onClose();
      } else {
        showToast(data.message || "Failed to update permissions.", "error");
      }
    } catch (err) {
      console.error("Error saving permissions:", err);
      showToast("Error updating permissions.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Group items by category
  const categories = [...new Set(ALL_SIDEBAR_ITEMS.map(i => i.category))];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[6000] bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-6"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <ShieldCheck size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">{user.name}</h2>
              <p className="text-xs text-indigo-100 font-bold uppercase tracking-wider">Configure Sidebar Access & Permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Super Admin Access Toggle */}
        <div className="p-6 bg-indigo-50/50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-indigo-500/20 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isSuperAdmin ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Shield size={20} />
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 block">Grant Super Admin Access</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Super Admins have unrestricted access to all pages, settings, and sidebar items across the platform.</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isSuperAdmin}
                onChange={(e) => setIsSuperAdmin(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        {/* Sidebar Menu Item Permissions List */}
        <div className="p-6 max-h-[50vh] overflow-y-auto space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Individual Sidebar Page Access</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                disabled={isSuperAdmin}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40 cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={handleDeselectAll}
                disabled={isSuperAdmin}
                className="text-[11px] font-bold text-slate-500 hover:underline disabled:opacity-40 cursor-pointer"
              >
                Deselect All
              </button>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
              <CheckCircle2 size={16} />
              <span>Super Admin mode enabled — All sidebar pages are automatically accessible to this user.</span>
            </div>
          )}

          {categories.map(cat => {
            const catItems = ALL_SIDEBAR_ITEMS.filter(i => i.category === cat);
            return (
              <div key={cat} className="space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-400">{cat}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {catItems.map(item => {
                    const isChecked = isSuperAdmin || selectedPermissions.includes(item.label);
                    return (
                      <label
                        key={item.label}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${isChecked
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/30 text-indigo-900 dark:text-indigo-100 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          } ${isSuperAdmin ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <span className="text-xs font-bold">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isSuperAdmin}
                          onChange={() => togglePermission(item.label)}
                          className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            <span>Save Permissions</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, active, inactive, blocked
  const [showKpiAnalytics, setShowKpiAnalytics] = useState(false);
  // Ensure it is initialized like this inside your component:
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isPermissionOpen, setIsPermissionOpen] = useState(false);
  const [permissionUser, setPermissionUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [imgErrors, setImgErrors] = useState({});

  const isHr = useMemo(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userObj = JSON.parse(savedUser);
        const role = String(userObj.role_id || userObj.roleId || userObj.role || '').toLowerCase().trim();
        const designation = String(userObj.designation || '').toLowerCase().trim();
        const designationId = String(userObj.designationId?._id || userObj.designationId || userObj.designation_id || '').trim();
        return role === 'hr' || designation.includes('hr');
      }
    } catch (e) {
      console.error("Error checking HR role in Users:", e);
    }
    return false;
  }, []);

  const handlePermissionClick = (user) => {
    if (isHr) {
      showToast("HR users cannot manage permissions.", "warning");
      return;
    }
    const userId = user.id || user._id;
    navigate(`/permissions/${userId}`);
  };

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` };
  }, []);


  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      // Appended roles parameter to query only explicit structural system role IDs
      const res = await fetch(`${API_BASE}/v1/users?roles=1,2,3`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        setUsers([]);
        return;
      }
      const data = await res.json();

      let incomingUsers = [];
      if (data.success && Array.isArray(data.data)) {
        incomingUsers = data.data;
      } else if (Array.isArray(data)) {
        incomingUsers = data;
      }

      // Strict structural filtering: ensures only matching target IDs (1, 2, 3) enter UI state
      const targetRolesOnly = incomingUsers.filter(user => {
        const userRoleId = String(user.roleId || user.role || '');
        return ['1', '2', '3'].includes(userRoleId) || ['hr', 'admin', 'employee'].includes(userRoleId.toLowerCase());
      });

      setUsers(targetRolesOnly);
    } catch (e) {
      console.error("Failed to fetch users:", e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchDesignations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/designations`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        setDesignations([]);
        return;
      }
      const data = await res.json();
      setDesignations(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      console.error("Failed to fetch designations:", e);
      setDesignations([]);
    }
  }, [getAuthHeaders]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/departments?status=true`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        setDepartments([]);
        return;
      }
      const data = await res.json();
      setDepartments(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      console.error("Failed to fetch departments:", e);
      setDepartments([]);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchUsers();
    fetchDesignations();
    fetchDepartments();
  }, [fetchUsers, fetchDesignations, fetchDepartments]);

  const handleDesignationCreated = useCallback((designation) => {
    setDesignations(prev => {
      const exists = prev.some(item => String(item.id) === String(designation.id));
      return exists ? prev : [...prev, designation].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleDesignationUpdated = useCallback((designation) => {
    setDesignations(prev => prev.map(item => String(item.id) === String(designation.id) ? designation : item).sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const handleDesignationDeleted = useCallback((id) => {
    setDesignations(prev => prev.filter(item => String(item.id) !== String(id)));
  }, []);

  const designationMap = useMemo(() => {
    return new Map(designations.map(designation => [String(designation.id), designation.name]));
  }, [designations]);

  const getDesignationName = useCallback((user) => {
    const id = user.designationId || user.designation;
    return user.designationName || designationMap.get(String(id)) || user.designation || 'General Staff';
  }, [designationMap]);

  const departmentMap = useMemo(() => {
    return new Map(departments.map(department => [
      String(department.id || department._id),
      department.name
    ]));
  }, [departments]);

  const getDepartmentName = useCallback((user) => {
    const departmentId = user.departmentId?._id || user.departmentId || user.department;
    return user.departmentId?.name || departmentMap.get(String(departmentId)) || user.departmentName || user.department || 'Unassigned';
  }, [departmentMap]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: users.length,
      active: users.filter(u => (u.status || 'active') === 'active').length,
      inactive: users.filter(u => (u.status || 'active') === 'inactive').length,
      blocked: users.filter(u => (u.status || 'active') === 'blocked').length
    };
  }, [users]);

  // Filtered & searched users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Tab filter
      if (activeTab !== 'all' && (user.status || 'active') !== activeTab) {
        return false;
      }
      // Search query filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.employeeId?.toLowerCase().includes(query) ||
        getDesignationName(user).toLowerCase().includes(query) ||
        getDepartmentName(user).toLowerCase().includes(query)
      );
    });
  }, [users, activeTab, searchQuery, getDesignationName, getDepartmentName]);

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever filter changes
  React.useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleDeleteUser = (id, name) => {
    setDeleteUserConfirm({ isOpen: true, id, name });
  };

  const handleConfirmDeleteUser = async () => {
    const { id, name } = deleteUserConfirm;
    setDeleteUserConfirm({ isOpen: false, id: null, name: '' });
    try {
      const res = await fetch(`${API_BASE}/v1/users/delete/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok || data.success) {
        setUsers(prev => prev.filter(u => u.id !== id && u._id !== id));
        showToast('Employee records purged successfully.', 'success');
      } else {
        showToast(data.message || 'Deletion failed.', 'error');
      }
    } catch (e) {
      console.error("Deletion failed:", e);
      showToast('Network or server error during deletion.', 'error');
    }
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  const handleViewClick = (user) => {
    setSelectedUser(user);
    setIsViewOpen(true);
  };

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-500">
      <div className="max-w-[1600px] mx-auto space-y-5">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2">
          <div>
            {/* <div className="flex items-center gap-3 mb-2">
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Nexus Staff Portal</span>
            </div> */}
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 italic tracking-tighter leading-none">
              EMPLOYEE <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-lime-400">LIST</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowKpiAnalytics(prev => !prev)}
              className={`group flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-[12px] uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer ${showKpiAnalytics
                  ? 'bg-indigo-600 text-white shadow-indigo-600/30 ring-2 ring-indigo-400'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              <BarChart3 size={16} className={showKpiAnalytics ? 'animate-bounce text-white' : 'text-indigo-500'} />
              <span>{showKpiAnalytics ? 'Hide KPI Analytics' : 'KPI Analytics'}</span>
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="group relative flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 dark:bg-slate-900 text-white dark:text-slate-100 border border-transparent dark:border-slate-800 shadow-lg hover:shadow-indigo-500/20 dark:hover:shadow-none rounded-full font-bold text-[12px] uppercase tracking-wider transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 bg-indigo-700 dark:bg-lime-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <Plus size={16} className="relative z-10" />
              <span className="relative z-10">Add Employee</span>
            </button>
          </div>
        </header>

        {/* Collapsible KPI Analytics Dashboard */}
        <AnimatePresence>
          {showKpiAnalytics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden bg-white/50 dark:bg-slate-900/40 p-4 md:p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 shadow-inner"
            >
              <PerformanceDashboard />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters and Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 py-1">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {['all', 'active', 'inactive', 'blocked'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer flex items-center gap-2 ${activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 dark:bg-slate-800 dark:border-slate-700 dark:shadow-none'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 dark:text-slate-400'
                  }`}
              >
                <span>{tab}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === tab ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                  {tabCounts[tab]}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative max-w-md w-full">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800/80 py-3.5 pl-4 pr-4 rounded-xl text-sm font-medium focus:border-indigo-500/50 dark:focus:border-indigo-400/50 outline-none transition-all duration-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Employees Table Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={40} />
            <p className="text-xs uppercase tracking-[0.2em] font-black text-slate-400 animate-pulse">Retrieving Core Intelligence</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center shadow-sm">
            <AlertTriangle className="mx-auto text-amber-500 mb-4 animate-bounce" size={40} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Records Discovered</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">No employees matched your status tabs or query criteria. Modify filters or initiate a new employee onboarding pipeline.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80">
                    <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Employee Details</th>
                    <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Contact</th>
                    <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Role / Designation</th>
                    <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Department / Manager</th>
                    <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
                    <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {pagedUsers.map((user) => {
                    const statusKey = user.status || (user.isActive ? 'active' : 'inactive');
                    const meta = STATUS_META[statusKey] || STATUS_META.active;
                    return (
                      <tr
                        key={user.id || user._id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-200 group"
                      >
                        {/* Profile & Name */}
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-4">
                            <div className="relative shrink-0">
                              {(user.avatar || user.profile_image || user.profileImage) && !imgErrors[user._id || user.id] ? (
                                <img
                                  src={user.avatar || user.profile_image || user.profileImage}
                                  alt={user.name}
                                  className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-800 shadow-sm"
                                  onError={() => {
                                    setImgErrors(prev => ({ ...prev, [user._id || user.id]: true }));
                                  }}
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-full bg-white-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shadow-sm">
                                  <User size={18} />
                                </div>
                              )}
                              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${meta.dot}`} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {user.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-extrabold tracking-widest uppercase truncate max-w-[180px]">
                                {user.employeeId || 'No ID'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact Info */}
                        <td className="py-4.5 px-6 text-xs text-slate-500 dark:text-slate-400 font-medium space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-slate-400" />
                            <span className="truncate max-w-[160px]">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} className="text-slate-400" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Designation / Role */}
                        <td className="py-4.5 px-6 text-xs space-y-1">
                          <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                            <Briefcase size={12} className="text-slate-400" />
                            <span>
                              {getDesignationName(user)}
                            </span>
                          </div>
                          {user.isSuperAdmin || user.role === 'superadmin' ? (
                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded inline-flex items-center gap-1">
                              <Shield size={10} /> Super Admin
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded inline-block">
                              {ROLES.find(r => String(r.id) === String(user.roleId || user.role))?.name || user.role || 'employee'}
                            </span>
                          )}
                        </td>

                        {/* Department / Manager */}
                        <td className="py-4.5 px-6 text-xs space-y-1">
                          <div className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <Folder size={12} className="text-slate-400" />
                            <span>{getDepartmentName(user)}</span>
                          </div>
                          {user.reportingManager && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              Manager: {user.reportingManager}
                            </p>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4.5 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.color}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {statusKey}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4.5 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewClick(user)}
                              className="p-2.5 bg-slate-100 hover:bg-indigo-500 hover:text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-all duration-300 cursor-pointer shadow-sm active:scale-90"
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleEditClick(user)}
                              className="p-2.5 bg-slate-100 hover:bg-amber-500 hover:text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-all duration-300 cursor-pointer shadow-sm active:scale-90"
                              title="Edit records"
                            >
                              <Edit3 size={14} />
                            </button>
                            {!isHr && (
                              <button
                                onClick={() => handlePermissionClick(user)}
                                className="p-2.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/40 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all duration-300 cursor-pointer shadow-sm active:scale-90"
                                title="Manage Sidebar Access & Super Admin Permissions"
                              >
                                <ShieldCheck size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id || user._id, user.name)}
                              className="p-2.5 bg-slate-100 hover:bg-rose-500 hover:text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-all duration-300 cursor-pointer shadow-sm active:scale-90"
                              title="Delete file"
                            >
                              <Trash2 size={14} />
                            </button>
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

        {/* Pagination */}
        {!loading && filteredUsers.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-2 py-3">
            <p className="text-xs text-slate-400 font-semibold">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredUsers.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} employees
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 text-xs font-bold rounded-lg border transition-all ${currentPage === p
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600'
                        }`}
                    >
                      {p}
                    </button>
                  )
                )
              }
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        )}

      </div>

      {/* CREATE & EDIT & VIEW MODALS */}
      <AnimatePresence>
        {isCreateOpen && (
          <CreateModal
            onClose={() => setIsCreateOpen(false)}
            refresh={fetchUsers}
            getAuthHeaders={getAuthHeaders}
            designations={designations}
            onDesignationCreated={handleDesignationCreated}
            onDesignationUpdated={handleDesignationUpdated}
            onDesignationDeleted={handleDesignationDeleted}
            departments={departments}
            showToast={showToast}
          />
        )}
        {isEditOpen && selectedUser && (
          <EditModal
            user={selectedUser}
            onClose={() => {
              setIsEditOpen(false);
              setSelectedUser(null);
            }}
            refresh={fetchUsers}
            getAuthHeaders={getAuthHeaders}
            designations={designations}
            onDesignationCreated={handleDesignationCreated}
            onDesignationUpdated={handleDesignationUpdated}
            onDesignationDeleted={handleDesignationDeleted}
            departments={departments}
            showToast={showToast}
          />
        )}
        {isViewOpen && selectedUser && (
          <ViewModal
            user={selectedUser}
            getDesignationName={getDesignationName}
            getDepartmentName={getDepartmentName}
            onClose={() => {
              setIsViewOpen(false);
              setSelectedUser(null);
            }}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteUserConfirm.isOpen}
        onClose={() => setDeleteUserConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={handleConfirmDeleteUser}
        title="Delete Employee?"
        message={`Are you absolutely sure you want to delete employee "${deleteUserConfirm.name}"? This action is permanent and cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        type="danger"
      />

      <PermissionModal
        isOpen={isPermissionOpen}
        onClose={() => {
          setIsPermissionOpen(false);
          setPermissionUser(null);
        }}
        user={permissionUser}
        onSave={fetchUsers}
        showToast={showToast}
        getAuthHeaders={getAuthHeaders}
      />
    </div>
  );
};

const ManageDesignationsModal = ({ onClose, designations, getAuthHeaders, onDesignationUpdated, onDesignationDeleted, showToast }) => {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteDesignationConfirm, setDeleteDesignationConfirm] = useState({ isOpen: false, id: null, name: '' });

  const handleEditStart = (id, currentName) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleEditSave = async (id) => {
    if (!editName.trim()) return;
    setSavingId(id);
    try {
      const res = await fetch(`${API_BASE}/v1/designations/${id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editName.trim() })
      });
      const data = await res.json();

      if (!res.ok && !data.success) {
        showToast(data.message || data.error || 'Failed to update designation.', 'error');
        return;
      }

      onDesignationUpdated(data.data);
      setEditingId(null);
      showToast('Designation updated successfully.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error updating designation.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = (id, name) => {
    setDeleteDesignationConfirm({ isOpen: true, id, name });
  };

  const handleConfirmDeleteDesignation = async () => {
    const { id, name } = deleteDesignationConfirm;
    setDeleteDesignationConfirm({ isOpen: false, id: null, name: '' });
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/v1/designations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (!res.ok && !data.success) {
        showToast(data.message || data.error || 'Failed to delete designation.', 'error');
        return;
      }

      onDesignationDeleted(id);
      showToast('Designation deleted successfully.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error deleting designation.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 bg-slate-950/40 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-xl max-h-[80vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">Manage Designations</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-slate-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {designations.map(d => (
            <div key={d.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800/40 gap-2">
              {editingId === d.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              ) : (
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{d.name}</span>
              )}

              <div className="flex gap-1.5 shrink-0">
                {editingId === d.id ? (
                  <>
                    <button
                      onClick={() => handleEditSave(d.id)}
                      disabled={savingId === d.id}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold"
                    >
                      {savingId === d.id ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 bg-slate-200 dark:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEditStart(d.id, d.name)}
                      className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg"
                      title="Edit Name"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id, d.name)}
                      disabled={deletingId === d.id}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {designations.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">No designations available.</p>
          )}
        </div>

        <ConfirmModal
          isOpen={deleteDesignationConfirm.isOpen}
          onClose={() => setDeleteDesignationConfirm({ isOpen: false, id: null, name: '' })}
          onConfirm={handleConfirmDeleteDesignation}
          title="Delete Designation"
          message={`Are you sure you want to delete the designation "${deleteDesignationConfirm.name}"?`}
          confirmText="Yes, Delete"
          cancelText="Cancel"
          type="danger"
        />
      </motion.div>
    </div>
  );
};

const DesignationSelect = ({
  value,
  onChange,
  designations,
  getAuthHeaders,
  onDesignationCreated,
  onDesignationUpdated,
  onDesignationDeleted,
  showToast
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);

  const handleAddDesignation = async () => {
    const name = window.prompt('Enter designation name');
    if (!name?.trim()) return;

    setIsAdding(true);
    try {
      const res = await fetch(`${API_BASE}/v1/designations`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim() })
      });
      const data = await res.json();

      if (!res.ok && !data.success) {
        showToast(data.message || data.error || 'Failed to add designation.', 'error');
        return;
      }

      const designation = data.data;
      onDesignationCreated(designation);
      onChange(String(designation.id));
      showToast('Designation added successfully.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error creating designation.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 w-full items-center">
        <div className="flex-1">
          <select required name="designation" className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select Designation</option>
            {designations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleAddDesignation}
          disabled={isAdding}
          title="Add designation"
          className="shrink-0 h-11 w-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all duration-300 hover:scale-[1.03] active:scale-95 disabled:opacity-60"
        >
          {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        </button>
        <button
          type="button"
          onClick={() => setIsManageOpen(true)}
          title="Edit/Delete designations"
          className="shrink-0 h-11 w-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all duration-300 hover:scale-[1.03] active:scale-95"
        >
          <Edit3 size={16} />
        </button>
      </div>

      <AnimatePresence>
        {isManageOpen && (
          <ManageDesignationsModal
            onClose={() => setIsManageOpen(false)}
            designations={designations}
            getAuthHeaders={getAuthHeaders}
            onDesignationUpdated={onDesignationUpdated}
            onDesignationDeleted={onDesignationDeleted}
            showToast={showToast}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// --- CREATE MODAL ---
const CreateModal = ({ onClose, refresh, getAuthHeaders, designations, onDesignationCreated, onDesignationUpdated, onDesignationDeleted, departments, showToast }) => {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const [form, setForm] = useState({
    employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    name: '',
    phone: '',
    email: '',
    designation: '',
    departmentId: '',
    reportingManager: '',
    status: 'active',
    role: 'employee',
    avatar: null,
    joining_date: new Date().toISOString().split('T')[0],
    salary: '',
    address: '',
    identityType: 'aadhaar',
    identityNumber: ''
  });
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, avatar: file });
      setPreview(URL.createObjectURL(file));
    }
  };
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Phone number validation
    if (!/^\d{10}$/.test(form.phone || '')) {
      showToast('Phone number must be exactly 10 digits.', 'warning');
      setIsSubmitting(false);
      return;
    }

    try {
      const fd = new FormData();

      // 1. Extract name and phone from the active form state
      const employeeName = form.name || "";
      const employeePhone = form.phone || "";

      // 2. Generate custom formula: FIRST 3 LETTERS (UPPERCASE) + LAST 3 DIGITS
      const namePart = employeeName.trim().slice(0, 3).toUpperCase();
      const phonePart = employeePhone.trim().slice(-3) || "123"; // Fallback if phone is empty

      const dynamicPassword = `${namePart}${phonePart}`; // e.g., "ABC454"

      // 3. Append your standard state keys to FormData
      Object.keys(form).forEach(key => {
        if (key === 'avatar') {
          if (form.avatar && form.avatar instanceof File) {
            fd.append('profileImage', form.avatar);
          } else if (typeof form.avatar === 'string' && form.avatar) {
            fd.append('avatar', form.avatar);
            fd.append('profile_image', form.avatar);
          }
        } else if (form[key] !== null && form[key] !== undefined) {
          fd.append(key, form[key]);
        }
      });

      // 4. Inject the dynamically calculated password instead of a static string
      fd.append('password', dynamicPassword);

      // 5. Send payload to your backend API
      const res = await fetch(`${API_BASE}/v1/users/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd
      });

      const data = await res.json();
      if (res.ok || data.success) {
        // 💡 Displaying the generated password in the success toast so HR can copy it instantly
        showToast(`Employee created! Temp Password: ${dynamicPassword}`, 'success');
        await refresh();
        onClose();
      } else {
        showToast(data.message || data.error || 'Failed to onboard employee.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error connecting to the onboard api.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex justify-center items-start pt-6 overflow-y-auto p-4"
    >
      <motion.div
        initial={{ y: -50, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: -50, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-5xl rounded-3xl p-6 md:p-8 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><X size={20} /></button>

        <header className="mb-6">
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 italic uppercase tracking-tighter">ADD <span className="text-indigo-600 dark:text-indigo-400">EMPLOYEE FILE</span></h2>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input fields — 3-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Employee ID</label>
              <input required name="employeeId" className="w-full text-xs py-2" value={form.employeeId} onChange={handleInputChange} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Full Name</label>
              <input required name="name" className="w-full text-xs py-2" placeholder="NAME" value={form.name} onChange={handleInputChange} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Phone Number</label>
              <input
                required
                name="phone"
                type="tel"
                maxLength={10}
                className={`w-full border rounded-xl px-3 py-2 text-xs outline-none transition focus:ring-1 ${form.phone && form.phone.length !== 10
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-850 dark:text-white'
                  }`}
                placeholder="10-digit number"
                value={form.phone}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setForm(prev => ({ ...prev, phone: digits }));
                }}
              />
              {form.phone && form.phone.length !== 10 && (
                <p className="text-[9px] text-red-500 ml-1">Must be 10 digits.</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Corporate Email</label>
              <input required type="email" name="email" className="w-full text-xs py-2" placeholder="EMAIL" value={form.email} onChange={handleInputChange} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Corporate Designation</label>
              <DesignationSelect
                value={form.designation}
                onChange={(designation) => setForm(prev => ({ ...prev, designation }))}
                designations={designations}
                getAuthHeaders={getAuthHeaders}
                onDesignationCreated={onDesignationCreated}
                onDesignationUpdated={onDesignationUpdated}
                onDesignationDeleted={onDesignationDeleted}
                showToast={showToast}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Department Assignment</label>
              <select
                required
                name="departmentId"
                value={form.departmentId}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 cursor-pointer"
              >
                <option value="" disabled>SELECT DEPARTMENT</option>
                {departments.map((dept) => (
                  <option key={dept._id || dept.id} value={dept._id || dept.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {dept.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Reporting Manager</label>
              <input required name="reportingManager" className="w-full text-xs py-2" placeholder="MANAGER" value={form.reportingManager} onChange={handleInputChange} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">System Status</label>
              <select name="status" className="w-full text-xs py-2" value={form.status} onChange={handleInputChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">System Role</label>
              <select name="role" className="w-full text-xs py-2" value={form.role} onChange={handleInputChange}>
                {ROLES.map(r => (
                  <option key={r.id} value={r.name}>{r.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Monthly Salary</label>
              <input name="salary" type="number" className="w-full text-xs py-2" placeholder="SALARY" value={form.salary} onChange={handleInputChange} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Joining Date</label>
              <input required name="joining_date" type="date" className="w-full text-xs py-2" value={form.joining_date} onChange={handleInputChange} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Identity Type</label>
              <select name="identityType" className="w-full text-xs py-2" value={form.identityType} onChange={handleInputChange}>
                <option value="aadhaar">Aadhaar</option>
                <option value="pan">PAN</option>
                <option value="passport">Passport</option>
                <option value="driving_license">Driving License</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">ID Number</label>
              <input required name="identityNumber" className="w-full text-xs py-2" placeholder="ID NUMBER" value={form.identityNumber} onChange={handleInputChange} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Profile Photo</label>
              <div className="relative group flex items-center gap-2 w-full border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 bg-slate-50 dark:bg-slate-900 hover:border-indigo-500 transition-all cursor-pointer">
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer w-full" onChange={handleAvatarChange} />
                {preview ? (
                  <img src={preview} className="w-7 h-7 rounded-lg object-cover shrink-0" alt="preview" />
                ) : (
                  <ImageIcon size={14} className="text-slate-400 group-hover:text-indigo-500 shrink-0" />
                )}
                <span className="text-[10px] text-slate-400 truncate">{preview ? 'Photo selected' : 'Click to upload · JPG/PNG'}</span>
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Residential Address</label>
              <input name="address" className="w-full text-xs py-2" placeholder="Address" value={form.address} onChange={handleInputChange} />
            </div>
          </div>

          <button
            disabled={isSubmitting}
            className="w-full py-4 bg-indigo-600 dark:bg-indigo-500 text-white dark:text-slate-900 dark:font-black font-bold rounded-2xl uppercase text-[11px] tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.005] active:scale-[0.99]"
          >
            {isSubmitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CheckCircle2 size={15} />
            )}
            Add Employee
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

// --- EDIT MODAL ---
const EditModal = ({ user, onClose, refresh, getAuthHeaders, designations, onDesignationCreated, onDesignationUpdated, onDesignationDeleted, departments, showToast }) => {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const [form, setForm] = useState({
    employeeId: user.employeeId || '',
    name: user.name || '',
    phone: user.phone || '',
    email: user.email || '',
    designation: user.designationId || user.designation || '',
    departmentId: user.departmentId?._id || user.departmentId || user.department || '',
    reportingManager: user.reportingManager || '',
    status: user.status || 'active',
    role: user.role || 'employee',
    avatar: null,
    joining_date: user.joining_date ? new Date(user.joining_date).toISOString().split('T')[0] : '',
    salary: user.salary || '',
    address: user.address || '',
    identityType: user.identityType || 'aadhaar',
    identityNumber: user.identityNumber || ''
  });
  const [preview, setPreview] = useState(user.avatar || user.profile_image || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!form.designation || designations.some(d => String(d.id) === String(form.designation))) return;

    const matchingDesignation = designations.find(d => d.name.toLowerCase() === String(form.designation).toLowerCase());
    if (matchingDesignation) {
      setForm(prev => ({ ...prev, designation: String(matchingDesignation.id) }));
    }
  }, [designations, form.designation]);

  useEffect(() => {
    if (!form.departmentId || departments.some(d => String(d.id || d._id) === String(form.departmentId))) return;

    const matchingDepartment = departments.find(d => d.name.toLowerCase() === String(form.departmentId).toLowerCase());
    if (matchingDepartment) {
      setForm(prev => ({ ...prev, departmentId: String(matchingDepartment.id || matchingDepartment._id) }));
    }
  }, [departments, form.departmentId]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, avatar: file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const fd = new FormData();
      Object.keys(form).forEach(key => {
        if (key === 'avatar') {
          if (form.avatar && form.avatar instanceof File) {
            fd.append('profileImage', form.avatar);
          } else if (typeof form.avatar === 'string' && form.avatar) {
            fd.append('avatar', form.avatar);
            fd.append('profile_image', form.avatar);
          }
        } else if (form[key] !== null && form[key] !== undefined) {
          fd.append(key, form[key]);
        }
      });

      const res = await fetch(`${API_BASE}/v1/users/update/${user.id || user._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: fd
      });

      const data = await res.json();
      if (res.ok || data.success) {
        showToast('Employee data synchronized successfully.', 'success');
        await refresh();
        onClose();
      } else {
        showToast(data.message || data.error || 'Synchronization failed.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error reaching the synchronizer api.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex justify-center items-start pt-6 overflow-y-auto p-4"
    >
      <motion.div
        initial={{ y: -50, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: -50, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-5xl rounded-3xl p-8 md:p-10 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><X size={20} /></button>

        <header className="mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 italic uppercase tracking-tighter">EDIT <span className="text-indigo-600 dark:text-indigo-400">EMPLOYEE FILE</span></h2>
          {/* <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Synchronizing Tactical Assets</p> */}
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fields Grid — full width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Employee ID</label>
              <input required name="employeeId" className="w-full" value={form.employeeId} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Full Name</label>
              <input required name="name" className="w-full" placeholder="NAME" value={form.name} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Phone Number</label>
              <input
                required
                name="phone"
                type="tel"
                maxLength={10}
                className={`w-full border rounded-xl px-3 py-2 text-sm outline-none transition focus:ring-1 ${form.phone && form.phone.length !== 10
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                  }`}
                placeholder="10-digit number"
                value={form.phone}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setForm(prev => ({ ...prev, phone: digits }));
                }}
              />
              {form.phone && form.phone.length !== 10 && (
                <p className="text-[10px] text-red-500 ml-1">Must be exactly 10 digits.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Corporate Email</label>
              <input required type="email" name="email" className="w-full" placeholder="EMAIL" value={form.email} onChange={handleInputChange} disabled />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Corporate Designation</label>
              <DesignationSelect
                value={form.designation}
                onChange={(designation) => setForm(prev => ({ ...prev, designation }))}
                designations={designations}
                getAuthHeaders={getAuthHeaders}
                onDesignationCreated={onDesignationCreated}
                onDesignationUpdated={onDesignationUpdated}
                onDesignationDeleted={onDesignationDeleted}
                showToast={showToast}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Department Assignment</label>
              <select
                required
                name="departmentId"
                value={form.departmentId}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 cursor-pointer"
              >
                <option value="" disabled>SELECT DEPARTMENT</option>
                {departments.map((dept) => (
                  <option
                    key={dept._id || dept.id}
                    value={dept._id || dept.id}
                    className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    {dept.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Reporting Manager</label>
              <input required name="reportingManager" className="w-full" placeholder="MANAGER" value={form.reportingManager} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">System Status</label>
              <select name="status" className="w-full" value={form.status} onChange={handleInputChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">System Role</label>
              <select name="role" className="w-full" value={form.role} onChange={handleInputChange}>
                {ROLES.map(r => (
                  <option key={r.id} value={r.name}>{r.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Monthly Salary</label>
              <input name="salary" type="number" className="w-full" placeholder="SALARY" value={form.salary} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Joining Date</label>
              <input required name="joining_date" type="date" className="w-full" value={form.joining_date} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Identity Type</label>
              <select name="identityType" className="w-full" value={form.identityType} onChange={handleInputChange}>
                <option value="aadhaar">Aadhaar</option>
                <option value="pan">PAN</option>
                <option value="passport">Passport</option>
                <option value="driving_license">Driving License</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">ID Number</label>
              <input required name="identityNumber" className="w-full" placeholder="ID NUMBER" value={form.identityNumber} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Profile Photo</label>
              <div className="relative group flex items-center gap-2 w-full border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 bg-slate-50 dark:bg-slate-900 hover:border-indigo-500 transition-all cursor-pointer">
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer w-full" onChange={handleAvatarChange} />
                {preview ? (
                  <img src={preview} className="w-7 h-7 rounded-lg object-cover shrink-0" alt="preview" />
                ) : (
                  <ImageIcon size={14} className="text-slate-400 group-hover:text-indigo-500 shrink-0" />
                )}
                <span className="text-[10px] text-slate-400 truncate">{preview ? 'Photo selected' : 'Click to upload · JPG/PNG'}</span>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block ml-1">Residential Address</label>
              <input name="address" className="w-full" placeholder="Address" value={form.address} onChange={handleInputChange} />
            </div>
          </div>

          <button
            disabled={isSubmitting}
            className="w-full py-4 bg-indigo-600 dark:bg-indigo-500 text-white dark:text-slate-900 dark:font-black font-bold rounded-2xl uppercase text-[11px] tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.005] active:scale-[0.99]"
          >
            {isSubmitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CheckCircle2 size={15} />
            )}
            Save Changes
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

// --- VIEW DOSSIER MODAL ---
const ViewModal = ({ user, getDesignationName, getDepartmentName, onClose }) => {
  const [activeModalTab, setActiveModalTab] = useState('dossier'); // 'dossier' | 'performance'
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  // Determine status configurations dynamically
  const statusKey = user.status || (user.isActive ? 'active' : 'inactive');
  const STATUS_META = {
    active: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400', dot: 'bg-emerald-500' },
    inactive: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400', dot: 'bg-amber-500' },
    blocked: { color: 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400', dot: 'bg-rose-500' }
  };
  const meta = STATUS_META[statusKey] || STATUS_META.active;

  // Mirror the dynamic format: FIRST 3 LETTERS (UPPERCASE) + LAST 3 DIGITS OF PHONE
  const namePart = (user.name || "").trim().slice(0, 3).toUpperCase();
  const phonePart = (user.phone || "").trim().slice(-3) || "123";
  const implicitPassword = `${namePart}${phonePart}`;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex justify-center items-start pt-6 overflow-y-auto p-4"
    >
      <motion.div
        initial={{ y: -30, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -30, scale: 0.97 }}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full ${activeModalTab === 'performance' ? 'max-w-6xl' : 'max-w-3xl'} rounded-3xl shadow-2xl transition-all duration-300`}
      >
        {/* ── Modal Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Employee <span className="text-indigo-600 dark:text-indigo-400">File</span></h2>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {(user.avatar || user.profile_image || user.profileImage) && !imgError ? (
                <img
                  src={user.avatar || user.profile_image || user.profileImage}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                  <User size={18} className="text-white" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-none">{user.name}</h3>
                <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-0.5 uppercase tracking-widest font-semibold">{getDesignationName(user)}</p>
              </div>
            </div>

            {/* Sub-Tab Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
              <button
                onClick={() => setActiveModalTab('dossier')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeModalTab === 'dossier'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
              >
                Personnel Details
              </button>
              <button
                onClick={() => setActiveModalTab('performance')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeModalTab === 'performance'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
              >
                Performance & KPI
              </button>
            </div>
          </div>
        </div>

        {activeModalTab === 'dossier' ? (
          <>
            {/* ── Contact Row ── */}
            <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" />{user.email || 'N/A'}</span>
              {user.phone && <span className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" />{user.phone}</span>}
            </div>

            {/* ── Details Grid ── */}
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
              {[
                { label: 'Employee ID', value: user.employeeId },
                { label: 'System Role', value: user.role, upper: true },
                { label: 'Department', value: getDepartmentName(user) },
                { label: 'Rep. Manager', value: user.reportingManager || 'Unassigned' },
                { label: 'Monthly Salary', value: `₹${user.salary || '0'}` },
                { label: 'Joining Date', value: user.joining_date ? new Date(user.joining_date).toLocaleDateString() : 'N/A' },
                { label: 'Identity Type', value: user.identityType, upper: true },
                { label: 'ID Number', value: user.identityNumber },
              ].map(({ label, value, upper }) => (
                <div key={label}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className={`text-xs font-semibold text-slate-700 dark:text-slate-200 ${upper ? 'uppercase' : ''}`}>{value || 'N/A'}</p>
                </div>
              ))}
              <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Residential Address</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{user.address || 'N/A'}</p>
              </div>
            </div>

            {/* ── Password Footer ── */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40 rounded-b-2xl">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-lime-400">Initial System Password</p>
                <p className="text-[10px] text-slate-400 mt-0.5">First 3 letters of name + last 3 digits of phone</p>
              </div>
              <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm font-bold tracking-wider text-slate-800 dark:text-slate-100 select-all shadow-sm">
                {implicitPassword}
              </div>
            </div>
          </>
        ) : (
          <div className="p-6">
            <PerformanceTab user={user} />
          </div>
        )}

      </motion.div>
    </motion.div>
  );
};

export default Users;
