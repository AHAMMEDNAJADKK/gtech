import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, Search, RefreshCw, Eye, Edit, Filter, 
  BookOpen, Layers, CheckCircle2, UserCheck, Phone, Mail, 
  Calendar, AlertCircle, X, ChevronLeft, ChevronRight, User
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import StatsCard from '../../components/StatsCard';
import StatusBadge from '../../components/StatusBadge';
import StudentProfileModal from '../../components/StudentProfileModal';

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

const StudentsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [students, setStudents] = useState([]);
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

  // Profile Modal State
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Fetch Students
  const fetchStudents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(getApiEndpoint('/users?role=student&limit=500'), {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error(`Failed to load students (${res.status})`);
      }

      const resData = await res.json();
      const rawUsers = resData?.data || resData?.users || (Array.isArray(resData) ? resData : []);
      
      // Ensure only real student records
      const studentUsers = rawUsers.filter(u => {
        if (!u) return false;
        const roleStr = String(u.role || '').toLowerCase();
        const roleIdStr = String(u.role_id || u.roleId || '');
        return roleStr === 'student' || roleIdStr === '10' || Boolean(u.studentId);
      });

      setStudents(studentUsers);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(err.message || 'Unable to retrieve students.');
      showToast('Failed to load students list.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getHeaders, showToast]);

  // Fetch Courses & Batches for filters
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
    fetchStudents();
    fetchMetadata();
  }, [fetchStudents, fetchMetadata]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (st.name || '').toLowerCase().includes(q);
        const emailMatch = (st.email || '').toLowerCase().includes(q);
        const phoneMatch = (st.phone || '').toLowerCase().includes(q);
        const idMatch = (st.studentId || st.employeeId || '').toLowerCase().includes(q);
        const courseMatch = (st.coursePreference || '').toLowerCase().includes(q) ||
          (st.enrolledBatches || []).some(b => (b.courseName || '').toLowerCase().includes(q)) ||
          (st.enrollments || []).some(e => (e.courseName || '').toLowerCase().includes(q));

        if (!nameMatch && !emailMatch && !phoneMatch && !idMatch && !courseMatch) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        const s = (st.status || 'active').toLowerCase();
        if (statusFilter === 'active' && s !== 'active') return false;
        if (statusFilter === 'inactive' && s !== 'inactive') return false;
        if (statusFilter === 'blocked' && s !== 'blocked') return false;
      }

      // 3. Course Filter
      if (courseFilter !== 'ALL') {
        const pref = (st.coursePreference || '').toLowerCase();
        const hasEnrolled = (st.enrolledBatches || []).some(b => (b.courseName || '').toLowerCase() === courseFilter.toLowerCase()) ||
          (st.enrollments || []).some(e => (e.courseName || '').toLowerCase() === courseFilter.toLowerCase());
        if (pref !== courseFilter.toLowerCase() && !hasEnrolled) {
          return false;
        }
      }

      // 4. Batch Filter
      if (batchFilter !== 'ALL') {
        const inBatch = (st.enrolledBatches || []).some(b => String(b.id || b._id) === String(batchFilter) || b.batchName === batchFilter || b.batchCode === batchFilter) ||
          (st.enrollments || []).some(e => String(e.batchId || e.id) === String(batchFilter));
        if (!inBatch) {
          return false;
        }
      }

      return true;
    });
  }, [students, searchQuery, statusFilter, courseFilter, batchFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter(s => (s.status || 'active') === 'active').length;
    const enrolledInBatches = students.filter(s => (s.enrolledBatches && s.enrolledBatches.length > 0) || (s.enrollments && s.enrollments.length > 0)).length;
    const coursesCount = new Set(students.map(s => s.coursePreference).filter(Boolean)).size;

    return { total, active, enrolledInBatches, coursesCount };
  }, [students]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  const handleOpenProfile = (studentId) => {
    setSelectedStudentId(studentId);
    setIsProfileModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setCourseFilter('ALL');
    setBatchFilter('ALL');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Students
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Employee Management &bull; Student Records &amp; Academic Profiles
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStudents(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh student list"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Students"
          value={stats.total}
          icon={GraduationCap}
          color="indigo"
          loading={loading}
        />
        <StatsCard
          title="Active Students"
          value={stats.active}
          icon={CheckCircle2}
          color="emerald"
          loading={loading}
        />
        <StatsCard
          title="Batch Enrollments"
          value={stats.enrolledInBatches}
          icon={Layers}
          color="amber"
          loading={loading}
        />
        <StatsCard
          title="Unique Courses"
          value={stats.coursesCount}
          icon={BookOpen}
          color="rose"
          loading={loading}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name, ID (STD-...), email, phone, or course..."
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

          {/* Status Filter */}
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

            {/* Course Filter */}
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

            {/* Batch Filter */}
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
                onClick={handleResetFilters}
                className="px-2.5 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
                title="Clear all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter stats subtitle */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
          <span>
            Showing {filteredStudents.length} of {students.length} students
          </span>
          {filteredStudents.length !== students.length && (
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
              Loading student directory...
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
              onClick={() => fetchStudents()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 text-slate-400 rounded-2xl">
              <UserCheck size={36} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No students found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {searchQuery || statusFilter !== 'ALL' || courseFilter !== 'ALL' || batchFilter !== 'ALL'
                ? "We couldn't find any student records matching your active filters. Try resetting the search or filter options."
                : "There are currently no registered students in the CRM. Convert leads from Admissions to automatically create student records."}
            </p>
            {(searchQuery || statusFilter !== 'ALL' || courseFilter !== 'ALL' || batchFilter !== 'ALL') && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Student ID</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Course / Program</th>
                  <th className="py-3.5 px-4">Batch Cohort</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Admission Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {paginatedStudents.map((student) => {
                  const studentIdVal = student.studentId || student.employeeId || '—';
                  const studentCourse = student.coursePreference || (student.enrolledBatches?.[0]?.courseName) || (student.enrollments?.[0]?.courseName) || 'Unassigned';
                  const enrolledBatches = student.enrolledBatches || [];
                  const activeBatch = enrolledBatches[0] || (student.enrollments?.[0]?.batchName ? { batchName: student.enrollments[0].batchName, batchCode: student.enrollments[0].batchCode } : null);
                  
                  const admissionDate = student.createdAt 
                    ? new Date(student.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : student.joining_date 
                      ? new Date(student.joining_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—';

                  const initials = (student.name || 'S')
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const avatarUrl = student.profile_image || student.avatar || student.profileImage;

                  return (
                    <tr 
                      key={student.id || student._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={student.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm ${avatarUrl ? 'hidden' : 'flex'}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block truncate group-hover:text-indigo-600 transition-colors">
                              {student.name}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 block truncate">
                              {student.city ? `${student.city}${student.state ? `, ${student.state}` : ''}` : 'Student Candidate'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Student ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                          {studentIdVal}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {student.email && (
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                              <Mail size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{student.email}</span>
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                              <Phone size={12} className="text-slate-400 shrink-0" />
                              <span>{student.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Course */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <BookOpen size={13} className="text-indigo-500 shrink-0" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[170px]" title={studentCourse}>
                            {studentCourse}
                          </span>
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="py-3.5 px-4">
                        {activeBatch ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40 text-[11px] font-bold">
                            <Layers size={11} className="shrink-0" />
                            <span className="truncate max-w-[130px]">{activeBatch.batchName || activeBatch.batchCode}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not Assigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={student.status || (student.isActive ? 'active' : 'inactive')} />
                      </td>

                      {/* Admission Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{admissionDate}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/academy/learning?studentId=${student.id || student._id}`)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition cursor-pointer"
                            title="Open Student LMS Dashboard"
                          >
                            <GraduationCap size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenProfile(student.id || student._id)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition cursor-pointer"
                            title="View student profile & attendance"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenProfile(student.id || student._id)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-xl transition cursor-pointer"
                            title="Edit student details"
                          >
                            <Edit size={15} />
                          </button>
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
        {!loading && filteredStudents.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing <span className="font-bold text-slate-700 dark:text-slate-300">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * PAGE_SIZE, filteredStudents.length)}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{filteredStudents.length}</span> students
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                  if (
                    totalPages <= 7 ||
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                          currentPage === page
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  }
                  if (page === 2 || page === totalPages - 1) {
                    return (
                      <span key={page} className="px-1 text-slate-400">
                        &hellip;
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student Profile & Edit Modal (Reusing existing component) */}
      {selectedStudentId && (
        <StudentProfileModal
          studentId={selectedStudentId}
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setSelectedStudentId(null);
          }}
          getHeaders={getHeaders}
          onEditStudent={() => fetchStudents(true)}
          onDeleteStudent={() => {
            setIsProfileModalOpen(false);
            setSelectedStudentId(null);
            fetchStudents(true);
          }}
        />
      )}
    </div>
  );
};

export default StudentsPage;
