import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { deleteSalaryPayment } from '../../services/accountsService';
import { useToast } from '../ToastProvider';

const DeletePayslipModal = ({ isOpen, onClose, onSuccess, payslipRecord }) => {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !payslipRecord) return null;

  const empName = payslipRecord.employeeName || payslipRecord.employee?.name || 'Employee';
  const month = payslipRecord.month || 'N/A';
  const paidAmount = Number(payslipRecord.paidAmount || 0).toLocaleString('en-IN');

  const handleDelete = async () => {
    if (!payslipRecord?._id) return;
    setSubmitting(true);
    try {
      const res = await deleteSalaryPayment(payslipRecord._id);
      if (res.success) {
        showToast('Payslip deleted successfully!', 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.message || 'Failed to delete payslip.', 'error');
      }
    } catch (err) {
      console.error('Error deleting payslip:', err);
      showToast(err?.response?.data?.message || 'Error deleting payslip.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 my-auto"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>

          {/* Warning Icon Badge */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-xs">
              <Trash2 size={26} />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Delete Payslip?
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
              Are you sure you want to permanently delete this official payslip? This will also remove any synced expense record.
            </p>
          </div>

          {/* Payslip Details Card */}
          <div className="my-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Employee</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{empName}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200/50 dark:border-slate-800/50 pt-2">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Pay Period</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{month}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200/50 dark:border-slate-800/50 pt-2">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Net Paid Amount</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">₹{paidAmount}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold transition shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  <span>Delete Payslip</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default DeletePayslipModal;
