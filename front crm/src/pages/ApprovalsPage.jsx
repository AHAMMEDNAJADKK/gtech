import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  DollarSign,
  Search,
  CheckSquare,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  FileText,
  Sparkles,
  ShieldCheck,
  Check,
  LayoutGrid,
  List,
  UserCheck,
  UserPlus,
  Phone,
  MapPin,
  Download,
  Edit3
} from 'lucide-react';
import {
  getSalaryPayments,
  approveOrRejectSalaryPayment,
  approveAllSalaryPayments,
  getExpenses,
  approveOrRejectExpense,
  updateExpense,
  getExpenseCategories
} from '../services/accountsService';

const rawApiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_BASE = rawApiBase.endsWith('/v1') ? rawApiBase : `${rawApiBase}/v1`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export default function ApprovalsPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('leave'); // 'leave' | 'salary' | 'expense' | 'recruitment'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [loading, setLoading] = useState(false);

  // Leave Approvals State
  const [leaves, setLeaves] = useState([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('ALL');
  const [leaveSearch, setLeaveSearch] = useState('');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveActionType, setLeaveActionType] = useState(null); // 'APPROVED' | 'REJECTED'
  const [leaveComment, setLeaveComment] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  // Salary Approvals State
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [salaryStatusFilter, setSalaryStatusFilter] = useState('ALL');
  const [salarySearch, setSalarySearch] = useState('');
  const [selectedSalary, setSelectedSalary] = useState(null); // for rejection reason modal
  const [rejectionReason, setRejectionReason] = useState('');
  const [salarySubmitting, setSalarySubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Expense Approvals State (> 1000 INR)
  const [expenses, setExpenses] = useState([]);
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('ALL');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // Edit Expense State
  const [isEditExpenseModalOpen, setIsEditExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editExpenseForm, setEditExpenseForm] = useState({
    date: '',
    paidTo: '',
    category: '',
    paymentMode: 'Cash',
    amount: '',
    description: ''
  });
  const [expenseCategoriesList, setExpenseCategoriesList] = useState([]);

  // Recruitment Approvals State
  const [recruitmentCandidates, setRecruitmentCandidates] = useState([]);
  const [recruitmentStatusFilter, setRecruitmentStatusFilter] = useState('ALL');
  const [recruitmentSearch, setRecruitmentSearch] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [recruitmentSubmitting, setRecruitmentSubmitting] = useState(false);

  // Messages
  const [toastMsg, setToastMsg] = useState({ type: '', text: '' });

  const showToast = (text, type = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg({ type: '', text: '' }), 4000);
  };

  // Fetch Leave Requests for MD
  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = `${API_BASE}/leaves/all?status=${leaveStatusFilter}&search=${encodeURIComponent(leaveSearch)}`;
      const res = await fetch(endpoint, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setLeaves(data.data || []);
      } else {
        setLeaves([]);
      }
    } catch (err) {
      console.error('Error fetching leaves:', err);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, [leaveStatusFilter, leaveSearch]);

  // Fetch Salary Payments for MD
  const fetchSalaryPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalaryPayments();
      if (res.success) {
        setSalaryPayments(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching salary payments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Expense Approvals (> 1000 INR) for MD
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExpenses({ status: expenseStatusFilter, search: expenseSearch });
      if (res.success) {
        setExpenses(res.data || []);
      } else {
        setExpenses([]);
      }
    } catch (err) {
      console.error('Error fetching expenses for MD:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [expenseStatusFilter, expenseSearch]);

  // Fetch Recruitment Candidates for Approval
  const fetchRecruitmentCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/recruitment`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setRecruitmentCandidates(data.data || []);
      } else {
        setRecruitmentCandidates([]);
      }
    } catch (err) {
      console.error('Error fetching recruitment candidates:', err);
      setRecruitmentCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'leave') {
      fetchLeaves();
    } else if (activeTab === 'salary') {
      fetchSalaryPayments();
    } else if (activeTab === 'expense') {
      fetchExpenses();
    } else if (activeTab === 'recruitment') {
      fetchRecruitmentCandidates();
    }
  }, [activeTab, fetchLeaves, fetchSalaryPayments, fetchExpenses, fetchRecruitmentCandidates]);

  // Handle Single Expense Approve
  const handleApproveExpense = async (expenseId) => {
    setExpenseSubmitting(true);
    try {
      const res = await approveOrRejectExpense(expenseId, { action: 'APPROVED' });
      if (res.success) {
        showToast('Expense approved successfully!');
        fetchExpenses();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to approve expense.', 'error');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  // Handle Single Expense Reject Submit
  const handleRejectExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExpense) return;

    if (!rejectionReason.trim()) {
      showToast('Please enter a reason for rejecting the expense.', 'error');
      return;
    }

    setExpenseSubmitting(true);
    try {
      const res = await approveOrRejectExpense(selectedExpense._id, {
        action: 'REJECTED',
        rejectionReason: rejectionReason.trim()
      });
      if (res.success) {
        showToast('Expense rejected with specified reason.');
        setSelectedExpense(null);
        setRejectionReason('');
        fetchExpenses();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject expense.', 'error');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const fetchExpenseCategoriesList = async () => {
    try {
      const res = await getExpenseCategories();
      if (Array.isArray(res)) {
        setExpenseCategoriesList(res);
      } else if (res?.data && Array.isArray(res.data)) {
        setExpenseCategoriesList(res.data);
      }
    } catch (err) {
      console.warn('Error loading categories:', err);
    }
  };

  const handleOpenEditExpense = (exp) => {
    const st = String(exp.status || 'PENDING').toUpperCase();
    if (st === 'APPROVED') {
      showToast('Approved expenses cannot be edited.', 'error');
      return;
    }
    setEditingExpense(exp);
    let expDate = new Date().toISOString().split('T')[0];
    if (exp.date) {
      try {
        expDate = new Date(exp.date).toISOString().split('T')[0];
      } catch (e) {}
    }
    setEditExpenseForm({
      date: expDate,
      paidTo: exp.paidTo || '',
      category: exp.category?._id || exp.category || '',
      paymentMode: exp.paymentMode || 'Cash',
      amount: exp.amount !== undefined ? String(exp.amount) : '',
      description: exp.description || ''
    });
    setIsEditExpenseModalOpen(true);
    fetchExpenseCategoriesList();
  };

  const handleSaveExpenseEdit = async (e) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (!editExpenseForm.paidTo || !editExpenseForm.amount) {
      showToast('Please fill in Paid To and Amount.', 'error');
      return;
    }

    setExpenseSubmitting(true);
    try {
      const payload = {
        date: editExpenseForm.date,
        paidTo: editExpenseForm.paidTo.trim(),
        category: editExpenseForm.category || undefined,
        paymentMode: editExpenseForm.paymentMode,
        amount: parseFloat(editExpenseForm.amount) || 0,
        description: editExpenseForm.description ? editExpenseForm.description.trim() : ''
      };

      const res = await updateExpense(editingExpense._id, payload);
      if (res.success || res.data) {
        const updatedRecord = res.data || {};
        showToast('Pending expense updated successfully!');
        setIsEditExpenseModalOpen(false);
        setEditingExpense(null);
        setExpenses(prev => prev.map(e => {
          if (String(e._id || e.id) === String(editingExpense._id)) {
            const selectedCat = expenseCategoriesList.find(c => String(c._id) === String(payload.category));
            return {
              ...e,
              ...updatedRecord,
              date: payload.date || e.date,
              paidTo: payload.paidTo,
              amount: payload.amount,
              totalAmount: payload.amount,
              paymentMode: payload.paymentMode,
              description: payload.description,
              categoryName: selectedCat ? selectedCat.name : (updatedRecord.categoryName || e.categoryName)
            };
          }
          return e;
        }));
        fetchExpenses();
      } else {
        showToast(res.message || 'Failed to update expense.', 'error');
      }
    } catch (err) {
      console.error('Error updating expense:', err);
      showToast('Failed to update pending expense.', 'error');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  // Handle Leave Action Submit
  const handleLeaveActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeave || !leaveActionType) return;

    setLeaveSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leaves/${selectedLeave._id}/action`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: leaveActionType,
          comment: leaveComment,
          approvalType: 'hr' // MD/Executive acts with highest authority
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Leave request ${leaveActionType.toLowerCase()} successfully!`);
        setSelectedLeave(null);
        setLeaveActionType(null);
        fetchLeaves();
      } else {
        showToast(data.message || 'Failed to update leave request.', 'error');
      }
    } catch (err) {
      console.error('Error in leave action:', err);
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  // Handle Single Salary Approve
  const handleApproveSalary = async (paymentId) => {
    setSalarySubmitting(true);
    try {
      const res = await approveOrRejectSalaryPayment(paymentId, { action: 'APPROVED' });
      if (res.success) {
        showToast('Salary payment approved successfully!');
        fetchSalaryPayments();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to approve salary payment.', 'error');
    } finally {
      setSalarySubmitting(false);
    }
  };

  // Handle Single Salary Reject Submit
  const handleRejectSalarySubmit = async (e) => {
    e.preventDefault();
    if (!selectedSalary) return;

    if (!rejectionReason.trim()) {
      showToast('Please enter a reason for rejecting the salary payment.', 'error');
      return;
    }

    setSalarySubmitting(true);
    try {
      const res = await approveOrRejectSalaryPayment(selectedSalary._id, {
        action: 'REJECTED',
        rejectionReason: rejectionReason.trim()
      });
      if (res.success) {
        showToast('Salary payment rejected with specified reason.');
        setSelectedSalary(null);
        setRejectionReason('');
        fetchSalaryPayments();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject salary payment.', 'error');
    } finally {
      setSalarySubmitting(false);
    }
  };

  // Handle Bulk "Approve All" Pending Salary Payments
  const handleApproveAllSalaries = async () => {
    const pendingCount = salaryPayments.filter(p => (p.status || 'PENDING') === 'PENDING').length;
    if (pendingCount === 0) {
      showToast('There are no pending salary payments to approve.', 'info');
      return;
    }

    if (!window.confirm(`Are you sure you want to approve all ${pendingCount} pending salary payment(s) at once?`)) return;

    setBulkSubmitting(true);
    try {
      const res = await approveAllSalaryPayments();
      if (res.success) {
        showToast(`Successfully approved all ${res.modifiedCount || pendingCount} pending salary payment(s)!`);
        fetchSalaryPayments();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to perform bulk salary approval.', 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Handle Single Recruitment Candidate Approve
  const handleApproveRecruitment = async (candidateId) => {
    setRecruitmentSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/recruitment/${candidateId}/approval`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'APPROVED' })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Candidate recruitment approval granted successfully!');
        fetchRecruitmentCandidates();
      } else {
        showToast(data.message || 'Failed to approve candidate.', 'error');
      }
    } catch (err) {
      console.error('Error approving recruitment candidate:', err);
      showToast('Failed to approve candidate.', 'error');
    } finally {
      setRecruitmentSubmitting(false);
    }
  };

  // Handle Single Recruitment Candidate Reject Submit
  const handleRejectRecruitmentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;

    if (!rejectionReason.trim()) {
      showToast('Please enter a reason for rejecting candidate approval.', 'error');
      return;
    }

    setRecruitmentSubmitting(true);
    try {
      const candidateId = selectedCandidate.id || selectedCandidate._id;
      const res = await fetch(`${API_BASE}/recruitment/${candidateId}/approval`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'REJECTED',
          rejectionReason: rejectionReason.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Candidate recruitment approval rejected.');
        setSelectedCandidate(null);
        setRejectionReason('');
        fetchRecruitmentCandidates();
      } else {
        showToast(data.message || 'Failed to reject candidate.', 'error');
      }
    } catch (err) {
      console.error('Error rejecting recruitment candidate:', err);
      showToast('Failed to reject candidate.', 'error');
    } finally {
      setRecruitmentSubmitting(false);
    }
  };

  // Resume Helper
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

  // Status Badge Renderer
  const renderStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5" /> Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3.5 h-3.5" /> Pending MD Review
      </span>
    );
  };

  // Filter Salary Payments
  const filteredSalaries = salaryPayments.filter(p => {
    const pStatus = p.status || 'PENDING';
    const matchesStatus = salaryStatusFilter === 'ALL' || pStatus === salaryStatusFilter;
    const name = (p.employeeName || p.employee?.name || '').toLowerCase();
    const month = (p.month || '').toLowerCase();
    const query = salarySearch.toLowerCase().trim();
    const matchesSearch = !query || name.includes(query) || month.includes(query);
    return matchesStatus && matchesSearch;
  });

  // Filter Recruitment Candidates for Approval
  const filteredRecruitment = recruitmentCandidates.filter(c => {
    const isSelectedCandidate = c.selected === 'Selected' || (c.approval_status && c.approval_status !== 'N/A');
    if (!isSelectedCandidate) return false;

    const normApproval = String(c.approval_status || 'Pending').toUpperCase();
    const matchesStatus = 
      recruitmentStatusFilter === 'ALL' ||
      (recruitmentStatusFilter === 'PENDING' && normApproval === 'PENDING') ||
      (recruitmentStatusFilter === 'APPROVED' && normApproval === 'APPROVED') ||
      (recruitmentStatusFilter === 'REJECTED' && normApproval === 'REJECTED');

    const name = (c.name || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    const address = (c.address || '').toLowerCase();
    const query = recruitmentSearch.toLowerCase().trim();
    const matchesSearch = !query || name.includes(query) || phone.includes(query) || address.includes(query);

    return matchesStatus && matchesSearch;
  });

  const pendingSalaryCount = salaryPayments.filter(p => (p.status || 'PENDING') === 'PENDING').length;
  const pendingRecruitmentCount = recruitmentCandidates.filter(c => (c.selected === 'Selected' || c.approval_status !== 'N/A') && (c.approval_status || 'Pending') === 'Pending').length;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 p-4 md:p-8 space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg.text && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 ${
              toastMsg.type === 'error'
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-emerald-600 text-white border-emerald-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Executive Approvals</h1>
            <p className="text-xs text-slate-500 font-normal">
              Managing Director Approval Command Center for Staff Leaves, Salaries, Expenses & Recruitment
            </p>
          </div>
        </div>

        {activeTab === 'salary' && (
          <button
            onClick={handleApproveAllSalaries}
            disabled={bulkSubmitting || pendingSalaryCount === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            {bulkSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
            Approve All Pending Salaries ({pendingSalaryCount})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('leave')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'leave'
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" /> Leave Approvals
            </button>
            <button
              onClick={() => setActiveTab('salary')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'salary'
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4" /> Salary Approvals
            </button>
            <button
              onClick={() => setActiveTab('expense')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'expense'
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" /> Expense Approvals (&gt; ₹1,000)
            </button>
            <button
              onClick={() => setActiveTab('recruitment')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'recruitment'
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" /> Recruitment Approvals {pendingRecruitmentCount > 0 && `(${pendingRecruitmentCount})`}
            </button>
          </div>

          {/* View Mode Switcher (Grid vs List) */}
          <div className="flex items-center bg-slate-200/50 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab 1 (Leave) Filters */}
        {activeTab === 'leave' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={leaveSearch}
                onChange={(e) => setLeaveSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
            <select
              value={leaveStatusFilter}
              onChange={(e) => setLeaveStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}

        {/* Tab 2 (Salary) Filters */}
        {activeTab === 'salary' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee / month..."
                value={salarySearch}
                onChange={(e) => setSalarySearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
            <select
              value={salaryStatusFilter}
              onChange={(e) => setSalaryStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}

        {/* Tab 3 (Expense) Filters */}
        {activeTab === 'expense' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor / category..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
            <select
              value={expenseStatusFilter}
              onChange={(e) => setExpenseStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval (&gt; ₹1k)</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}

        {/* Tab 4 (Recruitment) Filters */}
        {activeTab === 'recruitment' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate..."
                value={recruitmentSearch}
                onChange={(e) => setRecruitmentSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
            <select
              value={recruitmentStatusFilter}
              onChange={(e) => setRecruitmentStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: LEAVE APPROVALS */}
      {activeTab === 'leave' && (
        loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Loading leave approval requests...</p>
          </div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center gap-3 shadow-xs">
            <FileText className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No leave requests found</p>
            <p className="text-xs text-slate-400">All leave requests have been processed.</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Type & Duration</th>
                    <th className="py-3.5 px-4">Date Range</th>
                    <th className="py-3.5 px-4">Reason</th>
                    <th className="py-3.5 px-4">Stage 1 (TL)</th>
                    <th className="py-3.5 px-4">Stage 2 (HR)</th>
                    <th className="py-3.5 px-4 text-right">Final Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {leaves.map((leave) => (
                    <tr key={leave._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {leave.userName ? leave.userName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{leave.userName || 'Employee'}</div>
                            <div className="text-[10px] text-slate-400">
                              {leave.department || 'General'} {leave.reportingManager ? `• TL: ${leave.reportingManager}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-indigo-700 block">{leave.leaveType}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{leave.totalDays} Day(s)</span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600 whitespace-nowrap">
                        {new Date(leave.startDate).toLocaleDateString()} ➔ {new Date(leave.endDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <p className="text-[11px] text-slate-600 truncate" title={leave.reason}>
                          "{leave.reason}"
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(leave.teamLeadStatus)}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(leave.hrStatus)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {renderStatusBadge(leave.finalStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {leaves.map((leave) => (
                <motion.div
                  key={leave._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:shadow-md transition-all space-y-4 shadow-xs"
                >
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {leave.userName ? leave.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{leave.userName || 'Employee'}</h3>
                          <p className="text-[11px] text-slate-500">
                            {leave.department || 'General'} {leave.reportingManager ? `• TL: ${leave.reportingManager}` : ''}
                          </p>
                        </div>
                      </div>
                      {renderStatusBadge(leave.finalStatus)}
                    </div>

                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-800">
                        <span className="font-semibold text-indigo-700">{leave.leaveType}</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200/80 rounded-md font-bold text-slate-700 text-[11px]">
                          {leave.totalDays} Day(s)
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-500">
                        📅 {new Date(leave.startDate).toLocaleDateString()} ➔ {new Date(leave.endDate).toLocaleDateString()}
                      </div>
                      <div className="text-slate-600 text-xs italic bg-white p-2.5 rounded-lg border border-slate-200/60 font-normal">
                        "{leave.reason}"
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Stage 1: TL</span>
                        <div>{renderStatusBadge(leave.teamLeadStatus)}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Stage 2: HR</span>
                        <div>{renderStatusBadge(leave.hrStatus)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Executive View Only
                    </span>
                    <span className="text-[10px] text-slate-400">Sequential: Stage 1 TL ➔ Stage 2 HR</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      )}

      {/* TAB 2: SALARY APPROVALS */}
      {activeTab === 'salary' && (
        loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Loading salary approvals...</p>
          </div>
        ) : filteredSalaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center gap-3 shadow-xs">
            <DollarSign className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No salary payment records found</p>
            <p className="text-xs text-slate-400">Adjust filters or record new salary payments in Accounts.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {filteredSalaries.map((p) => {
                const status = p.status || 'PENDING';
                return (
                  <motion.div
                    key={p._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:shadow-md transition-all space-y-4 shadow-xs"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{p.employeeName || p.employee?.name || 'Employee'}</h3>
                          <p className="text-[11px] text-slate-500">{p.employee?.designation || 'Staff'}</p>
                        </div>
                        {renderStatusBadge(status)}
                      </div>

                      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Month:</span>
                          <span className="font-bold text-indigo-600">{p.month}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Payment Date:</span>
                          <span className="font-semibold text-slate-700">
                            {new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium">Paid Amount:</span>
                          <span className="font-extrabold text-emerald-600 text-sm">₹{(p.paidAmount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        {status === 'REJECTED' && p.rejectionReason && (
                          <div className="text-[10px] text-rose-600 italic bg-rose-50 p-2 rounded-lg border border-rose-100 mt-1">
                            Reason: "{p.rejectionReason}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-600 border border-slate-200/60">
                        {p.paymentMode}
                      </span>
                      {status === 'PENDING' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedSalary(p);
                              setRejectionReason('');
                            }}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveSalary(p._id)}
                            disabled={salarySubmitting}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Processed {p.actionByName ? `by ${p.actionByName}` : ''}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Payment Date</th>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Month</th>
                    <th className="py-3.5 px-4 text-right">Net Paid Amount (₹)</th>
                    <th className="py-3.5 px-4">Mode</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSalaries.map((p) => {
                    const status = p.status || 'PENDING';
                    const netPaid = p.paidAmount !== undefined ? p.paidAmount : (p.customNetPay !== undefined ? p.customNetPay : p.basicSalary);
                    return (
                      <tr key={p._id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-medium whitespace-nowrap">
                          {new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {p.employeeName || p.employee?.name || 'Employee'}
                          {p.employee?.designation && (
                            <span className="block text-[10px] text-slate-400 font-normal">{p.employee.designation}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-indigo-600">{p.month}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-600 whitespace-nowrap text-sm">
                          ₹{Number(netPaid || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-600 border border-slate-200/60">
                            {p.paymentMode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {renderStatusBadge(status)}
                            {status === 'REJECTED' && p.rejectionReason && (
                              <p className="text-[10px] text-rose-600 italic max-w-xs font-normal">
                                Reason: "{p.rejectionReason}"
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedSalary(p);
                                  setRejectionReason('');
                                }}
                                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveSalary(p._id)}
                                disabled={salarySubmitting}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Processed {p.actionByName ? `by ${p.actionByName}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* TAB 3: EXPENSE APPROVALS (> 1000 INR) */}
      {activeTab === 'expense' && (
        loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Loading expense approvals...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center gap-3 shadow-xs">
            <FileText className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No expense approval records found</p>
            <p className="text-xs text-slate-400">All expenses requiring MD approval (&gt; ₹1,000) have been actioned.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {expenses.map((exp) => {
                const status = exp.status || 'PENDING';
                return (
                  <motion.div
                    key={exp._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:shadow-md transition-all space-y-4 shadow-xs"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-xs">
                            {exp.categoryName || 'Expense'}
                          </span>
                          <h3 className="text-xs font-bold text-slate-900 mt-2">Paid To: {exp.paidTo}</h3>
                        </div>
                        {renderStatusBadge(status)}
                      </div>

                      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Expense Date:</span>
                          <span className="font-semibold text-slate-700">
                            {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Payment Mode:</span>
                          <span className="font-semibold text-slate-700">{exp.paymentMode}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Added By:</span>
                          <span className="font-semibold text-indigo-600">{exp.addedByName || 'System'}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium">Amount:</span>
                          <span className="font-extrabold text-amber-600 text-sm">₹{(exp.amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        {exp.description && (
                          <div className="text-slate-600 text-xs italic bg-white p-2.5 rounded-lg border border-slate-200/60 font-normal">
                            "{exp.description}"
                          </div>
                        )}
                        {status === 'REJECTED' && exp.rejectionReason && (
                          <div className="text-[10px] text-rose-600 italic bg-rose-50 p-2 rounded-lg border border-rose-100 mt-1">
                            Reason: "{exp.rejectionReason}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-amber-600 font-bold">
                        Requires MD Approval (&gt; ₹1k)
                      </span>
                      {status === 'PENDING' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditExpense(exp)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                            title="Edit Pending Expense"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedExpense(exp);
                              setRejectionReason('');
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveExpense(exp._id)}
                            disabled={expenseSubmitting}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Processed {exp.actionByName ? `by ${exp.actionByName}` : ''}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Paid To</th>
                    <th className="py-3.5 px-4">Mode</th>
                    <th className="py-3.5 px-4 text-right">Amount (₹)</th>
                    <th className="py-3.5 px-4">Added By</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {expenses.map((exp) => {
                    const status = exp.status || 'PENDING';
                    return (
                      <tr key={exp._id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-medium whitespace-nowrap">
                          {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {exp.categoryName || 'Expense'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {exp.paidTo}
                          {exp.description && (
                            <span className="block text-[10px] text-slate-400 font-normal truncate max-w-xs">{exp.description}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-600 border border-slate-200/60">
                            {exp.paymentMode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-amber-600 whitespace-nowrap text-sm">
                          ₹{(exp.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">
                          {exp.addedByName || 'System'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {renderStatusBadge(status)}
                            {status === 'REJECTED' && exp.rejectionReason && (
                              <p className="text-[10px] text-rose-600 italic max-w-xs font-normal">
                                Reason: "{exp.rejectionReason}"
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditExpense(exp)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                                title="Edit Pending Expense"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedExpense(exp);
                                  setRejectionReason('');
                                }}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveExpense(exp._id)}
                                disabled={expenseSubmitting}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Processed {exp.actionByName ? `by ${exp.actionByName}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* TAB 4: RECRUITMENT APPROVALS */}
      {activeTab === 'recruitment' && (
        loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Loading recruitment candidate approvals...</p>
          </div>
        ) : filteredRecruitment.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center gap-3 shadow-xs">
            <UserCheck className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No selected candidates pending approval</p>
            <p className="text-xs text-slate-400">When candidates are marked as Selected in Recruitment, they will appear here for MD approval.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {filteredRecruitment.map((c) => {
                const candidateId = c.id || c._id;
                const status = c.approval_status || 'Pending';
                return (
                  <motion.div
                    key={candidateId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:shadow-md transition-all space-y-4 shadow-xs"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900">{c.name}</h3>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {c.phone}
                            </p>
                          </div>
                        </div>
                        {renderStatusBadge(status)}
                      </div>

                      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Selection State:</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                            Selected
                          </span>
                        </div>

                        {c.address && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500 font-medium">Address:</span>
                            <span className="font-medium text-slate-700 truncate max-w-[150px]">{c.address}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500 font-medium">Resume File:</span>
                          {c.resume_url ? (
                            <button
                              type="button"
                              onClick={() => handleOpenResume(c.resume_url, c.resume_name)}
                              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" /> View Resume
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">No File</span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/60 text-[10px] text-center">
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="text-slate-400 block font-bold">R1</span>
                            <span className="font-semibold text-slate-700">{c.interview_1 || 'Pending'}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="text-slate-400 block font-bold">R2</span>
                            <span className="font-semibold text-slate-700">{c.interview_2 || 'N/A'}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="text-slate-400 block font-bold">R3</span>
                            <span className="font-semibold text-slate-700">{c.interview_3 || 'N/A'}</span>
                          </div>
                        </div>

                        {status === 'Rejected' && c.rejection_reason && (
                          <div className="text-[10px] text-rose-600 italic bg-rose-50 p-2 rounded-lg border border-rose-100 mt-1">
                            Reason: "{c.rejection_reason}"
                          </div>
                        )}
                        {status === 'Approved' && c.approved_by && (
                          <div className="text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 mt-1 flex items-center gap-1 font-semibold">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Approved by {c.approved_by.name || 'MD Executive'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-indigo-600 font-bold">
                        Recruitment Selection Approval
                      </span>
                      {status === 'Pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedCandidate(c);
                              setRejectionReason('');
                            }}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveRecruitment(candidateId)}
                            disabled={recruitmentSubmitting}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Status: {status}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Candidate</th>
                    <th className="py-3.5 px-4">Address</th>
                    <th className="py-3.5 px-4">Resume</th>
                    <th className="py-3.5 px-4">Interviews</th>
                    <th className="py-3.5 px-4">Selected</th>
                    <th className="py-3.5 px-4">Approval Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRecruitment.map((c) => {
                    const candidateId = c.id || c._id;
                    const status = c.approval_status || 'Pending';
                    return (
                      <tr key={candidateId} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {c.name}
                          <span className="block text-[10px] text-slate-400 font-normal">{c.phone}</span>
                        </td>
                        <td className="py-3.5 px-4 max-w-[150px] truncate text-[11px]">
                          {c.address || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.resume_url ? (
                            <button
                              type="button"
                              onClick={() => handleOpenResume(c.resume_url, c.resume_name)}
                              className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" /> View
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">No File</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[11px]">
                          R1: {c.interview_1 || 'Pending'} | R2: {c.interview_2 || 'N/A'} | R3: {c.interview_3 || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">
                          Selected
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {renderStatusBadge(status)}
                            {status === 'Rejected' && c.rejection_reason && (
                              <p className="text-[10px] text-rose-600 italic max-w-xs font-normal">
                                Reason: "{c.rejection_reason}"
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {status === 'Pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedCandidate(c);
                                  setRejectionReason('');
                                }}
                                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveRecruitment(candidateId)}
                                disabled={recruitmentSubmitting}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              {status} {c.approved_by?.name ? `by ${c.approved_by.name}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* LEAVE ACTION MODAL */}
      {selectedLeave && leaveActionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {leaveActionType === 'APPROVED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                MD Executive Leave Action — {leaveActionType}
              </h2>
              <button
                onClick={() => setSelectedLeave(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p><strong>Employee:</strong> {selectedLeave.userName}</p>
              <p><strong>Type & Duration:</strong> {selectedLeave.leaveType} ({selectedLeave.totalDays} day(s))</p>
              <p><strong>Reason:</strong> "{selectedLeave.reason}"</p>
            </div>

            <form onSubmit={handleLeaveActionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Executive Remarks (Optional)</label>
                <textarea
                  rows={3}
                  value={leaveComment}
                  onChange={(e) => setLeaveComment(e.target.value)}
                  placeholder="Enter remarks or approval instructions..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLeave(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leaveSubmitting}
                  className={`px-5 py-2 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                    leaveActionType === 'APPROVED' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {leaveSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm {leaveActionType}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* SALARY REJECTION REASON MODAL */}
      {selectedSalary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" /> Reject Salary Payment
              </h2>
              <button
                onClick={() => setSelectedSalary(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p><strong>Employee:</strong> {selectedSalary.employeeName || selectedSalary.employee?.name}</p>
              <p><strong>Month & Amount:</strong> {selectedSalary.month} — ₹{(selectedSalary.paidAmount || 0).toLocaleString('en-IN')}</p>
            </div>

            <form onSubmit={handleRejectSalarySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Rejection *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this salary payment is rejected..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSalary(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={salarySubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {salarySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* EXPENSE REJECTION REASON MODAL */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" /> Reject Expense Entry
              </h2>
              <button
                onClick={() => setSelectedExpense(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p><strong>Category & Paid To:</strong> {selectedExpense.categoryName} — {selectedExpense.paidTo}</p>
              <p><strong>Amount:</strong> ₹{(selectedExpense.amount || 0).toLocaleString('en-IN')}</p>
              {selectedExpense.description && <p><strong>Notes:</strong> "{selectedExpense.description}"</p>}
            </div>

            <form onSubmit={handleRejectExpenseSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Rejection *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this expense is rejected by Managing Director..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedExpense(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {expenseSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* RECRUITMENT REJECTION REASON MODAL */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" /> Reject Candidate Approval
              </h2>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p><strong>Candidate:</strong> {selectedCandidate.name}</p>
              <p><strong>Phone:</strong> {selectedCandidate.phone}</p>
              {selectedCandidate.address && <p><strong>Address:</strong> {selectedCandidate.address}</p>}
            </div>

            <form onSubmit={handleRejectRecruitmentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Rejection *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this candidate recruitment approval is rejected..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recruitmentSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {recruitmentSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Pending Expense Modal */}
      {isEditExpenseModalOpen && editingExpense && (
        <div 
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditExpenseModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Edit Pending Expense
                  </h3>
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Modify expense details before approval
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={editExpenseForm.date}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Paid To / Recipient</label>
                  <input
                    type="text"
                    required
                    placeholder="Vendor / Employee Name"
                    value={editExpenseForm.paidTo}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, paidTo: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Category</label>
                  {expenseCategoriesList.length > 0 ? (
                    <select
                      value={editExpenseForm.category}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, category: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- Select Category --</option>
                      {expenseCategoriesList.map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Category name"
                      value={editExpenseForm.category}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, category: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Payment Mode</label>
                  <select
                    value={editExpenseForm.paymentMode}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, paymentMode: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="0.00"
                  value={editExpenseForm.amount}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Description / Remarks</label>
                <textarea
                  rows="2"
                  placeholder="Additional expense purpose or notes..."
                  value={editExpenseForm.description}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditExpenseModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 size={14} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
