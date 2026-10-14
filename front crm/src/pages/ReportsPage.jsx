import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, FileSpreadsheet, Download, Calendar, Users, 
  CheckCircle2, Clock, AlertCircle, Award, RefreshCw, 
  BookOpen, Layers, Search, Filter, ArrowUpRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const ReportsPage = () => {
  const { showToast } = useToast();
  const [selectedReportType, setSelectedReportType] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  });

  const user = useMemo(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  const userRole = (user.role || '').toLowerCase();
  const userRoleId = String(user.role_id || '');
  const isSuperAdmin = Boolean(user.isSuperAdmin || userRole === 'superadmin' || userRoleId === '0');
  const isHr = Boolean(userRole === 'hr' || userRoleId === '2');
  const isMentor = Boolean(
    userRole === 'mentor' || 
    userRole === 'instructor' || 
    userRoleId === '3' || 
    (user.designation || '').toLowerCase().includes('mentor') ||
    (user.designation || '').toLowerCase().includes('faculty')
  );
  const isStudent = Boolean(userRole === 'student' || userRoleId === '10');

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;

      if (selectedReportType === 'attendance') {
        const endpoint = (isSuperAdmin || isHr)
          ? `${base}/attendance/summary?date=${dateFilter}`
          : `${base}/attendance/my-history?limit=50`;
        const res = await fetch(endpoint, { headers: getHeaders() });
        const data = await res.json();
        setReportData(data.records || data.data || []);
      } else if (selectedReportType === 'assignments') {
        const endpoint = (isSuperAdmin || isHr || isMentor)
          ? `${base}/academy/assignments`
          : `${base}/academy/assignments`;
        const res = await fetch(endpoint, { headers: getHeaders() });
        const data = await res.json();
        setReportData(data.data || []);
      } else if (selectedReportType === 'grading') {
        const endpoint = (isSuperAdmin || isHr || isMentor)
          ? `${base}/academy/grading/submissions`
          : `${base}/academy/my-submissions`;
        const res = await fetch(endpoint, { headers: getHeaders() });
        const data = await res.json();
        setReportData(data.data || []);
      } else if (selectedReportType === 'students') {
        const res = await fetch(`${base}/users?role=student&limit=100`, { headers: getHeaders() });
        const data = await res.json();
        setReportData(data.data || []);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedReportType, dateFilter, getHeaders, isSuperAdmin, isHr, isMentor, showToast]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const exportToExcel = () => {
    try {
      if (reportData.length === 0) {
        showToast('No records available to export.', 'error');
        return;
      }

      const flatData = reportData.map(item => {
        if (selectedReportType === 'attendance') {
          const emp = typeof item.user_id === 'object' ? item.user_id : {};
          return {
            Date: item.date,
            EmployeeName: emp.name || user.name || 'Member',
            EmployeeEmail: emp.email || user.email || 'N/A',
            Role: emp.role || user.role || 'Staff',
            CheckIn: item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString() : 'N/A',
            CheckOut: item.check_out_time ? new Date(item.check_out_time).toLocaleTimeString() : 'N/A',
            WorkingHours: item.working_hours || '0.00',
            Overtime: item.overtime || '0.00',
            Status: item.status || 'PRESENT'
          };
        } else if (selectedReportType === 'assignments') {
          return {
            AssignmentTitle: item.title,
            Course: item.courseId?.courseName || 'N/A',
            Batch: item.batchId?.batchName || 'N/A',
            MaxMarks: item.maxMarks,
            DueDate: item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Open',
            Status: item.status || (item.isPublished ? 'PUBLISHED' : 'DRAFT'),
            CreatedBy: item.createdBy?.name || 'Academic Staff'
          };
        } else if (selectedReportType === 'grading') {
          return {
            Assignment: item.assignmentId?.title || 'Task',
            Student: item.studentId?.name || user.name || 'Student',
            StudentId: item.studentId?.studentId || user.studentId || 'N/A',
            Course: item.courseId?.courseName || 'N/A',
            SubmissionDate: item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'N/A',
            Status: item.status,
            Marks: item.grade !== null ? item.grade : 'Pending',
            MaxMarks: item.maxMarks || item.assignmentId?.maxMarks || 100,
            Feedback: item.feedback || item.resubmissionReason || 'N/A'
          };
        } else {
          return {
            StudentName: item.name,
            StudentId: item.studentId || item.employeeId || 'N/A',
            Email: item.email,
            Phone: item.phone,
            Status: item.status,
            CoursePreference: item.coursePreference || 'N/A',
            EnrolledBatchesCount: item.enrolledBatches?.length || 0
          };
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(flatData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report_Data');
      XLSX.writeFile(workbook, `EdTech_Report_${selectedReportType}_${Date.now()}.xlsx`);
      showToast('Report spreadsheet exported successfully!', 'success');
    } catch (err) {
      showToast('Failed to export Excel report: ' + err.message, 'error');
    }
  };

  const filteredData = reportData.filter(item => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    const str = JSON.stringify(item).toLowerCase();
    return str.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-2">
            <BarChart3 size={14} /> Analytics & Audit Reports
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Academic & Operations Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time reporting across attendance logs, assignment completion, evaluation queues, and student metrics.
          </p>
        </div>

        <button
          onClick={exportToExcel}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer self-start md:self-auto"
        >
          <FileSpreadsheet size={16} />
          <span>Export Excel / CSV</span>
        </button>
      </div>

      {/* Report Type Selector Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedReportType('attendance')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            selectedReportType === 'attendance'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          Attendance Summary
        </button>

        <button
          onClick={() => setSelectedReportType('assignments')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            selectedReportType === 'assignments'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          Assignment Completion
        </button>

        <button
          onClick={() => setSelectedReportType('grading')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            selectedReportType === 'grading'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          Evaluations & Grades
        </button>

        {(isSuperAdmin || isHr) && (
          <button
            onClick={() => setSelectedReportType('students')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              selectedReportType === 'students'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Student Directory Report
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search report entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 w-60"
          />
        </div>

        {selectedReportType === 'attendance' && (isSuperAdmin || isHr) && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw size={28} className="animate-spin text-indigo-600 mx-auto mb-2" />
            <span className="text-xs text-slate-400">Compiling report data...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            No report data found matching current query parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                {selectedReportType === 'attendance' && (
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Person</th>
                    <th className="py-3 px-4">Check-in</th>
                    <th className="py-3 px-4">Check-out</th>
                    <th className="py-3 px-4">Working Hours</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                )}
                {selectedReportType === 'assignments' && (
                  <tr>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Course & Batch</th>
                    <th className="py-3 px-4">Max Marks</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Publication Status</th>
                  </tr>
                )}
                {selectedReportType === 'grading' && (
                  <tr>
                    <th className="py-3 px-4">Assignment</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Submitted</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Feedback</th>
                  </tr>
                )}
                {selectedReportType === 'students' && (
                  <tr>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Course Preference</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.map((item, index) => (
                  <tr key={item._id || item.id || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    {selectedReportType === 'attendance' && (
                      <>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">{item.date}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {typeof item.user_id === 'object' ? item.user_id?.name : user.name || 'Member'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {typeof item.user_id === 'object' ? item.user_id?.email : user.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString() : '--:--'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {item.check_out_time ? new Date(item.check_out_time).toLocaleTimeString() : '--:--'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.working_hours || '0.00'} hrs
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                            {item.status || 'PRESENT'}
                          </span>
                        </td>
                      </>
                    )}

                    {selectedReportType === 'assignments' && (
                      <>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{item.title}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-indigo-600 dark:text-indigo-400">{item.courseId?.courseName || 'Course'}</div>
                          <div className="text-[10px] text-slate-400">{item.batchId?.batchName || 'General Batch'}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{item.maxMarks}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Open'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.isPublished ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                          }`}>
                            {item.isPublished ? 'PUBLISHED' : 'DRAFT'}
                          </span>
                        </td>
                      </>
                    )}

                    {selectedReportType === 'grading' && (
                      <>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          {item.assignmentId?.title || 'Assignment Task'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{item.studentId?.name || user.name || 'Student'}</div>
                          <div className="text-[10px] text-slate-400">{item.studentId?.studentId || user.studentId || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.grade !== null ? item.grade : '--'} / {item.maxMarks || item.assignmentId?.maxMarks || 100}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-500">
                          {item.feedback || item.resubmissionReason || 'N/A'}
                        </td>
                      </>
                    )}

                    {selectedReportType === 'students' && (
                      <>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{item.name}</td>
                        <td className="py-3.5 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.studentId || item.employeeId || 'N/A'}</td>
                        <td className="py-3.5 px-4">
                          <div>{item.email}</div>
                          <div className="text-[10px] text-slate-400">{item.phone}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{item.coursePreference || 'General'}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                            {item.status || 'Active'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
