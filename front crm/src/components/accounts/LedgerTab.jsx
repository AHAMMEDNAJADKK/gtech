import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Users, 
  GraduationCap, 
  FileText, 
  Printer, 
  Loader2, 
  Coins, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Eye, 
  Receipt,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  PlusCircle,
  SlidersHorizontal
} from 'lucide-react';
import { getClients } from '../../services/clientService';
import { useToast } from '../ToastProvider';
import IncomeInvoiceModal from './IncomeInvoiceModal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) return `${API_BASE}${cleanPath}`;
  if (API_BASE.endsWith('/api')) return `${API_BASE}/v1${cleanPath}`;
  return `${API_BASE}/api/v1${cleanPath}`;
};

const LedgerTab = () => {
  const { showToast } = useToast();

  // Party Selection: 'Client' or 'Student'
  const [partyType, setPartyType] = useState('Client'); // 'Client' or 'Student'
  
  // Clients & Students Lists
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Incomes & Expenses / Financial Records from API
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  // Search & Type Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'SALES' | 'RECEIPT' | 'INCOME' | 'PURCHASE' | 'EXPENSE' | 'PROFORMA'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Document View Modal State
  const [selectedDocumentRecord, setSelectedDocumentRecord] = useState(null);
  const [documentModalMode, setDocumentModalMode] = useState('receipt');

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
    };
  }, []);

  // 1. Fetch Clients list
  useEffect(() => {
    const fetchClientList = async () => {
      setLoadingClients(true);
      try {
        const res = await getClients({ limit: 1000 });
        let list = [];
        if (res && res.success && res.data && Array.isArray(res.data.clients)) {
          list = res.data.clients;
        } else if (res && res.success && Array.isArray(res.data)) {
          list = res.data;
        } else if (res && Array.isArray(res.clients)) {
          list = res.clients;
        } else if (Array.isArray(res)) {
          list = res;
        }
        setClients(list);
        if (list.length > 0 && !selectedClientId) {
          const first = list[0];
          setSelectedClientId(first._id || first.id);
        }
      } catch (err) {
        console.error('Error fetching clients for ledger:', err);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClientList();
  }, []);

  // 2. Fetch Students list
  useEffect(() => {
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const studentMap = new Map();

        // Fetch Enrollments
        try {
          const res = await fetch(getApiEndpoint('/academy/enrollments?limit=1000'), {
            headers: getAuthHeaders()
          });
          if (res.ok) {
            const data = await res.json();
            const items = data?.data?.enrollments || data?.data || data?.enrollments || (Array.isArray(data) ? data : []);
            if (Array.isArray(items)) {
              items.forEach(item => {
                const st = item.studentId || {};
                const stId = st._id || st.id || item._id;
                const name = st.name || item.studentName || st.fullName || '';
                const code = st.studentId || item.enrollmentNo || '';
                const course = item.courseId?.courseName || st.coursePreference || '';
                if (name && !studentMap.has(name.toLowerCase())) {
                  studentMap.set(name.toLowerCase(), { id: stId, name, code, course });
                }
              });
            }
          }
        } catch (e) {}

        // Fetch Users (Students)
        try {
          const resUsers = await fetch(getApiEndpoint('/users?limit=1000'), {
            headers: getAuthHeaders()
          });
          if (resUsers.ok) {
            const dataUsers = await resUsers.json();
            const rawUsers = dataUsers?.data?.users || dataUsers?.data || dataUsers?.users || (Array.isArray(dataUsers) ? dataUsers : []);
            if (Array.isArray(rawUsers)) {
              rawUsers.forEach(u => {
                const uRole = (u.role || '').toLowerCase();
                const uDept = (u.department || '').toLowerCase();
                const uId = u._id || u.id;
                const name = u.name || u.fullName || u.username || '';
                const code = u.studentId || u.userCode || '';
                if (name && (uRole.includes('student') || uDept.includes('academy') || uDept.includes('lms') || Boolean(u.studentId))) {
                  if (!studentMap.has(name.toLowerCase())) {
                    studentMap.set(name.toLowerCase(), { id: uId, name, code, course: u.course || '' });
                  }
                }
              });
            }
          }
        } catch (e) {}

        let studentList = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        if (studentList.length === 0) {
          studentList = [
            { id: 'STU1001', name: 'Alex Johnson', code: 'STU1001', course: 'Full Stack Development' },
            { id: 'STU1002', name: 'Rahul Sharma', code: 'STU1002', course: 'UI/UX Design Masterclass' }
          ];
        }
        setStudents(studentList);
      } catch (err) {
        console.error('Error fetching students for ledger:', err);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [getAuthHeaders]);

  // 3. Fetch Incomes & Expenses (Sales, Income Receipts, Purchases, Expenses)
  const fetchFinancials = useCallback(async () => {
    setLoadingFinancials(true);
    try {
      const [resIncomes, resExpenses] = await Promise.all([
        fetch(getApiEndpoint('/accounts/income?limit=1000'), { headers: getAuthHeaders() }),
        fetch(getApiEndpoint('/accounts/expenses?limit=1000'), { headers: getAuthHeaders() })
      ]);

      if (resIncomes.ok) {
        const dataInc = await resIncomes.json();
        if (dataInc.success && Array.isArray(dataInc.data)) {
          setIncomes(dataInc.data);
        }
      }

      if (resExpenses.ok) {
        const dataExp = await resExpenses.json();
        if (dataExp.success && Array.isArray(dataExp.data)) {
          setExpenses(dataExp.data);
        }
      }
    } catch (err) {
      console.error('Error fetching financial records for ledger:', err);
    } finally {
      setLoadingFinancials(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  // Selected Party Metadata
  const selectedPartyObj = useMemo(() => {
    if (partyType === 'Client') {
      const found = clients.find(c => (c._id || c.id) === selectedClientId);
      return found ? {
        id: found._id || found.id,
        name: found.companyName || found.clientName || found.name || 'Selected Client',
        contact: found.primaryContact?.name || found.contactPerson || '',
        email: found.email || found.primaryContact?.email || '',
        phone: found.phone || found.mobile || ''
      } : null;
    } else {
      const found = students.find(s => s.id === selectedStudentId);
      return found ? {
        id: found.id,
        name: found.name || 'Selected Student',
        contact: found.course || 'Student',
        email: found.email || '',
        phone: found.phone || ''
      } : null;
    }
  }, [partyType, selectedClientId, selectedStudentId, clients, students]);

  // Build Comprehensive Chronological Ledger Statement Rows for Selected Party
  const ledgerEntries = useMemo(() => {
    if (!selectedPartyObj || !selectedPartyObj.name) return [];

    const targetNameLower = selectedPartyObj.name.trim().toLowerCase();
    const targetId = String(selectedPartyObj.id || '');

    const rawRows = [];

    // A. Process Incomes, Sales, Receipts, and Proformas
    const matchedIncomes = incomes.filter(inc => {
      if (partyType === 'Client') {
        const cObjId = inc.client ? String(typeof inc.client === 'object' ? (inc.client._id || inc.client.id) : inc.client) : '';
        const cName = (inc.clientName || (typeof inc.client === 'object' && (inc.client?.companyName || inc.client?.name)) || '').toLowerCase();
        return (cObjId && cObjId === targetId) || (cName && cName.includes(targetNameLower));
      } else {
        const cName = (inc.clientName || inc.title || '').toLowerCase();
        return cName.includes(targetNameLower) || (inc.sourceType === 'Academy' && cName.includes(targetNameLower));
      }
    });

    matchedIncomes.forEach(inc => {
      const incDate = inc.date || inc.createdAt || Date.now();
      const statusStr = String(inc.status || '').trim().toLowerCase();
      const isProforma = statusStr === 'proforma';
      const isDirectRec = inc.isDirectReceipt === true || !inc.referenceNo || inc.referenceNo === '-';
      const totalAmt = parseFloat(inc.totalAmount !== undefined && inc.totalAmount !== null ? inc.totalAmount : (inc.amount || 0));

      // 1. Sales Invoice, Income, or Proforma Row
      if (isProforma) {
        rawRows.push({
          id: `${inc._id}_prof`,
          date: incDate,
          refNo: inc.referenceNo || `PRO-${String(inc._id).slice(-4)}`,
          type: 'Proforma',
          categoryGroup: 'PROFORMA',
          particulars: `${inc.title || 'Proforma Quotation'} (Quote Only)`,
          debit: 0,
          credit: 0,
          rawRecord: inc,
          viewMode: 'invoice'
        });
      } else if (!isDirectRec) {
        rawRows.push({
          id: `${inc._id}_inv`,
          date: incDate,
          refNo: inc.referenceNo || `KB-${String(inc._id).slice(-4)}`,
          type: 'Sales',
          categoryGroup: 'SALES',
          particulars: inc.title || inc.description || 'Sales Billing',
          debit: totalAmt,
          credit: 0,
          rawRecord: inc,
          viewMode: 'invoice'
        });
      } else {
        rawRows.push({
          id: `${inc._id}_inc`,
          date: incDate,
          refNo: inc.receiptNo || `KBR-${String(inc._id).slice(-4)}`,
          type: 'Income',
          categoryGroup: 'INCOME',
          particulars: inc.title || inc.description || 'Direct Income Entry',
          debit: 0,
          credit: totalAmt,
          rawRecord: inc,
          viewMode: 'receipt'
        });
      }

      // 2. Receipt / Payment Credit Rows for Invoices & Receipts
      if (!isDirectRec) {
        if (Array.isArray(inc.payments) && inc.payments.length > 0) {
          inc.payments.forEach((p, pIdx) => {
            const pAmt = parseFloat(p.amount || 0);
            if (pAmt > 0) {
              rawRows.push({
                id: `${inc._id}_pay_${pIdx}`,
                date: p.receiptDate || inc.receiptDate || incDate,
                refNo: p.receiptNo || inc.receiptNo || `KBR-${String(inc._id).slice(-4)}-${pIdx + 1}`,
                type: 'Receipt',
                categoryGroup: 'RECEIPT',
                particulars: `Receipt (${p.paymentMethod || inc.paymentMethod || 'Bank Transfer'}) - ${p.notes || 'Payment'}`,
                debit: 0,
                credit: pAmt,
                rawRecord: inc,
                viewMode: 'receipt'
              });
            }
          });
        } else {
          const pAmt = parseFloat(inc.receiptAmount || 0);
          if (pAmt > 0) {
            rawRows.push({
              id: `${inc._id}_pay_single`,
              date: inc.receiptDate || incDate,
              refNo: inc.receiptNo || `KBR-${String(inc._id).slice(-4)}`,
              type: 'Receipt',
              categoryGroup: 'RECEIPT',
              particulars: `Receipt (${inc.paymentMethod || 'Bank Transfer'})`,
              debit: 0,
              credit: pAmt,
              rawRecord: inc,
              viewMode: 'receipt'
            });
          }
        }
      }
    });

    // B. Process Purchases & Expenses
    const matchedExpenses = expenses.filter(exp => {
      const expClientId = exp.client ? String(typeof exp.client === 'object' ? (exp.client._id || exp.client.id) : exp.client) : '';
      const expName = (exp.clientName || exp.vendorName || exp.clientVendor || exp.title || exp.description || (typeof exp.client === 'object' && exp.client?.companyName) || '').toLowerCase();
      return (expClientId && expClientId === targetId) || (expName && expName.includes(targetNameLower));
    });

    matchedExpenses.forEach(exp => {
      const expDate = exp.date || exp.createdAt || Date.now();
      const expAmt = parseFloat(exp.amount || 0);
      if (expAmt <= 0) return;

      const catStr = String(exp.categoryName || exp.category || '').toLowerCase();
      const isPurchase = catStr.includes('purchase') || catStr.includes('inventory') || catStr.includes('vendor') || exp.isPurchase === true;
      const typeStr = isPurchase ? 'Purchase' : 'Expense';
      const catGroup = isPurchase ? 'PURCHASE' : 'EXPENSE';

      rawRows.push({
        id: `${exp._id}_exp`,
        date: expDate,
        refNo: exp.billNo || exp.voucherNo || `EXP-${String(exp._id).slice(-4)}`,
        type: typeStr,
        categoryGroup: catGroup,
        particulars: `${exp.title || exp.description || exp.categoryName || 'Procurement Cost'} (${exp.paymentMethod || 'Paid'})`,
        debit: isPurchase ? expAmt : 0,
        credit: isPurchase ? 0 : expAmt,
        rawRecord: null,
        viewMode: 'expense'
      });
    });

    // Filtering by Date, Search, & Transaction Type Filter
    let filtered = rawRows.filter(row => {
      if (typeFilter !== 'ALL' && row.categoryGroup !== typeFilter) {
        return false;
      }
      if (startDate) {
        const rTime = new Date(row.date).getTime();
        const sTime = new Date(startDate).getTime();
        if (rTime < sTime) return false;
      }
      if (endDate) {
        const rTime = new Date(row.date).getTime();
        const eTime = new Date(endDate).getTime() + 24*60*60*1000;
        if (rTime > eTime) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = String(row.refNo || '').toLowerCase().includes(q);
        const matchPart = String(row.particulars || '').toLowerCase().includes(q);
        const matchType = String(row.type || '').toLowerCase().includes(q);
        if (!matchRef && !matchPart && !matchType) return false;
      }
      return true;
    });

    // Sort Chronologically Ascending
    filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate Cumulative Running Balance
    let runningBal = 0;
    return filtered.map(row => {
      runningBal += (row.debit - row.credit);
      return {
        ...row,
        balance: runningBal
      };
    });
  }, [selectedPartyObj, partyType, incomes, expenses, typeFilter, startDate, endDate, searchQuery]);

  // Financial Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    ledgerEntries.forEach(r => {
      totalBilled += r.debit;
      totalPaid += r.credit;
    });
    const closingBalance = totalBilled - totalPaid;
    return {
      totalBilled,
      totalPaid,
      closingBalance,
      entryCount: ledgerEntries.length
    };
  }, [ledgerEntries]);

  const handlePrintLedger = () => {
    window.print();
  };

  const handleOpenDocument = (row) => {
    if (row.rawRecord) {
      setSelectedDocumentRecord(row.rawRecord);
      setDocumentModalMode(row.viewMode || 'receipt');
    } else {
      showToast(`Viewing details for ${row.type} entry ${row.refNo}`, 'info');
    }
  };

  return (
    <div className="space-y-4">
      {/* Sleek Toolbar Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Title & Party Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Consolidated Financial Ledger Statement
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Receipt, Income, Sales, Purchase & Expense ledger for selected party
              </p>
            </div>

            {/* Party Type Selector Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 ml-2">
              <button
                type="button"
                onClick={() => {
                  setPartyType('Client');
                  if (clients.length > 0) setSelectedClientId(clients[0]._id || clients[0].id);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  partyType === 'Client'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users size={13} /> Client Ledger
              </button>

              <button
                type="button"
                onClick={() => {
                  setPartyType('Student');
                  if (students.length > 0) setSelectedStudentId(students[0].id);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  partyType === 'Student'
                    ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <GraduationCap size={13} /> Student Ledger
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintLedger}
              className="py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Statement</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Party Dropdown */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Select {partyType} <span className="text-rose-500">*</span>
            </label>
            {partyType === 'Client' ? (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
              >
                {loadingClients ? (
                  <option disabled>Loading clients list...</option>
                ) : clients.length === 0 ? (
                  <option disabled>No clients found</option>
                ) : (
                  clients.map(c => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.companyName || c.clientName || c.name || 'Client'}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
              >
                {loadingStudents ? (
                  <option disabled>Loading students list...</option>
                ) : students.length === 0 ? (
                  <option disabled>No students found</option>
                ) : (
                  students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || 'Student'})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Transaction Type Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Transaction Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              <option value="ALL">All Categories (Sales, Receipt, Income, Purchase, Expense)</option>
              <option value="RECEIPT">Receipt Only</option>
              <option value="INCOME">Income Only</option>
              <option value="SALES">Sales Only</option>
              <option value="PURCHASE">Purchase Only</option>
              <option value="EXPENSE">Expense Only</option>
              <option value="PROFORMA">Proforma Only</option>
            </select>
          </div>

          {/* Search Particulars / Ref */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Search Particulars
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ref, notes..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>

          {/* Date Range Start */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            />
          </div>

          {/* Date Range End */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Selected Party Summary KPI Cards */}
      {selectedPartyObj && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Billed / Debits</p>
              <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                ₹{Math.round(summaryMetrics.totalBilled).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <ArrowUpRight size={18} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Paid / Credits</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                ₹{Math.round(summaryMetrics.totalPaid).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ArrowDownLeft size={18} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Closing Balance Due</p>
              <p className={`text-base font-black font-mono mt-0.5 ${summaryMetrics.closingBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                ₹{Math.round(summaryMetrics.closingBalance).toLocaleString('en-IN')}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${summaryMetrics.closingBalance > 0 ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'}`}>
              <Coins size={18} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Account Status</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold mt-1 border ${
                summaryMetrics.closingBalance <= 0.01 
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              }`}>
                {summaryMetrics.closingBalance <= 0.01 ? (
                  <>
                    <CheckCircle2 size={12} /> Account Settled
                  </>
                ) : (
                  <>
                    <AlertCircle size={12} /> Balance Outstanding
                  </>
                )}
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
              <Receipt size={18} />
            </div>
          </div>
        </div>
      )}

      {/* Main Statement Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loadingFinancials ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
            <Loader2 className="animate-spin text-indigo-600 mr-2" size={20} />
            Loading consolidated ledger statement...
          </div>
        ) : !selectedPartyObj ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-1">
            <Users className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={28} />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No {partyType} Selected</p>
            <p>Please select a {partyType.toLowerCase()} from the dropdown above to view their financial ledger statement.</p>
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-1">
            <FileText className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={28} />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No Ledger Transactions Found</p>
            <p>No receipt, income, sales, purchase, or expense transactions recorded for {selectedPartyObj.name}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Print Header Visible ONLY during print */}
            <div className="hidden print:block p-6 space-y-4 border-b border-slate-300">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900">CONSOLIDATED FINANCIAL STATEMENT OF ACCOUNT</h1>
                  <p className="text-xs font-bold text-slate-600">{selectedPartyObj.name}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Date Generated: {new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200/70 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Ref / Voucher No.</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Particulars / Notes</th>
                  <th className="py-3 px-4 text-right">Debit (Billed ₹)</th>
                  <th className="py-3 px-4 text-right">Credit (Paid ₹)</th>
                  <th className="py-3 px-4 text-right">Running Balance (₹)</th>
                  <th className="py-3 px-4 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300 font-medium">
                {ledgerEntries.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/30 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs font-medium">
                      {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                      {row.refNo}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] border capitalize ${
                        row.type === 'Receipt'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60'
                          : row.type === 'Income'
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/60'
                          : row.type === 'Sales'
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60'
                          : row.type === 'Purchase'
                          ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60'
                          : row.type === 'Expense'
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60'
                      }`}>
                        {row.type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {row.particulars}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {row.debit > 0 ? `₹${Math.round(row.debit).toLocaleString('en-IN')}` : '-'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                      {row.credit > 0 ? `₹${Math.round(row.credit).toLocaleString('en-IN')}` : '-'}
                    </td>

                    <td className={`py-3.5 px-4 text-right font-mono font-extrabold text-xs ${
                      row.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      ₹{Math.round(row.balance).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap print:hidden">
                      {row.rawRecord ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(row)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition cursor-pointer flex items-center gap-1 ml-auto border border-slate-200 dark:border-slate-700"
                          title="View Document Details"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document View Modal Portal */}
      {selectedDocumentRecord && (
        <IncomeInvoiceModal
          isOpen={Boolean(selectedDocumentRecord)}
          onClose={() => setSelectedDocumentRecord(null)}
          incomeRecord={selectedDocumentRecord}
          initialMode={documentModalMode}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default LedgerTab;
