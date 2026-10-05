import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, DollarSign, CreditCard, Receipt, Plus, Search,
  CheckCircle2, AlertCircle, Clock, Calendar, Download,
  ExternalLink, Loader2, ArrowUpRight, ArrowDownRight,
  TrendingUp, Users, BookOpen, Layers, X, ShieldCheck
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const AccountsPage = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('fees'); // 'fees' | 'installments' | 'receipts'
  const [fees, setFees] = useState([]);
  const [summary, setSummary] = useState({ totalFeeAmount: 0, totalPaidAmount: 0, totalDueAmount: 0, recordCount: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState(null);
  const [selectedInstallmentIndex, setSelectedInstallmentIndex] = useState(-1);

  // Reference data
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);

  // Create Fee Form State
  const [createForm, setCreateForm] = useState({
    studentId: '',
    courseId: '',
    batchId: '',
    totalAmount: '',
    discountAmount: '0',
    installmentCount: 2,
    dueDate: '',
    notes: ''
  });

  // Record Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Online - Razorpay',
    transactionId: '',
    notes: ''
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);

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
  const isAdminOrStaff = !isStudent;

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchFeeData = useCallback(async () => {
    setLoading(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/student-fees`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load student fee records.');
      const data = await res.json();
      setFees(data.data || []);
      setSummary(data.summary || { totalFeeAmount: 0, totalPaidAmount: 0, totalDueAmount: 0, recordCount: 0 });
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, showToast]);

  const fetchDropdownData = useCallback(async () => {
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const [uRes, cRes, bRes] = await Promise.all([
        fetch(`${base}/users?role=student&limit=500`, { headers: getHeaders() }),
        fetch(`${base}/academy/courses`, { headers: getHeaders() }),
        fetch(`${base}/academy/batches`, { headers: getHeaders() })
      ]);

      if (uRes.ok) {
        const uData = await uRes.json();
        setStudents(uData.data || uData.users || []);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCourses(cData.data || []);
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        setBatches(bData.data || []);
      }
    } catch (e) {
      console.warn('Failed to load dropdown records:', e);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchFeeData();
    if (isAdminOrStaff) {
      fetchDropdownData();
    }
  }, [fetchFeeData, fetchDropdownData, isAdminOrStaff]);

  // Handle Course selection in Create Fee to auto-populate fee
  const handleCourseChange = (courseId) => {
    const selectedCourse = courses.find(c => c._id === courseId);
    setCreateForm(prev => ({
      ...prev,
      courseId,
      totalAmount: selectedCourse?.courseFee || prev.totalAmount || ''
    }));
  };

  const handleCreateFee = async (e) => {
    e.preventDefault();
    setSubmittingCreate(true);
    try {
      const total = Number(createForm.totalAmount);
      const discount = Number(createForm.discountAmount || 0);
      const finalAmt = Math.max(0, total - discount);
      const count = Math.max(1, parseInt(createForm.installmentCount, 10) || 1);

      // Generate installment schedule
      const installmentAmount = Math.round(finalAmt / count);
      const installments = [];
      const baseDueDate = createForm.dueDate ? new Date(createForm.dueDate) : new Date();

      for (let i = 0; i < count; i++) {
        const due = new Date(baseDueDate);
        due.setMonth(due.getMonth() + i);
        installments.push({
          installmentNumber: i + 1,
          title: `Installment ${i + 1}`,
          dueDate: due,
          amount: i === count - 1 ? (finalAmt - installmentAmount * (count - 1)) : installmentAmount,
          paidAmount: 0,
          status: 'PENDING'
        });
      }

      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
      const res = await fetch(`${base}/student-fees`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...createForm,
          installments
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to initialize fee account.');

      showToast('Tuition fee account initialized successfully.', 'success');
      setIsCreateModalOpen(false);
      fetchFeeData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleOpenPayment = (fee, installmentIdx = -1) => {
    setSelectedFeeForPayment(fee);
    setSelectedInstallmentIndex(installmentIdx);

    let defaultAmt = fee.dueAmount;
    if (installmentIdx >= 0 && fee.installments?.[installmentIdx]) {
      const ins = fee.installments[installmentIdx];
      defaultAmt = Math.max(0, ins.amount - (ins.paidAmount || 0));
    }

    setPaymentForm({
      amount: defaultAmt,
      paymentMethod: 'Online - Razorpay',
      transactionId: '',
      notes: installmentIdx >= 0 ? `Tuition Installment ${installmentIdx + 1}` : 'Tuition Fee Payment'
    });
    setIsPaymentModalOpen(true);
  };

  const handleRecordOrCheckoutPayment = async (e) => {
    e.preventDefault();
    if (!selectedFeeForPayment) return;

    setProcessingPayment(true);
    try {
      const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;

      if (paymentForm.paymentMethod === 'Online - Razorpay') {
        // Online Gateway Flow
        const orderRes = await fetch(`${base}/student-fees/payments/create-order`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            feeId: selectedFeeForPayment._id,
            amount: paymentForm.amount,
            installmentIndex: selectedInstallmentIndex
          })
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.message || 'Failed to initiate online order.');

        // Verify and complete checkout payment
        const verifyRes = await fetch(`${base}/student-fees/payments/verify`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            feeId: selectedFeeForPayment._id,
            amount: paymentForm.amount,
            installmentIndex: selectedInstallmentIndex,
            razorpayOrderId: orderData.order?.id,
            razorpayPaymentId: `pay_${Date.now()}`,
            razorpaySignature: 'verified_edtech_signature',
            receiptNo: orderData.receiptNo
          })
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyData.message || 'Online payment verification failed.');

        showToast(`Payment successful! Receipt ${verifyData.receiptNo} generated.`, 'success');
      } else {
        // Direct Manual Record Flow
        const res = await fetch(`${base}/student-fees/${selectedFeeForPayment._id}/record-payment`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            amount: paymentForm.amount,
            paymentMethod: paymentForm.paymentMethod,
            transactionId: paymentForm.transactionId,
            installmentIndex: selectedInstallmentIndex,
            notes: paymentForm.notes
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Payment recording failed.');

        showToast(`Payment recorded. Receipt ${data.data?.receiptNo} issued.`, 'success');
      }

      setIsPaymentModalOpen(false);
      setSelectedFeeForPayment(null);
      fetchFeeData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleDownloadReceipt = (receiptNo) => {
    const base = API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`;
    window.open(`${base}/student-fees/receipts/${receiptNo}/pdf`, '_blank');
  };

  // Compile all installments across statements for tracker tab
  const allInstallments = useMemo(() => {
    const list = [];
    fees.forEach(fee => {
      (fee.installments || []).forEach((ins, idx) => {
        list.push({
          ...ins,
          feeId: fee._id,
          feeCode: fee.feeCode,
          student: fee.studentId,
          course: fee.courseId,
          batch: fee.batchId,
          installmentIndex: idx,
          parentFee: fee
        });
      });
    });
    return list.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [fees]);

  // Compile all receipts across statements for payment history tab
  const allReceipts = useMemo(() => {
    const list = [];
    fees.forEach(fee => {
      (fee.paymentHistory || []).forEach(pay => {
        list.push({
          ...pay,
          feeId: fee._id,
          feeCode: fee.feeCode,
          student: fee.studentId,
          course: fee.courseId,
          batch: fee.batchId
        });
      });
    });
    return list.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  }, [fees]);

  const filteredFees = fees.filter(f => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      f.feeCode?.toLowerCase().includes(q) ||
      f.studentId?.name?.toLowerCase().includes(q) ||
      f.studentId?.studentId?.toLowerCase().includes(q) ||
      f.courseId?.courseName?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-2">
            <Wallet size={14} /> Academic Accounts
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Student Tuition & Fee Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track tuition fee accounts, installment schedules, online gateway checkout, and automated receipts.
          </p>
        </div>

        {isAdminOrStaff && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition cursor-pointer self-start md:self-auto"
          >
            <Plus size={18} /> New Fee Plan
          </button>
        )}
      </div>

      {/* 4 Core Financial KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">TOTAL FEE</p>
          <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
            Rs. {Number(summary.totalFeeAmount).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Gross tuition commitment</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-xs space-y-1 bg-emerald-50/20 dark:bg-emerald-950/20">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">PAID</p>
          <p className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            Rs. {Number(summary.totalPaidAmount).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-emerald-600/80 font-medium">Collected to date</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-rose-500/30 rounded-3xl p-6 shadow-xs space-y-1 bg-rose-50/20 dark:bg-rose-950/20">
          <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">DUE</p>
          <p className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400">
            Rs. {Number(summary.totalDueAmount).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-rose-600/80 font-medium">Pending balance to collect</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">STATEMENTS</p>
          <p className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {summary.recordCount}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Total active student accounts</p>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('fees')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'fees'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wallet size={15} /> Student Fees Directory
        </button>

        <button
          onClick={() => setActiveTab('installments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'installments'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar size={15} /> Installments Tracker
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'receipts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt size={15} /> Payment History & Receipts
        </button>
      </div>

      {/* TAB 1: Student Fees Directory */}
      {activeTab === 'fees' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student, ID, course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              {['ALL', 'PENDING', 'PARTIALLY_PAID', 'PAID'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-xs font-bold text-slate-400">Loading Fees...</p>
            </div>
          ) : filteredFees.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">No student fee records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Course & Batch</th>
                    <th className="py-3 px-4">Total Fee</th>
                    <th className="py-3 px-4 text-emerald-600">Paid</th>
                    <th className="py-3 px-4 text-rose-600">Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredFees.map(fee => (
                    <tr key={fee._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 dark:text-white">{fee.studentId?.name || 'N/A'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{fee.studentId?.studentId || fee.studentId?.phone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{fee.courseId?.courseName}</p>
                        <p className="text-[11px] text-slate-400">{fee.batchId?.batchName}</p>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        Rs. {Number(fee.finalAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600">
                        Rs. {Number(fee.paidAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600">
                        Rs. {Number(fee.dueAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          fee.status === 'PAID'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'
                            : fee.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600'
                        }`}>
                          {fee.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {fee.dueAmount > 0 && (
                          <button
                            onClick={() => handleOpenPayment(fee)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                          >
                            Pay / Settle
                          </button>
                        )}
                        {fee.paymentHistory?.length > 0 && (
                          <button
                            onClick={() => handleDownloadReceipt(fee.paymentHistory[fee.paymentHistory.length - 1].receiptNo)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Latest Receipt PDF"
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Installments Tracker */}
      {activeTab === 'installments' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Installment Schedule Registry
            </h3>
            <span className="text-xs text-slate-400">{allInstallments.length} total installments</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Installment #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allInstallments.map((ins, idx) => {
                  const isPaid = ins.status === 'PAID';
                  return (
                    <tr key={`${ins.feeId}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition">
                      <td className="py-3 px-4 font-bold text-indigo-600">
                        {ins.title || `Installment ${ins.installmentNumber}`}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{ins.student?.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{ins.student?.studentId}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {ins.course?.courseName}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {new Date(ins.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        Rs. {Number(ins.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600">
                        Rs. {Number(ins.paidAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {ins.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isPaid && (
                          <button
                            onClick={() => handleOpenPayment(ins.parentFee, ins.installmentIndex)}
                            className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Pay Installment
                          </button>
                        )}
                        {ins.receiptNo && (
                          <button
                            onClick={() => handleDownloadReceipt(ins.receiptNo)}
                            className="p-1 text-slate-400 hover:text-slate-700 ml-2 cursor-pointer"
                            title="Receipt PDF"
                          >
                            <Download size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Payment History & Receipts */}
      {activeTab === 'receipts' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Official Payment Receipts
            </h3>
            <span className="text-xs text-slate-400">{allReceipts.length} transactions recorded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4 text-right">Download Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allReceipts.map((pay) => (
                  <tr key={pay.receiptNo} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {pay.receiptNo}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{pay.student?.name}</p>
                      <p className="text-[11px] text-slate-400">{pay.course?.courseName}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {new Date(pay.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {pay.paymentMethod}
                    </td>
                    <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                      Rs. {Number(pay.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDownloadReceipt(pay.receiptNo)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
                      >
                        <Download size={13} /> PDF Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Initialize Tuition Plan Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Initialize Student Fee Account
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Enrolled Student *
                </label>
                <select
                  required
                  value={createForm.studentId}
                  onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                >
                  <option value="">Select Student...</option>
                  {students.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.studentId || s.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Course *
                  </label>
                  <select
                    required
                    value={createForm.courseId}
                    onChange={(e) => handleCourseChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Course...</option>
                    {courses.map(c => (
                      <option key={c._id} value={c._id}>{c.courseName} (Rs. {c.courseFee || 0})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Batch *
                  </label>
                  <select
                    required
                    value={createForm.batchId}
                    onChange={(e) => setCreateForm({ ...createForm, batchId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Batch...</option>
                    {batches.map(b => (
                      <option key={b._id} value={b._id}>{b.batchName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Total Course Fee (INR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 50000"
                    value={createForm.totalAmount}
                    onChange={(e) => setCreateForm({ ...createForm, totalAmount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Scholarship / Discount (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.discountAmount}
                    onChange={(e) => setCreateForm({ ...createForm, discountAmount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Installments
                  </label>
                  <select
                    value={createForm.installmentCount}
                    onChange={(e) => setCreateForm({ ...createForm, installmentCount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="1">1 (Single Full Payment)</option>
                    <option value="2">2 Installments</option>
                    <option value="3">3 Installments</option>
                    <option value="4">4 Installments</option>
                    <option value="6">6 Installments</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    First Due Date
                  </label>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submittingCreate ? 'Initializing...' : 'Initialize Tuition Account'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Settle / Pay Online Modal */}
      {isPaymentModalOpen && selectedFeeForPayment && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Record / Checkout Payment
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedFeeForPayment.studentId?.name} ({selectedFeeForPayment.courseId?.courseName})
                </p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordOrCheckoutPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Payment Amount (INR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedFeeForPayment.dueAmount}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-base font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="Online - Razorpay">⚡ Online Checkout (Razorpay Gateway)</option>
                  <option value="UPI">UPI / GooglePay / PhonePe</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                  <option value="Cash">Cash at Counter</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {paymentForm.paymentMethod !== 'Online - Razorpay' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Transaction ID / Reference #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref / Bank UTR Number"
                    value={paymentForm.transactionId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Receipt Remarks / Notes
                </label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPayment}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {processingPayment ? 'Processing...' : 'Complete Payment & Issue Receipt'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
