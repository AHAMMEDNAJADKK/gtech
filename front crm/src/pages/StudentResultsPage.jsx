import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Award, CheckCircle2, Clock, Calendar, Download, FileText, 
  ExternalLink, Loader2, Search, ArrowUpRight, BookOpen, Layers
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const StudentResultsPage = () => {
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const user = useMemo(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchMySubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/academy/my-submissions`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load submissions and results.');
      const data = await res.json();
      setSubmissions(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err.message || 'Failed to load submissions and results.');
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, showToast]);

  useEffect(() => {
    fetchMySubmissions();
  }, [fetchMySubmissions]);

  const gradedList = useMemo(() => {
    return submissions.filter(s => s.status === 'GRADED' && s.grade !== null && s.grade !== undefined);
  }, [submissions]);

  // Overall performance calculations
  const performanceStats = useMemo(() => {
    if (gradedList.length === 0) {
      return { totalGraded: 0, avgPercentage: 0, highestScore: 0, overallGrade: 'N/A' };
    }

    let totalEarned = 0;
    let totalMax = 0;
    let highest = 0;

    gradedList.forEach(s => {
      const earned = parseFloat(s.grade) || 0;
      const max = parseFloat(s.maxMarks) || 100;
      totalEarned += earned;
      totalMax += max;
      const pct = max > 0 ? (earned / max) * 100 : 0;
      if (pct > highest) highest = pct;
    });

    const avg = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
    let gradeLetter = 'F';
    if (avg >= 90) gradeLetter = 'A+';
    else if (avg >= 80) gradeLetter = 'A';
    else if (avg >= 70) gradeLetter = 'B+';
    else if (avg >= 60) gradeLetter = 'B';
    else if (avg >= 50) gradeLetter = 'C';

    return {
      totalGraded: gradedList.length,
      avgPercentage: avg.toFixed(1),
      highestScore: highest.toFixed(1),
      overallGrade: gradeLetter
    };
  }, [gradedList]);

  const handleDownloadTranscript = (sub) => {
    try {
      const doc = new jsPDF();
      const assignment = sub.assignmentId || {};
      const max = sub.maxMarks || assignment.maxMarks || 100;
      const numGrade = parseFloat(sub.grade || 0);
      const pct = max > 0 ? ((numGrade / max) * 100).toFixed(1) : 0;

      // Header Banner
      doc.setFillColor(15, 23, 42); // dark navy
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('EDTECH CRM ACADEMY', 14, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text('OFFICIAL ACADEMIC EVALUATION & GRADING TRANSCRIPT', 14, 26);

      // Metadata Table
      autoTable(doc, {
        startY: 44,
        head: [['Property', 'Record Details']],
        body: [
          ['Student Name', user.name || 'Candidate'],
          ['Student ID', user.studentId || user.employeeId || 'N/A'],
          ['Course Name', sub.courseId?.courseName || 'Technical Curriculum'],
          ['Batch Name', sub.batchId?.batchName || 'Default Batch'],
          ['Assignment Title', assignment.title || 'Task Deliverable'],
          ['Submission Date', sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'],
          ['Late Submission Indicator', sub.isLate ? 'YES' : 'NO'],
          ['Evaluator / Mentor', sub.gradedBy?.name || 'Assigned Faculty'],
          ['Evaluation Date', sub.gradedAt ? new Date(sub.gradedAt).toLocaleDateString() : new Date().toLocaleDateString()]
        ],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 }
      });

      // Grade Summary Box
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, finalY, 182, 34, 3, 3, 'FD');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('PUBLISHED MARKS & STANDING', 20, finalY + 10);

      doc.setFontSize(16);
      doc.setTextColor(79, 70, 229);
      doc.text(`${numGrade} / ${max}`, 20, finalY + 24);

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`Percentage: ${pct}%`, 90, finalY + 24);

      // Feedback Section
      const feedbackY = finalY + 44;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('MENTOR FEEDBACK & REMARKS', 14, feedbackY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const feedbackText = sub.feedback || 'Good work meeting project expectations.';
      const splitFeedback = doc.splitTextToSize(feedbackText, 182);
      doc.text(splitFeedback, 14, feedbackY + 8);

      doc.save(`Official_Result_${assignment.title || 'Assignment'}.pdf`);
      showToast('Official result PDF transcript downloaded!', 'success');
    } catch (err) {
      showToast('Failed to download transcript: ' + err.message, 'error');
    }
  };

  const filteredSubmissions = submissions.filter(s => {
    const term = searchQuery.toLowerCase();
    const titleMatch = s.assignmentId?.title?.toLowerCase().includes(term);
    const courseMatch = s.courseId?.courseName?.toLowerCase().includes(term);
    return titleMatch || courseMatch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-2">
            <Award size={14} /> Academic Performance
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            My Results & Performance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Official marks transcripts, grading metrics, and mentor evaluations for completed coursework.
          </p>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search completed tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 w-56"
          />
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50 rounded-2xl p-5">
          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Overall Grade</span>
          <div className="text-3xl font-black text-indigo-950 dark:text-indigo-100 mt-1 font-mono">
            {performanceStats.overallGrade}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Calculated Average</div>
        </div>

        <div className="bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-2xl p-5">
          <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Average Score</span>
          <div className="text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1 font-mono">
            {performanceStats.avgPercentage}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Cumulative Marks %</div>
        </div>

        <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/50 rounded-2xl p-5">
          <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Graded Tasks</span>
          <div className="text-3xl font-black text-blue-950 dark:text-blue-100 mt-1 font-mono">
            {performanceStats.totalGraded}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Published Evaluations</div>
        </div>

        <div className="bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/50 rounded-2xl p-5">
          <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider">Peak Score</span>
          <div className="text-3xl font-black text-purple-950 dark:text-purple-100 mt-1 font-mono">
            {performanceStats.highestScore}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Best Achievement</div>
        </div>
      </div>

      {/* Main Results Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Published Evaluations & Transcripts
        </h3>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto mb-2" />
            <span className="text-xs text-slate-400">Loading results...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-xs text-rose-500 font-medium">{error}</p>
            <button
              onClick={fetchMySubmissions}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Retry Loading
            </button>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No assignment evaluations or submissions found. Submissions and grades will appear here as mentors evaluate your work.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Assignment & Course</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Score Obtained</th>
                  <th className="py-3 px-4">Mentor Feedback</th>
                  <th className="py-3 px-4 text-right">Official Transcript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSubmissions.map((sub) => {
                  const assignment = sub.assignmentId || {};
                  const isGraded = sub.status === 'GRADED' && sub.grade !== null;

                  return (
                    <tr key={sub._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {assignment.title || 'Assignment Task'}
                        </div>
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                          {sub.courseId?.courseName || 'Course'}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A'}
                        {sub.isLate && (
                          <span className="block text-[10px] text-rose-500 font-bold">Late</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          sub.status === 'GRADED'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : sub.status === 'SUBMITTED'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                            : sub.status === 'RESUBMISSION_REQUIRED'
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {(sub.status || 'SUBMITTED').replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        {isGraded ? (
                          <div className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                            {sub.grade} <span className="text-xs text-slate-400">/ {sub.maxMarks || assignment.maxMarks || 100}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Pending Evaluation</span>
                        )}
                      </td>

                      <td className="py-4 px-4 max-w-xs">
                        <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                          {sub.feedback || (sub.status === 'RESUBMISSION_REQUIRED' ? sub.resubmissionReason : 'No written feedback yet.')}
                        </p>
                      </td>

                      <td className="py-4 px-4 text-right">
                        {isGraded ? (
                          <button
                            onClick={() => handleDownloadTranscript(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all"
                          >
                            <Download size={13} /> Download PDF
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Transcript not issued</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentResultsPage;
