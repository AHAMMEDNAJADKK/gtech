import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveUserDashboardPath } from '../utils/userDashboard';
import { 
  LayoutDashboard, 
  GraduationCap,
  Settings, 
  LogOut,
  Bell, 
  ChevronLeft, 
  ChevronRight, 
  Wallet, 
  BookOpen, 
  ChevronDown, 
  CheckCircle2, 
  Target, 
  PhoneCall, 
  Video, 
  Clipboard, 
  Layers, 
  School, 
  Award,
  Users,
  UserCheck,
  Briefcase,
  UserCog,
  BarChart3,
  Clock,
  FileText,
  X 
} from 'lucide-react';

const CATEGORY_ORDER = [
  'Admissions',
  'Academics',
  'Employees',
  'Attendance',
  'Assignments',
  'Live Classes',
  'Accounts',
  'Certificates',
  'Reports'
];

const CATEGORY_CONFIG = {
  'Admissions': { label: 'Admissions', icon: Target },
  'Academics': { label: 'Academics', icon: GraduationCap },
  'Employees': { label: 'Employees', icon: Users },
  'Attendance': { label: 'Attendance', icon: Clock },
  'Assignments': { label: 'Assignments', icon: CheckCircle2 },
  'Live Classes': { label: 'Live Classes', icon: Video },
  'Accounts': { label: 'Accounts', icon: Wallet },
  'Certificates': { label: 'Certificates', icon: Award },
  'Reports': { label: 'Reports', icon: BarChart3 }
};

const menuItems = [
  // Standalone Dashboard navigation (rendered directly at top of menu)
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    path: '/dashboard', 
    isStandalone: true,
    allowedRoles: ['0', '1', '2', '3', '10', 'admin', 'superadmin', 'counselor', 'telecaller', 'instructor', 'mentor', 'hr', 'student'] 
  },

  // --- ADMISSIONS ---
  { 
    icon: Target, 
    label: 'Leads & Enquiries', 
    path: '/leads', 
    category: 'Admissions', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'counselor', 'telecaller'],
    allowedDesignationNames: ['counselor', 'telecaller', 'admission', 'academic']
  },
  { 
    icon: PhoneCall, 
    label: 'Counselor Follow-ups', 
    path: '/leads-telecaller', 
    category: 'Admissions', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'counselor', 'telecaller'],
    allowedDesignationNames: ['counselor', 'telecaller', 'admission', 'academic']
  },

  // --- ACADEMICS ---
  { 
    icon: BookOpen, 
    label: 'Courses', 
    path: '/academy/courses', 
    category: 'Academics', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'instructor', 'mentor', 'hr'] 
  },
  { 
    icon: Layers, 
    label: 'Batches', 
    path: '/academy/batches', 
    category: 'Academics', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', 'mentor', 'hr'],
    allowedDesignationNames: ['instructor', 'teacher', 'faculty', 'trainer', 'mentor']
  },
  { 
    icon: School, 
    label: 'Student Progress', 
    path: '/academy/enrollments', 
    category: 'Academics', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'counselor', 'telecaller', 'instructor', 'mentor', 'hr'],
    allowedDesignationNames: ['counselor', 'telecaller', 'admission', 'instructor', 'mentor']
  },
  { 
    icon: GraduationCap, 
    label: 'My LMS Student Portal', 
    path: '/academy/learning', 
    category: 'Academics', 
    allowedRoles: ['10', 'student', 'instructor', 'faculty', 'teacher', 'mentor', '0', '1', '2', 'admin', 'superadmin'],
    allowedDesignationNames: ['student', 'instructor', 'teacher', 'faculty', 'trainer', 'mentor']
  },
  { 
    icon: FileText, 
    label: 'Course Syllabus', 
    path: '/academy/syllabus', 
    category: 'Academics', 
    allowedRoles: ['0', '1', '2', '3', '10', 'admin', 'superadmin', 'counselor', 'telecaller', 'instructor', 'faculty', 'teacher', 'mentor', 'hr', 'student'],
    allowedDesignationNames: ['student', 'admin', 'hr', 'instructor', 'teacher', 'faculty', 'trainer', 'mentor']
  },

  // --- EMPLOYEES ---
  { 
    icon: UserCheck, 
    label: 'Students', 
    path: '/employees/students', 
    category: 'Employees', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'counselor', 'telecaller', 'instructor', 'mentor', 'hr'],
    allowedDesignationNames: ['admin', 'counselor', 'telecaller', 'admission', 'academic', 'instructor', 'faculty', 'teacher', 'trainer', 'mentor', 'hr']
  },
  { 
    icon: Briefcase, 
    label: 'HR', 
    path: '/employees/hr', 
    category: 'Employees', 
    allowedRoles: ['0', 'admin', 'superadmin'],
    allowedDesignationNames: ['admin', 'superadmin']
  },
  { 
    icon: UserCog, 
    label: 'Mentors', 
    path: '/employees/mentors', 
    category: 'Employees', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'hr'],
    allowedDesignationNames: ['admin', 'superadmin', 'hr']
  },

  // --- ATTENDANCE ---
  { 
    icon: Clock, 
    label: 'Attendance Shift Log', 
    path: '/attendance', 
    category: 'Attendance', 
    allowedRoles: ['0', '1', '2', '3', '10', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', 'mentor', 'hr', 'student'],
    allowedDesignationNames: ['admin', 'hr', 'instructor', 'teacher', 'faculty', 'trainer', 'mentor', 'student']
  },
  { 
    icon: UserCheck, 
    label: 'Daily Present / Absent List', 
    path: '/attendance?tab=roster', 
    category: 'Attendance', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', 'mentor', 'hr'],
    allowedDesignationNames: ['admin', 'hr', 'instructor', 'teacher', 'faculty', 'trainer', 'mentor']
  },
  { 
    icon: Clipboard, 
    label: 'Class Attendance Sheets', 
    path: '/student-attendance', 
    category: 'Attendance', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', 'mentor', 'hr'],
    allowedDesignationNames: ['admin', 'hr', 'instructor', 'teacher', 'faculty', 'trainer', 'mentor']
  },

  // --- ASSIGNMENTS ---
  { 
    icon: CheckCircle2, 
    label: 'Assignments & Grading', 
    path: '/assignments', 
    category: 'Assignments', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', 'mentor', 'hr'],
    allowedDesignationNames: ['admin', 'hr', 'instructor', 'teacher', 'faculty', 'trainer', 'mentor']
  },
  { 
    icon: CheckCircle2, 
    label: 'My Assignments', 
    path: '/student/assignments', 
    category: 'Assignments', 
    allowedRoles: ['10', 'student'],
    allowedDesignationNames: ['student']
  },
  { 
    icon: Award, 
    label: 'My Results & Submissions', 
    path: '/student/results', 
    category: 'Assignments', 
    allowedRoles: ['10', 'student'],
    allowedDesignationNames: ['student']
  },

  // --- LIVE CLASSES ---
  { 
    icon: Video, 
    label: 'Live Classrooms', 
    path: '/live-classes', 
    category: 'Live Classes', 
    allowedRoles: ['0', '1', '2', '3', '10', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', 'mentor', 'hr', 'student'],
    allowedDesignationNames: ['instructor', 'teacher', 'faculty', 'trainer', 'mentor', 'hr', 'student']
  },

  // --- ACCOUNTS ---
  { 
    icon: Wallet, 
    label: 'Student Fees & Receipts', 
    path: '/accounts', 
    category: 'Accounts', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', '10', 'student'],
    allowedDesignationNames: ['student', 'accountant', 'accounts']
  },

  // --- CERTIFICATES ---
  { 
    icon: Award, 
    label: 'Certificates', 
    path: '/certificates', 
    category: 'Certificates', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', '10', 'student'],
    allowedDesignationNames: ['student']
  },

  // --- REPORTS ---
  { 
    icon: BarChart3, 
    label: 'Reports & Analytics', 
    path: '/reports', 
    category: 'Reports', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'instructor', 'mentor', 'hr'],
    allowedDesignationNames: ['admin', 'superadmin', 'hr', 'instructor', 'mentor']
  },
  { 
    icon: FileText, 
    label: 'Daily Shift Report', 
    path: '/daily-shift-report', 
    category: 'Reports', 
    allowedRoles: ['0', '1', '2', '3', 'admin', 'superadmin', 'instructor', 'mentor', 'hr', 'counselor', 'telecaller'],
    allowedDesignationNames: ['admin', 'superadmin', 'hr', 'instructor', 'mentor', 'counselor', 'telecaller']
  }
];

// Simple Portal implementation to render the badge safely outside of parent overflow cropping
const PortalTooltip = ({ children }) => {
  return ReactDOM.createPortal(children, document.body);
};

const CategoryDropdownGroup = ({ group, isCollapsed, activePath, onMobileClick }) => {
  const isSingleItem = group.items.length === 1;

  const isAnyChildActive = group.items.some(item => {
    const itemPathOnly = item.path.split('?')[0];
    const activePathOnly = activePath.split('?')[0];
    if (activePath === item.path) return true;
    if (activePathOnly === itemPathOnly) return true;
    return item.children && item.children.some(c => activePath.startsWith(c.path));
  });

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

const StandaloneDashboard = ({ isCollapsed, activePath, userDashboardPath, onMobileClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const itemRef = useRef(null);

  const targetPath = userDashboardPath || '/dashboard';
  const isActive = activePath === '/dashboard' || activePath === '/dashboard/' || activePath === targetPath;

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

  if (isCollapsed) {
    return (
      <div
        ref={itemRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        className="w-full flex justify-center mb-1 relative"
      >
        <Link
          to={targetPath}
          onClick={onMobileClick}
          className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200 cursor-pointer ${
            isActive
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold scale-105'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
          title="Dashboard"
        >
          <LayoutDashboard size={20} />
        </Link>

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
                <span>Dashboard</span>
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-slate-900 dark:bg-slate-800 rotate-45" />
              </motion.div>
            </PortalTooltip>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="mb-1.5">
      <Link
        to={targetPath}
        onClick={onMobileClick}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all duration-150 cursor-pointer ${
          isActive
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-indigo-600 dark:hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-lg ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
          <LayoutDashboard size={18} />
        </div>
        <span className="tracking-tight uppercase text-[11px] font-black">Dashboard</span>
      </Link>
    </div>
  );
};

const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) => {
  const location = useLocation();
  const activePath = location.pathname + (location.search || '');
  const { user: liveUser, setUser } = useUser() || {};
  const [, setPermissionsVersion] = React.useState(0);

  React.useEffect(() => {
    const handleStorageChange = () => {
      setPermissionsVersion(v => v + 1);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Safely resolve the active user with seamless fallback to localStorage
  const user = React.useMemo(() => {
    if (liveUser && typeof liveUser === 'object') return liveUser;
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) return JSON.parse(savedUser);
    } catch (e) {
      console.warn("Failed to parse saved user in Sidebar:", e);
    }
    return null;
  }, [liveUser]);

  // Global role and designation resolution for entire Sidebar component
  const currentUserRole = String(user?.role_id || user?.roleId || user?.role?.name || user?.role || '').toLowerCase().trim();
  const currentDesigName = String(user?.designation || user?.designationId?.name || '').toLowerCase().trim();
  const isStudent = currentUserRole === '10' || currentUserRole === 'student' || currentDesigName === 'student';

  const getVisibleMenuItems = () => {
    try {
      const userObj = user;

      if (!userObj) {
        return menuItems.filter(item => item.path === '/academy/learning' || item.path === '/dashboard');
      }
      
      const isSuperAdminUser = 
        userObj.isSuperAdmin === true ||
        userObj.is_super_admin === true ||
        currentUserRole === 'superadmin' || 
        currentUserRole === 'super_admin' || 
        currentUserRole === '0' || 
        String(userObj.role || '').toLowerCase() === 'superadmin' ||
        String(userObj.role || '').toLowerCase() === '0';

      // 1. Super Admin: Unrestricted access to all CRM modules
      if (isSuperAdminUser) {
        return menuItems;
      }

      // 2. Student: Learning dashboard, syllabus, assignments, submissions, live classes, attendance
      if (isStudent) {
        const studentAllowedPaths = [
          '/academy/learning',
          '/academy/syllabus',
          '/student/assignments',
          '/student/results',
          '/live-classes',
          '/attendance',
          '/accounts',
          '/certificates'
        ];
        return menuItems.filter(item => studentAllowedPaths.includes(item.path));
      }

      // 3. HR Operations: Students, mentors, courses/batches, assignments, live classes, attendance, reports
      const isHR = currentUserRole === 'hr' || (currentUserRole === '2' && !isSuperAdminUser) || currentDesigName.includes('hr');
      if (isHR) {
        const hrAllowedPaths = [
          '/dashboard',
          '/leads',
          '/leads-telecaller',
          '/employees/students',
          '/employees/mentors',
          '/academy/courses',
          '/academy/batches',
          '/academy/enrollments',
          '/academy/syllabus',
          '/assignments',
          '/live-classes',
          '/attendance',
          '/attendance?tab=roster',
          '/student-attendance',
          '/accounts',
          '/reports',
          '/daily-shift-report'
        ];
        return menuItems.filter(item => hrAllowedPaths.includes(item.path));
      }

      // 4. Mentor / Faculty: Teaching scope, my students, assigned courses, assignments & grading, live classes, attendance
      const isMentor = currentUserRole === 'mentor' || currentUserRole === 'instructor' || currentUserRole === '3' || currentDesigName.includes('mentor') || currentDesigName.includes('instructor') || currentDesigName.includes('faculty') || currentDesigName.includes('teacher');
      if (isMentor) {
        const mentorAllowedPaths = [
          '/dashboard',
          '/employees/students',
          '/academy/courses',
          '/academy/batches',
          '/academy/enrollments',
          '/academy/syllabus',
          '/assignments',
          '/live-classes',
          '/attendance',
          '/attendance?tab=roster',
          '/reports',
          '/daily-shift-report'
        ];
        return menuItems.filter(item => mentorAllowedPaths.includes(item.path));
      }

      // 5. Custom permissions if defined
      if (Array.isArray(userObj.permissions) && userObj.permissions.length > 0) {
        const allowedSet = userObj.permissions.map(p => String(p).toLowerCase().trim());
        const customVisible = menuItems.filter(item => {
          const itemLabelLower = item.label.toLowerCase().trim();
          const itemPathLower = item.path ? item.path.toLowerCase().trim() : '';
          return (
            allowedSet.includes(itemLabelLower) ||
            allowedSet.includes(itemPathLower) ||
            allowedSet.includes(item.category ? item.category.toLowerCase().trim() : '')
          );
        });
        if (customVisible.length > 0) return customVisible;
      }

      // 6. Role / Designation Based Matching for Counselor, Instructor, HR, etc.
      const isCounselor = currentUserRole === 'counselor' || currentDesigName.includes('counselor') || currentDesigName.includes('tele');
      const isInstructor = currentUserRole === 'instructor' || currentUserRole === 'mentor' || currentDesigName.includes('instructor') || currentDesigName.includes('faculty') || currentDesigName.includes('teacher') || currentDesigName.includes('trainer') || currentDesigName.includes('mentor');

      const visible = menuItems.filter(item => {
        // If item has no role restrictions, allow it
        if (!item.allowedRoles && !item.allowedDesignationNames) {
          return true;
        }

        const roleMatch = item.allowedRoles && (
          item.allowedRoles.includes(currentUserRole) ||
          (isCounselor && item.allowedRoles.includes('counselor')) ||
          (isInstructor && (item.allowedRoles.includes('instructor') || item.allowedRoles.includes('mentor'))) ||
          (isHR && item.allowedRoles.includes('hr'))
        );

        const desigMatch = item.allowedDesignationNames && item.allowedDesignationNames.some(name =>
          currentDesigName.includes(name) || name.includes(currentDesigName)
        );

        return roleMatch || desigMatch;
      });

      return visible;
    } catch (e) {
      console.error("Error reading operator authorization layout paths:", e);
      return menuItems.filter(item => item.path === '/academy/learning' || item.path === '/dashboard');
    }
  };

  const visibleMenuItems = getVisibleMenuItems();

  // Group visible items by Category (excluding standalone Dashboard and Notifications)
  const groupMenuItemsByCategory = (items) => {
    const groups = {};
    items.forEach(item => {
      if (item.isStandalone || item.path === '/dashboard' || item.path === '/notifications') return;
      const cat = item.category;
      if (!cat) return;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return CATEGORY_ORDER.filter(cat => groups[cat] && groups[cat].length > 0).map(cat => ({
      name: cat,
      items: groups[cat]
    }));
  };

  const groupedMenuItems = groupMenuItemsByCategory(visibleMenuItems);
  const userDashboardPath = resolveUserDashboardPath(user) || '/dashboard';
  const isDashboardActive = activePath === '/dashboard' || activePath === '/dashboard/' || (userDashboardPath && activePath === userDashboardPath);

  const userName = user?.name || user?.fullName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'User');
  const userRoleDisplay = String(user?.role?.name || user?.role || (isStudent ? 'Student' : 'Staff')).toUpperCase();
  const userInitial = (userName.charAt(0) || 'U').toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_id');
    if (typeof setUser === 'function') {
      setUser(null);
    }
  };

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
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-indigo-500/20">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white uppercase block leading-none">EdTech CRM</span>
                  <span className="text-[9px] font-bold text-indigo-500 tracking-wider uppercase">Academy Portal</span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20">
                <GraduationCap size={18} />
              </div>
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

        {/* Menu Items: Standalone Dashboard at Top, followed by Category Accordion Dropdowns */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* 1. Standalone Top Dashboard Item */}
          <StandaloneDashboard
            isCollapsed={isCollapsed}
            activePath={activePath}
            userDashboardPath={userDashboardPath}
          />

          {/* Section Divider */}
          <div className="h-[1px] bg-slate-100 dark:bg-slate-800/60 my-2 mx-1" />

          {/* 2. Feature Categories */}
          {groupedMenuItems.map((group) => (
            <CategoryDropdownGroup
              key={group.name}
              group={group}
              isCollapsed={isCollapsed}
              activePath={activePath}
            />
          ))}
        </div>

        {/* 3. Lower Section: User Profile & Notification & Logout Controls */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          {!isCollapsed ? (
            <div className="space-y-2">
              {/* Profile Card */}
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                    {userName}
                  </p>
                  <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded-md mt-0.5">
                    {userRoleDisplay}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Alerts & Sign Out */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <Link
                  to="/notifications"
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="View Notifications"
                >
                  <Bell size={15} className="shrink-0" />
                  <span>Alerts</span>
                </Link>

                <Link
                  to="/login"
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 transition"
                  title="Sign Out of Session"
                >
                  <LogOut size={15} className="shrink-0" />
                  <span>Sign Out</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div 
                className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-xs cursor-default"
                title={`${userName} (${userRoleDisplay})`}
              >
                {userInitial}
              </div>

              <Link
                to="/notifications"
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Notifications"
              >
                <Bell size={18} />
              </Link>

              <Link
                to="/login"
                onClick={handleLogout}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition"
                title="Sign Out"
              >
                <LogOut size={18} />
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* 2. Mobile Backdrop */}
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black">
              <GraduationCap size={18} />
            </div>
            <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white uppercase">EdTech CRM</span>
          </div>
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {/* Standalone Dashboard */}
          <StandaloneDashboard
            isCollapsed={false}
            activePath={activePath}
            userDashboardPath={userDashboardPath}
            onMobileClick={() => setIsMobileOpen(false)}
          />

          <div className="h-[1px] bg-slate-100 dark:bg-slate-800/60 my-2" />

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

        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 shrink-0 space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {userName}
              </p>
              <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded-md">
                {userRoleDisplay}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              onClick={() => setIsMobileOpen(false)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-50 transition"
            >
              <Bell size={15} />
              <span>Notifications</span>
            </Link>

            <Link
              to="/login"
              onClick={() => {
                handleLogout();
                setIsMobileOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-500 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-50 transition"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </Link>
          </div>
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

  const isParentActive = active || (childrenItems && childrenItems.some(c => location.pathname === c.path));

  if (childrenItems && childrenItems.length > 0) {
    return (
      <div 
        className="w-full relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        ref={itemRef}
      >
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
            isParentActive
              ? 'text-white bg-indigo-600 shadow-md shadow-indigo-500/15'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
          onClick={() => {
            if (isCollapsed && onClick) onClick();
            else setIsOpen(!isOpen);
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center shrink-0">
              {icon}
            </span>
            <span className={`text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
              {label}
            </span>
          </div>

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