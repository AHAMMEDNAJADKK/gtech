import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2, FileText, GraduationCap, Coins, Users, CheckCircle2, Receipt, Eye } from 'lucide-react';
import { getClients } from '../../services/clientService';
import { useToast } from '../ToastProvider';
import IncomeInvoiceModal from './IncomeInvoiceModal';
import AddItemOptionModal from './AddItemOptionModal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'UPI', 'Credit Card', 'Cheque', 'Other'];

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

const CreateInvoiceTab = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const editIdFromParam = searchParams.get('edit');
  const editRecordFromState = location.state?.editIncome;
  const [editingId, setEditingId] = useState(editRecordFromState?._id || editIdFromParam || null);

  // Primary Invoice Category & Status
  const [sourceType, setSourceType] = useState('Client'); // 'Client', 'Academy', 'General'
  const [status, setStatus] = useState('Pending'); // 'Pending', 'Paid', 'Draft'

  // Header & Client Details
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');

  // Compact Zoho Invoice Fields
  const [referenceNo, setReferenceNo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [salesperson, setSalesperson] = useState('');
  const [subject, setSubject] = useState('');
  const [department, setDepartment] = useState('Sales & CRM');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');

  // Payment Receipt Specific Fields
  const [receiptNo, setReceiptNo] = useState('');
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Compact Line Items Table (Specific Item Details choices)
  const [itemOptions, setItemOptions] = useState(() => {
    const saved = localStorage.getItem('crm_item_options');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ['Poster', 'Brochure', 'Website', 'Domain', 'Server'];
  });
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [activeLineItemIdx, setActiveLineItemIdx] = useState(0);

  const [lineItems, setLineItems] = useState([
    { description: 'Poster', quantity: 1.00, unitPrice: 0.00, amount: 0.00 }
  ]);

  const handleAddLineItemOption = (idx) => {
    const currentDesc = (lineItems[idx]?.description || '').trim();
    if (currentDesc && currentDesc !== 'Custom Item' && !itemOptions.includes(currentDesc)) {
      const updated = [...itemOptions, currentDesc];
      setItemOptions(updated);
      localStorage.setItem('crm_item_options', JSON.stringify(updated));
      showToast(`Added '${currentDesc}' to dropdown choices!`, 'success');
    } else {
      setActiveLineItemIdx(idx);
      setIsAddItemModalOpen(true);
    }
  };

  // Tax & GST Configurations
  const [taxOption, setTaxOption] = useState('Exclusive GST');
  const [gstCategory, setGstCategory] = useState('CGST_SGST');
  const [gstRate, setGstRate] = useState(18);

  // Financial Summary Fields
  const [discountRate, setDiscountRate] = useState(0);
  const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'amount'
  const [tdsAmount, setTdsAmount] = useState(0);
  const [adjustment, setAdjustment] = useState(0);

  // Notes & Terms
  const [notes, setNotes] = useState('Thanks for your business.');
  const [terms, setTerms] = useState('Payment due within 15 days.');

  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
    };
  };

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const res = await getClients({ limit: 1000 });
        let list = [];
        if (res && res.success && res.data && Array.isArray(res.data.clients)) {
          list = res.data.clients;
        } else if (res && res.success && Array.isArray(res.data)) {
          list = res.data;
        } else if (Array.isArray(res)) {
          list = res;
        }
        setClients(list);
      } catch (err) {
        console.error('Error fetching clients for invoice page:', err);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const studentMap = new Map();

        // 1. Fetch Academy Enrollments
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
        } catch (e) {
          console.warn('Enrollments fetch warning:', e);
        }

        // 2. Fetch Users (/users) - strictly filter for students only
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
                // Strictly match students only (role contains student, department contains academy/lms, or has studentId)
                if (name && (uRole.includes('student') || uDept.includes('academy') || uDept.includes('lms') || Boolean(u.studentId))) {
                  if (!studentMap.has(name.toLowerCase())) {
                    studentMap.set(name.toLowerCase(), { id: uId, name, code, course: u.course || '' });
                  }
                }
              });
            }
          }
        } catch (e) {
          console.warn('Users fetch warning:', e);
        }

        let studentList = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        // If no student records found in DB yet, provide fallback active student profiles
        if (studentList.length === 0) {
          studentList = [
            { id: 'STU1001', name: 'Alex Johnson', code: 'STU1001', course: 'Full Stack Development' },
            { id: 'STU1002', name: 'Rahul Sharma', code: 'STU1002', course: 'UI/UX Design Masterclass' },
            { id: 'STU1003', name: 'Ananya Verma', code: 'STU1003', course: 'Data Science & AI' }
          ];
        }

        setStudents(studentList);
      } catch (err) {
        console.error('Error fetching all students for Academy invoice:', err);
        setStudents([
          { id: 'STU1001', name: 'Alex Johnson', code: 'STU1001', course: 'Full Stack Development' },
          { id: 'STU1002', name: 'Rahul Sharma', code: 'STU1002', course: 'UI/UX Design Masterclass' }
        ]);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    const populateForm = (rec) => {
      if (!rec) return;
      setEditingId(rec._id);
      setSourceType(rec.sourceType || 'Client');
      setStatus(rec.status || 'Pending');
      setClientName(rec.clientName || rec.title || '');
      if (rec.client) {
        setSelectedClientId(typeof rec.client === 'object' ? (rec.client._id || rec.client.id) : rec.client);
      }
      setReferenceNo(rec.referenceNo || '');
      if (rec.date) setDate(new Date(rec.date).toISOString().split('T')[0]);
      if (rec.dueDate) setDueDate(new Date(rec.dueDate).toISOString().split('T')[0]);
      setSalesperson(rec.salesperson || '');
      setSubject(rec.subject || rec.title || '');
      setDepartment(rec.department || 'Sales & CRM');
      setPaymentMethod(rec.paymentMethod || 'Bank Transfer');
      setTaxOption(rec.taxOption || 'Exclusive GST');
      setGstCategory(rec.gstCategory || 'CGST_SGST');
      setGstRate(rec.gstRate !== undefined ? rec.gstRate : 18);
      setDiscountRate(rec.discountRate || 0);

      const numGst = parseFloat(rec.gstRate || 0);
      const isExclusive = (rec.taxOption || 'Exclusive GST') === 'Exclusive GST';

      let recBaseAmt = parseFloat(rec.amount !== undefined && rec.amount !== null && !isNaN(rec.amount) && parseFloat(rec.amount) > 0 ? rec.amount : 0);
      const recTotalAmt = parseFloat(rec.totalAmount !== undefined && rec.totalAmount !== null ? rec.totalAmount : 0);

      if (recBaseAmt <= 0 && recTotalAmt > 0) {
        recBaseAmt = isExclusive && numGst > 0 ? (recTotalAmt / (1 + numGst / 100)) : recTotalAmt;
      }

      if (Array.isArray(rec.lineItems) && rec.lineItems.length > 0) {
        const sanitizedItems = rec.lineItems.map((item) => {
          const qty = parseFloat(item.quantity || 1);
          let unitP = item.unitPrice !== undefined && item.unitPrice !== null && !isNaN(parseFloat(item.unitPrice)) && parseFloat(item.unitPrice) > 0
            ? parseFloat(item.unitPrice)
            : (item.amount !== undefined && item.amount !== null && !isNaN(parseFloat(item.amount)) && parseFloat(item.amount) > 0
              ? parseFloat(item.amount) / qty
              : recBaseAmt / rec.lineItems.length / qty);

          const amt = qty * unitP;
          return {
            description: item.description || rec.title || 'Professional Services',
            quantity: qty,
            unitPrice: unitP,
            amount: amt
          };
        });
        setLineItems(sanitizedItems);
      } else {
        setLineItems([{ description: rec.title || 'Professional Services', quantity: 1.00, unitPrice: recBaseAmt, amount: recBaseAmt }]);
      }

      if (rec.notes) {
        setNotes(rec.notes);
        setReceiptNotes(rec.notes);
      }
      if (rec.terms) setTerms(rec.terms);
      if (rec.receiptNo) setReceiptNo(rec.receiptNo);
      if (rec.receiptDate) setReceiptDate(new Date(rec.receiptDate).toISOString().split('T')[0]);

      const recPaid = parseFloat(rec.receiptAmount || 0);
      setReceiptAmount((rec.status === 'Paid' || rec.status === 'Partially Paid') && recPaid > 0 ? recPaid : 0);
    };

    if (editRecordFromState) {
      populateForm(editRecordFromState);
    } else if (editIdFromParam) {
      const fetchInvoiceForEdit = async () => {
        try {
          const res = await fetch(getApiEndpoint(`/accounts/income/${editIdFromParam}`), {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success && data.data) {
            populateForm(data.data);
          }
        } catch (err) {
          console.error('Error fetching invoice for edit:', err);
        }
      };
      fetchInvoiceForEdit();
    }
  }, [editRecordFromState, editIdFromParam]);

  const handleMarkAsPaid = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setStatus('Paid');
    let autoRecNo = receiptNo;
    if (!autoRecNo) {
      const prefix = sourceType === 'Client' ? 'REC-KB-C' : sourceType === 'Academy' ? 'REC-KB-A' : 'REC-KB-G';
      const idSuffix = editingId ? String(editingId).slice(-4).toUpperCase() : '1001';
      autoRecNo = `${prefix}${idSuffix}`;
      setReceiptNo(autoRecNo);
    }
    if (!receiptDate) {
      setReceiptDate(new Date().toISOString().split('T')[0]);
    }
    setIsPreviewModalOpen(true);
    showToast('Invoice marked as Paid! Opening Payment Receipt modal...', 'success');
  };

  const handleAutoGenerateReceipt = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    let nameStr = clientName.trim();
    if (!nameStr) {
      if (sourceType === 'Client' && clients.length > 0) {
        nameStr = clients[0].clientName || clients[0].companyName || 'Client';
        setClientName(nameStr);
        if (clients[0]._id) setSelectedClientId(clients[0]._id);
      } else if (sourceType === 'Academy' && students.length > 0) {
        nameStr = students[0].name || 'Student';
        setClientName(nameStr);
      }
    }

    let autoRecNo = receiptNo;
    if (!autoRecNo) {
      const prefix = sourceType === 'Client' ? 'REC-KB-C' : sourceType === 'Academy' ? 'REC-KB-A' : 'REC-KB-G';
      const idSuffix = editingId ? String(editingId).slice(-4).toUpperCase() : `${1001 + Math.floor(Math.random() * 900)}`;
      autoRecNo = `${prefix}${idSuffix}`;
      setReceiptNo(autoRecNo);
    }

    if (!receiptDate) {
      setReceiptDate(new Date().toISOString().split('T')[0]);
    }

    const numPaid = receiptAmount > 0 ? receiptAmount : grandTotal;
    setReceiptAmount(numPaid);

    const isPartial = numPaid > 0 && grandTotal > 0 && numPaid < (grandTotal - 0.01);
    setStatus(isPartial ? 'Partially Paid' : 'Paid');
    setIsPreviewModalOpen(true);

    showToast('Auto-fetched invoice details & generated Payment Receipt!', 'success');
  };

  const handleSourceTypeChange = (type) => {
    setSourceType(type);
    if (type === 'Academy') {
      setSelectedClientId('');
      setDepartment('Academy & LMS');
      setLineItems([{ description: 'Course Program Fee', quantity: 1.00, unitPrice: 0.00, amount: 0.00 }]);
      if (students.length > 0) {
        const first = students[0];
        setSelectedStudentId(first.id);
        setClientName(first.name);
      } else {
        setSelectedStudentId('');
        setClientName('');
      }
    } else if (type === 'Client') {
      setSelectedStudentId('');
      setDepartment('Sales & CRM');
      if (clients.length > 0) {
        const first = clients[0];
        const cId = first._id || first.id;
        const nameStr = first.companyName || first.clientName || first.name || 'Client';
        setSelectedClientId(cId);
        setClientName(nameStr);
      }
    } else {
      setSelectedClientId('');
      setSelectedStudentId('');
      setClientName('');
      setDepartment('General');
      setLineItems([{ description: 'General Financial Services', quantity: 1.00, unitPrice: 0.00, amount: 0.00 }]);
    }
  };

  const handleClientSelect = (e) => {
    const cId = e.target.value;
    setSelectedClientId(cId);
    const found = clients.find(c => (c._id || c.id) === cId);
    if (found) {
      setClientName(found.companyName || found.clientName || found.name || 'Client');
    }
  };

  const handleStudentSelect = (e) => {
    const sId = e.target.value;
    setSelectedStudentId(sId);
    const found = students.find(s => s.id === sId);
    if (found) {
      setClientName(found.name);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };
    const q = parseFloat(item.quantity || 0);
    const u = parseFloat(item.unitPrice || 0);
    item.amount = q * u;
    updated[index] = item;
    setLineItems(updated);
  };

  const addLineItemRow = () => {
    setLineItems([...lineItems, { description: '', quantity: 1.00, unitPrice: 0.00, amount: 0.00 }]);
  };

  const removeLineItemRow = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotalBase = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const numGstRate = parseFloat(gstRate) || 0;

  const calcTax = () => {
    if (taxOption === 'No GST' || numGstRate <= 0) {
      return { gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
    }
    let gstAmt = (subtotalBase * numGstRate) / 100;
    let cgst = 0, sgst = 0, igst = 0;
    if (gstCategory === 'CGST_SGST') {
      cgst = gstAmt / 2;
      sgst = gstAmt / 2;
    } else {
      igst = gstAmt;
    }
    return { gstAmount: gstAmt, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst };
  };

  const taxCalc = calcTax();
  const totalBeforeDiscount = subtotalBase + taxCalc.gstAmount;

  const discVal = parseFloat(discountRate) || 0;
  const calcDiscount = discountType === 'percent'
    ? (totalBeforeDiscount * discVal) / 100
    : discVal;

  const grandTotal = Math.max(0, totalBeforeDiscount - calcDiscount);

  const handleSubmitInvoice = async (e, overrideStatus = null) => {
    if (e && e.preventDefault) e.preventDefault();

    let targetStatus = overrideStatus || status;
    let finalRecAmt = parseFloat(receiptAmount || 0);

    if (targetStatus === 'Paid') {
      finalRecAmt = grandTotal;
    } else if (targetStatus === 'Pending') {
      finalRecAmt = 0;
    }

    if (finalRecAmt <= 0) {
      targetStatus = 'Pending';
    } else if (finalRecAmt >= (grandTotal - 0.01) && grandTotal > 0) {
      targetStatus = 'Paid';
    } else {
      targetStatus = 'Partially Paid';
    }
    const finalAmountToRecord = grandTotal > 0 ? grandTotal : (subtotalBase > 0 ? subtotalBase : 0);

    if (finalAmountToRecord <= 0) {
      showToast('Please enter item details and valid price amounts.', 'warning');
      return;
    }

    const firstLineDesc = lineItems.find(i => i && i.description && i.description.trim())?.description?.trim();

    const titleStr = firstLineDesc || (sourceType === 'Client' 
      ? `Invoice - ${clientName || 'Client'}`
      : sourceType === 'Academy'
      ? 'Academy Fee Invoice'
      : subject.trim() || 'General Invoice');

    try {
      setSubmitting(true);
      const payload = {
        title: titleStr,
        amount: subtotalBase,
        department,
        paymentMethod,
        date,
        dueDate,
        salesperson: salesperson.trim(),
        subject: subject.trim(),
        referenceNo: referenceNo.trim(),
        description: subject.trim(),
        sourceType,
        client: selectedClientId || null,
        clientName: clientName.trim(),
        taxOption,
        gstCategory,
        gstRate: parseFloat(gstRate || 0),
        gstAmount: taxCalc.gstAmount,
        cgstAmount: taxCalc.cgstAmount,
        sgstAmount: taxCalc.sgstAmount,
        igstAmount: taxCalc.igstAmount,
        discountRate: parseFloat(discountRate || 0),
        discountType,
        discountAmount: calcDiscount,
        tdsAmount: parseFloat(tdsAmount || 0),
        adjustment: parseFloat(adjustment || 0),
        totalAmount: grandTotal,
        receiptAmount: finalRecAmt,
        status: targetStatus,
        lineItems: lineItems.map((item) => ({
          description: item.description || titleStr || 'Professional Services',
          quantity: parseFloat(item.quantity || 1),
          unitPrice: parseFloat(item.unitPrice || 0),
          amount: parseFloat(item.amount || 0)
        })),
        notes: notes.trim(),
        terms: terms.trim()
      };

      const endpoint = editingId ? `/accounts/income/${editingId}` : '/accounts/income';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(getApiEndpoint(endpoint), {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          targetStatus === 'Paid'
            ? `Invoice ${data.data?.referenceNo || referenceNo || ''} marked as Paid! Payment Receipt generated.`
            : `Invoice ${data.data?.referenceNo || referenceNo || 'record'} ${editingId ? 'updated' : 'saved'} successfully!`,
          'success'
        );
        navigate('/accounts/income');
      } else {
        showToast(data.message || `Failed to ${editingId ? 'update' : 'create'} invoice.`, 'error');
      }
    } catch (err) {
      console.error('Error submitting Zoho invoice form:', err);
      showToast('An error occurred while saving invoice.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 font-sans text-[11px]">
      {/* Sleek Compact Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-xl p-2.5 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/accounts/income')}
            className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Back to Income List"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <h2 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              {editingId ? `Edit Invoice (${referenceNo || 'Record'})` : 'New Invoice'}
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                {sourceType}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate('/accounts/income')}
            className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 transition cursor-pointer text-[11px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitInvoice}
            disabled={submitting}
            className="px-3.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            {submitting ? <Loader2 className="animate-spin" size={12} /> : <FileText size={12} />}
            <span>{submitting ? 'Saving...' : (editingId ? 'Update Invoice' : (status === 'Paid' ? 'Save & Issue Invoice' : 'Save Invoice'))}</span>
          </button>
        </div>
      </div>

      {/* Main Compact Zoho Form Card */}
      <form onSubmit={handleSubmitInvoice} className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs space-y-3.5">
        {/* Category & Status Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold uppercase text-slate-400">Category:</span>
            <button
              type="button"
              onClick={() => handleSourceTypeChange('Client')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                sourceType === 'Client'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users size={12} /> Clients
            </button>
            <button
              type="button"
              onClick={() => handleSourceTypeChange('Academy')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                sourceType === 'Academy'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <GraduationCap size={12} /> Academy
            </button>
            <button
              type="button"
              onClick={() => handleSourceTypeChange('General')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                sourceType === 'General'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Coins size={12} /> General
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold uppercase text-slate-400">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-0.5 text-[11px] font-bold cursor-pointer"
            >
              <option value="Paid">Paid (Generates Receipt)</option>
              <option value="Pending">Pending</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Compact Field Group 1: Customer Name & Invoice# */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 mb-0.5">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            {sourceType === 'Client' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setSelectedClientId(cId);
                    const found = clients.find(c => (c._id || c.id) === cId);
                    if (found) {
                      const nameStr = found.companyName || found.clientName || found.name || '';
                      setClientName(nameStr);
                    }
                  }}
                  className="w-full bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1 text-[11px] font-extrabold text-indigo-950 dark:text-indigo-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Client --</option>
                  {loadingClients ? (
                    <option disabled>Loading clients list...</option>
                  ) : (
                    clients.map((c) => {
                      const cId = c._id || c.id;
                      const company = c.companyName || '';
                      const person = c.clientName || c.contactPerson || c.name || '';
                      const label = company && person && company !== person ? `🏢 ${company} (${person})` : `🏢 ${company || person || c.email || 'Client'}`;
                      return (
                        <option key={cId} value={cId}>
                          {label}
                        </option>
                      );
                    })
                  )}
                </select>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Or enter custom name..."
                  className="w-full bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
              </div>
            ) : sourceType === 'Academy' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg px-2.5 py-1 text-[11px] font-extrabold text-purple-950 dark:text-purple-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Academy Student --</option>
                  {loadingStudents ? (
                    <option disabled>Loading students list...</option>
                  ) : (
                    students.map((s) => (
                      <option key={s.id} value={s.name}>
                        🎓 {s.name} {s.code ? `(${s.code})` : ''} {s.course ? `— ${s.course}` : ''}
                      </option>
                    ))
                  )}
                </select>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Or enter Student Name..."
                  className="w-full bg-purple-50/30 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
              </div>
            ) : (
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter Customer Name"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">
              Invoice# <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Auto-generated (e.g. INV-000003)"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold focus:outline-none"
            />
          </div>
        </div>

        {/* Single Row 3-Column Grid: Invoice Date, Due Date, Salesperson */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">Invoice Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">Salesperson</label>
            <input
              type="text"
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              placeholder="Salesperson / Account Manager"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none"
            />
          </div>
        </div>

        {/* Subject Input */}
        <div>
          <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Let your customer know what this Invoice is for"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none"
          />
        </div>

        {/* Compact Item Table */}
        <div className="space-y-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Item Table
            </span>
            <button
              type="button"
              onClick={addLineItemRow}
              className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold cursor-pointer flex items-center gap-1 border border-indigo-200/60 dark:border-indigo-800/60"
            >
              <Plus size={11} /> Add Line Item
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 font-bold uppercase text-[9px]">
                <tr>
                  <th className="p-1.5">{sourceType === 'Academy' ? 'Course / Fee Details' : 'Item Details'}</th>
                  {sourceType !== 'Academy' && <th className="p-1.5 w-20 text-center">Quantity</th>}
                  <th className="p-1.5 w-28 text-right">{sourceType === 'Academy' ? 'Course Fee (₹)' : 'Rate'}</th>
                  <th className="p-1.5 w-28 text-right">Amount (₹)</th>
                  <th className="p-1.5 w-7 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-1">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={item.description || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__MANAGE_DELETE__') {
                              setActiveLineItemIdx(idx);
                              setIsAddItemModalOpen(true);
                              return;
                            }
                            handleItemChange(idx, 'description', val);
                          }}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-[11px] font-semibold outline-none cursor-pointer flex-1 min-w-[130px]"
                        >
                          <option value="">Select Item / Service...</option>
                          {itemOptions.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                          {item.description && !itemOptions.includes(item.description) && (
                            <option value={item.description}>{item.description} (Custom Item)</option>
                          )}
                          <option value="__MANAGE_DELETE__">⚙️ Manage / Add / Delete Dropdown Options...</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleAddLineItemOption(idx)}
                          className="p-1 px-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800 transition cursor-pointer shrink-0 flex items-center gap-1 font-bold text-[10px]"
                          title="Add item option to dropdown choices"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </td>
                    {sourceType !== 'Academy' && (
                      <td className="p-1 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.quantity !== undefined && item.quantity !== null ? Math.round(item.quantity) : 1}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-1 py-1 text-[11px] font-bold text-center focus:outline-none"
                        />
                      </td>
                    )}
                    <td className="p-1 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.unitPrice !== undefined && item.unitPrice !== null ? (item.unitPrice === 0 ? 0 : Math.round(item.unitPrice)) : ''}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-[11px] font-bold text-right focus:outline-none"
                      />
                    </td>
                    <td className="p-1 text-right font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                      {Math.round(parseFloat(item.amount) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-1 text-center">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItemRow(idx)}
                          className="p-0.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes & Compact Summary Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-2">
            <div>
              <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                Customer Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thanks for your business."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-[11px] font-semibold focus:outline-none resize-none"
              />
              <p className="text-[9px] text-slate-400 mt-0.5">Will be displayed on the invoice</p>
            </div>

            <div>
              <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                Terms & Conditions
              </label>
              <textarea
                rows={2}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Enter business terms & conditions..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-[11px] font-semibold focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="font-semibold">Subtotal Base:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">₹{Math.round(subtotalBase).toLocaleString('en-IN')}</span>
            </div>

            <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <select
                  value={taxOption === 'No GST' ? 'No GST' : 'Inclusive GST'}
                  onChange={(e) => setTaxOption(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 py-0.5 text-[11px] font-semibold cursor-pointer"
                >
                  <option value="Inclusive GST">Apply GST Tax</option>
                  <option value="No GST">No GST (0%)</option>
                </select>

                {taxOption !== 'No GST' && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <select
                      value={gstCategory}
                      onChange={(e) => setGstCategory(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 py-0.5 text-[11px] font-semibold cursor-pointer"
                    >
                      <option value="CGST_SGST">CGST + SGST</option>
                      <option value="IGST">IGST</option>
                    </select>

                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-md px-1.5 py-0.5 shadow-2xs">
                      <span className="text-[9px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">GST Rate:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={gstRate}
                        onChange={(e) => setGstRate(e.target.value)}
                        placeholder="18"
                        className="w-12 bg-transparent text-[11px] font-black text-right text-indigo-600 dark:text-indigo-400 focus:outline-none"
                      />
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-[10px]">%</span>
                    </div>
                  </div>
                )}
              </div>

              {taxOption !== 'No GST' && taxCalc.gstAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-600 font-semibold text-[10px] pt-0.5">
                  <span>
                    {gstCategory === 'CGST_SGST'
                      ? `CGST (${(numGstRate / 2).toFixed(1)}%) + SGST (${(numGstRate / 2).toFixed(1)}%)`
                      : `IGST (${numGstRate}%)`}
                  </span>
                  <span>+ ₹{Math.round(taxCalc.gstAmount).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold border-t border-slate-200/60 dark:border-slate-800 pt-1">
              <span>Total:</span>
              <span>₹{Math.round(totalBeforeDiscount).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 gap-2">
              <span className="font-semibold shrink-0 text-rose-600 dark:text-rose-400">- Discount</span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value)}
                  placeholder="0"
                  className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-right focus:outline-none"
                />
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-1 py-0.5 text-[10px] font-extrabold cursor-pointer text-slate-700 dark:text-slate-200 outline-none"
                  title="Select Discount Type (Percentage % or Amount ₹)"
                >
                  <option value="percent">% (%)</option>
                  <option value="amount">₹ (₹)</option>
                </select>
                <span className="font-bold text-rose-600 dark:text-rose-400 w-16 text-right">- ₹{Math.round(calcDiscount).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex justify-between items-center border-t-2 border-slate-300 dark:border-slate-700 pt-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
              <span className="uppercase tracking-wider">Total Payable (Incl. GST):</span>
              <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Payment Receipt Details Card (Auto-Generated & Editable) */}
        {status === 'Paid' && (
          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-emerald-200/80 dark:border-emerald-800/80 pb-2 flex-wrap gap-2">
              <h3 className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Receipt size={14} className="text-emerald-600 dark:text-emerald-400" />
                Receipt Voucher Details (Auto-Generated & Editable)
              </h3>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Preview & View Receipt Voucher Document"
              >
                <Eye size={13} /> View / Print Receipt Voucher
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 mb-0.5">
                  Receipt No <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={receiptNo || (sourceType === 'Client' ? 'REC-KB-C1001' : sourceType === 'Academy' ? 'REC-KB-A1001' : 'REC-KB-G1001')}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="e.g. REC-KB-C1001"
                  className="w-full bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 mb-0.5">
                  Receipt Date
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 mb-0.5">
                  Amount Received (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={receiptAmount || grandTotal || subtotalBase || 0}
                  onChange={(e) => setReceiptAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 mb-0.5">
                  Way of Income (Payment Mode)
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 mb-0.5">
                  Receipt Remarks / Notes
                </label>
                <input
                  type="text"
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  placeholder="e.g. Received via Bank Transfer"
                  className="w-full bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Action Bar */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/accounts/income')}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 transition cursor-pointer text-[11px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitInvoice}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="animate-spin" size={13} /> : <FileText size={13} />}
            <span>{submitting ? 'Saving...' : (editingId ? 'Update Invoice' : (status === 'Paid' ? 'Save & Issue Invoice' : 'Save Invoice'))}</span>
          </button>
        </div>
      </form>

      {/* Live Income / Receipt View & Edit Modal */}
      {isPreviewModalOpen && (
        <IncomeInvoiceModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          incomeRecord={{
            _id: editingId || 'PREVIEW',
            title: (lineItems.find(i => i && i.description && i.description.trim())?.description?.trim()) || (sourceType === 'Client' ? `Invoice - ${clientName}` : subject.trim() || 'Invoice Services'),
            amount: subtotalBase,
            department,
            paymentMethod,
            date,
            dueDate,
            salesperson: salesperson.trim(),
            subject: subject.trim(),
            referenceNo: referenceNo.trim(),
            sourceType,
            clientName: clientName.trim(),
            taxOption,
            gstCategory,
            gstRate: parseFloat(gstRate || 0),
            gstAmount: taxCalc.gstAmount,
            cgstAmount: taxCalc.cgstAmount,
            sgstAmount: taxCalc.sgstAmount,
            igstAmount: taxCalc.igstAmount,
            totalAmount: grandTotal,
            receiptAmount: receiptAmount > 0 ? receiptAmount : grandTotal,
            status: (receiptAmount > 0 && receiptAmount < grandTotal) ? 'Partially Paid' : 'Paid',
            receiptNo: receiptNo || (sourceType === 'Client' ? 'REC-KB-C1001' : sourceType === 'Academy' ? 'REC-KB-A1001' : 'REC-KB-G1001'),
            receiptDate: receiptDate || date,
            lineItems,
            notes: receiptNotes || notes,
            terms
          }}
          initialMode="receipt"
          showToast={showToast}
          onSaveTransient={(updatedFields) => {
            if (updatedFields.status) setStatus(updatedFields.status);
            if (updatedFields.receiptNo) setReceiptNo(updatedFields.receiptNo);
            if (updatedFields.receiptDate) setReceiptDate(updatedFields.receiptDate);
            if (updatedFields.paymentMethod) setPaymentMethod(updatedFields.paymentMethod);
            if (updatedFields.notes) setReceiptNotes(updatedFields.notes);
            if (updatedFields.receiptAmount !== undefined && !isNaN(parseFloat(updatedFields.receiptAmount))) {
              setReceiptAmount(parseFloat(updatedFields.receiptAmount));
            }
          }}
        />
      )}

      <AddItemOptionModal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        itemOptions={itemOptions}
        onUpdateOptions={(opts) => {
          setItemOptions(opts);
          localStorage.setItem('crm_item_options', JSON.stringify(opts));
        }}
        onSelectItem={(itemName) => handleItemChange(activeLineItemIdx, 'description', itemName)}
      />
    </div>
  );
};

export default CreateInvoiceTab;
