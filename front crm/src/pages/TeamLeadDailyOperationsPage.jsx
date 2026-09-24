import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  Clock, Search, CheckCircle2, RefreshCw, 
  ChevronRight, Calendar, Building, Sparkles, Send, Users, CheckSquare, Pencil, Trash2, Plus, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../components/ToastProvider';
import { useUser } from '../contexts/UserContext';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) return `${API_BASE}${cleanPath}`;
  if (API_BASE.endsWith('/api')) return `${API_BASE}/v1${cleanPath}`;
  return `${API_BASE}/api/v1${cleanPath}`;
};

const isExcludedDepartment = (deptName) => {
  if (!deptName) return true;
  const lower = String(deptName).toLowerCase().trim();
  return lower === 'user' || lower === 'users' || lower === 'user accounts';
};

const TeamLeadDailyOperationsPage = () => {
  const { showToast } = useToast();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Data states
  const [routines, setRoutines] = useState([]);
  const [briefings, setBriefings] = useState([]);
  const [eodClosures, setEodClosures] = useState([]);
  const [rawDepartments, setRawDepartments] = useState([]);
  const [activeDepartments, setActiveDepartments] = useState([]);

  // Selected Assigned Department for Team Lead View
  const [targetDept, setTargetDept] = useState('');

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

  // Form states - Department Briefing
  const [briefingPriority, setBriefingPriority] = useState('');
  const [briefingDeliverables, setBriefingDeliverables] = useState('');
  const [briefingBlockers, setBriefingBlockers] = useState('');
  const [briefingSaving, setBriefingSaving] = useState(false);

  // Form states - EOD Closure
  const [eodCompleted, setEodCompleted] = useState('');
  const [eodPendingReason, setEodPendingReason] = useState('');
  const [eodTomorrowPriority, setEodTomorrowPriority] = useState('');
  const [eodSubmitting, setEodSubmitting] = useState(false);

  // Search
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

  // Edit Routine Modal State
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [editRoutineTime, setEditRoutineTime] = useState('');
  const [editRoutineTitle, setEditRoutineTitle] = useState('');
  const [editRoutineSubtitle, setEditRoutineSubtitle] = useState('');
  const [selectedDeptsForEditRoutine, setSelectedDeptsForEditRoutine] = useState([]);
  const [updateRecurring, setUpdateRecurring] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Routine Modal State
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

  // Add Routine Modal State
  const [showAddRoutineModal, setShowAddRoutineModal] = useState(false);
  const [newRoutineTime, setNewRoutineTime] = useState('');
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [newRoutineSubtitle, setNewRoutineSubtitle] = useState('');
  const [selectedDeptsForRoutine, setSelectedDeptsForRoutine] = useState([]);
  const [isRecurring, setIsRecurring] = useState(true);
  const [addingRoutine, setAddingRoutine] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 
      'Content-Type': 'application/json',
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` 
    };
  }, []);

  // Fetch active departments from backend
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch(getApiEndpoint('/departments?status=true'), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          setRawDepartments(data.data);
          const activeOnly = data.data.filter(d => d.status === true || String(d.status) === 'true' || d.isActive === true);
          const activeNames = activeOnly
            .map(d => d.name || d.departmentName || d.title)
            .filter(Boolean)
            .filter(name => !isExcludedDepartment(name));

          if (activeNames.length > 0) {
            setActiveDepartments(activeNames);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch active departments list:', err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Auto-set target department to user's assigned department
  useEffect(() => {
    if (activeDepartments.length > 0 && !targetDept) {
      const userDept = getUserDeptName();
      const matched = userDept ? activeDepartments.find(d => isSameDepartment(d, userDept)) : null;
      setTargetDept(matched || userDept || activeDepartments[0]);
    }
  }, [activeDepartments, user, getUserDeptName, targetDept, isSameDepartment]);

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

        // Pre-fill existing briefing for target department
        const currentDept = targetDept || getUserDeptName();
        const existingBriefing = (data.data.briefings || []).find(b => isSameDepartment(b.department, currentDept));
        if (existingBriefing) {
          setBriefingPriority(existingBriefing.priority || '');
          setBriefingDeliverables(existingBriefing.deliverables || '');
          setBriefingBlockers(existingBriefing.blockers || '');
        } else {
          setBriefingPriority('');
          setBriefingDeliverables('');
          setBriefingBlockers('');
        }

        // Pre-fill TL's EOD closure
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
  }, [selectedDate, targetDept, user, isEodSubmittedByUser, getAuthHeaders, getUserDeptName, isSameDepartment, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle department change if TL manages multiple
  const handleDepartmentChange = (dept) => {
    setTargetDept(dept);
    const existing = briefings.find(b => isSameDepartment(b.department, dept));
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

  // Add custom routine item
  const handleAddRoutine = async (e) => {
    e.preventDefault();
    if (!newRoutineTime || !newRoutineTitle) {
      showToast('Please enter Time and Title', 'warning');
      return;
    }

    const currentDept = targetDept || getUserDeptName() || 'General';
    const targetDepts = selectedDeptsForRoutine.length > 0 
      ? selectedDeptsForRoutine 
      : [currentDept];

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

  // Save Department Daily Briefing
  const handleSaveBriefing = async (e) => {
    e.preventDefault();
    const currentDept = targetDept || getUserDeptName() || 'General';

    setBriefingSaving(true);
    try {
      const res = await fetch(getApiEndpoint('/daily-operations/briefing'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          department: currentDept,
          priority: briefingPriority,
          deliverables: briefingDeliverables,
          blockers: briefingBlockers,
          date: selectedDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Team Daily Briefing saved for ${currentDept}!`, 'success');
        fetchData();
      } else {
        showToast(data.message || 'Failed to save briefing', 'error');
      }
    } catch (err) {
      console.error('Error saving briefing:', err);
      showToast('Error saving briefing', 'error');
    } finally {
      setBriefingSaving(false);
    }
  };

  // Submit Team Lead EOD Closure
  const handleSubmitEod = async (e) => {
    e.preventDefault();
    setEodSubmitting(true);
    try {
      const currentDept = targetDept || getUserDeptName() || 'General';
      const res = await fetch(getApiEndpoint('/daily-operations/eod'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          completedToday: eodCompleted,
          pendingReason: eodPendingReason,
          tomorrowPriority: eodTomorrowPriority,
          department: currentDept,
          date: selectedDate
        })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        showToast('Team Lead EOD Closure submitted successfully!', 'success');
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

  // Filter routines specifically for target department (exact match to Daily Operations department bucket)
  const deptRoutines = React.useMemo(() => {
    const currentDept = targetDept || getUserDeptName() || 'General';

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

    const matching = routines.filter(r => {
      const rDept = (r.subtitle || '').trim();
      if (rDept && isExcludedDepartment(rDept)) {
        return false;
      }

      const isMatch = isGeneralTag(rDept) ||
                      isSameDepartment(rDept, currentDept) ||
                      (Array.isArray(r.departments) && r.departments.some(d => isSameDepartment(d, currentDept)));

      const matchesSearch = !searchQuery || 
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.time.includes(searchQuery);

      return isMatch && matchesSearch;
    });

    // Deduplicate by time + title (preferring exact department subtitle match over generic)
    const mapByTimeTitle = new Map();
    matching.forEach(item => {
      const key = `${item.time}_${item.title.toLowerCase().trim()}`;
      if (!mapByTimeTitle.has(key)) {
        mapByTimeTitle.set(key, item);
      } else {
        const existing = mapByTimeTitle.get(key);
        if (isSameDepartment(item.subtitle, currentDept) && !isSameDepartment(existing.subtitle, currentDept)) {
          mapByTimeTitle.set(key, item);
        }
      }
    });

    return Array.from(mapByTimeTitle.values()).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [routines, targetDept, getUserDeptName, isSameDepartment, searchQuery]);

  // Saved Briefing for assigned department
  const savedBriefing = React.useMemo(() => {
    const currentDept = targetDept || getUserDeptName();
    return briefings.find(b => isSameDepartment(b.department, currentDept));
  }, [briefings, targetDept, getUserDeptName, isSameDepartment]);

  // EOD Closures for team members in assigned department
  const teamEodClosures = React.useMemo(() => {
    const currentDept = targetDept || getUserDeptName();
    return eodClosures.filter(e => isSameDepartment(e.department, currentDept));
  }, [eodClosures, targetDept, getUserDeptName, isSameDepartment]);

  const activeDeptName = targetDept || getUserDeptName() || 'Assigned Department';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Users size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team Lead Daily Operations</h1>
                <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full border border-indigo-200 dark:border-indigo-800">
                  TL View
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Department execution rhythm & daily performance tracking</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Assigned Department Badge */}
          {activeDeptName && (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 rounded-xl text-sm border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold">
              <Building size={16} />
              <span>{activeDeptName}</span>
            </div>
          )}

          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-600">
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
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
            />
          </div>
        </div>
      </div>


      {/* Main Content Sections */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw size={32} className="animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading Daily Operations for {activeDeptName}...</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* SECTION 1: Department Routine Checklist Form */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Department Routine Checklist</h2>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    {activeDeptName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Interactive operational milestone checklist for {selectedDate}</p>
              </div>

              {/* Progress Bar & Status Counter */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 self-start sm:self-auto">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Checklist Progress</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {deptRoutines.filter(r => r.status === 'completed').length} / {deptRoutines.length} ({deptRoutines.length > 0 ? Math.round((deptRoutines.filter(r => r.status === 'completed').length / deptRoutines.length) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-36 sm:w-48 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${deptRoutines.length > 0 ? (deptRoutines.filter(r => r.status === 'completed').length / deptRoutines.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist Form Items */}
            <div className="space-y-2.5">
              {deptRoutines.map((routine) => {
                const isCompleted = routine.status === 'completed';
                return (
                  <div 
                    key={routine._id}
                    onClick={() => handleToggleRoutine(routine._id)}
                    className={`group p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCompleted 
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      {/* Checkbox Icon Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRoutine(routine._id);
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 mt-0.5 sm:mt-0 ${
                          isCompleted
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-transparent hover:border-indigo-500'
                        }`}
                      >
                        <CheckSquare size={16} className={isCompleted ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'} />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                            {routine.time}
                          </span>
                          {routine.subtitle && (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              {routine.subtitle}
                            </span>
                          )}
                        </div>
                        <h4 className={`text-sm font-semibold mt-1 ${
                          isCompleted 
                            ? 'text-slate-500 dark:text-slate-400 line-through' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {routine.title}
                        </h4>

                        {isCompleted && routine.completedByName && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                            ✓ Checked by {routine.completedByName} ({new Date(routine.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        isCompleted 
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
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

                      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700/60 pl-2">
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

              {deptRoutines.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  No routine checklist items found for {activeDeptName} on this date.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Department Daily Briefing Table & Form */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Department Daily Briefing</h2>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                    {activeDeptName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Team Lead / HOD priority alignment table & submission</p>
              </div>

              {savedBriefing && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Last Briefing Saved by <strong className="text-indigo-600 dark:text-indigo-400">{savedBriefing.submittedByName || 'Team Lead'}</strong>
                </span>
              )}
            </div>

            {/* Display Saved Briefing Table Card if Available */}
            {savedBriefing ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                    Today's Active Briefing Table ({activeDeptName})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Updated: {new Date(savedBriefing.updatedAt || savedBriefing.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700/60 pl-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBriefing(savedBriefing)}
                          title="Edit Briefing"
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingBriefing(savedBriefing)}
                          title="Delete Briefing"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/70 dark:border-slate-700">
                    <span className="block font-bold text-indigo-600 dark:text-indigo-400 text-[10px] uppercase tracking-wider">🎯 #1 Priority</span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium mt-1">{savedBriefing.priority || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/70 dark:border-slate-700">
                    <span className="block font-bold text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-wider">📋 Key Deliverables</span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium mt-1 whitespace-pre-line">{savedBriefing.deliverables || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/70 dark:border-slate-700">
                    <span className="block font-bold text-amber-600 dark:text-amber-400 text-[10px] uppercase tracking-wider">⚠️ Blockers / Escalations</span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium mt-1 whitespace-pre-line">{savedBriefing.blockers || 'No blockers reported'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                No briefing saved for <strong>{activeDeptName}</strong> on this date yet. Fill out the form below to publish today's team briefing.
              </div>
            )}

            {/* Briefing Form */}
            <form onSubmit={handleSaveBriefing} className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {savedBriefing ? 'Update Team Briefing' : 'Submit Team Briefing'}
              </h3>

              {/* Priority Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Today's #1 Department Priority
                </label>
                <input
                  type="text"
                  placeholder="E.g. Deliver production build release v2.4"
                  value={briefingPriority}
                  onChange={(e) => setBriefingPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Projects / Deliverables */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Team Projects & Key Deliverables
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Detail key team deliverables for today..."
                    value={briefingDeliverables}
                    onChange={(e) => setBriefingDeliverables(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Blockers / Approval Needed */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Blockers / Escalations Needed
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Mention any issues, delays, or pending management approvals..."
                    value={briefingBlockers}
                    onChange={(e) => setBriefingBlockers(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-start pt-2">
                <button
                  type="submit"
                  disabled={briefingSaving}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {briefingSaving ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>{savedBriefing ? 'Update Team Briefing' : 'Save Team Briefing'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3: Team Member EOD Submissions Monitor */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Team Member EOD Submissions</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Track tasks logged by team members in {activeDeptName}</p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-full">
                {teamEodClosures.length} EOD Reports Logged
              </span>
            </div>

            {teamEodClosures.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamEodClosures.map((eod) => (
                  <div key={eod._id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <Users size={15} className="text-indigo-600" />
                        <span>{eod.userName || eod.user?.name || 'Staff Member'}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {eod.department && (
                          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                            {eod.department}
                          </span>
                        )}
                          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700/60 pl-2">
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
              <div className="py-8 text-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                No EOD reports submitted by team members of {activeDeptName} for this date yet.
              </div>
            )}
          </div>

          {/* SECTION 4: TL Personal EOD Closure Form */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Submit Team Lead EOD Closure</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Team Lead daily handover & management escalation</p>
            </div>

            <form onSubmit={handleSubmitEod} className="space-y-4">
              {/* Completed Today */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Completed Today
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of key team achievements and tasks closed today..."
                  value={eodCompleted}
                  onChange={(e) => setEodCompleted(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* Pending / Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Pending / Reason
                </label>
                <textarea
                  rows={3}
                  placeholder="Unfinished tasks and exact reason for spillover..."
                  value={eodPendingReason}
                  onChange={(e) => setEodPendingReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* Tomorrow Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Tomorrow Priority
                </label>
                <textarea
                  rows={3}
                  placeholder="Top action items planned for tomorrow..."
                  value={eodTomorrowPriority}
                  onChange={(e) => setEodTomorrowPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-start pt-2">
                <button
                  type="submit"
                  disabled={eodSubmitting}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {eodSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>Submit EOD Closure Report</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* Edit Routine Modal rendered via Portal */}
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
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil size={18} className="text-indigo-600 dark:text-indigo-400" />
                Edit Routine Milestone
              </h3>
              <button
                type="button"
                onClick={() => setEditingRoutine(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
                  id="updateRecurringCheckTL"
                  checked={updateRecurring}
                  onChange={(e) => setUpdateRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="updateRecurringCheckTL" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
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
                id="deleteFutureCheckTL"
                checked={deleteFromFuture}
                onChange={(e) => setDeleteFromFuture(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <label htmlFor="deleteFutureCheckTL" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
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
                  onClick={() => setEditingBriefing(null)}
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

    </div>
  );
};

export default TeamLeadDailyOperationsPage;
