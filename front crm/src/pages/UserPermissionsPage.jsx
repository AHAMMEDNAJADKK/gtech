import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Shield, ShieldCheck, CheckCircle2, Loader2, Save, 
  CheckSquare, Square, RefreshCw, User as UserIcon, Mail, Phone, Briefcase, Folder
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { useUser } from '../contexts/UserContext';

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

const ALL_SIDEBAR_ITEMS = [
  // Dashboards
  { label: 'Dashboard', path: '/dashboard', category: 'Dashboards', desc: 'Main CRM overview & key metrics' },
  { label: 'Admin Dashboard', path: '/dashboard', category: 'Dashboards', desc: 'Admin panel with full CRM overview & controls' },
  { label: 'MD Dashboard', path: '/md-dashboard', category: 'Dashboards', desc: 'Managing Director executive overview & analytics' },
  { label: 'HR Dashboard', path: '/hr-dashboard', category: 'Dashboards', desc: 'HR overview dashboard & attendance stats' },
  { label: 'Lead Dashboard', path: '/lead-dashboard', category: 'Dashboards', desc: 'Lead generation & conversion metrics' },
  { label: 'Marketing Dashboard', path: '/marketing-dashboard', category: 'Dashboards', desc: 'Marketing campaigns & lead channels' },
  { label: 'Counselor Dashboard', path: '/counselor-dashboard', category: 'Dashboards', desc: 'Academic counselor dashboard & student conversions' },
  { label: 'Accountant Dashboard', path: '/accountant-dashboard', category: 'Dashboards', desc: 'Accountant financial dashboard, cashbook & revenue metrics' },
  { label: 'Dev Dashboard', path: '/developer-dashboard', category: 'Dashboards', desc: 'Developer task tracking & commit status' },
  { label: 'GD Dashboard', path: '/graphic-designer-dashboard', category: 'Dashboards', desc: 'Graphic design project & asset tracker' },
  { label: 'Video Dashboard', path: '/videographer-dashboard', category: 'Dashboards', desc: 'Videography project & editing status' },

  // Management & Operations
  { label: 'Approvals', path: '/approvals', category: 'Management', desc: 'MD Executive approvals for leaves & salary payments' },
  { label: 'Clients', path: '/clients', category: 'Management', desc: 'Client directory & company profiles' },
  { label: 'Projects', path: '/projects', category: 'Management', desc: 'Project tracking & milestones' },
  { label: 'Content Calendar', path: '/calendar-work', category: 'Management', desc: 'Social media & marketing content scheduling calendar' },
  { label: 'Users', path: '/users', category: 'Management', desc: 'Employee & user account management' },
  { label: 'Departments', path: '/departments', category: 'Management', desc: 'Department hierarchy & manager assignments' },
  { label: 'Sidebar Permissions', path: '/sidebar-permissions', category: 'Management', desc: 'Custom user menu permission configuration' },
  { label: 'Task Assign', path: '/todo', category: 'Operations', desc: 'Task assignment & attachment view' },

  // HR & Recruitment
  { label: 'Attendance', path: '/attendance', category: 'HR', desc: 'Daily attendance clock-in/out logs' },
  { label: 'Leave Requests', path: '/leaves', category: 'HR', desc: 'Leave request application & approvals' },
  { label: 'Recruitment', path: '/recruitment', category: 'HR', desc: 'Recruitment directory, candidate pipeline & offer letters' },
  { label: 'Student Attendance', path: '/student-attendance', category: 'HR', desc: 'Student batch attendance logs' },

  // Leads & Sales
  { label: 'Leads Directory', path: '/leads', category: 'Leads', desc: 'Full leads directory & sales pipeline' },
  { label: 'Client Leads', path: '/client-leads', category: 'Leads', desc: 'Client lead pipeline & inquiries' },
  { label: 'Telecaller Leads', path: '/leads-telecaller', category: 'Leads', desc: 'Telecaller assigned lead calls' },
  { label: 'Lead Counselor', path: '/lead-counselor', category: 'Leads', desc: 'Academic counselor lead assignments' },

  // LMS / Academy
  { label: 'Course Management', path: '/academy/courses', category: 'LMS / Academy', desc: 'Course catalog & curriculum management' },
  { label: 'Batches', path: '/academy/batches', category: 'LMS / Academy', desc: 'Student batch creation & schedule tracking' },
  { label: 'Enrollment Tracking', path: '/academy/enrollments', category: 'LMS / Academy', desc: 'Student course enrollment & fee status' },
  { label: 'My LMS Learning', path: '/academy/learning', category: 'LMS / Academy', desc: 'Student LMS portal & course materials' },

  // Analytics & Reports
  { label: 'KPI Analytics', path: '/performance-dashboard', category: 'Analytics', desc: 'Quantitative KPI score & performance' },
  { label: 'AI Reports', path: '/ai-report', category: 'Analytics', desc: 'Automated AI reports & summaries' },
  { label: 'Employee Reports', path: '/employee-reports', category: 'Reports', desc: 'Employee activity & performance logs' },
  { label: 'Daily Report', path: '/basic-report', category: 'Reports', desc: 'Common daily shift activity & report view' },
  { label: 'Team Reports', path: '/team-reports', category: 'Reports', desc: 'Team lead department reports' },
  { label: 'Developer Report', path: '/developer-report', category: 'Reports', desc: 'Developer daily shift reports' },
  { label: 'Graphic Designer Report', path: '/graphic-designer-report', category: 'Reports', desc: 'Graphic design shift reports' },
  { label: 'Videographer Report', path: '/videographer-report', category: 'Reports', desc: 'Videography shift reports' },
  { label: 'Academic Counselor Report', path: '/academic-counselor-report', category: 'Reports', desc: 'Academic counselor shift reports' },
  { label: 'HOD R&D Report', path: '/hod-rd-report', category: 'Reports', desc: 'HOD R&D shift reports' },
  { label: 'HOD Marketing Report', path: '/hod-marketing-report', category: 'Reports', desc: 'HOD Marketing consolidated shift reports' },
  { label: 'HR Shift Report', path: '/hr-report', category: 'Reports', desc: 'HR shift reports' },
  { label: 'Ops Shift Report', path: '/ops-report', category: 'Reports', desc: 'Operations shift reports' },
  { label: 'Accountant Shift Report', path: '/accountant-report', category: 'Reports', desc: 'Accountant shift reports' },
  { label: 'Marketing Shift Report', path: '/marketing-report', category: 'Reports', desc: 'Marketing shift reports' },

  // Finance & Accounts
  { label: 'Accounts', path: '/accounts', category: 'Finance', desc: 'Expense management, salary & cash book overview' },
  { label: 'Sales', path: '/accounts/income', category: 'Finance', desc: 'Revenue, client invoices & payment receipt records' },
  { label: 'Income', path: '/accounts/sales', category: 'Finance', desc: 'Client sales deals, billing invoices & revenue tracking' },
  { label: 'Purchase', path: '/accounts/purchase', category: 'Finance', desc: 'Vendor procurement, purchase orders & stock bills' },
  { label: 'Create Invoice', path: '/accounts/create-invoice', category: 'Finance', desc: 'Itemized Zoho tax invoice & billing builder' },
  { label: 'Expense Categories', path: '/accounts/categories', category: 'Finance', desc: 'Account expense categories' },
  { label: 'Expense', path: '/accounts/expenses', category: 'Finance', desc: 'Record & upload expense vouchers' },
  { label: 'Salary Payment', path: '/accounts/salary', category: 'Finance', desc: 'Salary payment processing & disbursal' },
  { label: 'Cash & Bank', path: '/accounts/cash-book', category: 'Finance', desc: 'Cash & bank ledger & transaction history' },
  { label: 'Operation', path: '/accounts/operation', category: 'Finance', desc: 'Operation amount ledger, given by & to whom records' },
  { label: 'Financial Report', path: '/accounts/reports', category: 'Finance', desc: 'Financial expense analytics & summaries' },
  { label: 'Payslips', path: '/payslips', category: 'Finance', desc: 'Employee payslip generation & disbursal records' },
  { label: 'Personal Payslip', path: '/my-payslip', category: 'Finance', desc: 'Personal salary slip portal for individual employees' },

  // General
  { label: 'Notifications', path: '/notifications', category: 'General', desc: 'System alerts & messages' }
];

const UserPermissionsPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refetchUser } = useUser() || {};

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` };
  }, []);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiEndpoint(`/users/${userId}`), {
        headers: getAuthHeaders()
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      const data = await res.json();
      if (res.ok && data.data) {
        const u = data.data;
        setUser(u);
        setSelectedPermissions(u.permissions || []);
        setIsSuperAdmin(Boolean(u.isSuperAdmin || u.role === 'superadmin'));
      } else {
        showToast(data.message || "Failed to load user details", "error");
      }
    } catch (err) {
      console.error("Error fetching user for permissions:", err);
      showToast("Error loading user profile.", "error");
    } finally {
      setLoading(false);
    }
  }, [userId, getAuthHeaders, showToast]);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userObj = JSON.parse(savedUser);
        const role = String(userObj.role_id || userObj.roleId || userObj.role || '').toLowerCase().trim();
        const designation = String(userObj.designation || '').toLowerCase().trim();
        const isHr = role === 'hr' || designation.includes('hr');
        if (isHr) {
          showToast("HR users cannot edit permissions.", "error");
          navigate('/users', { replace: true });
          return;
        }
      }
    } catch (e) {
      console.error("Error checking HR status in UserPermissionsPage:", e);
    }

    if (userId) {
      fetchUser();
    }
  }, [userId, fetchUser, navigate, showToast]);

  const togglePermission = (label) => {
    if (isSuperAdmin) return;
    setSelectedPermissions(prev => 
      prev.includes(label) ? prev.filter(p => p !== label) : [...prev, label]
    );
  };

  const handleSelectAll = () => {
    if (isSuperAdmin) return;
    setSelectedPermissions(ALL_SIDEBAR_ITEMS.map(i => i.label));
  };

  const handleDeselectAll = () => {
    if (isSuperAdmin) return;
    setSelectedPermissions([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(getApiEndpoint(`/users/${userId}/permissions`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          permissions: selectedPermissions,
          isSuperAdmin,
          role: isSuperAdmin ? 'superadmin' : (user?.role === 'superadmin' ? 'admin' : user?.role)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Sidebar permissions updated successfully!", "success");

        if (refetchUser) refetchUser();

        // If updating currently logged in user, refresh localStorage and dispatch storage event
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUserId = currentUser._id || currentUser.id;
        if (String(currentUserId) === String(userId)) {
          const updatedLocalUser = {
            ...currentUser,
            permissions: selectedPermissions,
            isSuperAdmin,
            role: isSuperAdmin ? 'superadmin' : currentUser.role
          };
          localStorage.setItem('user', JSON.stringify(updatedLocalUser));
          window.dispatchEvent(new Event('storage'));
        }

        // Refresh local user state
        fetchUser();
      } else {
        showToast(data.message || "Failed to update permissions.", "error");
      }
    } catch (err) {
      console.error("Error saving permissions:", err);
      showToast("Error saving permissions.", "error");
    } finally {
      setSaving(false);
    }
  };

  const categories = [...new Set(ALL_SIDEBAR_ITEMS.map(i => i.category))];

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3">
        <Loader2 size={36} className="animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading User Permissions...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-base font-bold text-rose-500">User profile not found.</p>
        <button 
          onClick={() => navigate('/users')}
          className="mt-4 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl"
        >
          Return to Users
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/users')}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl shadow-xs transition active:scale-95 cursor-pointer"
            title="Back to Users list"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Sidebar Permissions Configurator
              </h1>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Customize dynamic sidebar pages and platform access for this user
            </p>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-600/25 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shrink-0"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Save Changes</span>
        </button>
      </div>

      {/* User Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-2xl flex items-center justify-center shadow-md overflow-hidden shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user.name?.charAt(0)?.toUpperCase() || 'U'
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{user.name}</h2>
              {isSuperAdmin ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Shield size={12} /> Super Admin
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {user.role || 'Employee'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span className="flex items-center gap-1"><Mail size={12} /> {user.email}</span>
              {user.phone && <span className="flex items-center gap-1"><Phone size={12} /> {user.phone}</span>}
              {user.department && <span className="flex items-center gap-1"><Folder size={12} /> {user.department}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6">
          <div className="text-left md:text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configured Active Pages</p>
            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
              {isSuperAdmin ? 'All Sidebar Pages (Super Admin)' : `${selectedPermissions.length} / ${ALL_SIDEBAR_ITEMS.length} Allowed`}
            </p>
          </div>
        </div>
      </div>

      {/* Super Admin Master Access Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-xl border border-indigo-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl ${isSuperAdmin ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Super Admin Master Privilege</h3>
              <p className="text-xs text-slate-300 font-semibold mt-0.5 max-w-2xl">
                When enabled, this user gains unrestricted access to all pages, shift reports, and administrative management features across the CRM.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              checked={isSuperAdmin}
              onChange={(e) => setIsSuperAdmin(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
          </label>
        </div>
      </div>

      {/* Category-wise Sidebar Access Grid */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Individual Sidebar Page Access
            </h3>
            <p className="text-xs text-slate-400 font-semibold">Toggle check boxes to enable or disable specific navigation links</p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleSelectAll}
              disabled={isSuperAdmin}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <CheckSquare size={14} /> Select All
            </button>
            <button 
              onClick={handleDeselectAll}
              disabled={isSuperAdmin}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <Square size={14} /> Deselect All
            </button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            <CheckCircle2 size={18} />
            <span>Super Admin mode enabled — All sidebar pages are automatically unlocked and accessible to this user.</span>
          </div>
        )}

        {categories.map(category => {
          const categoryItems = ALL_SIDEBAR_ITEMS.filter(i => i.category === category);
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  {category} Pages ({categoryItems.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryItems.map(item => {
                  const isChecked = isSuperAdmin || selectedPermissions.includes(item.label);
                  return (
                    <motion.div 
                      key={item.label}
                      whileHover={{ scale: isSuperAdmin ? 1 : 1.01 }}
                      onClick={() => togglePermission(item.label)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        isChecked 
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-500/40 text-indigo-950 dark:text-indigo-100 shadow-sm' 
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      } ${isSuperAdmin ? 'opacity-75 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{item.label}</p>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold block mt-0.5">{item.path}</span>
                        </div>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          disabled={isSuperAdmin}
                          onChange={() => {}} // handled by parent onClick
                          className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0 mt-1"
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{item.desc}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Save Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Make sure to click <strong className="text-indigo-600 dark:text-indigo-400">Save Changes</strong> to apply permission updates.
        </p>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );
};

export default UserPermissionsPage;
