import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Award, Search, Download, ExternalLink, CheckCircle2,
  AlertCircle, Loader2, Plus, QrCode, ShieldCheck, X, BookOpen, User
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const CertificatesPage = () => {
  const { showToast } = useToast();
  const [certificates, setCertificates] = useState([]);
  const [completedEnrollments, setCompletedEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [scorePercent, setScorePercent] = useState(100);
  const [generating, setGenerating] = useState(false);

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

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/certificates`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load certificates registry.');
      const data = await res.json();
      setCertificates(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, showToast]);

  const fetchCompletedEnrollments = useCallback(async () => {
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/academy/enrollments?status=completed`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCompletedEnrollments(data.data || []);
      }
    } catch (err) {
      console.warn('Failed to load completed enrollments:', err.message);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchCertificates();
    if (isAdminOrInstructor) {
      fetchCompletedEnrollments();
    }
  }, [fetchCertificates, fetchCompletedEnrollments, isAdminOrInstructor]);

  const handleGenerateCertificate = async (e) => {
    e.preventDefault();
    if (!selectedEnrollmentId) {
      showToast('Please select a completed student enrollment.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/certificates/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          enrollmentId: selectedEnrollmentId,
          finalScorePercent: scorePercent
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to issue certificate.');

      showToast('Certificate generated successfully!', 'success');
      setIsModalOpen(false);
      setSelectedEnrollmentId('');
      fetchCertificates();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = (certId, certCode) => {
    const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
    window.open(`${base}/certificates/${certId}/pdf`, '_blank');
  };

  const filteredCertificates = certificates.filter(c => {
    const q = searchQuery.toLowerCase();
    return !q ||
      c.certificateId?.toLowerCase().includes(q) ||
      c.studentName?.toLowerCase().includes(q) ||
      c.courseName?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mb-2">
            <Award size={14} /> Academic Credentials
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Course Completion Certificates
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated PDF certificates with tamper-proof QR code verification.
          </p>
        </div>

        {isAdminOrInstructor && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-600/20 transition cursor-pointer self-start md:self-auto"
          >
            <Plus size={18} /> Issue Certificate
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student, certificate ID, course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Certificates Cards */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="animate-spin text-amber-600" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Certificates...</p>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <Award className="mx-auto text-slate-300 dark:text-slate-700" size={48} />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Certificates Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isAdminOrInstructor 
              ? 'Certificates are automatically eligible once a student completes their enrolled course curriculum.'
              : 'You do not have any issued completion certificates yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCertificates.map((cert) => (
            <motion.div
              key={cert._id}
              layout
              className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between hover:border-amber-500/40 transition-all space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg">
                    {cert.certificateId}
                  </span>
                  <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={11} /> VERIFIED
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {cert.studentName}
                  </h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">
                    {cert.courseName}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 text-xs space-y-1">
                  <p className="text-slate-500">
                    Completed: <span className="text-slate-800 dark:text-slate-200 font-semibold">{new Date(cert.completionDate).toLocaleDateString()}</span>
                  </p>
                  <p className="text-slate-500">
                    Verification Code: <span className="font-mono text-slate-800 dark:text-slate-200">{cert.verificationCode}</span>
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleDownloadPdf(cert._id, cert.certificateId)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  <Download size={14} /> Download PDF
                </button>

                <a
                  href={`/verify-certificate/${cert.verificationCode}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Verify QR Link"
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition cursor-pointer"
                >
                  <QrCode size={16} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Issue Certificate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Issue Course Certificate
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerateCertificate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Completed Student Enrollment *
                </label>
                <select
                  required
                  value={selectedEnrollmentId}
                  onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-amber-500"
                >
                  <option value="">Select Completed Student...</option>
                  {completedEnrollments.map(en => (
                    <option key={en._id} value={en._id}>
                      {en.studentId?.name || 'Student'} — {en.courseId?.courseName || 'Course'} ({en.batchId?.batchName || 'Batch'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Only students with 100% curriculum progress or status marked 'completed' can receive credentials.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Final Score / Grade Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scorePercent}
                  onChange={(e) => setScorePercent(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-amber-500"
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
                  disabled={generating}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {generating ? 'Generating...' : 'Issue & Sign Certificate'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CertificatesPage;
