import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, DollarSign, Search,
  CheckCircle2, Clock, XCircle, LayoutGrid, List, Plus, Trash2
} from 'lucide-react';
import { getSalaryPayments, deleteSalaryPayment } from '../services/accountsService';
import { useToast } from '../components/ToastProvider';
import PayslipModal from '../components/accounts/PayslipModal';
import CreatePayslipModal from '../components/accounts/CreatePayslipModal';
import DeletePayslipModal from '../components/accounts/DeletePayslipModal';
import { useUser } from '../contexts/UserContext';

const PayslipsPage = () => {
  const { user } = useUser();
  const { showToast } = useToast();

  const [salaryRecords, setSalaryRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [selectedPayslipRecord, setSelectedPayslipRecord] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSalaryToDelete, setSelectedSalaryToDelete] = useState(null);

  // ── Role checks ──────────────────────────────────────────────
  const role = String(user?.role_id || user?.roleId || (typeof user?.role === 'object' ? user?.role?.name : user?.role) || '').toLowerCase().trim();
  const designation = String((typeof user?.designation === 'object' ? user?.designation?.name : user?.designation) || '').toLowerCase().trim();
  const department = String((typeof user?.department === 'object' ? user?.department?.name : user?.department) || '').toLowerCase().trim();
  const isSuperAdmin = user?.isSuperAdmin === true || role === 'superadmin' || role === '0';

  const isHr = role === 'hr' || designation.includes('hr') || department.includes('hr');
  const isAccountant = role === 'accountant' || role === 'finance' || role === 'accounts' || role === '10' ||
                        designation.includes('accountant') || designation.includes('accounts') || designation.includes('finance') ||
                        department.includes('accounts') || department.includes('finance');

  const isPrivileged =
    isSuperAdmin ||
    isHr ||
    isAccountant ||
    ['0', '1', '2', '10', 'admin', 'superadmin', 'md', 'coo', 'executive_director', 'accountant', 'hr', 'manager', 'finance', 'accounts'].includes(role) ||
    ['0', '1', '2', '10'].includes(String(user?.role_id || user?.roleId || ''));

  // All privileged users (Admin, SuperAdmin, HR, Accountant, MD, Manager) can create payslips
  const canCreate = isPrivileged;

  // ── Fetch (silent = no loading spinner after first load) ──────
  const fetchSalaryRecords = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getSalaryPayments();
      if (res.success) {
        setSalaryRecords(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching salary records:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const handleDeletePayslipRecord = async (id, empName) => {
    if (!window.confirm(`Are you sure you want to delete the payslip record for ${empName || 'this employee'}? This will also remove any synced salary expense entry.`)) return;
    try {
      const res = await deleteSalaryPayment(id);
      if (res.success) {
        showToast('Payslip record deleted successfully!', 'success');
        fetchSalaryRecords();
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Error deleting payslip record.', 'error');
    }
  };

  // Initial load
  useEffect(() => { fetchSalaryRecords(); }, [fetchSalaryRecords]);

  // Auto-refresh every 30 seconds (silent)
  useEffect(() => {
    const interval = setInterval(() => fetchSalaryRecords(true), 30000);
    return () => clearInterval(interval);
  }, [fetchSalaryRecords]);

  // Refresh when user tabs back to this page
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchSalaryRecords(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchSalaryRecords]);

  // ── Filter: regular employees only see THEIR OWN payslips ─────
  const myRecords = useMemo(() => {
    if (isPrivileged) return salaryRecords; // HR/Admin/Accountant see all
    const myId = String(user?._id || user?.id || '').trim();
    const myKbEmpId = String(user?.kbEmployeeId || user?.employeeId || '').toLowerCase().trim();
    const myName = String(user?.name || '').toLowerCase().trim();
    const myEmail = String(user?.email || '').toLowerCase().trim();

    return salaryRecords.filter(r => {
      const recEmpId = String(r.employee?._id || r.employee?.id || r.employeeId || r.employee || '').trim();
      const recKbEmpId = String(r.kbEmployeeId || r.employee?.employeeId || r.employee?.kbEmployeeId || '').toLowerCase().trim();
      const recEmpName = String(r.employeeName || r.employee?.name || '').toLowerCase().trim();
      const recEmail = String(r.employee?.email || '').toLowerCase().trim();

      const matchesId = Boolean(myId && recEmpId && recEmpId === myId);
      const matchesKbId = Boolean(myKbEmpId && recKbEmpId && recKbEmpId === myKbEmpId);
      const matchesName = Boolean(myName && recEmpName && recEmpName === myName);
      const matchesEmail = Boolean(myEmail && recEmail && recEmail === myEmail);

      return matchesId || matchesKbId || matchesName || matchesEmail;
    });
  }, [salaryRecords, isPrivileged, user]);

  const filteredRecords = useMemo(() => {
    return myRecords.filter(r => {
      const q = search.toLowerCase().trim();
      const empName = (r.employeeName || r.employee?.name || '').toLowerCase();
      const month = (r.month || '').toLowerCase();
      const desig = (r.employee?.designation || r.designation || '').toLowerCase();
      const matchesSearch = !q || empName.includes(q) || month.includes(q) || desig.includes(q);
      const matchesStatus = statusFilter === 'ALL' || (r.status || 'PENDING') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [myRecords, search, statusFilter]);

  const stats = useMemo(() => {
    const total = myRecords.reduce((acc, r) => acc + (Number(r.paidAmount) || 0), 0);
    const approvedCount = myRecords.filter(r => (r.status || 'PENDING') === 'APPROVED').length;
    const pendingCount = myRecords.filter(r => (r.status || 'PENDING') === 'PENDING').length;
    return { totalDisbursed: total, totalRecords: myRecords.length, approvedCount, pendingCount };
  }, [myRecords]);

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80">
            <CheckCircle2 size={11} /> APPROVED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/80">
            <XCircle size={11} /> REJECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80">
            <Clock size={11} /> PENDING
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isPrivileged ? 'Employee Payslips' : 'My Payslips'}
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              {isPrivileged
                ? 'View, edit, print, and download official employee payslips'
                : 'View and download your official salary slips'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold transition shadow-md shadow-indigo-500/20 cursor-pointer"
          >
            <Plus size={15} /> Create Payslip
          </button>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Disbursed', value: `₹${stats.totalDisbursed.toLocaleString('en-IN')}`, icon: <DollarSign size={18} />, color: 'emerald', sub: 'Cumulative paid salaries' },
          { label: 'Payslip Records', value: stats.totalRecords, icon: <FileText size={18} />, color: 'indigo', sub: 'Total issued payslips' },
          { label: 'Approved', value: stats.approvedCount, icon: <CheckCircle2 size={18} />, color: 'emerald', sub: 'Verified disbursals', valColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pending', value: stats.pendingCount, icon: <Clock size={18} />, color: 'amber', sub: 'Awaiting authorization', valColor: 'text-amber-600 dark:text-amber-400' },
        ].map(({ label, value, icon, color, sub, valColor }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{label}</span>
              <div className={`p-2 rounded-xl bg-${color}-50 dark:bg-${color}-950/40 text-${color}-600 dark:text-${color}-400`}>{icon}</div>
            </div>
            <p className={`text-2xl font-black mt-2 ${valColor || 'text-slate-900 dark:text-white'}`}>{value}</p>
            <span className="text-[11px] text-slate-400 font-medium mt-1 block">{sub}</span>
          </div>
        ))}
      </div>

      {/* ── Search + Filter + Toggle ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isPrivileged ? 'Search employee, month...' : 'Search month...'}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Grid / List toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-2 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-2 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-medium">
          <div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Loading payslips...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-14 text-center space-y-3">
          <FileText size={44} className="mx-auto text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {isPrivileged ? 'No payslip records found.' : 'No payslips have been issued for you yet.'}
          </p>
        </div>

      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((r, i) => {
            const empName = r.employeeName || r.employee?.name || 'Employee';
            const desig = r.employee?.designation || r.designation || 'Staff Member';
            const status = r.status || 'PENDING';
            const paid = Number(r.paidAmount || 0);
            return (
              <motion.div
                key={r._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-indigo-400/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-black text-base flex items-center justify-center">
                        {empName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{empName}</h3>
                        <p className="text-[11px] text-slate-400 font-medium">{desig}</p>
                      </div>
                    </div>
                    {renderStatusBadge(status)}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Pay Period</span>
                      <strong className="text-slate-800 dark:text-slate-200">{r.month}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Mode</span>
                      <span className="text-slate-700 dark:text-slate-300">{r.paymentMode || 'Bank'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Date</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {new Date(r.paymentDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Net Paid</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">₹{paid.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Official Disbursal Slip</span>
                  <div className="flex items-center gap-1.5">
                    {isPrivileged && (
                      <button
                        onClick={() => setSelectedSalaryToDelete(r)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Delete Payslip"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedPayslipRecord(r)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText size={13} /> View Payslip
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

      ) : (
        /* ── LIST VIEW (TABLE) ── */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Disbursal Date</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Pay Period</th>
                  <th className="py-3.5 px-4 text-right">Net Paid (₹)</th>
                  <th className="py-3.5 px-4">Mode</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredRecords.map((r) => {
                  const empName = r.employeeName || r.employee?.name || 'Employee';
                  const desig = r.employee?.designation || r.designation || 'Staff Member';
                  const status = r.status || 'PENDING';
                  const paid = Number(r.paidAmount !== undefined ? r.paidAmount : (r.customNetPay !== undefined ? r.customNetPay : r.basicSalary));

                  return (
                    <tr key={r._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-600 dark:text-slate-400">
                        {new Date(r.paymentDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center shrink-0">
                            {empName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="block">{empName}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">{desig}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {r.month}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ₹{paid.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {r.paymentMode || 'Bank'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(status)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPrivileged && (
                            <button
                              onClick={() => setSelectedSalaryToDelete(r)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Delete Payslip"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedPayslipRecord(r)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileText size={13} /> View Payslip
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      <PayslipModal
        isOpen={!!selectedPayslipRecord}
        onClose={() => setSelectedPayslipRecord(null)}
        salaryRecord={selectedPayslipRecord}
        onSaved={fetchSalaryRecords}
      />

      <CreatePayslipModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => { setIsCreateModalOpen(false); fetchSalaryRecords(); }}
      />

      <DeletePayslipModal
        isOpen={!!selectedSalaryToDelete}
        onClose={() => setSelectedSalaryToDelete(null)}
        onSuccess={fetchSalaryRecords}
        payslipRecord={selectedSalaryToDelete}
      />
    </div>
  );
};

export default PayslipsPage;
