import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, 
  Search, 
  FileText, 
  Phone, 
  MapPin, 
  Upload, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  UserCheck, 
  Send, 
  X, 
  Loader2, 
  Filter,
  Download,
  AlertCircle,
  ChevronDown,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_BASE = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  if (!token) return {};
  const cleanToken = token.replace(/"/g, '');
  return {
    'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
  };
};

const STATUS_OPTIONS = ['New', 'In Progress', 'Shortlisted', 'Interviewing', 'Selected', 'Rejected', 'Hired'];
const INTERVIEW_OPTIONS = ['N/A', 'Pending', 'Scheduled', 'Passed', 'Failed'];
const SELECTED_OPTIONS = ['Pending', 'Selected', 'Not Selected'];
const OFFER_LETTER_OPTIONS = ['N/A', 'Pending', 'Sent', 'Accepted', 'Declined'];

export default function RecruitmentPage() {
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  
  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    status: 'New',
    interview_1: 'Pending',
    interview_2: 'N/A',
    interview_3: 'N/A',
    selected: 'Pending',
    approval_status: 'N/A',
    offer_letter: 'N/A',
    notes: ''
  });
  const [resumeFile, setResumeFile] = useState(null);

  // Fetch candidates from backend
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/recruitment`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.data || []);
      } else {
        showToast('Failed to load candidates', 'error');
      }
    } catch (err) {
      console.error('Error fetching candidates:', err);
      showToast('Error connecting to recruitment server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Filtered candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      const matchesSearch = 
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = selectedStatusFilter === 'All' || c.status === selectedStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [candidates, searchQuery, selectedStatusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = candidates.length;
    const interviewing = candidates.filter(c => c.status === 'Interviewing' || c.interview_1 === 'Scheduled' || c.interview_2 === 'Scheduled' || c.interview_3 === 'Scheduled').length;
    const selectedCount = candidates.filter(c => c.selected === 'Selected' || c.status === 'Selected').length;
    const offerSentCount = candidates.filter(c => c.offer_letter === 'Sent' || c.offer_letter === 'Accepted').length;

    return { total, interviewing, selectedCount, offerSentCount };
  }, [candidates]);

  // Reset form
  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      address: '',
      status: 'New',
      interview_1: 'Pending',
      interview_2: 'N/A',
      interview_3: 'N/A',
      selected: 'Pending',
      approval_status: 'N/A',
      offer_letter: 'N/A',
      notes: ''
    });
    setResumeFile(null);
    setEditingCandidate(null);
  };

  // Open modal for edit
  const openEditModal = (candidate) => {
    setEditingCandidate(candidate);
    setForm({
      name: candidate.name || '',
      phone: candidate.phone || '',
      address: candidate.address || '',
      status: candidate.status || 'New',
      interview_1: candidate.interview_1 || 'Pending',
      interview_2: candidate.interview_2 || 'N/A',
      interview_3: candidate.interview_3 || 'N/A',
      selected: candidate.selected || 'Pending',
      approval_status: candidate.approval_status || 'N/A',
      offer_letter: candidate.offer_letter || 'N/A',
      notes: candidate.notes || ''
    });
    setResumeFile(null);
    setIsAddModalOpen(true);
  };

  // Get clean viewable URL for resume file
  const getResumeUrl = (path) => {
    if (!path || typeof path !== 'string') return null;

    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
      let cleanUrl = path;
      if (path.includes('res.cloudinary.com')) {
        cleanUrl = cleanUrl
          .replace('/raw/upload/', '/image/upload/')
          .replace('/image/upload/fl_inline/', '/image/upload/');
      }
      return cleanUrl;
    }

    const cleanPath = path.replace(/^\//, '');
    const rawApiUrl = import.meta.env.VITE_API_URL || '';
    const backendHost = rawApiUrl ? rawApiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '') : window.location.origin;
    return `${backendHost}/${cleanPath}`;
  };

  // Open resume in new tab or trigger blob download
  const handleOpenResume = (rawUrl, fileName) => {
    if (!rawUrl) return;
    const url = getResumeUrl(rawUrl);
    if (!url) return;

    if (url.startsWith('data:')) {
      try {
        const parts = url.split(';base64,');
        const contentType = parts[0].replace('data:', '');
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);

        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }

        const blob = new Blob([uInt8Array], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank');
        if (!win) {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName || 'Resume';
          a.click();
        }
      } catch (e) {
        console.error('Failed to open base64 resume blob:', e);
        showToast('Could not open resume file', 'error');
      }
    } else {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = fileName || 'Resume';
        a.click();
      }
    }
  };

  // Handle form submit (Add or Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      showToast('Please enter both Name and Phone number', 'error');
      return;
    }

    try {
      setSubmitting(true);

      const url = editingCandidate 
        ? `${API_BASE}/recruitment/${editingCandidate.id || editingCandidate._id}` 
        : `${API_BASE}/recruitment`;
      
      const method = editingCandidate ? 'PUT' : 'POST';
      let requestOptions = {};

      if (resumeFile) {
        const formData = new FormData();
        formData.append('name', form.name.trim());
        formData.append('phone', form.phone.trim());
        formData.append('address', form.address.trim());
        formData.append('status', form.status);
        formData.append('interview_1', form.interview_1);
        formData.append('interview_2', form.interview_2);
        formData.append('interview_3', form.interview_3);
        formData.append('selected', form.selected);
        formData.append('approval_status', form.approval_status);
        formData.append('offer_letter', form.offer_letter);
        formData.append('notes', form.notes.trim());
        formData.append('resume', resumeFile);

        requestOptions = {
          method,
          headers: getAuthHeaders(),
          body: formData
        };
      } else {
        const payload = {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          status: form.status,
          interview_1: form.interview_1,
          interview_2: form.interview_2,
          interview_3: form.interview_3,
          selected: form.selected,
          approval_status: form.approval_status,
          offer_letter: form.offer_letter,
          notes: form.notes.trim()
        };

        requestOptions = {
          method,
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        };
      }

      const res = await fetch(url, requestOptions);

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(editingCandidate ? 'Candidate updated successfully' : 'Candidate added successfully', 'success');
        setIsAddModalOpen(false);
        resetForm();
        fetchCandidates();
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (err) {
      console.error('Error saving candidate:', err);
      showToast('Failed to save candidate details', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Inline single field update directly from table
  const handleInlineUpdate = async (candidateId, fieldName, newValue) => {
    try {
      // Optimistic update in UI
      setCandidates(prev => prev.map(c => {
        if ((c.id || c._id) === candidateId) {
          const updated = { ...c, [fieldName]: newValue };
          if (fieldName === 'selected') {
            if (newValue === 'Selected' && c.approval_status !== 'Approved') {
              updated.approval_status = 'Pending';
            } else if (newValue !== 'Selected' && c.approval_status !== 'Approved') {
              updated.approval_status = 'N/A';
            }
          }
          return updated;
        }
        return c;
      }));

      const res = await fetch(`${API_BASE}/recruitment/${candidateId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [fieldName]: newValue })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Updated ${fieldName.replace('_', ' ')}`, 'info');
        fetchCandidates(); // Sync full state with backend
      } else {
        showToast(data.message || 'Inline update failed', 'error');
        fetchCandidates(); // Revert on failure
      }
    } catch (err) {
      console.error('Error during inline update:', err);
      showToast('Failed to update candidate field', 'error');
      fetchCandidates();
    }
  };

  // Delete candidate confirmation handler
  const handleConfirmDelete = async () => {
    if (!candidateToDelete) return;
    const candidateId = candidateToDelete.id || candidateToDelete._id;

    try {
      const res = await fetch(`${API_BASE}/recruitment/${candidateId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        showToast('Candidate deleted successfully', 'info');
        setCandidates(prev => prev.filter(c => (c.id || c._id) !== candidateId));
      } else {
        showToast('Failed to delete candidate', 'error');
      }
    } catch (err) {
      console.error('Error deleting candidate:', err);
      showToast('Error deleting candidate record', 'error');
    } finally {
      setCandidateToDelete(null);
    }
  };

  // Render inline select dropdown badges
  const renderInlineSelect = (candidateId, fieldName, value, options, colorMap, disabled = false, disabledTitle = '') => {
    const activeColor = colorMap[value] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';

    if (disabled) {
      return (
        <div className="relative inline-block" title={disabledTitle}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-80">
            <Lock size={11} className="text-amber-500 shrink-0" />
            <span>{value || 'N/A'}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative inline-block">
        <select
          value={value}
          onChange={(e) => handleInlineUpdate(candidateId, fieldName, e.target.value)}
          className={`appearance-none cursor-pointer pl-2.5 pr-6 py-1 rounded-lg text-[11px] font-bold border transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500/30 ${activeColor}`}
        >
          {options.map(opt => (
            <option key={opt} value={opt} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
      </div>
    );
  };

  // Render approval status badge
  const renderApprovalBadge = (approvalStatus, isSelected) => {
    if (!isSelected) {
      return <span className="text-[10px] text-slate-400 italic">N/A</span>;
    }
    const norm = String(approvalStatus || 'Pending').toUpperCase();
    if (norm === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="Approved by MD/Executive">
          <CheckCircle2 size={12} /> Approved
        </span>
      );
    }
    if (norm === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800" title="Rejected by MD/Executive">
          <XCircle size={12} /> Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="Pending MD/Executive Approval on Approvals Page">
        <Clock size={12} /> Pending MD Approval
      </span>
    );
  };

  // Badge Color Mappings
  const statusColorMap = {
    'New': 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    'In Progress': 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'Shortlisted': 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    'Interviewing': 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    'Selected': 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    'Rejected': 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    'Hired': 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-extrabold'
  };

  const interviewColorMap = {
    'N/A': 'bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800',
    'Pending': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    'Scheduled': 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    'Passed': 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold',
    'Failed': 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
  };

  const selectedColorMap = {
    'Pending': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    'Selected': 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-black',
    'Not Selected': 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
  };

  const offerColorMap = {
    'N/A': 'bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800',
    'Pending': 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'Sent': 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-bold',
    'Accepted': 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-black',
    'Declined': 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#0b0c10] text-slate-900 dark:text-slate-100 p-4 lg:p-8 space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
              <UserCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Recruitment Directory
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Manage candidate applications, interview rounds, selection statuses, MD approvals, and offer letters.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all cursor-pointer shrink-0"
        >
          <UserPlus size={16} />
          <span>+ Add Candidate</span>
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">Total Candidates</span>
            <span className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.total}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 bg-purple-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-purple-500/20">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">In Interviewing</span>
            <span className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.interviewing}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">Selected</span>
            <span className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.selectedCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Send size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">Offer Letter Sent</span>
            <span className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.offerSentCount}</span>
          </div>
        </div>
      </div>

      {/* Table Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate by name, phone, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 pl-9 pr-4 py-2 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter size={11} /> Filter:
          </span>
          {['All', ...STATUS_OPTIONS].map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                selectedStatusFilter === st
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Recruitment Candidates Interactive Data Table */}
      <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
            <span className="text-xs font-bold">Loading candidate directory...</span>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <AlertCircle size={28} className="text-slate-300 dark:text-slate-600" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">No candidate records found</span>
            <p className="text-[11px] text-slate-400 text-center max-w-sm">
              {searchQuery || selectedStatusFilter !== 'All' 
                ? 'Try adjusting your search query or status filter.'
                : 'Click "+ Add Candidate" above to record your first applicant.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3.5 px-4">Candidate</th>
                  <th className="py-3.5 px-3">Address</th>
                  <th className="py-3.5 px-3">Resume</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Interview 1</th>
                  <th className="py-3.5 px-3">Interview 2</th>
                  <th className="py-3.5 px-3">Interview 3</th>
                  <th className="py-3.5 px-3">Selected</th>
                  <th className="py-3.5 px-3">Approval Status</th>
                  <th className="py-3.5 px-3">Offer Letter</th>
                  <th className="py-3.5 px-3">Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredCandidates.map((c) => {
                  const candidateId = c.id || c._id;
                  const isSelected = c.selected === 'Selected';
                  const isApproved = c.approval_status === 'Approved';
                  const offerDisabled = isSelected && !isApproved;

                  return (
                    <tr key={candidateId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group">
                      {/* Candidate Name & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md shadow-indigo-500/10 shrink-0">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs leading-snug">
                              {c.name}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone size={10} className="text-slate-400" />
                              {c.phone}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="py-3.5 px-3 max-w-[160px]">
                        {c.address ? (
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate block text-[11px] flex items-center gap-1" title={c.address}>
                            <MapPin size={10} className="text-slate-400 shrink-0" />
                            {c.address}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Not provided</span>
                        )}
                      </td>

                      {/* Resume Download / View Link */}
                      <td className="py-3.5 px-3">
                        {c.resume_url ? (
                          <button
                            type="button"
                            onClick={() => handleOpenResume(c.resume_url, c.resume_name)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-all cursor-pointer"
                            title={c.resume_name || 'View Resume'}
                          >
                            <FileText size={12} className="text-indigo-500" />
                            <span className="truncate max-w-[90px]">{c.resume_name || 'Resume'}</span>
                            <Download size={10} className="opacity-60" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No File</span>
                        )}
                      </td>

                      {/* Status (Inline Select) */}
                      <td className="py-3.5 px-3">
                        {renderInlineSelect(candidateId, 'status', c.status || 'New', STATUS_OPTIONS, statusColorMap)}
                      </td>

                      {/* Interview 1 (Inline Select) */}
                      <td className="py-3.5 px-3">
                        {renderInlineSelect(candidateId, 'interview_1', c.interview_1 || 'Pending', INTERVIEW_OPTIONS, interviewColorMap)}
                      </td>

                      {/* Interview 2 (Inline Select) */}
                      <td className="py-3.5 px-3">
                        {renderInlineSelect(candidateId, 'interview_2', c.interview_2 || 'N/A', INTERVIEW_OPTIONS, interviewColorMap)}
                      </td>

                      {/* Interview 3 (Inline Select) */}
                      <td className="py-3.5 px-3">
                        {renderInlineSelect(candidateId, 'interview_3', c.interview_3 || 'N/A', INTERVIEW_OPTIONS, interviewColorMap)}
                      </td>

                      {/* Selected (Inline Select) */}
                      <td className="py-3.5 px-3">
                        {renderInlineSelect(candidateId, 'selected', c.selected || 'Pending', SELECTED_OPTIONS, selectedColorMap)}
                      </td>

                      {/* Approval Status Badge */}
                      <td className="py-3.5 px-3">
                        {renderApprovalBadge(c.approval_status, isSelected)}
                      </td>

                      {/* Offer Letter (Inline Select - Gated if Selected and Not Approved) */}
                      <td className="py-3.5 px-3">
                        {renderInlineSelect(
                          candidateId, 
                          'offer_letter', 
                          c.offer_letter || 'N/A', 
                          OFFER_LETTER_OPTIONS, 
                          offerColorMap,
                          offerDisabled,
                          'Candidate requires MD/Executive approval on the Approvals page before offer letter can be enabled'
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-3 max-w-[150px]">
                        {c.notes ? (
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate block text-[11px]" title={c.notes}>
                            {c.notes}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                            title="Edit Candidate Details"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => setCandidateToDelete(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Candidate Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {editingCandidate ? 'Edit Candidate Record' : 'Add New Candidate'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Fill out applicant details, upload resume file, and configure interview stages.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Candidate Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Address (Optional) */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sector 62, Noida, Uttar Pradesh"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional candidate comments or notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              {/* Resume / Document File Upload */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Resume / CV File <span className="text-slate-400 font-normal">(PDF, DOC, Images)</span>
                </label>
                
                <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-4 text-center transition-all bg-slate-50/50 dark:bg-slate-950/40 cursor-pointer group">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setResumeFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload size={20} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {resumeFile ? resumeFile.name : (editingCandidate?.resume_name ? `Current: ${editingCandidate.resume_name} (Click to replace)` : 'Click or drag resume file to upload')}
                    </span>
                    <span className="text-[10px] text-slate-400">Supports PDF, DOC, DOCX, PNG, JPG</span>
                  </div>
                </div>
              </div>

              {/* Stage Selectors */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">
                  Initial Pipeline & Interview Stages
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Overall Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Interview 1</label>
                    <select
                      value={form.interview_1}
                      onChange={(e) => setForm({ ...form, interview_1: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                    >
                      {INTERVIEW_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Interview 2</label>
                    <select
                      value={form.interview_2}
                      onChange={(e) => setForm({ ...form, interview_2: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                    >
                      {INTERVIEW_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Interview 3</label>
                    <select
                      value={form.interview_3}
                      onChange={(e) => setForm({ ...form, interview_3: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                    >
                      {INTERVIEW_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Selected Status</label>
                    <select
                      value={form.selected}
                      onChange={(e) => {
                        const val = e.target.value;
                        let newApproval = form.approval_status;
                        if (val === 'Selected' && newApproval !== 'Approved') {
                          newApproval = 'Pending';
                        } else if (val !== 'Selected' && newApproval !== 'Approved') {
                          newApproval = 'N/A';
                        }
                        setForm({ ...form, selected: val, approval_status: newApproval });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                    >
                      {SELECTED_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Offer Letter</label>
                    {form.selected === 'Selected' && form.approval_status !== 'Approved' ? (
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5" title="Requires MD/Executive approval on the Approvals page">
                        <Lock size={12} className="text-amber-500 shrink-0" />
                        <span>{form.offer_letter || 'N/A'} (Approval Required)</span>
                      </div>
                    ) : (
                      <select
                        value={form.offer_letter}
                        onChange={(e) => setForm({ ...form, offer_letter: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                      >
                        {OFFER_LETTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  <span>{editingCandidate ? 'Save Changes' : 'Add Candidate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Candidate Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(candidateToDelete)}
        onClose={() => setCandidateToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Candidate Record"
        message={`Are you sure you want to delete candidate "${candidateToDelete?.name || ''}"? This action cannot be undone.`}
        confirmText="Delete Candidate"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
