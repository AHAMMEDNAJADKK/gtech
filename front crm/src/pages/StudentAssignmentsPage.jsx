import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, Clock, Calendar, FileText, Upload, Download, 
  ExternalLink, AlertCircle, Search, Filter, Loader2, X, RotateCcw, 
  ChevronRight, Award, Eye, Trash2, ArrowUpRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const StudentAssignmentsPage = () => {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Submit Modal state
  const [activeSubmitAssignment, setActiveSubmitAssignment] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // View Details Modal state
  const [detailsAssignment, setDetailsAssignment] = useState(null);

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

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/academy/assignments`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load assignments.');
      const data = await res.json();
      setAssignments(data.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, showToast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Calculate countdown to due date
  const getCountdownString = (dueDate) => {
    if (!dueDate) return { label: 'No deadline', isPast: false };
    const diffMs = new Date(dueDate).getTime() - Date.now();
    if (diffMs <= 0) return { label: 'Overdue / Closed', isPast: true };

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    if (days > 0) return { label: `${days}d ${remHours}h remaining`, isPast: false };
    return { label: `${remHours}h remaining`, isPast: false };
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be 10MB or less.', 'error');
      return;
    }

    // Check format
    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(ext)) {
      showToast('Allowed formats: PDF, JPG, JPEG, PNG.', 'error');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview('');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview('');
  };

  const handleSubmitSolution = async (e) => {
    e.preventDefault();
    if (!activeSubmitAssignment) return;

    setUploading(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      let fileUrl = '';
      let fileMetadata = {};

      // 1. Upload file if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const rawToken = localStorage.getItem('token');
        const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';

        const uploadRes = await fetch(`${base}/academy/lms/upload`, {
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
      const submitPayload = {
        submissionType: selectedFile ? 'FILE' : (externalUrl ? 'LINK' : 'TEXT'),
        fileUrl,
        fileMetadata,
        textAnswer,
        externalUrl
      };

      const res = await fetch(`${base}/academy/assignments/${activeSubmitAssignment._id}/submit`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(submitPayload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || resData.message || 'Submission failed.');

      showToast('Assignment submitted successfully!', 'success');
      setActiveSubmitAssignment(null);
      setSelectedFile(null);
      setTextAnswer('');
      setExternalUrl('');
      fetchAssignments();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTranscript = (assignment, sub) => {
    try {
      const doc = new jsPDF();
      const max = assignment.maxMarks || 100;
      const numGrade = parseFloat(sub.grade || 0);
      const pct = max > 0 ? ((numGrade / max) * 100).toFixed(1) : 0;

      // Header Banner
      doc.setFillColor(15, 23, 42); // dark navy
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('EDTECH MANAGEMENT SYSTEM', 14, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text('STUDENT ACADEMIC GRADE TRANSCRIPT', 14, 26);

      // Metadata Table
      autoTable(doc, {
        startY: 44,
        head: [['Academic Property', 'Details']],
        body: [
          ['Student Name', user.name || 'Candidate'],
          ['Student Identifier', user.studentId || user.employeeId || 'N/A'],
          ['Course Name', assignment.courseId?.courseName || 'Certified Program'],
          ['Assignment Title', assignment.title],
          ['Due Date', assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : 'N/A'],
          ['Submission Date', sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'],
          ['Submission Status', (sub.status || 'GRADED').replace(/_/g, ' ')],
          ['Late Submission', sub.isLate ? 'YES' : 'NO'],
          ['Evaluator / Mentor', sub.gradedBy?.name || 'Academic Faculty'],
          ['Report Generation Date', new Date().toLocaleDateString()]
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
      doc.text('FINAL OBTAINED MARKS', 20, finalY + 10);

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
      doc.text('EVALUATION FEEDBACK', 14, feedbackY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const feedbackText = sub.feedback || 'Good attempt on assignment tasks.';
      const splitFeedback = doc.splitTextToSize(feedbackText, 182);
      doc.text(splitFeedback, 14, feedbackY + 8);

      doc.save(`Student_Evaluation_${assignment.title}.pdf`);
      showToast('Transcript downloaded successfully!', 'success');
    } catch (err) {
      showToast('Transcript generation failed: ' + err.message, 'error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'GRADED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> Graded
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
            <Clock size={12} /> Submitted
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5">
            <Eye size={12} /> Under Review
          </span>
        );
      case 'RESUBMISSION_REQUIRED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
            <RotateCcw size={12} /> Resubmission Required
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            <AlertCircle size={12} /> Not Started
          </span>
        );
    }
  };

  const filteredAssignments = assignments.filter(a => {
    const term = searchQuery.toLowerCase();
    const titleMatch = a.title?.toLowerCase().includes(term);
    const courseMatch = a.courseId?.courseName?.toLowerCase().includes(term);

    const subStatus = a.submissionStatus || 'NOT_STARTED';
    const statusMatch = statusFilter === 'ALL' || subStatus === statusFilter;

    return (titleMatch || courseMatch) && statusMatch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-2">
            <Award size={14} /> My Learning Portfolio
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            My Course Assignments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access assigned practicals, upload PDF/image solutions, track evaluation status, and review mentor feedback.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 w-52"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="GRADED">Graded</option>
            <option value="RESUBMISSION_REQUIRED">Resubmission Required</option>
          </select>
        </div>
      </div>

      {/* Main Grid List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-600" />
          <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Loading Assignments...</span>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-700" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Assignments Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No assignments matched your search criteria.'
              : 'You do not have any published assignments right now. Keep up the good work!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((assignment) => {
            const sub = assignment.mySubmission;
            const subStatus = assignment.submissionStatus || 'NOT_STARTED';
            const countdown = getCountdownString(assignment.dueDate);
            const canSubmit = subStatus === 'NOT_STARTED' || subStatus === 'RESUBMISSION_REQUIRED';

            return (
              <div 
                key={assignment._id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between hover:border-indigo-500/40 transition-all hover:shadow-lg hover:shadow-indigo-500/5 group"
              >
                <div>
                  {/* Status & Deadline Row */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    {getStatusBadge(subStatus)}
                    <span className={`text-[11px] font-bold ${countdown.isPast ? 'text-rose-500' : 'text-slate-400'}`}>
                      {countdown.label}
                    </span>
                  </div>

                  {/* Title & Course */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {assignment.title}
                  </h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                    {assignment.courseId?.courseName || 'Course'}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3">
                    {assignment.description || assignment.instructions || 'Review assignment specifications and submit solution.'}
                  </p>

                  {/* Resubmission alert */}
                  {subStatus === 'RESUBMISSION_REQUIRED' && sub?.resubmissionReason && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                      <strong>Correction Instructions:</strong> {sub.resubmissionReason}
                    </div>
                  )}

                  {/* Graded Marks card */}
                  {subStatus === 'GRADED' && sub?.grade !== null && (
                    <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Awarded Score</div>
                        <div className="text-lg font-black text-emerald-950 dark:text-emerald-100 font-mono">
                          {sub.grade} / {assignment.maxMarks}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadTranscript(assignment, sub)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                      >
                        <Download size={12} /> Transcript
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Metadata & Actions */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Max Marks: <strong>{assignment.maxMarks}</strong></span>
                    <span>Due: <strong>{assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'Open'}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetailsAssignment(assignment)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Eye size={13} /> View Details
                    </button>

                    {canSubmit && (
                      <button
                        onClick={() => {
                          setActiveSubmitAssignment(assignment);
                          setSelectedFile(null);
                          setTextAnswer('');
                          setExternalUrl('');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-md shadow-indigo-600/20 transition-all"
                      >
                        <Upload size={13} />
                        <span>{subStatus === 'RESUBMISSION_REQUIRED' ? 'Resubmit' : 'Submit Task'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUBMISSION MODAL */}
      <AnimatePresence>
        {activeSubmitAssignment && (
          <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Submit Solution: {activeSubmitAssignment.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Course: {activeSubmitAssignment.courseId?.courseName} (Max: {activeSubmitAssignment.maxMarks} marks)
                  </p>
                </div>
                <button
                  onClick={() => setActiveSubmitAssignment(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitSolution} className="p-6 space-y-5">
                {/* File Upload Box */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Upload Solution (PDF, JPG, PNG - Max 10MB)
                  </label>

                  {selectedFile ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText size={24} className="text-indigo-600" />
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {selectedFile.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-950/50">
                      <Upload size={28} className="text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Click or drag PDF / Image file here
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">
                        Supported: .pdf, .jpg, .jpeg, .png (Max 10MB)
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* External Link or GitHub URL */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Project Link / Repository (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Text Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Submission Notes / Text Answer
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add any notes or context regarding your submission..."
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Footer Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveSubmitAssignment(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || (!selectedFile && !textAnswer && !externalUrl)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    {uploading ? 'Uploading...' : 'Confirm Submission'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILS MODAL */}
      <AnimatePresence>
        {detailsAssignment && (
          <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {detailsAssignment.title}
                </h3>
                <button onClick={() => setDetailsAssignment(null)} className="p-1.5 text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Description</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                    {detailsAssignment.description || 'No description provided.'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Instructions</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                    {detailsAssignment.instructions || 'Follow project rubric and submit working deliverables.'}
                  </p>
                </div>

                {detailsAssignment.attachmentUrl && (
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Reference Material</span>
                    <div className="mt-1">
                      <a
                        href={detailsAssignment.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-xs hover:underline"
                      >
                        <Download size={13} /> Download Assignment Material
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setDetailsAssignment(null)}
                  className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentAssignmentsPage;
