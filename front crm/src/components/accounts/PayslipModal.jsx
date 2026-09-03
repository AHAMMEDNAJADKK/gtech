import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Download, FileText, Pencil, Check, XCircle, Loader2, Mail, Send, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import html2pdf from 'html2pdf.js';
import { updateSalaryPayment, sendSalaryPayslipEmail, deleteSalaryPayment } from '../../services/accountsService';
import { useToast } from '../ToastProvider';
import { useUser } from '../../contexts/UserContext';
import DeletePayslipModal from './DeletePayslipModal';

const PayslipModal = ({ isOpen, onClose, salaryRecord, onSaved, isSmall = false }) => {
  const payslipRef = useRef(null);
  const { showToast } = useToast();
  const { user } = useUser();
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [editMode, setEditMode] = useState(false);

  // ── Role checks for editing capability ─────────────────────
  const role = String(user?.role_id || user?.roleId || user?.role || '').toLowerCase().trim();
  const designation = String(user?.designation || '').toLowerCase().trim();
  const isPrivileged = true; // Always allow editing inside the view modal

  // Holds the current display values (editable)
  const [edited, setEdited] = useState({});
  // Holds the snapshot before editing (for Cancel)
  const [original, setOriginal] = useState({});

  const initValues = (rec) => {
    const rawBasic = Number(rec.basicSalary || 0);
    const rawPaid = Number(rec.paidAmount || 0);
    const hasAllowances = (
      Number(rec.hra || 0) + Number(rec.medicalAllowance || 0) + Number(rec.specialAllowance || 0) +
      Number(rec.transportAllowance || 0) + Number(rec.otherAllowance || 0) + Number(rec.integrityAward || 0) +
      Number(rec.bonus || 0)
    ) > 0;

    // Fallback: If basic salary is not specified separately, set basic equal to paid amount
    const computedBasic = (rawBasic > 0 || hasAllowances) ? rawBasic : rawPaid;

    let computedPayDateStr = rec.payDateStr;
    if (!computedPayDateStr || computedPayDateStr.includes('10th August 2026')) {
      const monthVal = rec.month ? rec.month.trim() : '';
      if (monthVal) {
        const parts = monthVal.split(/\s+/);
        const mName = parts[0] || '';
        const yearStr = parts[1] || new Date().getFullYear();
        computedPayDateStr = `On or Before 10th ${mName} ${yearStr}`;
      } else {
        const d = new Date();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        computedPayDateStr = `On or Before 10th ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
    }

    let computedPayPeriod = rec.payPeriod;
    if (!computedPayPeriod || computedPayPeriod.includes('July 2026')) {
      const monthVal = rec.month ? rec.month.trim() : '';
      if (monthVal) {
        const parts = monthVal.split(/\s+/);
        const mName = parts[0] || '';
        const yearStr = parts[1] || new Date().getFullYear();
        const lastDay = new Date(Number(yearStr) || new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        computedPayPeriod = `01 ${mName} ${yearStr} - ${lastDay} ${mName} ${yearStr}`;
      } else {
        const d = new Date();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const m = monthNames[d.getMonth()];
        const y = d.getFullYear();
        const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
        computedPayPeriod = `01 ${m} ${y} - ${lastDay} ${m} ${y}`;
      }
    }

    const empCode = rec.kbEmployeeId || rec.employee?.employeeId || rec.employee?.kbEmployeeId ||
      (rec.employee?._id ? `KB-EMP-${String(rec.employee._id).slice(-4).toUpperCase()}` : 'KB-EMP-001');

    return {
      empId:              empCode,
      empName:            (rec.employeeName || rec.employee?.name || 'Employee').toUpperCase(),
      designation: (
        rec.designation ||
        rec.employee?.designationName ||
        (typeof rec.employee?.designation === 'string' ? rec.employee.designation : rec.employee?.designation?.name) ||
        'STAFF MEMBER'
      ).toUpperCase(),
      department: (
        rec.department ||
        (typeof rec.employee?.department === 'string' ? rec.employee.department : rec.employee?.department?.name) ||
        rec.employee?.departmentId?.name ||
        rec.employee?.department_name ||
        'GENERAL'
      ).toUpperCase(),
      location:           (rec.location || 'HEAD OFFICE').toUpperCase(),
      month:              rec.month || `${new Date().toLocaleDateString('en-IN', { month: 'long' })} ${new Date().getFullYear()}`,
      payPeriod:          computedPayPeriod,
      payDateStr:         computedPayDateStr,
      workingDays:        rec.workingDays ?? 27,
      daysWorked:         rec.daysWorked ?? (rec.workingDays ? Math.max(0, rec.workingDays - (rec.daysInLeave || 0)) : 27),
      daysInLeave:        rec.daysInLeave ?? (rec.workingDays && rec.daysWorked !== undefined ? Math.max(0, rec.workingDays - rec.daysWorked) : 0),
      basicSalary:        computedBasic,
      hra:                Number(rec.hra || 0),
      medicalAllowance:   Number(rec.medicalAllowance || 0),
      specialAllowance:   Number(rec.specialAllowance || 0),
      transportAllowance: Number(rec.transportAllowance || 0),
      otherAllowance:     Number(rec.otherAllowance || 0),
      integrityAward:     Number(rec.integrityAward || 0),
      bonus:              Number(rec.bonus || 0),
      pf:                 Number(rec.pf || 0),
      professionalTax:    Number(rec.professionalTax || 0),
      incomeTax:          Number(rec.incomeTax || 0),
      unpaidLeave:        Number(rec.unpaidLeave || 0),
      advanceSalary:      Number(rec.advanceSalary || 0),
      otherDeductions:    Number(rec.otherDeductions || 0),
      companyName:        rec.companyName || 'KODBRAND SOLUTIONS',
      companyAddressLine1: rec.companyAddressLine1 || '3rd Floor, Aranyakam Building',
      companyAddressLine2: rec.companyAddressLine2 || 'thamarauzhi road, up hill',
      companyAddressLine3: rec.companyAddressLine3 || 'malappuram, kerala-676505',
      signatoryName:      rec.signatoryName || 'Aoj.',
      signatoryTitle:     rec.signatoryTitle || 'Authorized Signature',
      customNetPay:       rec.customNetPay !== undefined ? rec.customNetPay : undefined,
    };
  };

  useEffect(() => {
    if (salaryRecord) {
      const vals = initValues(salaryRecord);
      setEdited(vals);
      setOriginal(vals);
      setEditMode(false);
      const initialEmail = salaryRecord?.employee?.email || salaryRecord?.email || salaryRecord?.employeeEmail || '';
      setTargetEmail(initialEmail);
    }
  }, [salaryRecord]);

  if (!isOpen || !salaryRecord) return null;

  const set = (key, val) => setEdited(prev => ({ ...prev, [key]: val }));
  const num = (key) => Number(edited[key] || 0);

  const totalEarnings =
    num('basicSalary') + num('hra') + num('medicalAllowance') +
    num('specialAllowance') + num('transportAllowance') + num('otherAllowance') +
    num('integrityAward') + num('bonus');

  const totalDeductions =
    num('pf') + num('professionalTax') + num('incomeTax') +
    num('unpaidLeave') + num('advanceSalary') + num('otherDeductions');

  const calculatedNet = Math.max(0, totalEarnings - totalDeductions);
  const netPay = edited.customNetPay !== undefined && edited.customNetPay !== null && !isNaN(Number(edited.customNetPay)) ? Number(edited.customNetPay) : (calculatedNet > 0 ? calculatedNet : Number(salaryRecord?.paidAmount || 0));

  // ── Save to backend ──────────────────────────────────────────
  const handleSave = async () => {
    if (!salaryRecord._id) {
      showToast('Cannot save: payslip ID missing.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...edited,
        totalEarnings,
        totalDeductions,
        paidAmount: netPay,
        kbEmployeeId: edited.empId,
        employeeName: edited.empName,
        designation: edited.designation,
        department: edited.department,
        location: edited.location,
      };
      const res = await updateSalaryPayment(salaryRecord._id, payload);
      if (res?.success !== false) {
        showToast('Payslip updated successfully!', 'success');
        setOriginal({ ...edited }); // update snapshot to new saved values
        setEditMode(false);
        if (onSaved) onSaved();
      } else {
        showToast(res?.message || 'Failed to update payslip.', 'error');
      }
    } catch (err) {
      console.error('Error saving payslip:', err);
      showToast(err?.response?.data?.message || 'Error saving payslip.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Cancel — restore original values ────────────────────────
  const handleCancel = () => {
    setEdited({ ...original });
    setEditMode(false);
  };

  const handleDelete = async () => {
    if (!salaryRecord?._id) return;
    if (!window.confirm(`Are you sure you want to delete the payslip for ${edited.empName || 'this employee'}? This cannot be undone.`)) return;
    try {
      const res = await deleteSalaryPayment(salaryRecord._id);
      if (res.success) {
        showToast('Payslip deleted successfully!', 'success');
        onClose();
        if (onSaved) onSaved();
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete payslip.', 'error');
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!payslipRef.current) return;
    setDownloading(true);
    const filename = `Payslip_${edited.empName?.replace(/\s+/g, '_')}_${edited.month?.replace(/\s+/g, '_')}.pdf`;
    try {
      const element = payslipRef.current;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const styleElements = clonedDoc.querySelectorAll('style');
          styleElements.forEach((style) => {
            try {
              if (style.textContent) {
                style.textContent = style.textContent
                  .replace(/oklab\([^)]+\)/gi, '#475569')
                  .replace(/oklch\([^)]+\)/gi, '#475569')
                  .replace(/color-mix\([^)]+\)/gi, '#475569');
              }
            } catch (e) {}
          });

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
                const cleanCss = cssText
                  .replace(/oklab\([^)]+\)/gi, '#475569')
                  .replace(/oklch\([^)]+\)/gi, '#475569')
                  .replace(/color-mix\([^)]+\)/gi, '#475569');
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

          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            try {
              const inlineStyle = el.getAttribute('style');
              if (inlineStyle && (inlineStyle.includes('oklab') || inlineStyle.includes('oklch') || inlineStyle.includes('color-mix'))) {
                const cleanedStyle = inlineStyle
                  .replace(/oklab\([^)]+\)/gi, '#475569')
                  .replace(/oklch\([^)]+\)/gi, '#475569')
                  .replace(/color-mix\([^)]+\)/gi, '#475569');
                el.setAttribute('style', cleanedStyle);
              }
            } catch (e) {}
          });
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const margin = 5; // 5mm margin
      const printableWidth = pdfWidth - (margin * 2); // 200mm
      const imgHeight = (canvas.height * printableWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, imgHeight);
      pdf.save(filename);
      if (showToast) showToast(`Downloaded ${filename} to your system!`, 'success');
    } catch (err) {
      console.error('Direct PDF export failed, trying fallback:', err);
      try {
        const opt = {
          margin: [5, 5, 5, 5],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await html2pdf().set(opt).from(payslipRef.current).save();
      } catch (fallbackErr) {
        console.error('All PDF generation failed:', fallbackErr);
        if (showToast) showToast('Error generating PDF.', 'error');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async (emailToUse) => {
    const finalEmail = emailToUse || targetEmail;
    if (!salaryRecord?._id) {
      showToast('Salary payment record ID missing.', 'error');
      return;
    }
    if (!finalEmail || !finalEmail.trim()) {
      showToast('Please provide a valid recipient email address.', 'error');
      return;
    }
    setSendingEmail(true);
    try {
      const payload = {
        email: finalEmail.trim(),
        brevoApiKey: import.meta.env.VITE_BREVO_API_KEY,
        senderEmail: import.meta.env.VITE_EMAIL_SENDER_ADDRESS,
        senderName: import.meta.env.VITE_EMAIL_SENDER_NAME
      };
      const res = await sendSalaryPayslipEmail(salaryRecord._id, payload);
      if (res?.success !== false) {
        showToast(`Payslip email sent successfully to ${finalEmail.trim()}!`, 'success');
        setShowEmailModal(false);
      } else {
        showToast(res?.message || 'Failed to send email.', 'error');
      }
    } catch (err) {
      console.error('Error sending payslip email:', err);
      showToast(err?.response?.data?.message || 'Error sending payslip email.', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Render helper functions (returns primitive DOM elements directly to preserve input focus) ──
  const renderEditCell = (field, type = 'text', placeholder = '') =>
    editMode ? (
      <input
        key={`cell_${field}`}
        type={type}
        placeholder={placeholder}
        value={edited[field] ?? ''}
        onChange={e => set(field, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full bg-amber-50/90 border border-amber-400 focus:border-indigo-600 focus:bg-white px-1.5 py-0.5 text-[9.5px] font-bold text-slate-900 rounded outline-none transition-all shadow-xs"
      />
    ) : (
      <span className="font-semibold text-slate-900">{edited[field]}</span>
    );

  const renderEditNumCell = (field) =>
    editMode ? (
      <input
        key={`num_${field}`}
        type="number"
        min="0"
        value={edited[field] ?? 0}
        onChange={e => set(field, Number(e.target.value))}
        className="w-full bg-amber-50/90 border border-amber-400 focus:border-indigo-600 focus:bg-white px-1.5 py-0.5 text-[9.5px] font-bold text-right text-slate-900 rounded outline-none transition-all shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    ) : (
      <span>{num(field).toLocaleString('en-IN')}</span>
    );

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`bg-white text-slate-900 rounded-2xl shadow-2xl my-auto flex flex-col max-h-[94vh] w-full overflow-hidden border border-slate-300 ${
            isSmall ? 'sm:w-[540px] max-w-[540px]' : 'max-w-3xl lg:max-w-4xl'
          }`}
        >
          {/* ── Top Control Bar ─────────────────────────────── */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50 print:hidden shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                <FileText size={13} />
              </div>
              <div>
                <h3 className="text-[11px] font-black text-slate-900 leading-none">Official KOD.BRAND Salary Slip</h3>
                <p className="text-[9px] text-slate-500 font-medium leading-none mt-0.5">{edited.month} — {edited.empName}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {/* Edit / Save / Cancel */}
              {isPrivileged && (
                !editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-2 py-0.5 rounded-md border border-amber-400 hover:bg-amber-50 text-amber-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-2 py-0.5 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-600 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle size={11} /> Cancel
                    </button>
                  </>
                )
              )}

              <button
                onClick={handlePrint}
                disabled={editMode}
                className="px-2 py-0.5 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                title={editMode ? 'Save edits first' : 'Print'}
              >
                <Printer size={12} /> Print
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={downloading || editMode}
                className="px-2.5 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-xs disabled:opacity-50 transition flex items-center gap-1 cursor-pointer"
                title={editMode ? 'Save edits first' : 'Download PDF'}
              >
                {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={12} />}
                {downloading ? 'Generating...' : 'Download PDF'}
              </button>
              <button
                onClick={() => {
                  const empEmail = salaryRecord?.employee?.email || salaryRecord?.email || salaryRecord?.employeeEmail || targetEmail || '';
                  setTargetEmail(empEmail);
                  setShowEmailModal(true);
                }}
                disabled={sendingEmail || editMode}
                className="px-2.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-xs disabled:opacity-50 transition flex items-center gap-1 cursor-pointer"
                title={editMode ? 'Save edits first' : 'Share via Email'}
              >
                {sendingEmail ? <Loader2 size={11} className="animate-spin" /> : <Mail size={12} />}
                <span>{sendingEmail ? 'Sending...' : 'Email Payslip'}</span>
              </button>
              {isPrivileged && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={editMode}
                  className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="Delete Payslip"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Edit mode banner */}
          {editMode && (
            <div className="px-3 py-1 bg-amber-50 border-b border-amber-200 text-amber-800 text-[10px] font-bold print:hidden flex items-center gap-1 shrink-0">
              <Pencil size={10} />
              Edit mode — modify any field, then click <strong className="mx-1">Save</strong> to persist changes.
            </div>
          )}

          {/* ── Printable Payslip Body ───────────────────────── */}
          <div className="p-2 sm:p-3 overflow-y-auto flex-1 bg-white" ref={payslipRef} data-payslip-ref="true">
            <div className="border border-[#94a3b8] p-2 space-y-1.5 font-sans bg-white text-[#0f172a] text-[10px]">

              {/* Header: Logo + Banner */}
              <div className="flex flex-row justify-between items-stretch gap-2 pb-0.5">
                <div className="flex flex-col justify-center">
                  <img
                    src="/logo3.png"
                    alt="KOD.Brand Logo"
                    className="h-8 sm:h-9 w-auto object-contain"
                    crossOrigin="anonymous"
                  />
                </div>

                <div className="bg-[#0D1E4A] text-white px-4 py-1 text-right flex flex-col justify-center border-b-2 border-[#65B32E]">
                  <h2 className="text-base sm:text-lg font-black tracking-wider uppercase leading-none">PAYSLIP</h2>
                  <span className="text-[8px] font-bold tracking-widest text-[#cbd5e1] uppercase block mt-0.5">FOR THE MONTH OF:</span>
                  {editMode ? (
                    <input
                      value={edited.month}
                      onChange={e => set('month', e.target.value)}
                      className="text-[10px] font-black text-[#65B32E] uppercase tracking-wide bg-transparent border-b border-[#65B32E] focus:outline-none text-right"
                    />
                  ) : (
                    <span className="text-[10px] font-black text-[#65B32E] uppercase tracking-wide leading-none">{edited.month}</span>
                  )}
                </div>
              </div>

              {/* Employee + Pay Period Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="border border-[#94a3b8]">
                  <div className="bg-[#0D1E4A] text-white py-1 px-2 text-center font-extrabold italic uppercase tracking-wider text-[10px]">EMPLOYEE DETAILS</div>
                  <table className="w-full text-[10px] leading-normal">
                    <tbody className="divide-y divide-[#cbd5e1]">
                      {[
                        ['empId', 'Employee ID'],
                        ['empName', 'Employee Name'],
                        ['department', 'Department'],
                        ['designation', 'Designation'],
                        ['location', 'Location'],
                      ].map(([field, label]) => (
                        <tr key={field}>
                          <td className="py-1 px-2 italic font-semibold text-[#334155] w-2/5 border-r border-[#cbd5e1]">{label}</td>
                          <td className="py-1 px-2">{renderEditCell(field)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border border-[#94a3b8]">
                  <div className="bg-[#0D1E4A] text-white py-1 px-2 text-center font-extrabold italic uppercase tracking-wider text-[10px]">PAY PERIOD DETAILS</div>
                  <table className="w-full text-[10px] leading-normal">
                    <tbody className="divide-y divide-[#cbd5e1]">
                      <tr>
                        <td className="py-1 px-2 italic font-semibold text-[#334155] w-2/5 border-r border-[#cbd5e1]">Pay period</td>
                        <td className="py-1 px-2">{renderEditCell("payPeriod")}</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-2 italic font-semibold text-[#334155] border-r border-[#cbd5e1]">Pay date</td>
                        <td className="py-1 px-2">{renderEditCell("payDateStr")}</td>
                      </tr>
                      {[
                        ['workingDays', 'Working Days'],
                        ['daysWorked', 'Days Worked'],
                        ['daysInLeave', 'Days in Leave'],
                      ].map(([field, label]) => (
                        <tr key={field}>
                          <td className="py-1 px-2 italic font-semibold text-[#334155] border-r border-[#cbd5e1]">{label}</td>
                          <td className="py-1 px-2">
                            {editMode ? (
                              <input
                                key={`workdays_${field}`}
                                type="number" min="0"
                                value={edited[field] ?? 0}
                                onChange={e => set(field, Number(e.target.value))}
                                className="w-16 bg-amber-50/90 border border-amber-400 focus:border-indigo-600 focus:bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-900 outline-none rounded shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            ) : (
                              <span className="font-semibold text-[#0f172a]">{edited[field]} Days</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Earnings & Deductions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Earnings */}
                <div className="border border-[#94a3b8] flex flex-col justify-between">
                  <div>
                    <div className="bg-[#0D1E4A] text-white py-1 px-2 text-center font-extrabold italic uppercase tracking-wider text-[10px]">EARNINGS</div>
                    <table className="w-full text-[10px] leading-normal">
                      <thead className="bg-[#EAEFE6] border-b border-[#94a3b8] font-extrabold text-[9px] italic">
                        <tr>
                          <th className="py-1 px-2 text-left border-r border-[#94a3b8]">PARTICULARS</th>
                          <th className="py-1 px-2 text-right">AMOUNT (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#cbd5e1]">
                        {[
                          ['basicSalary', 'Basic Salary'],
                          ['hra', 'House Rent Allowance'],
                          ['medicalAllowance', 'Medical Allowance'],
                          ['specialAllowance', 'Special Allowance'],
                          ['transportAllowance', 'Transport Allowance'],
                          ['otherAllowance', 'Other Allowance'],
                          ['integrityAward', 'KODBRAND Integrity Award'],
                          ['bonus', 'Bonus'],
                        ].map(([field, label]) => (
                          <tr key={field}>
                            <td className="py-1 px-2 italic text-[#1e293b] border-r border-[#cbd5e1]">{label}</td>
                            <td className="py-1 px-2 text-right font-medium">{renderEditNumCell(field)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-[#FFF4E6] border-t border-[#94a3b8] py-1 px-2 flex justify-between font-extrabold text-[#0D1E4A] text-[10px]">
                    <span>TOTAL EARNINGS</span>
                    <span>{totalEarnings.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-[#94a3b8] flex flex-col justify-between">
                  <div>
                    <div className="bg-[#0D1E4A] text-white py-1 px-2 text-center font-extrabold italic uppercase tracking-wider text-[10px]">DEDUCTIONS</div>
                    <table className="w-full text-[10px] leading-normal">
                      <thead className="bg-[#EAEFE6] border-b border-[#94a3b8] font-extrabold text-[9px] italic">
                        <tr>
                          <th className="py-1 px-2 text-left border-r border-[#94a3b8]">PARTICULARS</th>
                          <th className="py-1 px-2 text-right">AMOUNT (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#cbd5e1]">
                        {[
                          ['pf', 'Provident Fund (PF)'],
                          ['professionalTax', 'Professional Tax'],
                          ['incomeTax', 'Income Tax'],
                          ['unpaidLeave', 'Unpaid Leave'],
                          ['advanceSalary', 'Advance Salary'],
                          ['otherDeductions', 'Other Deductions'],
                        ].map(([field, label]) => (
                          <tr key={field}>
                            <td className="py-1 px-2 italic text-[#1e293b] border-r border-[#cbd5e1]">{label}</td>
                            <td className="py-1 px-2 text-right font-medium">{renderEditNumCell(field)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-[#FFF4E6] border-t border-[#94a3b8] py-1 px-2 flex justify-between font-extrabold text-[#0D1E4A] text-[9px]">
                    <span>TOTAL DEDUCTIONS</span>
                    <span>{totalDeductions.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Footer: Address, Net Pay, Signature */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-1.5 pt-0.5">
                <div className="text-[8px] leading-tight text-[#1e293b] font-bold space-y-0.5">
                  {editMode ? (
                    <div className="space-y-0.5">
                      <input value={edited.companyName ?? ''} onChange={e => set('companyName', e.target.value)} className="w-full text-[8px] font-black text-[#0D1E4A] border-b border-indigo-400 bg-indigo-50 px-1 focus:outline-none rounded-xs" placeholder="Company Name" />
                      <input value={edited.companyAddressLine1 ?? ''} onChange={e => set('companyAddressLine1', e.target.value)} className="w-full text-[8px] font-bold border-b border-indigo-400 bg-indigo-50 px-1 focus:outline-none rounded-xs" placeholder="Address Line 1" />
                      <input value={edited.companyAddressLine2 ?? ''} onChange={e => set('companyAddressLine2', e.target.value)} className="w-full text-[8px] font-bold border-b border-indigo-400 bg-indigo-50 px-1 focus:outline-none rounded-xs" placeholder="Address Line 2" />
                      <input value={edited.companyAddressLine3 ?? ''} onChange={e => set('companyAddressLine3', e.target.value)} className="w-full text-[8px] font-bold border-b border-indigo-400 bg-indigo-50 px-1 focus:outline-none rounded-xs" placeholder="Address Line 3" />
                    </div>
                  ) : (
                    <>
                      <p className="font-black text-[#0D1E4A]">{edited.companyName || 'KODBRAND SOLUTIONS'}</p>
                      <p>{edited.companyAddressLine1 || '3rd Floor, Aranyakam Building'}</p>
                      <p>{edited.companyAddressLine2 || 'thamarauzhi road, up hill'}</p>
                      <p>{edited.companyAddressLine3 || 'malappuram, kerala-676505'}</p>
                    </>
                  )}
                </div>

                <div className="border border-[#0D1E4A] rounded-md p-1 text-center bg-white shadow-xs">
                  <span className="text-[10px] font-black text-[#0D1E4A] uppercase tracking-wider block leading-none">NET PAY (₹)</span>
                  <div className="flex items-center justify-center gap-1 my-0.5">
                    {[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-[#65B32E]"></span>)}
                  </div>
                  {editMode ? (
                    <input
                      type="number"
                      value={edited.customNetPay ?? netPay}
                      onChange={e => set('customNetPay', Number(e.target.value))}
                      className="text-base font-black text-[#0D1E4A] tracking-tight leading-none text-center w-full border-b border-indigo-400 bg-indigo-50 focus:outline-none rounded-xs"
                    />
                  ) : (
                    <p className="text-base font-black text-[#0D1E4A] tracking-tight leading-none">₹{netPay.toLocaleString('en-IN')}</p>
                  )}
                </div>

                <div className="flex flex-col items-center sm:items-end justify-center">
                  <div className="h-6 flex items-center justify-center font-serif text-sm italic font-extrabold text-[#0D1E4A] tracking-widest border-b border-[#94a3b8] px-2">
                    {editMode ? (
                      <input
                        value={edited.signatoryName ?? ''}
                        onChange={e => set('signatoryName', e.target.value)}
                        className="text-sm font-serif italic font-extrabold text-[#0D1E4A] border-b border-indigo-400 bg-indigo-50 px-1 text-center focus:outline-none rounded-xs"
                        placeholder="Signature Text"
                      />
                    ) : (
                      edited.signatoryName || 'Aoj.'
                    )}
                  </div>
                  {editMode ? (
                    <input
                      value={edited.signatoryTitle ?? ''}
                      onChange={e => set('signatoryTitle', e.target.value)}
                      className="text-[7.5px] font-bold text-[#64748b] border-b border-indigo-400 bg-indigo-50 px-1 text-center focus:outline-none uppercase rounded-xs"
                      placeholder="Signatory Title"
                    />
                  ) : (
                    <span className="text-[7.5px] font-bold text-[#64748b] mt-0.5 uppercase">{edited.signatoryTitle || 'Authorized Signature'}</span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Share via Email Dialog ──────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white text-slate-900 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4 border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Mail size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Email Payslip Statement</h4>
                  <p className="text-[11px] text-slate-500">{edited.month} — {edited.empName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Recipient Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. employee@company.com"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-indigo-600 font-semibold text-slate-900"
              />
              <p className="text-[10px] text-slate-400 font-normal">
                The official KOD.BRAND salary statement will be emailed to this recipient.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSendEmail()}
                disabled={sendingEmail}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {sendingEmail ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>{sendingEmail ? 'Sending Email...' : 'Send Email'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <DeletePayslipModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onSuccess={() => {
          setShowDeleteConfirm(false);
          onClose();
          if (onSaved) onSaved();
        }}
        payslipRecord={salaryRecord}
      />
    </AnimatePresence>,
    document.body
  );
};

export default PayslipModal;
