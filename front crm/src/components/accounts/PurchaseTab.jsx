import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShoppingCart, 
  PlusCircle, 
  Search, 
  Filter, 
  Trash2, 
  Eye, 
  X, 
  CheckCircle2, 
  Clock, 
  FileText, 
  TrendingDown,
  Building2,
  Calendar,
  PackageCheck
} from 'lucide-react';
import { useToast } from '../ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) {
    return `${API_BASE}${cleanPath}`;
  }
  if (API_BASE.endsWith('/api')) {
    return `${API_BASE}/v1${cleanPath}`;
  }
  return `${API_BASE}/api/v1${cleanPath}`;
};

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem('token') || '';
  const cleanToken = rawToken.replace(/^"(.*)"$/, '$1').trim();
  return {
    'Content-Type': 'application/json',
    'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
  };
};

const PurchaseTab = () => {
  const { showToast } = useToast();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Tab View state ('list' | 'record')
  const [viewMode, setViewMode] = useState('list');
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Background scroll lock when modal is open
  useEffect(() => {
    if (isViewModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isViewModalOpen]);

  // Automatic sync for offline purchase records when network restores
  useEffect(() => {
    const handleOnlineSync = async () => {
      try {
        const savedLocal = JSON.parse(localStorage.getItem('crm_purchase_records') || '[]');
        const offlineEntries = savedLocal.filter(p => String(p._id || p.id || '').startsWith('pur_'));
        if (offlineEntries.length > 0) {
          for (const entry of offlineEntries) {
            try {
              await fetch(getApiEndpoint('/accounts/expenses'), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(entry)
              });
            } catch (err) {}
          }
          showToast(`Synced ${offlineEntries.length} offline purchase record(s) to server!`, 'success');
        }
      } catch (e) {
        console.warn('Error syncing offline purchase records:', e);
      } finally {
        fetchPurchasesData();
      }
    };

    window.addEventListener('online', handleOnlineSync);
    return () => window.removeEventListener('online', handleOnlineSync);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    billNo: '',
    vendorName: '',
    itemName: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    amount: '',
    gstRate: '18',
    paymentStatus: 'Paid',
    paymentMethod: 'Bank Transfer',
    remarks: ''
  });

  const fetchPurchasesData = async () => {
    setLoading(true);
    try {
      const savedLocal = JSON.parse(localStorage.getItem('crm_purchase_records') || '[]');

      const res = await fetch(getApiEndpoint('/accounts/expenses'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          // Filter strictly for purchase procurement entries only (excludes general expenses)
          const filtered = data.data.filter(item => {
            const cat = String(item.categoryName || item.category || '').toLowerCase();
            return cat.includes('purchase') || cat.includes('inventory') || cat.includes('vendor') || item.isPurchase === true;
          });

          const combinedMap = new Map();
          savedLocal.forEach(p => combinedMap.set(String(p._id || p.id), p));
          filtered.forEach(p => combinedMap.set(String(p._id || p.id), p));

          setPurchases(Array.from(combinedMap.values()));
        } else {
          setPurchases(savedLocal);
        }
      } else {
        setPurchases(savedLocal);
      }
    } catch (e) {
      console.warn('Error loading purchase data:', e);
      const saved = localStorage.getItem('crm_purchase_records');
      if (saved) setPurchases(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchasesData();
  }, []);

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    if (!formData.vendorName || !formData.amount || !formData.itemName) {
      showToast('Please fill in Vendor Name, Item/Service, and Amount.', 'warning');
      return;
    }

    const amt = parseFloat(formData.amount) || 0;
    const gstPct = parseFloat(formData.gstRate) || 0;
    const gstAmt = (amt * gstPct) / 100;
    const totalAmt = amt + gstAmt;

    const newPurchaseEntry = {
      _id: `pur_${Date.now()}`,
      billNo: formData.billNo || `PO-PUR-${Math.floor(1000 + Math.random() * 9000)}`,
      paidTo: formData.vendorName.trim(),
      categoryName: 'Inventory & Purchase',
      isPurchase: true,
      description: formData.itemName.trim(),
      date: formData.purchaseDate,
      amount: totalAmt,
      paymentMode: formData.paymentMethod,
      status: formData.paymentStatus === 'Paid' ? 'APPROVED' : (formData.paymentStatus === 'Partially Paid' ? 'PARTIAL' : 'PENDING'),
      remarks: formData.remarks.trim()
    };

    try {
      const res = await fetch(getApiEndpoint('/accounts/expenses'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newPurchaseEntry)
      });
      if (res.ok) {
        const data = await res.json();
        const createdItem = data.data ? { ...newPurchaseEntry, ...data.data } : newPurchaseEntry;
        const updated = [createdItem, ...purchases.filter(p => p._id !== createdItem._id)];
        setPurchases(updated);
        localStorage.setItem('crm_purchase_records', JSON.stringify(updated));
        showToast('Purchase record added successfully!', 'success');
      } else {
        const updated = [newPurchaseEntry, ...purchases];
        setPurchases(updated);
        localStorage.setItem('crm_purchase_records', JSON.stringify(updated));
        showToast('Purchase record saved locally!', 'success');
      }
    } catch (e) {
      const updated = [newPurchaseEntry, ...purchases];
      setPurchases(updated);
      localStorage.setItem('crm_purchase_records', JSON.stringify(updated));
      showToast('Purchase record saved!', 'success');
    }

    setViewMode('list');
    setFormData({
      billNo: '',
      vendorName: '',
      itemName: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      amount: '',
      gstRate: '18',
      paymentStatus: 'Paid',
      paymentMethod: 'Bank Transfer',
      remarks: ''
    });
    fetchPurchasesData();
  };

  const handleDeletePurchase = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase entry?')) return;
    try {
      await fetch(getApiEndpoint(`/accounts/expenses/${id}`), { method: 'DELETE', headers: getAuthHeaders() });
    } catch (e) {
      // Fallback
    }
    const updated = purchases.filter(p => String(p._id || p.id) !== String(id));
    setPurchases(updated);
    localStorage.setItem('crm_purchase_records', JSON.stringify(updated));
    showToast('Purchase entry deleted.', 'success');
  };

  // Filtered purchases
  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = 
      (p.paidTo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.billNo || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (p.status === 'APPROVED' ? 'PAID' : 'PENDING') === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalPurchaseOutflow = purchases.reduce((sum, p) => sum + (Number(p.amount || p.totalAmount) || 0), 0);
  const totalPaidPurchase = purchases.reduce((sum, p) => sum + (p.status === 'APPROVED' || p.status === 'Paid' ? (Number(p.amount || p.totalAmount) || 0) : 0), 0);
  const totalPendingPurchase = purchases.reduce((sum, p) => sum + (p.status === 'PENDING' || p.status === 'Pending' ? (Number(p.amount || p.totalAmount) || 0) : 0), 0);

  return (
    <div className="space-y-4">
      {/* 1-Row Sleek Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-1 py-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600/10 dark:bg-purple-400/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Purchase & Vendor Procurement
            </h3>
          </div>
        </div>

        {/* Right Search, Filters & Action Button */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap justify-end">
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Vendor, Item, Bill PO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY PAID">Partially Paid</option>
            <option value="PENDING">Pending</option>
          </select>

          {viewMode === 'list' ? (
            <button
              onClick={() => setViewMode('record')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <PlusCircle size={14} />
              <span>+ Record Purchase</span>
            </button>
          ) : (
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <span>← Back to Purchase List</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'record' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-600" /> Record Vendor Purchase Entry
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter vendor procurement details, purchase bill / PO reference, amount, and payment status.
              </p>
            </div>
            <button
              onClick={() => setViewMode('list')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Cancel & Back
            </button>
          </div>

          <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-extrabold text-slate-500 mb-1">Bill / PO No.</label>
                <input
                  type="text"
                  placeholder="Auto-generated if empty (e.g. PO-PUR-9102)"
                  value={formData.billNo}
                  onChange={(e) => setFormData({ ...formData, billNo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-extrabold text-slate-500 mb-1">Purchase Date *</label>
                <input
                  type="date"
                  required
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-semibold cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-extrabold text-slate-500 mb-1">Vendor / Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell India / Stationery Suppliers / Hostinger"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-extrabold text-slate-500 mb-1">Item / Asset / Service Purchased *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Laptops / Printing Paper / Server Hosting"
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-extrabold text-slate-500 mb-1">Base Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-extrabold text-slate-500 mb-1">GST Rate (%)</label>
                <select
                  value={formData.gstRate}
                  onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-semibold cursor-pointer"
                >
                  <option value="0">0% (Exempt / No GST)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST</option>
                  <option value="28">28% GST</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-extrabold text-slate-500 mb-1">Payment Status</label>
                <select
                  value={formData.paymentStatus}
                  onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-semibold cursor-pointer"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block font-extrabold text-slate-500 mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-semibold cursor-pointer"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI / QR Code">UPI / QR Code</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-extrabold text-slate-500 mb-1">Remarks / Notes</label>
              <textarea
                rows={3}
                placeholder="Additional purchase voucher notes, invoice link, or specifications..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-normal"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-md transition cursor-pointer"
              >
                Save Purchase Entry
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Purchase Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-purple-500/20 dark:border-purple-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total Purchase Outflow</p>
                <TrendingDown size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1.5 font-mono">
                ₹{totalPurchaseOutflow.toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{purchases.length} Purchase Orders / Bills</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Disbursed Payments</p>
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
                ₹{totalPaidPurchase.toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Vendor Bills Cleared</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Pending Vendor Payables</p>
                <Clock size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5 font-mono">
                ₹{totalPendingPurchase.toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Due / Outstanding Bills</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Vendor Count</p>
                <PackageCheck size={16} className="text-slate-600 dark:text-slate-400" />
              </div>
              <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1.5">
                {new Set(purchases.map(p => p.paidTo)).size}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Active Suppliers</p>
            </div>
          </div>

          {/* Purchase Transactions Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Procurement Register</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-y border-slate-200/60 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Bill / PO No</th>
                    <th className="py-2.5 px-3">Vendor / Supplier</th>
                    <th className="py-2.5 px-3">Item / Service Purchased</th>
                    <th className="py-2.5 px-3">Purchase Date</th>
                    <th className="py-2.5 px-3">Payment Status</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">Loading purchase entries...</td></tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">No purchase records found.</td></tr>
                  ) : (
                    filteredPurchases.map((p) => (
                      <tr key={p._id || p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">{p.billNo || `PO-PUR-${p._id.slice(-4)}`}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">{p.paidTo || 'Vendor'}</td>
                        <td className="py-3 px-3">{p.description || 'Equipment Purchase'}</td>
                        <td className="py-3 px-3 text-slate-500">{new Date(p.date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            (p.status === 'APPROVED' || p.status === 'Paid') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {(p.status === 'APPROVED' || p.status === 'Paid') ? 'PAID' : 'PENDING'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                          ₹{(Number(p.amount || p.totalAmount) || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setSelectedPurchase(p); setIsViewModalOpen(true); }}
                              className="p-1 text-slate-400 hover:text-purple-600 transition cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => handleDeletePurchase(p._id || p.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="Delete Purchase Record"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW PURCHASE DETAILS MODAL */}
      {isViewModalOpen && selectedPurchase && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-600" /> Purchase Voucher Details
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase">Bill / PO No</span>
                  <span className="font-mono font-bold text-purple-600">{selectedPurchase.billNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase">Vendor</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedPurchase.paidTo || 'Vendor'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase">Item Purchased</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedPurchase.description || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase">Purchase Date</span>
                  <span>{new Date(selectedPurchase.date || Date.now()).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase">Payment Status</span>
                  <span className="font-bold text-emerald-600 font-mono">{(selectedPurchase.status === 'APPROVED' || selectedPurchase.status === 'Paid') ? 'PAID' : 'PENDING'}</span>
                </div>
              </div>

              <div className="bg-purple-50/50 dark:bg-purple-950/30 p-3.5 rounded-2xl flex justify-between items-center">
                <span className="font-bold text-slate-600 dark:text-slate-300">Total Purchase Outflow</span>
                <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                  ₹{(Number(selectedPurchase.amount || selectedPurchase.totalAmount) || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PurchaseTab;
