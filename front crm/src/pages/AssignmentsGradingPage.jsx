import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Award, BookOpen, Layers, Search, CheckCircle2,
  Clock, AlertCircle, Loader2, Plus, Users, FileText
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import AssignmentManager from '../components/lms/AssignmentManager';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const AssignmentsGradingPage = () => {
  const { showToast } = useToast();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);

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

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/academy/courses`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load courses.');
      const data = await res.json();
      const list = data.data || [];
      setCourses(list);
      if (list.length > 0) {
        setSelectedCourseId(list[0]._id);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, showToast]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const activeCourse = courses.find(c => String(c._id) === String(selectedCourseId));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-2">
            <Award size={14} /> Academic Evaluation
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Assignments & Student Grading
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish assignments, review student submissions, award marks, and provide feedback.
          </p>
        </div>

        {/* Course Selector Dropdown */}
        {courses.length > 0 && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Course:</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              {courses.map(c => (
                <option key={c._id} value={c._id}>{c.courseName} ({c.courseCode})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-600" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Academic Curriculum...</p>
        </div>
      ) : !activeCourse ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <BookOpen className="mx-auto text-slate-300 dark:text-slate-700" size={48} />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Courses Available</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create an academic course in Course Management to start assigning tasks.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs">
          <AssignmentManager
            courseId={activeCourse._id}
            syllabus={activeCourse.syllabus || []}
          />
        </div>
      )}
    </div>
  );
};

export default AssignmentsGradingPage;
