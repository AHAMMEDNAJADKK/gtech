import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, EyeOff, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateDepartmentStatus } from '../../services/departmentService';

export const DeleteDepartmentModal = ({ isOpen, onClose, onSuccess, department }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleDeactivate = async () => {
    if (!department) return;
    setSubmitting(true);
    setError('');

    try {
      await updateDepartmentStatus(department._id, false);
      onSuccess('Department moved to inactive successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to deactivate department');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !department) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 150 }}
          className="relative w-full max-w-md my-auto bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] shadow-2xl p-8 z-10"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Icon and Title */}
          <div className="flex flex-col items-center text-center mt-4 mb-6">
            <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-4 shadow-lg shadow-amber-500/5">
              <EyeOff size={32} className="stroke-[2.5px]" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              Deactivate Department
            </h2>
            <p className="text-sm font-semibold text-slate-400 mt-1 max-w-[280px]">
              This department will be moved to <span className="text-amber-500 font-bold">Inactive</span> status. No data will be deleted.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50 mb-6 text-center">
            <span className="text-[10px] font-black tracking-widest uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/10 mr-2">
              {department.code}
            </span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {department.name}
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold leading-relaxed">
              {error}
            </div>
          )}

          {/* Form actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-98 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDeactivate}
              className="flex-1 py-3.5 rounded-2xl bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:bg-amber-500/50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/15 active:scale-98 transition-all duration-150"
            >
              {submitting ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <EyeOff size={16} />
                  <span>Move to Inactive</span>
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

export default DeleteDepartmentModal;
