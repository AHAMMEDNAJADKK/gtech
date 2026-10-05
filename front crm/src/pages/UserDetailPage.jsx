import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Mail, Phone, Briefcase, Folder, UserCheck, Shield,
  Image as ImageIcon, Loader2, User, CheckCircle2, AlertTriangle,
  Lock, Calendar, DollarSign, MapPin, Award, KeyRound, Edit3, ShieldCheck, Eye, X
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import PerformanceTab from '../components/PerformanceTab';

const RAW_API_BASE = import.meta.env.VITE_API_URL || '/api';
const API_BASE = (RAW_API_BASE.endsWith('/') ? RAW_API_BASE.slice(0, -1) : RAW_API_BASE).replace(/\/+$/, '');

const ROLES = [
  { id: "0", name: "superadmin" },
  { id: "1", name: "hr" },
  { id: "2", name: "admin" },
  { id: "3", name: "employee" }
];

const UserDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dossier'); // 'dossier' | 'performance'
  const [imgError, setImgError] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` };
  }, []);

  const fetchUserDetails = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/v1/users/${userId}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        showToast('Failed to load employee details.', 'error');
        setUser(null);
        return;
      }

      const data = await res.json();
      const userData = data?.data || data?.user || data;
      setUser(userData);
    } catch (err) {
      console.error('Error fetching user details:', err);
      showToast('Error loading user profile.', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, getAuthHeaders, showToast]);

  const fetchDesignations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/designations`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDesignations(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [getAuthHeaders]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/departments?status=true`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchUserDetails();
    fetchDesignations();
    fetchDepartments();
  }, [fetchUserDetails, fetchDesignations, fetchDepartments]);

  const designationMap = useMemo(() => {
    return new Map(designations.map(designation => [String(designation.id), designation.name]));
  }, [designations]);

  const getDesignationName = useCallback((u) => {
    if (!u) return 'General Staff';
    const id = u.designationId || u.designation;
    return u.designationName || designationMap.get(String(id)) || u.designation || 'General Staff';
  }, [designationMap]);

  const departmentMap = useMemo(() => {
    return new Map(departments.map(department => [
      String(department.id || department._id),
      department.name
    ]));
  }, [departments]);

  const getDepartmentName = useCallback((u) => {
    if (!u) return 'Unassigned';
    const departmentId = u.departmentId?._id || u.departmentId || u.department;
    return u.departmentId?.name || departmentMap.get(String(departmentId)) || u.departmentName || u.department || 'Unassigned';
  }, [departmentMap]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 size={36} className="animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Employee File...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-full">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Employee Profile Not Found</h2>
        <p className="text-xs text-slate-500 max-w-sm">The employee profile you requested could not be located or has been deleted.</p>
        <button
          onClick={() => navigate('/users')}
          className="mt-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Return to Directory
        </button>
      </div>
    );
  }

  const profileImg = user.avatar || user.profile_image || user.profileImage;
  const statusKey = user.status || (user.isActive ? 'active' : 'inactive');
  const STATUS_META = {
    active: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400', dot: 'bg-emerald-500' },
    inactive: { label: 'Inactive', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400', dot: 'bg-amber-500' },
    blocked: { label: 'Blocked', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400', dot: 'bg-rose-500' }
  };
  const meta = STATUS_META[statusKey] || STATUS_META.active;

  const namePart = (user.name || "").trim().slice(0, 3).toUpperCase();
  const phonePart = (user.phone || "").trim().slice(-3) || "123";
  const implicitPassword = `${namePart}${phonePart}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header Navigation Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/users')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl shadow-sm"
        >
          <ArrowLeft size={16} />
          <span>Back to Employee Directory</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/permissions/${user.id || user._id}`)}
            className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck size={14} />
            <span>Manage Sidebar Access</span>
          </button>
        </div>
      </div>

      {/* ── Single Page Full Profile Banner ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {profileImg && !imgError ? (
              <div
                onClick={() => setPreviewImageSrc(profileImg)}
                title="Click to view full image"
                className="relative group cursor-pointer"
              >
                <img
                  src={profileImg}
                  alt={user.name}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-3xl object-cover border-2 border-indigo-500/20 shadow-md group-hover:scale-105 transition-all"
                  onError={() => setImgError(true)}
                />
                <div className="absolute inset-0 bg-black/30 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye size={20} className="text-white drop-shadow-md" />
                </div>
              </div>
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-indigo-500/10 dark:bg-indigo-500/20 border-2 border-indigo-500/20 flex items-center justify-center">
                <User size={36} className="text-indigo-600 dark:text-indigo-400" />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{user.name}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.color}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {statusKey}
                </span>
                {user.isSuperAdmin || String(user.role).toLowerCase() === 'superadmin' ? (
                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                    <Shield size={12} /> Super Admin
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest bg-indigo-500/10 px-2.5 py-1 rounded-lg inline-block">
                    {user.role || 'employee'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Briefcase size={14} className="text-indigo-500" />
                  {getDesignationName(user)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Folder size={14} className="text-slate-400" />
                  {getDepartmentName(user)}
                </span>
                {user.employeeId && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                      ID: {user.employeeId}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Sub-Tab Selector Navigation ── */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl self-start lg:self-center">
            <button
              onClick={() => setActiveTab('dossier')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'dossier'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
            >
              Personnel Dossier
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'performance'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
            >
              Performance & KPI
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'dossier' ? (
        <div className="space-y-6">
          {/* Quick Contact & Credentials Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Mail size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 select-all">{user.email || 'N/A'}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Phone size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 select-all">{user.phone || 'N/A'}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Initial System Password</p>
                <p className="text-[10px] text-slate-400">First 3 letters + last 3 digits of phone</p>
              </div>
              <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm font-black tracking-wider text-slate-900 dark:text-slate-100 select-all">
                {implicitPassword}
              </div>
            </div>
          </div>

          {/* Full Grid Personnel Details */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 pb-3 border-b border-slate-100 dark:border-slate-800">
              Employment & System Information
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {[
                { label: 'Employee ID', value: user.employeeId },
                { label: 'Assigned Role', value: user.role, upper: true },
                { label: 'Department', value: getDepartmentName(user) },
                { label: 'Reporting Manager', value: user.reportingManager || 'Unassigned' },
                { label: 'Monthly Base Salary', value: `₹${user.salary || '0'}` },
                { label: 'Joining Date', value: user.joining_date ? new Date(user.joining_date).toLocaleDateString() : 'N/A' },
                { label: 'Identity Document', value: user.identityType, upper: true },
                { label: 'Identity Number', value: user.identityNumber },
                { label: 'Date of Birth', value: user.dateOfBirth || 'N/A' },
                { label: 'Gender', value: user.gender, upper: true },
                { label: 'Alternate Phone', value: user.alternatePhone },
                { label: 'Qualification', value: user.qualification },
                { label: 'Institution', value: user.institution },
                { label: 'Passing Year', value: user.passingYear },
              ].map(({ label, value, upper }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                  <p className={`text-xs font-bold text-slate-800 dark:text-slate-200 ${upper ? 'uppercase' : ''}`}>{value || 'N/A'}</p>
                </div>
              ))}

              <div className="col-span-2 sm:col-span-3 lg:col-span-4 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Residential Address</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {user.address ? `${user.address}${user.city ? `, ${user.city}` : ''}${user.state ? `, ${user.state}` : ''}${user.pincode ? ` - ${user.pincode}` : ''}` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <PerformanceTab user={user} />
        </div>
      )}

      {/* ── Image Lightbox Modal ── */}
      {previewImageSrc && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImageSrc(null)}
            className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-xl max-h-[85vh] bg-slate-900 p-3 rounded-3xl border border-slate-700/60 shadow-2xl flex flex-col items-center"
            >
              <button
                onClick={() => setPreviewImageSrc(null)}
                className="absolute -top-3 -right-3 bg-slate-800 text-slate-200 hover:text-white p-2 rounded-full border border-slate-700 shadow-lg cursor-pointer transition hover:bg-slate-700"
              >
                <X size={18} />
              </button>
              <img
                src={previewImageSrc}
                alt={user.name}
                className="w-full h-auto max-h-[75vh] object-contain rounded-2xl"
              />
              <div className="pt-3 pb-1 text-center">
                <p className="text-sm font-black text-white">{user.name}</p>
                <p className="text-xs text-indigo-400 font-semibold">{getDesignationName(user)}</p>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default UserDetailPage;
