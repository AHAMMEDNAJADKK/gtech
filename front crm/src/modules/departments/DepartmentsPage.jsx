// src/modules/departments/DepartmentsPage.jsx

import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Plus, Search, Building, Users, Activity, EyeOff, Loader, RefreshCw, Edit3, Trash2, User, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { getAllDepartments, getDepartmentById } from '../../services/departmentService';
import StatsCard from '../../components/StatsCard';
import DepartmentCard from './DepartmentCard';
import StatusBadge from '../../components/StatusBadge';

// Helper to extract initials for manager avatar
const getInitials = (user) => {
  if (!user || !user.name) return '??';
  const parts = user.name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Lazy-loaded dialog components to minimize initial bundle size
const CreateDepartmentModal = lazy(() => import('./CreateDepartmentModal'));
const EditDepartmentModal = lazy(() => import('./EditDepartmentModal'));
const DeleteDepartmentModal = lazy(() => import('./DeleteDepartmentModal'));
const DepartmentUsersDrawer = lazy(() => import('./DepartmentUsersDrawer'));

export const DepartmentsPage = () => {
  const { id } = useParams();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search and Tab Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'active' | 'inactive'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Modal and Drawer visibility states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Selected item reference for edit/delete/drawer actions
  const [selectedDept, setSelectedDept] = useState(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' | 'error'

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Fetch departments data from backend
  const fetchDepartments = useCallback(async () => {
    // Extract parameter ID and strip colons (e.g. ":1" -> "1")
    const cleanId = id && id.startsWith(':') ? id.slice(1) : id;
    
    // Guard against literal colon path variables or placeholder values
    if (id && (!cleanId || cleanId === '1' || cleanId === 'id')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (cleanId) {
        const res = await getDepartmentById(cleanId);
        const dept = res.data || res;
        setDepartments(dept ? [dept] : []);
      } else {
        const res = await getAllDepartments();
        // Service unrolls `{ success, message, data }` or rejects
        setDepartments(Array.isArray(res) ? res : res.data || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to retrieve departments list');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Compute stat card metrics
  const totalCount = departments.length;
  const activeCount = departments.filter(d => d.status === true).length;
  const inactiveCount = departments.filter(d => d.status === false).length;
  const totalMembers = departments.reduce((sum, d) => sum + (d.memberCount || 0), 0);

  // Perform client-side filter based on Search Input & Tabs
  const filteredDepartments = departments.filter(dept => {
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'active' && dept.status === true) ||
      (activeTab === 'inactive' && dept.status === false);

    const term = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !term ||
      dept.name.toLowerCase().includes(term) ||
      dept.code.toLowerCase().includes(term);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-5 p-1">
      {/* Top Banner and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
            Departments Manager
          </h1>
          {/* <p className="text-sm font-semibold text-slate-400">
            Configure business divisions, view headcounts, and assign management roles.
          </p> */}
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all self-start md:self-auto"
        >
          <Plus size={18} className="stroke-[2.5px]" />
          <span>New Department</span>
        </motion.button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Units"
          value={totalCount}
          icon={Building}
          color="indigo"
          loading={loading}
        />
        <StatsCard
          title="Active Units"
          value={activeCount}
          icon={Activity}
          color="emerald"
          loading={loading}
        />
        <StatsCard
          title="Inactive Units"
          value={inactiveCount}
          icon={EyeOff}
          color="rose"
          loading={loading}
        />
        <StatsCard
          title="Total Members"
          value={totalMembers}
          icon={Users}
          color="amber"
          loading={loading}
        />
      </div>

      {/* Filter tabs, search control and view toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-1">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'inactive'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer
                ${activeTab === tab
                  ? 'bg-indigo-700 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 dark:text-slate-400'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departments..."
              className="w-full pl-4 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800/80 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/40 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-indigo-700 text-white shadow-sm border border-transparent'
                  : 'text-slate-400 dark:text-slate-505 hover:text-slate-650 dark:hover:text-slate-350'
              }`}
              title="Table View"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-indigo-700 text-white shadow-sm border border-transparent'
                  : 'text-slate-400 dark:text-slate-505 hover:text-slate-650 dark:hover:text-slate-350'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid display area */}
      {loading && departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Loader size={32} className="animate-spin text-indigo-600" />
          <p className="text-sm font-bold">Populating organization grid...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 text-center max-w-md mx-auto space-y-4">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400 leading-relaxed">
            {error}
          </p>
          <button
            onClick={fetchDepartments}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors"
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 max-w-md mx-auto">
          <Building size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
            No Departments Found
          </h3>
          <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
            {departments.length === 0
              ? 'Get started by clicking "New Department" above.'
              : 'Try adjusting your search criteria or filter tags.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-[2rem] shadow-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200/50 dark:border-slate-800/50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                    Department Info
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                    Manager Details
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-center">
                    Members
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-center">
                    Status
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredDepartments.map(dept => {
                  const { name, code, description, managerId, status, memberCount = 0 } = dept;
                  return (
                    <tr 
                      key={dept._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-950/25 transition-colors"
                    >
                      {/* Department Info */}
                      <td className="px-8 py-5">
                        <div className="flex items-start gap-4">
                          <span className="mt-1 flex-shrink-0 px-2.5 py-1 text-[10px] font-black tracking-widest uppercase bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-500/10">
                            {code}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight leading-tight mb-1">
                              {name}
                            </h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold line-clamp-2 max-w-md">
                              {description || 'No description provided.'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Manager */}
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          {managerId ? (
                            <>
                              {managerId.avatar ? (
                                <img
                                  src={managerId.avatar}
                                  alt={managerId.name}
                                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-sm flex items-center justify-center ring-2 ring-indigo-500/20 flex-shrink-0">
                                  {getInitials(managerId)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                  {managerId.name}
                                </p>
                                <p className="text-[11px] font-semibold text-indigo-500 dark:text-lime-400 truncate">
                                  {managerId.designation || 'Department Manager'}
                                </p>
                                {managerId.email && (
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">
                                    {managerId.email}
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 flex-shrink-0">
                                <User size={16} />
                              </div>
                              <div>
                                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider italic">
                                  Unassigned
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Members Count */}
                      <td className="px-8 py-5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200/30 dark:border-slate-800/30">
                          <Users size={14} className="text-slate-400" />
                          <span>{memberCount}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-8 py-5 text-center">
                        <StatusBadge status={status} />
                      </td>

                      {/* Actions */}
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedDept(dept);
                              setIsDrawerOpen(true);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/10 transition-all duration-300 cursor-pointer"
                            title="View Members"
                          >
                            <Users size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDept(dept);
                              setIsEditOpen(true);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all duration-300 cursor-pointer"
                            title="Edit Department"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDept(dept);
                              setIsDeleteOpen(true);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-all duration-300 cursor-pointer"
                            title="Deactivate Department"
                          >
                            <EyeOff size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.map(dept => (
            <DepartmentCard
              key={dept._id}
              department={dept}
              onEdit={(d) => {
                setSelectedDept(d);
                setIsEditOpen(true);
              }}
              onDelete={(d) => {
                setSelectedDept(d);
                setIsDeleteOpen(true);
              }}
              onViewUsers={(d) => {
                setSelectedDept(d);
                setIsDrawerOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Lazy Loaded modals and sliders */}
      <Suspense fallback={null}>
        <CreateDepartmentModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={(msg) => {
            showToast(msg);
            fetchDepartments();
          }}
        />

        <EditDepartmentModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setSelectedDept(null);
          }}
          department={selectedDept}
          onSuccess={(msg) => {
            showToast(msg);
            fetchDepartments();
          }}
        />

        <DeleteDepartmentModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setSelectedDept(null);
          }}
          department={selectedDept}
          onSuccess={(msg) => {
            showToast(msg);
            fetchDepartments();
          }}
        />

        <DepartmentUsersDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedDept(null);
            fetchDepartments();
          }}
          department={selectedDept}
        />
      </Suspense>

      {/* Toast Notification popup */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-8 right-8 z-[999999] px-5 py-3.5 rounded-2xl shadow-2xl border text-xs font-black uppercase tracking-wider flex items-center gap-2
              ${toastType === 'success'
                ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/10'
                : 'bg-rose-500 border-rose-400 text-white shadow-rose-500/10'
              }
            `}
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DepartmentsPage;
