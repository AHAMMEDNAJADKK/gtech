import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Award, FileText, ExternalLink, Download, Loader2, AlertCircle, FileCheck, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL;

const GradeSubmissionModal = ({ submission, assignment, onClose, onGraded }) => {
  const { showToast } = useToast();
  const [grade, setGrade] = useState(submission?.grade !== null && submission?.grade !== undefined ? submission.grade : '');
  const [feedback, setFeedback] = useState(submission?.feedback || '');
  const [status, setStatus] = useState(submission?.status || 'GRADED');
  const [resubmissionReason, setResubmissionReason] = useState(submission?.resubmissionReason || '');
  const [submitting, setSubmitting] = useState(false);

  const getHeaders = () => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  };

  const calculateGradeLetter = (marks, max) => {
    if (!marks || !max) return 'N/A';
    const pct = (marks / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return 'F';
  };

  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF();
      const student = submission?.studentId || {};
      const max = assignment?.maxMarks || submission?.maxMarks || 100;
      const numGrade = parseFloat(grade !== '' ? grade : submission?.grade || 0);
      const pct = max > 0 ? ((numGrade / max) * 100).toFixed(1) : 0;
      const letter = calculateGradeLetter(numGrade, max);

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
        head: [['Academic Record Property', 'Details']],
        body: [
          ['Student Full Name', student.name || 'Student Candidate'],
          ['Student Identifier', student.studentId || student.employeeId || 'N/A'],
          ['Email Address', student.email || 'N/A'],
          ['Course Program', assignment?.courseId?.courseName || 'Certified Technical Program'],
          ['Batch ID / Code', assignment?.batchId?.batchName || assignment?.batchId?.batchCode || 'General Batch'],
          ['Assignment Title', assignment?.title || 'Academic Assignment'],
          ['Submission Date', submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'],
          ['Submission Status', (status || submission?.status || 'GRADED').replace(/_/g, ' ')],
          ['Late Submission Indicator', submission?.isLate ? 'YES (Submitted after deadline)' : 'NO (On-Time)'],
          ['Evaluation Date', new Date().toLocaleDateString()]
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
      doc.text('FINAL EVALUATION MARKS & RATING', 20, finalY + 10);

      doc.setFontSize(16);
      doc.setTextColor(79, 70, 229);
      doc.text(`${numGrade} / ${max}`, 20, finalY + 24);

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`Percentage: ${pct}%`, 85, finalY + 24);
      doc.text(`Grade Rating: ${letter}`, 140, finalY + 24);

      // Feedback Section
      const feedbackY = finalY + 44;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('INSTRUCTOR FEEDBACK & RECOMMENDATIONS', 14, feedbackY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const feedbackText = feedback || submission?.feedback || 'Satisfactory academic submission fulfilling project specifications.';
      const splitFeedback = doc.splitTextToSize(feedbackText, 182);
      doc.text(splitFeedback, 14, feedbackY + 8);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('This is a computer-verified evaluation transcript issued by EdTech CRM.', 14, 280);

      doc.save(`Grading_Report_${student.name || 'Student'}_${assignment?.title || 'Assignment'}.pdf`);
      showToast('Evaluation PDF report generated and downloaded!', 'success');
    } catch (err) {
      showToast('Failed to generate PDF report: ' + err.message, 'error');
    }
  };

  const handleGradeSubmit = async (e) => {
    e.preventDefault();
    const numGrade = status === 'RESUBMISSION_REQUIRED' ? 0 : parseFloat(grade);
    const max = assignment?.maxMarks || submission?.maxMarks || 100;

    if (status !== 'RESUBMISSION_REQUIRED') {
      if (isNaN(numGrade) || numGrade < 0 || numGrade > max) {
        showToast(`Grade must be a number between 0 and ${max}.`, 'error');
        return;
      }
    } else {
      if (!resubmissionReason.trim()) {
        showToast('Please provide a reason or instructions for resubmission.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1') 
        ? `${cleanBase}/academy/submissions/${submission._id}/grade`
        : `${cleanBase}/v1/academy/submissions/${submission._id}/grade`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          grade: numGrade,
          feedback: feedback.trim(),
          status,
          resubmissionReason: resubmissionReason.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || 'Failed to grade submission.');

      showToast(
        status === 'RESUBMISSION_REQUIRED' ? 'Resubmission requested from student.' : 'Submission evaluated successfully!',
        'success'
      );
      if (onGraded) onGraded(data.data);
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const student = submission?.studentId || {};
  const maxMarks = assignment?.maxMarks || submission?.maxMarks || 100;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative my-auto w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Award size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Evaluate Student Submission
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {student.name || 'Student'} ({student.studentId || student.email || 'N/A'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleGradeSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Submission Preview Card */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Submitted Format: <strong className="text-slate-700 dark:text-slate-200 uppercase">{submission.submissionType}</strong></span>
              <span>Submitted At: {new Date(submission.submittedAt).toLocaleString()}</span>
            </div>

            {submission.submissionType === 'FILE' && submission.fileUrl && (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-xs">
                  {submission.fileMetadata?.originalName || 'Submitted Assignment File'}
                </span>
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <Download size={14} /> Open File
                </a>
              </div>
            )}

            {submission.submissionType === 'LINK' && submission.externalUrl && (
              <a
                href={submission.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <ExternalLink size={14} /> {submission.externalUrl}
              </a>
            )}

            {submission.textAnswer && (
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {submission.textAnswer}
              </div>
            )}
          </div>

          {/* Grade & Status Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Grade Score (Max {maxMarks}) {status !== 'RESUBMISSION_REQUIRED' && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={maxMarks}
                  disabled={status === 'RESUBMISSION_REQUIRED'}
                  value={status === 'RESUBMISSION_REQUIRED' ? '' : grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder={status === 'RESUBMISSION_REQUIRED' ? 'N/A (Resubmission Requested)' : `0 - ${maxMarks}`}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  required={status !== 'RESUBMISSION_REQUIRED'}
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">/ {maxMarks}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Evaluation Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="GRADED">GRADED (Publish Marks)</option>
                <option value="RESUBMISSION_REQUIRED">RESUBMISSION REQUIRED (Request Fixes)</option>
                <option value="UNDER_REVIEW">UNDER REVIEW (Draft Evaluation)</option>
                <option value="RETURNED">RETURNED</option>
              </select>
            </div>
          </div>

          {/* Conditional Resubmission Reason Input */}
          {status === 'RESUBMISSION_REQUIRED' && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <RotateCcw size={14} /> Resubmission Reason & Correction Instructions <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={resubmissionReason}
                onChange={(e) => setResubmissionReason(e.target.value)}
                placeholder="Explain clearly what corrections the student must make before resubmitting..."
                className="w-full bg-white dark:bg-slate-950 border border-amber-500/40 p-3 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          )}

          {/* Feedback Textarea */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Instructor Feedback & Recommendations
            </label>
            <textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide constructive feedback for the student..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download size={15} />
              <span>Download PDF Transcript</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-2 text-white ${
                  status === 'RESUBMISSION_REQUIRED'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                }`}
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : status === 'RESUBMISSION_REQUIRED' ? (
                  <RotateCcw size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {status === 'RESUBMISSION_REQUIRED' ? 'Request Resubmission' : 'Save Evaluation'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
};

export default GradeSubmissionModal;
