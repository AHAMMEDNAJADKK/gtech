import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertCircle, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { updateDepartment } from '../../services/departmentService';

export const EditDepartmentModal = ({ isOpen, onClose, onSuccess, department }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [status, setStatus] = useState(true);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');

  // Load selected department data and users dropdown
  useEffect(() => {
    if (isOpen && department) {
      setName(department.name || '');
      setCode(department.code || '');
      setDescription(department.description || '');
      setManagerId(department.managerId?._id || department.managerId || '');
      setStatus(department.status !== undefined ? department.status : true);
      
      setErrors({});
      setGlobalError('');

      const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
          const API_URL = import.meta.env?.VITE_API_URL || import.meta.env?.REACT_APP_API_URL || 'http://localhost:5000/api';
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_URL}/v1/users/list`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.error('Failed to load users for manager dropdown:', err);
        } finally {
          setLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [isOpen, department]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGlobalError('');

    try {
      await updateDepartment({
        id: department._id,
        name,
        code,
        description,
        managerId: managerId || null,
        status
      });
      onSuccess('Department updated successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      if (err.statusCode === 409) {
        setGlobalError('Name/code already exists');
      } else if (err.errors && Array.isArray(err.errors)) {
        const mapped = {};
        err.errors.forEach(e => {
          mapped[e.path || e.param] = e.msg;
        });
        setErrors(mapped);
      } else {
        setGlobalError(err.message || 'Failed to update department');
      }
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
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto my-auto bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-2xl p-6 z-10"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
              Edit Department
            </h2>
            <p className="text-xs font-semibold text-slate-400">
              Modify the configuration parameters of this business unit.
            </p>
          </div>

          {globalError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">{globalError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Name & Team Lead selection */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Executive Management"
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border ${errors.name ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800'} text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all`}
                  />
                  {errors.name && (
                    <p className="text-rose-500 text-[11px] font-bold mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.name}
                    </p>
                  )}
                </div>

                {/* Team Lead selection dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
                    Department Team Lead
                  </label>
                  <div className="relative">
                    <select
                      value={managerId}
                      onChange={(e) => setManagerId(e.target.value)}
                      disabled={loadingUsers}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                    {loadingUsers && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader size={16} className="animate-spin text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Code & Status Toggle */}
              <div className="space-y-4">
                {/* Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
                    Department Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EXEC"
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border ${errors.code ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800'} text-slate-800 dark:text-white text-sm font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all`}
                  />
                  {errors.code && (
                    <p className="text-rose-500 text-[11px] font-bold mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.code}
                    </p>
                  )}
                </div>

                {/* Status Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
                    Active Status
                  </label>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-800/50">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">Active Status</p>
                      <p className="text-[10px] font-semibold text-slate-400">Determine if unit is open.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={status}
                        onChange={(e) => setStatus(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the department's core function..."
                rows={2}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all resize-none"
              />
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 disabled:bg-indigo-600/50 flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all duration-150 text-sm"
              >
                {submitting ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default EditDepartmentModal;
