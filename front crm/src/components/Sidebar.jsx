import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveUserDashboardPath } from '../utils/userDashboard';
import { 
  LayoutDashboard, 
  UserCheck, 
  ListCheck, 
  Users, 
  GraduationCap,
  Settings, 
  LogOut,
  Building,
  Building2,
  TrendingUp,
  BarChart3,
  BarChart2,
  FileText,
  Sparkles,
  Award,
  Bell,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Briefcase,
  ShieldCheck,
  Wallet,
  PlusCircle,
  DollarSign,
  BookOpen,
  Tag,
  ShoppingBag,
  ShoppingCart,
  Coins,
  ChevronDown,
  Calendar,
  CheckCircle2,
  Receipt,
  CreditCard,
  Target,
  Megaphone,
  Magnet,
  PhoneCall,
  Contact,
  Code2,
  Palette,
  FileCode,
  Lightbulb,
  Paintbrush,
  BookOpenCheck,
  Video,
  FileVideo,
  ClipboardCheck,
  Sliders,
  Calculator,
  PieChart,
  ClipboardList,
  Clock,
  Clipboard,
  Layers,
  School,
  UsersRound,
  UserCog,
  BookCheck,
  X
} from 'lucide-react';

const CATEGORY_ORDER = [
  'Overview',
  'Dashboards',
  'People & HR',
  'Sales & CRM',
  'Marketing & Work',
  'Finance & Payroll',
  'Academy & LMS',
  'Reports',
  'Daily Operations'
];

const CATEGORY_CONFIG = {
  'Overview': { label: 'Overview', icon: LayoutDashboard },
  'Dashboards': { label: 'Dashboards', icon: LayoutDashboard },
  'People & HR': { label: 'People & HR', icon: Users },
  'Sales & CRM': { label: 'Sales & CRM', icon: Target },
  'Marketing & Work': { label: 'Marketing & Work', icon: Megaphone },
  'Finance & Payroll': { label: 'Finance & Payroll', icon: Wallet },
  'Academy & LMS': { label: 'Academy & LMS', icon: GraduationCap },
  'Reports': { label: 'Reports', icon: BarChart3 },
  'Daily Operations': { label: 'Daily Operations', icon: Clock }
};

const menuItems = [
  // --- OVERVIEW ---
  { icon: CheckCircle2, label: 'Approvals', path: '/approvals', category: 'Overview', allowedRoles: ['0', '1', '2', '10', 'admin', 'superadmin', 'MD', 'COO', 'EXECUTIVE_DIRECTOR'], allowedDepartmentNames: ['hr', 'admin', 'management'] },
  { icon: Calendar, label: 'Leave Requests', path: '/leaves', category: 'Overview' },
  { icon: Bell, label: 'Notifications', path: '/notifications', category: 'Overview' },

  // --- DASHBOARDS ---
  { icon: LayoutDashboard, label: 'Admin Dashboard', path: '/dashboard', category: 'Dashboards', allowedRoles: ['0', '1', '2', '10', 'admin', 'superadmin', 'MD', 'COO', 'EXECUTIVE_DIRECTOR'], allowedDepartmentNames: ['hr', 'admin', 'hr/admin', 'hr & admin'] },
  { icon: TrendingUp, label: 'MD Dashboard', path: '/md-dashboard', category: 'Dashboards', allowedRoles: ['0', '1', '2', '10', 'admin', 'superadmin', 'MD', 'COO', 'EXECUTIVE_DIRECTOR'], allowedDepartmentNames: ['hr', 'admin', 'management'] },
  { icon: UserCog, label: 'HR Dashboard', path: '/hr-dashboard', category: 'Dashboards', allowedDesignationNames: ['hr', 'recruiter'] },
  { icon: Target, label: 'Lead Dashboard', path: '/lead-dashboard', category: 'Dashboards', allowedRoles: ['1', '2', '3', '10', 'hr', 'admin', 'superadmin', 'manager', 'team_lead', 'teamlead', 'tl'], allowedDepartmentNames: ['counselor', 'sales', 'ops', 'marketing'], allowedDesignationNames: ['counselor', 'telecaller', 'ops'] },
  { icon: Megaphone, label: 'Marketing Dashboard', path: '/marketing-dashboard', category: 'Dashboards', allowedRoles: ['1', '2', '3', '10', 'hr', 'admin', 'superadmin', 'marketing', 'manager', 'team_lead', 'teamlead', 'tl'], allowedDepartmentNames: ['marketing', 'digital'] },
  { icon: Video, label: 'Video Dashboard', path: '/videographer-dashboard', category: 'Dashboards', allowedDesignationNames: ['video', 'editor', 'media'] },
  { icon: Palette, label: 'GD Dashboard', path: '/graphic-designer-dashboard', category: 'Dashboards', allowedDesignationNames: ['graphic', 'designer', 'ui', 'ux'] },
  { icon: Code2, label: 'Dev Dashboard', path: '/developer-dashboard', category: 'Dashboards', allowedDepartmentNames: ['r&d', 'dev', 'developer', 'development'] },
  { icon: GraduationCap, label: 'Counselor Dashboard', path: '/counselor-dashboard', category: 'Dashboards', allowedDesignationNames: ['counselor', 'academic', 'tele'] },
  { icon: Wallet, label: 'Accountant Dashboard', path: '/accountant-dashboard', category: 'Dashboards', allowedRoles: ['0', '1', '2', '10', 'hr', 'admin', 'accountant', 'superadmin', 'MD', 'COO', 'EXECUTIVE_DIRECTOR'], allowedDepartmentNames: ['accounts', 'finance'], allowedDesignationNames: ['accountant', 'accounts', 'finance'] },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/common-dashboard', category: 'Dashboards', isCommonDashboardFallback: true },

  // --- PEOPLE & HR ---
  { icon: UserCheck, label: 'Recruitment', path: '/recruitment', category: 'People & HR', allowedRoles: ['0', '1', '2', '3', '10', 'hr', 'admin', 'superadmin', 'manager', 'team_lead', 'teamlead', 'recruiter'], allowedDesignationNames: ['hr', 'recruiter', 'admin', 'manager'] },
  { icon: Users, label: 'Users', path: '/users', category: 'People & HR', allowedRoles: ['1', '2', 'hr', 'admin'], allowedDepartmentNames: ['hr', 'admin'] },
  { icon: Building, label: 'Departments', path: '/departments', category: 'People & HR', allowedRoles: ['1', '2', 'hr', 'admin'] },
  { icon: ShieldCheck, label: 'Sidebar Permissions', path: '/sidebar-permissions', category: 'People & HR', allowedRoles: ['0', 'superadmin'], allowedDepartmentNames: ['hr', 'admin', 'hr/admin', 'hr & admin'] },

  // --- SALES & CRM ---
  { icon: Magnet, label: 'Leads Directory', path: '/leads', category: 'Sales & CRM', allowedDepartmentNames: ['marketing', 'digital', 'counselor', 'sales'], allowedRoles: ['1', '2', 'hr', 'admin', 'superadmin'] },
  { icon: PhoneCall, label: 'Telecaller Leads', path: '/leads-telecaller', category: 'Sales & CRM', allowedDesignationNames: ['counselor', 'telecaller', 'ops'], allowedRoles: ['1', '2', 'hr', 'admin', 'superadmin'], allowedDepartmentNames: ['hr', 'admin'] },
  { icon: Contact, label: 'Lead Counselor', path: '/lead-counselor', category: 'Sales & CRM', allowedDesignationNames: ['ops', 'counselor', 'sales'], allowedRoles: ['1', '2', '3', 'hr', 'admin', 'superadmin'] },
  { icon: Briefcase, label: 'Client Leads', path: '/client-leads', category: 'Sales & CRM', allowedRoles: ['1', '2', '10', 'hr', 'admin', 'superadmin', 'manager', 'team_lead', 'teamlead'] },
  { icon: Building2, label: 'Clients', path: '/clients', category: 'Sales & CRM', allowedRoles: ['1', '2', '10', 'hr', 'admin', 'superadmin', 'manager', 'team_lead', 'teamlead'] },

  // --- MARKETING & WORK ---
  { icon: Calendar, label: 'Content Calendar', path: '/calendar-work', category: 'Marketing & Work' },
  { icon: FolderKanban, label: 'Projects', path: '/projects', category: 'Marketing & Work', allowedRoles: ['1', '2', '10', 'hr', 'admin', 'superadmin', 'manager', 'team_lead', 'teamlead'] },

  // --- FINANCE & PAYROLL ---
  { icon: Wallet, label: 'Accounts', path: '/accounts', category: 'Finance & Payroll', children: [
      { icon: Coins, label: 'Capital', path: '/accounts/capital' },
      { icon: TrendingUp, label: 'Sales', path: '/accounts/sales' },
      { icon: ShoppingBag, label: 'Income', path: '/accounts/income' },
      { icon: ShoppingCart, label: 'Purchase', path: '/accounts/purchase' },
      { icon: Tag, label: 'Expense Categories', path: '/accounts/categories' },
      { icon: PlusCircle, label: 'Expense', path: '/accounts/expenses' },
      { icon: DollarSign, label: 'Salary Payment', path: '/accounts/salary' },
      { icon: BookCheck, label: 'Cash & Bank', path: '/accounts/cash-book' },
      { icon: Layers, label: 'Operation', path: '/accounts/operation' },
      { icon: BarChart3, label: 'Profit and Loss', path: '/accounts/reports' }
    ]
  },
  { icon: TrendingUp, label: 'Income', path: '/accounts/income', category: 'Finance & Payroll', allowedRoles: ['0', '1', '2', '10', 'hr', 'admin', 'accountant', 'superadmin', 'MD', 'COO', 'EXECUTIVE_DIRECTOR'], allowedDepartmentNames: ['hr', 'admin', 'accounts', 'finance'], allowedDesignationNames: ['hr', 'recruiter', 'accountant', 'finance', 'accounts'] },
  { icon: Receipt, label: 'Payslips', path: '/payslips', category: 'Finance & Payroll', allowedRoles: ['0', '1', '2', '10', 'hr', 'admin', 'accountant', 'superadmin', 'MD', 'COO', 'EXECUTIVE_DIRECTOR'], allowedDepartmentNames: ['hr', 'admin', 'accounts', 'finance'], allowedDesignationNames: ['hr', 'recruiter', 'accountant', 'finance', 'accounts'] },
  { icon: CreditCard, label: 'Personal Payslip', path: '/my-payslip', category: 'Finance & Payroll' },

  // --- ACADEMY & LMS ---
  { icon: BookOpen, label: 'Course Management', path: '/academy/courses', category: 'Academy & LMS', allowedRoles: ['1', '2', 'hr', 'admin'], allowedDepartments: ['6a3caed51194353cbc8a3686'] },
  { icon: Layers, label: 'Batches', path: '/academy/batches', category: 'Academy & LMS', allowedRoles: ['1', '2', 'hr', 'admin'], allowedDepartments: ['6a3caed51194353cbc8a3686'] },
  { icon: School, label: 'Enrollment Tracking', path: '/academy/enrollments', category: 'Academy & LMS', allowedRoles: ['1', '2', 'hr', 'admin'], allowedDepartments: ['6a3caed51194353cbc8a3686'] },
  { icon: GraduationCap, label: 'My LMS Learning', path: '/academy/learning', category: 'Academy & LMS', allowedRoles: ['10', 'student', '1', '2', 'admin', 'superadmin'] },
  { icon: Clipboard, label: 'Student Attendance', path: '/student-attendance', category: 'Academy & LMS', allowedRoles: ['1', '2', 'hr', 'admin'] },

  // --- REPORTS ---
  { icon: ClipboardCheck, label: 'HR Shift Report', path: '/hr-report', category: 'Reports', allowedDesignationNames: ['hr', 'recruiter'] },
  { icon: Calculator, label: 'Accountant Shift Report', path: '/accountant-report', category: 'Reports', allowedDesignationNames: ['accountant', 'accounts', 'finance'] },
  { icon: Sparkles, label: 'AI Reports', path: '/ai-report', category: 'Reports' },
  { icon: Award, label: 'KPI Analytics', path: '/performance-dashboard', category: 'Reports', allowedRoles: ['1', '2', '10', 'hr', 'admin', 'superadmin', 'manager', 'team_lead', 'teamlead', 'tl'] },
  { icon: BarChart2, label: 'Employee Reports', path: '/employee-reports', category: 'Reports', allowedRoles: ['hr', 'admin'] },
  { icon: UsersRound, label: 'Team Reports', path: '/team-reports', category: 'Reports', isTeamLeadOnly: true },
  { icon: FileCode, label: 'Developer Report', path: '/developer-report', category: 'Reports', allowedDesignationNames: ['developer', 'dev', 'junior', 'jr', 'software', 'engineer', 'react', 'node', 'flutter', 'coder', 'programmer', 'frontend', 'backend', 'fullstack', 'web'] },
  { icon: Lightbulb, label: 'HOD R&D Report', path: '/hod-rd-report', category: 'Reports', allowedDesignationNames: ['hod', 'r&d', 'research'] },
  { icon: Paintbrush, label: 'Graphic Designer Report', path: '/graphic-designer-report', category: 'Reports', allowedDesignationNames: ['graphic', 'designer', 'ui', 'ux'] },
  { icon: FileVideo, label: 'Videographer Report', path: '/videographer-report', category: 'Reports', allowedDesignationNames: ['video', 'editor', 'media'] },
  { icon: BookOpenCheck, label: 'Academic Counselor Report', path: '/academic-counselor-report', category: 'Reports', allowedDesignationNames: ['counselor', 'academic', 'tele'] },
  { icon: Sliders, label: 'Ops Shift Report', path: '/ops-report', category: 'Reports', allowedDesignationNames: ['ops', 'operation', 'sales'] },
  { icon: PieChart, label: 'Marketing Shift Report', path: '/marketing-report', category: 'Reports', allowedDesignationNames: ['marketing', 'marketer', 'digital'] },
  { icon: Megaphone, label: 'HOD Marketing Report', path: '/hod-marketing-report', category: 'Reports', allowedRoles: ['1', '2', 'admin', 'hr', 'superadmin', 'manager'], allowedDesignationNames: ['marketing', 'marketer', 'hod', 'head', 'cmo', 'digital'] },
  { icon: ClipboardList, label: 'Daily Report', path: '/basic-report', category: 'Reports', isBasicReportFallback: true },

  // --- DAILY OPERATIONS ---
  { icon: Clock, label: 'Attendance', path: '/attendance', category: 'Daily Operations', excludeRoles: ['1', '2', 'hr', 'admin'] },
  { icon: ListCheck, label: 'Task Assign', path: '/todo', category: 'Daily Operations' },
];

// Simple Portal implementation to render the badge safely outside of parent overflow cropping
const PortalTooltip = ({ children }) => {
  return ReactDOM.createPortal(children, document.body);
};

const CategoryDropdownGroup = ({ group, isCollapsed, activePath, onMobileClick }) => {
  const isSingleItem = group.items.length === 1;

  const isAnyChildActive = group.items.some(item => 
    activePath === item.path || (item.children && item.children.some(c => activePath === c.path))
  );

  const [isOpen, setIsOpen] = useState(isAnyChildActive);
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const categoryRef = useRef(null);

  useEffect(() => {
    if (isAnyChildActive) {
      setIsOpen(true);
    }
  }, [isAnyChildActive]);

  // When sidebar is collapsed / closed: Show ONLY the main category icon!
  if (isCollapsed) {
    const catMeta = CATEGORY_CONFIG[group.name] || { label: group.name, icon: Layers };
    const mainItem = group.items[0];
    const CategoryIcon = isSingleItem ? mainItem.icon : catMeta.icon;
    const activeItem = group.items.find(i => activePath === i.path || (i.children && i.children.some(c => activePath === c.path)));
    const targetPath = isSingleItem ? mainItem.path : (activeItem ? activeItem.path : group.items[0].path);
    const tooltipLabel = isSingleItem ? mainItem.label : group.name;

    const handleMouseEnter = () => {
      if (categoryRef.current) {
        const rect = categoryRef.current.getBoundingClientRect();
        setCoords({
          top: rect.top + rect.height / 2,
          left: rect.right + 12,
        });
      }
      setIsHovered(true);
    };

    return (
      <div 
        ref={categoryRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        className="w-full flex justify-center my-1.5 relative"
      >
        <Link
          to={targetPath}
          onClick={onMobileClick}
          className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200 cursor-pointer ${
            isAnyChildActive
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold scale-105'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <CategoryIcon size={20} />
        </Link>

        {/* Floating Tooltip Badge on Hover */}
        <AnimatePresence>
          {isHovered && (
            <PortalTooltip>
              <motion.div 
                initial={{ opacity: 0, x: -10, y: '-50%' }}
                animate={{ opacity: 1, x: 0, y: '-50%' }}
                exit={{ opacity: 0, x: -10, y: '-50%' }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                }}
                className="fixed pointer-events-none z-[9999] px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-bold rounded-xl shadow-xl border border-slate-700/50 whitespace-nowrap -translate-y-1/2 flex items-center gap-2"
              >
                <span>{tooltipLabel}</span>
                {!isSingleItem && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-700 dark:bg-slate-700 text-indigo-300 font-bold">
                    {group.items.length} items
                  </span>
                )}
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-slate-900 dark:bg-slate-800 rotate-45" />
              </motion.div>
            </PortalTooltip>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Single item in expanded category -> No head, render directly as item
  if (isSingleItem) {
    const item = group.items[0];
    return (
      <NavItem 
        key={`${item.path}-${item.label}`}
        icon={<item.icon size={20} />} 
        label={item.label} 
        to={item.path} 
        active={activePath === item.path || (item.children && item.children.some(c => activePath === c.path))} 
        isCollapsed={isCollapsed}
        childrenItems={item.children}
        onClick={onMobileClick}
      />
    );
  }

  const catMeta = CATEGORY_CONFIG[group.name] || { label: group.name, icon: Layers };
  const CategoryIcon = catMeta.icon;

  return (
    <div className="w-full space-y-1 select-none my-1">
      {/* Category Dropdown Toggle Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
          isAnyChildActive
            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-semibold'
        }`}
        title={isOpen ? `Collapse ${group.name}` : `Expand ${group.name}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <CategoryIcon size={18} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wide truncate">
            {group.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {group.items.length}
          </span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Sub-items List inside Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-2 space-y-1 border-l-2 border-slate-200 dark:border-slate-800 ml-3.5 mt-1"
          >
            {group.items.map((item) => (
              <NavItem 
                key={`${item.path}-${item.label}`}
                icon={<item.icon size={18} />} 
                label={item.label} 
                to={item.path} 
                active={activePath === item.path || (item.children && item.children.some(c => activePath === c.path))} 
                isCollapsed={isCollapsed}
                childrenItems={item.children}
                onClick={onMobileClick}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) => {
  const location = useLocation();
  const activePath = location.pathname;
  const { user: liveUser } = useUser() || {};
  const [, setPermissionsVersion] = React.useState(0);

  React.useEffect(() => {
    const handleStorageChange = () => {
      setPermissionsVersion(v => v + 1);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getVisibleMenuItems = () => {
    try {
      let userObj = liveUser;
      if (!userObj) {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try { userObj = JSON.parse(savedUser); } catch (e) {}
        }
      }

      if (!userObj) {
        return menuItems.filter(item => !item.allowedRoles && !item.allowedDepartments && !item.allowedDesignations);
      }

      const currentUserRole = String(userObj.role_id || userObj.roleId || userObj.role || '').toLowerCase().trim();
      const isSuperAdminUser = 
        userObj.isSuperAdmin === true ||
        userObj.is_super_admin === true ||
        currentUserRole === 'superadmin' || 
        currentUserRole === 'super_admin' || 
        currentUserRole === 'super admin' || 
        currentUserRole === '0' || 
        String(userObj.role || '').toLowerCase() === 'superadmin' ||
        String(userObj.role || '').toLowerCase() === '0';

      // 1. Super Admin access: Full access to all sidebar items for Super Admin
      if (isSuperAdminUser) {
        return menuItems.filter(item => !item.isCommonDashboardFallback && !item.isBasicReportFallback);
      }

      // 2. Custom Sidebar Permissions set by Super Admin for this user
      if (Array.isArray(userObj.permissions) && userObj.permissions.length > 0) {
        const allowedSet = userObj.permissions.map(p => String(p).toLowerCase().trim());
        
        // Map extra permission labels to sidebar paths
        const extraPathMappings = {
          'admin dashboard': '/dashboard',
          'md dashboard': '/md-dashboard',
          'accountant dashboard': '/accountant-dashboard',
          'income': '/accounts/income',
          'sales': '/accounts/sales',
          'capital': '/accounts/capital',
          'purchase': '/accounts/purchase',
          'create invoice': '/accounts/create-invoice',
        };
        const extraAllowedPaths = [];
        for (const perm of allowedSet) {
          if (extraPathMappings[perm]) {
            extraAllowedPaths.push(extraPathMappings[perm].toLowerCase());
          }
        }
        
        let customVisible = menuItems
          .map(item => {
            const itemLabelLower = item.label.toLowerCase().trim();
            const itemPathLower = item.path ? item.path.toLowerCase().trim() : '';

            const isParentAllowed = 
              item.path === '/leaves' ||
              allowedSet.includes(itemLabelLower) || 
              allowedSet.includes(itemPathLower) ||
              extraAllowedPaths.includes(itemPathLower);

            if (item.children) {
              const allowedChildren = item.children.filter(child => {
                const childLabelLower = child.label.toLowerCase().trim();
                const childPathLower = child.path ? child.path.toLowerCase().trim() : '';
                return isParentAllowed || allowedSet.includes(childLabelLower) || allowedSet.includes(childPathLower);
              });

              if (allowedChildren.length > 0) {
                return { ...item, children: allowedChildren };
              }
              return isParentAllowed ? item : null;
            }

            return isParentAllowed ? item : null;
          })
          .filter(Boolean);

        // If MD Dashboard permission is granted, override Dashboard path to /md-dashboard
        if (allowedSet.includes('md dashboard') && !allowedSet.includes('dashboard') && !allowedSet.includes('admin dashboard')) {
          customVisible = customVisible.map(item => {
            if (item.label === 'Dashboard' && item.path === '/dashboard') {
              return { ...item, path: '/md-dashboard' };
            }
            return item;
          });
        }

        if (customVisible.length > 0) {
          // Fallback dashboard: if user has no dashboard in custom permissions
          const hasDashboard = customVisible.some(item => item.label.toLowerCase().includes('dashboard'));
          if (!hasDashboard) {
            const fallbackDashboard = menuItems.find(item => item.isCommonDashboardFallback);
            if (fallbackDashboard) customVisible.unshift(fallbackDashboard);
          }

          // Fallback report: if user has no report page in custom permissions
          const hasReport = customVisible.some(item => item.label.toLowerCase().includes('report'));
          if (!hasReport) {
            const fallbackReport = menuItems.find(item => item.isBasicReportFallback);
            if (fallbackReport) customVisible.push(fallbackReport);
          }

          return customVisible;
        }
      }
      
      const deptName = userObj.department || userObj.departmentId?.name || '';
      const isNonOperational = String(deptName).toLowerCase().trim() === 'non-operational';
      if (isNonOperational) {
        return menuItems.filter(item => item.label === 'Employee Reports' || item.label === 'Dashboard' || item.path === '/leaves');
      }

      let currentUserDept = '';
      if (userObj.departmentId) {
        if (typeof userObj.departmentId === 'object' && userObj.departmentId._id) {
          currentUserDept = String(userObj.departmentId._id).trim();
        } else {
          currentUserDept = String(userObj.departmentId).trim();
        }
      }

      let currentUserDesignation = '';
      if (userObj.designationId) {
        if (typeof userObj.designationId === 'object' && userObj.designationId._id) {
          currentUserDesignation = String(userObj.designationId._id).trim();
        } else {
          currentUserDesignation = String(userObj.designationId).trim();
        }
      } else if (userObj.designation_id) {
        currentUserDesignation = String(userObj.designation_id).trim();
      }
      
      const visible = menuItems.filter(item => {
        if (item.excludeRoles && item.excludeRoles.includes(currentUserRole)) {
          return false;
        }
        // Show Team Reports page only for non-HR department team leads
        if (item.isTeamLeadOnly) {
          const desigName = String(userObj.designation || userObj.designationId?.name || '').toLowerCase().trim();
          const isHrUser = currentUserRole === 'hr' || desigName.includes('hr');
          if (isHrUser) return false;
          return !!userObj.isTeamLead;
        }
        if (item.isCommonDashboardFallback || item.isBasicReportFallback) {
          return false;
        }
        if (item.label === 'Clients' || item.label === 'Projects' || item.label === 'Client Leads' || item.label === 'KPI Analytics' || item.label === 'Lead Dashboard' || item.label === 'Marketing Dashboard') {
          const isAdminHrOrTeamLead = ['1', '2', '3', '10', 'admin', 'hr', 'superadmin', 'team_lead', 'teamlead', 'manager', 'tl', 'marketing'].includes(currentUserRole) || !!userObj.isTeamLead;
          return isAdminHrOrTeamLead;
        }
        if (!item.allowedRoles && !item.allowedDepartments && !item.allowedDesignations && !item.allowedDepartmentNames && !item.allowedDesignationNames) return true;
        const roleMatch = item.allowedRoles && item.allowedRoles.includes(currentUserRole);
        const deptMatch = item.allowedDepartments && item.allowedDepartments.includes(currentUserDept);
        const designationMatch = item.allowedDesignations && item.allowedDesignations.includes(currentUserDesignation);
        
        // Name-based department matching (works across environments)
        const currentDeptName = String(deptName).toLowerCase().trim();
        const deptNameMatch = item.allowedDepartmentNames && item.allowedDepartmentNames.some(name => 
          currentDeptName.includes(name) || name.includes(currentDeptName)
        );

        // Name-based designation matching (works across environments)
        const currentDesigName = String(userObj.designation || userObj.designationId?.name || '').toLowerCase().trim();
        const desigNameMatch = item.allowedDesignationNames && item.allowedDesignationNames.some(name => 
          currentDesigName.includes(name) || name.includes(currentDesigName)
        );
        
        const matches = [];
        if (item.allowedRoles) matches.push(roleMatch);
        if (item.allowedDepartments) matches.push(deptMatch);
        if (item.allowedDesignations) matches.push(designationMatch);
        if (item.allowedDepartmentNames) matches.push(deptNameMatch);
        if (item.allowedDesignationNames) matches.push(desigNameMatch);
        
        return matches.some(m => m === true);
      });

      // Fallback dashboard: if user has no other dashboard in visible items
      const hasOtherDashboard = visible.some(item => item.label.toLowerCase().includes('dashboard'));
      if (!hasOtherDashboard) {
        const fallbackDashboard = menuItems.find(item => item.isCommonDashboardFallback);
        if (fallbackDashboard) visible.unshift(fallbackDashboard);
      }

      // Fallback report: if user has no other report page in visible items
      const hasOtherReport = visible.some(item => item.label.toLowerCase().includes('report'));
      if (!hasOtherReport) {
        const fallbackReport = menuItems.find(item => item.isBasicReportFallback);
        if (fallbackReport) {
          visible.push(fallbackReport);
        }
      }

      // Determine the user's primary dashboard and place it at the VERY TOP of the sidebar under Overview
      const userDashboardPath = resolveUserDashboardPath(userObj);
      let primaryDash = menuItems.find(item => item.path === userDashboardPath);
      if (!primaryDash) {
        primaryDash = visible.find(item => item.label.toLowerCase().includes('dashboard'));
      }

      let finalVisible = [...visible];
      if (primaryDash) {
        // Remove existing copy if present
        finalVisible = finalVisible.filter(item => item.path !== primaryDash.path && item.label !== primaryDash.label);
        // Unshift primary dashboard at the top under Overview category
        finalVisible.unshift({ ...primaryDash, category: 'Overview' });
      }

      return finalVisible;
    } catch (e) {
      console.error("Error reading operator authorization layout paths:", e);
      return menuItems.filter(item => !item.allowedRoles && !item.allowedDepartments && !item.allowedDesignations);
    }
  };

  const visibleMenuItems = getVisibleMenuItems();

  // Group visible items by Category
  const groupMenuItemsByCategory = (items) => {
    const groups = {};
    items.forEach(item => {
      const cat = item.category || 'Overview';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return CATEGORY_ORDER.filter(cat => groups[cat] && groups[cat].length > 0).map(cat => ({
      name: cat,
      items: groups[cat]
    }));
  };

  const groupedMenuItems = groupMenuItemsByCategory(visibleMenuItems);

  return (
    <>
      {/* 1. Desktop Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/50 dark:border-slate-800/50 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo header */}
        <div className="h-16 flex items-center justify-between px-5 shrink-0 overflow-hidden border-b border-slate-100 dark:border-slate-800/40">
          <div className="flex items-center gap-3">
            {!isCollapsed ? (
              <img src="/logo3.png" alt="StaffHQ Logo" className="h-8 w-auto object-contain" />
            ) : (
              <img src="/logo2.png" alt="StaffHQ Logo Icon" className="h-8 w-8 object-contain shrink-0" />
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(prev => {
                const nextState = !prev;
                localStorage.setItem('sidebarCollapsed', JSON.stringify(nextState));
                return nextState;
              });
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Menu Items (Grouped as Category Accordion Dropdowns) */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groupedMenuItems.map((group) => (
            <CategoryDropdownGroup
              key={group.name}
              group={group}
              isCollapsed={isCollapsed}
              activePath={activePath}
            />
          ))}
        </div>

        {/* Logout (Bottom-aligned) */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/80 shrink-0">
          <NavItem 
            icon={<LogOut size={20} />} 
            label="Logout" 
            to="/" 
            active={false} 
            isLogout={true}
            isCollapsed={isCollapsed}
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              localStorage.removeItem('user_id');
            }}
          />
        </div>
      </aside>

      {/* 2. Mobile Sidebar Slide-over Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* 3. Mobile Sidebar Slide-over Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col transition-transform duration-300 lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <img src="/logo3.png" alt="StaffHQ Logo" className="h-8 w-auto object-contain" />
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {groupedMenuItems.map((group) => (
            <CategoryDropdownGroup
              key={group.name}
              group={group}
              isCollapsed={false}
              activePath={activePath}
              onMobileClick={() => setIsMobileOpen(false)}
            />
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 shrink-0">
          <Link
            to="/"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              localStorage.removeItem('user_id');
              setIsMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-medium"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="text-sm font-medium">Logout</span>
          </Link>
        </div>
      </aside>
    </>
  );
};

const NavItem = ({ icon, label, to, active, isLogout, isCollapsed, onClick, childrenItems }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(() => {
    if (childrenItems && childrenItems.some(c => location.pathname.startsWith(c.path))) {
      return true;
    }
    return false;
  });

  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const itemRef = useRef(null);

  const handleMouseEnter = () => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 12,
      });
    }
    setIsHovered(true);
  };

  const isParentActive = active || (childrenItems && childrenItems.some(c => location.pathname.startsWith(c.path)));

  if (childrenItems && childrenItems.length > 0) {
    return (
      <div className="w-full space-y-1 select-none">
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setIsHovered(false)}
          ref={itemRef}
          className="relative w-full flex items-center justify-between group"
        >
          <Link
            to={to}
            onClick={(e) => {
              setIsOpen(true);
              if (onClick) onClick(e);
            }}
            className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 
              ${isParentActive 
                ? 'text-white bg-indigo-600 shadow-md shadow-indigo-500/15 font-semibold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-medium'
              }`}
          >
            <span className="flex items-center justify-center shrink-0">
              {icon}
            </span>
            <span className={`text-sm transition-all duration-200 whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
              {label}
            </span>
          </Link>

          {!isCollapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className={`p-2 rounded-xl transition-colors ${
                isParentActive
                  ? 'text-white/80 hover:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title={isOpen ? "Collapse Submenu" : "Expand Submenu"}
            >
              <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Floating label badge when collapsed */}
        <AnimatePresence>
          {isHovered && isCollapsed && (
            <PortalTooltip>
              <motion.span 
                initial={{ opacity: 0, x: -10, y: '-50%' }}
                animate={{ opacity: 1, x: 0, y: '-50%' }}
                exit={{ opacity: 0, x: -10, y: '-50%' }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                }}
                className="fixed pointer-events-none z-[9999] px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded-lg shadow-md border border-slate-200 dark:border-slate-800 whitespace-nowrap -translate-y-1/2"
              >
                {label}
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-white dark:bg-slate-900 rotate-45 border-l border-b border-slate-200 dark:border-slate-800" />
              </motion.span>
            </PortalTooltip>
          )}
        </AnimatePresence>

        {/* Child Items */}
        <AnimatePresence>
          {isOpen && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pl-3 space-y-1 border-l-2 border-slate-100 dark:border-slate-800 ml-4 mt-1"
            >
              {childrenItems.map(child => {
                const childActive = location.pathname === child.path;
                const ChildIcon = child.icon;
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    onClick={onClick}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      childActive
                        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <ChildIcon size={14} className="shrink-0" />
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link 
      to={to} 
      onClick={onClick} 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      ref={itemRef}
      className="relative flex items-center justify-start shrink-0 group select-none w-full"
    >
      <div
        className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 
          ${active 
            ? 'text-white bg-indigo-600 shadow-md shadow-indigo-500/15' 
            : isLogout 
              ? 'text-rose-500 hover:bg-rose-500/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
      >
        <span className="flex items-center justify-center shrink-0">
          {icon}
        </span>
        <span className={`text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
          {label}
        </span>
      </div>
      
      {/* Portalled Floating Label Badge to make sure it bypasses all overflow constraints */}
      <AnimatePresence>
        {isHovered && isCollapsed && (
          <PortalTooltip>
            <motion.span 
              initial={{ opacity: 0, x: -10, y: '-50%' }}
              animate={{ opacity: 1, x: 0, y: '-50%' }}
              exit={{ opacity: 0, x: -10, y: '-50%' }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
              }}
              className="fixed pointer-events-none z-[9999] px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded-lg shadow-md border border-slate-200 dark:border-slate-800 whitespace-nowrap -translate-y-1/2"
            >
              {label}
              
              {/* Desktop Side Arrow Pin Indicator */}
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-white dark:bg-slate-900 rotate-45 border-l border-b border-slate-200 dark:border-slate-800" />
            </motion.span>
          </PortalTooltip>
        )}
      </AnimatePresence>
    </Link>
  );
};

export default Sidebar;