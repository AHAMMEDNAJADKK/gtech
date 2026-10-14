import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Briefcase, Search, RefreshCw, Eye, Edit, Plus, Filter, 
  Phone, Mail, Calendar, AlertCircle, X, ChevronLeft, ChevronRight, 
  Building2, ShieldCheck, UserCheck, Trash2, CheckCircle2, User, Loader2
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import StatsCard from '../../components/StatsCard';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) {
    return `${API_BASE}${cleanPath}`;
  }
  if (API_BASE.endsWith('/api')) {
    return `${API_BASE}/v1${cleanPath}`;
  }
  return `${API_BASE}/api/v1${cleanPath}`;
};

const PAGE_SIZE = 10;

const initialHrForm = {
  name: '',
  email: '',
  phone: '',
  employeeId: '',
  designation: 'HR Executive',
  department: 'Human Resources',
  password: '',
  status: 'active',
  joining_date: new Date().toISOString().split('T')[0]
};

const HrPage = () => {
  const { showToast } = useToast();

  const [hrEmployees, setHrEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedHr, setSelectedHr] = useState(null);
  const [formData, setFormData] = useState(initialHrForm);
  const [editFormData, setEditFormData] = useState(initialHrForm);
  const [submitting, setSubmitting] = useState(false);

  // Current logged in user context
  const currentUser = useMemo(() => {
    try {
      const rawUser = localStorage.getItem('user');
      return rawUser ? JSON.parse(rawUser) : null;
    } catch {
      return null;
    }
  }, []);

  const isAdminOrSuperAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = String(currentUser.role || '').toLowerCase();
    const roleId = String(currentUser.role_id || currentUser.roleId || '');
    return Boolean(
      currentUser.isSuperAdmin === true ||
      currentUser.is_super_admin === true ||
      role === 'superadmin' ||
      role === 'admin' ||
      roleId === '0' ||
      roleId === '1'
    );
  }, [currentUser]);

  const getHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return {
      'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Fetch HR employees from backend
  const fetchHrEmployees = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(getApiEndpoint('/users?role=hr&limit=500'), {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error(`Failed to load HR employees (${res.status})`);
      }

      const resData = await res.json();
      const rawUsers = resData?.data || resData?.users || (Array.isArray(resData) ? resData : []);
      
      // Filter for actual HR records
      const hrList = rawUsers.filter(u => {
        if (!u) return false;
        const roleStr = String(u.role || '').toLowerCase();
        const roleIdStr = String(u.role_id || u.roleId || '');
        const desigStr = String(u.designation || u.designationName || '').toLowerCase();
        const deptStr = String(u.department || '').toLowerCase();
        return (
          roleStr === 'hr' || 
          roleIdStr === '2' || 
          desigStr.includes('hr') || 
          desigStr.includes('human resource') ||
          deptStr.includes('hr') ||
          deptStr.includes('human resource')
        );
      });

      setHrEmployees(hrList);
    } catch (err) {
      console.error('Error fetching HR employees:', err);
      setError(err.message || 'Unable to retrieve HR employees.');
      showToast('Failed to load HR employees list.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getHeaders, showToast]);

  // Fetch Departments
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch(getApiEndpoint('/departments?status=true'), {
        headers: getHeaders()
      });
      if (res.ok) {
        const dData = await res.json();
        setDepartments(Array.isArray(dData.data) ? dData.data : []);
      }
    } catch (err) {
      console.warn('Departments fetch warning:', err);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchHrEmployees();
    fetchDepartments();
  }, [fetchHrEmployees, fetchDepartments]);

  // Filtered HR
  const filteredHr = useMemo(() => {
    return hrEmployees.filter(hr => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (hr.name || '').toLowerCase().includes(q);
        const emailMatch = (hr.email || '').toLowerCase().includes(q);
        const phoneMatch = (hr.phone || '').toLowerCase().includes(q);
        const idMatch = (hr.employeeId || '').toLowerCase().includes(q);
        const desigMatch = (hr.designation || hr.designationName || '').toLowerCase().includes(q);
        const deptMatch = (hr.department || '').toLowerCase().includes(q);

        if (!nameMatch && !emailMatch && !phoneMatch && !idMatch && !desigMatch && !deptMatch) {
          return false;
        }
      }

      if (statusFilter !== 'ALL') {
        const s = (hr.status || 'active').toLowerCase();
        if (statusFilter === 'active' && s !== 'active') return false;
        if (statusFilter === 'inactive' && s !== 'inactive') return false;
        if (statusFilter === 'blocked' && s !== 'blocked') return false;
      }

      if (departmentFilter !== 'ALL') {
        if ((hr.department || '').toLowerCase() !== departmentFilter.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [hrEmployees, searchQuery, statusFilter, departmentFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = hrEmployees.length;
    const active = hrEmployees.filter(h => (h.status || 'active') === 'active').length;
    const departmentsCount = new Set(hrEmployees.map(h => h.department).filter(Boolean)).size;

    return { total, active, departmentsCount };
  }, [hrEmployees]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredHr.length / PAGE_SIZE));
  const paginatedHr = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredHr.slice(start, start + PAGE_SIZE);
  }, [filteredHr, currentPage]);

  // Create HR Handler
  const handleCreateHr = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      showToast('Name, email, and password are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(getApiEndpoint('/users/create'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...formData,
          role: 'hr',
          role_id: '2'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Failed to create HR employee.');
      }

      showToast('HR employee created successfully!', 'success');
      setIsCreateModalOpen(false);
      setFormData(initialHrForm);
      fetchHrEmployees(true);
    } catch (err) {
      console.error('Create HR Error:', err);
      showToast(err.message || 'Error creating HR employee.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit HR Handler
  const handleEditHr = async (e) => {
    e.preventDefault();
    if (!selectedHr) return;

    setSubmitting(true);
    try {
      const hrId = selectedHr.id || selectedHr._id;
      const res = await fetch(getApiEndpoint(`/users/update/${hrId}`), {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editFormData.name,
          phone: editFormData.phone,
          designation: editFormData.designation,
          department: editFormData.department,
          status: editFormData.status,
          employeeId: editFormData.employeeId,
          role: 'hr'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Failed to update HR employee.');
      }

      showToast('HR employee updated successfully!', 'success');
      setIsEditModalOpen(false);
      setSelectedHr(null);
      fetchHrEmployees(true);
    } catch (err) {
      console.error('Edit HR Error:', err);
      showToast(err.message || 'Error updating HR employee.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (hr) => {
    setSelectedHr(hr);
    setEditFormData({
      name: hr.name || '',
      email: hr.email || '',
      phone: hr.phone || '',
      employeeId: hr.employeeId || '',
      designation: hr.designation || hr.designationName || 'HR Executive',
      department: hr.department || 'Human Resources',
      status: hr.status || 'active',
      joining_date: hr.joining_date ? new Date(hr.joining_date).toISOString().split('T')[0] : ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenView = (hr) => {
    setSelectedHr(hr);
    setIsViewModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
              <Briefcase size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                HR Management
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Employee Management &bull; Human Resources Directory &amp; Staff Operations
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchHrEmployees(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh HR employee list"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>

          {isAdminOrSuperAdmin && (
            <button
              onClick={() => {
                setFormData(initialHrForm);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/25 transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Add HR Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total HR Staff"
          value={stats.total}
          icon={Briefcase}
          color="indigo"
          loading={loading}
        />
        <StatsCard
          title="Active HR Employees"
          value={stats.active}
          icon={CheckCircle2}
          color="emerald"
          loading={loading}
        />
        <StatsCard
          title="Departments Active"
          value={stats.departmentsCount || 1}
          icon={Building2}
          color="amber"
          loading={loading}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by HR employee name, email, phone, employee ID, or designation..."
              className="w-full pl-10 pr-9 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>

            {departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[170px] truncate"
              >
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d._id || d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}

            {(searchQuery || statusFilter !== 'ALL' || departmentFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setDepartmentFilter('ALL');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
          <span>
            Showing {filteredHr.length} of {hrEmployees.length} HR employees
          </span>
          {filteredHr.length !== hrEmployees.length && (
            <span className="text-indigo-500">Filtered view active</span>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Loading HR employee directory...
            </p>
          </div>
        ) : error ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl">
              <AlertCircle size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {error}
            </p>
            <button
              onClick={() => fetchHrEmployees()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : paginatedHr.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 text-slate-400 rounded-2xl">
              <Briefcase size={36} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No HR employees registered
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {searchQuery || statusFilter !== 'ALL'
                ? "No HR records match your current search filters."
                : "No HR team members have been registered in the CRM yet. Admins can register HR staff using the 'Add HR Employee' button above."}
            </p>
            {isAdminOrSuperAdmin && !searchQuery && statusFilter === 'ALL' && (
              <button
                onClick={() => {
                  setFormData(initialHrForm);
                  setIsCreateModalOpen(true);
                }}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Plus size={15} />
                <span>Add First HR Employee</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Employee ID</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Role / Title</th>
                  <th className="py-3.5 px-4">Department / Branch</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Joining Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {paginatedHr.map((hr) => {
                  const empIdVal = hr.employeeId || '—';
                  const designationVal = hr.designationName || hr.designation || 'HR Staff';
                  const departmentVal = hr.department || 'Human Resources';
                  const joiningDate = hr.joining_date 
                    ? new Date(hr.joining_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : hr.createdAt 
                      ? new Date(hr.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—';

                  const initials = (hr.name || 'H')
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const avatarUrl = hr.profile_image || hr.avatar || hr.profileImage;

                  return (
                    <tr 
                      key={hr.id || hr._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={hr.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm ${avatarUrl ? 'hidden' : 'flex'}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block truncate group-hover:text-indigo-600 transition-colors">
                              {hr.name}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 block truncate">
                              {designationVal}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                          {empIdVal}
                        </span>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {hr.email && (
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                              <Mail size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{hr.email}</span>
                            </div>
                          )}
                          {hr.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                              <Phone size={12} className="text-slate-400 shrink-0" />
                              <span>{hr.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Role / Designation */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40 font-semibold text-[11px]">
                          <ShieldCheck size={12} className="shrink-0" />
                          <span className="truncate max-w-[140px]">{designationVal}</span>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Building2 size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{departmentVal}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={hr.status || (hr.isActive ? 'active' : 'inactive')} />
                      </td>

                      {/* Joining Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{joiningDate}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenView(hr)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition cursor-pointer"
                            title="View HR employee profile"
                          >
                            <Eye size={15} />
                          </button>
                          {isAdminOrSuperAdmin && (
                            <button
                              onClick={() => handleOpenEdit(hr)}
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-xl transition cursor-pointer"
                              title="Edit HR employee"
                            >
                              <Edit size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredHr.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing <span className="font-bold text-slate-700 dark:text-slate-300">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * PAGE_SIZE, filteredHr.length)}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{filteredHr.length}</span> HR employees
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Create HR Employee */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add HR Employee"
      >
        <form onSubmit={handleCreateHr} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. ramesh.hr@edtech.com"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +91 9876543210"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="e.g. HR-2026-001"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g. HR Manager / HR Specialist"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g. Human Resources"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Temporary login password"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50 shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              <span>Save HR Employee</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Edit HR Employee */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedHr(null);
        }}
        title="Edit HR Employee"
      >
        <form onSubmit={handleEditHr} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={editFormData.email}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={editFormData.employeeId}
                onChange={(e) => setEditFormData({ ...editFormData, employeeId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                value={editFormData.designation}
                onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={editFormData.department}
                onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedHr(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50 shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: View HR Profile Details */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedHr(null);
        }}
        title="HR Employee Profile"
      >
        {selectedHr && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                {(selectedHr.name || 'H').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {selectedHr.name}
                </h3>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedHr.designationName || selectedHr.designation || 'HR Staff'}
                </p>
                <div className="mt-1">
                  <StatusBadge status={selectedHr.status || (selectedHr.isActive ? 'active' : 'inactive')} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Employee ID</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedHr.employeeId || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Department</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedHr.department || 'Human Resources'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Email</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">{selectedHr.email || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Phone</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedHr.phone || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Registered / Member Since</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedHr.createdAt ? new Date(selectedHr.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : '—'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedHr(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HrPage;
