import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, FileText, Building2, GraduationCap, Coins, Users, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useToast } from '../ToastProvider';
import AddItemOptionModal from './AddItemOptionModal';
import { getClients } from '../../services/clientService';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const getApiEndpoint = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

const CreateInvoiceModal = ({ isOpen, onClose, onInvoiceCreated, showToast }) => {
  const [sourceType, setSourceType] = useState('Client'); // 'Client', 'Academy', 'General'
  const [status, setStatus] = useState('Paid'); // 'Paid', 'Pending', 'Draft'
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [department, setDepartment] = useState('Sales & CRM');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [referenceNo, setReferenceNo] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('Thank you for your business!');
  const [terms, setTerms] = useState('Payment due within 15 days.');

  // Zoho-Style Line Items (Specific Item Details choices)
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
    { description: 'Poster', quantity: 1, unitPrice: 0, amount: 0 }
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

  // Tax & GST States
  const [taxOption, setTaxOption] = useState('Exclusive GST'); // 'No GST', 'Exclusive GST', 'Inclusive GST'
  const [gstCategory, setGstCategory] = useState('CGST_SGST'); // 'CGST_SGST', 'IGST'
  const [gstRate, setGstRate] = useState(18);
  const [gstRatesList, setGstRatesList] = useState([0, 0.25, 3, 5, 12, 18, 28]);

  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
    };
  };

  // Fetch Clients list
  useEffect(() => {
    if (!isOpen) return;
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
        console.error('Error fetching clients for invoice modal:', err);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Source Category Switch
  const handleSourceTypeChange = (type) => {
    setSourceType(type);
    if (type === 'Academy') {
      setSelectedClientId('');
      setClientName('');
      setDepartment('Academy & LMS');
    } else if (type === 'Client') {
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
      setClientName('');
      setDepartment('General');
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

  // Line Item Grid handlers
  const handleItemChange = (index, field, value) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      const q = parseFloat(item.quantity || 0);
      const u = parseFloat(item.unitPrice || 0);
      item.amount = q * u;
    }
    updated[index] = item;
    setLineItems(updated);
  };

  const addLineItemRow = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const removeLineItemRow = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const [discountRate, setDiscountRate] = useState(0);
  const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'amount'

  // Subtotal Base Amount Calculation
  const subtotalBase = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const discVal = parseFloat(discountRate) || 0;
  const calcDiscount = discountType === 'percent'
    ? (subtotalBase * discVal) / 100
    : discVal;
  const afterDiscountBase = Math.max(0, subtotalBase - calcDiscount);

  // Tax Calculations
  const calcTax = () => {
    if (taxOption === 'No GST' || gstRate <= 0) {
      return { gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalAmount: afterDiscountBase };
    }
    let gstAmt = afterDiscountBase - (afterDiscountBase / (1 + gstRate / 100));
    let totalAmt = afterDiscountBase;

    let cgst = 0, sgst = 0, igst = 0;
    if (gstCategory === 'CGST_SGST') {
      cgst = gstAmt / 2;
      sgst = gstAmt / 2;
    } else {
      igst = gstAmt;
    }
    return { gstAmount: gstAmt, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst, totalAmount: totalAmt };
  };

  const taxCalc = calcTax();

  const handleAddCustomGst = () => {
    const rateStr = prompt('Enter custom GST rate % (e.g. 15):');
    if (!rateStr) return;
    const rateNum = parseFloat(rateStr);
    if (!isNaN(rateNum) && rateNum >= 0) {
      if (!gstRatesList.includes(rateNum)) {
        setGstRatesList([...gstRatesList, rateNum].sort((a, b) => a - b));
      }
      setGstRate(rateNum);
    }
  };

  // Submit Invoice Form
  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    if (subtotalBase <= 0) {
      showToast('Please enter line item descriptions and valid amounts.', 'warning');
      return;
    }

    const firstLineDesc = lineItems.find(i => i && i.description && i.description.trim())?.description?.trim();

    const titleStr = firstLineDesc || (sourceType === 'Client' 
      ? `Invoice - ${clientName || 'Client'}`
      : sourceType === 'Academy'
      ? 'Academy Course & LMS Fee Invoice'
      : 'General Income Invoice');

    try {
      setSubmitting(true);
      const payload = {
        title: titleStr,
        amount: subtotalBase,
        department,
        paymentMethod,
        date,
        dueDate,
        referenceNo: referenceNo.trim(),
        description: description.trim(),
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
        totalAmount: taxCalc.totalAmount,
        status,
        lineItems,
        notes: notes.trim(),
        terms: terms.trim()
      };

      const res = await fetch(getApiEndpoint('/accounts/income'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Invoice ${data.data?.referenceNo || 'record'} created successfully!`, 'success');
        onInvoiceCreated();
        onClose();
      } else {
        showToast(data.message || 'Failed to create invoice.', 'error');
      }
    } catch (err) {
      console.error('Error creating Zoho-style invoice:', err);
      showToast('An error occurred while creating invoice.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 overflow-y-auto">
      <div className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Zoho Invoice & Billing Builder
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  {status}
                </span>
              </h3>
              <p className="text-[11px] font-medium text-slate-400">Create itemized tax invoices & payment receipts</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmitInvoice} className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800 dark:text-slate-200">
          {/* Row 1: Source Category Selector & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                1. Select Invoice Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSourceTypeChange('Client')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    sourceType === 'Client'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Users size={14} /> Clients
                </button>
                <button
                  type="button"
                  onClick={() => handleSourceTypeChange('Academy')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    sourceType === 'Academy'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <GraduationCap size={14} /> Academy / LMS
                </button>
                <button
                  type="button"
                  onClick={() => handleSourceTypeChange('General')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    sourceType === 'General'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Coins size={14} /> General / Other
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Payment Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="Paid">Paid (Generates Payment Receipt)</option>
                <option value="Pending">Pending / Sent</option>
                <option value="Draft">Draft Invoice</option>
              </select>
            </div>
          </div>

          {/* Row 2: Customer Selection & Invoice Reference */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sourceType === 'Client' ? (
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  Select Customer / Client <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedClientId}
                  onChange={handleClientSelect}
                  className="w-full bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Choose Registered Client --</option>
                  {loadingClients ? (
                    <option disabled>Loading clients list...</option>
                  ) : (
                    clients.map((c) => {
                      const cId = c._id || c.id;
                      const company = c.companyName || '';
                      const person = c.clientName || c.contactPerson || c.name || '';
                      const label = company && person && company !== person ? `🏢 ${company} — ${person}` : `🏢 ${company || person || c.email}`;
                      return (
                        <option key={cId} value={cId}>
                          {label}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                  Customer / Payer Name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder={sourceType === 'Academy' ? 'Student Name' : 'General Payer Name'}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                Custom Reference / Invoice No
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Auto-generated (e.g. INV-KB-C1001)"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-semibold focus:outline-none"
              />
            </div>
          </div>

          {/* Row 3: Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Invoice Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Row 4: Zoho Itemized Line Items Table Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Itemized Line Items Table
              </label>
              <button
                type="button"
                onClick={addLineItemRow}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[11px] font-extrabold transition cursor-pointer flex items-center gap-1 border border-indigo-200/60 dark:border-indigo-800/60"
              >
                <Plus size={13} />
                <span>Add Line Item</span>
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">{sourceType === 'Academy' ? 'Course / Fee Details' : 'Item / Service Details'}</th>
                    {sourceType !== 'Academy' && <th className="p-2.5 w-20 text-center">Qty</th>}
                    <th className="p-2.5 w-32 text-right">{sourceType === 'Academy' ? 'Course Fee (₹)' : 'Unit Price (₹)'}</th>
                    <th className="p-2.5 w-36 text-right">Amount (₹)</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                  {lineItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
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
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer flex-1 min-w-[130px]"
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
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800 transition cursor-pointer shrink-0 flex items-center gap-1 font-bold text-[10px]"
                            title="Add item option to dropdown choices"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </td>
                      {sourceType !== 'Academy' && (
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-bold text-center focus:outline-none"
                          />
                        </td>
                      )}
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-right focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-right font-black text-slate-900 dark:text-slate-100">
                        ₹{(parseFloat(item.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center">
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItemRow(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 5: Tax & GST Configuration */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Tax & GST Configuration
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tax Application</label>
                <select
                  value={taxOption === 'No GST' ? 'No GST' : 'Inclusive GST'}
                  onChange={(e) => setTaxOption(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="Inclusive GST">Apply GST Tax</option>
                  <option value="No GST">No GST (0%)</option>
                </select>
              </div>

              {taxOption !== 'No GST' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">GST Category</label>
                    <select
                      value={gstCategory}
                      onChange={(e) => setGstCategory(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="CGST_SGST">CGST + SGST (Intra-State / Same State)</option>
                      <option value="IGST">IGST (Inter-State / Outside State)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">GST Rate (%)</label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={gstRate}
                        onChange={(e) => setGstRate(parseFloat(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
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

            {/* Live Tax Pills */}
            {taxOption !== 'No GST' && taxCalc.gstAmount > 0 && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-3 text-[11px] font-medium text-slate-500 flex-wrap">
                {gstCategory === 'CGST_SGST' ? (
                  <>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
                      CGST ({gstRate / 2}%): ₹{taxCalc.cgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
                      SGST ({gstRate / 2}%): ₹{taxCalc.sgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
                    IGST ({gstRate}%): ₹{taxCalc.igstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Row 6: Summary & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Customer Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Terms & Conditions</label>
                <input
                  type="text"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal Base Amount:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">₹{subtotalBase.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 gap-2">
                <span className="font-semibold shrink-0">Discount:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discountRate}
                    onChange={(e) => setDiscountRate(e.target.value)}
                    placeholder="0"
                    className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 py-0.5 text-xs font-bold text-right focus:outline-none"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-1 py-0.5 text-[10px] font-extrabold cursor-pointer text-slate-700 dark:text-slate-200 outline-none"
                    title="Select Discount Type (Percentage % or Amount ₹)"
                  >
                    <option value="percent">% (Percentage)</option>
                    <option value="amount">₹ (Flat Amount)</option>
                  </select>
                  <span className="font-bold text-slate-700 dark:text-slate-300 min-w-[60px] text-right">- ₹{Math.round(calcDiscount).toLocaleString('en-IN')}</span>
                </div>
              </div>
              {taxCalc.gstAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Total Tax ({taxOption}):</span>
                  <span>+ ₹{taxCalc.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-base font-black text-slate-900 dark:text-slate-100">
                <span>Grand Total (₹):</span>
                <span className="text-indigo-600 dark:text-indigo-400">₹{taxCalc.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Processing Invoice...</span>
                </>
              ) : (
                <>
                  <FileText size={14} />
                  <span>{status === 'Paid' ? 'Save & Issue Invoice' : 'Save Invoice'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

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
    </div>,
    document.body
  );
};

export default CreateInvoiceModal;
