import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2pdf from 'html2pdf.js';
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
  TrendingUp,
  Download,
  Pencil
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

  // Modals & PDF state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const capitalVoucherRef = useRef(null);

  const handleDownloadPDF = async () => {
    if (!capitalVoucherRef.current) return;
    setIsDownloadingPDF(true);
    try {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Capital_Voucher_${selectedRecord?.voucherNo || 'Details'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      const element = capitalVoucherRef.current;
      const html2pdfFunc = typeof html2pdf === 'function' ? html2pdf : (html2pdf.default || window.html2pdf);
      if (typeof html2pdfFunc === 'function') {
        await html2pdfFunc().set(opt).from(element).save();
      } else {
        window.print();
      }
      if (showToast) showToast('Capital Voucher PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      window.print();
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Delete Capital Record Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Edit Capital Record Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({
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
  const [editSubInvestors, setEditSubInvestors] = useState([]);

  // Edit Payment Log Modal State
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editingLogRecord, setEditingLogRecord] = useState(null);
  const [editLogForm, setEditLogForm] = useState({
    type: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer',
    referenceNo: '',
    remarks: ''
  });

  const handleOpenEditModal = (rec) => {
    setEditingRecord(rec);
    setEditFormData({
      voucherNo: rec.voucherNo || '',
      investorName: rec.investorName || '',
      innerInvestors: rec.innerInvestors || '',
      amount: rec.amount || 0,
      openingBalance: rec.openingBalance || 0,
      date: rec.date || new Date().toISOString().split('T')[0],
      paymentMethod: rec.paymentMethod || 'Bank Transfer',
      referenceNo: rec.referenceNo || '',
      status: rec.status || 'Verified',
      remarks: rec.remarks || ''
    });
    const subs = getSubInvestorsList(rec);
    setEditSubInvestors(subs.length > 0 ? subs : [{ id: `esub_1`, name: '', amount: '', openingBalance: '', date: rec.date || new Date().toISOString().split('T')[0] }]);
    setIsEditModalOpen(true);
  };

  const handleAddEditSubInvestor = () => {
    setEditSubInvestors(prev => [
      ...prev,
      { id: `esub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: '', amount: '', openingBalance: '', date: new Date().toISOString().split('T')[0] }
    ]);
  };

  const handleRemoveEditSubInvestor = (id) => {
    const updated = editSubInvestors.filter(s => s.id !== id);
    const nextList = updated.length > 0 ? updated : [{ id: `esub_${Date.now()}`, name: '', amount: '', openingBalance: '', date: new Date().toISOString().split('T')[0] }];
    updateEditSubInvestorsCalculations(nextList);
  };

  const updateEditSubInvestorsCalculations = (newSubs) => {
    setEditSubInvestors(newSubs);
    const validSubs = newSubs.filter(s => (s.name && s.name.trim() !== '') || Number(s.amount) > 0 || Number(s.openingBalance) > 0);
    if (validSubs.length > 0) {
      const totalSubAmt = validSubs.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const totalSubOB = validSubs.reduce((sum, s) => sum + (Number(s.openingBalance) || 0), 0);

      const concatNames = validSubs
        .map(s => {
          const n = (s.name || '').trim() || 'Sub-Investor';
          const cap = Number(s.amount || 0);
          const ob = Number(s.openingBalance || 0);
          const dt = s.date || '';
          const parts = [];
          if (cap > 0) parts.push(`Cap: ₹${cap.toLocaleString('en-IN')}`);
          if (ob > 0) parts.push(`OB: ₹${ob.toLocaleString('en-IN')}`);
          if (dt) parts.push(`Date: ${dt}`);
          return parts.length > 0 ? `${n} (${parts.join(' | ')})` : n;
        })
        .join(', ');

      setEditFormData(prev => ({
        ...prev,
        amount: totalSubAmt > 0 ? totalSubAmt : prev.amount,
        openingBalance: totalSubOB > 0 ? totalSubOB : prev.openingBalance,
        innerInvestors: concatNames
      }));
    }
  };

  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    const id = editingRecord._id;

    const validSubs = editSubInvestors.filter(s => (s.name && s.name.trim() !== '') || Number(s.amount) > 0 || Number(s.openingBalance) > 0);
    let capAmt = parseFloat(editFormData.amount) || 0;
    let obAmt = parseFloat(editFormData.openingBalance) || 0;

    if (validSubs.length > 0) {
      const sumSubCap = validSubs.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      const sumSubOB = validSubs.reduce((acc, s) => acc + (Number(s.openingBalance) || 0), 0);
      if (sumSubCap > 0) capAmt = sumSubCap;
      if (sumSubOB > 0) obAmt = sumSubOB;
    }

    if (!editFormData.investorName || (capAmt === 0 && obAmt === 0)) {
      if (showToast) showToast('Please fill in Contributor/Investor Name and at least one amount.', 'warning');
      return;
    }

    const updatedData = {
      ...editingRecord,
      voucherNo: editFormData.voucherNo || editingRecord.voucherNo,
      investorName: editFormData.investorName.trim(),
      innerInvestors: editFormData.innerInvestors.trim(),
      subInvestors: validSubs,
      amount: capAmt,
      openingBalance: obAmt,
      totalCapital: capAmt + obAmt,
      date: editFormData.date,
      paymentMethod: editFormData.paymentMethod,
      referenceNo: editFormData.referenceNo.trim(),
      status: editFormData.status,
      remarks: editFormData.remarks.trim()
    };

    try {
      await fetch(getApiEndpoint(`/accounts/capital/${id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedData)
      });
    } catch (e) {
      console.warn('API update capital call failed, saved locally');
    }

    const nextRecords = records.map(r => r._id === id ? updatedData : r);
    setRecords(nextRecords);
    localStorage.setItem('crm_capital_records', JSON.stringify(nextRecords));

    if (selectedRecord && selectedRecord._id === id) {
      setSelectedRecord(updatedData);
    }

    if (showToast) showToast(`Capital Voucher ${updatedData.voucherNo} updated successfully!`, 'success');
    setIsEditModalOpen(false);
    setEditingRecord(null);
  };

  const handleOpenEditLogModal = (log, rec) => {
    setEditingLog(log);
    setEditingLogRecord(rec);
    setEditLogForm({
      type: log.type || 'Contribution',
      amount: log.amount || 0,
      date: log.date || rec.date || new Date().toISOString().split('T')[0],
      paymentMethod: log.paymentMethod || 'Bank Transfer',
      referenceNo: log.referenceNo || '',
      remarks: log.remarks || ''
    });
    setIsEditLogModalOpen(true);
  };

  const handleUpdateLog = async (e) => {
    e.preventDefault();
    if (!editingLog || !editingLogRecord) return;
    const targetRec = editingLogRecord;
    const currentLogs = getRecordLogs(targetRec);

    const updatedLogs = currentLogs.map(l => {
      if ((l.id && l.id === editingLog.id) || (l._id && l._id === editingLog._id)) {
        return {
          ...l,
          type: editLogForm.type,
          amount: parseFloat(editLogForm.amount) || 0,
          date: editLogForm.date,
          paymentMethod: editLogForm.paymentMethod,
          referenceNo: editLogForm.referenceNo.trim(),
          remarks: editLogForm.remarks.trim()
        };
      }
      return l;
    });

    let newCapAmt = targetRec.amount || 0;
    let newOBAmt = targetRec.openingBalance || 0;

    const initLog = updatedLogs.find(l => String(l.type || '').toLowerCase().includes('initial') || String(l.type || '').toLowerCase().includes('addition'));
    const obLog = updatedLogs.find(l => String(l.type || '').toLowerCase().includes('opening'));

    if (initLog) newCapAmt = Number(initLog.amount || 0);
    if (obLog) newOBAmt = Number(obLog.amount || 0);

    const updatedRec = {
      ...targetRec,
      amount: newCapAmt,
      openingBalance: newOBAmt,
      totalCapital: newCapAmt + newOBAmt,
      paymentLogs: updatedLogs
    };

    try {
      await fetch(getApiEndpoint(`/accounts/capital/${targetRec._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedRec)
      });
    } catch (e) {
      console.warn('API update capital log call failed, saved locally');
    }

    const nextRecords = records.map(r => r._id === targetRec._id ? updatedRec : r);
    setRecords(nextRecords);
    localStorage.setItem('crm_capital_records', JSON.stringify(nextRecords));

    if (selectedRecord && selectedRecord._id === targetRec._id) {
      setSelectedRecord(updatedRec);
    }

    if (showToast) showToast('Payment & contribution log entry updated successfully!', 'success');
    setIsEditLogModalOpen(false);
    setEditingLog(null);
    setEditingLogRecord(null);
  };

  // Top-Up Additional Capital State
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpRecord, setTopUpRecord] = useState(null);
  const [topUpSubInvestors, setTopUpSubInvestors] = useState([]);
  const [topUpForm, setTopUpForm] = useState({
    additionalAmount: '',
    paymentMethod: 'Bank Transfer',
    referenceNo: '',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const handleOpenTopUp = (rec) => {
    setTopUpRecord(rec);
    const existingSubs = Array.isArray(rec.subInvestors) && rec.subInvestors.length > 0
      ? rec.subInvestors.map(s => ({ ...s, addAmount: '' }))
      : [{ id: `tsub_${Date.now()}`, name: '', addAmount: '' }];
    setTopUpSubInvestors(existingSubs);
    setTopUpForm({
      additionalAmount: '',
      paymentMethod: 'Bank Transfer',
      referenceNo: '',
      date: new Date().toISOString().split('T')[0],
      remarks: ''
    });
    setIsTopUpModalOpen(true);
  };

  const handleAddTopUpSubInvestor = () => {
    setTopUpSubInvestors(prev => [
      ...prev,
      { id: `tsub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: '', addAmount: '' }
    ]);
  };

  const handleRemoveTopUpSubInvestor = (id) => {
    const updated = topUpSubInvestors.filter(s => s.id !== id);
    const nextList = updated.length > 0 ? updated : [{ id: `tsub_${Date.now()}`, name: '', addAmount: '' }];
    updateTopUpCalculations(nextList);
  };

  const updateTopUpCalculations = (newSubs) => {
    setTopUpSubInvestors(newSubs);
    const sumAdd = newSubs.reduce((sum, s) => sum + (Number(s.addAmount) || 0), 0);
    if (sumAdd > 0) {
      setTopUpForm(prev => ({ ...prev, additionalAmount: sumAdd }));
    }
  };

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

  // Dynamic Sub-Investors State
  const [subInvestors, setSubInvestors] = useState([
    { id: 'sub_1', name: '', amount: '', openingBalance: '', date: new Date().toISOString().split('T')[0] }
  ]);

  const handleAddSubInvestor = () => {
    setSubInvestors(prev => [
      ...prev,
      { id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: '', amount: '', openingBalance: '', date: new Date().toISOString().split('T')[0] }
    ]);
  };

  const handleRemoveSubInvestor = (id) => {
    const updated = subInvestors.filter(s => s.id !== id);
    const nextList = updated.length > 0 ? updated : [{ id: `sub_${Date.now()}`, name: '', amount: '', openingBalance: '', date: new Date().toISOString().split('T')[0] }];
    updateSubInvestorsCalculations(nextList);
  };

  const updateSubInvestorsCalculations = (newSubs) => {
    setSubInvestors(newSubs);
    const validSubs = newSubs.filter(s => s.name.trim() !== '' || Number(s.amount) > 0 || Number(s.openingBalance) > 0);
    if (validSubs.length > 0) {
      const totalSubAmt = validSubs.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const totalSubOB = validSubs.reduce((sum, s) => sum + (Number(s.openingBalance) || 0), 0);

      const concatNames = validSubs
        .map(s => {
          const n = s.name.trim() || 'Sub-Investor';
          const cap = Number(s.amount || 0);
          const ob = Number(s.openingBalance || 0);
          const dt = s.date || '';
          const parts = [];
          if (cap > 0) parts.push(`Cap: ₹${cap.toLocaleString('en-IN')}`);
          if (ob > 0) parts.push(`OB: ₹${ob.toLocaleString('en-IN')}`);
          if (dt) parts.push(`Date: ${dt}`);
          return parts.length > 0 ? `${n} (${parts.join(' | ')})` : n;
        })
        .join(', ');

      setFormData(prev => ({
        ...prev,
        amount: totalSubAmt > 0 ? totalSubAmt : prev.amount,
        openingBalance: totalSubOB > 0 ? totalSubOB : prev.openingBalance,
        innerInvestors: concatNames
      }));
    }
  };

  const getSubInvestorsList = (rec) => {
    if (!rec) return [];
    if (Array.isArray(rec.subInvestors) && rec.subInvestors.length > 0) {
      return rec.subInvestors.map((s, idx) => ({
        id: s.id || `sub_${idx}`,
        name: s.name || `Sub-Investor #${idx + 1}`,
        amount: Number(s.amount || 0),
        openingBalance: Number(s.openingBalance || 0),
        date: s.date || rec.date || '',
        total: Number(s.amount || 0) + Number(s.openingBalance || 0)
      }));
    }
    if (rec.innerInvestors && typeof rec.innerInvestors === 'string') {
      const parts = rec.innerInvestors.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        return parts.map((p, idx) => {
          const match = p.match(/^(.+?)(?:\s*\((?:Cap:\s*₹?([\d,.]+))?(?:\s*\|\s*OB:\s*₹?([\d,.]+))?(?:\s*\|\s*Date:\s*([\d-]+))?\))?$/i);
          const name = match ? match[1].trim() : p;
          const cap = match && match[2] ? parseFloat(match[2].replace(/,/g, '')) : 0;
          const ob = match && match[3] ? parseFloat(match[3].replace(/,/g, '')) : 0;
          const dt = match && match[4] ? match[4].trim() : '';
          return {
            id: `parsed_${idx}`,
            name,
            amount: !isNaN(cap) && cap > 0 ? cap : Math.round(Number(rec.amount || 0) / parts.length),
            openingBalance: !isNaN(ob) && ob > 0 ? ob : Math.round(Number(rec.openingBalance || 0) / parts.length),
            date: dt || rec.date || '',
            total: (!isNaN(cap) && cap > 0 ? cap : Math.round(Number(rec.amount || 0) / parts.length)) + (!isNaN(ob) && ob > 0 ? ob : Math.round(Number(rec.openingBalance || 0) / parts.length))
          };
        });
      }
    }
    return [];
  };

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
    setSubInvestors([
      { id: 'sub_1', name: '', amount: '', openingBalance: '' }
    ]);
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
    const validSubInvestors = subInvestors.filter(s => s.name.trim() !== '' || Number(s.amount) > 0 || Number(s.openingBalance) > 0);
    let capAmt = parseFloat(formData.amount) || 0;
    let obAmt = parseFloat(formData.openingBalance) || 0;

    if (validSubInvestors.length > 0) {
      const sumSubCap = validSubInvestors.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      const sumSubOB = validSubInvestors.reduce((acc, s) => acc + (Number(s.openingBalance) || 0), 0);
      if (sumSubCap > 0) capAmt = sumSubCap;
      if (sumSubOB > 0) obAmt = sumSubOB;
    }

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
      subInvestors: validSubInvestors,
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

    // Process top-up for sub-investors
    let updatedSubInvestors = Array.isArray(topUpRecord.subInvestors) ? [...topUpRecord.subInvestors] : [];
    const subAllocationsMap = {};
    const subDatesMap = {};

    // Initialize all existing sub-investors to 0 in subAllocationsMap
    updatedSubInvestors.forEach(s => {
      if (s.id) {
        subAllocationsMap[s.id] = 0;
        subDatesMap[s.id] = s.date || topUpForm.date || '';
      }
    });

    if (topUpSubInvestors.length > 0) {
      topUpSubInvestors.forEach(tsub => {
        const amtToAdd = Number(tsub.addAmount || 0);
        const subGivenDate = tsub.date || topUpForm.date || new Date().toISOString().split('T')[0];
        if (tsub.name.trim() || amtToAdd > 0) {
          if (tsub.id) {
            subAllocationsMap[tsub.id] = amtToAdd;
            subDatesMap[tsub.id] = subGivenDate;
          }
          const matchIdx = updatedSubInvestors.findIndex(s => s.id === tsub.id || (s.name && s.name.trim().toLowerCase() === tsub.name.trim().toLowerCase()));
          if (matchIdx >= 0) {
            updatedSubInvestors[matchIdx] = {
              ...updatedSubInvestors[matchIdx],
              amount: (Number(updatedSubInvestors[matchIdx].amount) || 0) + amtToAdd,
              date: subGivenDate || updatedSubInvestors[matchIdx].date
            };
          } else {
            const newSubId = tsub.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            subAllocationsMap[newSubId] = amtToAdd;
            subDatesMap[newSubId] = subGivenDate;
            updatedSubInvestors.push({
              id: newSubId,
              name: tsub.name.trim() || 'Sub-Investor',
              amount: amtToAdd,
              date: subGivenDate
            });
          }
        }
      });
    }

    const validSubInvestors = updatedSubInvestors.filter(s => s.name.trim() !== '' || Number(s.amount) > 0);
    const updatedConcatNames = validSubInvestors
      .map(s => {
        const n = s.name.trim() || 'Sub-Investor';
        const a = Number(s.amount || 0);
        return a > 0 ? `${n} (₹${a.toLocaleString('en-IN')})` : n;
      })
      .join(', ');

    const updatedAmount = (Number(topUpRecord.amount) || 0) + added;
    const updatedTotal = updatedAmount + (Number(topUpRecord.openingBalance) || 0);

    const existingLogs = getRecordLogs(topUpRecord);
    const newLog = {
      id: `log_topup_${Date.now()}`,
      date: topUpForm.date || new Date().toISOString().split('T')[0],
      type: 'Capital Addition',
      amount: added,
      subAllocations: subAllocationsMap,
      subDates: subDatesMap,
      paymentMethod: topUpForm.paymentMethod || 'Bank Transfer',
      referenceNo: topUpForm.referenceNo ? topUpForm.referenceNo.trim() : '-',
      remarks: topUpForm.remarks ? topUpForm.remarks.trim() : 'Additional Capital Top-Up'
    };

    const updatedLogs = [newLog, ...existingLogs];

    const updatedRecord = {
      ...topUpRecord,
      amount: updatedAmount,
      totalCapital: updatedTotal,
      innerInvestors: updatedConcatNames || topUpRecord.innerInvestors,
      subInvestors: validSubInvestors.length > 0 ? validSubInvestors : topUpRecord.subInvestors,
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
    if (selectedRecord && (selectedRecord._id === topUpRecord._id || selectedRecord.voucherNo === topUpRecord.voucherNo)) {
      setSelectedRecord(updatedRecord);
    }
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
                        <div>{rec.investorName}</div>
                        {rec.innerInvestors && (
                          <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mt-0.5 max-w-xs truncate" title={rec.innerInvestors}>
                            <span className="font-extrabold uppercase text-[9px] text-slate-400 mr-1">Subs:</span>
                            {rec.innerInvestors}
                          </div>
                        )}
                        {rec.remarks && (
                          <p className="text-[10px] font-normal text-slate-400 truncate max-w-xs mt-0.5">{rec.remarks}</p>
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
                            onClick={() => handleOpenTopUp(rec)}
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
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

              {/* Dynamic Sub-Investors Section */}
              <div className="border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-3.5 space-y-3 bg-amber-500/5 dark:bg-amber-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                      Sub-Investors under {formData.investorName || 'Main Investor'}
                    </label>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Add sub-investors. Total capital & concatenated list calculate automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSubInvestor}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <PlusCircle size={12} /> Add Sub Investor
                  </button>
                </div>

                <div className="space-y-2">
                  {subInvestors.map((sub, idx) => (
                    <div key={sub.id} className="grid grid-cols-12 gap-1.5 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs items-center">
                      <span className="col-span-1 text-[10px] font-extrabold text-slate-400 text-center">#{idx + 1}</span>
                      <input
                        type="text"
                        placeholder="Sub-Investor Name"
                        value={sub.name}
                        onChange={(e) => {
                          const updated = subInvestors.map(s => s.id === sub.id ? { ...s, name: e.target.value } : s);
                          updateSubInvestorsCalculations(updated);
                        }}
                        className="col-span-3 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <input
                        type="date"
                        value={sub.date || ''}
                        onChange={(e) => {
                          const updated = subInvestors.map(s => s.id === sub.id ? { ...s, date: e.target.value } : s);
                          updateSubInvestorsCalculations(updated);
                        }}
                        className="col-span-3 px-1.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Capital (₹)"
                        value={sub.amount}
                        onChange={(e) => {
                          const updated = subInvestors.map(s => s.id === sub.id ? { ...s, amount: e.target.value } : s);
                          updateSubInvestorsCalculations(updated);
                        }}
                        className="col-span-2 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Opening Bal (₹)"
                        value={sub.openingBalance}
                        onChange={(e) => {
                          const updated = subInvestors.map(s => s.id === sub.id ? { ...s, openingBalance: e.target.value } : s);
                          updateSubInvestorsCalculations(updated);
                        }}
                        className="col-span-2 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-amber-600 dark:text-amber-400 font-mono text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      {subInvestors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSubInvestor(sub.id)}
                          className="col-span-1 p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer flex justify-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Concatenated Inner Investors Summary</label>
                <input
                  type="text"
                  placeholder="Auto-generated from sub-investors above or enter manually"
                  value={formData.innerInvestors}
                  onChange={(e) => setFormData({ ...formData, innerInvestors: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="text-amber-600" size={18} />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Capital Voucher Details
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(selectedRecord)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  title="Edit Voucher Details"
                >
                  <Pencil size={13} />
                  <span>Edit Voucher</span>
                </button>
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div ref={capitalVoucherRef} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-3 text-xs">
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
              {/* EXCEL MATRIX TABLE: SUB INVESTORS AS TH & LOGS AS ROWS */}
              {(() => {
                const subsList = getSubInvestorsList(selectedRecord);
                const logsList = getRecordLogs(selectedRecord);
                if (subsList.length === 0 && logsList.length === 0) return null;

                const subTotals = subsList.map(sub => (Number(sub.amount || 0) + Number(sub.openingBalance || 0)));
                const grandTotal = subTotals.reduce((a, b) => a + b, 0) || (Number(selectedRecord.amount || 0) + Number(selectedRecord.openingBalance || 0));

                return (
                  <div className="my-3 border-2 border-emerald-600/40 dark:border-emerald-500/40 rounded-2xl overflow-hidden shadow-md">
                    {/* Excel Sheet Header Bar */}
                    <div className="bg-emerald-800 dark:bg-emerald-950 text-white py-2 px-3 font-black text-[11px] uppercase tracking-wider flex justify-between items-center border-b border-emerald-900">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span>SUB INVESTORS LEDGER MATRIX</span>
                      </div>
                      <span className="text-[10px] bg-emerald-950/80 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded border border-emerald-700">
                        {subsList.length} Sub-Investors • {logsList.length} Logs
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse font-sans border border-slate-300 dark:border-slate-700">
                        <thead>
                          {/* SUB INVESTORS SET AS TH HEADINGS */}
                          <tr className="bg-emerald-900 text-white text-[10px] uppercase font-black tracking-wider border-b border-emerald-950">
                            <th className="py-2.5 px-3 border-r border-emerald-800 min-w-[140px]">
                              Transaction / Log Entry
                            </th>
                            {subsList.map((sub, i) => (
                              <th key={sub.id || i} className="py-2.5 px-3 border-r border-emerald-800 text-center min-w-[130px]">
                                <div className="text-emerald-200 font-black text-xs">{sub.name}</div>
                                <div className="text-[9px] font-mono text-amber-300 font-semibold mt-0.5">
                                  {sub.date ? `Given: ${sub.date}` : sub.openingBalance > 0 ? `OB: ₹${Number(sub.openingBalance).toLocaleString('en-IN')}` : `Sub #${i + 1}`}
                                </div>
                              </th>
                            ))}
                            <th className="py-2.5 px-3 text-right bg-emerald-950 min-w-[120px]">
                              Log Total (₹)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                          {/* EACH LOG ENTRY AS A ROW */}
                          {logsList.map((log, lIdx) => {
                            const logAmt = Number(log.amount || 0);
                            const isOBLog = String(log.type || '').toLowerCase().includes('opening');
                            const isInitLog = String(log.type || '').toLowerCase().includes('initial');
                            return (
                              <tr key={log.id || lIdx} className="hover:bg-amber-50/50 dark:hover:bg-slate-800/60 transition">
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isOBLog ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                    {log.type || 'Capital Entry'}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{log.date || selectedRecord.date} • {log.paymentMethod || 'Bank'}</div>
                                  {log.remarks && (
                                    <div className="text-[9px] text-slate-400 italic truncate max-w-[160px]">{log.remarks}</div>
                                  )}
                                </td>

                                {subsList.map((sub, sIdx) => {
                                  let allocatedLogAmt = 0;
                                  if (isOBLog) {
                                    allocatedLogAmt = Number(sub.openingBalance || 0);
                                  } else if (log.subAllocations && log.subAllocations[sub.id] !== undefined) {
                                    allocatedLogAmt = Number(log.subAllocations[sub.id] || 0);
                                  } else if (isInitLog || logsList.filter(l => !String(l.type || '').toLowerCase().includes('opening')).length === 1) {
                                    const additionLogs = logsList.filter(l => String(l.type || '').toLowerCase().includes('addition'));
                                    let subTopUps = 0;
                                    additionLogs.forEach(al => {
                                      if (al.subAllocations && al.subAllocations[sub.id] !== undefined) {
                                        subTopUps += Number(al.subAllocations[sub.id] || 0);
                                      }
                                    });
                                    allocatedLogAmt = Math.max(0, Number(sub.amount || 0) - subTopUps);
                                  } else {
                                    allocatedLogAmt = 0;
                                  }

                                  const cellDate = (log.subDates && log.subDates[sub.id])
                                    ? log.subDates[sub.id]
                                    : (isOBLog 
                                        ? (sub.date || log.date || selectedRecord.date)
                                        : (log.date || sub.date || selectedRecord.date));

                                  return (
                                    <td key={sub.id || sIdx} className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-slate-700 dark:text-slate-300 font-mono">
                                      {allocatedLogAmt > 0 ? (
                                        <div>
                                          <div className={isOBLog ? "text-amber-600 dark:text-amber-400 font-black text-xs" : "text-emerald-700 dark:text-emerald-400 font-black text-xs"}>
                                            ₹{allocatedLogAmt.toLocaleString('en-IN')}
                                          </div>
                                          <div className="text-[9px] font-sans font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                                            {cellDate}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-300 dark:text-slate-600 font-normal">-</span>
                                      )}
                                    </td>
                                  );
                                })}

                                <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white font-mono bg-slate-50/80 dark:bg-slate-800/40">
                                  ₹{logAmt.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>

                        {/* EXCEL BOTTOM SUMMARY ROW FOR TOTAL AMOUNT */}
                        <tfoot>
                          <tr className="bg-emerald-100 dark:bg-emerald-950/80 border-t-2 border-emerald-600 dark:border-emerald-500 font-black text-slate-900 dark:text-white">
                            <td className="py-3 px-3 border-r border-emerald-300 dark:border-emerald-800 font-black text-amber-900 dark:text-amber-300 uppercase text-[11px] tracking-wider">
                              TOTAL CAPITAL AMOUNT
                            </td>
                            {subsList.map((sub, sIdx) => {
                              const subTot = Number(sub.amount || 0) + Number(sub.openingBalance || 0);
                              return (
                                <td key={sub.id || sIdx} className="py-3 px-3 border-r border-emerald-300 dark:border-emerald-800 text-center text-emerald-800 dark:text-emerald-300 text-xs font-mono font-black">
                                  <div>₹{subTot.toLocaleString('en-IN')}</div>
                                  <div className="text-[9px] text-slate-500 font-normal">Cap + OB</div>
                                </td>
                              );
                            })}
                            <td className="py-3 px-3 text-right text-emerald-900 dark:text-emerald-200 text-sm font-mono font-black bg-emerald-200/60 dark:bg-emerald-900">
                              ₹{grandTotal.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}
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

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                          +₹{Number(log.amount || 0).toLocaleString('en-IN')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditLogModal(log, selectedRecord)}
                          title="Edit Log Entry"
                          className="p-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 border border-amber-200 dark:border-amber-800 transition cursor-pointer"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloadingPDF}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-sm disabled:opacity-50"
              >
                <Download size={14} />
                <span>{isDownloadingPDF ? 'Downloading PDF...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
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
              {/* Dynamic Sub-Investors Additional Allocation */}
              <div className="border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-3 space-y-2 bg-emerald-500/5 dark:bg-emerald-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                      Sub-Investors Additional Allocation
                    </label>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Allocate additional capital per sub-investor. Total top-up auto-sums below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTopUpSubInvestor}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <PlusCircle size={11} /> Add Sub
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {topUpSubInvestors.map((tsub, idx) => (
                    <div key={tsub.id} className="grid grid-cols-12 gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs items-center">
                      <span className="col-span-1 text-[10px] font-extrabold text-slate-400 text-center">#{idx + 1}</span>
                      <input
                        type="text"
                        placeholder="Sub-Investor Name"
                        value={tsub.name}
                        onChange={(e) => {
                          const updated = topUpSubInvestors.map(s => s.id === tsub.id ? { ...s, name: e.target.value } : s);
                          updateTopUpCalculations(updated);
                        }}
                        className="col-span-4 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                      <input
                        type="date"
                        value={tsub.date || topUpForm.date || ''}
                        onChange={(e) => {
                          const updated = topUpSubInvestors.map(s => s.id === tsub.id ? { ...s, date: e.target.value } : s);
                          updateTopUpCalculations(updated);
                        }}
                        className="col-span-3 px-1 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="+Capital (₹)"
                        value={tsub.addAmount}
                        onChange={(e) => {
                          const updated = topUpSubInvestors.map(s => s.id === tsub.id ? { ...s, addAmount: e.target.value } : s);
                          updateTopUpCalculations(updated);
                        }}
                        className="col-span-3 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono text-right focus:outline-none"
                      />
                      {topUpSubInvestors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTopUpSubInvestor(tsub.id)}
                          className="col-span-1 p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer flex justify-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Total Additional Capital Amount to Add (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="Enter amount or sum above"
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

      {/* Edit Capital Voucher Modal */}
      {isEditModalOpen && editingRecord && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Edit Capital Voucher Details
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Update voucher parameters and sub-investor allocations</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateRecord} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Voucher Number *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.voucherNo}
                    onChange={(e) => setEditFormData({ ...editFormData, voucherNo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Contributor / Main Investor Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.investorName}
                  onChange={(e) => setEditFormData({ ...editFormData, investorName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-2 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">
                    Sub-Investors Allocation Matrix
                  </label>
                  <button
                    type="button"
                    onClick={handleAddEditSubInvestor}
                    className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={13} /> Add Sub-Investor
                  </button>
                </div>

                {editSubInvestors.map((sub, sIdx) => (
                  <div key={sub.id || sIdx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder="Sub-Investor Name"
                      value={sub.name || ''}
                      onChange={(e) => {
                        const updated = [...editSubInvestors];
                        updated[sIdx].name = e.target.value;
                        updateEditSubInvestorsCalculations(updated);
                      }}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                    />
                    <input
                      type="number"
                      placeholder="Capital (₹)"
                      value={sub.amount || ''}
                      onChange={(e) => {
                        const updated = [...editSubInvestors];
                        updated[sIdx].amount = e.target.value;
                        updateEditSubInvestorsCalculations(updated);
                      }}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                    <input
                      type="number"
                      placeholder="Opening Bal (₹)"
                      value={sub.openingBalance || ''}
                      onChange={(e) => {
                        const updated = [...editSubInvestors];
                        updated[sIdx].openingBalance = e.target.value;
                        updateEditSubInvestorsCalculations(updated);
                      }}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={sub.date || editFormData.date}
                        onChange={(e) => {
                          const updated = [...editSubInvestors];
                          updated[sIdx].date = e.target.value;
                          updateEditSubInvestorsCalculations(updated);
                        }}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                      {editSubInvestors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditSubInvestor(sub.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Capital Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    value={editFormData.openingBalance}
                    onChange={(e) => setEditFormData({ ...editFormData, openingBalance: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={editFormData.paymentMethod}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option>Bank Transfer</option>
                    <option>NEFT/RTGS</option>
                    <option>UPI / GPay</option>
                    <option>Cheque</option>
                    <option>Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Reference / UTR No</label>
                  <input
                    type="text"
                    value={editFormData.referenceNo}
                    onChange={(e) => setEditFormData({ ...editFormData, referenceNo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={editFormData.remarks}
                  onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Pencil size={14} />
                  <span>Update Capital Voucher</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Individual Payment Log Modal */}
      {isEditLogModalOpen && editingLog && createPortal(
        <div 
          className="fixed inset-0 z-[99999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditLogModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Edit Payment Log Entry
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">{editingLog.type || 'Contribution Log'}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateLog} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Log Type</label>
                <input
                  type="text"
                  required
                  value={editLogForm.type}
                  onChange={(e) => setEditLogForm({ ...editLogForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editLogForm.amount}
                    onChange={(e) => setEditLogForm({ ...editLogForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={editLogForm.date}
                    onChange={(e) => setEditLogForm({ ...editLogForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={editLogForm.paymentMethod}
                    onChange={(e) => setEditLogForm({ ...editLogForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option>Bank Transfer</option>
                    <option>NEFT/RTGS</option>
                    <option>UPI / GPay</option>
                    <option>Cheque</option>
                    <option>Cash</option>
                    <option>Opening Balance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Reference No</label>
                  <input
                    type="text"
                    value={editLogForm.referenceNo}
                    onChange={(e) => setEditLogForm({ ...editLogForm, referenceNo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={editLogForm.remarks}
                  onChange={(e) => setEditLogForm({ ...editLogForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditLogModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Pencil size={14} />
                  <span>Update Log</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CapitalTab;
