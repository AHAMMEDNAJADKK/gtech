import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Mail, Phone, MapPin, GraduationCap, ShieldCheck, 
  Calendar, Award, CreditCard, BookOpen, CheckCircle2, AlertCircle, Edit, Loader2, Save
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const StudentProfileModal = ({ studentId, isOpen, onClose, onEditStudent, getHeaders }) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    alternatePhone: '',
    dateOfBirth: '',
    gender: '',
    status: 'active',
    address: '',
    city: '',
    state: '',
    pincode: '',
    qualification: '',
    institution: '',
    passingYear: '',
    coursePreference: '',
    identityType: 'aadhaar',
    identityNumber: ''
  });

  const initEditForm = (st) => {
    let formattedDob = '';
    if (st.dateOfBirth) {
      try {
        const dobStr = String(st.dateOfBirth);
        formattedDob = dobStr.includes('T') ? dobStr.split('T')[0] : new Date(dobStr).toISOString().split('T')[0];
      } catch (e) {
        formattedDob = st.dateOfBirth || '';
      }
    }
    setEditForm({
      name: st.name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || '',
      email: st.email || '',
      phone: st.phone || st.contactPhone || st.mobile || '',
      alternatePhone: st.alternatePhone || st.alternate_phone || '',
      dateOfBirth: formattedDob,
      gender: st.gender || '',
      status: st.status || 'active',
      address: st.address || st.fullAddress || '',
      city: st.city || '',
      state: st.state || '',
      pincode: st.pincode || '',
      qualification: st.qualification || st.highestQualification || '',
      institution: st.institution || st.college || '',
      passingYear: st.passingYear || st.passing_year || '',
      coursePreference: st.coursePreference || st.course_preference || st.course || '',
      identityType: st.identityType || st.identity_type || 'aadhaar',
      identityNumber: st.identityNumber || st.identity_number || ''
    });
  };

  useEffect(() => {
    if (!isOpen || !studentId) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      setSaveSuccessMsg('');
      setIsEditing(false);
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
            const fetchedStudent = uData.data || uData;
            setProfileData({
              student: fetchedStudent,
              attendanceSummary: { totalMarked: 0, presentCount: 0, absentCount: 0, attendancePercentage: 0 }
            });
            initEditForm(fetchedStudent);
            setLoading(false);
            return;
          }
          throw new Error("Failed to load student profile");
        }

        const data = await res.json();
        const fullData = data.data || data;
        setProfileData(fullData);
        if (fullData.student) {
          initEditForm(fullData.student);
        }
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

  const handleStartEditing = () => {
    initEditForm(student);
    setIsEditing(true);
    setError(null);
    setSaveSuccessMsg('');
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setError(null);
    initEditForm(student);
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccessMsg('');

    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const reqHeaders = {
        'Content-Type': 'application/json',
        ...(getHeaders ? getHeaders() : {})
      };

      const res = await fetch(`${cleanBase}/v1/users/${studentId}`, {
        method: 'PUT',
        headers: reqHeaders,
        body: JSON.stringify(editForm)
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok && !body.success) {
        throw new Error(body.message || body.detail || 'Failed to update student profile');
      }

      const updatedStudent = body.data || { ...student, ...editForm };

      setProfileData(prev => ({
        ...prev,
        student: updatedStudent
      }));

      setSaveSuccessMsg('Student profile updated successfully!');
      setIsEditing(false);

      if (onEditStudent) {
        onEditStudent(updatedStudent);
      }
    } catch (err) {
      console.error('Update Profile Error:', err);
      setError(err.message || 'Failed to update student profile');
    } finally {
      setSaving(false);
    }
  };

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
            {/* Top Right Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-[100] p-3 bg-slate-900/60 hover:bg-rose-600 text-white rounded-2xl backdrop-blur-md transition-all shadow-2xl border border-white/40 cursor-pointer flex items-center justify-center active:scale-95"
              aria-label="Close Profile"
              title="Close Profile"
            >
              <X size={22} className="stroke-[2.5]" />
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pr-12 sm:pr-0">
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

              {/* Action Buttons in Banner */}
              <div className="sm:ml-auto flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md cursor-pointer"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Profile
                    </button>
                    <button
                      onClick={handleCancelEditing}
                      disabled={saving}
                      className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                    <button
                      onClick={() => {
                        if (onEditStudent) {
                          onClose();
                          onEditStudent(student);
                        } else {
                          handleStartEditing();
                        }
                      }}
                      className="flex items-center gap-2 bg-white text-indigo-900 hover:bg-indigo-50 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md cursor-pointer"
                    >
                      <Edit size={14} /> Edit Profile
                    </button>
                )}
              </div>
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
            <div className="p-8 sm:p-10 space-y-8 flex-1 overflow-y-auto">
              
              {/* Alert Feedback Messages */}
              {saveSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} /> {saveSuccessMsg}
                </div>
              )}

              {/* Attendance Statistics Bar (Hidden during Edit Mode for clarity) */}
              {!isEditing && (
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
              )}

              {/* Grid Information / Edit Form Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal Information */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <User size={16} /> Personal Information
                  </h4>
                  
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Date of Birth</label>
                          <input
                            type="date"
                            value={editForm.dateOfBirth}
                            onChange={e => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Gender</label>
                          <select
                            value={editForm.gender}
                            onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          >
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Status</label>
                        <select
                          value={editForm.status}
                          onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>

                {/* Contact Information */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <Phone size={16} /> Contact Details
                  </h4>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Primary Phone</label>
                          <input
                            type="text"
                            value={editForm.phone}
                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Alternate Phone</label>
                          <input
                            type="text"
                            value={editForm.alternatePhone}
                            onChange={e => setEditForm({ ...editForm, alternatePhone: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Address</label>
                        <input
                          type="text"
                          value={editForm.address}
                          onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">City</label>
                          <input
                            type="text"
                            value={editForm.city}
                            onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">State</label>
                          <input
                            type="text"
                            value={editForm.state}
                            onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Pincode</label>
                          <input
                            type="text"
                            value={editForm.pincode}
                            onChange={e => setEditForm({ ...editForm, pincode: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>

                {/* Educational Background */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <GraduationCap size={16} /> Educational Background
                  </h4>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Qualification</label>
                          <input
                            type="text"
                            value={editForm.qualification}
                            onChange={e => setEditForm({ ...editForm, qualification: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Passing Year</label>
                          <input
                            type="text"
                            value={editForm.passingYear}
                            onChange={e => setEditForm({ ...editForm, passingYear: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Institution</label>
                        <input
                          type="text"
                          value={editForm.institution}
                          onChange={e => setEditForm({ ...editForm, institution: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Course Preference</label>
                        <input
                          type="text"
                          value={editForm.coursePreference}
                          onChange={e => setEditForm({ ...editForm, coursePreference: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>

                {/* Verification & System Info */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <CreditCard size={16} /> ID Verification & System Metadata
                  </h4>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">ID Document Type</label>
                        <select
                          value={editForm.identityType}
                          onChange={e => setEditForm({ ...editForm, identityType: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase"
                        >
                          <option value="aadhaar">Aadhaar Card</option>
                          <option value="passport">Passport</option>
                          <option value="driving_license">Driving License</option>
                          <option value="voter_id">Voter ID</option>
                          <option value="pancard">PAN Card</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">ID Document Number</label>
                        <input
                          type="text"
                          value={editForm.identityNumber}
                          onChange={e => setEditForm({ ...editForm, identityNumber: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>

              </div>

              {/* Bottom Actions when Editing */}
              {isEditing && (
                <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <button
                    onClick={handleCancelEditing}
                    disabled={saving}
                    className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
                  </button>
                </div>
              )}

            </div>
          )}

          {/* Modal Footer Bar */}
          <div className="px-8 py-4 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Student ID: {student.studentId || student.student_id || student.employeeId || 'N/A'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <X size={16} /> Close Profile
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default StudentProfileModal;
