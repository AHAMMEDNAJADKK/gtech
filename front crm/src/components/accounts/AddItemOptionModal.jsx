import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, X, Trash2, Check, Tag } from 'lucide-react';
import { useToast } from '../ToastProvider';

const AddItemOptionModal = ({
  isOpen,
  onClose,
  itemOptions = [],
  onUpdateOptions,
  onSelectItem
}) => {
  const { showToast } = useToast();
  const [newItemName, setNewItemName] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e) => {
    if (e) e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) {
      if (showToast) showToast('Please enter an item or service name.', 'warning');
      return;
    }

    const updated = itemOptions.includes(trimmed)
      ? itemOptions
      : [...itemOptions, trimmed];

    try {
      localStorage.setItem('crm_item_options', JSON.stringify(updated));
    } catch (e) {}

    if (onUpdateOptions) onUpdateOptions(updated);
    if (onSelectItem) onSelectItem(trimmed);
    if (showToast) showToast(`Added '${trimmed}' to dropdown choices!`, 'success');

    setNewItemName('');
    onClose();
  };

  const handleDeleteOption = (optToDelete) => {
    const updated = itemOptions.filter((o) => o !== optToDelete);
    try {
      localStorage.setItem('crm_item_options', JSON.stringify(updated));
    } catch (e) {}
    if (onUpdateOptions) onUpdateOptions(updated);
    if (showToast) showToast(`Removed '${optToDelete}' from dropdown options.`, 'info');
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

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 my-auto"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Title & Icon Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
              <PlusCircle size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Add Item / Service Choice
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Add a new option to your dropdown menu for fast invoicing.
              </p>
            </div>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Item / Service Name
              </label>
              <input
                type="text"
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Website Maintenance, Graphic Design Fee"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Existing Options Chips */}
            {itemOptions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Current Dropdown Options ({itemOptions.length})
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50/60 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                  {itemOptions.map((opt, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 shadow-2xs group"
                    >
                      <Tag size={10} className="text-indigo-500 shrink-0" />
                      <span>{opt}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteOption(opt)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 transition cursor-pointer ml-0.5 opacity-60 group-hover:opacity-100"
                        title={`Remove '${opt}' from choices`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold transition shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check size={14} />
                <span>Save to Dropdown</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default AddItemOptionModal;
