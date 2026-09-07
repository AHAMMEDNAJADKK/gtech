import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Edit3, Trash2, Calendar, DollarSign, 
  Layers, Loader2, ArrowRight, UserCheck, RefreshCw, X, FileText 
} from 'lucide-react';
import { getOperations, createOperation, updateOperation, deleteOperation } from '../../services/accountsService';
import ConfirmModal from '../ConfirmModal';
import { useToast } from '../ToastProvider';

const OperationTab = () => {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirm delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, label: '' });

  const { showToast } = useToast();

  const getInitialForm = () => ({
    particulars: '',
    givenBy: '',
    givenTo: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const [formData, setFormData] = useState(getInitialForm());

  const fetchOperationsData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchQuery) params.search = searchQuery;

      const res = await getOperations(params);
      if (res && res.success) {
        setOperations(res.data || []);
      } else if (Array.isArray(res)) {
        setOperations(res);
      } else {
        setOperations([]);
      }
    } catch (err) {
      console.error('Failed to fetch operations:', err);
      showToast('Failed to load operation entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperationsData();
  }, [startDate, endDate]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData(getInitialForm());
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    let formattedDate = '';
    if (item.date) {
      formattedDate = new Date(item.date).toISOString().split('T')[0];
    }
    setFormData({
      particulars: item.particulars || '',
      givenBy: item.givenBy || '',
      givenTo: item.givenTo || '',
      amount: item.amount !== undefined && item.amount !== null ? item.amount : '',
      date: formattedDate || new Date().toISOString().split('T')[0],
      remarks: item.remarks || ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData(getInitialForm());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.particulars.trim()) {
      showToast('Please enter Particulars', 'error');
      return;
    }
    if (!formData.givenBy.trim()) {
      showToast('Please enter Who Gave (givenBy)', 'error');
      return;
    }
    if (!formData.givenTo.trim()) {
      showToast('Please enter To Whom (givenTo)', 'error');
      return;
    }
    if (formData.amount === '' || isNaN(formData.amount) || Number(formData.amount) < 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        particulars: formData.particulars.trim(),
        givenBy: formData.givenBy.trim(),
        givenTo: formData.givenTo.trim(),
        amount: Number(formData.amount),
        date: formData.date,
        remarks: formData.remarks.trim()
      };

      if (editingItem) {
        const id = editingItem._id || editingItem.id;
        const res = await updateOperation(id, payload);
        if (res && res.success) {
          showToast('Operation entry updated successfully!', 'success');
        } else {
          showToast('Updated operation entry', 'success');
        }
      } else {
        const res = await createOperation(payload);
        if (res && res.success) {
          showToast('Operation entry added successfully!', 'success');
        } else {
          showToast('Operation entry created', 'success');
        }
      }

      handleCloseModal();
      fetchOperationsData();
    } catch (err) {
      console.error('Error saving operation entry:', err);
      const msg = err.response?.data?.message || 'Failed to save operation entry';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteOperation(deleteConfirm.id);
      showToast('Operation entry deleted successfully', 'success');
      setDeleteConfirm({ isOpen: false, id: null, label: '' });
      fetchOperationsData();
    } catch (err) {
      console.error('Failed to delete operation entry:', err);
      showToast('Failed to delete operation entry', 'error');
    }
  };

  // Filtered list based on searchQuery
  const filteredOperations = useMemo(() => {
    if (!searchQuery.trim()) return operations;
    const q = searchQuery.toLowerCase();
    return operations.filter(op => 
      (op.particulars && op.particulars.toLowerCase().includes(q)) ||
      (op.givenBy && op.givenBy.toLowerCase().includes(q)) ||
      (op.givenTo && op.givenTo.toLowerCase().includes(q)) ||
      (op.remarks && op.remarks.toLowerCase().includes(q)) ||
      (op.amount && String(op.amount).includes(q))
    );
  }, [operations, searchQuery]);

  // Statistics
  const totalAmount = useMemo(() => {
    return filteredOperations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredOperations]);

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Summary & Action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Total Amount Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Operations Amount</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Entries Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Entries</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {filteredOperations.length}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Add Operation Action Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 rounded-2xl p-4 shadow-md text-white flex items-center justify-between sm:col-span-2 md:col-span-1">
          <div>
            <p className="text-xs font-medium text-indigo-100">Operation Entry</p>
            <h4 className="text-base font-bold mt-0.5">Add Amount Details</h4>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Amount</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search particulars, given by, to whom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-slate-700 dark:text-slate-200"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-slate-700 dark:text-slate-200"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
            >
              Clear Dates
            </button>
          )}

          <button
            onClick={fetchOperationsData}
            title="Refresh Data"
            className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Operations Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold">Loading operation records...</p>
          </div>
        ) : filteredOperations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Operation Entries Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              No entries match your search criteria. Click "Add Amount" to record a new operation transaction.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <Plus size={14} />
              <span>Add Amount Entry</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Particulars</th>
                  <th className="py-3.5 px-4">Who Gave (From)</th>
                  <th className="py-3.5 px-4">To Whom (Given To)</th>
                  <th className="py-3.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredOperations.map((item) => (
                  <tr 
                    key={item._id || item.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Date */}
                    <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDateDisplay(item.date)}
                    </td>

                    {/* Particulars */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                      {item.particulars}
                    </td>

                    {/* Who Gave */}
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg font-semibold text-[11px]">
                        <UserCheck size={12} />
                        {item.givenBy}
                      </span>
                    </td>

                    {/* To Whom */}
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg font-semibold text-[11px]">
                        <ArrowRight size={12} />
                        {item.givenTo}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      ₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Remarks */}
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {item.remarks || '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          title="Edit Entry"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({
                            isOpen: true,
                            id: item._id || item.id,
                            label: `${item.particulars} (₹${item.amount})`
                          })}
                          title="Delete Entry"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Operation Entry Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="fixed inset-0 bg-slate-950/60" onClick={handleCloseModal} />
          <div className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FileText size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingItem ? 'Edit Operation Entry' : 'Add Operation Entry'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Particulars */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Particulars <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter particulars or transaction details..."
                  value={formData.particulars}
                  onChange={(e) => setFormData({ ...formData, particulars: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Who Gave & To Whom Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Who Gave */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Who Gave (Given By) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. John Doe, Admin..."
                    value={formData.givenBy}
                    onChange={(e) => setFormData({ ...formData, givenBy: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* To Whom */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    To Whom (Given To) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Vendor, Accountant..."
                    value={formData.givenTo}
                    onChange={(e) => setFormData({ ...formData, givenTo: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Date & Amount Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional remarks..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Save Changes' : 'Add Amount'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, label: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Operation Entry"
        message={`Are you sure you want to delete the operation entry "${deleteConfirm.label}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default OperationTab;
