import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Download, Eye, BookOpen, Layers, Clock, 
  CheckCircle2, AlertCircle, Upload, Search, ChevronDown, 
  ChevronUp, ExternalLink, RefreshCw, Sparkles, Filter,
  FileCheck, ShieldCheck, X, ArrowLeft, Loader2
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) {
    return `${API_BASE}${cleanPath}`;
  }
  return `${API_BASE}/v1${cleanPath}`;
};

const CourseSyllabusPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser() || {};
  const { showToast } = useToast();

  const userRole = String(user?.role_id || user?.role || '').toLowerCase().trim();
  const isStudent = userRole === 'student' || userRole === '10';
  const queryStudentId = searchParams.get('studentId') || '';
  const isStaffViewing = (!isStudent && !queryStudentId) || (Boolean(queryStudentId) && !isStudent);

  // States
  const [loading, setLoading] = useState(true);
  const [studentSyllabuses, setStudentSyllabuses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [activeCourseData, setActiveCourseData] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const [topicSearch, setTopicSearch] = useState('');

  // PDF Preview & Upload modal states
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      Authorization: `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Fetch student syllabus data
  const fetchStudentSyllabuses = useCallback(async () => {
    setLoading(true);
    try {
      const q = queryStudentId ? `?studentId=${queryStudentId}` : '';
      const res = await fetch(getEndpoint(`/academy/student/syllabus${q}`), {
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setStudentSyllabuses(list);
        if (list.length > 0) {
          const first = list[0];
          setSelectedCourseId(first.course?._id || '');
          setActiveCourseData({
            course: first.course,
            batch: first.batch,
            syllabus: first.syllabus,
            syllabusPdf: first.syllabusPdf
          });
          // Expand all modules by default
          const exp = {};
          (first.syllabus || []).forEach((m, idx) => {
            exp[m.moduleId || idx] = true;
          });
          setExpandedModules(exp);
        }
      }
    } catch (err) {
      console.error('Failed to fetch student syllabus:', err);
      showToast('Could not load course syllabus information.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, queryStudentId, showToast]);

  // Fetch all courses for staff/admin
  const fetchAllCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getEndpoint('/academy/courses?limit=100'), {
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data?.courses || json.data || [];
        setAllCourses(list);
        if (list.length > 0) {
          const initialId = searchParams.get('courseId') || list[0]._id;
          setSelectedCourseId(initialId);
          loadCourseDetails(initialId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    } finally {
      setLoading(false);
    }
  }, [getHeaders, searchParams]);

  // Load a single course's syllabus details
  const loadCourseDetails = async (courseId) => {
    if (!courseId) return;
    try {
      const res = await fetch(getEndpoint(`/academy/courses/${courseId}/syllabus`), {
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setActiveCourseData(json.data);
        const exp = {};
        (json.data?.syllabus || []).forEach((m, idx) => {
          exp[m.moduleId || idx] = true;
        });
        setExpandedModules(exp);
      }
    } catch (err) {
      console.error('Failed to load course syllabus details:', err);
    }
  };

  useEffect(() => {
    if (isStudent || queryStudentId) {
      fetchStudentSyllabuses();
    } else {
      fetchAllCourses();
    }
  }, [isStudent, queryStudentId, fetchStudentSyllabuses, fetchAllCourses]);

  // Handle course switch for students
  const handleSelectStudentCourse = (en) => {
    setSelectedCourseId(en.course?._id || '');
    setActiveCourseData({
      course: en.course,
      batch: en.batch,
      syllabus: en.syllabus,
      syllabusPdf: en.syllabusPdf
    });
    const exp = {};
    (en.syllabus || []).forEach((m, idx) => {
      exp[m.moduleId || idx] = true;
    });
    setExpandedModules(exp);
  };

  // Toggle module expansion
  const toggleModule = (key) => {
    setExpandedModules(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Expand all / collapse all
  const toggleAllModules = (expand) => {
    if (!activeCourseData?.syllabus) return;
    const next = {};
    activeCourseData.syllabus.forEach((m, idx) => {
      next[m.moduleId || idx] = expand;
    });
    setExpandedModules(next);
  };

  // Download PDF action
  const handleDownloadPdf = async () => {
    if (!selectedCourseId) return;
    setDownloadingPdf(true);
    try {
      const rawToken = localStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';

      const downloadUrl = getEndpoint(`/academy/courses/${selectedCourseId}/syllabus/pdf?download=true`);
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });

      if (!res.ok) {
        throw new Error('PDF download failed. Status ' + res.status);
      }

      const blob = await res.blob();
      const courseName = activeCourseData?.course?.courseName || 'Course';
      const safeFilename = `${courseName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Syllabus.pdf`;

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', safeFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      showToast('Syllabus PDF downloaded successfully.', 'success');
    } catch (err) {
      console.error('Download PDF error:', err);
      showToast('Failed to download syllabus PDF.', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Preview PDF in browser modal
  const handlePreviewPdf = () => {
    if (!selectedCourseId) return;
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    const previewUrl = getEndpoint(`/academy/courses/${selectedCourseId}/syllabus/pdf?preview=true&auth=${cleanToken}`);
    setPreviewPdfUrl(previewUrl);
    setPreviewPdfTitle(`${activeCourseData?.course?.courseName || 'Course'} Syllabus`);
  };

  // Staff: Upload Official PDF
  const handleUploadSyllabusPdf = async (e) => {
    e.preventDefault();
    if (!uploadFile || !selectedCourseId) {
      showToast('Please select a valid PDF file to upload.', 'warning');
      return;
    }

    if (uploadFile.type !== 'application/pdf' && !uploadFile.name.toLowerCase().endsWith('.pdf')) {
      showToast('Only official PDF documents are accepted.', 'error');
      return;
    }

    if (uploadFile.size > 25 * 1024 * 1024) {
      showToast('File size exceeds the 25MB limit.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const rawToken = localStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';

      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await fetch(getEndpoint(`/academy/courses/${selectedCourseId}/syllabus/upload-pdf`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`
        },
        body: formData
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Upload failed');
      }

      showToast('Official syllabus PDF uploaded and linked successfully!', 'success');
      setIsUploadModalOpen(false);
      setUploadFile(null);
      // Refresh current course details
      loadCourseDetails(selectedCourseId);
    } catch (err) {
      console.error('Upload error:', err);
      showToast(err.message || 'Failed to upload syllabus PDF.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Filter modules/topics by search term
  const filteredModules = useMemo(() => {
    const modules = activeCourseData?.syllabus || [];
    if (!topicSearch.trim()) return modules;

    const q = topicSearch.toLowerCase().trim();
    return modules.map(m => {
      const titleMatch = (m.title || '').toLowerCase().includes(q);
      const descMatch = (m.description || '').toLowerCase().includes(q);
      const matchingTopics = (m.topics || []).filter(t => 
        (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
      );

      if (titleMatch || descMatch || matchingTopics.length > 0) {
        return {
          ...m,
          topics: titleMatch || descMatch ? m.topics : matchingTopics,
          matchesSearch: true
        };
      }
      return null;
    }).filter(Boolean);
  }, [activeCourseData, topicSearch]);

  const totalTopicsCount = useMemo(() => {
    let count = 0;
    (activeCourseData?.syllabus || []).forEach(m => {
      count += (m.topics || []).length;
    });
    return count;
  }, [activeCourseData]);

  const activeCourse = activeCourseData?.course || {};
  const activeBatch = activeCourseData?.batch || {};

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans pb-20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* 1. Header Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-xs text-white border border-white/25">
                <BookOpen size={13} /> Academic Course Syllabus &amp; Curriculum
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                Course Syllabus &amp; Curriculum Specifications
              </h1>
              <p className="text-sm text-indigo-100 max-w-2xl font-medium">
                Official modular breakdown, technical milestones, learning objectives, and certified multi-page PDF curriculum downloads.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePreviewPdf}
                disabled={!selectedCourseId || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition border border-white/25 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Eye size={14} /> Preview PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!selectedCourseId || downloadingPdf || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition shadow-lg shadow-indigo-500/30 cursor-pointer disabled:opacity-50"
              >
                {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
              </button>
              {!isStudent && (
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  disabled={!selectedCourseId}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <Upload size={14} /> Upload Official PDF
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Course Switcher / Selector */}
        {(isStudent || queryStudentId) ? (
          // Student View: Tabs for enrolled courses
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Your Enrolled Courses
              </h2>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {studentSyllabuses.length} Active Courses
              </span>
            </div>

            {studentSyllabuses.length === 0 && !loading ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
                <AlertCircle size={32} className="mx-auto text-amber-500 opacity-60" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No syllabus is available for your course yet.</p>
                <p className="text-xs text-slate-400">You are not currently enrolled in any active courses, or your curriculum is being finalized.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {studentSyllabuses.map((en) => {
                  const cId = en.course?._id;
                  const isSelected = selectedCourseId === cId;
                  return (
                    <button
                      key={en.enrollmentId || cId}
                      type="button"
                      onClick={() => handleSelectStudentCourse(en)}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                      }`}
                    >
                      <BookOpen size={16} className={isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'} />
                      <div>
                        <p className="text-xs font-black truncate max-w-[200px]">
                          {en.course?.courseName || 'Enrolled Course'}
                        </p>
                        <p className={`text-[10px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {en.batch?.batchName ? `Batch: ${en.batch.batchName}` : en.course?.courseCode}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Staff View: Dropdown to select any course
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <label htmlFor="courseSelect" className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Select Course Curriculum:
              </label>
              <select
                id="courseSelect"
                value={selectedCourseId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedCourseId(id);
                  loadCourseDetails(id);
                }}
                className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {allCourses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.courseCode} — {c.courseName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Syllabus Status:</span>
              {activeCourseData?.syllabusPdf?.url ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <FileCheck size={12} /> Official PDF Uploaded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  <Sparkles size={12} /> Dynamic PDF Generated
                </span>
              )}
            </div>
          </div>
        )}

        {/* 3. Course Details & Metadata Cards */}
        {activeCourseData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Course Code</span>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {activeCourse.courseCode || 'CRS-2026'}
              </p>
              <p className="text-[10px] text-slate-400">{activeCourse.category || 'General'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Modules</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                {(activeCourseData.syllabus || []).length} Modules
              </p>
              <p className="text-[10px] text-slate-400">{totalTopicsCount} Curriculum Topics</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimated Duration</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                {activeCourse.durationValue || 6} {activeCourse.durationUnit || 'Months'}
              </p>
              <p className="text-[10px] text-slate-400">Scheduled Training Cohort</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Syllabus PDF</span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1">
                Ready to View
              </p>
              <p className="text-[10px] text-slate-400">Publication Quality</p>
            </div>
          </div>
        )}

        {/* 4. Modular Syllabus Tree & Topic Explorer */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          
          {/* Section Header with Search and Expand All controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  Modular Curriculum Explorer
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Browse modules, chapters, practical sessions, and learning milestones included in this course.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Topic search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter topics..."
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 w-44"
                />
              </div>

              <button
                type="button"
                onClick={() => toggleAllModules(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={() => toggleAllModules(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Module Tree */}
          {filteredModules.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <FileText size={36} className="mx-auto opacity-30" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {topicSearch ? 'No topics matching your search filter.' : 'No modules defined for this syllabus yet.'}
              </p>
              <p className="text-xs text-slate-400">
                {topicSearch ? 'Try a different keyword or clear search filter.' : 'Curriculum modules will be uploaded by instructors shortly.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredModules.map((mod, modIdx) => {
                const key = mod.moduleId || modIdx;
                const isExpanded = Boolean(expandedModules[key]);
                const topics = mod.topics || [];

                return (
                  <div
                    key={key}
                    className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all bg-slate-50/50 dark:bg-slate-900/50"
                  >
                    {/* Module Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleModule(key)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {modIdx + 1}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                            {mod.title || `Module ${modIdx + 1}`}
                          </h4>
                          {mod.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {mod.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                          {topics.length} Topics
                        </span>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </button>

                    {/* Topics List */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-5 pb-5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 space-y-2.5"
                        >
                          {topics.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2 italic">
                              Comprehensive lectures, code labs, and interactive assignments.
                            </p>
                          ) : (
                            topics.map((topic, tIdx) => (
                              <div
                                key={topic.topicId || tIdx}
                                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                              >
                                <span className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                  {tIdx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {topic.title}
                                  </h5>
                                  {topic.description && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                      {topic.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: BROWSER PDF PREVIEW                                              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {previewPdfUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
                    {previewPdfTitle}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Download size={13} /> Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPdfUrl(null)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Iframe View */}
              <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950">
                <iframe
                  src={previewPdfUrl}
                  title="Syllabus PDF Preview"
                  className="w-full h-full border-0"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: UPLOAD OFFICIAL PDF MODAL (STAFF / ADMIN ONLY)                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Upload Official Syllabus PDF
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Link an official PDF syllabus document to {activeCourse.courseName}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUploadSyllabusPdf} className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center space-y-2 hover:border-indigo-500 transition">
                  <Upload size={28} className="mx-auto text-indigo-600 dark:text-indigo-400" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {uploadFile ? uploadFile.name : 'Select or drag Syllabus PDF file'}
                  </p>
                  <p className="text-[10px] text-slate-400">PDF documents only, max 25MB.</p>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950 file:text-indigo-600 cursor-pointer pt-2"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!uploadFile || isUploading}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {isUploading ? 'Uploading...' : 'Save Syllabus PDF'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default CourseSyllabusPage;
