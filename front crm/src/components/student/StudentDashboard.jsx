import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, BookOpen, Clock, CheckCircle2, Award, ArrowRight, 
  Sparkles, Loader2, AlertCircle, BarChart3, PlayCircle, Video,
  Calendar, FileText, Upload, ExternalLink, RefreshCw, ChevronRight,
  User, Check, AlertTriangle, UserCheck, Eye, X, ArrowLeft, ArrowUpRight,
  Download
} from 'lucide-react';
import { useToast } from '../ToastProvider';
import { useUser } from '../../contexts/UserContext';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) {
    return `${API_BASE}${cleanPath}`;
  }
  return `${API_BASE}/v1${cleanPath}`;
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user: authUser } = useUser() || {};

  // Check if viewing as admin/staff for a specific student
  const queryStudentId = searchParams.get('studentId') || searchParams.get('userId') || '';
  const currentRole = String(authUser?.role_id || authUser?.roleId || authUser?.role || '').toLowerCase().trim();
  const isStaffRequester = currentRole === '0' || currentRole === 'superadmin' || currentRole === 'admin' || currentRole === 'hr' || currentRole === 'mentor' || currentRole === 'instructor';
  const isViewingOtherStudent = Boolean(isStaffRequester && queryStudentId);

  // Effective student ID: queryStudentId if staff, else current logged-in user id
  const effectiveStudentId = isViewingOtherStudent ? queryStudentId : (authUser?.id || authUser?._id || localStorage.getItem('user_id'));

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Data states
  const [studentProfile, setStudentProfile] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({
    totalMarked: 0,
    presentCount: 0,
    absentCount: 0,
    attendancePercentage: 0
  });
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  // Assignment filters & tabs
  const [assignmentTab, setAssignmentTab] = useState('ALL');
  const [assignmentSearch, setAssignmentSearch] = useState('');

  // Modals state
  const [detailsModalAssignment, setDetailsModalAssignment] = useState(null);
  const [submitModalAssignment, setSubmitModalAssignment] = useState(null);
  const [viewSubmissionModal, setViewSubmissionModal] = useState(null);
  const [syllabusModalCourse, setSyllabusModalCourse] = useState(null);
  const [downloadingCourseId, setDownloadingCourseId] = useState(null);

  // Submission form state
  const [submittingSolution, setSubmittingSolution] = useState(false);
  const [submissionType, setSubmissionType] = useState('FILE'); // FILE | TEXT | LINK
  const [submissionText, setSubmissionText] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');

  const handleDownloadCoursePdf = async (courseId, courseName) => {
    if (!courseId) return;
    setDownloadingCourseId(courseId);
    try {
      const rawToken = localStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
      const downloadUrl = getEndpoint(`/academy/courses/${courseId}/syllabus/pdf?download=true`);
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const safeFilename = `${(courseName || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_')}_Syllabus.pdf`;
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', safeFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast('Syllabus PDF downloaded successfully.', 'success');
    } catch (e) {
      console.error('Download error:', e);
      showToast('Could not download course syllabus PDF.', 'error');
    } finally {
      setDownloadingCourseId(null);
    }
  };

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Fetch all student dashboard data concurrently
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!effectiveStudentId) return;

    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const queryParam = isViewingOtherStudent ? `?studentId=${effectiveStudentId}` : '';

    try {
      const [profileRes, coursesRes, assignmentsRes, submissionsRes, classesRes, historyRes] = await Promise.all([
        // 1. Student profile & attendance rate
        fetch(getEndpoint(`/student/profile/${effectiveStudentId}`), { headers: getHeaders() }).catch(() => null),
        // 2. Enrolled courses
        fetch(getEndpoint(`/academy/student/enrolled-courses${queryParam}`), { headers: getHeaders() }).catch(() => null),
        // 3. Eligible assignments
        fetch(getEndpoint(`/academy/assignments${queryParam}`), { headers: getHeaders() }).catch(() => null),
        // 4. Submissions & results
        fetch(getEndpoint(`/academy/my-submissions${queryParam}`), { headers: getHeaders() }).catch(() => null),
        // 5. Upcoming live classes
        fetch(getEndpoint(`/live-classes?status=UPCOMING${isViewingOtherStudent ? `&studentId=${effectiveStudentId}` : ''}`), { headers: getHeaders() }).catch(() => null),
        // 6. Attendance history
        fetch(getEndpoint(`/attendance/my-history?limit=30${isViewingOtherStudent ? `&studentId=${effectiveStudentId}` : ''}`), { headers: getHeaders() }).catch(() => null),
      ]);

      // Handle Profile
      if (profileRes && profileRes.ok) {
        const pData = await profileRes.json();
        const profileObj = pData?.data?.student || pData?.data || {};
        setStudentProfile(profileObj);
        if (pData?.data?.attendanceSummary) {
          setAttendanceSummary(pData.data.attendanceSummary);
        }
      } else if (!isViewingOtherStudent && authUser) {
        setStudentProfile(authUser);
      }

      // Handle Courses
      if (coursesRes && coursesRes.ok) {
        const cData = await coursesRes.json();
        const list = Array.isArray(cData.data) ? cData.data : (Array.isArray(cData.courses) ? cData.courses : []);
        setEnrolledCourses(list);
      }

      // Handle Assignments
      if (assignmentsRes && assignmentsRes.ok) {
        const aData = await assignmentsRes.json();
        setAssignments(Array.isArray(aData.data) ? aData.data : []);
      }

      // Handle Submissions
      if (submissionsRes && submissionsRes.ok) {
        const sData = await submissionsRes.json();
        setSubmissions(Array.isArray(sData.data) ? sData.data : []);
      }

      // Handle Live Classes
      if (classesRes && classesRes.ok) {
        const lData = await classesRes.json();
        setLiveClasses(Array.isArray(lData.data) ? lData.data : []);
      }

      // Handle Attendance History
      if (historyRes && historyRes.ok) {
        const hData = await historyRes.json();
        const classRecords = Array.isArray(hData.studentClasses) ? hData.studentClasses : [];
        const dailyRecords = Array.isArray(hData.data) ? hData.data : [];
        // Prefer rich studentClasses records if present, otherwise dailyRecords
        if (classRecords.length > 0) {
          setAttendanceHistory(classRecords);
        } else {
          setAttendanceHistory(dailyRecords.map(d => ({
            id: d.id || d._id,
            date: d.date,
            status: d.status || (d.check_in_time ? 'PRESENT' : 'ABSENT'),
            courseName: 'Daily Campus Shift',
            batchName: d.shift || 'General',
            markedAt: d.check_in_time || d.createdAt
          })));
        }
      }

    } catch (err) {
      console.error("Student Dashboard Fetch Error:", err);
      setError(err.message || 'Failed to load Student Dashboard data.');
      showToast('Error loading student dashboard details.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveStudentId, isViewingOtherStudent, authUser, getHeaders, showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Map submissions by assignment ID for fast lookup
  const submissionsMap = useMemo(() => {
    const map = new Map();
    submissions.forEach(sub => {
      const aId = String(sub.assignmentId?._id || sub.assignmentId || '');
      if (aId) map.set(aId, sub);
    });
    return map;
  }, [submissions]);

  // Compute assignment statuses and metrics
  const processedAssignments = useMemo(() => {
    const now = Date.now();
    return assignments.map(assign => {
      const aId = String(assign._id || assign.id || '');
      const sub = submissionsMap.get(aId);
      const dueDate = assign.dueDate ? new Date(assign.dueDate).getTime() : null;
      const isPastDue = dueDate ? dueDate < now : false;

      let status = 'PENDING';
      if (sub) {
        if (sub.status === 'GRADED') status = 'GRADED';
        else if (sub.status === 'SUBMITTED' || sub.status === 'UNDER_REVIEW') status = 'SUBMITTED';
        else if (isPastDue) status = 'OVERDUE';
        else status = 'PENDING';
      } else if (isPastDue) {
        status = 'OVERDUE';
      }

      return {
        ...assign,
        computedStatus: status,
        submission: sub || null,
        isPastDue
      };
    });
  }, [assignments, submissionsMap]);

  // Filtered assignments based on tab & search
  const filteredAssignments = useMemo(() => {
    return processedAssignments.filter(item => {
      // Tab filter
      if (assignmentTab !== 'ALL' && item.computedStatus !== assignmentTab) {
        return false;
      }
      // Search filter
      if (assignmentSearch.trim()) {
        const q = assignmentSearch.toLowerCase().trim();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const courseMatch = (item.courseId?.courseName || item.courseId?.courseCode || '').toLowerCase().includes(q);
        if (!titleMatch && !courseMatch) return false;
      }
      return true;
    });
  }, [processedAssignments, assignmentTab, assignmentSearch]);

  // Computed Dashboard KPI Summary Cards
  const kpiStats = useMemo(() => {
    const totalAssignments = processedAssignments.length;
    const pendingAssignments = processedAssignments.filter(a => a.computedStatus === 'PENDING').length;
    const submittedAssignments = processedAssignments.filter(a => a.computedStatus === 'SUBMITTED').length;
    const gradedAssignments = processedAssignments.filter(a => a.computedStatus === 'GRADED').length;
    const overdueAssignments = processedAssignments.filter(a => a.computedStatus === 'OVERDUE').length;
    const upcomingClassesCount = liveClasses.length;

    return {
      totalAssignments,
      pendingAssignments,
      submittedAssignments,
      gradedAssignments,
      overdueAssignments,
      upcomingClassesCount,
      attendancePercentage: attendanceSummary.attendancePercentage || 0,
      totalSessions: attendanceSummary.totalMarked || 0,
      presentSessions: attendanceSummary.presentCount || 0
    };
  }, [processedAssignments, liveClasses, attendanceSummary]);

  // Evaluated / Graded Results List
  const evaluatedResults = useMemo(() => {
    return submissions.filter(s => s.status === 'GRADED');
  }, [submissions]);

  // File selection for submission
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFileError('');
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size exceeds 10MB limit.');
      return;
    }

    const validExts = ['pdf', 'jpg', 'jpeg', 'png', 'zip', 'doc', 'docx'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!validExts.includes(ext)) {
      setFileError('Allowed formats: PDF, JPG, PNG, DOC, DOCX, ZIP.');
      return;
    }

    setSelectedFile(file);
  };

  // Submit assignment action
  const handlePerformSubmit = async (e) => {
    e.preventDefault();
    if (!submitModalAssignment) return;

    setSubmittingSolution(true);
    setFileError('');

    try {
      let fileUrl = '';
      let fileMetadata = {};

      // 1. Upload file if FILE mode
      if (submissionType === 'FILE' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const rawToken = localStorage.getItem('token');
        const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';

        const uploadRes = await fetch(getEndpoint('/academy/lms/upload'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${cleanToken}` },
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.message || uploadData.detail || 'File upload failed.');

        fileUrl = uploadData.data?.url || '';
        fileMetadata = {
          originalName: selectedFile.name,
          mimeType: selectedFile.type,
          size: selectedFile.size,
          publicId: uploadData.data?.publicId || ''
        };
      }

      // 2. Submit solution
      const payload = {
        submissionType,
        fileUrl: submissionType === 'FILE' ? fileUrl : '',
        fileMetadata: submissionType === 'FILE' ? fileMetadata : {},
        textAnswer: submissionType === 'TEXT' ? submissionText : '',
        externalUrl: submissionType === 'LINK' ? submissionLink : ''
      };

      const submitRes = await fetch(getEndpoint(`/academy/assignments/${submitModalAssignment._id}/submit`), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const resData = await submitRes.json();
      if (!submitRes.ok) throw new Error(resData.message || resData.detail || 'Assignment submission failed.');

      showToast('Assignment submitted successfully!', 'success');
      setSubmitModalAssignment(null);
      setSelectedFile(null);
      setSubmissionText('');
      setSubmissionLink('');
      // Refetch data silently to update counts and badges
      fetchDashboardData(true);
    } catch (err) {
      console.error('Submit solution error:', err);
      showToast(err.message || 'Submission failed.', 'error');
      setFileError(err.message || 'Submission failed.');
    } finally {
      setSubmittingSolution(false);
    }
  };

  // Student details resolution
  const studentName = studentProfile?.name || (studentProfile?.first_name ? `${studentProfile.first_name} ${studentProfile.last_name || ''}`.trim() : 'Student');
  const studentIdCode = studentProfile?.studentId || studentProfile?.employeeId || (effectiveStudentId ? `STD-${String(effectiveStudentId).slice(-6).toUpperCase()}` : 'STD-STUDENT');

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans pb-20 selection:bg-indigo-500/30 transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ========================================================================= */}
        {/* REQUIREMENT 1: FIX "My LMS Student Portal" VISIBILITY & BANNER HEADER     */}
        {/* ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden transition-all duration-300">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="space-y-3">
              {/* Category & Status Badges */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
                  <GraduationCap size={15} /> Student Learning &amp; Academic Portal
                </div>
                {isViewingOtherStudent && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                    <User size={13} /> Admin View &bull; {studentName} ({studentIdCode})
                  </span>
                )}
              </div>

              {/* REQUIRED VISIBLE HEADING IN BOTH LIGHT & DARK MODES */}
              <h1 
                id="student-portal-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-slate-900 dark:text-white"
              >
                My LMS Student Portal
              </h1>

              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl font-medium leading-relaxed">
                {isViewingOtherStudent 
                  ? `Authorized administrative overview of academic enrollment, assignments, results, live classrooms, and attendance metrics for ${studentName}.`
                  : `Welcome back, ${studentName}! Track your enrolled courses, pending assignments, evaluation results, scheduled live classrooms, and verified attendance.`
                }
              </p>
            </div>

            {/* Actions & Student Badge */}
            <div className="flex flex-wrap items-center gap-3">
              {isViewingOtherStudent && (
                <button
                  type="button"
                  onClick={() => navigate('/employees/students')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  title="Back to Students Directory"
                >
                  <ArrowLeft size={14} /> Back to Students
                </button>
              )}

              <button
                type="button"
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                title="Refresh student dashboard"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin text-indigo-600" : ""} />
                <span>{refreshing ? "Updating..." : "Refresh"}</span>
              </button>

              <div className="flex items-center gap-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 px-4 py-2.5 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {studentName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Student ID</p>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono">{studentIdCode}</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Global Loading Spinner / Error banner */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Loading Student LMS Portal &amp; Metrics...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={22} className="shrink-0" />
              <div>
                <p className="text-sm font-bold">Failed to load student data</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchDashboardData()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && (
          <>
            {/* ========================================================================= */}
            {/* REQUIREMENT 2: 6 DASHBOARD SUMMARY CARDS                                  */}
            {/* Total Assignments, Pending, Submitted, Completed/Graded, Classes, Attendance */}
            {/* ========================================================================= */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <BarChart3 size={15} className="text-indigo-500" /> Academic Dashboard Summary
                </h2>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {enrolledCourses.length} Enrolled {enrolledCourses.length === 1 ? 'Course' : 'Courses'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                
                {/* 1. Total Assignments */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-indigo-400 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Assignments</p>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
                        {kpiStats.totalAssignments}
                      </h3>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 border border-indigo-100 dark:border-indigo-900/50">
                      <FileText size={18} />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-semibold text-slate-400">Curriculum tasks assigned</p>
                  </div>
                </div>

                {/* 2. Pending Assignments (Highlighted Prominently) */}
                <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-900/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-amber-500 transition ring-1 ring-amber-400/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full mb-1">
                        Action Required
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending</p>
                      <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tracking-tight">
                        {kpiStats.pendingAssignments}
                      </h3>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 border border-amber-200 dark:border-amber-900/50">
                      <Clock size={18} />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Awaiting your submission</p>
                  </div>
                </div>

                {/* 3. Submitted Assignments */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-sky-400 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Submitted</p>
                      <h3 className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 tracking-tight">
                        {kpiStats.submittedAssignments}
                      </h3>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 border border-sky-100 dark:border-sky-900/50">
                      <CheckCircle2 size={18} />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-semibold text-slate-400">Under instructor review</p>
                  </div>
                </div>

                {/* 4. Completed / Graded Assignments */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Completed &amp; Graded</p>
                      <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
                        {kpiStats.gradedAssignments}
                      </h3>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border border-emerald-100 dark:border-emerald-900/50">
                      <Award size={18} />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-semibold text-slate-400">Evaluated &amp; marks awarded</p>
                  </div>
                </div>

                {/* 5. Upcoming Live Classes */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-purple-400 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Upcoming Classes</p>
                      <h3 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 tracking-tight">
                        {kpiStats.upcomingClassesCount}
                      </h3>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 border border-purple-100 dark:border-purple-900/50">
                      <Video size={18} />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-semibold text-slate-400">Scheduled Google Meet / Zoom</p>
                  </div>
                </div>

                {/* 6. Attendance Summary */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-teal-400 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Attendance Rate</p>
                      <h3 className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1 tracking-tight">
                        {kpiStats.attendancePercentage}%
                      </h3>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 border border-teal-100 dark:border-teal-900/50">
                      <UserCheck size={18} />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-semibold text-slate-400">
                      {kpiStats.presentSessions} present of {kpiStats.totalSessions} sessions
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "My Assignments", desc: `${kpiStats.pendingAssignments} pending tasks`, path: "/student/assignments", icon: CheckCircle2, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200" },
                { label: "Course Syllabus", desc: "Curriculum modules & PDF", path: "/academy/syllabus", icon: FileText, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 border-blue-200" },
                { label: "Live Classrooms", desc: `${kpiStats.upcomingClassesCount} sessions scheduled`, path: "/live-classes", icon: Video, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/50 border-purple-200" },
                { label: "Evaluation Results", desc: `${kpiStats.gradedAssignments} evaluated`, path: "/student/results", icon: Award, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200" },
                { label: "Attendance Sheet", desc: `${kpiStats.attendancePercentage}% attendance record`, path: "/attendance", icon: Clock, color: "text-teal-600 bg-teal-50 dark:bg-teal-950/50 border-teal-200" },
                { label: "Certificates", desc: "Completions & awards", path: "/certificates", icon: Sparkles, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200" }
              ].map(hub => {
                const HIcon = hub.icon;
                return (
                  <button
                    key={hub.label}
                    onClick={() => navigate(hub.path)}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition text-left group cursor-pointer flex items-center gap-3 shadow-xs"
                  >
                    <div className={`p-2 rounded-xl ${hub.color} group-hover:scale-105 transition-transform shrink-0`}>
                      <HIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 transition truncate">
                        {hub.label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{hub.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ========================================================================= */}
            {/* REQUIREMENT 2: "MY ASSIGNMENTS" SECTION                                   */}
            {/* Display only assignments assigned to this student, status badges, details/submit */}
            {/* ========================================================================= */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              
              {/* Header with Title and Filter Tabs */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      My Assignments
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Assignments assigned specifically to your enrolled courses and cohorts. Complete pending tasks before due dates.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl">
                  {[
                    { key: 'ALL', label: 'All', count: processedAssignments.length },
                    { key: 'PENDING', label: 'Pending', count: kpiStats.pendingAssignments },
                    { key: 'SUBMITTED', label: 'Submitted', count: kpiStats.submittedAssignments },
                    { key: 'GRADED', label: 'Graded', count: kpiStats.gradedAssignments },
                    { key: 'OVERDUE', label: 'Overdue', count: kpiStats.overdueAssignments },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setAssignmentTab(tab.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        assignmentTab === tab.key
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                        assignmentTab === tab.key ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignments Table / List */}
              {filteredAssignments.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No assignments found in this view
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {assignmentTab === 'ALL'
                      ? 'You currently have no assignments assigned. When instructors publish tasks for your enrolled courses, they will appear here.'
                      : `You have no assignments marked as ${assignmentTab.toLowerCase()}.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Assignment Title</th>
                        <th className="py-3 px-4">Course / Program</th>
                        <th className="py-3 px-4">Assigned Date</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4">Max Marks</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {filteredAssignments.map(assign => {
                        const courseName = assign.courseId?.courseName || assign.courseId?.courseCode || 'General';
                        const assignedDateStr = assign.createdAt 
                          ? new Date(assign.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—';
                        const dueDateStr = assign.dueDate
                          ? new Date(assign.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'No Deadline';

                        const isPending = assign.computedStatus === 'PENDING';
                        const isOverdue = assign.computedStatus === 'OVERDUE';
                        const isSubmitted = assign.computedStatus === 'SUBMITTED';
                        const isGraded = assign.computedStatus === 'GRADED';

                        return (
                          <tr 
                            key={assign._id || assign.id}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                              isPending ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                            }`}
                          >
                            {/* Title & Instructions preview */}
                            <td className="py-3.5 px-4">
                              <div className="max-w-[280px]">
                                <span className="font-bold text-slate-900 dark:text-slate-100 block truncate" title={assign.title}>
                                  {assign.title}
                                </span>
                                {assign.description && (
                                  <span className="text-[11px] text-slate-400 block truncate">
                                    {assign.description}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Course / Program */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                                <BookOpen size={13} className="text-indigo-500 shrink-0" />
                                <span className="truncate max-w-[180px]">{courseName}</span>
                              </div>
                            </td>

                            {/* Assigned Date */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium">
                              {assignedDateStr}
                            </td>

                            {/* Due Date */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={13} className={isOverdue ? "text-rose-500" : "text-slate-400"} />
                                <span className={`font-semibold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {dueDateStr}
                                </span>
                              </div>
                            </td>

                            {/* Max Marks */}
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-slate-700 dark:text-slate-300">
                              {assign.maxMarks || 100} pts
                            </td>

                            {/* Status Badge */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {isPending && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                                  <Clock size={12} /> Pending
                                </span>
                              )}
                              {isOverdue && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                                  <AlertCircle size={12} /> Overdue
                                </span>
                              )}
                              {isSubmitted && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60">
                                  <CheckCircle2 size={12} /> Submitted
                                </span>
                              )}
                              {isGraded && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                  <Award size={12} /> Graded ({assign.submission?.grade || 0}/{assign.maxMarks || 100})
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDetailsModalAssignment(assign)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <Eye size={13} /> View Details
                                </button>

                                {(isPending || isOverdue) && !isViewingOtherStudent && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubmitModalAssignment(assign);
                                      setSelectedFile(null);
                                      setSubmissionText('');
                                      setSubmissionLink('');
                                      setFileError('');
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1"
                                  >
                                    <Upload size={13} /> Submit
                                  </button>
                                )}

                                {assign.submission && (
                                  <button
                                    type="button"
                                    onClick={() => setViewSubmissionModal(assign.submission)}
                                    className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-700 dark:text-sky-300 font-bold text-xs transition cursor-pointer"
                                  >
                                    View Submission
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

            </div>

            {/* ========================================================================= */}
            {/* REQUIREMENT 2: TWO-COLUMN SECTION: RECENT RESULTS & UPCOMING LIVE CLASSES */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* RECENT RESULTS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                      <Award size={20} className="text-emerald-600 dark:text-emerald-400" />
                      <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                        Recent Evaluated Results
                      </h2>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {evaluatedResults.length} Evaluated
                    </span>
                  </div>

                  {evaluatedResults.length === 0 ? (
                    <div className="py-14 text-center space-y-2">
                      <Award className="mx-auto text-slate-300 dark:text-slate-700" size={36} />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No evaluated results available yet
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Once instructors review and grade your submitted assignments, your scores, feedback, and performance grades will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60 mt-2">
                      {evaluatedResults.slice(0, 5).map(res => {
                        const assignTitle = res.assignmentId?.title || 'Assignment Evaluation';
                        const courseName = res.courseId?.courseName || res.assignmentId?.courseId?.courseName || 'Course';
                        const score = parseFloat(res.grade) || 0;
                        const max = parseFloat(res.maxMarks) || res.assignmentId?.maxMarks || 100;
                        const pct = max > 0 ? Math.round((score / max) * 100) : 0;
                        const gradedDate = res.gradedAt 
                          ? new Date(res.gradedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Recently';

                        let gradeBadge = 'B';
                        let gradeColor = 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200';
                        if (pct >= 90) {
                          gradeBadge = 'A+';
                          gradeColor = 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200';
                        } else if (pct >= 80) {
                          gradeBadge = 'A';
                          gradeColor = 'bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 border-teal-200';
                        } else if (pct < 60) {
                          gradeBadge = 'C';
                          gradeColor = 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200';
                        }

                        return (
                          <div key={res._id || res.id} className="py-4 flex items-start justify-between gap-4">
                            <div className="space-y-1 min-w-0">
                              <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {assignTitle}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {courseName} &bull; Graded on {gradedDate}
                              </p>
                              {res.feedback && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl mt-1.5 border border-slate-100 dark:border-slate-800">
                                  &ldquo;{res.feedback}&rdquo;
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black border ${gradeColor}`}>
                                {gradeBadge} ({pct}%)
                              </span>
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1 font-mono">
                                {score} / {max} pts
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Link
                    to="/student/results"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View All Results &amp; Grade Transcripts <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* UPCOMING LIVE CLASSES */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                      <Video size={20} className="text-purple-600 dark:text-purple-400" />
                      <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                        Upcoming Live Classes
                      </h2>
                    </div>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                      {liveClasses.length} Scheduled
                    </span>
                  </div>

                  {liveClasses.length === 0 ? (
                    <div className="py-14 text-center space-y-2">
                      <Video className="mx-auto text-slate-300 dark:text-slate-700" size={36} />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No live classes currently scheduled
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Your mentors will schedule upcoming Google Meet or Zoom lecture sessions here for your active course cohort.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4">
                      {liveClasses.slice(0, 4).map(session => {
                        const courseName = session.courseId?.courseName || 'Class';
                        const batchName = session.batchId?.batchName || session.batchId?.batchCode || '';
                        const dateFormatted = session.scheduledDate
                          ? new Date(session.scheduledDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                          : 'Scheduled';
                        const instructorName = session.instructorId?.name || 'Faculty Instructor';

                        return (
                          <div 
                            key={session._id || session.id}
                            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4 group hover:border-purple-300 transition"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                  {session.platform || 'Live Session'}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  {dateFormatted} &bull; {session.startTime || 'TBD'}
                                </span>
                              </div>
                              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {session.title}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {courseName} {batchName ? `(${batchName})` : ''} &bull; {instructorName}
                              </p>
                            </div>

                            {session.meetingUrl ? (
                              <a
                                href={session.meetingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shrink-0 shadow-xs"
                              >
                                <span>Join</span> <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 text-[11px] font-bold shrink-0">
                                Link Pending
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Link
                    to="/live-classes"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    View All Live Classroom Schedules <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

            </div>

            {/* ========================================================================= */}
            {/* REQUIREMENT 2: "MY ATTENDANCE" SECTION                                    */}
            {/* Student's own attendance percentage & history. Never other students.     */}
            {/* ========================================================================= */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <UserCheck size={20} className="text-teal-600 dark:text-teal-400" />
                    <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      My Attendance
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Your personal class attendance rate and logged lecture history. Verified academic records only.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400">Attendance Rate</p>
                    <p className="text-2xl font-black text-teal-600 dark:text-teal-400">
                      {attendanceSummary.attendancePercentage}%
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-900/60 flex items-center justify-center text-teal-600 dark:text-teal-400 font-black text-xl">
                    {attendanceSummary.attendancePercentage}%
                  </div>
                </div>
              </div>

              {/* Attendance Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Minimum Institute Target: 75%</span>
                  <span className="text-teal-600 dark:text-teal-400">{attendanceSummary.attendancePercentage}% Achieved</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-700" 
                    style={{ width: `${Math.min(100, attendanceSummary.attendancePercentage)}%` }} 
                  />
                </div>
              </div>

              {/* Attendance History Records */}
              {attendanceHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Clock size={32} className="mx-auto opacity-40" />
                  <p className="text-xs font-bold">No attendance sessions logged yet</p>
                  <p className="text-[10px]">Your presence during live lectures and daily sign-ins will be logged here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Subject / Course Session</th>
                        <th className="py-2.5 px-4">Batch Cohort</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Time Recorded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {attendanceHistory.slice(0, 8).map((record, i) => {
                        const statusUpper = (record.status || 'PRESENT').toUpperCase();
                        const isPresent = statusUpper === 'PRESENT';
                        const isAbsent = statusUpper === 'ABSENT';
                        const isLate = statusUpper === 'LATE';

                        const recordDateStr = record.date || (record.markedAt ? new Date(record.markedAt).toLocaleDateString() : '—');
                        const timeStr = record.markedAt ? new Date(record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

                        return (
                          <tr key={record.id || i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {recordDateStr}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                              {record.courseName || 'Lecture Session'}
                            </td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {record.batchName || 'General Batch'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {isPresent && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200">
                                  <Check size={11} /> Present
                                </span>
                              )}
                              {isAbsent && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200">
                                  <X size={11} /> Absent
                                </span>
                              )}
                              {isLate && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200">
                                  Late
                                </span>
                              )}
                              {!isPresent && !isAbsent && !isLate && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600">
                                  {statusUpper}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-400 font-mono text-[11px] whitespace-nowrap">
                              {timeStr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/attendance"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  View Full Attendance History Log <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* ENROLLED COURSES & CURRICULUM ACCESS                                      */}
            {/* ========================================================================= */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    My Enrolled Courses &amp; Curriculum
                  </h2>
                </div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {enrolledCourses.length} Enrolled
                </span>
              </div>

              {enrolledCourses.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <BookOpen size={36} className="mx-auto opacity-30" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No active course enrollments</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    You are not enrolled in any training batches. Contact academic counseling or administration to get assigned to a course cohort.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enrolledCourses.map(item => {
                    const course = item.course || {};
                    const batch = item.batch || {};
                    const lmsStats = item.lmsStats || {};
                    const courseId = course._id || item.courseId;

                    return (
                      <div 
                        key={item.enrollmentId || courseId}
                        className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-400 transition"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-900 text-indigo-600 border border-slate-200 dark:border-slate-700">
                              {course.courseCode || 'COURSE'}
                            </span>
                            <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                              {item.status || 'ACTIVE'}
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">
                            {course.courseName || 'Enrolled Course'}
                          </h4>

                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            {course.shortDescription || course.description || 'Access course video lectures, downloadable PDFs, and module lessons.'}
                          </p>

                          {/* Progress metric */}
                          <div className="space-y-1 pt-2">
                            <div className="flex justify-between text-[11px] font-bold text-slate-500">
                              <span>Lessons Completed</span>
                              <span className="text-indigo-600 dark:text-indigo-400">
                                {lmsStats.completedLessons || 0} / {lmsStats.totalPublishedLessons || 0}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-indigo-600 h-full rounded-full transition-all"
                                style={{
                                  width: `${lmsStats.totalPublishedLessons > 0 
                                    ? Math.round(((lmsStats.completedLessons || 0) / lmsStats.totalPublishedLessons) * 100) 
                                    : 0}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/academy/learning/${courseId}`)}
                            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <span>Open LMS Lessons</span>
                            <ArrowRight size={13} />
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSyllabusModalCourse(course)}
                              className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] hover:border-indigo-400 transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <FileText size={12} />
                              <span>View Syllabus</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadCoursePdf(courseId, course.courseName)}
                              disabled={downloadingCourseId === courseId}
                              className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] border border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-100 transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {downloadingCourseId === courseId ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Download size={12} />
                              )}
                              <span>Download PDF</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* ========================================================================= */}
            {/* COURSE SYLLABUS & CURRICULUM SPECIFICATIONS SECTION                       */}
            {/* ========================================================================= */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      Course Syllabus &amp; Curriculum Specifications
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Official modular curriculum, chapter milestones, and certified multi-page PDF downloads for your enrolled courses.
                  </p>
                </div>

                <Link
                  to="/academy/syllabus"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition shrink-0"
                >
                  <Eye size={13} />
                  <span>Interactive Syllabus Explorer</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {enrolledCourses.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <FileText size={36} className="mx-auto opacity-30" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No syllabus is available for your course yet.</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Once enrolled into an active training cohort, your official curriculum specifications and downloadable syllabus will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {enrolledCourses.map(item => {
                    const course = item.course || {};
                    const syllabusList = course.syllabus || [];
                    const courseId = course._id || item.courseId;

                    return (
                      <div
                        key={`syl-${courseId}`}
                        className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between hover:border-indigo-400 transition"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-900 text-indigo-600 border border-slate-200 dark:border-slate-700">
                              {course.courseCode || 'COURSE'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {syllabusList.length} Modules Total
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {course.courseName}
                          </h4>

                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {course.description || course.shortDescription || 'Modular curriculum covering core technical competencies, workshops, and project milestones.'}
                          </p>

                          {syllabusList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {syllabusList.slice(0, 3).map((mod, i) => (
                                <span
                                  key={mod.moduleId || i}
                                  className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800 truncate max-w-[200px]"
                                >
                                  {mod.title}
                                </span>
                              ))}
                              {syllabusList.length > 3 && (
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg">
                                  +{syllabusList.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSyllabusModalCourse(course)}
                            className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:border-indigo-400 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Eye size={13} />
                            <span>View Syllabus</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadCoursePdf(courseId, course.courseName)}
                            disabled={downloadingCourseId === courseId}
                            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            {downloadingCourseId === courseId ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Download size={13} />
                            )}
                            <span>Download PDF</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW ASSIGNMENT DETAILS                                          */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {detailsModalAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-600 border border-indigo-200 dark:border-indigo-800 mb-1 inline-block">
                    {detailsModalAssignment.courseId?.courseName || 'Course Assignment'}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {detailsModalAssignment.title}
                  </h3>
                </div>
                <button
                  onClick={() => setDetailsModalAssignment(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Assignment Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                <div>
                  <span className="text-slate-400 block font-medium">Due Date</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {detailsModalAssignment.dueDate ? new Date(detailsModalAssignment.dueDate).toLocaleDateString() : 'No Deadline'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Maximum Score</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {detailsModalAssignment.maxMarks || 100} points
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Assigned On</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {detailsModalAssignment.createdAt ? new Date(detailsModalAssignment.createdAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Status</span>
                  <span className="font-bold text-indigo-600 uppercase">
                    {detailsModalAssignment.computedStatus}
                  </span>
                </div>
              </div>

              {/* Instructions & Description */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Instructions &amp; Description
                </h4>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 whitespace-pre-line">
                  {detailsModalAssignment.instructions || detailsModalAssignment.description || 'No detailed instructions provided.'}
                </div>
              </div>

              {/* Attachments if any */}
              {detailsModalAssignment.attachmentUrl && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Reference Attachment
                  </h4>
                  <a
                    href={detailsModalAssignment.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800/60 hover:underline"
                  >
                    <ExternalLink size={13} /> View Attached File
                  </a>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDetailsModalAssignment(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                >
                  Close
                </button>
                {(detailsModalAssignment.computedStatus === 'PENDING' || detailsModalAssignment.computedStatus === 'OVERDUE') && !isViewingOtherStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      const cur = detailsModalAssignment;
                      setDetailsModalAssignment(null);
                      setSubmitModalAssignment(cur);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload size={13} /> Submit Solution Now
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: SUBMIT ASSIGNMENT SOLUTION                                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {submitModalAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Submit Assignment Solution
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                    {submitModalAssignment.title}
                  </p>
                </div>
                <button
                  onClick={() => setSubmitModalAssignment(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Submission Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Submission Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'FILE', label: 'File Upload (PDF/Image)' },
                    { key: 'TEXT', label: 'Text / Code Answer' },
                    { key: 'LINK', label: 'External URL (GitHub/Drive)' }
                  ].map(mode => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setSubmissionType(mode.key)}
                      className={`p-3 rounded-2xl border text-xs font-bold transition text-center cursor-pointer ${
                        submissionType === mode.key
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handlePerformSubmit} className="space-y-5">
                {/* File Upload Mode */}
                {submissionType === 'FILE' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Choose Solution Document (Max 10MB)
                    </label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-indigo-400 transition cursor-pointer relative bg-slate-50 dark:bg-slate-800/30">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        accept=".pdf,.jpg,.jpeg,.png,.zip,.doc,.docx"
                      />
                      <Upload className="mx-auto text-slate-400 mb-2" size={28} />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {selectedFile ? selectedFile.name : 'Click or drag file here to upload'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Allowed: PDF, JPG, PNG, DOC, DOCX, ZIP up to 10MB
                      </p>
                    </div>
                  </div>
                )}

                {/* Text Answer Mode */}
                {submissionType === 'TEXT' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Write or Paste Your Solution
                    </label>
                    <textarea
                      rows={6}
                      value={submissionText}
                      onChange={e => setSubmissionText(e.target.value)}
                      placeholder="Type your detailed solution, code snippets, or explanation..."
                      required
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                )}

                {/* External Link Mode */}
                {submissionType === 'LINK' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Project Link (GitHub, Google Drive, Figma)
                    </label>
                    <input
                      type="url"
                      value={submissionLink}
                      onChange={e => setSubmissionLink(e.target.value)}
                      placeholder="https://github.com/username/project"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {fileError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} /> {fileError}
                  </div>
                )}

                {/* Form Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSubmitModalAssignment(null)}
                    disabled={submittingSolution}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSolution || (submissionType === 'FILE' && !selectedFile)}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    {submittingSolution ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    <span>{submittingSolution ? 'Submitting...' : 'Submit Solution'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW EXISTING SUBMISSION & FEEDBACK                              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {viewSubmissionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Submission Details
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submitted on {viewSubmissionModal.submittedAt ? new Date(viewSubmissionModal.submittedAt).toLocaleString() : '—'}
                  </p>
                </div>
                <button
                  onClick={() => setViewSubmissionModal(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status and Score */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                <div>
                  <span className="text-slate-400 block font-medium">Evaluation Status</span>
                  <span className="font-bold text-indigo-600 uppercase">
                    {viewSubmissionModal.status || 'SUBMITTED'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Awarded Score</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">
                    {viewSubmissionModal.grade !== null && viewSubmissionModal.grade !== undefined 
                      ? `${viewSubmissionModal.grade} / ${viewSubmissionModal.maxMarks || 100} pts` 
                      : 'Pending Evaluation'}
                  </span>
                </div>
              </div>

              {/* Submitted Content */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Your Submitted Work
                </h4>
                {viewSubmissionModal.fileUrl && (
                  <a
                    href={viewSubmissionModal.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800/60 hover:underline"
                  >
                    <ExternalLink size={13} /> View Submitted Document ({viewSubmissionModal.fileMetadata?.originalName || 'Download File'})
                  </a>
                )}
                {viewSubmissionModal.textAnswer && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 font-mono whitespace-pre-wrap">
                    {viewSubmissionModal.textAnswer}
                  </div>
                )}
                {viewSubmissionModal.externalUrl && (
                  <a
                    href={viewSubmissionModal.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 text-xs font-bold border border-sky-200 dark:border-sky-800/60 hover:underline"
                  >
                    <ExternalLink size={13} /> Open Project Link: {viewSubmissionModal.externalUrl}
                  </a>
                )}
              </div>

              {/* Mentor Feedback if Graded */}
              {viewSubmissionModal.feedback && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Instructor Evaluation Feedback
                  </h4>
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 italic">
                    &ldquo;{viewSubmissionModal.feedback}&rdquo;
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewSubmissionModal(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: VIEW COURSE SYLLABUS DETAILS                                     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {syllabusModalCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      {syllabusModalCourse.courseCode || 'SYLLABUS'}
                    </span>
                    {syllabusModalCourse.level && (
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        &bull; {syllabusModalCourse.level}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {syllabusModalCourse.courseName || syllabusModalCourse.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {syllabusModalCourse.description || syllabusModalCourse.shortDescription || 'Official Course Curriculum & Topic Milestones'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSyllabusModalCourse(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body (Scrollable) */}
              <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-xs">
                {/* Curriculum Summary Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Modules</span>
                    <span className="font-black text-slate-800 dark:text-slate-200 text-sm">
                      {(syllabusModalCourse.syllabus || []).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Duration</span>
                    <span className="font-black text-slate-800 dark:text-slate-200 text-sm">
                      {syllabusModalCourse.duration || 'Self-Paced'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Category</span>
                    <span className="font-black text-slate-800 dark:text-slate-200 text-sm">
                      {syllabusModalCourse.category || 'General'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Official PDF</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      Available
                    </span>
                  </div>
                </div>

                {/* Modules breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    Curriculum Modules ({(syllabusModalCourse.syllabus || []).length})
                  </h4>

                  {(!syllabusModalCourse.syllabus || syllabusModalCourse.syllabus.length === 0) ? (
                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-400">
                      <FileText size={28} className="mx-auto opacity-30 mb-2" />
                      <p className="font-bold text-slate-700 dark:text-slate-300">Detailed modules are being finalized for this course.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        You can download the generated multi-page curriculum PDF or open the Interactive Syllabus Explorer.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {syllabusModalCourse.syllabus.map((mod, modIdx) => (
                        <div
                          key={mod.moduleId || modIdx}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0">
                                {modIdx + 1}
                              </span>
                              <h5 className="font-bold text-slate-900 dark:text-white">
                                {mod.title}
                              </h5>
                            </div>
                            {mod.duration && (
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                {mod.duration}
                              </span>
                            )}
                          </div>

                          {mod.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-7">
                              {mod.description}
                            </p>
                          )}

                          {Array.isArray(mod.topics) && mod.topics.length > 0 && (
                            <div className="pl-7 pt-1 flex flex-wrap gap-1.5">
                              {mod.topics.map((t, tIdx) => (
                                <span
                                  key={t.topicId || tIdx}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[10px] font-medium"
                                >
                                  <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                                  <span>{t.title}</span>
                                  {t.duration && <span className="text-slate-400 font-mono">({t.duration})</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-5 sm:px-7 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <Link
                  to={`/academy/syllabus?courseId=${syllabusModalCourse._id || syllabusModalCourse.id}`}
                  onClick={() => setSyllabusModalCourse(null)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <Eye size={13} />
                  <span>Open Interactive Explorer</span>
                </Link>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setSyllabusModalCourse(null)}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCoursePdf(syllabusModalCourse._id || syllabusModalCourse.id, syllabusModalCourse.courseName)}
                    disabled={downloadingCourseId === (syllabusModalCourse._id || syllabusModalCourse.id)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {downloadingCourseId === (syllabusModalCourse._id || syllabusModalCourse.id) ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    <span>Download Official PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default StudentDashboard;
