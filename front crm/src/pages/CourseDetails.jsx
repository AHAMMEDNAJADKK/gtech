import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, BookOpen, Calendar, Clock, User, Users, Plus, Edit, 
  Trash2, ShieldCheck, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, 
  FolderKanban, Loader2, X, Sparkles, AlertTriangle, Layers, Award, Search
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import LmsContentManager from '../components/lms/LmsContentManager';
import AssignmentManager from '../components/lms/AssignmentManager';

const API_BASE = import.meta.env.VITE_API_URL;

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const initialBatchForm = {
  batchCode: '',
  batchName: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
  startTime: '09:00 AM',
  endTime: '11:00 AM',
  timezone: 'IST (UTC+5:30)',
  capacity: 30,
  instructorId: '',
  instructorIds: [],
  status: 'UPCOMING'
};

const CourseDetails = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState([]);
  const [expandedModules, setExpandedModules] = useState({});
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' | 'LMS_CONTENT' | 'ASSIGNMENTS'

  // Batch Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchFormData, setBatchFormData] = useState(initialBatchForm);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [isInstructorDropdownOpen, setIsInstructorDropdownOpen] = useState(false);
  const [instructorSearchText, setInstructorSearchText] = useState('');

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete Batch Modal State
  const [batchToDelete, setBatchToDelete] = useState(null);
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

  const fetchCourseDetails = useCallback(async () => {
    if (!courseId || courseId === 'undefined' || courseId === 'null' || !courseId.trim()) {
      setCourse(null);
      setLoading(false);
      showToast("Invalid or missing course identifier.", "warning");
      return;
    }
    setLoading(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/courses/${courseId}`
        : `${cleanBase}/v1/academy/courses/${courseId}`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data.message || data.error || 'Course record not found.';
        throw new Error(errorMsg);
      }

      setCourse(data.data || null);

      if (data.data?.syllabus) {
        const initialMap = {};
        data.data.syllabus.forEach((mod, idx) => {
          initialMap[mod.moduleId || idx] = true;
        });
        setExpandedModules(initialMap);
      }
    } catch (err) {
      console.error("Fetch Course Details Error:", err.message);
      showToast(err.message || "Unable to load course overview.", "error");
    } finally {
      setLoading(false);
    }
  }, [courseId, getHeaders, showToast]);

  const fetchInstructors = useCallback(async () => {
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/instructors`
        : `${cleanBase}/v1/academy/instructors`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInstructors(data.data || []);
      }
    } catch (err) {
      console.error("Fetch Instructors Error:", err);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchCourseDetails();
    fetchInstructors();
  }, [fetchCourseDetails, fetchInstructors]);

  const toggleModuleExpand = (modId) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleOpenAddBatchModal = () => {
    setEditingBatch(null);
    setBatchFormData(initialBatchForm);
    setIsBatchModalOpen(true);
  };

  const handleOpenEditBatchModal = (batch = {}) => {
    setEditingBatch(batch);
    const existingInstIds = Array.isArray(batch?.instructors) && batch.instructors.length > 0
      ? batch.instructors.map(i => i?._id || i?.id || i)
      : (batch?.instructorId?._id || batch?.instructorId ? [batch.instructorId?._id || batch.instructorId] : []);

    setBatchFormData({
      batchCode: batch?.batchCode || '',
      batchName: batch?.batchName || '',
      startDate: batch?.startDate ? new Date(batch.startDate).toISOString().split('T')[0] : '',
      endDate: batch?.endDate ? new Date(batch.endDate).toISOString().split('T')[0] : '',
      daysOfWeek: Array.isArray(batch?.daysOfWeek) ? batch.daysOfWeek : [],
      startTime: batch?.startTime || '09:00 AM',
      endTime: batch?.endTime || '11:00 AM',
      timezone: batch?.timezone || 'IST (UTC+5:30)',
      capacity: batch?.capacity || 30,
      instructorId: existingInstIds[0] || '',
      instructorIds: existingInstIds,
      status: batch?.status || 'UPCOMING'
    });
    setIsBatchModalOpen(true);
  };

  const handleToggleInstructorSelection = (instId) => {
    setBatchFormData(prev => {
      const current = prev.instructorIds || [];
      const updated = current.includes(instId)
        ? current.filter(id => id !== instId)
        : [...current, instId];
      return {
        ...prev,
        instructorIds: updated,
        instructorId: updated[0] || ''
      };
    });
  };

  const handleDayToggle = (day) => {
    setBatchFormData(prev => {
      const currentDays = prev.daysOfWeek || [];
      const updatedDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      return { ...prev, daysOfWeek: updatedDays };
    });
  };

  const handleSubmitBatch = async (e) => {
    e.preventDefault();
    setIsSubmittingBatch(true);

    if (!batchFormData.batchName.trim()) {
      showToast('Batch Name is required.', 'warning');
      setIsSubmittingBatch(false);
      return;
    }

    if (batchFormData.daysOfWeek.length === 0) {
      showToast('Please select at least one day of the week.', 'warning');
      setIsSubmittingBatch(false);
      return;
    }

    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = editingBatch
        ? `${cleanBase}/v1/academy/batches/${editingBatch._id || editingBatch.id}`
        : `${cleanBase}/v1/academy/batches`;

      const method = editingBatch ? 'PUT' : 'POST';

      const payload = {
        ...batchFormData,
        instructors: batchFormData.instructorIds || [],
        instructorId: (batchFormData.instructorIds && batchFormData.instructorIds[0]) || batchFormData.instructorId || null,
        courseId
      };

      const res = await fetch(endpoint, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsBatchModalOpen(false);
        fetchCourseDetails();
        showToast(
          editingBatch ? "Batch updated successfully!" : "New Batch scheduled successfully!",
          "success"
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || errData.detail || "Batch submission failed.", "error");
      }
    } catch (err) {
      showToast(err.message || "Network error while saving batch.", "error");
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleCancelBatch = async (batchId) => {
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const res = await fetch(`${cleanBase}/v1/academy/batches/${batchId}/cancel`, {
        method: 'POST',
        headers: getHeaders()
      });

      if (res.ok) {
        showToast("Batch status changed to CANCELLED.", "success");
        fetchCourseDetails();
      } else {
        showToast("Failed to cancel batch.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    }
  };

  const handleDeleteCourse = () => {
    const batchCount = course?.batches?.length || 0;
    if (batchCount > 0) {
      showToast(`Cannot delete '${course.courseName}'. It has ${batchCount} batch(es) assigned to it. Remove or reassign batches first.`, 'warning');
      return;
    }
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteCourse = async () => {
    setIsDeleting(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/academy/courses/${courseId}`
        : `${cleanBase}/v1/academy/courses/${courseId}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getHeaders()
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showToast(data.message || 'Course deleted successfully!', 'success');
        navigate('/academy/courses');
      } else {
        showToast(data.message || 'Failed to delete course.', 'error');
      }
    } catch (err) {
      showToast('Network error while deleting course.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteBatch = (b) => {
    setBatchToDelete(b);
    setIsDeleteBatchModalOpen(true);
  };

  const confirmDeleteBatch = async () => {
    if (!batchToDelete) return;
    setIsDeletingBatch(true);
    try {
      const batchId = batchToDelete._id || batchToDelete.id;
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
        setIsDeleteBatchModalOpen(false);
        setBatchToDelete(null);
        fetchCourseDetails();
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
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Loading Course Overview...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="bg-white dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center p-8">
        <AlertCircle className="text-rose-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 uppercase">Course Not Found</h2>
        <button
          onClick={() => navigate('/academy/courses')}
          className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
        >
          Return to Course Catalog
        </button>
      </div>
    );
  }

  const batches = course.batches || [];

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen text-slate-600 dark:text-slate-200 font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-12 space-y-10">
        
        {/* Clean Header Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => navigate('/academy/courses')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 rounded-2xl transition-all text-xs font-black uppercase tracking-widest cursor-pointer"
            >
              <ArrowLeft size={16} /> Back to Courses
            </button>
            <button
              onClick={handleDeleteCourse}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-widest cursor-pointer border ${
                batches.length > 0
                  ? 'bg-slate-100 dark:bg-slate-900/50 text-slate-300 dark:text-slate-700 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border-rose-500/20'
              }`}
              title={batches.length > 0 ? `Cannot delete course with ${batches.length} batch(es)` : "Delete Course"}
            >
              <Trash2 size={16} /> Delete Course
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                  {course.courseCode}
                </span>
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {course.category}
                </span>
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-sm">
                  {course.status}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{course.courseName}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl font-medium leading-relaxed">
                {course.description || course.shortDescription || 'No description provided.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl text-center">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Duration</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{course.durationValue} {course.durationUnit}</p>
              </div>
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl text-center">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Batches Scheduled</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{batches.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Course Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-4 px-6 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === 'OVERVIEW'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen size={16} /> Overview & Batches
          </button>
          <button
            onClick={() => setActiveTab('LMS_CONTENT')}
            className={`pb-4 px-6 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === 'LMS_CONTENT'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Layers size={16} /> Curriculum & LMS Lessons
          </button>
          <button
            onClick={() => setActiveTab('ASSIGNMENTS')}
            className={`pb-4 px-6 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === 'ASSIGNMENTS'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Award size={16} /> Assignments & Grading
          </button>
        </div>

        {/* Tab 1: Overview & Batches Grid */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Interactive Syllabus Tree */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <BookOpen className="text-indigo-600 dark:text-indigo-400" size={24} />
                    <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                      Course Syllabus & Modules
                    </h2>
                  </div>
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {course.syllabus?.length || 0} Modules Total
                  </span>
                </div>

                {!course.syllabus || course.syllabus.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-medium">
                    No syllabus modules defined for this course yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {course.syllabus.map((mod, modIdx) => {
                      const modKey = mod.moduleId || modIdx;
                      const isExpanded = expandedModules[modKey];

                      return (
                        <div key={modKey} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
                          <button
                            onClick={() => toggleModuleExpand(modKey)}
                            className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                              <span className="w-9 h-9 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                                {modIdx + 1}
                              </span>
                              <div>
                                <h3 className="text-base font-extrabold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                                  {mod.title}
                                </h3>
                                {mod.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mod.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                                {mod.topics?.length || 0} Topics
                              </span>
                              {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-6 pb-6 pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800/80">
                              {(mod.topics || []).map((top, topIdx) => (
                                <div key={top.topicId || topIdx} className="flex items-start gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                                  <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                    {topIdx + 1}
                                  </span>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                                      {top.title}
                                    </h4>
                                    {top.description && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">{top.description}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Scheduled Batches Hub */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <FolderKanban className="text-indigo-600 dark:text-indigo-400" size={24} />
                    <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                      Batches Hub
                    </h2>
                  </div>
                  <button
                    onClick={handleOpenAddBatchModal}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                    title="Schedule New Batch"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {batches.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-medium space-y-3">
                    <FolderKanban className="mx-auto opacity-40" size={36} />
                    <p className="text-xs">No batches currently scheduled for this course.</p>
                    <button
                      onClick={handleOpenAddBatchModal}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Schedule Batch
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {batches.map(b => {
                      const batchId = b._id || b.id;
                      const instructor = b.instructorId || {};
                      const isCancelled = b.status === 'CANCELLED';

                      return (
                        <div key={batchId} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 shadow-xs">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 inline-block mb-1">
                                {b.batchCode}
                              </span>
                              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                                {b.batchName}
                              </h3>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              b.status === 'UPCOMING' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                              b.status === 'ONGOING' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                              b.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                              'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}>
                              {b.status}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1.5 font-semibold">
                                <Calendar size={14} className="text-indigo-500" /> Date Range:
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1.5 font-semibold">
                                <Clock size={14} className="text-indigo-500" /> Time & Days:
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {b.startTime} - {b.endTime} ({(b.daysOfWeek || []).join(', ')})
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1.5 font-semibold">
                                <Users size={14} className="text-indigo-500" /> Max Capacity:
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {b.capacity} Seats
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-1">
                              <span className="flex items-center gap-1.5 font-semibold">
                                <User size={14} className="text-indigo-500" /> Instructor(s):
                              </span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {Array.isArray(b.instructors) && b.instructors.length > 0
                                  ? b.instructors.map(i => i.name || 'Staff').join(', ')
                                  : (instructor.name || 'Unassigned')}
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleOpenEditBatchModal(b)}
                              className="flex-1 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Edit size={12} /> Edit Batch
                            </button>
                            {!isCancelled && (
                              <button
                                onClick={() => handleCancelBatch(batchId)}
                                className="px-3 py-2.5 bg-white dark:bg-rose-950/30 text-rose-500 border border-rose-200 dark:border-rose-900/50 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer"
                                title="Cancel Batch"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteBatch(b)}
                              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-[9px] font-black uppercase transition-all cursor-pointer"
                              title="Delete Batch"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Curriculum & LMS Lessons */}
        {activeTab === 'LMS_CONTENT' && (
          <LmsContentManager
            courseId={courseId}
            syllabus={course.syllabus || []}
            onContentUpdated={fetchCourseDetails}
          />
        )}

        {/* Tab 3: Assignments & Grading */}
        {activeTab === 'ASSIGNMENTS' && (
          <AssignmentManager
            courseId={courseId}
            syllabus={course.syllabus || []}
          />
        )}
      </div>

      {/* Schedule / Edit Batch Modal */}
      {createPortal(
        <AnimatePresence>
          {isBatchModalOpen && (
            <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-950">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    {editingBatch ? 'Edit' : 'Schedule'} <span className="text-indigo-600">Batch</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
                    Course Batch Configuration Node
                  </p>
                </div>
                <button
                  onClick={() => setIsBatchModalOpen(false)}
                  className="p-4 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </header>

              <form onSubmit={handleSubmitBatch} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Code (Auto-generated if blank)</label>
                    <input
                      type="text"
                      placeholder="e.g. BTC-2026-000001"
                      value={batchFormData.batchCode}
                      onChange={(e) => setBatchFormData({ ...batchFormData, batchCode: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. MERN 2026 Morning Batch"
                      value={batchFormData.batchName}
                      onChange={(e) => setBatchFormData({ ...batchFormData, batchName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date *</label>
                    <input
                      required
                      type="date"
                      value={batchFormData.startDate}
                      onChange={(e) => setBatchFormData({ ...batchFormData, startDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date *</label>
                    <input
                      required
                      type="date"
                      value={batchFormData.endDate}
                      onChange={(e) => setBatchFormData({ ...batchFormData, endDate: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Days of Week Selection */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Schedule Days of Week *</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => {
                      const isSelected = (batchFormData.daysOfWeek || []).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(day)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isSelected 
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                              : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 09:00 AM"
                      value={batchFormData.startTime}
                      onChange={(e) => setBatchFormData({ ...batchFormData, startTime: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 11:00 AM"
                      value={batchFormData.endTime}
                      onChange={(e) => setBatchFormData({ ...batchFormData, endTime: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Capacity (Max Students)</label>
                    <input
                      type="number"
                      min="1"
                      value={batchFormData.capacity}
                      onChange={(e) => setBatchFormData({ ...batchFormData, capacity: parseInt(e.target.value, 10) || 30 })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Assigned Instructors Multi-Select Dropdown */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Assigned Instructors ({(batchFormData.instructorIds || []).length} Selected)
                    </label>
                    {instructors.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if ((batchFormData.instructorIds || []).length === instructors.length) {
                            setBatchFormData(prev => ({ ...prev, instructorIds: [], instructorId: '' }));
                          } else {
                            const allIds = instructors.map(i => i._id || i.id);
                            setBatchFormData(prev => ({ ...prev, instructorIds: allIds, instructorId: allIds[0] || '' }));
                          }
                        }}
                        className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-wider cursor-pointer"
                      >
                        {(batchFormData.instructorIds || []).length === instructors.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  {/* Selected Instructor Chips */}
                  {(batchFormData.instructorIds || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-h-24 overflow-y-auto">
                      {(batchFormData.instructorIds || []).map(instId => {
                        const instObj = instructors.find(i => String(i._id || i.id) === String(instId));
                        const instName = instObj ? instObj.name : `Instructor ${instId}`;
                        return (
                          <span 
                            key={instId}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-xs"
                          >
                            <User size={12} />
                            {instName}
                            <button
                              type="button"
                              onClick={() => handleToggleInstructorSelection(instId)}
                              className="hover:text-rose-200 cursor-pointer ml-1"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown Button Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsInstructorDropdownOpen(!isInstructorDropdownOpen)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-slate-600 dark:text-slate-300 font-medium truncate flex items-center gap-2">
                        <User size={16} className="text-indigo-500 shrink-0" />
                        {(batchFormData.instructorIds || []).length === 0 
                          ? '-- Select Assigned Instructors --' 
                          : `${(batchFormData.instructorIds || []).length} Instructor(s) Selected`}
                      </span>
                      <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${isInstructorDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu Container */}
                    {isInstructorDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-3 space-y-2 max-h-64 overflow-y-auto">
                        {/* Search input */}
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                          <input
                            type="text"
                            value={instructorSearchText}
                            onChange={(e) => setInstructorSearchText(e.target.value)}
                            placeholder="Search instructors by name or role..."
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Instructor Options List */}
                        <div className="space-y-1">
                          {instructors.filter(i => {
                            if (!instructorSearchText.trim()) return true;
                            const q = instructorSearchText.toLowerCase();
                            return (i.name || '').toLowerCase().includes(q) || (i.role || i.designation || '').toLowerCase().includes(q);
                          }).length === 0 ? (
                            <p className="text-center py-4 text-xs text-slate-400 font-medium">
                              No matching instructors found.
                            </p>
                          ) : (
                            instructors.filter(i => {
                              if (!instructorSearchText.trim()) return true;
                              const q = instructorSearchText.toLowerCase();
                              return (i.name || '').toLowerCase().includes(q) || (i.role || i.designation || '').toLowerCase().includes(q);
                            }).map(inst => {
                              const instId = inst._id || inst.id;
                              const isChecked = (batchFormData.instructorIds || []).includes(instId);

                              return (
                                <div
                                  key={instId}
                                  onClick={() => handleToggleInstructorSelection(instId)}
                                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                                    isChecked 
                                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500/50 text-indigo-900 dark:text-indigo-200 font-bold' 
                                      : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                      isChecked ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                    }`}>
                                      {inst.name ? inst.name.charAt(0).toUpperCase() : 'I'}
                                    </div>
                                    <div className="truncate">
                                      <p className="text-xs font-bold truncate">{inst.name}</p>
                                      <p className="text-[10px] text-slate-400 truncate">{inst.role || inst.designation || 'Staff'}</p>
                                    </div>
                                  </div>

                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                    isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'
                                  }`}>
                                    {isChecked && <CheckCircle2 size={12} />}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBatchModalOpen(false)}
                    className="px-6 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBatch}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                  >
                    {isSubmittingBatch ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    {editingBatch ? 'Update Batch' : 'Confirm Batch'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Delete Confirmation Modal */}
      {createPortal(
        <AnimatePresence>
          {isDeleteModalOpen && course && (
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
                Delete Course?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                Are you sure you want to permanently delete <strong className="text-slate-800 dark:text-slate-200">{course.courseName}</strong> ({course.courseCode})? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCourse}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>{isDeleting ? 'Deleting...' : 'Delete Course'}</span>
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
          {isDeleteBatchModalOpen && batchToDelete && (
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
                Are you sure you want to permanently delete batch <strong className="text-slate-800 dark:text-slate-200">{batchToDelete.batchName}</strong> ({batchToDelete.batchCode})? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setIsDeleteBatchModalOpen(false); setBatchToDelete(null); }}
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

export default CourseDetails;
