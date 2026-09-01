import React, { useState, useEffect } from 'react';
import {
  getSalaryPayments,
  deleteSalaryPayment,
  approveOrRejectSalaryPayment,
  approveAllSalaryPayments
} from '../../services/accountsService';
import { useToast } from '../ToastProvider';
import PayslipModal from './PayslipModal';
import CreatePayslipModal from './CreatePayslipModal';
import DeletePayslipModal from './DeletePayslipModal';
import {
  FileText,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Trash2,
  RefreshCw,
  CheckSquare,
  Check,
  X,
  Plus
} from 'lucide-react';
import { useUser } from '../../contexts/UserContext';

const SalaryPaymentTab = () => {
  const { user } = useUser();
  const { showToast } = useToast();
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Payslip Modal State
  const [selectedPayslipRecord, setSelectedPayslipRecord] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSalaryToDelete, setSelectedSalaryToDelete] = useState(null);

  // Rejection Modal State
  const [selectedSalaryToReject, setSelectedSalaryToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Role checks
  const roleStr = String(user?.role || '').toLowerCase().trim();
  const roleIdStr = String(user?.role_id || user?.roleId || '').trim();
  const isMdOrAdmin = user?.isSuperAdmin === true || ['0', '1', '2', 'admin', 'superadmin', 'md', 'coo'].includes(roleStr) || ['0', '1', '2'].includes(roleIdStr);

  const fetchSalaryPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSalaryPayments();
      if (res.success) setSalaryPayments(res.data || []);
    } catch (err) {
      console.error('Error fetching salary payments:', err);
      setError('Failed to fetch salary payment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryPayments();
  }, []);

  const handleDeleteSalary = async (id) => {
    if (!window.confirm('Are you sure you want to delete this salary payment? This will also remove the automatically created expense entry.')) return;
    try {
      const res = await deleteSalaryPayment(id);
      if (res.success) {
        setSuccessMsg('Salary payment and synced expense entry removed.');
        fetchSalaryPayments();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error deleting salary payment.', 'error');
    }
  };

  const handleApproveSalary = async (id) => {
    setActionSubmitting(true);
    try {
      const res = await approveOrRejectSalaryPayment(id, { action: 'APPROVED' });
      if (res.success) {
        setSuccessMsg('Salary payment approved successfully!');
        fetchSalaryPayments();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error approving salary payment.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleRejectSalarySubmit = async (e) => {
    e.preventDefault();
    if (!selectedSalaryToReject) return;
    if (!rejectionReason.trim()) {
      showToast('Please enter a rejection reason.', 'error');
      return;
    }

    setActionSubmitting(true);
    try {
      const res = await approveOrRejectSalaryPayment(selectedSalaryToReject._id, {
        action: 'REJECTED',
        rejectionReason: rejectionReason.trim()
      });
      if (res.success) {
        setSuccessMsg('Salary payment rejected with reason.');
        setSelectedSalaryToReject(null);
        setRejectionReason('');
        fetchSalaryPayments();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error rejecting salary payment.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleApproveAllSalaries = async () => {
    const pendingCount = salaryPayments.filter(p => (p.status || 'PENDING') === 'PENDING').length;
    if (pendingCount === 0) return;

    if (!window.confirm(`Are you sure you want to approve all ${pendingCount} pending salary payment(s)?`)) return;

    setBulkSubmitting(true);
    try {
      const res = await approveAllSalaryPayments();
      if (res.success) {
        setSuccessMsg(`Approved all ${res.modifiedCount || pendingCount} pending salary payment(s)!`);
        fetchSalaryPayments();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error approving all salary payments.', 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const renderStatusBadge = (status, rejectionReasonText) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'REJECTED':
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <XCircle size={12} /> Rejected
            </span>
            {rejectionReasonText && (
              <p className="text-[10px] text-rose-600 italic font-normal line-clamp-2">
                Reason: "{rejectionReasonText}"
              </p>
            )}
          </div>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} /> Pending MD Approval
          </span>
        );
    }
  };

  const pendingSalaryCount = salaryPayments.filter(p => (p.status || 'PENDING') === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}


      {/* Salary Payments History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Salary Payment History
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus size={14} /> Create Payslip
            </button>

            {isMdOrAdmin && pendingSalaryCount > 0 && (
              <button
                onClick={handleApproveAllSalaries}
                disabled={bulkSubmitting}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <CheckSquare size={14} />
                <span>Approve All Pending ({pendingSalaryCount})</span>
              </button>
            )}

            <button
              onClick={fetchSalaryPayments}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title="Refresh List"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-y border-slate-200/60 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3 font-semibold">Payment Date</th>
                <th className="py-3 px-3 font-semibold">Employee</th>
                <th className="py-3 px-3 font-semibold">Month</th>
                <th className="py-3 px-3 font-semibold">Basic Salary</th>
                <th className="py-3 px-3 font-semibold text-right">Paid Amount (₹)</th>
                <th className="py-3 px-3 font-semibold">Mode</th>
                <th className="py-3 px-3 font-semibold">Approval Status</th>
                <th className="py-3 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading salary payment records...
                  </td>
                </tr>
              ) : salaryPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No salary payment records found.
                  </td>
                </tr>
              ) : (
                salaryPayments.map((p) => {
                  const status = p.status || 'PENDING';
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 whitespace-nowrap font-medium">
                        {new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {p.employeeName || p.employee?.name || 'Employee'}
                        {p.employee?.designation && (
                          <span className="block text-[10px] text-slate-400 font-normal">{p.employee.designation}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium">
                        {p.month}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        ₹{(p.basicSalary || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ₹{(p.paidAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {p.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {renderStatusBadge(status, p.rejectionReason)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedPayslipRecord(p)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                            title="View / Download Official Payslip"
                          >
                            <FileText size={12} /> Payslip
                          </button>
                          {isMdOrAdmin && status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedSalaryToReject(p);
                                  setRejectionReason('');
                                }}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveSalary(p._id)}
                                disabled={actionSubmitting}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                              >
                                <Check size={12} /> Approve
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedSalaryToDelete(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REJECTION REASON MODAL (Center-Intersected) */}
      {selectedSalaryToReject && (
        <div className="fixed inset-0 z-[110]">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setSelectedSalaryToReject(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[111] w-[90vw] max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" /> Reject Salary Payment
              </h2>
              <button
                onClick={() => setSelectedSalaryToReject(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-md transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <p><strong>Employee:</strong> {selectedSalaryToReject.employeeName || selectedSalaryToReject.employee?.name}</p>
              <p><strong>Month & Amount:</strong> {selectedSalaryToReject.month} — ₹{(selectedSalaryToReject.paidAmount || 0).toLocaleString('en-IN')}</p>
            </div>

            <form onSubmit={handleRejectSalarySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Reason for Rejection *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Type rejection reason here..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSalaryToReject(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL PAYSLIP MODAL */}
      <PayslipModal
        isOpen={!!selectedPayslipRecord}
        onClose={() => setSelectedPayslipRecord(null)}
        salaryRecord={selectedPayslipRecord}
      />

      {/* CREATE PAYSLIP MODAL */}
      <CreatePayslipModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchSalaryPayments}
      />
    </div>
  );
};

export default SalaryPaymentTab;
