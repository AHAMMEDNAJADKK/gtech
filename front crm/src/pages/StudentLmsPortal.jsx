import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BookOpen, GraduationCap, Clock, CheckCircle2, Award, ArrowRight, 
  Sparkles, Loader2, AlertCircle, BarChart3, PlayCircle, FolderKanban
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL;

const StudentLmsPortal = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchEnrolledCourses = useCallback(async () => {
    setLoading(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/student/enrolled-courses`
        : `${cleanBase}/v1/academy/student/enrolled-courses`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (!res.ok) throw new Error('Unable to fetch enrolled courses.');

      const data = await res.json();
      const courseList = Array.isArray(data.data) ? data.data : (Array.isArray(data.courses) ? data.courses : []);
      setEnrolledCourses(courseList);
    } catch (err) {
      console.error("Fetch Student Courses Error:", err);
      showToast("Unable to load enrolled courses.", "error");
    } finally {
      setLoading(false);
    }
  }, [getHeaders, showToast]);

  useEffect(() => {
    fetchEnrolledCourses();
  }, [fetchEnrolledCourses]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="animate-spin text-indigo-500" size={44} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Loading Student Learning Portal...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen text-slate-600 dark:text-slate-200 font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-10 space-y-8">
        
        {/* Banner Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-xs relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                <GraduationCap size={14} /> My LMS Student Portal
              </div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                My Enrolled Courses & Curriculum
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl font-medium leading-relaxed">
                Access video lectures, downloadable PDFs, text lessons, assignment submissions, and track your course completion metrics.
              </p>
            </div>
            
            <div className="flex items-center gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
              <BarChart3 size={32} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400">Total Enrolled Courses</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{enrolledCourses.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Student Quick Navigation Hub */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Live Classes", desc: "Join Google Meet / Zoom", path: "/live-classes", icon: PlayCircle, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
            { label: "My Assignments", desc: "Submissions & marks", path: "/assignments", icon: CheckCircle2, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
            { label: "My Attendance", desc: "Attendance records", path: "/student-attendance", icon: Clock, color: "text-teal-600 bg-teal-50 dark:bg-teal-950/40" },
            { label: "Fee Accounts", desc: "Installments & receipts", path: "/accounts", icon: Sparkles, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
            { label: "Certificates", desc: "Graduation awards", path: "/certificates", icon: Award, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
          ].map(hub => {
            const HIcon = hub.icon;
            return (
              <button
                key={hub.label}
                onClick={() => navigate(hub.path)}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition text-left group cursor-pointer flex items-center gap-3.5"
              >
                <div className={`p-2.5 rounded-xl ${hub.color} group-hover:scale-110 transition-transform`}>
                  <HIcon size={20} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 transition">
                    {hub.label}
                  </p>
                  <p className="text-[10px] text-slate-400">{hub.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Enrolled Courses Cards Grid */}
        {enrolledCourses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-16 rounded-[2.5rem] text-center space-y-4">
            <BookOpen className="mx-auto text-slate-400 opacity-40" size={48} />
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
              You are not enrolled in any courses yet.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
              Please contact your administrator or academic counselor to get assigned to an active course batch.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {enrolledCourses.map(item => {
              const course = item.course || {};
              const batch = item.batch || {};
              const lmsStats = item.lmsStats || {};
              const courseId = course._id || item.courseId;

              return (
                <div 
                  key={item.enrollmentId || courseId}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-7 space-y-6 flex flex-col justify-between hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-950 text-indigo-600 border border-slate-200 dark:border-slate-800">
                        {course.courseCode || 'COURSE'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {item.status || 'ACTIVE'}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                        {course.courseName}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 font-medium leading-relaxed">
                        {course.shortDescription || course.description || 'No description available for this course.'}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>Course Completion</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{item.progressPercentage || 0}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-500"
                          style={{ width: `${item.progressPercentage || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Metrics */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                        <p className="text-[9px] font-black uppercase text-slate-400">Lessons Completed</p>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                          {lmsStats.completedLessons || 0} / {lmsStats.totalPublishedLessons || 0}
                        </p>
                      </div>

                      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                        <p className="text-[9px] font-black uppercase text-slate-400">Average Grade</p>
                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                          {lmsStats.averageGradePercent || 0}%
                        </p>
                      </div>
                    </div>

                    {batch.batchName && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 pt-1">
                        <FolderKanban size={14} className="text-indigo-500" />
                        <span>Batch: <strong className="text-slate-700 dark:text-slate-300">{batch.batchName} ({batch.batchCode})</strong></span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (!courseId || courseId === 'undefined' || courseId === 'null') {
                        showToast("Course identifier is missing for this enrollment.", "warning");
                        return;
                      }
                      navigate(`/academy/learning/${courseId}`);
                    }}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 group-hover:translate-x-0.5"
                  >
                    <PlayCircle size={16} /> Continue Learning <ArrowRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentLmsPortal;
