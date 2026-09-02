import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Mail, Phone, MapPin, GraduationCap, ShieldCheck, 
  Calendar, Award, CreditCard, BookOpen, CheckCircle2, AlertCircle, Edit, Loader2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const StudentProfileModal = ({ studentId, isOpen, onClose, onEditStudent, getHeaders }) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !studentId) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
        const res = await fetch(`${cleanBase}/student/profile/${studentId}`, {
          headers: getHeaders ? getHeaders() : {}
        });

        if (!res.ok) {
          // Fallback to fetch from users endpoint
          const userRes = await fetch(`${cleanBase}/v1/users/${studentId}`, {
            headers: getHeaders ? getHeaders() : {}
          });
          if (userRes.ok) {
            const uData = await userRes.json();
            setProfileData({
              student: uData.data || uData,
              attendanceSummary: { totalMarked: 0, presentCount: 0, absentCount: 0, attendancePercentage: 0 }
            });
            setLoading(false);
            return;
          }
          throw new Error("Failed to load student profile");
        }

        const data = await res.json();
        setProfileData(data.data || data);
      } catch (err) {
        console.error("Profile Fetch Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [studentId, isOpen, getHeaders]);

  if (!isOpen) return null;

  const student = profileData?.student || {};
  const attendance = profileData?.attendanceSummary || { totalMarked: 0, presentCount: 0, absentCount: 0, attendancePercentage: 0 };
  const studentImage = student.profile_image || student.avatar;

  const studentName = student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col my-auto"
        >
          {/* Top Banner Header */}
          <div className="relative bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 p-8 sm:p-10 text-white">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 z-50 p-3 bg-white/20 hover:bg-rose-600 text-white rounded-2xl backdrop-blur-md transition-all shadow-xl border border-white/40 cursor-pointer flex items-center justify-center"
              aria-label="Close Profile"
              title="Close Profile"
            >
              <X size={22} className="stroke-[2.5]" />
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white text-indigo-700 font-black text-3xl sm:text-4xl shadow-xl border-2 border-indigo-200 flex items-center justify-center uppercase overflow-hidden flex-shrink-0">
                {studentImage ? (
                  <img src={studentImage} alt={studentName} className="w-full h-full object-cover" />
                ) : (
                  studentName ? studentName.charAt(0).toUpperCase() : <User size={36} />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white text-slate-900 border border-indigo-200 shadow-md">
                    {student.studentId || student.student_id || student.employeeId || student.employee_id || 'STD-STUDENT'}
                  </span>
                  <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-400 text-slate-950 shadow-md">
                    {student.status || 'ACTIVE'}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white drop-shadow-md">{studentName}</h2>
                <p className="text-xs font-bold text-indigo-100 flex items-center gap-2 drop-shadow-sm">
                  <Mail size={14} /> {student.email || 'No email specified'}
                </p>
              </div>

              {onEditStudent && (
                <button
                  onClick={() => {
                    onClose();
                    onEditStudent(student);
                  }}
                  className="sm:ml-auto flex items-center gap-2 bg-white text-indigo-900 hover:bg-indigo-50 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md cursor-pointer"
                >
                  <Edit size={14} /> Edit Student
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={40} />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Student Profile...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-rose-500">
              <AlertCircle className="mx-auto mb-3" size={36} />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : (
            <div className="p-8 sm:p-10 space-y-8 max-h-[65vh] overflow-y-auto">
              
              {/* Attendance Statistics Bar */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-500" /> Attendance Performance Summary
                  </h3>
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                    {attendance.attendancePercentage}% Attendance Rate
                  </span>
                </div>
                
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-6">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-700" 
                    style={{ width: `${attendance.attendancePercentage}%` }} 
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Sessions</p>
                    <p className="text-xl font-black text-slate-900 dark:text-slate-100">{attendance.totalMarked}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Days Present</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{attendance.presentCount}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">Days Absent</p>
                    <p className="text-xl font-black text-rose-600 dark:text-rose-400">{attendance.absentCount}</p>
                  </div>
                </div>
              </div>

              {/* Grid Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal Information */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <User size={16} /> Personal Information
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Date of Birth:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{student.dateOfBirth || student.dob || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Gender:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 capitalize">{student.gender || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Admission Date:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {student.joining_date ? new Date(student.joining_date).toLocaleDateString() : student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <Phone size={16} /> Contact Details
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Primary Phone:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{student.phone || student.contactPhone || student.mobile || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Alternate Phone:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{student.alternatePhone || student.alternate_phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Address:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{student.address || student.fullAddress || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Location:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {[student.city, student.state, student.pincode].filter(Boolean).join(', ') || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Educational Background */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <GraduationCap size={16} /> Educational Background
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Qualification:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{student.qualification || student.highestQualification || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Institution:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{student.institution || student.college || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Passing Year:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{student.passingYear || student.passing_year || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Course Preference:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{student.coursePreference || student.course_preference || student.course || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Verification & System Info */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <CreditCard size={16} /> ID Verification & System Metadata
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">ID Document Type:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">{student.identityType || student.identity_type || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">ID Document Number:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{student.identityNumber || student.identity_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Registered On:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : student.joining_date ? new Date(student.joining_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default StudentProfileModal;
