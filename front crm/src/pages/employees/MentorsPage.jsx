import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserCog, Search, RefreshCw, Eye, Edit, Plus, Filter, 
  Phone, Mail, Calendar, AlertCircle, X, ChevronLeft, ChevronRight, 
  Layers, BookOpen, CheckCircle2, UserCheck, ShieldCheck, Loader2
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import StatsCard from '../../components/StatsCard';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

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

const PAGE_SIZE = 10;

const initialMentorForm = {
  name: '',
  email: '',
  phone: '',
  employeeId: '',
  designation: 'Senior Faculty',
  department: 'Academic Faculty',
  password: '',
  status: 'active',
  joining_date: new Date().toISOString().split('T')[0]
};

const MentorsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mentors, setMentors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [batchFilter, setBatchFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [formData, setFormData] = useState(initialMentorForm);
  const [editFormData, setEditFormData] = useState(initialMentorForm);
  const [submitting, setSubmitting] = useState(false);

  // Current logged in user context
  const currentUser = useMemo(() => {
    try {
      const rawUser = localStorage.getItem('user');
      return rawUser ? JSON.parse(rawUser) : null;
    } catch {
      return null;
    }
  }, []);

  const isAdminOrSuperAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = String(currentUser.role || '').toLowerCase();
    const roleId = String(currentUser.role_id || currentUser.roleId || '');
    return Boolean(
      currentUser.isSuperAdmin === true ||
      currentUser.is_super_admin === true ||
      role === 'superadmin' ||
      role === 'admin' ||
      roleId === '0' ||
      roleId === '1'
    );
  }, [currentUser]);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Fetch Mentors from backend
  const fetchMentors = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(getApiEndpoint('/users?role=mentor&limit=500'), {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error(`Failed to load mentors (${res.status})`);
      }

      const resData = await res.json();
      const rawUsers = resData?.data || resData?.users || (Array.isArray(resData) ? resData : []);
      
      // Filter for actual mentor / instructor records
      const mentorList = rawUsers.filter(u => {
        if (!u) return false;
        const roleStr = String(u.role || '').toLowerCase();
        const roleIdStr = String(u.role_id || u.roleId || '');
        const desigStr = String(u.designation || u.designationName || '').toLowerCase();
        return (
          roleStr === 'instructor' ||
          roleStr === 'mentor' ||
          roleStr === 'faculty' ||
          roleStr === 'teacher' ||
          roleStr === 'trainer' ||
          roleIdStr === '3' ||
          desigStr.includes('faculty') ||
          desigStr.includes('instructor') ||
          desigStr.includes('mentor') ||
          desigStr.includes('teacher') ||
          desigStr.includes('trainer')
        );
      });

      setMentors(mentorList);
    } catch (err) {
      console.error('Error fetching mentors:', err);
      setError(err.message || 'Unable to retrieve mentors.');
      showToast('Failed to load mentors list.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getHeaders, showToast]);

  // Fetch Courses & Batches for cross-referencing
  const fetchMetadata = useCallback(async () => {
    try {
      const [coursesRes, batchesRes] = await Promise.all([
        fetch(getApiEndpoint('/academy/courses'), { headers: getHeaders() }).catch(() => null),
        fetch(getApiEndpoint('/academy/batches'), { headers: getHeaders() }).catch(() => null)
      ]);

      if (coursesRes && coursesRes.ok) {
        const cData = await coursesRes.json();
        setCourses(cData?.data || []);
      }
      if (batchesRes && batchesRes.ok) {
        const bData = await batchesRes.json();
        setBatches(bData?.data || []);
      }
    } catch (err) {
      console.warn('Metadata fetch warning:', err);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchMentors();
    fetchMetadata();
  }, [fetchMentors, fetchMetadata]);

  // Filtered Mentors
  const filteredMentors = useMemo(() => {
    return mentors.filter(mentor => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (mentor.name || '').toLowerCase().includes(q);
        const emailMatch = (mentor.email || '').toLowerCase().includes(q);
        const phoneMatch = (mentor.phone || '').toLowerCase().includes(q);
        const idMatch = (mentor.employeeId || '').toLowerCase().includes(q);
        const desigMatch = (mentor.designation || mentor.designationName || '').toLowerCase().includes(q);
        const courseMatch = (mentor.assignedCourses || []).some(c => (c.courseName || '').toLowerCase().includes(q));
        const batchMatch = (mentor.assignedBatches || []).some(b => (b.batchName || b.batchCode || '').toLowerCase().includes(q));

        if (!nameMatch && !emailMatch && !phoneMatch && !idMatch && !desigMatch && !courseMatch && !batchMatch) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        const s = (mentor.status || 'active').toLowerCase();
        if (statusFilter === 'active' && s !== 'active') return false;
        if (statusFilter === 'inactive' && s !== 'inactive') return false;
        if (statusFilter === 'blocked' && s !== 'blocked') return false;
      }

      // 3. Course Filter
      if (courseFilter !== 'ALL') {
        const hasCourse = (mentor.assignedCourses || []).some(c => (c.courseName || '').toLowerCase() === courseFilter.toLowerCase()) ||
          (mentor.assignedBatches || []).some(b => (b.courseName || '').toLowerCase() === courseFilter.toLowerCase());
        if (!hasCourse) {
          return false;
        }
      }

      // 4. Batch Filter
      if (batchFilter !== 'ALL') {
        const hasBatch = (mentor.assignedBatches || []).some(b => String(b.id || b._id) === String(batchFilter) || b.batchName === batchFilter || b.batchCode === batchFilter);
        if (!hasBatch) {
          return false;
        }
      }

      return true;
    });
  }, [mentors, searchQuery, statusFilter, courseFilter, batchFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = mentors.length;
    const active = mentors.filter(m => (m.status || 'active') === 'active').length;
    const assignedWithBatches = mentors.filter(m => (m.assignedBatches && m.assignedBatches.length > 0)).length;
    const totalBatchesConducted = mentors.reduce((acc, m) => acc + (m.assignedBatches?.length || 0), 0);

    return { total, active, assignedWithBatches, totalBatchesConducted };
  }, [mentors]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredMentors.length / PAGE_SIZE));
  const paginatedMentors = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMentors.slice(start, start + PAGE_SIZE);
  }, [filteredMentors, currentPage]);

  // Create Mentor Handler
  const handleCreateMentor = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      showToast('Name, email, and password are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(getApiEndpoint('/users/create'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...formData,
          role: 'instructor',
          role_id: '3'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Failed to create mentor.');
      }

      showToast('Mentor created successfully!', 'success');
      setIsCreateModalOpen(false);
      setFormData(initialMentorForm);
      fetchMentors(true);
    } catch (err) {
      console.error('Create Mentor Error:', err);
      showToast(err.message || 'Error creating mentor.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Mentor Handler
  const handleEditMentor = async (e) => {
    e.preventDefault();
    if (!selectedMentor) return;

    setSubmitting(true);
    try {
      const mentorId = selectedMentor.id || selectedMentor._id;
      const res = await fetch(getApiEndpoint(`/users/update/${mentorId}`), {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editFormData.name,
          phone: editFormData.phone,
          designation: editFormData.designation,
          department: editFormData.department,
          status: editFormData.status,
          employeeId: editFormData.employeeId,
          role: 'instructor'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Failed to update mentor.');
      }

      showToast('Mentor updated successfully!', 'success');
      setIsEditModalOpen(false);
      setSelectedMentor(null);
      fetchMentors(true);
    } catch (err) {
      console.error('Edit Mentor Error:', err);
      showToast(err.message || 'Error updating mentor.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (mentor) => {
    setSelectedMentor(mentor);
    setEditFormData({
      name: mentor.name || '',
      email: mentor.email || '',
      phone: mentor.phone || '',
      employeeId: mentor.employeeId || '',
      designation: mentor.designation || mentor.designationName || 'Senior Faculty',
      department: mentor.department || 'Academic Faculty',
      status: mentor.status || 'active',
      joining_date: mentor.joining_date ? new Date(mentor.joining_date).toISOString().split('T')[0] : ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenView = (mentor) => {
    setSelectedMentor(mentor);
    setIsViewModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
              <UserCog size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Mentors
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Employee Management &bull; Instructors, Faculty &amp; Academic Mentors
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchMentors(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh mentors list"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>

          {isAdminOrSuperAdmin && (
            <button
              onClick={() => {
                setFormData(initialMentorForm);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/25 transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Mentor</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Mentors"
          value={stats.total}
          icon={UserCog}
          color="indigo"
          loading={loading}
        />
        <StatsCard
          title="Active Mentors"
          value={stats.active}
          icon={CheckCircle2}
          color="emerald"
          loading={loading}
        />
        <StatsCard
          title="With Active Batches"
          value={stats.assignedWithBatches}
          icon={Layers}
          color="amber"
          loading={loading}
        />
        <StatsCard
          title="Batches Assigned"
          value={stats.totalBatchesConducted}
          icon={BookOpen}
          color="rose"
          loading={loading}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by mentor name, email, phone, course, or batch code..."
              className="w-full pl-10 pr-9 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>

            {courses.length > 0 && (
              <select
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[180px] truncate"
              >
                <option value="ALL">All Courses</option>
                {courses.map(c => (
                  <option key={c._id || c.id} value={c.courseName}>
                    {c.courseName}
                  </option>
                ))}
              </select>
            )}

            {batches.length > 0 && (
              <select
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[180px] truncate"
              >
                <option value="ALL">All Batches</option>
                {batches.map(b => (
                  <option key={b._id || b.id} value={b._id || b.id}>
                    {b.batchName} ({b.batchCode})
                  </option>
                ))}
              </select>
            )}

            {(searchQuery || statusFilter !== 'ALL' || courseFilter !== 'ALL' || batchFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setCourseFilter('ALL');
                  setBatchFilter('ALL');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
          <span>
            Showing {filteredMentors.length} of {mentors.length} mentors
          </span>
          {filteredMentors.length !== mentors.length && (
            <span className="text-indigo-500">Filtered view active</span>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Loading mentor directory...
            </p>
          </div>
        ) : error ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl">
              <AlertCircle size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {error}
            </p>
            <button
              onClick={() => fetchMentors()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : paginatedMentors.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 text-slate-400 rounded-2xl">
              <UserCog size={36} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No mentors found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {searchQuery || statusFilter !== 'ALL' || courseFilter !== 'ALL'
                ? "No mentors match your active filter criteria."
                : "No mentors or faculty members have been registered yet."}
            </p>
            {isAdminOrSuperAdmin && !searchQuery && (
              <button
                onClick={() => {
                  setFormData(initialMentorForm);
                  setIsCreateModalOpen(true);
                }}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Plus size={15} />
                <span>Add Mentor</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Mentor / Faculty</th>
                  <th className="py-3.5 px-4">Employee ID</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Designation</th>
                  <th className="py-3.5 px-4">Assigned Batches</th>
                  <th className="py-3.5 px-4">Courses</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {paginatedMentors.map((mentor) => {
                  const empIdVal = mentor.employeeId || '—';
                  const designationVal = mentor.designationName || mentor.designation || 'Faculty';
                  const assignedBatches = mentor.assignedBatches || [];
                  const assignedCourses = mentor.assignedCourses || [];

                  const initials = (mentor.name || 'M')
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const avatarUrl = mentor.profile_image || mentor.avatar || mentor.profileImage;

                  return (
                    <tr 
                      key={mentor.id || mentor._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={mentor.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm ${avatarUrl ? 'hidden' : 'flex'}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block truncate group-hover:text-indigo-600 transition-colors">
                              {mentor.name}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 block truncate">
                              {mentor.department || 'Academic Faculty'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                          {empIdVal}
                        </span>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {mentor.email && (
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                              <Mail size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{mentor.email}</span>
                            </div>
                          )}
                          {mentor.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                              <Phone size={12} className="text-slate-400 shrink-0" />
                              <span>{mentor.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Designation */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40 font-semibold text-[11px]">
                          <ShieldCheck size={12} className="shrink-0" />
                          <span className="truncate max-w-[140px]">{designationVal}</span>
                        </div>
                      </td>

                      {/* Assigned Batches */}
                      <td className="py-3.5 px-4">
                        {assignedBatches.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {assignedBatches.slice(0, 2).map((b, i) => (
                              <button
                                key={b.id || i}
                                onClick={() => b.id && navigate(`/academy/batches/${b.id}`)}
                                className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40 text-[10px] font-bold hover:underline cursor-pointer"
                              >
                                {b.batchName || b.batchCode}
                              </button>
                            ))}
                            {assignedBatches.length > 2 && (
                              <span className="text-[10px] font-bold text-slate-400 px-1">
                                +{assignedBatches.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No active batches</span>
                        )}
                      </td>

                      {/* Courses */}
                      <td className="py-3.5 px-4">
                        {assignedCourses.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                            <BookOpen size={13} className="text-indigo-500 shrink-0" />
                            <span className="truncate max-w-[150px]" title={assignedCourses.map(c => c.courseName).join(', ')}>
                              {assignedCourses[0]?.courseName}
                              {assignedCourses.length > 1 && ` (+${assignedCourses.length - 1})`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">General Faculty</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={mentor.status || (mentor.isActive ? 'active' : 'inactive')} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenView(mentor)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition cursor-pointer"
                            title="View mentor profile & batches"
                          >
                            <Eye size={15} />
                          </button>
                          {isAdminOrSuperAdmin && (
                            <button
                              onClick={() => handleOpenEdit(mentor)}
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-xl transition cursor-pointer"
                              title="Edit mentor details"
                            >
                              <Edit size={15} />
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
        )}

        {/* Pagination Footer */}
        {!loading && filteredMentors.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing <span className="font-bold text-slate-700 dark:text-slate-300">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * PAGE_SIZE, filteredMentors.length)}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{filteredMentors.length}</span> mentors
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Create Mentor */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Mentor / Faculty"
      >
        <form onSubmit={handleCreateMentor} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dr. Rajesh Sharma"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. rajesh.mentor@edtech.com"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +91 9876543210"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="e.g. MTR-2026-001"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g. Senior Faculty / Lead Mentor"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g. Computer Science Faculty"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Temporary login password"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50 shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              <span>Save Mentor</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Edit Mentor */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedMentor(null);
        }}
        title="Edit Mentor Profile"
      >
        <form onSubmit={handleEditMentor} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={editFormData.email}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={editFormData.employeeId}
                onChange={(e) => setEditFormData({ ...editFormData, employeeId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                value={editFormData.designation}
                onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={editFormData.department}
                onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedMentor(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50 shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: View Mentor Details */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedMentor(null);
        }}
        title="Mentor Profile &amp; Teaching Roster"
      >
        {selectedMentor && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                {(selectedMentor.name || 'M').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {selectedMentor.name}
                </h3>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedMentor.designationName || selectedMentor.designation || 'Faculty Member'}
                </p>
                <div className="mt-1">
                  <StatusBadge status={selectedMentor.status || (selectedMentor.isActive ? 'active' : 'inactive')} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Employee ID</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedMentor.employeeId || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Department</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMentor.department || 'Academic Faculty'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Email</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">{selectedMentor.email || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Phone</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedMentor.phone || '—'}</span>
              </div>
            </div>

            {/* Assigned Batches List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-500" />
                <span>Assigned Batches ({(selectedMentor.assignedBatches || []).length})</span>
              </h4>
              {(selectedMentor.assignedBatches || []).length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {selectedMentor.assignedBatches.map((b, idx) => (
                    <div 
                      key={b.id || idx}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {b.batchName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {b.batchCode} &bull; {b.courseName || 'Course'}
                        </span>
                      </div>
                      {b.id && (
                        <button
                          onClick={() => {
                            setIsViewModalOpen(false);
                            navigate(`/academy/batches/${b.id}`);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                        >
                          View Batch &rarr;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No batches currently assigned. Assign batches from Academy &gt; Batches.
                </p>
              )}
            </div>

            {/* Assigned Courses List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen size={13} className="text-indigo-500" />
                <span>Assigned Courses ({(selectedMentor.assignedCourses || []).length})</span>
              </h4>
              {(selectedMentor.assignedCourses || []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedMentor.assignedCourses.map((c, idx) => (
                    <div
                      key={c.id || idx}
                      className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40 text-xs font-semibold"
                    >
                      {c.courseName}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  General faculty member with no specific course ownership assigned.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedMentor(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MentorsPage;
