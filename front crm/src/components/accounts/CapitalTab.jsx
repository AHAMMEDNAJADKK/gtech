import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Coins, 
  PlusCircle, 
  Search, 
  Trash2, 
  Eye, 
  X, 
  CheckCircle2, 
  Receipt, 
  Printer,
  TrendingUp
} from 'lucide-react';
import { useToast } from '../ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) {
    return `${API_BASE}${cleanPath}`;
  }
  return `${API_BASE}/v1${cleanPath}`;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const INITIAL_CAPITAL_RECORDS = [
  {
    _id: 'cap_101',
    voucherNo: 'CAP-2026-001',
    investorName: 'Management / Founder Capital',
    innerInvestors: 'Partner A (60%), Partner B (40%)',
    amount: 500000,
    date: '2026-04-01',
    paymentMethod: 'Bank Transfer',
    referenceNo: 'TXN-BANK-998822',
    status: 'Verified',
    remarks: 'Initial equity capital investment for Q1 ops'
  },
  {
    _id: 'cap_102',
    voucherNo: 'CAP-2026-002',
    investorName: 'Partner Equity Inflow',
    innerInvestors: 'Co-Founder Alpha, Angel Co-investor',
    amount: 250000,
    date: '2026-05-15',
    paymentMethod: 'NEFT/RTGS',
    referenceNo: 'NEFT-8839201',
    status: 'Verified',
    remarks: 'Additional capital contribution for business expansion'
  }
];

const CapitalTab = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Delete Capital Record Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Top-Up Additional Capital State
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpRecord, setTopUpRecord] = useState(null);
  const [topUpForm, setTopUpForm] = useState({
    additionalAmount: '',
    paymentMethod: 'Bank Transfer',
    referenceNo: '',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Form State
  const [formData, setFormData] = useState({
    voucherNo: '',
    investorName: '',
    innerInvestors: '',
    amount: '',
    openingBalance: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer',
    referenceNo: '',
    status: 'Verified',
    remarks: ''
  });

  const fetchCapitalData = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiEndpoint('/accounts/capital'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setRecords(data.data);
          localStorage.setItem('crm_capital_records', JSON.stringify(data.data));
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('API fetch for capital failed, using local storage fallback:', e);
    }

    const saved = localStorage.getItem('crm_capital_records');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (err) {
        setRecords(INITIAL_CAPITAL_RECORDS);
        localStorage.setItem('crm_capital_records', JSON.stringify(INITIAL_CAPITAL_RECORDS));
      }
    } else {
      setRecords(INITIAL_CAPITAL_RECORDS);
      localStorage.setItem('crm_capital_records', JSON.stringify(INITIAL_CAPITAL_RECORDS));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCapitalData();
  }, []);

  // Calculate Metrics
  const totalCapital = records.reduce((sum, r) => sum + (Number(r.amount || 0) + Number(r.openingBalance || 0)), 0);
  const avgCapital = records.length > 0 ? totalCapital / records.length : 0;

  const resetForm = () => {
    setFormData({
      voucherNo: `CAP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      investorName: '',
      innerInvestors: '',
      amount: '',
      openingBalance: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Bank Transfer',
      referenceNo: '',
      status: 'Verified',
      remarks: ''
    });
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const getRecordLogs = (rec) => {
    if (!rec) return [];
    if (Array.isArray(rec.paymentLogs) && rec.paymentLogs.length > 0) {
      return rec.paymentLogs;
    }
    const logs = [];
    if (Number(rec.openingBalance || 0) > 0) {
      logs.push({
        id: `ob_${rec._id}`,
        date: rec.date || new Date().toISOString().split('T')[0],
        type: 'Opening Balance',
        amount: Number(rec.openingBalance),
        paymentMethod: 'Opening Balance',
        referenceNo: 'OB-CAPITAL',
        remarks: 'Capital Opening Balance Allocation'
      });
    }
    if (Number(rec.amount || 0) > 0) {
      logs.push({
        id: `init_${rec._id}`,
        date: rec.date || new Date().toISOString().split('T')[0],
        type: 'Initial Capital',
        amount: Number(rec.amount),
        paymentMethod: rec.paymentMethod || 'Bank Transfer',
        referenceNo: rec.referenceNo || '-',
        remarks: rec.remarks || 'Initial Capital Contribution'
      });
    }
    return logs;
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    const capAmt = parseFloat(formData.amount) || 0;
    const obAmt = parseFloat(formData.openingBalance) || 0;
    if (!formData.investorName || (capAmt === 0 && obAmt === 0)) {
      if (showToast) showToast('Please fill in Contributor/Investor Name and at least one amount (Capital or Opening Balance).', 'warning');
      return;
    }

    const initialLogs = [];
    if (obAmt > 0) {
      initialLogs.push({
        id: `log_ob_${Date.now()}`,
        date: formData.date || new Date().toISOString().split('T')[0],
        type: 'Opening Balance',
        amount: obAmt,
        paymentMethod: 'Opening Balance',
        referenceNo: 'OB-CAPITAL',
        remarks: 'Capital Opening Balance Allocation'
      });
    }
    if (capAmt > 0) {
      initialLogs.push({
        id: `log_init_${Date.now()}`,
        date: formData.date || new Date().toISOString().split('T')[0],
        type: 'Initial Capital',
        amount: capAmt,
        paymentMethod: formData.paymentMethod,
        referenceNo: formData.referenceNo.trim(),
        remarks: formData.remarks.trim() || 'Initial Capital Contribution'
      });
    }

    const newRecord = {
      _id: `cap_${Date.now()}`,
      voucherNo: formData.voucherNo || `CAP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      investorName: formData.investorName.trim(),
      innerInvestors: formData.innerInvestors.trim(),
      amount: capAmt,
      openingBalance: obAmt,
      totalCapital: capAmt + obAmt,
      date: formData.date || new Date().toISOString().split('T')[0],
      paymentMethod: formData.paymentMethod,
      referenceNo: formData.referenceNo.trim(),
      status: formData.status || 'Verified',
      remarks: formData.remarks.trim(),
      paymentLogs: initialLogs,
      createdAt: new Date().toISOString()
    };

    try {
      await fetch(getApiEndpoint('/accounts/capital'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newRecord)
      });
    } catch (e) {
      console.warn('API create capital call failed, saved locally');
    }

    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    localStorage.setItem('crm_capital_records', JSON.stringify(updatedRecords));

    if (showToast) showToast('Capital transaction recorded successfully!', 'success');
    setIsAddModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    const id = recordToDelete._id;

    try {
      await fetch(getApiEndpoint(`/accounts/capital/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch (e) {
      console.warn('API delete capital call failed, removed locally');
    }

    const updated = records.filter(r => r._id !== id);
    setRecords(updated);
    localStorage.setItem('crm_capital_records', JSON.stringify(updated));
    if (showToast) showToast(`Capital entry for ${recordToDelete.investorName} removed.`, 'info');
    setIsDeleteModalOpen(false);
    setRecordToDelete(null);
  };

  const handleSaveTopUp = async (e) => {
    e.preventDefault();
    if (!topUpRecord) return;
    const added = parseFloat(topUpForm.additionalAmount) || 0;
    if (added <= 0) {
      if (showToast) showToast('Please enter a valid capital amount to add.', 'warning');
      return;
    }

    const updatedAmount = (Number(topUpRecord.amount) || 0) + added;
    const updatedTotal = updatedAmount + (Number(topUpRecord.openingBalance) || 0);

    const existingLogs = getRecordLogs(topUpRecord);
    const newLog = {
      id: `log_topup_${Date.now()}`,
      date: topUpForm.date || new Date().toISOString().split('T')[0],
      type: 'Capital Addition',
      amount: added,
      paymentMethod: topUpForm.paymentMethod || 'Bank Transfer',
      referenceNo: topUpForm.referenceNo ? topUpForm.referenceNo.trim() : '-',
      remarks: topUpForm.remarks ? topUpForm.remarks.trim() : 'Additional Capital Top-Up'
    };

    const updatedLogs = [newLog, ...existingLogs];

    const updatedRecord = {
      ...topUpRecord,
      amount: updatedAmount,
      totalCapital: updatedTotal,
      paymentMethod: topUpForm.paymentMethod || topUpRecord.paymentMethod,
      referenceNo: topUpForm.referenceNo ? topUpForm.referenceNo.trim() : topUpRecord.referenceNo,
      remarks: topUpForm.remarks 
        ? `${topUpRecord.remarks ? topUpRecord.remarks + ' | ' : ''}+₹${added.toLocaleString('en-IN')} (${topUpForm.remarks})` 
        : topUpRecord.remarks,
      paymentLogs: updatedLogs,
      updatedAt: new Date().toISOString()
    };

    try {
      await fetch(getApiEndpoint(`/accounts/capital/${topUpRecord._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedRecord)
      });
    } catch (e) {
      console.warn('API update capital call failed, updated locally');
    }

    const updatedRecords = records.map(r => r._id === topUpRecord._id ? updatedRecord : r);
    setRecords(updatedRecords);
    localStorage.setItem('crm_capital_records', JSON.stringify(updatedRecords));

    if (showToast) showToast(`Added ₹${added.toLocaleString('en-IN')} capital amount to ${topUpRecord.investorName}!`, 'success');
    setIsTopUpModalOpen(false);
  };

  // Filtered Records
  const filteredRecords = records.filter(rec => {
    const q = searchQuery.toLowerCase();
    return (
      (rec.investorName || '').toLowerCase().includes(q) ||
      (rec.voucherNo || '').toLowerCase().includes(q) ||
      (rec.referenceNo || '').toLowerCase().includes(q) ||
      (rec.remarks || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header & Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Capital */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Total Capital Balance</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              ₹{totalCapital.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] font-medium text-slate-400 mt-1">Total Introduced Capital</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Total Entries */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Capital Entries</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {records.length}
            </h3>
            <p className="text-[10px] font-medium text-slate-400 mt-1">Total Vouchers Recorded</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Average Entry */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Avg. Investment / Entry</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              ₹{Math.round(avgCapital).toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] font-medium text-slate-400 mt-1">Average per Capital Voucher</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Action Bar (Search, Add Record) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search investor, voucher, ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Add Entry Button */}
        <button
          onClick={handleOpenAddModal}
          className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Record Capital Entry</span>
        </button>
      </div>

      {/* Capital Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Capital Accounts Ledger
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            {filteredRecords.length} {filteredRecords.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            Loading capital records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            No capital records found. Click "Record Capital Entry" to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Contributor / Investor</th>
                  <th className="py-3 px-4 text-right">Capital Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Opening Balance (₹)</th>
                  <th className="py-3 px-4 text-right">Total Capital (₹)</th>
                  <th className="py-3 px-4">Mode / Ref</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredRecords.map((rec) => {
                  const capVal = Number(rec.amount || 0);
                  const obVal = Number(rec.openingBalance || 0);
                  const totalVal = capVal + obVal;
                  return (
                    <tr key={rec._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-slate-100">
                        {rec.voucherNo}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                        {rec.date}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {rec.investorName}
                        {rec.remarks && (
                          <p className="text-[10px] font-normal text-slate-400 truncate max-w-xs">{rec.remarks}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap text-slate-700 dark:text-slate-300">
                        ₹{capVal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap text-amber-600 dark:text-amber-400">
                        ₹{obVal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-black whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                        ₹{totalVal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                        <div className="font-semibold">{rec.paymentMethod}</div>
                        {rec.referenceNo && (
                          <div className="text-[9px] text-slate-400">{rec.referenceNo}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <CheckCircle2 size={10} className="text-emerald-500" />
                          {rec.status || 'Verified'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setTopUpRecord(rec);
                              setTopUpForm({
                                additionalAmount: '',
                                paymentMethod: 'Bank Transfer',
                                referenceNo: '',
                                date: new Date().toISOString().split('T')[0],
                                remarks: ''
                              });
                              setIsTopUpModalOpen(true);
                            }}
                            title="Add Additional Capital to Contributor"
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <PlusCircle size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRecord(rec);
                              setIsViewModalOpen(true);
                            }}
                            title="View Receipt Details"
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setRecordToDelete(rec);
                              setIsDeleteModalOpen(true);
                            }}
                            title="Delete Entry"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
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

      {/* Add / Record Entry Modal */}
      {isAddModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Coins size={16} />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Record Capital Transaction
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Voucher No</label>
                  <input
                    type="text"
                    required
                    value={formData.voucherNo}
                    onChange={(e) => setFormData({ ...formData, voucherNo: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Contributor / Main Investor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Founder Capital / Partner A"
                  value={formData.investorName}
                  onChange={(e) => setFormData({ ...formData, investorName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Inner Investors / Co-Contributors</label>
                <input
                  type="text"
                  placeholder="e.g. Partner A (60%), Partner B (40%)"
                  value={formData.innerInvestors}
                  onChange={(e) => setFormData({ ...formData, innerInvestors: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Capital Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Opening Balance Capital (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Total Capital Calculated Box */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">Total Capital (Capital Amount + Opening Balance)</p>
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    Capital: ₹{(Number(formData.amount) || 0).toLocaleString('en-IN')} + Opening Balance: ₹{(Number(formData.openingBalance) || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <span className="text-base font-black text-amber-700 dark:text-amber-300 font-mono">
                  ₹{((Number(formData.amount) || 0) + (Number(formData.openingBalance) || 0)).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="NEFT/RTGS">NEFT / RTGS</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Reference / UTR No.</label>
                  <input
                    type="text"
                    placeholder="e.g. TXN-1928371"
                    value={formData.referenceNo}
                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Remarks / Note</label>
                <textarea
                  rows="2"
                  placeholder="Additional description or capital allocation purpose..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* View Detail Modal */}
      {isViewModalOpen && selectedRecord && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsViewModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="text-amber-600" size={18} />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Capital Voucher Details
                </h3>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Voucher No</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedRecord.voucherNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRecord.date}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Contributor</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRecord.investorName}</span>
              </div>
              {selectedRecord.innerInvestors && (
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Inner Investors</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400 text-right">{selectedRecord.innerInvestors}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Capital Amount</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  ₹{Number(selectedRecord.amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Opening Balance Capital</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  ₹{Number(selectedRecord.openingBalance || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2 bg-amber-500/10 p-2 rounded-xl">
                <span className="text-amber-800 dark:text-amber-300 font-black uppercase text-[10px]">Total Capital</span>
                <span className="font-black text-sm text-amber-700 dark:text-amber-300">
                  ₹{(Number(selectedRecord.amount || 0) + Number(selectedRecord.openingBalance || 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Payment Mode</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRecord.paymentMethod}</span>
              </div>
              {selectedRecord.referenceNo && (
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Reference UTR</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRecord.referenceNo}</span>
                </div>
              )}
              {selectedRecord.remarks && (
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block mb-0.5">Remarks</span>
                  <p className="text-slate-700 dark:text-slate-300 italic">{selectedRecord.remarks}</p>
                </div>
              )}

              {/* Payment & Contribution History Logs */}
              <div className="pt-2 space-y-2 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt size={13} className="text-amber-600" />
                    <span>Payment & Contribution Logs ({getRecordLogs(selectedRecord).length})</span>
                  </h4>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {getRecordLogs(selectedRecord).map((log, idx) => (
                    <div 
                      key={log.id || idx} 
                      className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            log.type === 'Opening Balance'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : log.type === 'Capital Addition'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                          }`}>
                            {log.type || 'Contribution'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{log.date}</span>
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold truncate">
                          {log.paymentMethod} {log.referenceNo && log.referenceNo !== '-' ? `• Ref: ${log.referenceNo}` : ''}
                        </div>

                        {log.remarks && (
                          <p className="text-[10px] text-slate-400 italic truncate max-w-xs">{log.remarks}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                          +₹{Number(log.amount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 text-white hover:bg-slate-900 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Top-Up Additional Capital Modal */}
      {isTopUpModalOpen && topUpRecord && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTopUpModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <PlusCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Add Capital Amount
                  </h3>
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Contributor: {topUpRecord.investorName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTopUpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Current Capital Amount:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">₹{Number(topUpRecord.amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Opening Balance Capital:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">₹{Number(topUpRecord.openingBalance || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-extrabold text-slate-900 dark:text-white pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span>Current Total Capital:</span>
                <span className="text-emerald-600 dark:text-emerald-400">₹{(Number(topUpRecord.amount || 0) + Number(topUpRecord.openingBalance || 0)).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handleSaveTopUp} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Additional Capital Amount to Add (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  autoFocus
                  placeholder="Enter amount to add e.g. 50000"
                  value={topUpForm.additionalAmount}
                  onChange={(e) => setTopUpForm({ ...topUpForm, additionalAmount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={topUpForm.paymentMethod}
                    onChange={(e) => setTopUpForm({ ...topUpForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="NEFT/RTGS">NEFT / RTGS</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Reference / UTR No.</label>
                  <input
                    type="text"
                    placeholder="e.g. TXN-991823"
                    value={topUpForm.referenceNo}
                    onChange={(e) => setTopUpForm({ ...topUpForm, referenceNo: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="Reason for top-up or allocation..."
                  value={topUpForm.remarks}
                  onChange={(e) => setTopUpForm({ ...topUpForm, remarks: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* New Total Preview */}
              {Number(topUpForm.additionalAmount) > 0 && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                  <span className="font-extrabold text-emerald-800 dark:text-emerald-300">New Total Capital Balance:</span>
                  <span className="font-black text-sm text-emerald-700 dark:text-emerald-300 font-mono">
                    ₹{((Number(topUpRecord.amount || 0) + Number(topUpRecord.openingBalance || 0)) + Number(topUpForm.additionalAmount || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <PlusCircle size={14} />
                  <span>Add Capital</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Capital Record Confirmation Modal */}
      {isDeleteModalOpen && recordToDelete && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDeleteModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Delete Capital Account
                  </h3>
                  <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                    Confirm Record Removal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 p-3.5 rounded-xl space-y-2 text-xs">
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                Are you sure you want to delete this capital record? This action will update your equity ledger and Profit & Loss reports.
              </p>
              
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-rose-100 dark:border-slate-800 space-y-1.5 font-sans text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Voucher No</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{recordToDelete.voucherNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Contributor</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{recordToDelete.investorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Total Capital</span>
                  <span className="font-black text-rose-600 dark:text-rose-400">
                    ₹{(Number(recordToDelete.amount || 0) + Number(recordToDelete.openingBalance || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Delete Record</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CapitalTab;
