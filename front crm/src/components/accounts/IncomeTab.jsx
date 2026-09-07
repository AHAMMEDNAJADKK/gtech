import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  PlusCircle, 
  Search, 
  Trash2, 
  Pencil, 
  Building2, 
  CreditCard, 
  Loader2, 
  X,
  ArrowUpRight,
  Receipt,
  Wallet,
  Coins,
  GraduationCap,
  Users,
  Plus,
  Percent,
  FileText,
  Eye,
  CheckCircle2,
  Clock,
  Archive,
  RotateCcw,
  SlidersHorizontal,
  Filter,
  ArrowUpDown,
  Calendar,
  MessageCircle
} from 'lucide-react';
import { useToast } from '../ToastProvider';
import { getClients } from '../../services/clientService';
import { getOpeningBalance, setOpeningBalance as saveOpeningBalanceApi } from '../../services/accountsService';
import ConfirmModal from '../ConfirmModal';
import IncomeInvoiceModal from './IncomeInvoiceModal';
import CreateInvoiceModal from './CreateInvoiceModal';

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

const DEFAULT_DEPARTMENTS = [
  'Development',
  'Marketing',
  'Academy & LMS',
  'Designing',
  'HR & Admin',
  'Accounts & Finance',
  'Sales & CRM',
  'Operations'
];

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'UPI / QR Code',
  'Cheque',
  'Credit/Debit Card',
  'Online Payment Gateway',
  'Other'
];

const DEFAULT_GST_RATES = [0, 5, 12, 18, 28];

const IncomeTab = ({ mode = 'sales' }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [incomes, setIncomes] = useState([]);
  const [summary, setSummary] = useState({ totalIncome: 0, totalEntries: 0, departmentBreakdown: {} });
  const [loading, setLoading] = useState(true);

  // Income Opening Balance State
  const [showIncomeObModal, setShowIncomeObModal] = useState(false);
  const [incomeObSaving, setIncomeObSaving] = useState(false);
  const [incomeObAmount, setIncomeObAmount] = useState(0);
  const [incomeObForm, setIncomeObForm] = useState({
    incomeAmount: '',
    asOfDate: new Date().toISOString().split('T')[0],
    paymentMode: 'ALL',
    note: ''
  });

  const fetchIncomeOb = useCallback(async () => {
    try {
      const res = await getOpeningBalance();
      if (res && res.success && res.data) {
        setIncomeObAmount(res.data.incomeAmount !== undefined ? res.data.incomeAmount : (res.data.amount || 0));
      }
    } catch (e) {
      console.warn('Error fetching income opening balance:', e);
    }
  }, []);

  const handleOpenIncomeObModal = async () => {
    try {
      const res = await getOpeningBalance();
      if (res && res.success && res.data) {
        setIncomeObForm({
          incomeAmount: res.data.incomeAmount !== undefined ? res.data.incomeAmount : (res.data.amount || ''),
          asOfDate: res.data.asOfDate ? new Date(res.data.asOfDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          paymentMode: res.data.paymentMode || 'ALL',
          note: res.data.note || ''
        });
      }
    } catch (e) {
      console.warn('Error opening income OB modal:', e);
    }
    setShowIncomeObModal(true);
  };

  const handleSaveIncomeOpeningBalance = async (e) => {
    e.preventDefault();
    setIncomeObSaving(true);
    try {
      const res = await saveOpeningBalanceApi({
        incomeAmount: incomeObForm.incomeAmount,
        asOfDate: incomeObForm.asOfDate,
        paymentMode: incomeObForm.paymentMode,
        note: incomeObForm.note
      });
      if (res && res.success) {
        setShowIncomeObModal(false);
        showToast('Income Opening Balance updated successfully!', 'success');
        fetchIncomeOb();
        fetchIncomes();
      } else {
        showToast(res?.message || 'Failed to update opening balance.', 'error');
      }
    } catch (err) {
      console.error('Error saving income opening balance:', err);
      showToast('Error updating income opening balance.', 'error');
    } finally {
      setIncomeObSaving(false);
    }
  };

  // Departments & Clients list
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Custom GST rates
  const [gstRatesList, setGstRatesList] = useState(DEFAULT_GST_RATES);

  // Filter & Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'amount' | 'referenceNo' | 'company'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Modal Confirmation state for Deletion, Inactive & Restore
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    confirmText: 'Confirm',
    onConfirm: null
  });

  // Add Income Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sourceType, setSourceType] = useState('General'); // 'Academy' | 'Client' | 'General'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [department, setDepartment] = useState('Development');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [description, setDescription] = useState('');

  // Tax & GST States
  const [taxOption, setTaxOption] = useState('No GST'); // 'No GST', 'Exclusive GST', 'Inclusive GST'
  const [gstCategory, setGstCategory] = useState('CGST_SGST'); // 'CGST_SGST', 'IGST', 'UTGST', 'EXEMPT'
  const [gstRate, setGstRate] = useState(0);

  const [submitting, setSubmitting] = useState(false);

  // Edit Income State
  const [editingIncome, setEditingIncome] = useState(null);

  // View Invoice Modal State
  const [selectedInvoiceRecord, setSelectedInvoiceRecord] = useState(null);
  const [invoiceModalMode, setInvoiceModalMode] = useState('invoice');

  // Create Zoho Invoice Builder Modal State
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 
      'Content-Type': 'application/json',
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` 
    };
  }, []);

  // Fetch CRM Clients from /api/v1/clients
  const fetchClientList = useCallback(async () => {
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
    } catch (err) {
      console.error("Error fetching clients from /api/v1/clients:", err);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  // Fetch company departments
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch(getApiEndpoint('/departments'), {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const names = data.data.map(d => d.name || d.departmentName).filter(Boolean);
        if (names.length > 0) {
          setDepartments(Array.from(new Set([...names, ...DEFAULT_DEPARTMENTS])));
        }
      }
    } catch (err) {
      console.warn("Using default department fallback list:", err);
    }
  }, [getAuthHeaders]);

  // Active vs Inactive Tab State ('active' | 'inactive')
  const [activeIncomeTab, setActiveIncomeTab] = useState('active');

  // Calculate Active Filter Count
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (startDate) count++;
    if (endDate) count++;
    if (selectedDeptFilter !== 'all') count++;
    if (selectedMethodFilter !== 'all') count++;
    if (sortBy !== 'date' || sortOrder !== 'desc') count++;
    return count;
  }, [startDate, endDate, selectedDeptFilter, selectedMethodFilter, sortBy, sortOrder]);

  // Fetch Income Records
  const fetchIncomes = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (activeIncomeTab === 'inactive') {
        queryParams.append('status', 'Inactive');
      }
      if (selectedDeptFilter !== 'all') queryParams.append('department', selectedDeptFilter);
      if (selectedMethodFilter !== 'all') queryParams.append('paymentMethod', selectedMethodFilter);
      if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await fetch(getApiEndpoint(`/accounts/income?${queryParams.toString()}`), {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        setIncomes(data.data || []);
        setSummary(data.summary || { totalIncome: 0, totalEntries: 0, departmentBreakdown: {} });
      } else {
        showToast(data.message || "Failed to load income records.", "error");
      }
    } catch (err) {
      console.error("Error fetching incomes:", err);
      showToast("Error loading income records.", "error");
    } finally {
      setLoading(false);
    }
  }, [activeIncomeTab, selectedDeptFilter, selectedMethodFilter, searchQuery, startDate, endDate, getAuthHeaders, showToast]);

  const getNetPayableAmount = useCallback((inc) => {
    if (!inc) return 0;
    
    const rawBase = parseFloat(inc.amount || 0) > 0
      ? parseFloat(inc.amount)
      : (Array.isArray(inc.lineItems) && inc.lineItems.length > 0 ? inc.lineItems.reduce((s, i) => s + (parseFloat(i.amount) || (parseFloat(i.quantity || 1) * parseFloat(i.unitPrice || 0)) || 0), 0) : 0);

    const gstRate = parseFloat(inc.gstRate || 0);
    const gstAmt = parseFloat(inc.gstAmount || 0) > 0
      ? parseFloat(inc.gstAmount)
      : (inc.taxOption === 'No GST' || !gstRate ? 0 : (rawBase * gstRate) / 100);

    const totalBeforeDisc = rawBase + gstAmt;

    const isFlatDisc = ['amount', 'flat', 'rs'].includes(inc.discountType) || (parseFloat(inc.discountAmount || 0) > 0 && parseFloat(inc.discountAmount || 0) === parseFloat(inc.discountRate || 0));

    const discAmt = parseFloat(inc.discountAmount || 0) > 0
      ? parseFloat(inc.discountAmount)
      : (parseFloat(inc.discountRate || 0) > 0
        ? (isFlatDisc ? parseFloat(inc.discountRate) : (totalBeforeDisc * parseFloat(inc.discountRate)) / 100)
        : 0);

    const calculatedNetPayable = Math.max(0, totalBeforeDisc - discAmt);

    const storedTotal = parseFloat(inc.totalAmount || 0);
    if (storedTotal > 0 && storedTotal > rawBase && gstRate > 0) {
      return storedTotal;
    }

    return calculatedNetPayable;
  }, []);

  const salesSummaryMetrics = React.useMemo(() => {
    let totalPayable = 0;
    let totalReceived = 0;
    let totalPendingBalance = 0;

    incomes.forEach((inc) => {
      const netPayable = getNetPayableAmount(inc);
      totalPayable += netPayable;

      const recStatus = String(inc.status || '').trim().toLowerCase();
      const isExplicitlyPaid = recStatus === 'paid' || recStatus === 'completed';

      let paid = 0;
      if (Array.isArray(inc.payments) && inc.payments.length > 0) {
        paid = inc.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      } else if (parseFloat(inc.receiptAmount || 0) > 0) {
        paid = parseFloat(inc.receiptAmount);
      } else if (isExplicitlyPaid) {
        paid = netPayable;
      }

      const bal = Math.max(0, netPayable - paid);
      totalReceived += paid;
      totalPendingBalance += bal;
    });

    return { totalPayable, totalReceived, totalPendingBalance };
  }, [incomes, getNetPayableAmount]);

  // Sort and Filter Incomes Client-Side (Excludes Pending for Income tab; Shows all for Sales tab)
  const sortedAndFilteredIncomes = React.useMemo(() => {
    let result = incomes.filter((inc) => {
      if (mode === 'income') {
        const st = String(inc.status || '').trim().toLowerCase();
        return st === 'paid' || st === 'partially paid' || st === 'completed';
      }
      return true;
    });

    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'amount') {
        valA = getNetPayableAmount(a);
        valB = getNetPayableAmount(b);
      } else if (sortBy === 'referenceNo') {
        valA = (a.referenceNo || '').toLowerCase();
        valB = (b.referenceNo || '').toLowerCase();
      } else if (sortBy === 'company') {
        valA = (a.clientName || (typeof a.client === 'object' && (a.client?.companyName || a.client?.name)) || a.sourceType || '').toLowerCase();
        valB = (b.clientName || (typeof b.client === 'object' && (b.client?.companyName || b.client?.name)) || b.sourceType || '').toLowerCase();
      } else {
        // Default: 'date'
        valA = new Date(a.date || a.createdAt).getTime();
        valB = new Date(b.date || b.createdAt).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [incomes, mode, sortBy, sortOrder, getNetPayableAmount]);

  const displayReceiptRows = React.useMemo(() => {
    if (mode !== 'income') return [];

    const receiptsList = [];

    sortedAndFilteredIncomes.forEach((inc) => {
      const mongoIdNum = String(inc._id || '').slice(-4).padStart(4, '0') || '0001';
      const dObj = new Date(inc.date || inc.createdAt || Date.now());
      const y = isNaN(dObj.getTime()) ? new Date().getFullYear() : dObj.getFullYear();
      const m = isNaN(dObj.getTime()) ? new Date().getMonth() : dObj.getMonth();
      const fyStr = `${String(m >= 3 ? y : y - 1).slice(-2)}-${String((m >= 3 ? y : y - 1) + 1).slice(-2)}`;
      const defaultRecNo = inc.receiptNo || `KBR/${fyStr}/${mongoIdNum}`;
      const defaultInvNo = inc.referenceNo || `KB/${fyStr}/${mongoIdNum}`;

      const companyStr = (
        inc.clientName ||
        (typeof inc.client === 'object' && (inc.client?.companyName || inc.client?.clientName || inc.client?.name)) ||
        inc.companyName ||
        resolvedSType
      ).trim();

      if (Array.isArray(inc.payments) && inc.payments.length > 0) {
        inc.payments.forEach((p, idx) => {
          const amt = parseFloat(p.amount || 0);
          if (amt <= 0) return;
          const recNo = p.receiptNo || (idx === 0 ? defaultRecNo : `${defaultRecNo}-${idx + 1}`);
          receiptsList.push({
            id: p._id || `${inc._id}_rec_${idx}`,
            receiptNo: recNo,
            invoiceNo: defaultInvNo,
            company: companyStr,
            wayOfIncome: p.paymentMethod || inc.paymentMethod || 'Bank Transfer',
            amountPaid: amt,
            receiptDate: p.receiptDate || inc.receiptDate || inc.date || inc.createdAt,
            parentRecord: inc,
            settlementData: p
          });
        });
      } else {
        const netPayable = getNetPayableAmount(inc);
        const recStatus = String(inc.status || '').trim().toLowerCase();
        const isPaid = recStatus === 'paid' || recStatus === 'completed';
        const recPaid = parseFloat(inc.receiptAmount || 0);
        const amt = isPaid ? (recPaid > 0 ? recPaid : netPayable) : (recPaid > 0 ? recPaid : netPayable);
        if (amt > 0) {
          receiptsList.push({
            id: `${inc._id}_rec_single`,
            receiptNo: defaultRecNo,
            invoiceNo: defaultInvNo,
            company: companyStr,
            wayOfIncome: inc.paymentMethod || 'Bank Transfer',
            amountPaid: amt,
            receiptDate: inc.receiptDate || inc.date || inc.createdAt,
            parentRecord: inc,
            settlementData: null
          });
        }
      }
    });

    return receiptsList;
  }, [sortedAndFilteredIncomes, mode, getNetPayableAmount]);

  useEffect(() => {
    fetchDepartments();
    fetchClientList();
  }, [fetchDepartments, fetchClientList]);

  useEffect(() => {
    fetchIncomes();
    fetchIncomeOb();
  }, [fetchIncomes, fetchIncomeOb]);

  const handleMarkAsPaid = async (inc) => {
    try {
      const res = await fetch(getApiEndpoint(`/accounts/income/${inc._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'Paid' })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Invoice ${inc.referenceNo || ''} marked as Paid! Payment Receipt generated.`, 'success');
        fetchIncomes();
      } else {
        showToast(data.message || 'Failed to update status to Paid.', 'error');
      }
    } catch (err) {
      console.error('Error marking income as paid:', err);
      showToast('Error updating invoice status.', 'error');
    }
  };

  // Handle Source Type Switch (Academy vs Client vs General)
  const handleSourceTypeChange = (type) => {
    setSourceType(type);
    if (type === 'Academy') {
      setSelectedClientId('');
      setClientName('');
      setDepartment('Academy & LMS');
      if (!title || title.includes('Client Payment')) {
        setTitle('Academy Course & LMS Fee');
      }
    } else if (type === 'Client') {
      setDepartment('Sales & CRM');
      if (clients.length > 0 && !selectedClientId) {
        const firstClient = clients[0];
        const cId = firstClient._id || firstClient.id;
        const cName = firstClient.companyName || firstClient.clientName || firstClient.name || 'Client';
        setSelectedClientId(cId);
        setClientName(cName);
        setTitle(`Client Payment - ${cName}`);
      }
    } else {
      setSelectedClientId('');
      setClientName('');
    }
  };

  // Handle Client Selection
  const handleClientSelect = (e) => {
    const cId = e.target.value;
    setSelectedClientId(cId);
    const found = clients.find(c => (c._id || c.id) === cId);
    if (found) {
      const nameStr = found.companyName || found.clientName || found.name || 'Client';
      setClientName(nameStr);
      setTitle(`Client Payment - ${nameStr}`);
    }
  };

  // Handle Adding Custom GST Rate via (+) button
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

  // Advanced Tax & GST Category Calculations (CGST / SGST / IGST)
  const calculateTaxValues = (baseAmt, option, rate, categoryType) => {
    const base = parseFloat(baseAmt) || 0;
    if (option === 'No GST' || !rate || rate <= 0 || categoryType === 'EXEMPT') {
      return { 
        gstAmount: 0, 
        cgstAmount: 0, 
        sgstAmount: 0, 
        igstAmount: 0, 
        totalAmount: base, 
        baseAmount: base 
      };
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

  // Create Income Submission
  const handleCreateIncome = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("Please enter an income title or source.", "warning");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      showToast("Please enter a valid positive income amount.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(getApiEndpoint('/accounts/income'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          amount: parseFloat(amount),
          department,
          paymentMethod,
          date,
          referenceNo: referenceNo.trim(),
          description: description.trim(),
          sourceType,
          client: selectedClientId || null,
          clientName: clientName.trim(),
          taxOption,
          gstCategory,
          gstRate: parseFloat(gstRate || 0),
          gstAmount: currentTaxCalc.gstAmount,
          cgstAmount: currentTaxCalc.cgstAmount,
          sgstAmount: currentTaxCalc.sgstAmount,
          igstAmount: currentTaxCalc.igstAmount,
          totalAmount: currentTaxCalc.totalAmount
        })
      });

      const data = await res.json();

      if (data.success) {
        showToast("Income record saved successfully!", "success");
        setTitle('');
        setAmount('');
        setReferenceNo('');
        setDescription('');
        setSelectedClientId('');
        setClientName('');
        setSourceType('General');
        setTaxOption('No GST');
        setGstRate(0);
        setIsAddModalOpen(false);
        fetchIncomes();
      } else {
        showToast(data.message || "Failed to create income record.", "error");
      }
    } catch (err) {
      console.error("Error creating income:", err);
      showToast("An error occurred while saving income record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Page
  const handleOpenEdit = (inc) => {
    navigate('/accounts/create-invoice', { state: { editIncome: inc } });
  };

  // Update Income Handler
  const handleUpdateIncome = async (e) => {
    e.preventDefault();
    if (!editingIncome || !editingIncome._id) return;

    try {
      setSubmitting(true);
      const res = await fetch(getApiEndpoint(`/accounts/income/${editingIncome._id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: editingIncome.title,
          amount: parseFloat(editingIncome.amount || 0),
          department: editingIncome.department,
          paymentMethod: editingIncome.paymentMethod,
          date: editingIncome.date,
          referenceNo: editingIncome.referenceNo,
          description: editingIncome.description,
          sourceType: editingIncome.sourceType || 'General',
          clientName: editingIncome.clientName || '',
          taxOption: editingIncome.taxOption || 'No GST',
          gstRate: parseFloat(editingIncome.gstRate || 0),
          gstAmount: parseFloat(editingIncome.gstAmount || 0),
          totalAmount: parseFloat(editingIncome.totalAmount || editingIncome.amount || 0)
        })
      });

      const data = await res.json();

      if (data.success) {
        showToast("Income record updated successfully!", "success");
        setEditingIncome(null);
        fetchIncomes();
      } else {
        showToast(data.message || "Failed to update income record.", "error");
      }
    } catch (err) {
      console.error("Error updating income:", err);
      showToast("An error occurred while updating income record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDocumentModal = async (inc, mode = 'invoice') => {
    if (inc && inc._id) {
      try {
        const res = await fetch(getApiEndpoint(`/accounts/income/${inc._id}`), {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            setSelectedInvoiceRecord(data.data);
            setInvoiceModalMode(mode);
            return;
          }
        }
      } catch (err) {
        console.warn('Error fetching full invoice details:', err);
      }
    }
    setSelectedInvoiceRecord(inc);
    setInvoiceModalMode(mode);
  };

  const handleOpenReceipt = async (inc) => {
    const isPaidStatus = inc.status === 'Paid' || inc.status === 'Partially Paid' || !!inc.receiptNo;
    if (!isPaidStatus) {
      showToast('Invoice is unpaid. Only paid or partially paid invoices generate receipts.', 'info');
      return;
    }
    await handleOpenDocumentModal(inc, 'receipt');
  };

  // Soft Delete Handler (Opens Modal to move to Inactive tab)
  const handleDeleteIncome = (id, titleStr) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Move Invoice to Inactive Tab?',
      message: `Are you sure you want to move invoice "${titleStr || 'Record'}" to the Inactive tab? It can be restored anytime.`,
      type: 'amber',
      confirmText: 'Move to Inactive',
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(getApiEndpoint(`/accounts/income/${id}`), {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message || "Invoice moved to Inactive tab.", "success");
            fetchIncomes();
          } else {
            showToast(data.message || "Failed to move invoice to Inactive.", "error");
          }
        } catch (err) {
          console.error("Error deleting income:", err);
          showToast("Error moving invoice to Inactive.", "error");
        }
      }
    });
  };

  // Restore Income Handler (Opens Modal to re-activate invoice back to Active tab)
  const handleRestoreIncome = (id, titleStr) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Restore Invoice to Active List?',
      message: `Restore invoice "${titleStr || 'Record'}" back to your active income list?`,
      type: 'emerald',
      confirmText: 'Restore Invoice',
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(getApiEndpoint(`/accounts/income/${id}/restore`), {
            method: 'PUT',
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success) {
            showToast("Invoice restored to Active list successfully!", "success");
            fetchIncomes();
          } else {
            showToast(data.message || "Failed to restore invoice.", "error");
          }
        } catch (err) {
          console.error("Error restoring income:", err);
          showToast("Error restoring invoice.", "error");
        }
      }
    });
  };

  // Permanent Delete Income Handler (Opens Modal for permanent deletion)
  const handlePermanentDeleteIncome = (id, titleStr) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Permanently Delete Invoice?',
      message: `PERMANENT DELETE WARNING: Are you sure you want to permanently delete invoice "${titleStr || 'Record'}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(getApiEndpoint(`/accounts/income/${id}/permanent`), {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success) {
            showToast("Invoice permanently deleted.", "success");
            fetchIncomes();
          } else {
            showToast(data.message || "Failed to permanently delete invoice.", "error");
          }
        } catch (err) {
          console.error("Error permanently deleting income:", err);
          showToast("Error deleting invoice.", "error");
        }
      }
    });
  };

  const handleSendWhatsAppDirect = (inc) => {
    const clientObj = (typeof inc.client === 'object' && inc.client !== null) ? inc.client : {};
    let targetPhone = clientObj.phone || clientObj.primaryContact?.phone || clientObj.alternativePhone || inc.phone || inc.clientPhone || '';
    let digits = String(targetPhone || '').replace(/\D/g, '');

    if (!digits) {
      const inputPhone = prompt(`Enter WhatsApp / Phone Number for ${inc.clientName || inc.title || 'Client'}:`);
      if (!inputPhone) return;
      digits = inputPhone.replace(/\D/g, '');
    }

    if (digits.length === 10) {
      digits = `91${digits}`;
    }

    if (digits.length < 10) {
      showToast('Invalid phone number for WhatsApp.', 'error');
      return;
    }

    const refNo = inc.referenceNo || `INV-KB-${String(inc._id || '').slice(-4).toUpperCase()}`;
    const netPayable = inc.totalAmount || inc.amount || 0;
    const paidAmt = inc.receiptAmount || 0;
    const balDue = Math.max(0, netPayable - paidAmt);
    const clientNameStr = clientObj.clientName || inc.clientName || inc.title || 'Customer';

    const text = `Hello *${clientNameStr}*,\n\nInvoice & Payment Status for *${refNo}*:\n📅 Date: ${new Date(inc.date || inc.createdAt).toLocaleDateString('en-IN')}\n💰 Total Amount: ₹${Math.round(netPayable).toLocaleString('en-IN')}\n💵 Paid Amount: ₹${Math.round(paidAmt).toLocaleString('en-IN')}\n⚠️ Balance Due: ₹${Math.round(balDue).toLocaleString('en-IN')}\nStatus: *${inc.status || 'Pending'}*\n\nThank you for your business!`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      {/* Sleek 1-Row Compact Header Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-1 py-0.5">
        {/* Left Title & Total Metric Pill */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {mode === 'income' ? 'Income Records & Received Payments' : 'Sales Records & Billing Ledger'}
            </h3>
          </div>

          {/* Income Opening Balance Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
            <Coins size={13} />
            <span>OB: ₹{incomeObAmount.toLocaleString('en-IN')}</span>
          </div>

          {/* Active vs Inactive Sub-Tabs Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 ml-1">
            <button
              type="button"
              onClick={() => setActiveIncomeTab('active')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeIncomeTab === 'active'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp size={13} /> Active Incomes
            </button>
            <button
              type="button"
              onClick={() => setActiveIncomeTab('inactive')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeIncomeTab === 'inactive'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Archive size={13} /> Inactive Tab
            </button>
          </div>
        </div>

        {/* Right Search, Filters & Action Button */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          {/* Search Input */}
          <div className="relative w-full md:w-48">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search source, ref, notes..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          {/* Set Income Opening Balance Button */}
          <button
            type="button"
            onClick={handleOpenIncomeObModal}
            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <Coins size={14} />
            <span>Set Opening Balance</span>
          </button>

          {/* Single Sort & Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`py-1.5 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border ${
              activeFilterCount > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={14} className={activeFilterCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'} />
            <span>Sort & Filter</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold ml-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Create Zoho Invoice Builder Page Button */}
          {mode !== 'income' && (
            <button
              type="button"
              onClick={() => navigate('/accounts/create-invoice')}
              className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-98 shrink-0"
            >
              <FileText size={14} />
              + Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* Income Records Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
            <Loader2 className="animate-spin text-emerald-600 mr-2" size={20} />
            Loading income records...
          </div>
        ) : sortedAndFilteredIncomes.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-1">
            <Coins className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={28} />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No Income Records Found</p>
            <p>Click "+ Create Invoice" to add your first revenue stream.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/70 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {mode === 'income' ? (
                  <tr>
                    <th className="py-3 px-4">Receipt No. & Date</th>
                    <th className="py-3 px-4">Company / Client</th>
                    <th className="py-3 px-4">Invoice No.</th>
                    <th className="py-3 px-4">Way of Income</th>
                    <th className="py-3 px-4 text-right">Amount Paid (₹)</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Source / Title</th>
                    <th className="py-3 px-4">Source Type</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Way of Income</th>
                    <th className="py-3 px-4">Ref No.</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300 font-medium">
                {mode === 'income' ? (
                  displayReceiptRows.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                        <div className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                          #{rec.receiptNo}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(rec.receiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                          <Building2 size={13} className="text-indigo-500 shrink-0" />
                          <span>{rec.company}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        {rec.invoiceNo}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] border border-emerald-200/60 dark:border-emerald-800/60">
                          {rec.wayOfIncome}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                        ₹{Math.round(rec.amountPaid).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDocumentModal(rec.parentRecord, 'invoice')}
                            className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-indigo-200/60 dark:border-indigo-800/60 shadow-2xs"
                            title="View Tax Invoice"
                          >
                            <FileText size={12} className="text-indigo-600 dark:text-indigo-400" />
                            <span>Invoice</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDocumentModal(rec.parentRecord, 'receipt')}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs"
                            title="View Receipt Voucher"
                          >
                            <Receipt size={12} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDocumentModal(rec.parentRecord, 'logs')}
                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                            title="View Logs & History"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedAndFilteredIncomes.map((inc) => (
                  <tr key={inc._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                      {new Date(inc.date || inc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4">
                      {/* 1. Company Name */}
                      {(() => {
                        const companyStr = (
                          inc.clientName ||
                          (typeof inc.client === 'object' && (inc.client?.companyName || inc.client?.clientName || inc.client?.name)) ||
                          inc.companyName ||
                          ''
                        ).trim();

                        return companyStr ? (
                          <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                            <Building2 size={13} className="text-indigo-500 shrink-0" />
                            <span>{companyStr}</span>
                          </div>
                        ) : (
                          <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            <span>{inc.sourceType || 'General'}</span>
                          </div>
                        );
                      })()}

                      {/* 2. Title */}
                      {inc.title && (
                        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 leading-tight">
                          {inc.title}
                        </div>
                      )}

                      {/* 3. Subject */}
                      {(inc.subject || inc.description) && (
                        <div className="text-[11px] font-normal text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                          {inc.subject || inc.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {(() => {
                        const resolvedSType = (inc.sourceType === 'Academy' || inc.department === 'Academy & LMS')
                          ? 'Academy'
                          : (inc.sourceType === 'Client' || inc.client)
                          ? 'Client'
                          : 'General';
                        return (
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                            resolvedSType === 'Academy'
                              ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                              : resolvedSType === 'Client'
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {resolvedSType}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                        {inc.department}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                        {inc.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      {inc.referenceNo || (() => {
                        const dObj = new Date(inc.date || inc.createdAt || Date.now());
                        const y = isNaN(dObj.getTime()) ? new Date().getFullYear() : dObj.getFullYear();
                        const m = isNaN(dObj.getTime()) ? new Date().getMonth() : dObj.getMonth();
                        const fyStr = `${String(m >= 3 ? y : y - 1).slice(-2)}-${String((m >= 3 ? y : y - 1) + 1).slice(-2)}`;
                        return `KB/${fyStr}/${String(inc._id || '').slice(-4).padStart(4, '0')}`;
                      })()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {(() => {
                        const netPayable = getNetPayableAmount(inc);
                        const recStatus = String(inc.status || '').trim().toLowerCase();
                        let paidAmt = 0;
                        if (Array.isArray(inc.payments) && inc.payments.length > 0) {
                          paidAmt = inc.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                        } else if (parseFloat(inc.receiptAmount || 0) > 0) {
                          paidAmt = parseFloat(inc.receiptAmount);
                        } else if (recStatus === 'paid' || recStatus === 'completed') {
                          paidAmt = netPayable;
                        }

                        const balDue = Math.max(0, netPayable - paidAmt);
                        const isFullyPaid = balDue <= 0.01 || recStatus === 'paid' || recStatus === 'completed';
                        const isPartiallyPaid = !isFullyPaid && (paidAmt > 0 || recStatus === 'partially paid');

                        return (
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] flex items-center gap-1 w-fit ${
                            isFullyPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                              : isPartiallyPaid
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                          }`}>
                            {isFullyPaid && <CheckCircle2 size={11} />}
                            {isPartiallyPaid && <Clock size={11} className="text-amber-600" />}
                            {!isFullyPaid && !isPartiallyPaid && <Clock size={11} className="text-rose-500" />}
                            {isFullyPaid ? 'Paid' : isPartiallyPaid ? 'Partially Paid' : 'Pending'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold">
                      {(() => {
                        const netPayable = getNetPayableAmount(inc);
                        const recStatus = String(inc.status || '').trim().toLowerCase();
                        const isExplicitlyPaid = recStatus === 'paid' || recStatus === 'completed';

                        let paidAmt = 0;
                        if (Array.isArray(inc.payments) && inc.payments.length > 0) {
                          paidAmt = inc.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                        } else if (parseFloat(inc.receiptAmount || 0) > 0) {
                          paidAmt = parseFloat(inc.receiptAmount);
                        } else if (isExplicitlyPaid) {
                          paidAmt = netPayable;
                        }

                        const balDue = Math.max(0, netPayable - paidAmt);

                        return (
                          <div className="space-y-0.5 text-right">
                            <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                              ₹{Math.round(netPayable).toLocaleString('en-IN')}
                            </div>
                            
                            <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              Paid: ₹{Math.round(paidAmt).toLocaleString('en-IN')}
                            </div>

                            {balDue > 0.01 && (
                              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                Due: ₹{Math.round(balDue).toLocaleString('en-IN')}
                              </div>
                            )}

                            {parseFloat(inc.gstRate || 0) > 0 && (
                              <div className="text-[9px] font-medium text-slate-400">
                                Incl. GST ({inc.gstRate}%)
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDocumentModal(inc, 'invoice')}
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-indigo-200/60 dark:border-indigo-800/60 shadow-2xs"
                          title="View & Print Tax Invoice"
                        >
                          <FileText size={12} className="text-indigo-600 dark:text-indigo-400" />
                          <span>Invoice</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDocumentModal(inc, 'logs')}
                          className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                          title="View Details & Logs"
                        >
                          <Eye size={15} />
                        </button>
                        {activeIncomeTab === 'inactive' ? (
                          <>
                            <button
                              onClick={() => handleRestoreIncome(inc._id, inc.title)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs"
                              title="Restore invoice back to active list"
                            >
                              <RotateCcw size={12} />
                              <span>Restore</span>
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteIncome(inc._id, inc.title)}
                              className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Permanently Delete Invoice"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEdit(inc)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Edit Income"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteIncome(inc._id, inc.title)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Move Invoice to Inactive Tab"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wide Add Income Modal (Responsive Scrollable Flexbox - Portal to document.body) */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500" />
                Record New Income
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateIncome} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Source Type Selector (Academy vs Client vs General) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Select Income Source Category <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSourceTypeChange('General')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      sourceType === 'General'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Coins size={14} /> General / Other
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSourceTypeChange('Academy')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      sourceType === 'Academy'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <GraduationCap size={14} /> Academy / LMS
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSourceTypeChange('Client')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      sourceType === 'Client'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Users size={14} /> Clients
                  </button>
                </div>
              </div>

              {/* Client Selection Dropdown (When Client is Selected) */}
              {sourceType === 'Client' && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60 space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Select Client <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={handleClientSelect}
                    className="w-full bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                    required
                  >
                    <option value="">-- Choose Client --</option>
                    {loadingClients ? (
                      <option disabled>Loading clients list...</option>
                    ) : clients.length === 0 ? (
                      <option disabled>No registered clients found</option>
                    ) : (
                      clients.map((c) => {
                        const cId = c._id || c.id;
                        const company = c.companyName || '';
                        const clientPerson = c.clientName || c.contactPerson || c.name || '';
                        const emailStr = c.email || '';
                        const displayLabel = company && clientPerson && company !== clientPerson
                          ? `🏢 ${company} — ${clientPerson}`
                          : company
                          ? `🏢 ${company}`
                          : clientPerson
                          ? `🏢 ${clientPerson}`
                          : `🏢 ${emailStr || 'Client'}`;
                        return (
                          <option key={cId} value={cId}>
                            {displayLabel}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              )}

              {/* Row 1: Source Title (2 cols) & Amount (1 col) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Income Source / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Website Development Payment"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-bold"
                    required
                  />
                </div>
              </div>

              {/* Tax & GST Section with GST Categories and (+) Plus Button for Custom GST */}
              <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Receipt size={14} className="text-emerald-500" />
                    Tax & GST Options
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Calculated GST: <strong className="text-emerald-600 dark:text-emerald-400">₹{currentTaxCalc.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong> | Total: <strong className="text-slate-900 dark:text-white">₹{currentTaxCalc.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
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
                            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shrink-0 shadow-xs"
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
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
                          CGST ({gstRate / 2}%): ₹{currentTaxCalc.cgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
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

              {/* Row 2: Select Department (1 col) + Way of Income (1 col) + Received Date (1 col) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Select Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Way of Income <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                    required
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Received Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer font-medium"
                  />
                </div>
              </div>

              {/* Row 3: Reference / Invoice No. (1 col) & Description / Notes (2 cols) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Ref / Invoice No.
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. INV-0012"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Description / Notes
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Additional notes about this income stream..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-medium"
                  />
                </div>
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
                  disabled={submitting}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={13} />
                      Saving...
                    </>
                  ) : (
                    'Save Income'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Wide Edit Income Modal (Responsive Scrollable Flexbox - Portal to document.body) */}
      {editingIncome && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setEditingIncome(null)} />
          <div className="relative z-10 w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil size={16} className="text-indigo-500" />
                Edit Income Record
              </h3>
              <button
                type="button"
                onClick={() => setEditingIncome(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateIncome} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Row 1: Source Title (2 cols) & Amount (1 col) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Income Source / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingIncome.title || ''}
                    onChange={(e) => setEditingIncome({ ...editingIncome, title: e.target.value })}
                    placeholder="Income Title"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingIncome.amount || ''}
                    onChange={(e) => setEditingIncome({ ...editingIncome, amount: e.target.value })}
                    placeholder="Amount"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-bold"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Select Department (1 col) + Way of Income (1 col) + Date (1 col) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Select Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editingIncome.department || ''}
                    onChange={(e) => setEditingIncome({ ...editingIncome, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Way of Income <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editingIncome.paymentMethod || 'Bank Transfer'}
                    onChange={(e) => setEditingIncome({ ...editingIncome, paymentMethod: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                    required
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editingIncome.date ? new Date(editingIncome.date).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingIncome({ ...editingIncome, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer font-medium"
                  />
                </div>
              </div>

              {/* Row 3: Reference / Invoice No. (1 col) & Description / Notes (2 cols) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Ref / Invoice No.
                  </label>
                  <input
                    type="text"
                    value={editingIncome.referenceNo || ''}
                    onChange={(e) => setEditingIncome({ ...editingIncome, referenceNo: e.target.value })}
                    placeholder="Invoice No"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Description / Notes
                  </label>
                  <input
                    type="text"
                    value={editingIncome.description || ''}
                    onChange={(e) => setEditingIncome({ ...editingIncome, description: e.target.value })}
                    placeholder="Notes"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-medium"
                  />
                </div>
              </div>

              {/* Row 4: Status (1 col), Receipt No. (1 col), Receipt Date (1 col) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-slate-50/60 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Invoice Status
                  </label>
                  <select
                    value={editingIncome.status || 'Pending'}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      const updated = { ...editingIncome, status: newStatus };
                      if (newStatus === 'Paid' && !updated.receiptNo) {
                        const dateObj = new Date(updated.date || Date.now());
                        const year = isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();
                        const month = isNaN(dateObj.getTime()) ? new Date().getMonth() : dateObj.getMonth();
                        const startYear = month >= 3 ? year : year - 1;
                        const fyStr = `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
                        const numDigits = String(updated._id || '').replace(/\D/g, '');
                        const seqStr = numDigits ? numDigits.slice(-4).padStart(4, '0') : '0001';
                        updated.receiptNo = `KBR/${fyStr}/${seqStr}`;
                        updated.receiptDate = new Date().toISOString().split('T')[0];
                      }
                      setEditingIncome(updated);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="Paid">Paid (Generates Receipt)</option>
                    <option value="Pending">Pending (Invoice Only)</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Receipt No.
                  </label>
                  <input
                    type="text"
                    value={editingIncome.receiptNo || ''}
                    onChange={(e) => setEditingIncome({ ...editingIncome, receiptNo: e.target.value })}
                    placeholder="e.g. KBR/26-27/0001"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={editingIncome.receiptDate ? new Date(editingIncome.receiptDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingIncome({ ...editingIncome, receiptDate: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer font-medium"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingIncome(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={13} />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Category-Specific Income Invoice / Payment Receipt Modal */}
      <IncomeInvoiceModal
        isOpen={!!selectedInvoiceRecord}
        onClose={() => {
          setSelectedInvoiceRecord(null);
          setInvoiceModalMode('invoice');
        }}
        incomeRecord={selectedInvoiceRecord}
        initialMode={invoiceModalMode}
        onUpdateSuccess={(updatedData) => {
          if (updatedData) {
            setSelectedInvoiceRecord(updatedData);
          }
          fetchIncomes();
        }}
        showToast={showToast}
      />

      {/* Zoho-Style Create Invoice Builder Modal */}
      <CreateInvoiceModal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        onInvoiceCreated={fetchIncomes}
        showToast={showToast}
      />

      {/* Sort & Filter Modal */}
      {isFilterModalOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <SlidersHorizontal size={16} />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Sort & Filter Incomes</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date From & Date To Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar size={13} className="text-emerald-600" /> Date Range Filter
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">Date From</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">Date To</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                </div>
                {/* Date Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setStartDate(todayStr);
                      setEndDate(todayStr);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                      const todayStr = now.toISOString().split('T')[0];
                      setStartDate(firstDay);
                      setEndDate(todayStr);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  >
                    This Month
                  </button>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      Clear Dates
                    </button>
                  )}
                </div>
              </div>

              {/* Sorting Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ArrowUpDown size={13} className="text-indigo-600" /> Sort By
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="date">📅 Date</option>
                    <option value="amount">💰 Amount</option>
                    <option value="referenceNo">🔢 Invoice / Ref No.</option>
                    <option value="company">🏢 Company Name</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="desc">⬇️ Newest / Highest First</option>
                    <option value="asc">⬆️ Oldest / Lowest First</option>
                  </select>
                </div>
              </div>

              {/* Department Filter */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Department</label>
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Way of Income / Payment Method</label>
                <select
                  value={selectedMethodFilter}
                  onChange={(e) => setSelectedMethodFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Ways of Income</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSelectedDeptFilter('all');
                  setSelectedMethodFilter('all');
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer active:scale-98"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Interactive Delete, Inactive & Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        type={confirmModalConfig.type}
      />

      {/* Set Income Opening Balance Modal (Portal to document.body) */}
      {showIncomeObModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                  <Coins size={18} />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Set Income Opening Balance</h3>
              </div>
              <button 
                onClick={() => setShowIncomeObModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveIncomeOpeningBalance} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Income Opening Balance (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50000"
                  value={incomeObForm.incomeAmount}
                  onChange={(e) => setIncomeObForm({ ...incomeObForm, incomeAmount: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  As of Date (Effective Date)
                </label>
                <input
                  type="date"
                  value={incomeObForm.asOfDate}
                  onChange={(e) => setIncomeObForm({ ...incomeObForm, asOfDate: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Account / Payment Mode
                </label>
                <select
                  value={incomeObForm.paymentMode}
                  onChange={(e) => setIncomeObForm({ ...incomeObForm, paymentMode: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
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
                  placeholder="Starting income balance note..."
                  value={incomeObForm.note}
                  onChange={(e) => setIncomeObForm({ ...incomeObForm, note: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIncomeObModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incomeObSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {incomeObSaving ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                  <span>Save Income Opening</span>
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

export default IncomeTab;
