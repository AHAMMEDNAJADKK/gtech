import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  fetchContentTypes,
  createContentTypeApi,
  updateContentTypeApi,
  deleteContentTypeApi
} from '../../services/calendarService';

const ManageContentTypesModal = ({ isOpen, onClose, onContentTypesUpdated }) => {
  const [contentTypes, setContentTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add Form State
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchContentTypes();
      const list = res.data || [];
      setContentTypes(list);
      if (onContentTypesUpdated) {
        onContentTypesUpdated(list);
      }
    } catch (err) {
      console.error('Error loading content types:', err);
      setError(err.message || 'Failed to load content types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setError('');
      setSuccessMsg('');
      setNewTypeName('');
      setNewTypeDescription('');
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddContentType = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) {
      setError('Please enter a content type name');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await createContentTypeApi({
        name: newTypeName.trim(),
        description: newTypeDescription.trim()
      });

      if (res.success && res.data) {
        setSuccessMsg(`Content type "${res.data.name}" created!`);
        setNewTypeName('');
        setNewTypeDescription('');
        
        // Reload list and notify parent to auto-select
        const updatedRes = await fetchContentTypes();
        const updatedList = updatedRes.data || [];
        setContentTypes(updatedList);
        if (onContentTypesUpdated) {
          onContentTypesUpdated(updatedList, res.data.value || res.data._id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create content type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item) => {
    setEditingId(item._id || item.value);
    setEditName(item.name);
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    setEditSaving(true);
    setError('');
    try {
      const res = await updateContentTypeApi(id, { name: editName.trim() });
      if (res.success) {
        setEditingId(null);
        setEditName('');
        setSuccessMsg('Content type updated');

        const updatedRes = await fetchContentTypes();
        const updatedList = updatedRes.data || [];
        setContentTypes(updatedList);
        if (onContentTypesUpdated) {
          onContentTypesUpdated(updatedList);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update content type');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const targetId = item._id || item.value;
    if (!targetId) return;

    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    setError('');
    try {
      const res = await deleteContentTypeApi(targetId);
      if (res.success) {
        setSuccessMsg(`"${item.name}" deleted`);
        const updatedRes = await fetchContentTypes();
        const updatedList = updatedRes.data || [];
        setContentTypes(updatedList);
        if (onContentTypesUpdated) {
          onContentTypesUpdated(updatedList);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete content type');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Manage Content Types
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Add, edit, or remove custom content types for Calendar Work
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-none">
          {/* Notifications */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <Check size={15} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add New Form Container */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Plus size={14} className="text-indigo-600 dark:text-indigo-400" />
              Create New Content Type
            </h4>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddContentType(e)}
                placeholder="Content Type Name (e.g., Reel, Podcast, Infographic)"
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="button"
                onClick={handleAddContentType}
                disabled={submitting || !newTypeName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-98"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* List of Content Types */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Existing Content Types ({contentTypes.length})
              </h4>
              <button
                onClick={loadData}
                className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                title="Reload List"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="animate-spin text-indigo-600 mx-auto mb-1" size={20} />
                <span className="text-xs">Loading content types...</span>
              </div>
            ) : contentTypes.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                No content types found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {contentTypes.map((item) => (
                  <div
                    key={item._id || item.value}
                    className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-950/40 flex items-center justify-between gap-3 transition"
                  >
                    {editingId === (item._id || item.value) ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(item._id || item.value)}
                          disabled={editSaving}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                          title="Save Name"
                        >
                          {editSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition cursor-pointer"
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                            {item.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-mono">
                            {item.value || item.name.toLowerCase().replace(/\s+/g, '_')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                            title="Edit Name"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title="Delete Content Type"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default ManageContentTypesModal;
