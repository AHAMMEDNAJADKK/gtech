import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Plus, Search, Calendar, Clock, ExternalLink, Users,
  CheckCircle2, AlertCircle, Loader2, PlayCircle, X, Trash2, Edit3,
  Radio, Sparkles, BookOpen, Layers
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const initialClassForm = {
  title: '',
  description: '',
  courseId: '',
  batchId: '',
  platform: 'Google Meet',
  meetingUrl: '',
  meetingId: '',
  passcode: '',
  scheduledDate: new Date().toISOString().split('T')[0],
  startTime: '10:00 AM',
  endTime: '11:30 AM',
  durationMinutes: 90
};

const LiveClassrooms = () => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialClassForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  const user = useMemo(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  const userRole = String(user.role || '').toLowerCase();
  const userRoleId = String(user.role_id || '');
  const isStudent = userRole === 'student' || userRoleId === '10';
  const isAdminOrInstructor = !isStudent;

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchLiveClasses = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = API_BASE.endsWith('/v1')
        ? `${API_BASE}/live-classes`
        : `${API_BASE}/v1/live-classes`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load live classroom sessions.');

      const data = await res.json();
      setSessions(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, showToast]);

  const fetchCoursesAndBatches = useCallback(async () => {
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const [cRes, bRes] = await Promise.all([
        fetch(`${base}/academy/courses`, { headers: getHeaders() }),
        fetch(`${base}/academy/batches`, { headers: getHeaders() })
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        setCourses(cData.data || []);
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        setBatches(bData.data || []);
      }
    } catch (err) {
      console.warn('Failed to load courses or batches:', err.message);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchLiveClasses();
    if (isAdminOrInstructor) {
      fetchCoursesAndBatches();
    }
  }, [fetchLiveClasses, fetchCoursesAndBatches, isAdminOrInstructor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.meetingUrl || !formData.courseId || !formData.batchId) {
      showToast('Please fill all required session fields.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const url = editingSession
        ? `${base}/live-classes/${editingSession._id}`
        : `${base}/live-classes`;
      const method = editingSession ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save session.');

      showToast(editingSession ? 'Session updated successfully.' : 'Live session scheduled.', 'success');
      setIsModalOpen(false);
      setEditingSession(null);
      setFormData(initialClassForm);
      fetchLiveClasses();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/live-classes/${id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Status update failed.');
      showToast(`Class status updated to ${newStatus}.`, 'success');
      fetchLiveClasses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this live classroom session?')) return;
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/live-classes/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete session.');
      showToast('Session deleted.', 'success');
      fetchLiveClasses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = !searchQuery || 
      s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.courseId?.courseName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.batchId?.batchName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-2">
            <Video size={14} /> Virtual Classrooms
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Live Virtual Classrooms
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Google Meet & Zoom live lectures, interactive sessions, and batch schedules.
          </p>
        </div>

        {isAdminOrInstructor && (
          <button
            onClick={() => {
              setEditingSession(null);
              setFormData(initialClassForm);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition cursor-pointer self-start md:self-auto"
          >
            <Plus size={18} /> Schedule Live Class
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search classes, courses, batches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {['ALL', 'LIVE', 'UPCOMING', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {st === 'LIVE' ? '🔴 Live Now' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-600" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Live Sessions...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <Video className="mx-auto text-slate-300 dark:text-slate-700" size={48} />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Live Classes Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isAdminOrInstructor 
              ? 'Click "Schedule Live Class" above to create your first session.'
              : 'There are no live classes scheduled for your enrolled courses right now.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSessions.map((session) => {
            const isLive = session.status === 'LIVE';
            const isCompleted = session.status === 'COMPLETED';

            return (
              <motion.div
                key={session._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-slate-900 border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-all ${
                  isLive
                    ? 'border-rose-500/50 ring-2 ring-rose-500/20'
                    : 'border-slate-200/70 dark:border-slate-800 hover:border-indigo-500/40'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Status & Platform Tag */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isLive 
                        ? 'bg-rose-500 text-white animate-pulse'
                        : isCompleted
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {isLive && <Radio size={12} />}
                      {session.status}
                    </span>

                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">
                      {session.platform || 'Google Meet'}
                    </span>
                  </div>

                  {/* Title & Info */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                      {session.title}
                    </h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                      {session.courseId?.courseName || 'Course'} • {session.batchId?.batchName || 'Batch'}
                    </p>
                    {session.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                        {session.description}
                      </p>
                    )}
                  </div>

                  {/* Timing Pill */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Calendar size={13} className="text-slate-400" />
                      <span>{new Date(session.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Clock size={13} className="text-slate-400" />
                      <span>{session.startTime} {session.endTime ? `- ${session.endTime}` : ''} ({session.durationMinutes} mins)</span>
                    </div>
                    {session.instructorId?.name && (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                        <Users size={12} />
                        <span>Instructor: {session.instructorId.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <a
                    href={session.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                      isLive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 animate-pulse'
                        : isCompleted
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                    }`}
                  >
                    <ExternalLink size={14} /> Join Classroom
                  </a>

                  {isAdminOrInstructor && (
                    <div className="flex items-center gap-1">
                      {session.status !== 'LIVE' && !isCompleted && (
                        <button
                          onClick={() => handleStatusChange(session._id, 'LIVE')}
                          title="Start Session (Go Live)"
                          className="p-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                        >
                          <PlayCircle size={16} />
                        </button>
                      )}
                      {session.status === 'LIVE' && (
                        <button
                          onClick={() => handleStatusChange(session._id, 'COMPLETED')}
                          title="End Session"
                          className="p-2.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition cursor-pointer"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(session._id)}
                        title="Delete Session"
                        className="p-2.5 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Schedule Live Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {editingSession ? 'Edit Live Session' : 'Schedule Live Class'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Topic / Session Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master React Hooks & Context"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Course *
                  </label>
                  <select
                    required
                    value={formData.courseId}
                    onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c._id} value={c._id}>{c.courseName}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Batch *
                  </label>
                  <select
                    required
                    value={formData.batchId}
                    onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Batch</option>
                    {batches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Platform
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="Google Meet">Google Meet</option>
                    <option value="Zoom">Zoom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Start Time *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10:00 AM"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Meeting URL (Google Meet / Zoom link) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://meet.google.com/xyz-abc-def"
                  value={formData.meetingUrl}
                  onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Description / Agenda Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Topics covered, prerequisites..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save & Publish Session'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default LiveClassrooms;
