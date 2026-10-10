import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserX, Loader, Mail, Briefcase, Award, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { getDepartmentUsers, addUserToDepartment, removeUserFromDepartment } from '../../services/departmentService';
import StatusBadge from '../../components/StatusBadge';

export const DepartmentUsersDrawer = ({ isOpen, onClose, department }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // States for adding user
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const deptId = department?._id;

  // Load department users
  useEffect(() => {
    if (isOpen && deptId) {
      const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
          const res = await getDepartmentUsers(deptId);
          setUsers(Array.isArray(res) ? res : res.data || []);
        } catch (err) {
          console.error(err);
          setError(err.message || 'Failed to load department users');
        } finally {
          setLoading(false);
        }
      };
      fetchUsers();
    }
  }, [isOpen, deptId]);

  // Load all active users for dropdown
  useEffect(() => {
    if (isOpen) {
      const fetchAllUsers = async () => {
        try {
          const API_URL = import.meta.env?.VITE_API_URL || import.meta.env?.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_URL}/v1/users/list`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setAllUsers(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.error('Failed to load users list:', err);
        }
      };
      fetchAllUsers();
      // Reset action states
      setSelectedUserToAdd('');
      setActionError('');
      setActionSuccess('');
    }
  }, [isOpen]);

  const handleAddUser = async () => {
    if (!selectedUserToAdd || !deptId) return;
    setAddingUser(true);
    setActionError('');
    setActionSuccess('');
    try {
      await addUserToDepartment(deptId, selectedUserToAdd);
      setActionSuccess('Member added successfully!');
      setSelectedUserToAdd('');
      // Refresh the department members list
      const res = await getDepartmentUsers(deptId);
      setUsers(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Failed to add member');
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!deptId || !userId) return;
    setRemovingUserId(userId);
    setActionError('');
    setActionSuccess('');
    try {
      await removeUserFromDepartment(deptId, userId);
      setActionSuccess('Member removed successfully!');
      // Refresh the department members list
      const res = await getDepartmentUsers(deptId);
      setUsers(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Failed to remove member');
    } finally {
      setRemovingUserId(null);
    }
  };

  const getInitials = (user) => {
    if (user.firstName && user.lastName) {
      return (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
    }
    const name = user.name || user.firstName || '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Compute users not already in department
  const availableUsers = allUsers.filter(
    (u) => !users.some((existingUser) => existingUser._id === u._id)
  );

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
        />

        {/* Drawer Wrapper */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200/50 dark:border-slate-800/50 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/10">
                  {department?.code}
                </span>
                <h2 className="text-xl font-black text-slate-800 dark:text-white mt-1 tracking-tight">
                  {department?.name}
                </h2>
                <p className="text-xs font-semibold text-slate-400">Department Members List</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Add User Section */}
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30">
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                Add New Member
              </h3>
              
              {actionError && (
                <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {actionError}
                </div>
              )}

              {actionSuccess && (
                <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  {actionSuccess}
                </div>
              )}

              <div className="flex gap-2">
                <select
                  value={selectedUserToAdd}
                  onChange={(e) => setSelectedUserToAdd(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-850 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                >
                  <option value="">Select an employee...</option>
                  {availableUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                
                {/* <button
                  type="button"
                  disabled={!selectedUserToAdd || addingUser}
                  onClick={handleAddUser}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {addingUser ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  <span>Add</span>
                </button> */}
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                  <Loader className="animate-spin text-indigo-600" size={32} />
                  <p className="text-sm font-bold">Retrieving member directory...</p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold text-center leading-relaxed">
                  {error}
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800/50 text-slate-400 dark:text-slate-500 mb-4 shadow-lg shadow-black/5">
                    <UserX size={36} className="stroke-[1.5px]" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
                    No Members Assigned
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                    There are no employees registered under this department unit yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div
                      key={user._id}
                      className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/30 dark:border-slate-800/30 hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-300 flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Avatar */}
                        <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-black text-sm flex items-center justify-center ring-2 ring-indigo-500/10">
                          {getInitials(user)}
                        </div>

                        {/* Info details */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                              {user.firstName} {user.lastName}
                            </h4>
                            <StatusBadge status={user.status === 'active'} />
                          </div>
                          
                          <div className="flex items-center gap-1 text-[11px] text-indigo-500 dark:text-lime-400 font-bold uppercase tracking-wider">
                            <Award size={12} />
                            <span className="truncate">{user.designation}</span>
                          </div>

                          <div className="flex flex-col gap-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 pt-1">
                            <div className="flex items-center gap-1">
                              <Briefcase size={12} className="shrink-0" />
                              <span>ID: {user.employeeId}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Mail size={12} className="shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          </div>

                          {user.roleInDepartment && (
                            <div className="pt-2 flex items-center gap-2">
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-slate-700 capitalize">
                                Role: {user.roleInDepartment}
                              </span>
                              {user.isPrimary && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-slate-700">
                                  Primary Unit
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Remove member button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(user._id)}
                        disabled={removingUserId === user._id}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-300 shrink-0 cursor-pointer self-start"
                        title="Remove Member"
                      >
                        {removingUserId === user._id ? (
                          <Loader size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default DepartmentUsersDrawer;
