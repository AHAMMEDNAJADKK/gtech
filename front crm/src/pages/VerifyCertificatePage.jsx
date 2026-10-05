import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Award, Calendar,
  BookOpen, User, ArrowLeft, Loader2
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const VerifyCertificatePage = () => {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const verify = async () => {
      setLoading(true);
      setError(null);
      try {
        const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
        const res = await fetch(`${base}/certificates/verify/${code}`);
        const data = await res.json();

        if (res.ok && data.verified) {
          setResult(data.data);
        } else {
          setError(data.message || 'Invalid or revoked certificate.');
        }
      } catch (err) {
        setError('Network error while validating certificate credentials.');
      } finally {
        setLoading(false);
      }
    };

    if (code) verify();
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500/30">
      <div className="w-full max-w-lg">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
            <Loader2 size={44} className="animate-spin text-indigo-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Verifying Certificate in Registry...
            </h2>
            <p className="text-xs text-slate-400">Querying cryptographic records and completion logs...</p>
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950 rounded-3xl p-8 md:p-10 text-center space-y-4 shadow-xl"
          >
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-rose-600 dark:text-rose-400">
              Certificate Not Verified
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {error}
            </p>
            <div className="pt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                <ArrowLeft size={14} /> Return to Portal
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 md:p-10 shadow-2xl space-y-6 relative overflow-hidden"
          >
            {/* Top Verified Header */}
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 p-4 rounded-2xl">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Official Verification Status
                </span>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  AUTHENTIC & VALID CREDENTIAL
                </h2>
              </div>
            </div>

            {/* Certificate Meta Details */}
            <div className="space-y-4 text-center py-2">
              <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 inline-block px-3 py-1 rounded-lg">
                ID: {result.certificateId}
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Awarded To</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                  {result.studentName}
                </h3>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Course / Specialization:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{result.courseName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Completion Date:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(result.completionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Issue Date:</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {new Date(result.issueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Evaluation Grade:</span>
                  <span className="font-bold text-emerald-600">{result.score}% Distinction</span>
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-400">
                This academic credential has been authenticated by EdTech Academy Registry.
              </p>
              <div className="mt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default VerifyCertificatePage;
