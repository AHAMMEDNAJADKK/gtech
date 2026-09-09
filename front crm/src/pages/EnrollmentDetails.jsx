import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, GraduationCap, BookOpen, Users, CheckCircle2, BarChart3, 
  Clock, AlertCircle, Loader2, Calendar, ShieldCheck, UserCheck, Percent,
  X, Check, Sparkles
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL;

const EnrollmentDetails = () => {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Progress Update Form State
  const [completedModulesInput, setCompletedModulesInput] = useState(0);
  const [totalModulesInput, setTotalModulesInput] = useState(10);
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchEnrollmentDetails = useCallback(async () => {
    if (!enrollmentId || enrollmentId === 'undefined' || enrollmentId === 'null') {
      setLoading(false);
      setEnrollment(null);
      return;
    }
    setLoading(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/enrollments/${enrollmentId}`
        : `${cleanBase}/v1/academy/enrollments/${enrollmentId}`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Enrollment record not found.');
      }

      const data = await res.json();
      const enObj = data.data || null;
      setEnrollment(enObj);
      if (enObj) {
        setCompletedModulesInput(enObj.completedModules || 0);
        setTotalModulesInput(enObj.totalModules || 10);
      }
    } catch (err) {
      console.error("Fetch Enrollment Details Error:", err);
      showToast(err.message || "Unable to load enrollment details.", "error");
      setEnrollment(null);
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, getHeaders, showToast]);

  useEffect(() => {
    fetchEnrollmentDetails();
  }, [fetchEnrollmentDetails]);

  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    setIsSubmittingProgress(true);

    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/enrollments/${enrollmentId}/progress`
        : `${cleanBase}/v1/academy/enrollments/${enrollmentId}/progress`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          completedModules: completedModulesInput,
          totalModules: totalModulesInput
        })
      });

      if (res.ok) {
        fetchEnrollmentDetails();
        showToast("Course progress updated successfully!", "success");
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || errData.error || "Failed to update progress.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    setIsSubmittingStatus(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/enrollments/${enrollmentId}/status`
        : `${cleanBase}/v1/academy/enrollments/${enrollmentId}/status`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        fetchEnrollmentDetails();
        showToast(`Enrollment status updated to '${newStatus}'.`, "success");
      } else {
        showToast("Failed to update status.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="animate-spin text-indigo-500" size={44} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Loading Enrollment Details...</p>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="bg-white dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center p-8">
        <AlertCircle className="text-rose-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 uppercase">Enrollment Not Found</h2>
        <button
          onClick={() => navigate('/academy/enrollments')}
          className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
        >
          Return to Enrollment Tracking Directory
        </button>
      </div>
    );
  }

  const student = enrollment.studentId || {};
  const course = enrollment.courseId || {};
  const batch = enrollment.batchId || {};
  const att = enrollment.attendanceSummary || {};
  const attRecords = Array.isArray(att.records) ? att.records : [];

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen text-slate-600 dark:text-slate-200 font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-12 space-y-10">
        
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-sm space-y-6">
          <button
            onClick={() => navigate('/academy/enrollments')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 rounded-2xl transition-all text-xs font-black uppercase tracking-widest cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Enrollments
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                  {student.studentId || 'STU'}
                </span>
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Course: {course.courseName || 'Course'}
                </span>
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Batch: {batch.batchName || 'Batch'}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{student.name || 'Student Account'}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Enrolled On: <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(enrollment.enrolledAt).toLocaleDateString()}</span>
              </p>
            </div>

            {/* Status Switcher */}
            <div className="flex items-center gap-3 self-center bg-white dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 pl-2">Status:</span>
              <select
                value={enrollment.status}
                disabled={isSubmittingStatus}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
              >
                <option value="active" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">Active</option>
                <option value="paused" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">Paused</option>
                <option value="completed" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">Completed</option>
                <option value="dropped" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">Dropped</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dual Progress & Attendance Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 1. Interactive Course Progress Tracker Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">Course Progress Tracker</h2>
                </div>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {enrollment.progressPercentage}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full h-4 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-500" 
                    style={{ width: `${enrollment.progressPercentage}%` }} 
                  />
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Completed: {enrollment.completedModules} Modules</span>
                  <span>Total Curriculum: {enrollment.totalModules} Modules</span>
                </div>
              </div>
            </div>

            {/* Form to adjust progress */}
            <form onSubmit={handleUpdateProgress} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Adjust Curriculum Completion</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Completed Modules</label>
                  <input
                    type="number"
                    min="0"
                    max={totalModulesInput}
                    value={completedModulesInput}
                    onChange={(e) => setCompletedModulesInput(Math.min(totalModulesInput, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Total Curriculum Modules</label>
                  <input
                    type="number"
                    min="1"
                    value={totalModulesInput}
                    onChange={(e) => setTotalModulesInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingProgress}
                className="w-full bg-indigo-700 hover:bg-indigo-600 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                {isSubmittingProgress ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Update Progress Percentage
              </button>
            </form>
          </div>

          {/* 2. Attendance Integration Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserCheck className="text-emerald-600 dark:text-emerald-400" size={24} />
                  <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">Attendance History Summary</h2>
                </div>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {att.attendancePercentage}%
                </span>
              </div>

              {/* Attendance Bar */}
              <div className="space-y-2">
                <div className="w-full h-4 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                    style={{ width: `${att.attendancePercentage}%` }} 
                  />
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Present: {att.presentCount} Sessions</span>
                  <span>Total Marked: {att.totalSessions} Sessions</span>
                </div>
              </div>
            </div>

            {/* Detailed Metric Pills */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400">Present</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{att.presentCount}</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400">Absent</p>
                <p className="text-xl font-black text-rose-600 dark:text-rose-400">{att.absentCount}</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400">Late</p>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400">{att.lateCount}</p>
              </div>
            </div>
          </div>

        </div>

        {/* 3. LMS Academic Performance Summary Card */}
        {enrollment.lmsSummary && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <GraduationCap className="text-indigo-600 dark:text-indigo-400" size={24} />
                <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  LMS Academic & Assignment Metrics
                </h2>
              </div>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Module 4.4 LMS Integration
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                <p className="text-[9px] font-black uppercase text-slate-400">Completed Lessons</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {enrollment.lmsSummary.completedLessonsCount || 0} / {enrollment.lmsSummary.totalPublishedLessons || 0}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                <p className="text-[9px] font-black uppercase text-slate-400">Course Assignments</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {enrollment.lmsSummary.totalAssignments || 0} Total
                </p>
              </div>

              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                <p className="text-[9px] font-black uppercase text-slate-400">Submitted Assignments</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {enrollment.lmsSummary.submittedAssignmentsCount || 0} Submissions
                </p>
              </div>

              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                <p className="text-[9px] font-black uppercase text-slate-400">Average Grade</p>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {enrollment.lmsSummary.averageGradePercentage || 0}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Attendance Records Table from Student Attendance Registry */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Student Attendance Register Logs ({attRecords.length})
            </h2>
            <span className="text-xs font-bold text-slate-400">Sourced from Student Attendance Registry</span>
          </div>

          {attRecords.length === 0 ? (
            <p className="text-center py-10 text-xs text-slate-400 font-medium">
              No attendance records logged for this student yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Session Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Attendance Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attRecords.map((r, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {r.date}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          r.status?.toUpperCase() === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' :
                          r.status?.toUpperCase() === 'LATE' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-rose-500/10 text-rose-500'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnrollmentDetails;
