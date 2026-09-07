import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ShieldAlert, Loader2, CheckCircle2, Building } from 'lucide-react';
import { updateClient } from '../../services/clientService';
import { formatApiError } from '../../utils/errorUtils';
import { CLIENT_INDUSTRIES } from '../../constants/clientIndustries';

const EditClientModal = ({ isOpen, onClose, client, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (client && isOpen) {
      setFormData({
        companyName: client.companyName || '',
        clientName: client.clientName || '',
        email: client.email || '',
        phone: client.phone || '',
        alternativePhone: client.alternativePhone || '',
        whatsapp: client.whatsapp || '',
        industry: client.industry || 'Technology',
        website: client.website || '',
        gstNumber: client.gstNumber || '',
        country: client.country || 'India',
        state: client.state || '',
        city: client.city || '',
        address: client.address || '',
        postalCode: client.postalCode || '',
        status: client.status || 'Active',
        clientType: client.clientType || 'SMB',
        leadSource: client.leadSource || 'Direct',
        priority: client.priority || 'Medium',
        ndaStatus: client.ndaStatus || 'Pending',
        expectedMonthlyRevenue: client.expectedMonthlyRevenue || 0,
        supportPlan: client.supportPlan || 'Standard 8/5',
        notes: client.notes || '',
        contractStart: client.contractStart ? new Date(client.contractStart).toISOString().split('T')[0] : '',
        contractEnd: client.contractEnd ? new Date(client.contractEnd).toISOString().split('T')[0] : ''
      });
      setError('');
      setSuccessMsg('');
    }
  }, [client, isOpen]);

  if (!isOpen || !client) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.companyName.trim()) {
      setError('Company Name is required.');
      return;
    }
    if (!formData.clientName.trim()) {
      setError('Client Name is required.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = { ...formData };
      if (!payload.contractStart) delete payload.contractStart;
      if (!payload.contractEnd) delete payload.contractEnd;

      const clientId = client._id || client.id;
      const res = await updateClient(clientId, payload);

      if (res && res.success) {
        setSuccessMsg('Client updated successfully!');
        setTimeout(() => {
          if (onSuccess) onSuccess(res.data || res);
          onClose();
        }, 600);
      } else {
        setError(formatApiError(res, 'Failed to update client.'));
      }
    } catch (err) {
      setError(formatApiError(err, 'Server error updating client.'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden';
  const selectCls = 'px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden';

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100">Edit Client Profile</h2>
              <p className="text-xs text-slate-400 font-medium">Update client account details.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden m-0">
          <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Company Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Company Name *</label>
                <input type="text" required name="companyName" value={formData.companyName} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Primary Contact Person *</label>
                <input type="text" required name="clientName" value={formData.clientName} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email *</label>
                <input type="email" required name="email" value={formData.email} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone Number *</label>
                <input type="text" required name="phone" value={formData.phone} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Alternative Phone Number</label>
                <input type="text" name="alternativePhone" value={formData.alternativePhone} onChange={handleChange} placeholder="+91 98765 43211" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Industry</label>
                <select name="industry" value={formData.industry} onChange={handleChange} className={selectCls}>
                  {CLIENT_INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                  {formData.industry && !CLIENT_INDUSTRIES.includes(formData.industry) && (
                    <option value={formData.industry}>{formData.industry}</option>
                  )}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Website</label>
                <input type="text" name="website" value={formData.website} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp</label>
                <input type="text" name="whatsapp" value={formData.whatsapp} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">GST Number</label>
                <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange} className={inputCls} />
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Country</label>
                <input type="text" name="country" value={formData.country} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">State</label>
                <input type="text" name="state" value={formData.state} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">City</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Postal Code</label>
                <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className={inputCls} />
              </div>
            </div>

            {/* Status & Commercial */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className={selectCls}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Lead">Lead</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Client Type</label>
                <select name="clientType" value={formData.clientType} onChange={handleChange} className={selectCls}>
                  <option value="Enterprise">Enterprise</option>
                  <option value="SMB">SMB</option>
                  <option value="Startup">Startup</option>
                  <option value="Government">Government</option>
                  <option value="Retainer">Retainer</option>
                  <option value="One-Time">One-Time</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Priority</label>
                <select name="priority" value={formData.priority} onChange={handleChange} className={selectCls}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">NDA Status</label>
                <select name="ndaStatus" value={formData.ndaStatus} onChange={handleChange} className={selectCls}>
                  <option value="Signed">Signed</option>
                  <option value="Pending">Pending</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Expected Monthly Revenue (₹)</label>
                <input type="number" name="expectedMonthlyRevenue" value={formData.expectedMonthlyRevenue} onChange={handleChange} className={inputCls} />
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Notes</label>
              <textarea rows={3} name="notes" value={formData.notes} onChange={handleChange} className={inputCls} />
            </div>
          </div>

          {/* Actions */}
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></> : <><Save className="w-4 h-4" /><span>Update Client</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default EditClientModal;

