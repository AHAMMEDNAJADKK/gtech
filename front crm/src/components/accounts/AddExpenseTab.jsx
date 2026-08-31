import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getExpenseCategories, getExpenses, createExpense, deleteExpense, approveOrRejectExpense } from '../../services/accountsService';
import ExpenseCategoriesTab from './ExpenseCategoriesTab';
import { 
  PlusCircle, 
  Search, 
  Calendar, 
  CreditCard, 
  UserCheck, 
  FileText, 
  Paperclip, 
  Trash2, 
  Eye, 
  X, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Loader2,
  DollarSign,
  Tag,
  Receipt,
  Coins,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw
} from 'lucide-react';
import { getOpeningBalance, setOpeningBalance as saveOpeningBalanceApi } from '../../services/accountsService';
import { useToast } from '../ToastProvider';

const AddExpenseTab = () => {
  const { showToast } = useToast();
  const [expenseSubTab, setExpenseSubTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/accounts/categories')) {
      return 'categories';
    }
    return 'expenses';
  });

  // Expense Opening Balance State
  const [showExpenseObModal, setShowExpenseObModal] = useState(false);
  const [expenseObSaving, setExpenseObSaving] = useState(false);
  const [expenseObAmount, setExpenseObAmount] = useState(0);
  const [expenseObForm, setExpenseObForm] = useState({
    expenseAmount: '',
    asOfDate: new Date().toISOString().split('T')[0],
    paymentMode: 'ALL',
    note: ''
  });

  const fetchExpenseOb = async () => {
    try {
      const res = await getOpeningBalance();
      if (res && res.success && res.data) {
        setExpenseObAmount(res.data.expenseAmount !== undefined ? res.data.expenseAmount : 0);
      }
    } catch (e) {
      console.warn('Error fetching expense opening balance:', e);
    }
  };

  const handleOpenExpenseObModal = async () => {
    try {
      const res = await getOpeningBalance();
      if (res && res.success && res.data) {
        setExpenseObForm({
          expenseAmount: res.data.expenseAmount !== undefined ? res.data.expenseAmount : '',
          asOfDate: res.data.asOfDate ? new Date(res.data.asOfDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          paymentMode: res.data.paymentMode || 'ALL',
          note: res.data.note || ''
        });
      }
    } catch (e) {
      console.warn('Error opening expense OB modal:', e);
    }
    setShowExpenseObModal(true);
  };

  const handleSaveExpenseOpeningBalance = async (e) => {
    e.preventDefault();
    setExpenseObSaving(true);
    try {
      const res = await saveOpeningBalanceApi({
        expenseAmount: expenseObForm.expenseAmount,
        asOfDate: expenseObForm.asOfDate,
        paymentMode: expenseObForm.paymentMode,
        note: expenseObForm.note
      });
      if (res && res.success) {
        setShowExpenseObModal(false);
        showToast('Expense Opening Balance updated successfully!', 'success');
        fetchExpenseOb();
        loadData();
      } else {
        showToast(res?.message || 'Failed to update opening balance.', 'error');
      }
    } catch (err) {
      console.error('Error saving expense opening balance:', err);
      showToast('Error updating expense opening balance.', 'error');
    } finally {
      setExpenseObSaving(false);
    }
  };

  useEffect(() => {
    if (expenseSubTab === 'expenses') {
      loadData();
      fetchExpenseOb();
    }
  }, [expenseSubTab]);

  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add Expense Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paidTo, setPaidTo] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreviewName, setAttachmentPreviewName] = useState('');

  // Tax & GST States
  const [taxOption, setTaxOption] = useState('No GST'); // 'No GST', 'Exclusive GST', 'Inclusive GST'
  const [gstCategory, setGstCategory] = useState('CGST_SGST'); // 'CGST_SGST', 'IGST', 'UTGST', 'EXEMPT'
  const [gstRate, setGstRate] = useState(0);
  const [gstRatesList, setGstRatesList] = useState([0, 0.25, 3, 5, 12, 18, 28]);

  const handleAddCustomGst = () => {
    const input = window.prompt("Enter custom GST rate percentage (e.g. 6 or 15):");
    if (input === null) return;
    const parsed = parseFloat(input);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      showToast("Please enter a valid GST percentage (0 to 100).", "warning");
      return;
    }
    if (!gstRatesList.includes(parsed)) {
      setGstRatesList(prev => [...prev, parsed].sort((a, b) => a - b));
    }
    setGstRate(parsed);
    if (taxOption === 'No GST') setTaxOption('Exclusive GST');
    showToast(`Added custom GST rate: ${parsed}%`, "success");
  };

  const calculateTaxValues = (baseAmt, option, rate, categoryType) => {
    const base = parseFloat(baseAmt) || 0;
    if (option === 'No GST' || !rate || rate <= 0 || categoryType === 'EXEMPT') {
      return { gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalAmount: base, baseAmount: base };
    }

    let totalTax = 0;
    let totalAmt = base;
    let calcBase = base;

    if (option === 'Exclusive GST') {
      totalTax = (base * rate) / 100;
      totalAmt = base + totalTax;
      calcBase = base;
    } else if (option === 'Inclusive GST') {
      calcBase = base / (1 + rate / 100);
      totalTax = base - calcBase;
      totalAmt = base;
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (categoryType === 'CGST_SGST' || categoryType === 'UTGST') {
      cgst = totalTax / 2;
      sgst = totalTax / 2;
    } else if (categoryType === 'IGST') {
      igst = totalTax;
    }

    return {
      gstAmount: totalTax,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      totalAmount: totalAmt,
      baseAmount: calcBase
    };
  };

  const currentTaxCalc = calculateTaxValues(amount, taxOption, gstRate, gstCategory);

  // Filter & Sort States
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'amount' | 'paidTo' | 'category'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Active Filter Count
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filterCategory) count++;
    if (filterMode) count++;
    if (filterStatus) count++;
    if (startDate) count++;
    if (endDate) count++;
    if (sortBy !== 'date' || sortOrder !== 'desc') count++;
    return count;
  }, [filterCategory, filterMode, filterStatus, startDate, endDate, sortBy, sortOrder]);

  // Sort & Filter Expenses Client-Side
  const sortedAndFilteredExpenses = React.useMemo(() => {
    let result = [...expenses];
    if (startDate) {
      result = result.filter(e => {
        const d = e.date ? new Date(e.date).toISOString().split('T')[0] : '';
        return d >= startDate;
      });
    }
    if (endDate) {
      result = result.filter(e => {
        const d = e.date ? new Date(e.date).toISOString().split('T')[0] : '';
        return d <= endDate;
      });
    }

    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'amount') {
        valA = Number(a.totalAmount || a.amount || 0);
        valB = Number(b.totalAmount || b.amount || 0);
      } else if (sortBy === 'paidTo') {
        valA = (a.paidTo || '').toLowerCase();
        valB = (b.paidTo || '').toLowerCase();
      } else if (sortBy === 'category') {
        valA = (a.category?.name || a.categoryName || '').toLowerCase();
        valB = (b.category?.name || b.categoryName || '').toLowerCase();
      } else {
        valA = new Date(a.date || 0).getTime();
        valB = new Date(b.date || 0).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [expenses, startDate, endDate, sortBy, sortOrder]);

  // View Attachment Modal
  const [previewFile, setPreviewFile] = useState(null);

  const currentUserStr = localStorage.getItem('user');
  let currentUserName = 'Current User';
  let isApprover = false;
  try {
    if (currentUserStr) {
      const u = JSON.parse(currentUserStr);
      currentUserName = u.name || u.email || 'Current User';
      const roleStr = String(u.role || '').toLowerCase();
      isApprover = u.isSuperAdmin === true || ['0', '1', '2', 'admin', 'superadmin', 'md', 'coo', 'executive_director'].includes(roleStr);
    }
  } catch (e) {}

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [catRes, expRes] = await Promise.all([
        getExpenseCategories(),
        getExpenses({ category: filterCategory, paymentMode: filterMode, status: filterStatus, search: searchTerm })
      ]);
      if (catRes.success) setCategories(catRes.data || []);
      if (expRes.success) setExpenses(expRes.data || []);
    } catch (err) {
      console.error('Data load error:', err);
      setError('Failed to load expense records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterCategory, filterMode, filterStatus]);

  const handleExpenseAction = async (id, action) => {
    let rejectionReason = '';
    if (action === 'REJECTED') {
      const input = window.prompt('Enter rejection reason (Optional):');
      if (input === null) return;
      rejectionReason = input;
    }
    try {
      const res = await approveOrRejectExpense(id, { action, rejectionReason });
      if (res.success) {
        showToast(`Expense ${action.toLowerCase()} successfully!`, 'success');
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update expense status.', 'error');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachment(file);
      setAttachmentPreviewName(file.name);
    } else {
      setAttachment(null);
      setAttachmentPreviewName('');
    }
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!categoryId || !amount || !paymentMode || !paidTo.trim()) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('date', date);
      formData.append('category', categoryId);
      formData.append('amount', amount);
      formData.append('paymentMode', paymentMode);
      formData.append('paidTo', paidTo.trim());
      formData.append('description', description.trim());
      formData.append('taxOption', taxOption);
      formData.append('gstCategory', gstCategory);
      formData.append('gstRate', gstRate);
      formData.append('gstAmount', currentTaxCalc.gstAmount);
      formData.append('cgstAmount', currentTaxCalc.cgstAmount);
      formData.append('sgstAmount', currentTaxCalc.sgstAmount);
      formData.append('igstAmount', currentTaxCalc.igstAmount);
      formData.append('totalAmount', currentTaxCalc.totalAmount);
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const res = await createExpense(formData);
      if (res.success) {
        showToast('Expense record saved successfully!', 'success');
        setAmount('');
        setPaidTo('');
        setDescription('');
        setAttachment(null);
        setAttachmentPreviewName('');
        setIsAddModalOpen(false);
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error recording expense.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense entry?')) return;
    try {
      const res = await deleteExpense(id);
      if (res.success) {
        showToast('Expense entry deleted.', 'success');
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error deleting expense.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Header inside Add Expense */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-2 shadow-xs flex items-center gap-1.5 w-fit">
        <button
          onClick={() => setExpenseSubTab('expenses')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            expenseSubTab === 'expenses'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <PlusCircle size={14} />
          <span>Expenses List</span>
        </button>

        <button
          onClick={() => setExpenseSubTab('categories')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            expenseSubTab === 'categories'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Tag size={14} />
          <span>Expense Categories</span>
        </button>
      </div>

      {expenseSubTab === 'categories' ? (
        <ExpenseCategoriesTab />
      ) : (
        <>
          {/* Sleek 1-Row Toolbar Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left Title */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Expense Records
            </h3>
          </div>

          {/* Expense Opening Balance Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300 shrink-0">
            <Coins size={13} />
            <span>OB: ₹{expenseObAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Right Search, Filters & Action Button */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap justify-end">
          {/* Search Input */}
          <div className="relative w-full md:w-48">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              placeholder="Search paid to, notes..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          {/* Single Sort & Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`py-1.5 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border ${
              activeFilterCount > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={14} className={activeFilterCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'} />
            <span>Sort & Filter</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px] font-extrabold ml-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={loadData}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Set Expense Opening Balance Button */}
          <button
            type="button"
            onClick={handleOpenExpenseObModal}
            className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-98 shrink-0"
          >
            <Coins size={14} />
            <span>Set Opening Balance</span>
          </button>

          {/* + Record Expense Modal Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-98 shrink-0"
          >
            <PlusCircle size={14} />
            + Record Expense
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Paid To</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Added By</th>
                <th className="py-3 px-4 text-center">Attachment</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                    Loading expenses...
                  </td>
                </tr>
              ) : sortedAndFilteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No expense records found matching current filters.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredExpenses.map((exp) => {
                  const status = exp.status || 'PENDING';
                  return (
                    <tr key={exp._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                        {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">
                          {exp.categoryName || exp.category?.name || 'Expense'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {exp.paidTo}
                        {exp.description && (
                          <div className="text-[11px] font-normal text-slate-400 line-clamp-1">{exp.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                          {exp.paymentMode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                        ₹{parseFloat(exp.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        {status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-bold">
                            ✓ Approved
                          </span>
                        )}
                        {status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] font-bold">
                            ✕ Rejected
                          </span>
                        )}
                        {status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] font-bold">
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {exp.addedByName || exp.addedBy?.name || 'Accountant'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {exp.attachmentUrl ? (
                          <button
                            onClick={() => setPreviewFile(exp.attachmentUrl)}
                            className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                            title="View Attachment"
                          >
                            <Eye size={14} />
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isApprover && status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleExpenseAction(exp._id, 'APPROVED')}
                                className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 transition cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleExpenseAction(exp._id, 'REJECTED')}
                                className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteExpense(exp._id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete"
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

      {/* Display-Centered Wide Add Expense Modal (Responsive Scrollable Flexbox - Portal to document.body) */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PlusCircle size={16} className="text-indigo-500" />
                Record New Expense Entry
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Row 1: Date (1 col) + Expense Category (1 col) + Amount (1 col) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Expense Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="e.g. 2500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-bold"
                  />
                </div>
              </div>

              {/* Tax & GST Section with GST Categories and (+) Plus Button for Custom GST */}
              <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Receipt size={14} className="text-indigo-500" />
                    Tax & GST Options
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Calculated GST: <strong className="text-indigo-600 dark:text-indigo-400">₹{currentTaxCalc.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong> | Total: <strong className="text-slate-900 dark:text-white">₹{currentTaxCalc.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">GST Application</label>
                    <select
                      value={taxOption}
                      onChange={(e) => {
                        setTaxOption(e.target.value);
                        if (e.target.value !== 'No GST' && gstRate === 0) setGstRate(18);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="No GST">No GST (0%)</option>
                      <option value="Exclusive GST">Exclusive GST (Base + GST Tax)</option>
                      <option value="Inclusive GST">Inclusive GST (Amount Includes GST)</option>
                    </select>
                  </div>

                  {taxOption !== 'No GST' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">GST Category / Type</label>
                        <select
                          value={gstCategory}
                          onChange={(e) => setGstCategory(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="CGST_SGST">CGST + SGST (Intra-State / Same State)</option>
                          <option value="IGST">IGST (Inter-State / Outside State)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          GST Rate (%)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={gstRate}
                            onChange={(e) => setGstRate(parseFloat(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                          >
                            {gstRatesList.map((rate) => (
                              <option key={rate} value={rate}>
                                GST {rate}%
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleAddCustomGst}
                            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shrink-0 shadow-xs"
                            title="Add Custom GST Rate %"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {taxOption !== 'No GST' && currentTaxCalc.gstAmount > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                    {gstCategory === 'CGST_SGST' ? (
                      <>
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
                          CGST ({gstRate / 2}%): ₹{currentTaxCalc.cgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
                          SGST ({gstRate / 2}%): ₹{currentTaxCalc.sgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
                        IGST ({gstRate}%): ₹{currentTaxCalc.igstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: Payment Mode (1 col) + Paid To (1 col) + Attachment (1 col) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Payment Mode <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="UPI">UPI / QR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Paid To <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Vendor or Receiver Name"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Attachment (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="expense-attachment-modal-input"
                    />
                    <label
                      htmlFor="expense-attachment-modal-input"
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <span className="truncate">{attachmentPreviewName || 'Choose file...'}</span>
                      <Paperclip size={14} className="shrink-0 text-slate-400" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 3: Description / Notes (3 cols) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Description / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Purchased monthly printer paper & cartridges"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-medium"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={13} />
                      Saving...
                    </>
                  ) : (
                    'Save Expense Entry'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Attachment Preview Modal (Portal to document.body) */}
      {previewFile && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/70" onClick={() => setPreviewFile(null)} />
          <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Attachment Preview</h4>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto flex items-center justify-center">
              {previewFile.endsWith('.pdf') ? (
                <iframe src={previewFile} className="w-full h-[60vh] rounded-xl" title="PDF Preview" />
              ) : (
                <img src={previewFile} alt="Attachment" className="max-w-full max-h-[60vh] object-contain rounded-xl" />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Set Expense Opening Balance Modal (Portal to document.body) */}
      {showExpenseObModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600">
                  <Coins size={18} />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Set Expense Opening Balance</h3>
              </div>
              <button 
                onClick={() => setShowExpenseObModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseOpeningBalance} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Expense Opening Balance (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 20000"
                  value={expenseObForm.expenseAmount}
                  onChange={(e) => setExpenseObForm({ ...expenseObForm, expenseAmount: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/40 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  As of Date (Effective Date)
                </label>
                <input
                  type="date"
                  value={expenseObForm.asOfDate}
                  onChange={(e) => setExpenseObForm({ ...expenseObForm, asOfDate: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/40 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Account / Payment Mode
                </label>
                <select
                  value={expenseObForm.paymentMode}
                  onChange={(e) => setExpenseObForm({ ...expenseObForm, paymentMode: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/40 outline-none"
                >
                  <option value="ALL">All Combined Accounts</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="BANK">Bank Account</option>
                  <option value="ONLINE">Online / UPI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Notes / Reference
                </label>
                <textarea
                  rows={2}
                  placeholder="Starting expense balance note..."
                  value={expenseObForm.note}
                  onChange={(e) => setExpenseObForm({ ...expenseObForm, note: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/40 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExpenseObModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseObSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {expenseObSaving ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                  <span>Save Expense Opening</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Sleek Sort & Filter Modal (Portal to document.body) */}
      {isFilterModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Sort & Filter Expenses</h3>
                  <p className="text-[11px] text-slate-400">Filter expense ledger by category, mode, status, date & sorting</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Controls Grid */}
            <div className="space-y-4">
              {/* Category Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Tag size={13} className="text-indigo-500" /> Expense Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="">All Expense Categories</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Payment Mode & Status Filter Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <CreditCard size={13} className="text-indigo-500" /> Payment Mode
                  </label>
                  <select
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="">All Payment Modes</option>
                    <option value="Cash">Cash in Hand</option>
                    <option value="UPI_BANK">UPI / Bank Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <UserCheck size={13} className="text-indigo-500" /> Approval Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Date Range Filter Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-indigo-500" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-indigo-500" /> End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              </div>

              {/* Sort Field & Order Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <ArrowUpDown size={13} className="text-indigo-500" /> Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="date">Entry Date</option>
                    <option value="amount">Expense Amount</option>
                    <option value="paidTo">Paid To / Recipient</option>
                    <option value="category">Category Name</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Sort Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="desc">Descending (Newest / Highest First)</option>
                    <option value="asc">Ascending (Oldest / Lowest First)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setFilterCategory('');
                  setFilterMode('');
                  setFilterStatus('');
                  setStartDate('');
                  setEndDate('');
                  setSortBy('date');
                  setSortOrder('desc');
                }}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer flex items-center gap-1 transition"
              >
                <RotateCcw size={13} /> Reset All
              </button>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer active:scale-98"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
        </>
      )}
    </div>
  );
};

export default AddExpenseTab;
