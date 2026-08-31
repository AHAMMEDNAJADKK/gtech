import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, FolderKanban, BookOpen, User, Users, Plus, Edit, 
  Trash2, ShieldCheck, CheckCircle2, AlertCircle, Loader2, X, Search,
  UserCheck, UserMinus, Eye
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL;

const BatchDetails = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registeredStudents, setRegisteredStudents] = useState([]);

  // Add Students Modal State
  const [isAddStudentsModalOpen, setIsAddStudentsModalOpen] = useState(false);
  const [selectedStudentIdsToAdd, setSelectedStudentIdsToAdd] = useState([]);
  const [studentSearchText, setStudentSearchText] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Remove Student Confirmation State
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Delete Batch Confirmation State
  const [isDeleteBatchModalOpen, setIsDeleteBatchModalOpen] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchBatchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/batches/${batchId}`
        : `${cleanBase}/v1/academy/batches/${batchId}`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (!res.ok) throw new Error('Batch record not found.');

      const data = await res.json();
      setBatch(data.data || null);
    } catch (err) {
      console.error("Fetch Batch Details Error:", err);
      showToast("Unable to load batch overview.", "error");
    } finally {
      setLoading(false);
    }
  }, [batchId, getHeaders, showToast]);

  const fetchRegisteredStudents = useCallback(async () => {
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/users?role=student&limit=500`
        : `${cleanBase}/v1/users?role=student&limit=500`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const studentUsers = data?.users || data?.data?.users || data?.data || [];
        setRegisteredStudents(studentUsers);
      }
    } catch (err) {
      console.error("Fetch Registered Students Error:", err);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchBatchDetails();
    fetchRegisteredStudents();
  }, [fetchBatchDetails, fetchRegisteredStudents]);

  const handleOpenAddStudentsModal = () => {
    setSelectedStudentIdsToAdd([]);
    setStudentSearchText('');
    setIsAddStudentsModalOpen(true);
  };

  const handleToggleAddStudent = (stId) => {
    setSelectedStudentIdsToAdd(prev => {
      if (prev.includes(stId)) {
        return prev.filter(id => id !== stId);
      }
      return [...prev, stId];
    });
  };

  const handleSubmitAddStudents = async (e) => {
    e.preventDefault();
    if (selectedStudentIdsToAdd.length === 0) {
      showToast('Please select at least one student to add.', 'warning');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/batches/${batchId}/students`
        : `${cleanBase}/v1/academy/batches/${batchId}/students`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ studentIds: selectedStudentIdsToAdd })
      });

      if (res.ok) {
        setIsAddStudentsModalOpen(false);
        fetchBatchDetails();
        showToast("Registered students added to batch successfully!", "success");
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || "Failed to add students to batch.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleConfirmRemoveStudent = (student) => {
    setStudentToRemove(student);
    setIsRemoveModalOpen(true);
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    setIsRemoving(true);
    try {
      const studentId = studentToRemove._id || studentToRemove.id;
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/batches/${batchId}/students/${studentId}`
        : `${cleanBase}/v1/academy/batches/${batchId}/students/${studentId}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (res.ok) {
        showToast("Student removed from batch successfully.", "success");
        setIsRemoveModalOpen(false);
        setStudentToRemove(null);
        fetchBatchDetails();
      } else {
        showToast("Failed to remove student from batch.", "error");
      }
    } catch (err) {
      showToast("Network error while removing student.", "error");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleDeleteBatch = () => {
    setIsDeleteBatchModalOpen(true);
  };

  const confirmDeleteBatch = async () => {
    setIsDeletingBatch(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/batches/${batchId}`
        : `${cleanBase}/v1/academy/batches/${batchId}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getHeaders()
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showToast(data.message || 'Batch deleted successfully!', 'success');
        navigate('/academy/batches');
      } else {
        showToast(data.message || 'Failed to delete batch.', 'error');
      }
    } catch (err) {
      showToast('Network error while deleting batch.', 'error');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="animate-spin text-indigo-500" size={44} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Loading Batch Details...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="bg-white dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center p-8">
        <AlertCircle className="text-rose-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 uppercase">Batch Not Found</h2>
        <button
          onClick={() => navigate('/academy/batches')}
          className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
        >
          Return to Batches List
        </button>
      </div>
    );
  }

  const course = batch.courseId || {};
  const enrolledStudents = Array.isArray(batch.students) ? batch.students : [];
  const enrolledIdsSet = new Set(enrolledStudents.map(s => String(s._id || s.id || s)));

  // Available students for adding (excluding already enrolled students)
  const availableStudentsToAdd = registeredStudents.filter(s => {
    const sId = String(s._id || s.id);
    if (enrolledIdsSet.has(sId)) return false;

    const query = studentSearchText.toLowerCase();
    const name = (s.name || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    const phone = (s.phone || '').toLowerCase();
    const stId = (s.studentId || '').toLowerCase();
    return name.includes(query) || email.includes(query) || phone.includes(query) || stId.includes(query);
  });

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen text-slate-600 dark:text-slate-200 font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-12 space-y-10">
        
        {/* Top Overview Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => navigate('/academy/batches')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 rounded-2xl transition-all text-xs font-black uppercase tracking-widest cursor-pointer"
            >
              <ArrowLeft size={16} /> Back to Batches
            </button>
            <button
              onClick={handleDeleteBatch}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-2xl transition-all text-xs font-black uppercase tracking-widest cursor-pointer"
              title="Delete Batch"
            >
              <Trash2 size={16} /> Delete Batch
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                  {batch.batchCode}
                </span>
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Course: {course.courseName || 'Course'}
                </span>
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-sm">
                  {batch.status}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{batch.batchName}</h1>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl text-center">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Enrolled Students</p>
                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{enrolledStudents.length}</p>
              </div>
              <button
                onClick={handleOpenAddStudentsModal}
                className="bg-indigo-700 hover:bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2 self-center"
              >
                <Plus size={16} /> Add Students to Batch
              </button>
            </div>
          </div>
        </div>

        {/* Registered Students Enrolled Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Users className="text-indigo-600 dark:text-indigo-400" size={24} />
              <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Enrolled Registered Students
              </h2>
            </div>
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800/40 uppercase tracking-widest">
              {enrolledStudents.length} Students Allocated
            </span>
          </div>

          {enrolledStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium space-y-3">
              <Users className="mx-auto opacity-40" size={40} />
              <p className="text-xs">No registered students currently allocated to this batch.</p>
              <button
                onClick={handleOpenAddStudentsModal}
                className="bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> Allocate Registered Students
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student ID & Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact Email</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Course Preference</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map(student => {
                    const stId = student._id || student.id;

                    return (
                      <tr key={stId} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            {student.profile_image ? (
                              <img src={student.profile_image} alt={student.name} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800/40">
                                {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                              </div>
                            )}
                            <div>
                              <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 block">
                                {student.studentId || 'STU'}
                              </span>
                              <p className="text-slate-900 dark:text-slate-100 font-bold text-sm uppercase tracking-tight">
                                {student.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {student.email || 'N/A'}
                        </td>
                        <td className="px-6 py-5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {student.phone || 'N/A'}
                        </td>
                        <td className="px-6 py-5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {student.coursePreference || 'N/A'}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => navigate('/student-attendance')}
                              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-xl transition-all cursor-pointer"
                              title="View Student Profile in Attendance Registry"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => handleConfirmRemoveStudent(student)}
                              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 text-slate-600 dark:text-slate-300 hover:text-rose-500 rounded-xl transition-all cursor-pointer"
                              title="Remove Student from Batch Relation"
                            >
                              <UserMinus size={15} />
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
        </div>
      </div>

      {/* Add Registered Students Modal */}
      {createPortal(
        <AnimatePresence>
          {isAddStudentsModalOpen && (
            <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-950">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    Add <span className="text-indigo-600">Registered Students</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Select students from Student Attendance registry to add to '{batch.batchName}'
                  </p>
                </div>
                <button
                  onClick={() => setIsAddStudentsModalOpen(false)}
                  className="p-4 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </header>

              <form onSubmit={handleSubmitAddStudents} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search registered students by name, email or student ID..."
                    value={studentSearchText}
                    onChange={(e) => setStudentSearchText(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none"
                  />
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl max-h-64 overflow-y-auto p-2 bg-white dark:bg-slate-950 space-y-1">
                  {availableStudentsToAdd.length === 0 ? (
                    <p className="text-center py-8 text-xs text-slate-400 font-medium">
                      No additional registered students available to add.
                    </p>
                  ) : (
                    availableStudentsToAdd.map(student => {
                      const stId = student._id || student.id;
                      const isChecked = selectedStudentIdsToAdd.includes(stId);

                      return (
                        <div
                          key={stId}
                          onClick={() => handleToggleAddStudent(stId)}
                          className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked 
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                                {student.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                {student.studentId || 'STU'} • {student.email} • {student.phone}
                              </p>
                            </div>
                          </div>
                          {isChecked && (
                            <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddStudentsModalOpen(false)}
                    className="px-6 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdd || selectedStudentIdsToAdd.length === 0}
                    className="bg-indigo-700 hover:bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {isSubmittingAdd ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    Add Selected Students ({selectedStudentIdsToAdd.length})
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Remove Student Confirmation Modal */}
      {createPortal(
        <AnimatePresence>
          {isRemoveModalOpen && studentToRemove && (
            <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] text-center space-y-5 overflow-y-auto"
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
                <UserMinus size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  Remove Student from Batch?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-slate-100">{studentToRemove.name}</span> from '{batch.batchName}'?
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Note: This only removes the batch assignment relation. The student's registration profile and attendance records will remain unaffected.
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsRemoveModalOpen(false)}
                  className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveStudent}
                  disabled={isRemoving}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-md shadow-rose-600/20"
                >
                  {isRemoving ? <Loader2 className="animate-spin" size={14} /> : 'Remove'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Delete Batch Confirmation Modal */}
      {createPortal(
        <AnimatePresence>
          {isDeleteBatchModalOpen && batch && (
            <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto"
            >
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                Delete Batch?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                Are you sure you want to permanently delete batch <strong className="text-slate-800 dark:text-slate-200">{batch.batchName}</strong> ({batch.batchCode})? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsDeleteBatchModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBatch}
                  disabled={isDeletingBatch}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer"
                >
                  {isDeletingBatch ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>{isDeletingBatch ? 'Deleting...' : 'Delete Batch'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
};

export default BatchDetails;
