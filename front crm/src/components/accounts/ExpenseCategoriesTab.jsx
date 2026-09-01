import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  getExpenseCategories, 
  createExpenseCategory, 
  updateExpenseCategory, 
  deleteExpenseCategory,
  updateBatchCategoryOpeningBalances 
} from '../../services/accountsService';
import { 
  FolderPlus, 
  Tag, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  Plus, 
  AlertCircle, 
  RefreshCw, 
  IndianRupee, 
  Search, 
  ShieldCheck,
  Coins,
  Pencil,
  X,
  SlidersHorizontal,
  Save,
  Loader2
} from 'lucide-react';
import { useToast } from '../ToastProvider';

const ExpenseCategoriesTab = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New category modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [categoryOpeningBalance, setCategoryOpeningBalance] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit category state
  const [editingCategory, setEditingCategory] = useState(null);

  // Batch Opening Balances Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchBalances, setBatchBalances] = useState({}); // { [catId]: string/number }
  const [batchSearch, setBatchSearch] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getExpenseCategories();
      if (res.success) {
        setCategories(res.data || []);
      } else {
        setError(res.message || 'Failed to fetch categories.');
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
      setError(err.response?.data?.message || 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    
    setSaving(true);
    setError('');
    try {
      const obVal = categoryOpeningBalance !== '' && !isNaN(Number(categoryOpeningBalance)) ? Math.max(0, Number(categoryOpeningBalance)) : 0;
      const res = await createExpenseCategory({
        name: categoryName.trim(),
        description: categoryDesc.trim(),
        openingBalance: obVal
      });
      if (res.success) {
        showToast(res.message || 'Expense category created successfully!', 'success');
        setSuccessMsg(res.message || 'Category created successfully!');
        if (res.data) {
          setCategories(prev => {
            const exists = prev.some(c => c._id === res.data._id || (c.name || '').toLowerCase().trim() === (res.data.name || '').toLowerCase().trim());
            if (exists) {
              return prev.map(c => (c._id === res.data._id || (c.name || '').toLowerCase().trim() === (res.data.name || '').toLowerCase().trim()) ? res.data : c);
            }
            return [...prev, res.data];
          });
        }
        setCategoryName('');
        setCategoryDesc('');
        setCategoryOpeningBalance('');
        setIsModalOpen(false);
        fetchCategories();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(res.message || 'Failed to create category.');
        showToast(res.message || 'Failed to create category.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create category.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;

    setSaving(true);
    setError('');
    try {
      const obVal = editingCategory.openingBalance !== '' && !isNaN(Number(editingCategory.openingBalance)) ? Math.max(0, Number(editingCategory.openingBalance)) : 0;
      const res = await updateExpenseCategory(editingCategory._id, {
        name: editingCategory.name.trim(),
        description: editingCategory.description ? editingCategory.description.trim() : '',
        openingBalance: obVal,
        isActive: editingCategory.isActive !== undefined ? editingCategory.isActive : true
      });
      if (res.success) {
        showToast(res.message || 'Expense category updated successfully!', 'success');
        setSuccessMsg(res.message || 'Category updated successfully!');
        if (res.data) {
          setCategories(prev => prev.map(cat => cat._id === res.data._id ? { ...cat, ...res.data } : cat));
        }
        setEditingCategory(null);
        fetchCategories();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(res.message || 'Failed to update category.');
        showToast(res.message || 'Failed to update category.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update category.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      const res = await deleteExpenseCategory(id);
      if (res.success) {
        showToast('Category deleted successfully.', 'success');
        setSuccessMsg('Category deleted successfully.');
        fetchCategories();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        showToast(res.message || 'Cannot delete category.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Cannot delete category.', 'error');
    }
  };

  const handleOpenBatchModal = () => {
    const initialMap = {};
    categories.forEach(c => {
      initialMap[c._id] = c.openingBalance !== undefined && c.openingBalance !== null ? String(c.openingBalance) : '0';
    });
    setBatchBalances(initialMap);
    setBatchSearch('');
    setIsBatchModalOpen(true);
  };

  const handleSaveBatchBalances = async (e) => {
    e.preventDefault();
    setBatchSaving(true);
    setError('');
    try {
      const payload = Object.entries(batchBalances).map(([id, ob]) => ({
        id,
        openingBalance: ob !== '' && !isNaN(Number(ob)) ? Math.max(0, Number(ob)) : 0
      }));

      const res = await updateBatchCategoryOpeningBalances(payload);
      if (res.success) {
        showToast('All category opening balances updated successfully!', 'success');
        setSuccessMsg('Category opening balances saved successfully!');
        if (res.data) {
          setCategories(res.data);
        }
        setIsBatchModalOpen(false);
        fetchCategories();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(res.message || 'Failed to update category opening balances.');
        showToast(res.message || 'Failed to update category opening balances.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update opening balances.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setBatchSaving(false);
    }
  };

  const totalBatchBalance = useMemo(() => {
    return Object.values(batchBalances).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [batchBalances]);

  const filteredBatchCategories = useMemo(() => {
    if (!batchSearch.trim()) return categories;
    const q = batchSearch.toLowerCase().trim();
    return categories.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, batchSearch]);

  // Metrics
  const totalCategories = categories.length;
  const activeCategoriesCount = categories.filter(c => c.isActive).length;
  const totalOpeningBalance = useMemo(() => {
    return categories.reduce((sum, cat) => sum + (Number(cat.openingBalance) || 0), 0);
  }, [categories]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <Tag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Expense Categories Master
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage categories for classifying company expenses, setting opening balances & tracking financial outflow.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
          <button
            onClick={fetchCategories}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Refresh Categories"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={handleOpenBatchModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer flex-1 sm:flex-none"
            title="Set opening balance to every category"
          >
            <Coins size={16} />
            <span>Set Opening Balances</span>
          </button>
          <button
            onClick={() => {
              setCategoryName('');
              setCategoryDesc('');
              setCategoryOpeningBalance('');
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-md shadow-indigo-500/20 transition cursor-pointer flex-1 sm:flex-none"
          >
            <Plus size={16} />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Categories</p>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
              {totalCategories}
            </h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Tag size={18} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Categories</p>
            <h4 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {activeCategoriesCount}
            </h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle size={18} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Opening Balance</p>
            <h4 className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              ₹{totalOpeningBalance.toLocaleString('en-IN')}
            </h4>
            <button
              type="button"
              onClick={handleOpenBatchModal}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline mt-1 inline-flex items-center gap-1 cursor-pointer"
            >
              <Coins size={12} />
              <span>Edit Every Balance →</span>
            </button>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <IndianRupee size={18} />
          </div>
        </div>
      </div>

      {/* Messages */}
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

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800">
          <Tag size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No categories found</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {searchQuery ? 'Try adjusting your search criteria.' : 'Click "Add Category" above to create your first expense category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredCategories.map((cat) => (
            <div
              key={cat._id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 hover:shadow-md transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2 truncate" title={cat.name}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cat.isActive ? 'bg-indigo-500' : 'bg-slate-400'}`}></span>
                    <span className="truncate">{cat.name}</span>
                  </span>
                  {cat.isSystemDefault && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0 flex items-center gap-1">
                      <ShieldCheck size={10} />
                      System
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[32px]">
                  {cat.description || 'Standard expense classification category.'}
                </p>

                {/* Opening Balance Row */}
                <div 
                  onClick={() => setEditingCategory({
                    _id: cat._id,
                    name: cat.name,
                    description: cat.description || '',
                    openingBalance: cat.openingBalance ? String(cat.openingBalance) : '',
                    isActive: cat.isActive !== undefined ? cat.isActive : true,
                    isSystemDefault: cat.isSystemDefault || false
                  })}
                  className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition group/ob"
                  title="Click to set or edit opening balance"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <IndianRupee size={12} className="text-amber-500" />
                    <span>Opening Balance</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                      ₹{Number(cat.openingBalance || 0).toLocaleString('en-IN')}
                    </span>
                    <Pencil size={11} className="text-slate-400 group-hover/ob:text-indigo-600 transition" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-4">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  cat.isActive 
                    ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40' 
                    : 'text-slate-500 bg-slate-100 dark:bg-slate-800'
                }`}>
                  {cat.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingCategory({
                      _id: cat._id,
                      name: cat.name,
                      description: cat.description || '',
                      openingBalance: cat.openingBalance ? String(cat.openingBalance) : '',
                      isActive: cat.isActive !== undefined ? cat.isActive : true,
                      isSystemDefault: cat.isSystemDefault || false
                    })}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Edit Category & Opening Balance"
                  >
                    <Edit2 size={14} />
                  </button>
                  {!cat.isSystemDefault && (
                    <button
                      onClick={() => handleDeleteCategory(cat._id, cat.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal (Portal to document.body) */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 my-auto">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FolderPlus size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span>Add New Expense Category</span>
            </h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Supplies, Travel & Fuel"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Opening Balance (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={categoryOpeningBalance}
                    onChange={(e) => setCategoryOpeningBalance(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Starting initial balance allocated or carried forward for this category.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Brief summary of expenses under this category..."
                  value={categoryDesc}
                  onChange={(e) => setCategoryDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal (Portal to document.body) */}
      {editingCategory && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setEditingCategory(null)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 my-auto">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Edit2 size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span>Edit Category & Opening Balance</span>
            </h3>
            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Opening Balance (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={editingCategory.openingBalance ?? ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, openingBalance: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Starting initial balance allocated or carried forward for this category.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catIsActive"
                  checked={editingCategory.isActive ?? true}
                  onChange={(e) => setEditingCategory({ ...editingCategory, isActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="catIsActive" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Category is Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Updating...' : 'Update Category'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Batch Category Opening Balances Modal (Portal to document.body) */}
      {isBatchModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setIsBatchModalOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Set Opening Balances for Every Category
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter starting opening balance allocations for each expense category.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Quick Action Toolbar */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder="Filter categories by name..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const cleared = {};
                  categories.forEach(c => { cleared[c._id] = '0'; });
                  setBatchBalances(cleared);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 transition cursor-pointer shrink-0"
              >
                Reset All to ₹0
              </button>
            </div>

            {/* Categories Table / List (Scrollable) */}
            <form onSubmit={handleSaveBatchBalances} className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredBatchCategories.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No matching categories found.
                </div>
              ) : (
                filteredBatchCategories.map((cat) => {
                  const currentVal = batchBalances[cat._id] !== undefined ? batchBalances[cat._id] : '';

                  return (
                    <div key={cat._id} className="pt-2.5 pb-1 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {cat.name}
                          </span>
                          {cat.isSystemDefault && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold">
                              Default
                            </span>
                          )}
                          {!cat.isActive && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold">
                              Inactive
                            </span>
                          )}
                        </div>
                        {cat.description && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{cat.description}</p>
                        )}
                      </div>

                      <div className="w-40 shrink-0">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={currentVal}
                            onChange={(e) => setBatchBalances({ ...batchBalances, [cat._id]: e.target.value })}
                            className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40 focus:outline-none text-right"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Sticky Footer inside modal */}
              <div className="sticky bottom-0 bg-white dark:bg-slate-900 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Total Category OB:</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                    ₹{totalBatchBalance.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBatchModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={batchSaving}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {batchSaving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving Balances...</span>
                      </>
                    ) : (
                      <>
                        <Save size={13} />
                        <span>Save All Opening Balances</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ExpenseCategoriesTab;
