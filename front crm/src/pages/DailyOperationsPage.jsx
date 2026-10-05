import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  Clock, Plus, Search, CheckCircle2, AlertCircle, RefreshCw, 
  ChevronRight, ChevronDown, ChevronUp, Calendar, Building, Sparkles, Send, ShieldAlert, FileText, Filter, X, Pencil, Trash2, Users,
  ListTodo, CheckSquare, Square, Tag, PlusCircle, Check, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../components/ToastProvider';
import { useUser } from '../contexts/UserContext';

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

const isExcludedDepartment = (deptName) => {
  if (!deptName) return true;
  const lower = String(deptName).toLowerCase().trim();
  return lower === 'user' || lower === 'users' || lower === 'user accounts';
};

const DailyOperationsPage = () => {
  const { showToast } = useToast();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Data states
  const [activeTab, setActiveTab] = useState('operations'); // 'operations' | 'manager_todo'
  const [routines, setRoutines] = useState([]);
  const [briefings, setBriefings] = useState([]);
  const [eodClosures, setEodClosures] = useState([]);
  const [managerToDos, setManagerToDos] = useState([]);

  // Manager To-Do UI states
  const [toDoFilter, setToDoFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'assigned' | 'unassigned'
  const [newToDoTask, setNewToDoTask] = useState('');
  const [newToDoPriority, setNewToDoPriority] = useState('medium');
  const [newToDoCategory, setNewToDoCategory] = useState('General');
  const [newToDoAssignedTo, setNewToDoAssignedTo] = useState(''); // '' = Unassigned
  const [addingToDo, setAddingToDo] = useState(false);
  const [editingToDo, setEditingToDo] = useState(null);
  const [deletingToDo, setDeletingToDo] = useState(null);
  const [staffUsers, setStaffUsers] = useState([]);

  // Raw departments state for ID -> Name resolution
  const [rawDepartments, setRawDepartments] = useState([]);

  // Robust department matcher helper
  const isSameDepartment = useCallback((dept1, dept2) => {
    if (!dept1 || !dept2) return false;
    let str1 = String(dept1).trim();
    let str2 = String(dept2).trim();

    if (str1.toLowerCase() === str2.toLowerCase()) return true;

    const resolveName = (str) => {
      if (/^[0-9a-fA-F]{24}$/.test(str) && Array.isArray(rawDepartments)) {
        const found = rawDepartments.find(d => String(d._id) === str || String(d.id) === str);
        if (found && (found.name || found.departmentName || found.title)) {
          return String(found.name || found.departmentName || found.title).trim();
        }
      }
      return str;
    };

    str1 = resolveName(str1).toLowerCase();
    str2 = resolveName(str2).toLowerCase();

    if (str1 === str2) return true;

    const clean = (s) => s.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
    const c1 = clean(str1);
    const c2 = clean(str2);

    if (c1 && c2 && c1 === c2) return true;

    return false;
  }, [rawDepartments]);

  // Active Departments State (Only Active Departments from database)
  const [activeDepartments, setActiveDepartments] = useState([]);
  const [selectedDeptsForRoutine, setSelectedDeptsForRoutine] = useState([]);
  const [selectedDeptForRoutine, setSelectedDeptForRoutine] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');

  // Helper to get logged-in user's department name
  const getUserDeptName = useCallback(() => {
    if (!user) return '';
    if (user.department && typeof user.department === 'object' && user.department.name) return String(user.department.name).trim();
    if (user.departmentId && typeof user.departmentId === 'object' && user.departmentId.name) return String(user.departmentId.name).trim();
    if (user.departmentName && typeof user.departmentName === 'string' && !/^[0-9a-fA-F]{24}$/.test(user.departmentName.trim())) return user.departmentName.trim();

    let rawVal = '';
    if (typeof user.department === 'string' && user.department.trim()) rawVal = user.department.trim();
    else if (user.departmentId && typeof user.departmentId === 'string' && user.departmentId.trim()) rawVal = user.departmentId.trim();

    if (!rawVal) return '';

    if (/^[0-9a-fA-F]{24}$/.test(rawVal) && Array.isArray(rawDepartments)) {
      const matchedDeptObj = rawDepartments.find(d => String(d._id) === rawVal || String(d.id) === rawVal);
      if (matchedDeptObj && (matchedDeptObj.name || matchedDeptObj.departmentName)) {
        return String(matchedDeptObj.name || matchedDeptObj.departmentName).trim();
      }
    }

    const matchedActive = activeDepartments.find(ad => isSameDepartment(ad, rawVal));
    if (matchedActive) return matchedActive;

    if (!/^[0-9a-fA-F]{24}$/.test(rawVal)) return rawVal;

    return '';
  }, [user, rawDepartments, activeDepartments, isSameDepartment]);

  // Robust helper to check if an EOD closure was submitted by the currently logged-in user
  const isEodSubmittedByUser = useCallback((eod, currentUser) => {
    if (!eod || !currentUser) return false;
    const currentUserId = String(currentUser._id || currentUser.id || '').trim();

    let eodUserId = '';
    if (eod.user) {
      if (typeof eod.user === 'object') {
        eodUserId = String(eod.user._id || eod.user.id || '').trim();
      } else {
        eodUserId = String(eod.user).trim();
      }
    }
    if (!eodUserId && eod.userId) {
      eodUserId = String(eod.userId).trim();
    }

    if (currentUserId && eodUserId && currentUserId === eodUserId) {
      return true;
    }

    if (currentUser.email && eod.user && typeof eod.user === 'object' && eod.user.email) {
      if (String(eod.user.email).toLowerCase().trim() === String(currentUser.email).toLowerCase().trim()) {
        return true;
      }
    }

    if (currentUser.name && (eod.userName || (eod.user && typeof eod.user === 'object' && eod.user.name))) {
      const eodName = String(eod.userName || (eod.user && eod.user.name)).toLowerCase().trim();
      const currentName = String(currentUser.name).toLowerCase().trim();
      if (eodName && currentName && eodName === currentName) {
        return true;
      }
    }

    return false;
  }, []);

  // Multi-department Timeline Filter State
  const [selectedDeptFilters, setSelectedDeptFilters] = useState([]);
  const [hasAutoSelectedUserDept, setHasAutoSelectedUserDept] = useState(false);

  // Form states - Department Briefing
  const [selectedBriefingDepts, setSelectedBriefingDepts] = useState([]);
  const [briefingPriority, setBriefingPriority] = useState('');
  const [briefingDeliverables, setBriefingDeliverables] = useState('');
  const [briefingBlockers, setBriefingBlockers] = useState('');
  const [briefingSaving, setBriefingSaving] = useState(false);

  useEffect(() => {
    if (activeDepartments.length > 0) {
      const userDept = getUserDeptName();
      const matched = userDept ? activeDepartments.find(d => isSameDepartment(d, userDept)) : null;

      if (selectedBriefingDepts.length === 0) {
        setSelectedBriefingDepts([matched || activeDepartments[0]]);
      }
    }
  }, [activeDepartments, user, getUserDeptName, selectedBriefingDepts.length, isSameDepartment]);

  const toggleBriefingDeptSelection = (deptName) => {
    setSelectedBriefingDepts(prev => {
      if (prev.includes(deptName)) {
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== deptName);
      } else {
        return [...prev, deptName];
      }
    });
  };

  // Form states - EOD Closure
  const [eodCompleted, setEodCompleted] = useState('');
  const [eodPendingReason, setEodPendingReason] = useState('');
  const [eodTomorrowPriority, setEodTomorrowPriority] = useState('');
  const [eodSubmitting, setEodSubmitting] = useState(false);

  // EOD View Filter ('mine' = only submitted by logged-in user, 'all' = all staff reports for superadmin)
  const [eodViewFilter, setEodViewFilter] = useState('mine');

  // Department Briefing Inline Dropdown states
  const [openDeptBriefings, setOpenDeptBriefings] = useState({});
  const [deptBriefingDrafts, setDeptBriefingDrafts] = useState({});
  const [savingInlineDeptBriefing, setSavingInlineDeptBriefing] = useState(null);

  const toggleDeptBriefing = (deptName) => {
    setOpenDeptBriefings(prev => ({
      ...prev,
      [deptName]: !prev[deptName]
    }));
  };

  const getDeptBriefingDraft = (deptName) => {
    const existing = briefings.find(b => b.department && b.department.toLowerCase() === deptName.toLowerCase());
    const draft = deptBriefingDrafts[deptName];
    return {
      priority: draft?.priority !== undefined ? draft.priority : (existing?.priority || ''),
      deliverables: draft?.deliverables !== undefined ? draft.deliverables : (existing?.deliverables || ''),
      blockers: draft?.blockers !== undefined ? draft.blockers : (existing?.blockers || '')
    };
  };

  const handleDeptBriefingDraftChange = (deptName, field, value) => {
    const current = getDeptBriefingDraft(deptName);
    setDeptBriefingDrafts(prev => ({
      ...prev,
      [deptName]: {
        ...current,
        [field]: value
      }
    }));
  };

  const handleSaveInlineDeptBriefing = async (deptName) => {
    setSavingInlineDeptBriefing(deptName);
    const draft = getDeptBriefingDraft(deptName);
    try {
      const res = await fetch(getApiEndpoint('/daily-operations/briefing'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          department: deptName,
          priority: draft.priority,
          deliverables: draft.deliverables,
          blockers: draft.blockers,
          date: selectedDate
        })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        showToast(`Daily briefing for ${deptName} saved successfully!`, 'success');
        fetchData();
      } else {
        showToast(data.message || 'Failed to save briefing', 'error');
      }
    } catch (err) {
      console.error('Error saving department briefing:', err);
      showToast('Error saving department briefing', 'error');
    } finally {
      setSavingInlineDeptBriefing(null);
    }
  };

  // Routine Modal
  const [showAddRoutineModal, setShowAddRoutineModal] = useState(false);
  const [newRoutineTime, setNewRoutineTime] = useState('');
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [newRoutineSubtitle, setNewRoutineSubtitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const [addingRoutine, setAddingRoutine] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Superadmin / Admin Check
  const isSuperAdmin = Boolean(
    user?.isSuperAdmin || 
    user?.role === '0' ||
    user?.role_id === '0' ||
    user?.roleId === '0' ||
    String(user?.role || '').toLowerCase().includes('super') || 
    String(user?.role || '').toLowerCase().includes('admin') ||
    String(user?.role_id || user?.roleId || '') === '0' ||
    String(user?.role_id || user?.roleId || '') === '1' ||
    String(user?.role || '').toLowerCase() === 'superadmin' ||
    String(user?.role || '').toLowerCase() === 'admin'
  );

  // Edit Routine Modal
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [editRoutineTime, setEditRoutineTime] = useState('');
  const [editRoutineTitle, setEditRoutineTitle] = useState('');
  const [editRoutineSubtitle, setEditRoutineSubtitle] = useState('');
  const [editDeptSelect, setEditDeptSelect] = useState('');
  const [editCustomSubtitle, setEditCustomSubtitle] = useState('');
  const [updateRecurring, setUpdateRecurring] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Routine Modal
  const [deletingRoutine, setDeletingRoutine] = useState(null);
  const [deleteFromFuture, setDeleteFromFuture] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Edit Briefing Modal State
  const [editingBriefing, setEditingBriefing] = useState(null);
  const [editBriefingPriority, setEditBriefingPriority] = useState('');
  const [editBriefingDeliverables, setEditBriefingDeliverables] = useState('');
  const [editBriefingBlockers, setEditBriefingBlockers] = useState('');
  const [savingBriefingEdit, setSavingBriefingEdit] = useState(false);

  // Delete Briefing Modal State
  const [deletingBriefing, setDeletingBriefing] = useState(null);
  const [deletingBriefingSaving, setDeletingBriefingSaving] = useState(false);

  // Edit EOD Report Modal State
  const [editingEod, setEditingEod] = useState(null);
  const [editEodCompleted, setEditEodCompleted] = useState('');
  const [editEodPendingReason, setEditEodPendingReason] = useState('');
  const [editEodTomorrowPriority, setEditEodTomorrowPriority] = useState('');
  const [savingEodEdit, setSavingEodEdit] = useState(false);

  // Delete EOD Report Modal State
  const [deletingEod, setDeletingEod] = useState(null);
  const [deletingEodSaving, setDeletingEodSaving] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 
      'Content-Type': 'application/json',
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` 
    };
  }, []);

  // Fetch active departments from backend (only active status=true)
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch(getApiEndpoint('/departments?status=true'), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          setRawDepartments(data.data);
          // Filter strictly active status
          const activeOnly = data.data.filter(d => d.status === true || String(d.status) === 'true' || d.isActive === true);
          const activeNames = activeOnly
            .map(d => d.name || d.departmentName || d.title)
            .filter(Boolean)
            .filter(name => !isExcludedDepartment(name));

          if (activeNames.length > 0) {
            setActiveDepartments(activeNames);
            setSelectedDeptForRoutine(prev => prev || activeNames[0]);
            setNewRoutineSubtitle(prev => prev || activeNames[0]);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch active departments list:', err);
    }
  }, [getAuthHeaders]);

  const fetchStaffUsers = useCallback(async () => {
    try {
      const res = await fetch(getApiEndpoint('/users/list'), {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setStaffUsers(data);
      }
    } catch (err) {
      console.warn('Failed to fetch staff list for assignment:', err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchDepartments();
    fetchStaffUsers();
  }, [fetchDepartments, fetchStaffUsers]);

  // Fetch all daily operations data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations?date=${selectedDate}`), {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setRoutines(data.data.routines || []);
        setBriefings(data.data.briefings || []);
        setEodClosures(data.data.eodClosures || []);
        setManagerToDos(data.data.managerToDos || []);

        // Pre-fill user's existing briefing for selected department if exists
        const firstDept = selectedBriefingDepts.length > 0 ? selectedBriefingDepts[0] : getUserDeptName();
        const existingBriefing = (data.data.briefings || []).find(b => isSameDepartment(b.department, firstDept));
        if (existingBriefing) {
          setBriefingPriority(existingBriefing.priority || '');
          setBriefingDeliverables(existingBriefing.deliverables || '');
          setBriefingBlockers(existingBriefing.blockers || '');
        }

        // Pre-fill user's EOD closure if exists
        const existingEod = (data.data.eodClosures || []).find(e => isEodSubmittedByUser(e, user));
        if (existingEod) {
          setEodCompleted(existingEod.completedToday || '');
          setEodPendingReason(existingEod.pendingReason || '');
          setEodTomorrowPriority(existingEod.tomorrowPriority || '');
        } else {
          setEodCompleted('');
          setEodPendingReason('');
          setEodTomorrowPriority('');
        }
      } else {
        showToast(data.message || 'Failed to fetch Daily Operations data', 'error');
      }
    } catch (err) {
      console.error('Error loading Daily Operations:', err);
      showToast('Error connecting to server', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedBriefingDepts, user, isEodSubmittedByUser, getAuthHeaders, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle department change in briefing form
  const handleDepartmentChange = (dept) => {
    setSelectedBriefingDepts([dept]);
    const existing = briefings.find(b => b.department && b.department.toLowerCase() === (dept || '').toLowerCase());
    if (existing) {
      setBriefingPriority(existing.priority || '');
      setBriefingDeliverables(existing.deliverables || '');
      setBriefingBlockers(existing.blockers || '');
    } else {
      setBriefingPriority('');
      setBriefingDeliverables('');
      setBriefingBlockers('');
    }
  };

  // Toggle routine item status
  const handleToggleRoutine = async (routineId) => {
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations/routine/${routineId}/toggle`), {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.data) {
        showToast(data.message || 'Status updated', 'success');
        setRoutines(prev => prev.map(r => r._id === routineId ? data.data : r));
      } else {
        showToast(data.message || 'Failed to update routine', 'error');
      }
    } catch (err) {
      console.error('Error toggling routine:', err);
      showToast('Error updating routine', 'error');
    }
  };

  // Add custom routine item
  const handleAddRoutine = async (e) => {
    e.preventDefault();
    if (!newRoutineTime || !newRoutineTitle) {
      showToast('Please enter Time and Title', 'warning');
      return;
    }

    const targetDepts = selectedDeptsForRoutine.length > 0 
      ? selectedDeptsForRoutine 
      : (newRoutineSubtitle ? [newRoutineSubtitle] : ['General / All Departments']);

    setAddingRoutine(true);
    try {
      const res = await fetch(getApiEndpoint('/daily-operations/routine'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          time: newRoutineTime,
          title: newRoutineTitle,
          departments: targetDepts,
          date: selectedDate,
          isRecurring
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Routine item added for ${targetDepts.length} department(s)`, 'success');
        setShowAddRoutineModal(false);
        setNewRoutineTime('');
        setNewRoutineTitle('');
        setSelectedDeptsForRoutine([]);
        fetchData();
      } else {
        showToast(data.message || 'Failed to add routine item', 'error');
      }
    } catch (err) {
      console.error('Error adding routine item:', err);
      showToast('Error adding routine item', 'error');
    } finally {
      setAddingRoutine(false);
    }
  };

  const [selectedDeptsForEditRoutine, setSelectedDeptsForEditRoutine] = useState([]);

  // Open Edit Modal for Superadmin
  const handleOpenEdit = (routine) => {
    setEditingRoutine(routine);
    setEditRoutineTime(routine.time || '');
    setEditRoutineTitle(routine.title || '');
    const sub = routine.subtitle || '';
    setEditRoutineSubtitle(sub);
    setSelectedDeptsForEditRoutine(sub ? [sub] : []);
    setUpdateRecurring(true);
  };

  // Submit Edit Routine (Superadmin)
  const handleUpdateRoutine = async (e) => {
    e.preventDefault();
    if (!editingRoutine) return;
    setSavingEdit(true);
    try {
      const finalSubtitle = selectedDeptsForEditRoutine.length > 0 
        ? selectedDeptsForEditRoutine.join(', ') 
        : editRoutineSubtitle;

      const res = await fetch(getApiEndpoint(`/daily-operations/routine/${editingRoutine._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          time: editRoutineTime,
          title: editRoutineTitle,
          subtitle: finalSubtitle,
          updateRecurring
        })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        showToast('Routine milestone updated successfully!', 'success');
        setEditingRoutine(null);
        fetchData();
      } else {
        showToast(data.message || 'Failed to update routine item', 'error');
      }
    } catch (err) {
      console.error('Error updating routine:', err);
      showToast('Error updating routine item', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Submit Delete Routine (Superadmin)
  const handleDeleteRoutine = async () => {
    if (!deletingRoutine) return;
    setDeleting(true);
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations/routine/${deletingRoutine._id}?deleteFromFuture=${deleteFromFuture}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Routine milestone deleted', 'success');
        setRoutines(prev => prev.filter(r => r._id !== deletingRoutine._id));
        setDeletingRoutine(null);
        fetchData();
      } else {
        showToast(data.message || 'Failed to delete routine item', 'error');
      }
    } catch (err) {
      console.error('Error deleting routine:', err);
      showToast('Error deleting routine item', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Briefing Edit & Delete Handlers (Superadmin)
  const handleOpenEditBriefing = (briefing) => {
    setEditingBriefing(briefing);
    setEditBriefingPriority(briefing.priority || '');
    setEditBriefingDeliverables(briefing.deliverables || '');
    setEditBriefingBlockers(briefing.blockers || '');
  };

  const handleUpdateBriefing = async (e) => {
    e.preventDefault();
    if (!editingBriefing) return;
    setSavingBriefingEdit(true);
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations/briefing/${editingBriefing._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          priority: editBriefingPriority,
          deliverables: editBriefingDeliverables,
          blockers: editBriefingBlockers
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Department briefing updated successfully!', 'success');
        setEditingBriefing(null);
        fetchData();
      } else {
        showToast(data.message || 'Failed to update department briefing', 'error');
      }
    } catch (err) {
      console.error('Error updating briefing:', err);
      showToast('Error updating department briefing', 'error');
    } finally {
      setSavingBriefingEdit(false);
    }
  };

  const handleDeleteBriefing = async () => {
    if (!deletingBriefing) return;
    setDeletingBriefingSaving(true);
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations/briefing/${deletingBriefing._id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Department briefing deleted successfully!', 'success');
        setDeletingBriefing(null);
        fetchData();
      } else {
        showToast(data.message || 'Failed to delete briefing', 'error');
      }
    } catch (err) {
      console.error('Error deleting briefing:', err);
      showToast('Error deleting department briefing', 'error');
    } finally {
      setDeletingBriefingSaving(false);
    }
  };

  // EOD Closure Edit & Delete Handlers (Superadmin)
  const handleOpenEditEod = (eod) => {
    setEditingEod(eod);
    setEditEodCompleted(eod.completedToday || '');
    setEditEodPendingReason(eod.pendingReason || '');
    setEditEodTomorrowPriority(eod.tomorrowPriority || '');
  };

  const handleUpdateEod = async (e) => {
    e.preventDefault();
    if (!editingEod) return;
    setSavingEodEdit(true);
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations/eod/${editingEod._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          completedToday: editEodCompleted,
          pendingReason: editEodPendingReason,
          tomorrowPriority: editEodTomorrowPriority
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('EOD closure report updated successfully!', 'success');
        setEditingEod(null);
        fetchData();
      } else {
        showToast(data.message || 'Failed to update EOD report', 'error');
      }
    } catch (err) {
      console.error('Error updating EOD report:', err);
      showToast('Error updating EOD report', 'error');
    } finally {
      setSavingEodEdit(false);
    }
  };

  const handleDeleteEod = async () => {
    if (!deletingEod) return;
    setDeletingEodSaving(true);
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations/eod/${deletingEod._id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast('EOD closure report deleted successfully!', 'success');
        setDeletingEod(null);
        fetchData();
      } else {
        showToast(data.message || 'Failed to delete EOD report', 'error');
      }
    } catch (err) {
      console.error('Error deleting EOD report:', err);
      showToast('Error deleting EOD report', 'error');
    } finally {
      setDeletingEodSaving(false);
    }
  };

  // Save Department Daily Briefing across multi-selected departments
  const handleSaveBriefing = async (e) => {
    e.preventDefault();
    if (selectedBriefingDepts.length === 0) {
      showToast('Please select at least one department', 'error');
      return;
    }
    setBriefingSaving(true);
    try {
      const savePromises = selectedBriefingDepts.map(dept => 
        fetch(getApiEndpoint('/daily-operations/briefing'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            department: dept,
            priority: briefingPriority,
            deliverables: briefingDeliverables,
            blockers: briefingBlockers,
            date: selectedDate
          })
        })
      );
      const responses = await Promise.all(savePromises);
      const allOk = responses.every(r => r.ok);
      if (allOk) {
        showToast(`Department Daily Briefing saved for ${selectedBriefingDepts.length} department(s)!`, 'success');
        fetchData();
      } else {
        showToast('Saved briefing with warnings on some departments', 'warning');
        fetchData();
      }
    } catch (err) {
      console.error('Error saving briefing:', err);
      showToast('Error saving briefing', 'error');
    } finally {
      setBriefingSaving(false);
    }
  };

  // Submit EOD Closure
  const handleSubmitEod = async (e) => {
    e.preventDefault();
    setEodSubmitting(true);
    try {
      const res = await fetch(getApiEndpoint('/daily-operations/eod'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          completedToday: eodCompleted,
          pendingReason: eodPendingReason,
          tomorrowPriority: eodTomorrowPriority,
          department: selectedBriefingDepts.length > 0 ? selectedBriefingDepts[0] : '',
          date: selectedDate
        })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        showToast('EOD Closure submitted successfully!', 'success');
        fetchData();
      } else {
        showToast(data.message || 'Failed to submit EOD closure', 'error');
      }
    } catch (err) {
      console.error('Error submitting EOD:', err);
      showToast('Error submitting EOD closure', 'error');
    } finally {
      setEodSubmitting(false);
    }
  };

  // Reset Routines to default 7 milestones
  const handleResetRoutines = async () => {
    if (!window.confirm('Are you sure you want to remove all current routines and reset to the 7 default routines?')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiEndpoint('/daily-operations/reset'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ date: selectedDate })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Daily routines reset to default 7 milestones successfully!', 'success');
        fetchData();
      } else {
        showToast(data.message || 'Failed to reset routines', 'error');
      }
    } catch (err) {
      console.error('Error resetting routines:', err);
      showToast('Error resetting daily routines', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Add Manager To-Do item
  const handleAddManagerToDo = async (e) => {
    e?.preventDefault();
    if (!newToDoTask || !newToDoTask.trim()) {
      showToast('Please enter a task description in the text box', 'warning');
      const el = document.getElementById('manager-todo-input');
      if (el) {
        el.focus();
      }
      return;
    }
    setAddingToDo(true);
    try {
      const res = await fetch(getApiEndpoint('/daily-operations/manager-todo'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: newToDoTask.trim(),
          date: selectedDate,
          priority: newToDoPriority
        })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setManagerToDos(prev => [data.data, ...prev]);
        setNewToDoTask('');
        showToast('Manager To-Do item added', 'success');
      } else {
        showToast(data.message || 'Failed to add item', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'error');
    } finally {
      setAddingToDo(false);
    }
  };

  // Toggle Manager To-Do status (Tick / Untick)
  const handleToggleManagerToDo = async (id) => {
    try {
      setManagerToDos(prev => prev.map(item => {
        if (item._id === id || item.id === id) {
          const isCompleted = item.status === 'completed';
          return {
            ...item,
            status: isCompleted ? 'pending' : 'completed',
            completedByName: isCompleted ? '' : (user?.name || 'User'),
            completedAt: isCompleted ? null : new Date().toISOString()
          };
        }
        return item;
      }));

      const res = await fetch(getApiEndpoint(`/daily-operations/manager-todo/${id}/toggle`), {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setManagerToDos(prev => prev.map(item => (item._id === id || item.id === id) ? data.data : item));
      } else {
        fetchData();
        showToast(data.message || 'Failed to update status', 'error');
      }
    } catch (err) {
      console.error(err);
      fetchData();
      showToast('Error updating item', 'error');
    }
  };

  // Save Edit Manager To-Do item
  const handleSaveEditToDo = async (e) => {
    e?.preventDefault();
    if (!editingToDo || !editingToDo.task.trim()) return;
    const targetId = editingToDo._id || editingToDo.id;
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations/manager-todo/${targetId}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: editingToDo.task.trim(),
          priority: editingToDo.priority
        })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setManagerToDos(prev => prev.map(item => (item._id === targetId || item.id === targetId) ? data.data : item));
        setEditingToDo(null);
        showToast('Manager To-Do item updated', 'success');
      } else {
        showToast(data.message || 'Failed to update item', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating item', 'error');
    }
  };

  // Delete Manager To-Do item
  const handleDeleteToDo = async () => {
    if (!deletingToDo) return;
    const targetId = deletingToDo._id || deletingToDo.id;
    try {
      const res = await fetch(getApiEndpoint(`/daily-operations/manager-todo/${targetId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setManagerToDos(prev => prev.filter(item => item._id !== targetId && item.id !== targetId));
        setDeletingToDo(null);
        showToast('Manager To-Do item deleted', 'success');
      } else {
        showToast(data.message || 'Failed to delete item', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error deleting item', 'error');
    }
  };

  const toggleDeptFilterPill = (deptName) => {
    if (deptName === 'ALL') {
      setSelectedDeptFilters([]);
      return;
    }
    setSelectedDeptFilters(prev => {
      const exists = prev.some(d => d.toLowerCase() === deptName.toLowerCase());
      if (exists) {
        return prev.filter(d => d.toLowerCase() !== deptName.toLowerCase());
      } else {
        return [...prev, deptName];
      }
    });
  };

  // All department groups from un-filtered routines for quick filter pills
  const allDeptGroups = React.useMemo(() => {
    const groups = {};
    routines.forEach(r => {
      const deptKey = (r.subtitle || 'General / All Departments').trim();
      if (isExcludedDepartment(deptKey)) return;
      if (!groups[deptKey]) {
        groups[deptKey] = [];
      }
      groups[deptKey].push(r);
    });
    return groups;
  }, [routines]);

  // Filtered routines by search & multi-department filter
  const filteredRoutines = routines.filter(r => {
    const matchesSearch = !searchQuery || 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.time.includes(searchQuery);

    const rSub = (r.subtitle || '').trim().toLowerCase();
    const isGeneral = !rSub || 
      rSub.includes('all teams') || 
      rSub.includes('all departments') || 
      rSub.includes('department heads') || 
      rSub.includes('all') || 
      rSub.includes('general');

    const matchesDept = selectedDeptFilters.length === 0 || 
      isGeneral || 
      selectedDeptFilters.some(df => isSameDepartment(df, r.subtitle));

    return matchesSearch && matchesDept;
  });

  // Group filtered routines by department (multi-dept & general routines appear in every department)
  const routinesByDepartment = React.useMemo(() => {
    const groups = {};

    activeDepartments.forEach(dept => {
      if (!isExcludedDepartment(dept)) {
        groups[dept] = [];
      }
    });

    const isGeneralTag = (tag) => {
      if (!tag) return true;
      const lower = String(tag).toLowerCase().trim();
      return (
        lower === '' ||
        lower.includes('all teams') ||
        lower.includes('all departments') ||
        lower.includes('department heads') ||
        lower.includes('all') ||
        lower.includes('general')
      );
    };

    filteredRoutines.forEach(r => {
      const deptKey = (r.subtitle || '').trim();
      if (isExcludedDepartment(deptKey)) return;

      activeDepartments.forEach(deptName => {
        const isMatch = 
          isGeneralTag(deptKey) ||
          isSameDepartment(deptKey, deptName) || 
          (Array.isArray(r.departments) && r.departments.some(d => isSameDepartment(d, deptName)));

        if (isMatch) {
          let groupName = Object.keys(groups).find(gKey => isSameDepartment(gKey, deptName)) || deptName;
          if (!groups[groupName]) groups[groupName] = [];
          groups[groupName].push(r);
        }
      });
    });

    // Deduplicate & sort by time within each department
    Object.keys(groups).forEach(dName => {
      const mapByRoutineId = new Map();
      groups[dName].forEach(item => {
        const key = `${item._id || item.id || item.time + '_' + item.title}`;
        if (!mapByRoutineId.has(key)) {
          mapByRoutineId.set(key, item);
        }
      });
      groups[dName] = Array.from(mapByRoutineId.values()).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    });

    if (selectedDeptFilters.length > 0) {
      const filteredGroups = {};
      Object.keys(groups).forEach(dName => {
        if (selectedDeptFilters.some(df => isSameDepartment(df, dName))) {
          filteredGroups[dName] = groups[dName];
        }
      });
      return filteredGroups;
    }

    return groups;
  }, [activeDepartments, filteredRoutines, selectedDeptFilters, isSameDepartment]);

  // Filtered EOD Closures (showing only submitted by logged-in person by default)
  const filteredEodClosures = React.useMemo(() => {
    return eodClosures.filter(e => {
      if (isExcludedDepartment(e.department)) return false;

      // Filter to show ONLY EOD closures submitted by that logged-in person unless superadmin explicitly selected 'all'
      if ((!isSuperAdmin || eodViewFilter === 'mine') && !isEodSubmittedByUser(e, user)) {
        return false;
      }

      if (selectedDeptFilters.length === 0) return true;
      return selectedDeptFilters.some(df => isSameDepartment(df, e.department));
    });
  }, [eodClosures, selectedDeptFilters, isSameDepartment, isSuperAdmin, eodViewFilter, isEodSubmittedByUser, user]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Clock size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daily Operations</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Daily execution rhythm</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 px-3.5 py-2 rounded-xl text-sm">
            <Calendar size={16} className="text-slate-500" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none cursor-pointer"
            />
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search routines..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
            />
          </div>

          {/* Reset Routines Button */}
          <button
            onClick={handleResetRoutines}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs transition-colors"
            title="Remove all custom routines and reset to 7 default routines"
          >
            <RefreshCw size={14} />
            <span>Reset Default Routines</span>
          </button>

          {/* Add Item Button */}
          {activeTab === 'operations' && (
            <button
              onClick={() => setShowAddRoutineModal(true)}
              className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span>Routine Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'operations'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
          }`}
        >
          <Clock size={18} />
          <span>Daily Operations OS</span>
        </button>

        <button
          onClick={() => setActiveTab('manager_todo')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'manager_todo'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
          }`}
        >
          <ListTodo size={18} />
          <span>Manager To-Do Checklist</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'manager_todo'
              ? 'bg-white text-indigo-700'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
          }`}>
            {managerToDos.filter(t => t.status === 'completed').length} / {managerToDos.length}
          </span>
        </button>
      </div>

      {/* Main Content Sections */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw size={32} className="animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading Daily Operations...</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* TAB 1: DAILY OPERATIONS OS */}
          {activeTab === 'operations' && (
            <>


          {/* SECTION 1: Daily Operations OS Timeline Grouped by Department */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700/40">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Daily Operations OS</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Time-locked operational milestones by department</p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-full self-start sm:self-auto">
                {routines.filter(r => r.status === 'completed').length} / {routines.length} Completed
              </span>
            </div>

            {/* Department Filter Pills (Multi-Select) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
              <button
                onClick={() => toggleDeptFilterPill('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedDeptFilters.length === 0
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>All Departments</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedDeptFilters.length === 0 ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                  {routines.length}
                </span>
              </button>
              {Object.keys(allDeptGroups).map(dName => {
                const isSelected = selectedDeptFilters.some(df => df.toLowerCase() === dName.toLowerCase());
                return (
                  <button
                    key={dName}
                    onClick={() => toggleDeptFilterPill(dName)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Building size={12} />
                    <span>{dName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${isSelected ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                      {allDeptGroups[dName].length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Department Groupings */}
            <div className="space-y-6 pt-2">
              {Object.keys(routinesByDepartment).map(deptName => {
                const deptItems = routinesByDepartment[deptName];
                const completedInDept = deptItems.filter(r => r.status === 'completed').length;

                const savedBriefing = briefings.find(b => isSameDepartment(b.department, deptName));
                const isBriefingOpen = Boolean(openDeptBriefings[deptName]);
                const deptEodClosures = eodClosures.filter(e => !isExcludedDepartment(e.department) && isSameDepartment(e.department, deptName));

                return (
                  <div key={deptName} className="space-y-2">
                    {/* Department Section Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-700/40">
                      <div className="flex items-center gap-1.5">
                        <Building size={12} className="text-slate-400" />
                        <h3 className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                          {deptName}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {completedInDept} / {deptItems.length} Completed
                        </span>

                        {/* Down Arrow Dropdown Toggle for Briefing & EOD Details */}
                        <button
                          type="button"
                          onClick={() => toggleDeptBriefing(deptName)}
                          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md transition-all shadow-sm ${
                            isBriefingOpen
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                          title={isBriefingOpen ? "Hide Briefing & EOD Closures" : "Show Briefing & EOD Closures"}
                        >
                          <span>Briefing & EOD</span>
                          {isBriefingOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Dropdown Panel for Saved Briefing & EOD Closures */}
                    <AnimatePresence>
                      {isBriefingOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="my-2 p-3.5 bg-slate-100/70 dark:bg-slate-800/70 rounded-xl space-y-3">
                            {/* Saved Briefing Section */}
                            <div>
                              <div className="flex items-center justify-between pb-1.5 mb-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400" />
                                  Department Daily Briefing
                                </span>
                                {savedBriefing && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                      Saved by {savedBriefing.submittedByName || 'Team Lead'} ({new Date(savedBriefing.updatedAt || savedBriefing.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                    <div className="flex items-center gap-1 pl-2">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditBriefing(savedBriefing)}
                                        title="Edit Briefing"
                                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingBriefing(savedBriefing)}
                                        title="Delete Briefing"
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {savedBriefing ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                  {savedBriefing.priority && (
                                    <div className="p-2.5 bg-white dark:bg-slate-900/60 rounded-xl">
                                      <span className="block font-bold text-indigo-600 dark:text-indigo-400 text-[10px] uppercase tracking-wider">🎯 #1 Priority</span>
                                      <p className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">{savedBriefing.priority}</p>
                                    </div>
                                  )}
                                  {savedBriefing.deliverables && (
                                    <div className="p-2.5 bg-white dark:bg-slate-900/60 rounded-xl">
                                      <span className="block font-bold text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-wider">📋 Key Deliverables</span>
                                      <p className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">{savedBriefing.deliverables}</p>
                                    </div>
                                  )}
                                  {savedBriefing.blockers && (
                                    <div className="p-2.5 bg-white dark:bg-slate-900/60 rounded-xl">
                                      <span className="block font-bold text-amber-600 dark:text-amber-400 text-[10px] uppercase tracking-wider">⚠️ Blockers / Escalations</span>
                                      <p className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">{savedBriefing.blockers}</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No daily briefing saved for {deptName} today.</p>
                              )}
                            </div>

                            {/* Saved EOD Closures Section */}
                            <div className="pt-2">
                              <div className="flex items-center justify-between pb-1.5 mb-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <Users size={13} className="text-indigo-600 dark:text-indigo-400" />
                                  Saved EOD Closures ({deptEodClosures.length})
                                </span>
                              </div>

                              {deptEodClosures.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  {deptEodClosures.map((eod) => (
                                    <div key={eod._id} className="p-3 bg-white dark:bg-slate-900/60 rounded-xl space-y-1">
                                      <div className="flex items-center justify-between pb-1">
                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                          {eod.userName || 'Team Member'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] text-slate-400">
                                            {new Date(eod.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                          <div className="flex items-center gap-1 pl-1.5">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEditEod(eod)}
                                              title="Edit EOD Report"
                                              className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                            >
                                              <Pencil size={12} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setDeletingEod(eod)}
                                              title="Delete EOD Report"
                                              className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                      {eod.completedToday && (
                                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                                          <strong className="text-emerald-600 dark:text-emerald-400">✓ Completed:</strong> {eod.completedToday}
                                        </p>
                                      )}
                                      {eod.pendingReason && (
                                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                                          <strong className="text-amber-600 dark:text-amber-400">⏳ Pending:</strong> {eod.pendingReason}
                                        </p>
                                      )}
                                      {eod.tomorrowPriority && (
                                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                                          <strong className="text-indigo-600 dark:text-indigo-400">🎯 Tomorrow:</strong> {eod.tomorrowPriority}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No EOD reports submitted by {deptName} team members for this date yet.</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Department Routine Milestones */}
                    <div className="space-y-1.5 pt-1">
                      {deptItems.map((routine) => {
                        const isCompleted = routine.status === 'completed';
                        return (
                          <div 
                            key={routine._id} 
                            className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
                          >
                            <div className="flex items-center gap-3.5">
                              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                                {routine.time}
                              </span>
                              <div>
                                <p className={`text-sm font-semibold ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                  {routine.title}
                                </p>
                                {isCompleted && routine.completedByName && (
                                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    ✓ Completed by {routine.completedByName}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                                isCompleted 
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' 
                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                              }`}>
                                {isCompleted ? 'Completed' : 'Pending'}
                              </span>

                              <button
                                onClick={() => handleToggleRoutine(routine._id)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  isCompleted
                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                                }`}
                              >
                                {isCompleted ? 'Mark Pending' : 'Complete'}
                              </button>

                              <div className="flex items-center gap-1 pl-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(routine)}
                                  title="Edit Routine Item"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingRoutine(routine)}
                                  title="Delete Routine Item"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredRoutines.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                  No routine milestones found for this department filter or search query.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Saved EOD Closures Log & Submission */}
          <div className="space-y-6">
            {/* Saved EOD Closures Log */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Saved EOD Closures</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(!isSuperAdmin || eodViewFilter === 'mine') ? 'Your End-of-Day report' : 'Department & staff End-of-Day reports'} for {selectedDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setEodViewFilter('mine')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          eodViewFilter === 'mine'
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        My EOD Report
                      </button>
                      <button
                        type="button"
                        onClick={() => setEodViewFilter('all')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          eodViewFilter === 'all'
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        All Staff Reports
                      </button>
                    </div>
                  )}
                  <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-full">
                    {filteredEodClosures.length} {filteredEodClosures.length === 1 ? 'EOD Report' : 'EOD Reports'} Saved
                  </span>
                </div>
              </div>

              {filteredEodClosures.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredEodClosures.map((eod) => (
                    <div key={eod._id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 space-y-2.5">
                      <div className="flex items-center justify-between pb-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                          <Users size={15} className="text-indigo-600 dark:text-indigo-400" />
                          <span>{eod.userName || eod.user?.name || 'Staff Member'}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {eod.department && (
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-md">
                              {eod.department}
                            </span>
                          )}
                          <div className="flex items-center gap-1 pl-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditEod(eod)}
                              title="Edit EOD Report"
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingEod(eod)}
                              title="Delete EOD Report"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      {eod.completedToday && (
                        <p className="text-xs text-slate-800 dark:text-slate-200">
                          <strong className="text-emerald-600 dark:text-emerald-400">✓ Completed Today:</strong> {eod.completedToday}
                        </p>
                      )}
                      {eod.pendingReason && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          <strong>⏳ Pending / Reason:</strong> {eod.pendingReason}
                        </p>
                      )}
                      {eod.tomorrowPriority && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400">
                          <strong>🎯 Tomorrow Priority:</strong> {eod.tomorrowPriority}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                  {(!isSuperAdmin || eodViewFilter === 'mine')
                    ? 'No EOD closure report saved by you for this date yet.'
                    : 'No EOD closures saved for this date yet.'}
                </div>
              )}
            </div>
          </div>
          </>
          )}

          {/* TAB 2: MANAGER TO-DO CHECKLIST */}
          {activeTab === 'manager_todo' && (
            <div className="space-y-6">
              
              {/* Progress & Overview Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ListTodo size={24} className="text-indigo-600 dark:text-indigo-400" />
                      Manager To-Do Checklist
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Checklist & priorities for {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl text-center">
                      <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Completion Status</span>
                      <span className="text-base font-extrabold text-indigo-900 dark:text-indigo-200">
                        {managerToDos.filter(t => t.status === 'completed').length} of {managerToDos.length} Tasks Done ({managerToDos.length > 0 ? Math.round((managerToDos.filter(t => t.status === 'completed').length / managerToDos.length) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-700/60 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${managerToDos.length > 0 ? Math.round((managerToDos.filter(t => t.status === 'completed').length / managerToDos.length) * 100) : 0}%` }}
                  />
                </div>

                {/* Quick Add Bar */}
                <form onSubmit={handleAddManagerToDo} className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <div className="relative flex-1 w-full">
                    <input
                      id="manager-todo-input"
                      type="text"
                      placeholder="Add a new manager checklist task for this date..."
                      value={newToDoTask}
                      onChange={(e) => setNewToDoTask(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={newToDoPriority}
                      onChange={(e) => setNewToDoPriority(e.target.value)}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value="high">Priority: High</option>
                      <option value="medium">Priority: Medium</option>
                      <option value="low">Priority: Low</option>
                    </select>

                    <button
                      type="submit"
                      disabled={addingToDo}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4.5 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      {addingToDo ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                      <span>Add Task</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Checklist Table / Card View */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                {/* Filter Pills */}
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <button
                      onClick={() => setToDoFilter('all')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        toDoFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      All Tasks ({managerToDos.length})
                    </button>

                    <button
                      onClick={() => setToDoFilter('pending')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        toDoFilter === 'pending'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Pending ({managerToDos.filter(t => t.status !== 'completed').length})
                    </button>

                    <button
                      onClick={() => setToDoFilter('completed')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        toDoFilter === 'completed'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Completed ({managerToDos.filter(t => t.status === 'completed').length})
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 pt-1">
                  {managerToDos.filter(t => {
                    if (toDoFilter === 'pending') return t.status !== 'completed';
                    if (toDoFilter === 'completed') return t.status === 'completed';
                    return true;
                  }).length === 0 ? (
                    <div className="text-center py-12 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl">
                      <ListTodo size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No manager checklist items found for this filter</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add tasks above to keep track of daily management responsibilities.</p>
                    </div>
                  ) : (
                    managerToDos
                      .filter(t => {
                        if (toDoFilter === 'pending') return t.status !== 'completed';
                        if (toDoFilter === 'completed') return t.status === 'completed';
                        return true;
                      })
                      .map((item) => {
                        const isCompleted = item.status === 'completed';
                        const itemId = item._id || item.id;

                        return (
                          <div
                            key={itemId}
                            className={`flex items-start justify-between p-4 rounded-xl transition-all ${
                              isCompleted
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                                : 'bg-slate-50/70 dark:bg-slate-900/50 hover:bg-slate-100/80 dark:hover:bg-slate-900/80'
                            }`}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                              {/* Checkbox Tick Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleManagerToDo(itemId)}
                                className={`mt-0.5 shrink-0 p-1 rounded-lg transition-colors ${
                                  isCompleted
                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50'
                                    : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                title={isCompleted ? "Mark as pending" : "Tick to complete"}
                              >
                                {isCompleted ? <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-900" /> : <Square size={22} />}
                              </button>

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-semibold break-words ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                    {item.task}
                                  </span>

                                  {/* Priority Badge */}
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    item.priority === 'high' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' :
                                    item.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                                    'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}>
                                    {item.priority || 'medium'}
                                  </span>
                                </div>

                                {/* Metadata */}
                                <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                                  <span>Created by {item.createdByName || 'Manager'}</span>
                                  {isCompleted && item.completedByName && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                      ✓ Completed by {item.completedByName} {item.completedAt ? `at ${new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => setEditingToDo(item)}
                                title="Edit task"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => setDeletingToDo(item)}
                                title="Delete task"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      )}


      {/* Add Routine Modal rendered in Viewport via Portal */}
      {showAddRoutineModal && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setShowAddRoutineModal(false)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={20} className="text-indigo-600 dark:text-indigo-400" />
                <span>Add Routine Milestone</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRoutineModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRoutine} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Time (HH:MM)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 11:30"
                  value={newRoutineTime}
                  onChange={(e) => setNewRoutineTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Client Delivery Sync"
                  value={newRoutineTitle}
                  onChange={(e) => setNewRoutineTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Multi-Select Department Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Department
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedDeptsForRoutine([...activeDepartments])}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDeptsForRoutine([])}
                      className="text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 max-h-44 overflow-y-auto">
                  {activeDepartments.map(dept => {
                    const isSelected = selectedDeptsForRoutine.includes(dept);
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDeptsForRoutine(prev => prev.filter(d => d !== dept));
                          } else {
                            setSelectedDeptsForRoutine(prev => [...prev, dept]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                        }`}
                      >
                        <span>{isSelected ? '✓' : '+'}</span>
                        <span>{dept}</span>
                      </button>
                    );
                  })}
                  {activeDepartments.length === 0 && (
                    <span className="text-xs text-slate-400">No active departments loaded</span>
                  )}
                </div>
              </div>

              {/* Repeat Daily Option */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="isRecurringCheck"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="isRecurringCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Repeat daily from this date onwards
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowAddRoutineModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingRoutine}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {addingRoutine ? 'Adding...' : 'Add Milestone'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Edit Routine Modal rendered in Viewport via Portal */}
      {editingRoutine && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setEditingRoutine(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil size={20} className="text-indigo-600 dark:text-indigo-400" />
                <span>Edit Routine Milestone</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingRoutine(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateRoutine} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Time (HH:MM)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 11:30"
                  value={editRoutineTime}
                  onChange={(e) => setEditRoutineTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Client Delivery Sync"
                  value={editRoutineTitle}
                  onChange={(e) => setEditRoutineTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Multi-Select Department Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Department
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedDeptsForEditRoutine([...activeDepartments])}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDeptsForEditRoutine([])}
                      className="text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 max-h-44 overflow-y-auto">
                  {activeDepartments.map(dept => {
                    const isSelected = selectedDeptsForEditRoutine.includes(dept);
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDeptsForEditRoutine(prev => prev.filter(d => d !== dept));
                          } else {
                            setSelectedDeptsForEditRoutine(prev => [...prev, dept]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                        }`}
                      >
                        <span>{isSelected ? '✓' : '+'}</span>
                        <span>{dept}</span>
                      </button>
                    );
                  })}
                  {activeDepartments.length === 0 && (
                    <span className="text-xs text-slate-400">No active departments loaded</span>
                  )}
                </div>
              </div>

              {/* Update Recurring Option */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="updateRecurringCheck"
                  checked={updateRecurring}
                  onChange={(e) => setUpdateRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="updateRecurringCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Apply updates to recurring template (future days)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setEditingRoutine(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {savingEdit ? <RefreshCw size={15} className="animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Delete Routine Confirmation Modal rendered via Portal */}
      {deletingRoutine && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setDeletingRoutine(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto"
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Routine Milestone</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action will remove this routine item.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p><strong>Time:</strong> {deletingRoutine.time}</p>
              <p><strong>Title:</strong> {deletingRoutine.title}</p>
              {deletingRoutine.subtitle && <p><strong>Department:</strong> {deletingRoutine.subtitle}</p>}
            </div>

            {/* Option to delete future recurring items */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="deleteFutureCheck"
                checked={deleteFromFuture}
                onChange={(e) => setDeleteFromFuture(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <label htmlFor="deleteFutureCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                Delete from future recurring days as well
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setDeletingRoutine(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteRoutine}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? <RefreshCw size={15} className="animate-spin" /> : null}
                <span>Delete Milestone</span>
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Edit Department Briefing Modal rendered via Portal */}
      {editingBriefing && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setEditingBriefing(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pencil size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Edit Department Briefing
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Department: {editingBriefing.department}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBriefing(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateBriefing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  🎯 #1 Department Priority
                </label>
                <input
                  type="text"
                  value={editBriefingPriority}
                  onChange={(e) => setEditBriefingPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  📋 Key Deliverables
                </label>
                <textarea
                  rows={3}
                  value={editBriefingDeliverables}
                  onChange={(e) => setEditBriefingDeliverables(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  ⚠️ Blockers / Escalations
                </label>
                <textarea
                  rows={3}
                  value={editBriefingBlockers}
                  onChange={(e) => setEditBriefingBlockers(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setEditingBriefing(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBriefingEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {savingBriefingEdit ? <RefreshCw size={15} className="animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Delete Department Briefing Modal rendered via Portal */}
      {deletingBriefing && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setDeletingBriefing(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto"
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Department Briefing</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action will remove the saved briefing for {deletingBriefing.department}.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p><strong>Department:</strong> {deletingBriefing.department}</p>
              <p><strong>Submitted By:</strong> {deletingBriefing.submittedByName || 'Team Lead'}</p>
              {deletingBriefing.priority && <p><strong>Priority:</strong> {deletingBriefing.priority}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setDeletingBriefing(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingBriefingSaving}
                onClick={handleDeleteBriefing}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {deletingBriefingSaving ? <RefreshCw size={15} className="animate-spin" /> : null}
                <span>Delete Briefing</span>
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Edit EOD Report Modal rendered via Portal */}
      {editingEod && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setEditingEod(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pencil size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Edit EOD Report
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Staff Member: {editingEod.userName || 'Staff Member'} ({editingEod.department || 'N/A'})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEod(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateEod} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  ✓ Completed Today
                </label>
                <textarea
                  rows={3}
                  value={editEodCompleted}
                  onChange={(e) => setEditEodCompleted(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  ⏳ Pending / Reason
                </label>
                <textarea
                  rows={3}
                  value={editEodPendingReason}
                  onChange={(e) => setEditEodPendingReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  🎯 Tomorrow Priority
                </label>
                <textarea
                  rows={3}
                  value={editEodTomorrowPriority}
                  onChange={(e) => setEditEodTomorrowPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setEditingEod(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEodEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {savingEodEdit ? <RefreshCw size={15} className="animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Delete EOD Report Modal rendered via Portal */}
      {deletingEod && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setDeletingEod(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto"
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete EOD Report</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action will remove the EOD report for {deletingEod.userName || 'Staff Member'}.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p><strong>Staff Member:</strong> {deletingEod.userName || 'Staff Member'}</p>
              <p><strong>Department:</strong> {deletingEod.department || 'N/A'}</p>
              {deletingEod.completedToday && <p><strong>Completed Today:</strong> {deletingEod.completedToday}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setDeletingEod(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingEodSaving}
                onClick={handleDeleteEod}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {deletingEodSaving ? <RefreshCw size={15} className="animate-spin" /> : null}
                <span>Delete EOD Report</span>
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Edit Manager To-Do Modal */}
      {editingToDo && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setEditingToDo(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>Edit Manager Checklist Task</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingToDo(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditToDo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Description
                </label>
                <input
                  type="text"
                  value={editingToDo.task}
                  onChange={(e) => setEditingToDo({ ...editingToDo, task: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={editingToDo.priority || 'medium'}
                  onChange={(e) => setEditingToDo({ ...editingToDo, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setEditingToDo(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Delete Manager To-Do Modal */}
      {deletingToDo && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
          onClick={() => setDeletingToDo(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto"
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Manager Task</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Are you sure you want to delete this task?</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
              <p><strong>Task:</strong> {deletingToDo.task}</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setDeletingToDo(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteToDo}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm"
              >
                Delete Task
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default DailyOperationsPage;
