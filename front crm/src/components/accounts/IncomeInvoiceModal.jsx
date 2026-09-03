import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, Building2, GraduationCap, Coins, ShieldCheck, FileText, CheckCircle2, Pencil, Loader2, Save, History, Receipt, Plus, User, Trash2, Check } from 'lucide-react';
import { updatePaymentSettlement, deletePaymentSettlement } from '../../services/accountsService';
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'UPI', 'Credit Card', 'Cheque', 'Other'];

const IncomeInvoiceModal = ({ isOpen, onClose, incomeRecord, initialMode = 'invoice', onUpdateSuccess, onSaveTransient, showToast }) => {
  const invoiceRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [viewMode, setViewMode] = useState(initialMode); // 'invoice' or 'receipt'
  const [editReceiptNo, setEditReceiptNo] = useState('');
  const [editReceiptDate, setEditReceiptDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('Bank Transfer');
  const [editNotes, setEditNotes] = useState('');
  const [editAmount, setEditAmount] = useState(0);
  const [isEditingReceipt, setIsEditingReceipt] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Local record & selected settlement state for particular receipt viewing
  const [localRecord, setLocalRecord] = useState(incomeRecord);
  const [selectedSettlement, setSelectedSettlement] = useState(null);

  useEffect(() => {
    setLocalRecord(incomeRecord);
    setSelectedSettlement(null);
  }, [incomeRecord]);

  const currentRecord = localRecord || incomeRecord;

  // Edit / Delete payment log entries state
  const [editingLogId, setEditingLogId] = useState(null);
  const [editLogAmount, setEditLogAmount] = useState('');
  const [editLogMethod, setEditLogMethod] = useState('Bank Transfer');
  const [editLogReceiptNo, setEditLogReceiptNo] = useState('');
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogNotes, setEditLogNotes] = useState('');
  const [savingLogId, setSavingLogId] = useState(null);
  const [deletingLogId, setDeletingLogId] = useState(null);

  const handleStartEditLog = (st) => {
    setEditingLogId(st._id);
    setEditLogAmount(st.amount || 0);
    setEditLogMethod(st.paymentMethod || 'Bank Transfer');
    setEditLogReceiptNo(st.receiptNo || '');
    setEditLogDate(st.receiptDate ? new Date(st.receiptDate).toISOString().split('T')[0] : '');
    setEditLogNotes(st.notes || '');
  };

  const handleSaveLogEdit = async (paymentId) => {
    const recId = currentRecord?._id || incomeRecord?._id;
    if (!recId || !paymentId) return;
    setSavingLogId(paymentId);
    try {
      const payload = {
        amount: Number(editLogAmount || 0),
        paymentMethod: editLogMethod,
        receiptNo: editLogReceiptNo,
        receiptDate: editLogDate,
        notes: editLogNotes
      };
      const res = await updatePaymentSettlement(recId, paymentId, payload);
      if (res.success !== false) {
        const updated = res.data?.data || res.data || res;
        if (updated && (updated._id || updated.payments)) {
          setLocalRecord(updated);
        }
        if (showToast) showToast('Payment log entry updated successfully!', 'success');
        setEditingLogId(null);
        if (onUpdateSuccess) onUpdateSuccess(updated);
      } else {
        if (showToast) showToast(res.message || 'Failed to update payment log entry.', 'error');
      }
    } catch (err) {
      console.error('Error updating payment log:', err);
      if (showToast) showToast(err?.response?.data?.message || 'Error updating payment log entry.', 'error');
    } finally {
      setSavingLogId(null);
    }
  };

  const handleDeleteLog = async (paymentId) => {
    const recId = currentRecord?._id || incomeRecord?._id;
    if (!recId || !paymentId) return;
    if (!window.confirm('Are you sure you want to delete this payment log entry? This will update total collected amount and balance due.')) return;
    setDeletingLogId(paymentId);
    try {
      const res = await deletePaymentSettlement(recId, paymentId);
      if (res.success !== false) {
        const updated = res.data?.data || res.data || res;
        if (updated && (updated._id || updated.payments)) {
          setLocalRecord(updated);
        }
        if (showToast) showToast('Payment log entry deleted successfully!', 'success');
        if (onUpdateSuccess) onUpdateSuccess(updated);
      } else {
        if (showToast) showToast(res.message || 'Failed to delete payment log entry.', 'error');
      }
    } catch (err) {
      console.error('Error deleting payment log:', err);
      if (showToast) showToast(err?.response?.data?.message || 'Error deleting payment log entry.', 'error');
    } finally {
      setDeletingLogId(null);
    }
  };

  useEffect(() => {
    if (incomeRecord) {
      if (isOpen && initialMode) setViewMode(initialMode);
      const rawSourceType = incomeRecord.sourceType || 'General';
      const clientNameStr = incomeRecord.clientName || incomeRecord.client?.name || incomeRecord.client?.companyName || '';
      const titleStr = incomeRecord.title || 'Income Record';

      const resolvedSourceType = (rawSourceType === 'Client' || clientNameStr || incomeRecord.client || titleStr.toLowerCase().includes('client'))
        ? 'Client'
        : (rawSourceType === 'Academy' || incomeRecord.department === 'Academy & LMS' || titleStr.toLowerCase().includes('academy') || titleStr.toLowerCase().includes('lms'))
        ? 'Academy'
        : 'General';

      const mongoIdNum = String(incomeRecord._id || '').slice(-4).toUpperCase() || '1001';
      const defaultRecNo = incomeRecord.receiptNo && incomeRecord.receiptNo.trim()
        ? incomeRecord.receiptNo.trim()
        : (resolvedSourceType === 'Client' ? `REC-KB-C${mongoIdNum}` : resolvedSourceType === 'Academy' ? `REC-KB-A${mongoIdNum}` : `REC-KB-G${mongoIdNum}`);

      setEditReceiptNo(defaultRecNo);
      setEditReceiptDate(
        incomeRecord.receiptDate
          ? new Date(incomeRecord.receiptDate).toISOString().split('T')[0]
          : (incomeRecord.date ? new Date(incomeRecord.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
      );
      setEditPaymentMethod(incomeRecord.paymentMethod || 'Bank Transfer');
      const recPaid = parseFloat(incomeRecord.receiptAmount || 0);
      setEditAmount((incomeRecord.status === 'Paid' || incomeRecord.status === 'Partially Paid') && recPaid > 0 ? recPaid : 0);
    }
  }, [incomeRecord, isOpen, initialMode]);

  if (!isOpen || !incomeRecord) return null;

  const rawSourceType = currentRecord.sourceType || 'General';
  const clientNameStr = currentRecord.clientName || currentRecord.client?.name || currentRecord.client?.companyName || '';
  const titleStr = currentRecord.title || 'Income Record';

  const resolvedSourceType = (rawSourceType === 'Academy' || currentRecord.department === 'Academy & LMS')
    ? 'Academy'
    : (rawSourceType === 'Client' || currentRecord.client || titleStr.toLowerCase().includes('client'))
    ? 'Client'
    : (titleStr.toLowerCase().includes('academy') || titleStr.toLowerCase().includes('lms'))
    ? 'Academy'
    : 'General';

  const {
    title = 'Income Record',
    amount = 0,
    department = 'General',
    paymentMethod = 'Bank Transfer',
    date,
    referenceNo,
    description = '',
    taxOption = 'No GST',
    gstCategory = 'NONE',
    gstRate = 0,
    gstAmount = 0,
    cgstAmount = 0,
    sgstAmount = 0,
    igstAmount = 0,
    discountRate = 0,
    discountAmount = 0,
    discountType = 'percent',
    totalAmount = amount,
    createdByName = 'Accountant',
    status = 'Paid',
    receiptNo,
    receiptDate,
    lineItems = [],
    notes = 'Thank you for your business!',
    terms = 'Payment due within 15 days.'
  } = currentRecord;

  const clientObj = (typeof currentRecord.client === 'object' && currentRecord.client !== null) ? currentRecord.client : {};

  const clientCompanyName = (
    clientObj.companyName ||
    incomeRecord.clientName ||
    (clientObj.clientName && clientObj.clientName !== clientObj.companyName ? clientObj.companyName : '') ||
    title
  ).trim();

  const customerName = (
    clientObj.primaryContact?.name ||
    (clientObj.clientName && clientObj.clientName !== clientCompanyName ? clientObj.clientName : '') ||
    (incomeRecord.clientName && incomeRecord.clientName !== clientCompanyName ? incomeRecord.clientName : '') ||
    ''
  ).trim();

  const clientEmail = (
    clientObj.email ||
    clientObj.primaryContact?.email ||
    ''
  ).trim();

  const clientPhone = (
    clientObj.phone ||
    clientObj.primaryContact?.phone ||
    clientObj.alternativePhone ||
    ''
  ).trim();

  const finalClientName = clientCompanyName;

  // Auto-generate display reference number if blank
  const getInvoiceNumber = () => {
    if (referenceNo && referenceNo.trim()) return referenceNo.trim();
    const mongoIdNum = String(incomeRecord._id || '').slice(-4).toUpperCase() || '1001';
    if (resolvedSourceType === 'Client') return `INV-KB-C${mongoIdNum}`;
    if (resolvedSourceType === 'Academy') return `INV-KB-A${mongoIdNum}`;
    return `INV-KB-G${mongoIdNum}`;
  };

  const invoiceNo = getInvoiceNumber();
  const mongoIdNum = String(incomeRecord._id || '').slice(-4).toUpperCase() || '1001';
  const defaultRecNo = receiptNo && receiptNo.trim()
    ? receiptNo.trim()
    : (resolvedSourceType === 'Client' ? `REC-KB-C${mongoIdNum}` : resolvedSourceType === 'Academy' ? `REC-KB-A${mongoIdNum}` : `REC-KB-G${mongoIdNum}`);
  const recNo = editReceiptNo || defaultRecNo;

  const formattedDate = date ? new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) : new Date().toLocaleDateString('en-IN');

  const formattedReceiptDate = editReceiptDate ? new Date(editReceiptDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) : formattedDate;

  const lineItemsSum = Array.isArray(lineItems) && lineItems.length > 0
    ? lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || (parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || 0)) || 0), 0)
    : 0;

  const rawBaseAmt = parseFloat(amount || 0) > 0 
    ? parseFloat(amount) 
    : (lineItemsSum > 0 ? lineItemsSum : parseFloat(totalAmount || 0));

  const numGstRate = parseFloat(gstRate || 0);
  const baseAmt = rawBaseAmt;

  const calcGstAmt = parseFloat(gstAmount || 0) > 0 
    ? parseFloat(gstAmount) 
    : (taxOption === 'No GST' || !numGstRate ? 0 : (rawBaseAmt * numGstRate) / 100);

  const totalBeforeDiscount = rawBaseAmt + calcGstAmt;

  const calcDiscountAmt = parseFloat(discountAmount || 0) > 0
    ? parseFloat(discountAmount)
    : (parseFloat(discountRate || 0) > 0
      ? (discountType === 'amount' ? parseFloat(discountRate) : (totalBeforeDiscount * parseFloat(discountRate)) / 100)
      : 0);

  const calculatedTotalPayable = Math.max(0, totalBeforeDiscount - calcDiscountAmt);

  const rawLineItems = Array.isArray(lineItems) && lineItems.length > 0 ? lineItems : [];
  const finalLineItems = rawLineItems.length > 0
    ? rawLineItems.map((item, idx) => {
        const qty = parseFloat(item.quantity || 1) || 1;
        const itemAmt = parseFloat(item.amount || 0) > 0 
          ? parseFloat(item.amount) 
          : (parseFloat(item.unitPrice || 0) * qty || baseAmt);
        const itemUnitPrice = parseFloat(item.unitPrice || 0) > 0 
          ? parseFloat(item.unitPrice) 
          : itemAmt / qty;
        return {
          description: item.description && item.description.trim() ? item.description.trim() : (title || `Item #${idx + 1}`),
          quantity: qty,
          unitPrice: itemUnitPrice,
          amount: itemAmt
        };
      })
    : [{ description: title || 'Professional Services', quantity: 1, unitPrice: baseAmt, amount: baseAmt }];

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    setIsEditingReceipt(false);
    setDownloading(true);

    const filename = viewMode === 'receipt' 
      ? `${recNo || 'REC'}_Receipt_Voucher.pdf`
      : `${invoiceNo || 'INV'}_${resolvedSourceType}_Invoice.pdf`;

    try {
      const element = invoiceRef.current;

      const replaceOklch = (cssText) => {
        if (!cssText) return '';
        return cssText
          .replace(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/gi, (match, lStr, cStr, hStr, aStr) => {
            let l = parseFloat(lStr);
            if (lStr.includes('%') || l > 1) l = l / 100;
            let alpha = aStr !== undefined ? parseFloat(aStr) : 1;
            if (l >= 0.85) return alpha < 0.5 ? 'rgba(248, 250, 252, 0.5)' : '#f8fafc';
            if (l >= 0.7) return '#e2e8f0';
            if (l <= 0.35) return '#0f172a';
            if (l <= 0.5) return '#1e293b';
            return '#475569';
          })
          .replace(/oklab\([^)]+\)/gi, '#0f172a')
          .replace(/color-mix\([^)]+\)/gi, '#f8fafc');
      };

      const sanitizeClonedDocStyles = (clonedDoc) => {
        try {
          // 0. Ensure target container in clone has no height or scroll restrictions
          const targetContainer = clonedDoc.querySelector('[data-pdf-container="true"]') || clonedDoc.body;
          if (targetContainer) {
            targetContainer.style.height = 'auto';
            targetContainer.style.maxHeight = 'none';
            targetContainer.style.overflow = 'visible';
            targetContainer.style.padding = '24px';
          }

          // 1. Process inline <style> tags
          const styleElements = clonedDoc.querySelectorAll('style');
          styleElements.forEach((style) => {
            try {
              if (style.textContent) {
                style.textContent = replaceOklch(style.textContent);
              }
            } catch (e) {}
          });

          // 2. Process external <link rel="stylesheet"> tags (convert to clean inline <style> or remove)
          const linkElements = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          linkElements.forEach((link) => {
            try {
              let cssText = '';
              const sheet = Array.from(document.styleSheets).find(s => s.href === link.href || (s.ownerNode && s.ownerNode.href === link.href));
              if (sheet) {
                try {
                  const rules = sheet.cssRules || sheet.rules;
                  if (rules) {
                    cssText = Array.from(rules).map(r => r.cssText).join('\n');
                  }
                } catch (e) {}
              }
              if (cssText) {
                const cleanCss = replaceOklch(cssText);
                const newStyle = clonedDoc.createElement('style');
                newStyle.textContent = cleanCss;
                if (link.parentNode) link.parentNode.replaceChild(newStyle, link);
              } else if (link.parentNode) {
                link.parentNode.removeChild(link);
              }
            } catch (e) {
              if (link.parentNode) link.parentNode.removeChild(link);
            }
          });

          // 3. Process inline style attributes on all elements
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            try {
              const inlineStyle = el.getAttribute('style');
              if (inlineStyle && (inlineStyle.includes('oklab') || inlineStyle.includes('oklch') || inlineStyle.includes('color-mix'))) {
                el.setAttribute('style', replaceOklch(inlineStyle));
              }
            } catch (e) {}
          });
        } catch (e) {}
      };

      const scrollH = element.scrollHeight || element.offsetHeight || 1200;
      const scrollW = element.scrollWidth || element.offsetWidth || 800;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: scrollW,
        windowHeight: scrollH,
        width: scrollW,
        height: scrollH,
        onclone: sanitizeClonedDocStyles
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 5) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename);
      if (showToast) showToast(`Downloaded ${filename} to your system!`, 'success');
    } catch (err) {
      console.warn('Direct jsPDF download failed, trying html2pdf fallback:', err);
      try {
        const element = invoiceRef.current;
        const opt = {
          margin: [5, 5, 5, 5],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            onclone: sanitizeClonedDocStyles
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const html2pdfFunc = typeof html2pdf === 'function' ? html2pdf : (html2pdf.default || window.html2pdf);
        if (typeof html2pdfFunc === 'function') {
          await html2pdfFunc().set(opt).from(element).save();
          if (showToast) showToast(`Downloaded ${filename} to your system!`, 'success');
        } else {
          throw new Error('html2pdf function unavailable');
        }
      } catch (fallbackErr) {
        console.error('All PDF download mechanisms failed:', fallbackErr);
        if (showToast) showToast('Failed to download PDF file.', 'error');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleStartNextSettlement = () => {
    const bal = Math.round(displayBalanceDue);
    if (bal <= 0) {
      if (showToast) showToast('Invoice is already fully settled.', 'info');
      return;
    }

    setSelectedSettlement(null);
    setEditAmount(bal);

    const baseRec = editReceiptNo || defaultRecNo;
    const count = (Array.isArray(incomeRecord?.payments) ? incomeRecord.payments.length : 0) + 1;
    const cleanBaseRec = baseRec.replace(/-\d+$/, '');
    const nextRecNo = `${cleanBaseRec}-${count + 1}`;

    setEditReceiptNo(nextRecNo);
    setEditReceiptDate(new Date().toISOString().split('T')[0]);
    setViewMode('receipt');
    setIsEditingReceipt(true);

    if (showToast) showToast(`Ready to record receipt for remaining balance of ₹${bal.toLocaleString('en-IN')}`, 'info');
  };

  const handleSaveReceipt = async () => {
    const numPaid = parseFloat(editAmount) || 0;
    if (numPaid <= 0) {
      if (showToast) showToast('Please enter a valid amount received.', 'error');
      return;
    }

    const settlementPayload = {
      amount: numPaid,
      receiptNo: editReceiptNo,
      receiptDate: editReceiptDate,
      paymentMethod: editPaymentMethod,
      notes: editNotes
    };

    if (onSaveTransient) {
      onSaveTransient(settlementPayload);
    }

    if (!incomeRecord._id || incomeRecord._id === 'PREVIEW') {
      if (showToast) showToast('Payment Receipt recorded!', 'success');
      setIsEditingReceipt(false);
      return;
    }

    try {
      setSavingReceipt(true);
      const rawToken = localStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` 
      };

      const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
      const getApiEndpoint = (path) => {
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        if (API_BASE.endsWith('/v1')) return `${API_BASE}${cleanPath}`;
        if (API_BASE.endsWith('/api')) return `${API_BASE}/v1${cleanPath}`;
        return `${API_BASE}/api/v1${cleanPath}`;
      };

      const res = await fetch(getApiEndpoint(`/accounts/income/${incomeRecord._id}/payment`), {
        method: 'POST',
        headers,
        body: JSON.stringify(settlementPayload)
      });

      const data = await res.json();
      if (data.success) {
        if (data.data) {
          setLocalRecord(data.data);
        }
        if (showToast) showToast('Payment settlement logged successfully!', 'success');
        setEditAmount(0);
        if (onUpdateSuccess) onUpdateSuccess(data.data);
        setIsEditingReceipt(false);
        setViewMode('logs');
      } else {
        if (showToast) showToast(data.message || 'Failed to record payment settlement.', 'error');
      }
    } catch (err) {
      console.error('Error saving receipt:', err);
      if (showToast) showToast('Error recording payment settlement.', 'error');
    } finally {
      setSavingReceipt(false);
    }
  };

  const displayTotalInvoiceAmt = calculatedTotalPayable;

  const totalSettlementPaid = Array.isArray(currentRecord?.payments) && currentRecord.payments.length > 0
    ? currentRecord.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    : (parseFloat(currentRecord?.receiptAmount || 0) > 0 ? parseFloat(currentRecord.receiptAmount) : 0);

  const displayPaidAmt = totalSettlementPaid;
  const displayBalanceDue = Math.max(0, calculatedTotalPayable - displayPaidAmt);

  const rawEditAmt = parseFloat(editAmount);
  const particularReceiptAmt = selectedSettlement
    ? parseFloat(selectedSettlement.amount || 0)
    : (!isNaN(rawEditAmt) && rawEditAmt > 0 && isEditingReceipt
        ? rawEditAmt
        : (totalSettlementPaid > 0 ? totalSettlementPaid : calculatedTotalPayable));

  const particularRecNo = selectedSettlement?.receiptNo || editReceiptNo || defaultRecNo;
  const particularReceiptDate = selectedSettlement?.receiptDate
    ? new Date(selectedSettlement.receiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : (editReceiptDate ? new Date(editReceiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : formattedDate);
  const particularPaymentMethod = selectedSettlement?.paymentMethod || editPaymentMethod || paymentMethod;
  const particularNotes = selectedSettlement?.notes || editNotes || '';

  const watermarkStampText = displayBalanceDue <= 0.01 
    ? 'PAID' 
    : (displayPaidAmt > 0 ? 'PARTIAL PAYMENT' : 'UNPAID');

  const dynamicStatus = displayBalanceDue <= 0.01
    ? 'Paid'
    : (displayPaidAmt > 0 ? 'Partially Paid' : 'Pending');

  const allSettlementList = Array.isArray(currentRecord?.payments) && currentRecord.payments.length > 0
    ? currentRecord.payments
    : (displayPaidAmt > 0 ? [{
        receiptNo: particularRecNo,
        receiptDate: particularReceiptDate,
        amount: particularReceiptAmt,
        paymentMethod: particularPaymentMethod,
        notes: particularNotes
      }] : []);

  const totalPaymentsCount = allSettlementList.length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 overflow-y-auto">
      <div className="relative z-10 w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header Action Bar (Hidden during Print & PDF export) */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0 gap-2 print:hidden">
          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('invoice')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'invoice'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={13} />
              <span>Invoice</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('receipt')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'receipt'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>Receipt Voucher</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('logs')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'logs'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History size={13} />
              <span>Payment Logs</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {viewMode === 'receipt' && displayBalanceDue > 0.01 && (
              <button
                type="button"
                onClick={handleStartNextSettlement}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Create a new receipt settlement pre-filled with the remaining balance"
              >
                <Plus size={13} />
                <span>Create Receipt for Balance (₹{Math.round(displayBalanceDue).toLocaleString('en-IN')})</span>
              </button>
            )}

            {viewMode === 'receipt' && (
              <button
                type="button"
                onClick={() => setIsEditingReceipt(!isEditingReceipt)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isEditingReceipt
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <Pencil size={13} />
                <span>{isEditingReceipt ? 'Close Editor' : 'Edit Receipt'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download size={14} />
              <span>{downloading ? 'Exporting...' : 'Download PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Editable Receipt Bar inside Modal (Hidden during Print) */}
        {viewMode === 'receipt' && isEditingReceipt && (
          <div className="bg-emerald-50/90 border-b border-emerald-200 p-3.5 shrink-0 space-y-2 print:hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1.5">
                <Pencil size={12} /> Edit Payment Receipt Details
              </span>
              <button
                type="button"
                onClick={handleSaveReceipt}
                disabled={savingReceipt}
                className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {savingReceipt ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
                <span>Save Receipt</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 text-xs">
              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 mb-0.5">Receipt No</label>
                <input
                  type="text"
                  value={editReceiptNo}
                  onChange={(e) => setEditReceiptNo(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 mb-0.5">Receipt Date</label>
                <input
                  type="date"
                  value={editReceiptDate}
                  onChange={(e) => setEditReceiptDate(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer font-medium"
                />
              </div>
              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 mb-0.5">Amount Received (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 font-black text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <div>
                <label className="block text-[9px] font-extrabold uppercase text-amber-800 mb-0.5">Balance Due (₹)</label>
                <div className="w-full bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 font-black text-amber-700">
                  ₹{Math.round(displayBalanceDue).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 mb-0.5">Payment Mode</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-extrabold uppercase text-emerald-800 mb-0.5">Remarks / Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* Printable Document Container */}
        <div className="p-6 overflow-y-auto font-sans" ref={invoiceRef} data-pdf-container="true">
          {/* ─────────────────────────────────────────────────────────────
              VIEW MODE: RECEIPT VOUCHER (CLEAN LIGHT MINIMAL STRUCTURE)
             ───────────────────────────────────────────────────────────── */}
          {viewMode === 'receipt' && (
            <div className="space-y-5 text-slate-800 bg-white p-2 relative flex flex-col min-h-[960px] justify-between">
              {/* Top Document Body */}
              <div className="space-y-5">
                {/* Minimal Top Light Accent Line */}
                <div className="h-0.5 w-full rounded-full mb-3" style={{ backgroundColor: '#cbd5e1' }} />

                {/* Minimal Watermark Status Stamp Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '24px',
                    right: '32px',
                    border: `2.5px solid ${displayBalanceDue === 0 ? '#1e293b' : '#64748b'}`,
                    color: displayBalanceDue === 0 ? '#0f172a' : '#475569',
                    backgroundColor: 'rgba(248, 250, 252, 0.95)',
                    fontSize: '13px',
                    fontWeight: '900',
                    padding: '4px 16px',
                    borderRadius: '6px',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    transform: 'rotate(-8deg)',
                    transformOrigin: 'center center',
                    zIndex: 30,
                    pointerEvents: 'none'
                  }}
                >
                  {watermarkStampText}
                </div>

                {/* Top Header Branding */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-4" style={{ borderColor: '#e2e8f0' }}>
                  <div>
                    <img src="/logo3.png" alt="Logo" className="h-11 w-auto object-contain mb-1" />
                    <h2 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#0f172a' }}>KOD.BRAND TECH PVT LTD</h2>
                    <p className="text-[11px]" style={{ color: '#64748b' }}>Finance & Accounts Division</p>
                    <p className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>GSTIN: 32ABCDE1234F1Z5</p>
                  </div>

                  <div className="sm:text-right space-y-1">
                    <span className="inline-block px-3 py-1 text-[11px] font-bold uppercase rounded tracking-widest border" style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}>
                      RECEIPT VOUCHER
                    </span>
                    <div className="pt-1.5 text-xs space-y-0.5">
                      <p className="font-semibold" style={{ color: '#0f172a' }}>Receipt No: <span className="font-mono font-bold" style={{ color: '#0f172a' }}>#{particularRecNo}</span></p>
                      <p className="text-[11px]" style={{ color: '#64748b' }}>Payment Date: <strong style={{ color: '#0f172a' }}>{particularReceiptDate}</strong></p>
                    </div>
                  </div>
                </div>

                {/* Payer & Payment Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl border space-y-1" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <h4 className="font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5" style={{ color: '#475569' }}>
                      {resolvedSourceType === 'Academy' ? (
                        <>
                          <GraduationCap size={12} style={{ color: '#64748b' }} /> Payment Received From (Student)
                        </>
                      ) : (
                        <>
                          <Building2 size={12} style={{ color: '#64748b' }} /> Payment Received From
                        </>
                      )}
                    </h4>
                    <p className="font-bold text-sm" style={{ color: '#0f172a' }}>{finalClientName}</p>
                    <p className="text-[11px]" style={{ color: '#475569' }}>Payment Method: <strong style={{ color: '#0f172a' }}>{particularPaymentMethod}</strong></p>
                    <p className="text-[10px]" style={{ color: '#64748b' }}>Invoice Reference: <strong className="font-mono" style={{ color: '#0f172a' }}>{invoiceNo}</strong></p>
                    {particularNotes && (
                      <p className="text-[10.5px] italic pt-1 border-t mt-1" style={{ color: '#475569', borderColor: '#e2e8f0' }}>Notes: "{particularNotes}"</p>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border space-y-1 text-right flex flex-col justify-center" style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Voucher Settlement Amount</span>
                    <span className="text-xl font-extrabold font-mono" style={{ color: '#047857' }}>₹{Math.round(particularReceiptAmt).toLocaleString('en-IN')}</span>
                    <p className="text-[10.5px] border-t pt-1 mt-0.5 flex justify-between" style={{ borderColor: '#e2e8f0', color: '#475569' }}>
                      <span>Total Invoice Paid:</span>
                      <strong className="font-mono font-bold" style={{ color: '#0f172a' }}>₹{Math.round(displayPaidAmt).toLocaleString('en-IN')}</strong>
                    </p>
                    <p className="text-[10.5px] flex justify-between" style={{ color: '#475569' }}>
                      <span>Balance Remaining:</span>
                      <strong className="font-mono font-bold" style={{ color: '#0f172a' }}>₹{Math.round(displayBalanceDue).toLocaleString('en-IN')}</strong>
                    </p>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#cbd5e1', backgroundColor: '#ffffff' }}>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="font-bold uppercase text-[10px] tracking-wider border-b" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }}>
                      <tr>
                        <th className="py-2.5 px-3" style={{ color: '#0f172a' }}>Invoice Number</th>
                        <th className="py-2.5 px-3" style={{ color: '#0f172a' }}>Invoice Date</th>
                        <th className="py-2.5 px-3 text-right" style={{ color: '#0f172a' }}>Net Payable Amount (₹)</th>
                        <th className="py-2.5 px-3 text-right" style={{ color: '#0f172a' }}>Voucher Amount Paid (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-medium" style={{ borderColor: '#e2e8f0' }}>
                      <tr style={{ backgroundColor: '#ffffff' }}>
                        <td className="py-3 px-3 font-mono font-bold" style={{ color: '#0f172a' }}>{invoiceNo}</td>
                        <td className="py-3 px-3" style={{ color: '#475569' }}>{formattedDate}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800" style={{ color: '#0f172a' }}>₹{Math.round(calculatedTotalPayable).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-sm" style={{ color: '#047857' }}>₹{Math.round(particularReceiptAmt).toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Receipt Footer (Anchored to Bottom) */}
              <div className="flex items-center justify-between pt-4 border-t mt-auto" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-center gap-2 font-semibold text-xs" style={{ color: '#64748b' }}>
                  <ShieldCheck size={18} style={{ color: '#64748b' }} />
                  <div>
                    <p className="font-bold" style={{ color: '#0f172a' }}>Official Payment Voucher</p>
                    <p className="text-[10px] font-normal" style={{ color: '#64748b' }}>Thank you for your business.</p>
                  </div>
                </div>
                <div className="text-right text-[10px]" style={{ color: '#64748b' }}>
                  <div className="h-7 mb-0.5 flex items-end justify-end">
                    <span className="font-serif italic font-bold text-xs border-b pb-0.5 px-3" style={{ color: '#0f172a', borderColor: '#cbd5e1' }}>{createdByName || 'Accounts Officer'}</span>
                  </div>
                  <p className="font-bold uppercase tracking-wider text-[9px]" style={{ color: '#0f172a' }}>Authorized Signatory</p>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW MODE: TAX INVOICE (CLEAN LIGHT MINIMAL STRUCTURE)
             ───────────────────────────────────────────────────────────── */}
          {viewMode === 'invoice' && (
            <div className="space-y-5 text-slate-800 bg-white p-2 relative flex flex-col min-h-[960px] justify-between">
              {/* Top Document Body */}
              <div className="space-y-5">
                {/* Minimal Top Light Accent Line */}
                <div className="h-0.5 w-full rounded-full mb-3" style={{ backgroundColor: '#cbd5e1' }} />

                {/* Header Branding & Meta Block */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-4" style={{ borderColor: '#e2e8f0' }}>
                  <div>
                    <img src="/logo3.png" alt="Logo" className="h-12 w-auto object-contain mb-1" />
                    <h2 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#0f172a' }}>KOD.BRAND TECH PVT LTD</h2>
                    <p className="text-[11px]" style={{ color: '#64748b' }}>Enterprise Software & CRM Solutions</p>
                    <p className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>GSTIN: 32ABCDE1234F1Z5 | HSN/SAC: 998314</p>
                  </div>

                  <div className="sm:text-right space-y-1">
                    <span className="inline-block px-3 py-1 text-[11px] font-bold uppercase rounded tracking-widest border" style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}>
                      INVOICE
                    </span>
                    <div className="pt-1.5 text-xs space-y-0.5">
                      <p className="font-semibold" style={{ color: '#0f172a' }}>Invoice No: <span className="font-mono font-bold" style={{ color: '#0f172a' }}>#{invoiceNo}</span></p>
                      <p className="text-[11px]" style={{ color: '#64748b' }}>Issue Date: <strong style={{ color: '#0f172a' }}>{formattedDate}</strong></p>
                      {incomeRecord.dueDate && (
                        <p className="text-[11px]" style={{ color: '#64748b' }}>Due Date: <strong style={{ color: '#0f172a' }}>{new Date(incomeRecord.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Billed To Card */}
                <div className="text-xs">
                  <div className="p-3.5 rounded-xl border space-y-1.5 max-w-lg" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <div className="border-b pb-1" style={{ borderColor: '#e2e8f0' }}>
                      <h4 className="font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5" style={{ color: '#475569' }}>
                        {resolvedSourceType === 'Academy' ? (
                          <>
                            <GraduationCap size={12} style={{ color: '#64748b' }} /> Billed To (Student)
                          </>
                        ) : resolvedSourceType === 'General' ? (
                          <>
                            <User size={12} style={{ color: '#64748b' }} /> Billed To (Payer / Customer)
                          </>
                        ) : (
                          <>
                            <Building2 size={12} style={{ color: '#64748b' }} /> Billed To (Client / Customer)
                          </>
                        )}
                      </h4>
                    </div>
                    
                    {/* 1. Company Name */}
                    <p className="font-bold text-sm tracking-tight" style={{ color: '#0f172a' }}>{clientCompanyName}</p>
                    
                    {/* 2. Customer Name (if any) */}
                    {customerName && customerName.toLowerCase() !== clientCompanyName.toLowerCase() && (
                      <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#334155' }}>
                        <span style={{ color: '#64748b' }}>Contact Person:</span> {customerName}
                      </p>
                    )}

                    {/* 3. Company Email & Phone No (if any) */}
                    {(clientEmail || clientPhone) && (
                      <div className="text-[11px] space-y-0.5 pt-0.5" style={{ color: '#475569' }}>
                        {clientEmail && (
                          <p className="flex items-center gap-1">
                            <span style={{ color: '#64748b' }}>Email:</span> <strong style={{ color: '#0f172a' }}>{clientEmail}</strong>
                          </p>
                        )}
                        {clientPhone && (
                          <p className="flex items-center gap-1">
                            <span style={{ color: '#64748b' }}>Phone:</span> <strong style={{ color: '#0f172a' }}>{clientPhone}</strong>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Subject / Purpose Summary Banner */}
                {(incomeRecord.subject || description) && (
                  <div className="text-xs p-2.5 rounded-xl border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <p className="font-semibold text-xs" style={{ color: '#0f172a' }}>{incomeRecord.subject || description}</p>
                  </div>
                )}

                {/* Itemized Table (Clean Minimal) */}
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#cbd5e1', backgroundColor: '#ffffff' }}>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="font-bold uppercase text-[10px] tracking-wider border-b" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }}>
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10" style={{ color: '#0f172a' }}>#</th>
                        <th className="py-2.5 px-3" style={{ color: '#0f172a' }}>{resolvedSourceType === 'Academy' ? 'Course / Fee Description' : 'Item / Service Description'}</th>
                        {resolvedSourceType !== 'Academy' && (
                          <th className="py-2.5 px-3 text-center w-16" style={{ color: '#0f172a' }}>Qty</th>
                        )}
                        <th className="py-2.5 px-3 text-right w-28" style={{ color: '#0f172a' }}>{resolvedSourceType === 'Academy' ? 'Course Fee (₹)' : 'Unit Price (₹)'}</th>
                        <th className="py-2.5 px-3 text-right w-32" style={{ color: '#0f172a' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-medium" style={{ borderColor: '#e2e8f0' }}>
                      {finalLineItems.map((item, idx) => (
                        <tr key={idx} style={{ backgroundColor: '#ffffff' }}>
                          <td className="py-3 px-3 text-center font-mono" style={{ color: '#64748b' }}>{idx + 1}</td>
                          <td className="py-3 px-3">
                            <strong className="block font-semibold text-xs" style={{ color: '#0f172a' }}>{item.description}</strong>
                          </td>
                          {resolvedSourceType !== 'Academy' && (
                            <td className="py-3 px-3 text-center font-mono" style={{ color: '#334155' }}>{Math.round(item.quantity || 1)}</td>
                          )}
                          <td className="py-3 px-3 text-right font-mono" style={{ color: '#334155' }}>₹{Math.round(parseFloat(item.unitPrice || baseAmt)).toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-xs" style={{ color: '#0f172a' }}>₹{Math.round(parseFloat(item.amount || baseAmt)).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Totals Summary Card */}
                <div className="flex justify-end items-start gap-4 pt-1">
                  {/* Right Summary Box (Light Minimal Clean) */}
                  <div className="w-full sm:w-64 p-3.5 rounded-xl border text-xs space-y-1.5" style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}>
                    <div className="flex justify-between font-semibold" style={{ color: '#475569' }}>
                      <span>Subtotal Base:</span>
                      <span className="font-mono" style={{ color: '#0f172a' }}>₹{Math.round(rawBaseAmt).toLocaleString('en-IN')}</span>
                    </div>

                    {/* Tax Lines Added to Base */}
                    {calcGstAmt > 0 && (
                      <>
                        {gstCategory === 'CGST_SGST' ? (
                          <>
                            <div className="flex justify-between text-[11px]" style={{ color: '#475569' }}>
                              <span>CGST ({(numGstRate / 2)}%):</span>
                              <span className="font-mono" style={{ color: '#0f172a' }}>+ ₹{Math.round(cgstAmount || calcGstAmt / 2).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between text-[11px]" style={{ color: '#475569' }}>
                              <span>SGST ({(numGstRate / 2)}%):</span>
                              <span className="font-mono" style={{ color: '#0f172a' }}>+ ₹{Math.round(sgstAmount || calcGstAmt / 2).toLocaleString('en-IN')}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-[11px]" style={{ color: '#475569' }}>
                            <span>IGST ({numGstRate}%):</span>
                            <span className="font-mono" style={{ color: '#0f172a' }}>+ ₹{Math.round(igstAmount || calcGstAmt).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex justify-between font-bold border-t pt-1" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>
                      <span>Total:</span>
                      <span className="font-mono">₹{Math.round(totalBeforeDiscount).toLocaleString('en-IN')}</span>
                    </div>

                    {calcDiscountAmt > 0 && (
                      <div className="flex justify-between font-semibold pt-0.5" style={{ color: '#dc2626' }}>
                        <span>- Discount {discountRate > 0 ? `(${discountRate}${discountType === 'amount' ? ' ₹' : '%'})` : ''}:</span>
                        <span className="font-mono font-bold">- ₹{Math.round(calcDiscountAmt).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    <div className="flex justify-between border-t pt-2 text-xs font-bold items-center" style={{ borderColor: '#cbd5e1' }}>
                      <span className="uppercase text-[10px] tracking-wider" style={{ color: '#475569' }}>Total Payable (Incl. GST):</span>
                      <span className="text-base font-extrabold font-mono" style={{ color: '#0f172a' }}>₹{Math.round(calculatedTotalPayable).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Container: Borderless Notes & Signatory Footer */}
              <div className="mt-auto space-y-2">
                {/* Notes (Clean, Borderless, Just Above Footer) */}
                {notes && (
                  <p className="text-[10.5px] italic font-medium max-w-xl pb-1" style={{ color: '#64748b' }}>
                    "{notes}"
                  </p>
                )}

                {/* Signatory Footer (Anchored to Bottom) */}
                <div className="border-t pt-4 flex justify-between items-center text-[10px]" style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck size={18} style={{ color: '#64748b' }} />
                    <div>
                      <p className="font-bold" style={{ color: '#0f172a' }}>KOD.BRAND TECH PVT LTD</p>
                      <p className="text-[10px] font-normal" style={{ color: '#64748b' }}>Computer Generated Document. No signature required.</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px]">
                    <div className="h-7 mb-0.5 flex items-end justify-end">
                      <span className="font-serif italic font-bold text-xs border-b pb-0.5 px-3" style={{ color: '#0f172a', borderColor: '#cbd5e1' }}>{createdByName || 'Accounts Officer'}</span>
                    </div>
                    <p className="font-bold uppercase tracking-wider text-[9px]" style={{ color: '#0f172a' }}>Authorized Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'logs' && (
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    Payment Logs & Audit History
                  </h3>
                  <p className="text-xs text-slate-500">Transaction history and audit trail for <strong className="font-mono text-slate-800">{invoiceNo}</strong></p>
                </div>
                <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                  dynamicStatus === 'Paid'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : dynamicStatus === 'Partially Paid'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  Status: {dynamicStatus}
                </span>
              </div>

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Net Payable (Incl. GST)</span>
                  <span className="text-base font-black text-slate-900">₹{Math.round(calculatedTotalPayable).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-600 block">Amount Received</span>
                  <span className="text-base font-black text-emerald-700">₹{Math.round(displayPaidAmt).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <span className="text-[10px] font-extrabold uppercase text-amber-600 block">Balance Due</span>
                  <span className="text-base font-black text-amber-700">₹{Math.round(displayBalanceDue).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-600 block">Settlements Logged</span>
                  <span className="text-base font-black text-indigo-700">{totalPaymentsCount} Logged</span>
                </div>
              </div>

              {/* Timeline Audit Logs */}
              <div className="relative border-l-2 border-indigo-200 ml-4 space-y-6 pt-2">
                {/* Entry 1: Invoice Generation */}
                <div className="relative pl-6">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-100 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">Tax Invoice Created & Saved</span>
                      <span className="text-[11px] text-slate-500">{formattedDate}</span>
                    </div>
                    <p className="text-xs text-slate-600">Reference: <strong className="font-mono text-slate-800">{invoiceNo}</strong> — Net Payable Amount: <strong className="text-indigo-600 font-bold">₹{Math.round(calculatedTotalPayable).toLocaleString('en-IN')}</strong></p>
                    <p className="text-[11px] text-slate-400">Recorded By: {createdByName}</p>
                  </div>
                </div>

                {/* Individual Payment Settlement Entries */}
                {allSettlementList.map((st, idx) => {
                  const isEditingThis = editingLogId === st._id;
                  const isSavingThis = savingLogId === st._id;
                  const isDeletingThis = deletingLogId === st._id;

                  return (
                    <div key={st._id || idx} className="relative pl-6">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-emerald-100 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                          <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Payment Settlement #{idx + 1} Logged
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-emerald-800 font-medium mr-1">
                              {st.receiptDate ? new Date(st.receiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : formattedDate}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSettlement(st);
                                setEditReceiptNo(st.receiptNo || '');
                                if (st.receiptDate) setEditReceiptDate(new Date(st.receiptDate).toISOString().split('T')[0]);
                                setEditPaymentMethod(st.paymentMethod || 'Bank Transfer');
                                setEditAmount(st.amount || 0);
                                setEditNotes(st.notes || '');
                                setIsEditingReceipt(false);
                                setViewMode('receipt');
                              }}
                              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-2xs flex items-center gap-1 transition cursor-pointer"
                              title="View & Download Receipt for this settlement"
                            >
                              <Receipt size={11} />
                              <span>View Receipt</span>
                            </button>

                            {st._id && !isEditingThis && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditLog(st)}
                                  className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shadow-2xs flex items-center gap-1 transition cursor-pointer"
                                  title="Edit this payment settlement"
                                >
                                  <Pencil size={11} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLog(st._id)}
                                  disabled={isDeletingThis}
                                  className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-[10px] shadow-2xs flex items-center gap-1 transition cursor-pointer"
                                  title="Delete this payment settlement"
                                >
                                  {isDeletingThis ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                  <span>Delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditingThis ? (
                          <div className="bg-white p-3 rounded-lg border border-amber-300 space-y-2 mt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Receipt Voucher No</label>
                                <input
                                  value={editLogReceiptNo}
                                  onChange={e => setEditLogReceiptNo(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 outline-none focus:border-amber-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Settlement Amount (₹)</label>
                                <input
                                  type="number"
                                  value={editLogAmount}
                                  onChange={e => setEditLogAmount(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Payment Date</label>
                                <input
                                  type="date"
                                  value={editLogDate}
                                  onChange={e => setEditLogDate(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-900 outline-none focus:border-amber-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Payment Method</label>
                                <select
                                  value={editLogMethod}
                                  onChange={e => setEditLogMethod(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-900 outline-none focus:border-amber-500 font-medium"
                                >
                                  {PAYMENT_METHODS.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Notes / Remarks</label>
                              <input
                                value={editLogNotes}
                                onChange={e => setEditLogNotes(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-900 outline-none focus:border-amber-500"
                                placeholder="Payment notes"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingLogId(null)}
                                className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveLogEdit(st._id)}
                                disabled={isSavingThis}
                                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold transition flex items-center gap-1"
                              >
                                {isSavingThis ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                <span>Save Changes</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-emerald-900 space-y-1 pt-1">
                            <p>Receipt Voucher: <strong className="font-mono">{st.receiptNo || editReceiptNo}</strong></p>
                            <p>Settlement Amount: <strong className="text-emerald-700 font-black text-sm">₹{Math.round(parseFloat(st.amount || 0)).toLocaleString('en-IN')}</strong></p>
                            <p>Payment Mode: <strong>{st.paymentMethod || editPaymentMethod || paymentMethod}</strong></p>
                            {st.notes && <p className="text-[11px] italic text-emerald-800">Notes: "{st.notes}"</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Entry 3: Status Summary Entry */}
                {displayBalanceDue <= 0.01 && displayPaidAmt > 0 ? (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-emerald-100 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5">
                      <div className="flex items-center justify-between text-xs text-emerald-950 font-bold">
                        <span>Invoice Fully Settled (Balance Due: ₹0)</span>
                        <span className="text-emerald-700 font-black">Status: Paid</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">All billed payments have been received and verified.</p>
                    </div>
                  </div>
                ) : displayBalanceDue > 0 && displayPaidAmt > 0 ? (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-amber-500 ring-4 ring-amber-100 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
                      <div className="flex items-center justify-between text-xs text-amber-950 font-bold">
                        <span>Outstanding Balance Remaining</span>
                        <span className="text-amber-800 font-black">₹{Math.round(displayBalanceDue).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-0.5">Status set to Partially Paid. Awaiting final settlement.</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-rose-500 ring-4 ring-rose-100 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                    <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5">
                      <div className="flex items-center justify-between text-xs text-rose-950 font-bold">
                        <span>No Payments Received (Amount Received: ₹0)</span>
                        <span className="text-rose-700 font-black">Status: Pending</span>
                      </div>
                      <p className="text-[11px] text-rose-800 mt-0.5">Payment is pending. Awaiting collection.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default IncomeInvoiceModal;
