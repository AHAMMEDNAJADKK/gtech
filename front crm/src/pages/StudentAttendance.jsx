import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx'; 
import { 
  Search, Calendar as CalendarIcon, GraduationCap, Loader2, LayoutGrid, List, 
  ChevronLeft, ChevronRight, UserCheck, UserPlus, ShieldCheck, AlertCircle, 
  CheckCircle2, XCircle, X, User, Mail, Lock, Phone, ShieldPlus, CreditCard,
  Download, FileSpreadsheet, Eye, Edit, MapPin, BookOpen, Camera, Upload, ImageIcon
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import { useToast } from '../components/ToastProvider';
import StudentProfileModal from '../components/StudentProfileModal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const STUDENT_ROLE_ID = "10"; 

const FormInput = ({ label, name, type = "text", icon, onChange, value, placeholder = "", required = false }) => (
  <div className="space-y-1">
    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
      <input 
        required={required} 
        name={name} 
        type={type} 
        value={value} 
        placeholder={placeholder}
        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all text-sm" 
        onChange={onChange} 
      />
    </div>
  </div>
);

const initialFormState = {
  name: '', email: '', password: '', phone: '', status: 'active',
  designation_id: '10', joining_date: new Date().toISOString().split('T')[0],
  address: '', identityType: 'aadhaar', identityNumber: '', profile_image: '',
  dateOfBirth: '', gender: '', alternatePhone: '', city: '', state: '', pincode: '',
  qualification: '', institution: '', passingYear: '', coursePreference: ''
};

const StudentAttendance = () => {
  const [students, setStudents] = useState([]);
  const { showToast } = useToast();
  const [totalStudents, setTotalStudents] = useState(0);
  const [attendanceData, setAttendanceData] = useState({}); 
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); 
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Course & Batch context filters
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  // Registration & Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [imagePreview, setImagePreview] = useState(null);

  // Student Profile Overview Modal State
  const [selectedProfileStudentId, setSelectedProfileStudentId] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchCoursesAndBatches = useCallback(async () => {
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');

      let cList = [];
      const cRes = await fetch(`${cleanBase}/v1/academy/courses`, { headers: getHeaders() });
      if (cRes.ok) {
        const cData = await cRes.json();
        cList = cData?.data || cData?.courses || (Array.isArray(cData) ? cData : []);
        setCourses(cList);
      }

      let bList = [];
      const bRes = await fetch(`${cleanBase}/v1/academy/batches`, { headers: getHeaders() });
      if (bRes.ok) {
        const bData = await bRes.json();
        bList = bData?.data || bData?.batches || (Array.isArray(bData) ? bData : []);
        setBatches(bList);
      }

      if (cList.length === 1) {
        const singleCourseId = cList[0]._id || cList[0].id;
        setSelectedCourseId(singleCourseId);
        const availB = bList.filter(b => String(b.courseId?._id || b.courseId) === String(singleCourseId));
        if (availB.length === 1) {
          setSelectedBatchId(availB[0]._id || availB[0].id);
        }
      } else if (bList.length === 1) {
        const singleBatchId = bList[0]._id || bList[0].id;
        setSelectedBatchId(singleBatchId);
        if (bList[0].courseId) {
          setSelectedCourseId(bList[0].courseId?._id || bList[0].courseId);
        }
      }
    } catch (err) {
      console.error("Fetch Courses/Batches Error:", err);
    }
  }, [getHeaders]);

  const syncAttendance = useCallback(async () => {
    try {
      let endpoint = `${API_BASE}/attendance/student/${selectedDate}`;
      const params = new URLSearchParams();
      if (selectedBatchId) params.append('batchId', selectedBatchId);
      if (selectedCourseId) params.append('courseId', selectedCourseId);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const res = await fetch(endpoint, {
        headers: getHeaders(),
      });

      if (!res.ok) return;

      const data = await res.json();
      const records = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

      const map = {};
      records.forEach((record) => {
        const stId = record.user_id?._id || record.user_id || record.studentId;
        if (stId) {
          map[stId] = {
            status: record.status?.toUpperCase() || "UNMARKED",
            id: record._id || record.id,
          };
        }
      });

      setAttendanceData(map);
    } catch (e) {
      console.error("Sync Error", e);
    }
  }, [selectedDate, selectedBatchId, selectedCourseId, getHeaders]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const cleanBase = (API_BASE || '/api').replace(/\/$/, '');
      const endpoint = cleanBase.endsWith('/v1')
        ? `${cleanBase}/users?role=student&limit=500`
        : `${cleanBase}/v1/users?role=student&limit=500`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      
      if (!res.ok) {
        const fallbackRes = await fetch(`${cleanBase}/user/?role=student&limit=500`, { headers: getHeaders() });
        if (!fallbackRes.ok) return;
        const fbData = await fallbackRes.json();
        const fbUsers = fbData?.users || fbData?.data?.users || fbData?.data || fbData?.results || [];
        setStudents(fbUsers);
        setTotalStudents(fbData?.pagination?.total || fbData?.total || fbUsers.length);
        await syncAttendance();
        return;
      }
      
      const responseData = await res.json();
      const allUsers = responseData?.users || responseData?.data?.users || responseData?.data || responseData?.results || (Array.isArray(responseData) ? responseData : []);
      
      const studentList = Array.isArray(allUsers) ? allUsers.filter(u => {
        const rawRole = u.role_id ?? u.role ?? u.role?.id ?? u.role?.role_id;
        const roleId = String(rawRole || '').toLowerCase();
        return roleId === '10' || roleId === '4' || roleId === 'student';
      }) : [];

      setStudents(studentList);
      setTotalStudents(responseData?.pagination?.total || responseData?.total || studentList.length);
      await syncAttendance();
    } catch (e) {
      console.error("Fetch Error", e);
    } finally {
      setLoading(false);
    }
  }, [getHeaders, syncAttendance]);

  useEffect(() => {
    fetchCoursesAndBatches();
    fetchStudents();
  }, [fetchCoursesAndBatches, fetchStudents]);

  useEffect(() => {
    syncAttendance();
  }, [selectedDate, selectedBatchId, selectedCourseId, syncAttendance]);

  const getFilteredStudents = () => {
    let filtered = students.filter(s => {
      const nameMatch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const idMatch = (s.studentId || s.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || emailMatch || idMatch;
    });

    if (selectedBatchId && selectedBatchId !== 'ALL' && selectedBatchId !== '') {
      const activeBatch = batches.find(b => String(b._id || b.id) === String(selectedBatchId));
      if (activeBatch && Array.isArray(activeBatch.students)) {
        const bStudentIds = activeBatch.students.map(st => String(st._id || st.id || st));
        filtered = filtered.filter(s => bStudentIds.includes(String(s._id || s.id)));
      }
    }

    return filtered;
  };

  const filteredStudents = getFilteredStudents();
  const totalFilteredCount = filteredStudents.length;
  const totalPages = Math.ceil(totalFilteredCount / PAGE_SIZE) || 1;
  const displayedStudents = filteredStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCourseId, selectedBatchId]);

  const exportToExcel = () => {
    const dataToExport = getFilteredStudents().map(s => ({
      'Student Name': s.name.toUpperCase(),
      'Email': s.email,
      'Date': selectedDate,
      'Attendance Status': (attendanceData[s._id || s.id]?.status || 'UNMARKED')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AttendanceReport");
    XLSX.writeFile(workbook, `Attendance_Report_${selectedDate}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Student Name", "Email", "Date", "Status"];
    const tableRows = [];

    getFilteredStudents().forEach(s => {
      const studentData = [
        s.name.toUpperCase(),
        s.email,
        selectedDate,
        (attendanceData[s._id || s.id]?.status || 'UNMARKED')
      ];
      tableRows.push(studentData);
    });

    doc.setFontSize(18);
    doc.text("ATTENDANCE CONTROL REPORT", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report Date: ${selectedDate}`, 14, 30);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { 
        fillColor: [79, 70, 229], 
        halign: 'center' 
      },
      styles: { fontSize: 8, cellPadding: 4 },
    });

    doc.save(`Attendance_Report_${selectedDate}.pdf`);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size should be less than 10MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 350;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setImagePreview(compressedBase64);
        setFormData(prev => ({
          ...prev,
          profile_image: compressedBase64
        }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setFormData(initialFormState);
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student) => {
    setEditingStudent(student);
    const existingImg = student.profile_image || student.avatar || '';
    setImagePreview(existingImg || null);

    let formattedDob = '';
    if (student.dateOfBirth) {
      try {
        const dobStr = String(student.dateOfBirth);
        formattedDob = dobStr.includes('T') ? dobStr.split('T')[0] : new Date(dobStr).toISOString().split('T')[0];
      } catch (e) {
        formattedDob = student.dateOfBirth || '';
      }
    }

    setFormData({
      name: student.name || '',
      email: student.email || '',
      password: '',
      phone: student.phone || '',
      status: student.status || 'active',
      designation_id: '10',
      joining_date: student.joining_date ? new Date(student.joining_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      address: student.address || '',
      identityType: student.identityType || 'aadhaar',
      identityNumber: student.identityNumber || '',
      profile_image: existingImg,
      dateOfBirth: formattedDob,
      gender: student.gender || '',
      alternatePhone: student.alternatePhone || '',
      city: student.city || '',
      state: student.state || '',
      pincode: student.pincode || '',
      qualification: student.qualification || '',
      institution: student.institution || '',
      passingYear: student.passingYear || '',
      coursePreference: student.coursePreference || ''
    });
    setIsModalOpen(true);
  };

  const handleOpenProfile = (studentId) => {
    setSelectedProfileStudentId(studentId);
    setIsProfileModalOpen(true);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsAddingStudent(true);

    if (!formData.name || !formData.email) {
      showToast('Full Name and Email Address are required.', 'warning');
      setIsAddingStudent(false);
      return;
    }

    if (!editingStudent && !formData.password) {
      showToast('Account Password is required for new registration.', 'warning');
      setIsAddingStudent(false);
      return;
    }

    if (!/^\d{10}$/.test(formData.phone || '')) {
      showToast('Phone number must be exactly 10 digits.', 'warning');
      setIsAddingStudent(false);
      return;
    }

    const idType = formData.identityType;
    const idNum = (formData.identityNumber || '').trim();

    if (!editingStudent && !idNum) {
      showToast('ID Document Number is required.', 'warning');
      setIsAddingStudent(false);
      return;
    }

    let cleanIdentityNumber = idNum;
    if (idNum) {
      if (idType === 'aadhaar') {
        const cleanAadhaar = idNum.replace(/[\s-]/g, '');
        if (!/^\d{12}$/.test(cleanAadhaar)) {
          showToast('Aadhaar Card number must be exactly 12 digits.', 'warning');
          setIsAddingStudent(false);
          return;
        }
        cleanIdentityNumber = cleanAadhaar;
      } else if (idType === 'pancard') {
        const cleanPAN = idNum.toUpperCase();
        if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(cleanPAN)) {
          showToast('Invalid PAN Card format. E.g. ABCDE1234F', 'warning');
          setIsAddingStudent(false);
          return;
        }
        cleanIdentityNumber = cleanPAN;
      }
    }

    const finalPayload = { 
      ...formData, 
      identityNumber: cleanIdentityNumber,
      salary: 1, 
      role_id: STUDENT_ROLE_ID 
    };

    if (editingStudent && !finalPayload.password) {
      delete finalPayload.password;
    }

    try {
      let response;
      if (editingStudent) {
        const editId = editingStudent._id || editingStudent.id;
        response = await fetch(`${API_BASE}/v1/users/update/${editId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(finalPayload),
        });
        if (!response.ok) {
          response = await fetch(`${API_BASE}/v1/users/${editId}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(finalPayload),
          });
        }
      } else {
        response = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
        });
      }

      if (response.ok) {
        setIsModalOpen(false);
        fetchStudents();
        setFormData(initialFormState);
        setImagePreview(null);
        setEditingStudent(null);
        showToast(
          editingStudent ? "Student Profile updated successfully!" : "Student Added successfully!", 
          "success"
        );
      } else {
        let errMsg = "Enrollment failed.";
        try {
          const result = await response.json();
          errMsg = result.detail || result.message || result.error || "Please check registration fields.";
        } catch (parseErr) {
          errMsg = response.statusText || "Please check registration fields.";
        }
        showToast(errMsg, 'error');
      }
    } catch (error) {
      showToast(error.message || "Database connection timeout.", 'error');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleAction = async (studentId, type) => {
    const targetStatus = type.toUpperCase(); 
    const previousState = { ...attendanceData };

    if (!selectedCourseId || !selectedBatchId) {
      showToast("Please select a Course and Batch to mark attendance.", "warning");
      return;
    }
    
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { 
        ...prev[studentId], 
        status: targetStatus 
      }
    }));

    try {
      const res = await fetch(`${API_BASE}/attendance/mark`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          user_id: studentId, 
          batchId: selectedBatchId,
          courseId: selectedCourseId,
          date: selectedDate, 
          status: targetStatus 
        }),
      });
      
      if (res.ok) {
        await syncAttendance(); 
      } else {
        const errData = await res.json().catch(() => ({}));
        setAttendanceData(previousState); 
        showToast(errData.detail || errData.message || "Action failed to write attendance.", 'error');
      }
    } catch (e) { 
      setAttendanceData(previousState);
      showToast("Network disruption detected.", 'error'); 
    }
  };

  useEffect(() => {
    if (isModalOpen || isProfileModalOpen) {
      window.scrollTo(0, 0); 
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, isProfileModalOpen]);

  const activePresenceCount = Object.values(attendanceData).filter(v => v.status === 'PRESENT').length;
  const unresolvedAbsentCount = Object.values(attendanceData).filter(v => v.status === 'ABSENT').length;

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-600 dark:text-slate-200 font-sans selection:bg-white-500/30 transition-colors duration-300">
      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-12">
        
        {/* Top Header Navigation */}
        <nav className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center shadow-[0_8px_30px_rgb(79,70,229,0.3)]">
              <ShieldCheck className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight uppercase">
                Students <span className="text-indigo-600 italic">Attendance</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            {/* Course Selector */}
            <select
              value={selectedCourseId}
              onChange={(e) => {
                const cId = e.target.value;
                setSelectedCourseId(cId);
                const availB = batches.filter(b => !cId || String(b.courseId?._id || b.courseId) === String(cId));
                if (availB.length === 1) {
                  setSelectedBatchId(availB[0]._id || availB[0].id);
                } else if (selectedBatchId) {
                  const stillValid = availB.some(b => String(b._id || b.id) === String(selectedBatchId));
                  if (!stillValid) setSelectedBatchId('');
                }
              }}
              className="bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
            >
              <option value="">All Courses</option>
              {courses.map(c => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.courseCode} - {c.courseName}
                </option>
              ))}
            </select>

            {/* Batch Selector */}
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
            >
              <option value="">All Batches</option>
              {batches
                .filter(b => !selectedCourseId || String(b.courseId?._id || b.courseId) === String(selectedCourseId))
                .map(b => (
                  <option key={b._id || b.id} value={b._id || b.id}>
                    {b.batchCode} ({b.batchName})
                  </option>
                ))}
            </select>

            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-3 rounded-xl transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('table')} 
              className={`p-3 rounded-xl transition-all cursor-pointer ${viewMode === 'table' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <List size={20} />
            </button>
            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block" />
            
            <div className="relative flex items-center gap-1 px-4 py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 group">
              <CalendarIcon size={16} className="text-indigo-400" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-indigo-900 dark:text-indigo-400 outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark] tracking-widest"
              />
            </div>
          </div>
        </nav>

        {/* Course & Batch Selection Notice */}
        {(!selectedCourseId || !selectedBatchId) && (
          <div className="mb-8 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4 text-amber-600 dark:text-amber-400 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="flex-shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider">Course & Batch Selection Required</p>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                  Please select both a <strong>Course</strong> and a <strong>Batch</strong> from the top header filter before marking attendance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { label: 'Total Students', value: totalStudents, icon: GraduationCap },
            { label: 'Verified Present Today', value: activePresenceCount, icon: UserCheck },
            { label: 'Confirmed Absent Today', value: unresolvedAbsentCount, icon: AlertCircle },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl flex items-center justify-between group hover:border-indigo-500/20 dark:hover:border-indigo-500/50 transition-all duration-500 shadow-sm">
              <div>
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                <p className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tighter">{stat.value}</p>
              </div>
              <div className="p-5 rounded-2xl bg-white-500/5 dark:bg-indigo-950/20 text-indigo-500 border border-indigo-500/10 dark:border-indigo-500/20 group-hover:scale-110 transition-transform">
                <stat.icon size={28} />
              </div>
            </div>
          ))}
        </div>

        {/* Filter Controls & Primary Action Buttons */}
        <div className="flex flex-col lg:flex-row gap-4 mb-10">
          <div className="relative flex-1 group">
            <input 
              placeholder="Search active page student profiles..." 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={exportToPDF} 
              className="flex-1 lg:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={16} /> PDF Report
            </button>
            <button 
              onClick={exportToExcel} 
              className="flex-1 lg:flex-none bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download size={16} /> Excel Report
            </button>
            <button 
              onClick={handleOpenAddModal} 
              className="flex-1 lg:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <UserPlus size={16} /> Add Student
            </button>
          </div>
        </div>

        {/* Student Grid & Table Views */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Retrieving Encrypted Class Records...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div key="grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedStudents.map(s => {
                  const studentId = s._id || s.id;
                  const status = attendanceData[studentId]?.status || 'UNMARKED';
                  const isPresent = status === 'PRESENT';
                  const isAbsent = status === 'ABSENT';
                  const imgUrl = s.profile_image || s.avatar;

                  return (
                    <motion.div 
                      layout
                      key={studentId} 
                      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 rounded-[2.5rem] hover:shadow-md transition-all relative overflow-hidden shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-8">
                          <div 
                            onClick={() => handleOpenProfile(studentId)}
                            className="w-14 h-14 bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl font-black italic border border-slate-200 dark:border-slate-800 overflow-hidden cursor-pointer group-hover:scale-105 transition-transform flex-shrink-0"
                          >
                            {imgUrl ? (
                              <img src={imgUrl} alt={s.name} className="w-full h-full object-cover" />
                            ) : (
                              s.name ? s.name.charAt(0).toUpperCase() : '?'
                            )}
                          </div>
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-500 ${
                            isPresent ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 
                            isAbsent ? 'bg-red-500 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 
                            'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            {status}
                          </div>
                        </div>

                        <div className="mb-8 cursor-pointer" onClick={() => handleOpenProfile(studentId)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                              {s.studentId || s.student_id || s.employeeId || 'STD'}
                            </span>
                          </div>
                          <h3 className="text-slate-900 dark:text-slate-100 font-bold text-lg leading-tight truncate uppercase tracking-tight hover:text-indigo-600 transition-colors">
                            {s.name}
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1 truncate lowercase opacity-70 tracking-wider">
                            {s.email}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={() => handleOpenProfile(studentId)}
                          className="w-full py-2 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-indigo-600 border border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} /> Profile
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={() => handleAction(studentId, 'present')}
                            className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              isPresent 
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10' 
                              : 'bg-slate-50 dark:bg-slate-950 text-emerald-600 border border-slate-100 dark:border-slate-850 hover:bg-emerald-500 hover:text-white'
                            }`}
                          >
                            <CheckCircle2 size={14} /> {isPresent ? 'Saved' : 'Present'}
                          </button>
                          <button 
                            onClick={() => handleAction(studentId, 'absent')}
                            className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              isAbsent 
                              ? 'bg-red-600 text-white shadow-lg shadow-red-600/10' 
                              : 'bg-slate-50 dark:bg-slate-950 text-red-600 border border-slate-100 dark:border-slate-850 hover:bg-red-500 hover:text-white'
                            }`}
                          >
                            <XCircle size={14} /> {isAbsent ? 'Saved' : 'Absent'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]"> 
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-850">
                        <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Full Student Profile</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] text-right">Database Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedStudents.map((s) => {
                        const studentId = s._id || s.id;
                        const status = attendanceData[studentId]?.status || 'UNMARKED';
                        const imgUrl = s.profile_image || s.avatar;
                        return (
                          <tr key={studentId} className="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-colors group">
                            <td className="px-8 py-6 cursor-pointer" onClick={() => handleOpenProfile(studentId)}>
                              <div className="flex items-center gap-5">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 flex-shrink-0 overflow-hidden">
                                  {imgUrl ? (
                                    <img src={imgUrl} alt={s.name} className="w-full h-full object-cover" />
                                  ) : (
                                    s.name ? s.name.charAt(0).toUpperCase() : '?'
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                                      {s.studentId || s.student_id || s.employeeId || 'STD'}
                                    </span>
                                    <p className="text-slate-900 dark:text-slate-100 font-bold text-sm uppercase tracking-tight truncate hover:text-indigo-600">{s.name}</p>
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase truncate mt-0.5">{s.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${status === 'PRESENT' ? 'text-emerald-500 bg-emerald-500/10' : status === 'ABSENT' ? 'text-red-500 bg-red-500/10' : 'text-slate-500 dark:text-slate-400 bg-slate-500/10 dark:bg-slate-500/20'}`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex justify-end items-center gap-3">
                                <button
                                  onClick={() => handleOpenProfile(studentId)}
                                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-xl transition-all cursor-pointer"
                                  title="View Profile"
                                >
                                  <Eye size={14} />
                                </button>
                                <button 
                                  onClick={() => handleAction(studentId, 'present')} 
                                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${status === 'PRESENT' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white'}`}
                                >
                                  Present
                                </button>
                                <button 
                                  onClick={() => handleAction(studentId, 'absent')} 
                                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${status === 'ABSENT' ? 'bg-red-600 text-white shadow-md' : 'bg-red-500/10 dark:bg-red-800 text-red-500 dark:text-red-400 hover:bg-red-500 hover:text-white'}`}
                                >
                                  Absent
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Pagination Navigation */}
        <div className="mt-16 flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xl">
          <button 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => p - 1)}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
          >
            <ChevronLeft size={18} /> Previous Sequence
          </button>
          
          <div className="hidden md:flex gap-3">
            {[...Array(totalPages)].map((_, i) => (
              <button 
                key={i} 
                onClick={() => setCurrentPage(i + 1)}
                className={`w-12 h-12 rounded-xl text-[10px] font-black transition-all border cursor-pointer ${currentPage === i + 1 ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-200 hover:text-indigo-600'}`}
              >
                {String(i + 1).padStart(2, '0')}
              </button>
            ))}
          </div>

          <button 
            disabled={currentPage * PAGE_SIZE >= totalFilteredCount} 
            onClick={() => setCurrentPage(p => p + 1)}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
          >
            Next Iteration <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Student Profile Overview Modal */}
      <StudentProfileModal
        studentId={selectedProfileStudentId}
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedProfileStudentId(null);
        }}
        onEditStudent={handleOpenEditModal}
        getHeaders={getHeaders}
      />

      {/* Student Registration / Edit Modal */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setIsModalOpen(false)} 
                className="fixed inset-0 cursor-pointer z-0" 
              />

              <motion.div 
                initial={{ y: -20, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: -20, opacity: 0 }} 
                className="relative z-10 w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-10 rounded-[3rem] shadow-2xl overflow-y-auto flex flex-col my-auto"
              >
                <header className="mb-10 flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-slate-100 italic uppercase tracking-tighter">
                      {editingStudent ? 'Edit' : 'Add'} <span className="text-indigo-600">Student</span>
                    </h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-2">
                      Verified Institutional Student Registration Node
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="p-4 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-all bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500"
                  >
                    <X size={24}/>
                  </button>
                </header>

                <form onSubmit={handleRegister} className="space-y-8">
                  
                  {/* STUDENT PROFILE IMAGE UPLOAD SECTION */}
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative w-24 h-24 rounded-3xl bg-slate-200 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center text-slate-400 p-2">
                          <Camera size={28} className="mx-auto mb-1" />
                          <span className="text-[8px] font-black uppercase tracking-wider">No Image</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 flex-1">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <ImageIcon size={16} className="text-indigo-500" /> Student Profile Photo
                      </label>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        Upload official student photograph (JPEG, PNG or WEBP, max 10MB).
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all shadow-md">
                          <Upload size={14} /> Upload Photo
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageFileChange} 
                          />
                        </label>
                        {imagePreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setImagePreview(null);
                              setFormData(prev => ({ ...prev, profile_image: '' }));
                            }}
                            className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 px-3 py-2 border border-rose-200 dark:border-rose-900/50 rounded-xl cursor-pointer"
                          >
                            Remove Image
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 1: Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <User size={14} /> Section 1: Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormInput label="Full Name" name="name" icon={<User size={14}/>} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                      <FormInput label="Email Address" name="email" type="email" icon={<Mail size={14}/>} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                      <FormInput label="Account Password" name="password" type="password" icon={<Lock size={14}/>} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required={!editingStudent} />
                      
                      <FormInput label="Date of Birth" name="dateOfBirth" type="date" icon={<CalendarIcon size={14}/>} value={formData.dateOfBirth} onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})} />
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Gender</label>
                        <select 
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-slate-100 outline-none text-sm focus:border-indigo-500 transition-all cursor-pointer"
                          value={formData.gender}
                          onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <FormInput label="Contact Phone" name="phone" icon={<Phone size={14}/>} value={formData.phone}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setFormData({...formData, phone: digits});
                          }}
                          required
                        />
                        {formData.phone && formData.phone.length !== 10 && (
                          <p className="text-[10px] text-red-500 mt-1 ml-2">Must be exactly 10 digits.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: Contact & Address */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <MapPin size={14} /> Section 2: Contact & Address Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormInput label="Alternate Phone" name="alternatePhone" icon={<Phone size={14}/>} value={formData.alternatePhone} onChange={(e) => setFormData({...formData, alternatePhone: e.target.value})} />
                      <FormInput label="City" name="city" icon={<MapPin size={14}/>} value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                      <FormInput label="State" name="state" icon={<MapPin size={14}/>} value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} />
                      <FormInput label="Pincode" name="pincode" icon={<MapPin size={14}/>} value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} />
                      <div className="md:col-span-2">
                        <FormInput label="Full Residence Address" name="address" icon={<MapPin size={14}/>} value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: Educational Background */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <GraduationCap size={14} /> Section 3: Educational Background & Preference
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <FormInput label="Highest Qualification" name="qualification" icon={<GraduationCap size={14}/>} value={formData.qualification} onChange={(e) => setFormData({...formData, qualification: e.target.value})} placeholder="e.g., B.Tech, MCA" />
                      <FormInput label="Institution / College" name="institution" icon={<BookOpen size={14}/>} value={formData.institution} onChange={(e) => setFormData({...formData, institution: e.target.value})} />
                      <FormInput label="Passing Year" name="passingYear" icon={<CalendarIcon size={14}/>} value={formData.passingYear} onChange={(e) => setFormData({...formData, passingYear: e.target.value})} placeholder="e.g., 2025" />
                      <FormInput label="Course Preference" name="coursePreference" icon={<BookOpen size={14}/>} value={formData.coursePreference} onChange={(e) => setFormData({...formData, coursePreference: e.target.value})} placeholder="e.g., Full Stack Dev" />
                    </div>
                  </div>

                  {/* SECTION 4: Identity Verification */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <CreditCard size={14} /> Section 4: Identity Verification Document
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">ID Type</label>
                        <div className="relative">
                          <ShieldPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                          <select 
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-slate-100 outline-none appearance-none text-sm focus:border-indigo-500 transition-all cursor-pointer" 
                            value={formData.identityType} 
                            onChange={(e) => setFormData({...formData, identityType: e.target.value})}
                          >
                            <option value="aadhaar">Aadhar Card</option>
                            <option value="pancard">PAN Card</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <FormInput label="ID Document Number" name="identityNumber" icon={<CreditCard size={14}/>} value={formData.identityNumber} onChange={(e) => setFormData({...formData, identityNumber: e.target.value})} />
                        {formData.identityNumber && formData.identityType === 'aadhaar' && !/^\d{12}$/.test(formData.identityNumber.replace(/[\s-]/g, '')) && (
                          <p className="text-[10px] text-red-500 mt-1 ml-2">Aadhaar must be exactly 12 digits.</p>
                        )}
                        {formData.identityNumber && formData.identityType === 'pancard' && !/^[A-Za-z]{5}\d{4}[A-Za-z]{1}$/.test(formData.identityNumber) && (
                          <p className="text-[10px] text-red-500 mt-1 ml-2">Invalid PAN format (E.g. ABCDE1234F).</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-3 mt-6">
                    <button 
                      type="submit" 
                      disabled={isAddingStudent} 
                      className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {isAddingStudent ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                      Confirm
                    </button>
                  </div>

                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default StudentAttendance;
