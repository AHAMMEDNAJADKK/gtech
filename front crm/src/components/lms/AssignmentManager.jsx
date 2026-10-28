import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit, Trash2, Award, Calendar, CheckCircle2, 
  AlertCircle, Loader2, X, Users, Eye, FileText,
  Search, Check, UserCheck
} from 'lucide-react';
import { useToast } from '../ToastProvider';
import GradeSubmissionModal from './GradeSubmissionModal';

const API_BASE = import.meta.env.VITE_API_URL;

const initialAssignmentForm = {
  title: '',
  description: '',
  instructions: '',
  maxMarks: 100,
  dueDate: '',
  allowedSubmissionTypes: ['FILE', 'TEXT'],
  isPublished: true,
  moduleId: '',
  targetType: 'ALL', // 'ALL' | 'BATCH' | 'STUDENTS'
  batchId: '',
  targetStudents: [] // array of student ObjectIds
};

const AssignmentManager = ({ courseId, syllabus = [] }) => {
  const { showToast } = useToast();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assignment Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [formData, setFormData] = useState(initialAssignmentForm);
  const [submitting, setSubmitting] = useState(false);

  // Enrolled Students and Batches for course
  const [courseStudents, setCourseStudents] = useState([]);
  const [courseBatches, setCourseBatches] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Submissions Modal State
  const [viewingSubmissionsAssignment, setViewingSubmissionsAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState(null);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchRecipients = useCallback(async () => {
    if (!courseId) return;
    setLoadingRecipients(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const enrollUrl = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/enrollments?courseId=${courseId}&limit=200`
        : `${cleanBase}/v1/academy/enrollments?courseId=${courseId}&limit=200`;

      const batchesUrl = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/batches?courseId=${courseId}`
        : `${cleanBase}/v1/academy/batches?courseId=${courseId}`;

      const [resEnroll, resBatches] = await Promise.all([
        fetch(enrollUrl, { headers: getHeaders() }),
        fetch(batchesUrl, { headers: getHeaders() })
      ]);

      const uniqueStudents = [];
      const seenIds = new Set();

      if (resEnroll.ok) {
        const enrollData = await resEnroll.json();
        const enrollments = enrollData.data?.enrollments || enrollData.data || [];
        enrollments
          .filter(e => e.studentId && typeof e.studentId === 'object')
          .forEach(e => {
            const st = e.studentId;
            const sId = st._id || st.id;
            if (sId && !seenIds.has(String(sId))) {
              seenIds.add(String(sId));
              uniqueStudents.push({
                id: sId,
                name: st.name || 'Unnamed Student',
                email: st.email || '',
                studentId: st.studentId || '',
                batchName: e.batchId?.batchName || 'No Batch Assigned',
                batchId: e.batchId?._id || e.batchId || ''
              });
            }
          });
      }

      if (resBatches.ok) {
        const batchesData = await resBatches.json();
        const batchList = batchesData.data?.batches || batchesData.data || [];
        setCourseBatches(batchList);

        batchList.forEach(b => {
          (b.students || []).forEach(st => {
            if (st && typeof st === 'object') {
              const sId = st._id || st.id;
              if (sId && !seenIds.has(String(sId))) {
                seenIds.add(String(sId));
                uniqueStudents.push({
                  id: sId,
                  name: st.name || 'Unnamed Student',
                  email: st.email || '',
                  studentId: st.studentId || '',
                  batchName: b.batchName || 'Assigned Batch',
                  batchId: b._id || b.id || ''
                });
              }
            }
          });
        });
      }

      setCourseStudents(uniqueStudents);
    } catch (err) {
      console.warn('Failed to fetch course recipients:', err.message);
    } finally {
      setLoadingRecipients(false);
    }
  }, [courseId, getHeaders]);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/courses/${courseId}/lms-content`
        : `${cleanBase}/v1/academy/courses/${courseId}/lms-content`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch assignments.');
      setModules(data.data?.modules || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [courseId, getHeaders, showToast]);

  useEffect(() => {
    if (courseId) {
      fetchAssignments();
      fetchRecipients();
    }
  }, [courseId, fetchAssignments, fetchRecipients]);

  const handleOpenAddModal = (targetModuleId) => {
    setEditingAssignment(null);
    setStudentSearchTerm('');
    setFormData({
      ...initialAssignmentForm,
      moduleId: targetModuleId || (syllabus[0]?.moduleId || 'mod_1')
    });
    fetchRecipients();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setStudentSearchTerm('');
    const targetStuds = (assignment.targetStudents || []).map(s => String(s._id || s));
    setFormData({
      title: assignment.title || '',
      description: assignment.description || '',
      instructions: assignment.instructions || '',
      maxMarks: assignment.maxMarks || 100,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : '',
      allowedSubmissionTypes: assignment.allowedSubmissionTypes || ['FILE', 'TEXT'],
      isPublished: assignment.isPublished !== undefined ? assignment.isPublished : true,
      moduleId: assignment.moduleId || (syllabus[0]?.moduleId || 'mod_1'),
      targetType: assignment.targetType || (assignment.batchId ? 'BATCH' : 'ALL'),
      batchId: assignment.batchId?._id || assignment.batchId || '',
      targetStudents: targetStuds
    });
    fetchRecipients();
    setIsModalOpen(true);
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Assignment title is required.', 'error');
      return;
    }

    if (formData.targetType === 'STUDENTS' && (!formData.targetStudents || formData.targetStudents.length === 0)) {
      showToast('Please select at least one student to assign this task.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      let endpoint = '';
      let method = 'POST';

      if (editingAssignment) {
        method = 'PATCH';
        endpoint = cleanBase.endsWith('/v1')
          ? `${cleanBase}/academy/assignments/${editingAssignment._id}`
          : `${cleanBase}/v1/academy/assignments/${editingAssignment._id}`;
      } else {
        method = 'POST';
        endpoint = cleanBase.endsWith('/v1')
          ? `${cleanBase}/academy/courses/${courseId}/assignments`
          : `${cleanBase}/v1/academy/courses/${courseId}/assignments`;
      }

      const res = await fetch(endpoint, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save assignment.');

      showToast(`Assignment ${editingAssignment ? 'updated' : 'created'} successfully!`, 'success');
      setIsModalOpen(false);
      fetchAssignments();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment? Student submissions will also be deleted.')) return;
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/assignments/${assignmentId}`
        : `${cleanBase}/v1/academy/assignments/${assignmentId}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete assignment.');

      showToast('Assignment deleted successfully.', 'success');
      fetchAssignments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const fetchSubmissions = async (assignment) => {
    setViewingSubmissionsAssignment(assignment);
    setLoadingSubmissions(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/assignments/${assignment._id}/submissions`
        : `${cleanBase}/v1/academy/assignments/${assignment._id}/submissions`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch student submissions.');
      setSubmissions(data.data?.submissions || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Assignments & Submissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
        <div>
          <h2 className="text-xl font-extrabold uppercase tracking-tight text-slate-900 dark:text-slate-100">
            Course Assignments & Grading Queue
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create practical tasks, set submission deadlines, and evaluate student submissions with numeric grades and feedback.
          </p>
        </div>
        <button
          onClick={() => handleOpenAddModal()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Create Assignment
        </button>
      </div>

      {/* Modules & Assignments View */}
      <div className="space-y-6">
        {modules.map((mod, modIdx) => {
          const modAssignments = mod.assignments || [];
          return (
            <div key={mod.moduleId || modIdx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                    {modIdx + 1}
                  </span>
                  <h3 className="text-base font-extrabold uppercase text-slate-900 dark:text-slate-100">
                    {mod.title}
                  </h3>
                </div>
                <button
                  onClick={() => handleOpenAddModal(mod.moduleId)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add Assignment
                </button>
              </div>

              {modAssignments.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium py-2 text-center">No assignments added to this module yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modAssignments.map(asg => (
                    <div key={asg._id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 inline-block mb-1">
                            Max {asg.maxMarks} Marks
                          </span>
                          <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                            {asg.title}
                          </h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          asg.isPublished ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {asg.isPublished ? 'PUBLISHED' : 'DRAFT'}
                        </span>
                      </div>

                      {asg.description && <p className="text-xs text-slate-500 line-clamp-2">{asg.description}</p>}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-semibold pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-indigo-500" />
                          {asg.dueDate ? `Due: ${new Date(asg.dueDate).toLocaleDateString()}` : 'No due date'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {asg.targetType === 'STUDENTS'
                            ? `👤 ${(asg.targetStudents || []).length} Student(s)`
                            : asg.batchId?.batchName
                            ? `👥 Batch: ${asg.batchId.batchName}`
                            : '👥 All Enrolled'}
                        </span>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                          onClick={() => fetchSubmissions(asg)}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Users size={14} /> Submissions Queue
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(asg)}
                          className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 cursor-pointer"
                          title="Edit Assignment"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(asg._id)}
                          className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete Assignment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / Edit Assignment Modal */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative my-auto w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <Award size={22} />
                  </div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                    {editingAssignment ? 'Edit Assignment' : 'Create Assignment'}
                  </h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitAssignment} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Assignment Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Build a RESTful API using Express & MongoDB"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Max Marks <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxMarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxMarks: parseInt(e.target.value, 10) || 100 }))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* ASSIGN TO STUDENT / BATCH SECTION */}
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Users size={14} className="text-indigo-500" /> Assign To
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Select recipient target</span>
                  </div>

                  {/* Recipient Mode Options */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, targetType: 'ALL', targetStudents: [] }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                        formData.targetType === 'ALL'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      Entire Batch
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          targetType: 'STUDENTS',
                          targetStudents: prev.targetStudents.slice(0, 1)
                        }));
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                        formData.targetType === 'STUDENTS' && (formData.targetStudents.length <= 1)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      Individual Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, targetType: 'STUDENTS' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                        formData.targetType === 'STUDENTS' && (formData.targetStudents.length > 1)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      Multiple Students
                    </button>
                  </div>

                  {/* If Entire Batch */}
                  {formData.targetType === 'ALL' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Select Specific Batch (Optional)
                      </label>
                      <select
                        value={formData.batchId || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, batchId: e.target.value }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none"
                      >
                        <option value="">All Batches & Enrolled Students in this Course</option>
                        {courseBatches.map(b => (
                          <option key={b._id} value={b._id}>
                            {b.batchName} ({b.batchCode || 'Batch'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* If Individual Student or Multiple Students */}
                  {formData.targetType === 'STUDENTS' && (
                    <div className="space-y-3">
                      {/* Search box */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={studentSearchTerm}
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          placeholder="Search enrolled students by name, ID, or email..."
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Enrolled Students Picker */}
                      {loadingRecipients ? (
                        <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 size={14} className="animate-spin" /> Loading enrolled students...
                        </div>
                      ) : courseStudents.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                          No enrolled students found for this course yet.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {courseStudents
                            .filter(s => {
                              if (!studentSearchTerm) return true;
                              const q = studentSearchTerm.toLowerCase();
                              return (
                                s.name.toLowerCase().includes(q) ||
                                s.email.toLowerCase().includes(q) ||
                                s.studentId.toLowerCase().includes(q) ||
                                s.batchName.toLowerCase().includes(q)
                              );
                            })
                            .map(st => {
                              const isSelected = formData.targetStudents.includes(st.id);
                              return (
                                <div
                                  key={st.id}
                                  onClick={() => {
                                    setFormData(prev => {
                                      const exists = prev.targetStudents.includes(st.id);
                                      return {
                                        ...prev,
                                        targetStudents: exists
                                          ? prev.targetStudents.filter(id => id !== st.id)
                                          : [...prev.targetStudents, st.id]
                                      };
                                    });
                                  }}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                      isSelected
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'border-slate-300 dark:border-slate-700'
                                    }`}>
                                      {isSelected && <Check size={12} />}
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <span>{st.name}</span>
                                        {st.studentId && (
                                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                            {st.studentId}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {st.email} • {st.batchName}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                                      Selected
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {/* Selected Summary */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          {formData.targetStudents.length === 0
                            ? '⚠️ No student selected yet'
                            : `✓ ${formData.targetStudents.length} student(s) selected`}
                        </span>
                        {formData.targetStudents.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, targetStudents: [] }))}
                            className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                          >
                            Clear Selection
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Instructions & Guidelines
                  </label>
                  <textarea
                    rows={4}
                    value={formData.instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Provide clear submission guidelines, requirements, and evaluation criteria..."
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md shadow-indigo-600/20 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    Save Assignment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Submissions Queue Modal */}
      {createPortal(
        <AnimatePresence>
          {viewingSubmissionsAssignment && (
            <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative my-auto w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                    Submissions: {viewingSubmissionsAssignment.title}
                  </h2>
                  <p className="text-xs text-slate-500">Max Marks: {viewingSubmissionsAssignment.maxMarks}</p>
                </div>
                <button onClick={() => setViewingSubmissionsAssignment(null)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {loadingSubmissions ? (
                  <div className="p-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-medium">
                    No student submissions logged for this assignment yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.map(sub => {
                      const student = sub.studentId || {};
                      return (
                        <div key={sub._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl gap-4">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                              {student.name || 'Student'}
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              ID: {student.studentId || student.email || 'N/A'} • Submitted: {new Date(sub.submittedAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              sub.status === 'GRADED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                              sub.status === 'RETURNED' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                              'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                            }`}>
                              {sub.status === 'GRADED' ? `${sub.grade} / ${sub.maxMarks}` : sub.status}
                            </span>

                            <button
                              onClick={() => setGradingSubmission(sub)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm"
                            >
                              {sub.status === 'GRADED' ? 'Edit Grade' : 'Grade Submission'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Grade Modal Trigger */}
      {gradingSubmission && (
        <GradeSubmissionModal
          submission={gradingSubmission}
          assignment={viewingSubmissionsAssignment}
          onClose={() => setGradingSubmission(null)}
          onGraded={() => {
            if (viewingSubmissionsAssignment) fetchSubmissions(viewingSubmissionsAssignment);
          }}
        />
      )}
    </div>
  );
};

export default AssignmentManager;
