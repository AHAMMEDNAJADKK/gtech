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
  X 
} from 'lucide-react';

const CATEGORY_ORDER = [
  'Overview',
  'Admissions',
  'Academics',
  'Attendance',
  'Assignments',
  'Accounts',
  'Live Classes',
  'Certificates',
  'Settings'
];

const CATEGORY_CONFIG = {
  'Overview': { label: 'Overview', icon: LayoutDashboard },
  'Admissions': { label: 'Admissions', icon: Target },
  'Academics': { label: 'Academics', icon: GraduationCap },
  'Attendance': { label: 'Attendance', icon: Clipboard },
  'Assignments': { label: 'Assignments', icon: CheckCircle2 },
  'Accounts': { label: 'Accounts', icon: Wallet },
  'Live Classes': { label: 'Live Classes', icon: Video },
  'Certificates': { label: 'Certificates', icon: Award },
  'Settings': { label: 'Settings', icon: Settings }
};

const menuItems = [
  // --- OVERVIEW ---
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    path: '/dashboard', 
    category: 'Overview', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'counselor', 'telecaller', 'instructor'] 
  },
  { 
    icon: Bell, 
    label: 'Notifications', 
    path: '/notifications', 
    category: 'Overview' 
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
    label: 'Course Management', 
    path: '/academy/courses', 
    category: 'Academics', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin'] 
  },
  { 
    icon: Layers, 
    label: 'Batches', 
    path: '/academy/batches', 
    category: 'Academics', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher'],
    allowedDesignationNames: ['instructor', 'teacher', 'faculty', 'trainer']
  },
  { 
    icon: School, 
    label: 'Enrollments', 
    path: '/academy/enrollments', 
    category: 'Academics', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'counselor', 'telecaller'],
    allowedDesignationNames: ['counselor', 'telecaller', 'admission']
  },
  { 
    icon: GraduationCap, 
    label: 'My Learning LMS', 
    path: '/academy/learning', 
    category: 'Academics', 
    allowedRoles: ['10', 'student', 'instructor', 'faculty', 'teacher', '0', '1', '2', 'admin', 'superadmin'],
    allowedDesignationNames: ['student', 'instructor', 'teacher', 'faculty', 'trainer']
  },

  // --- ATTENDANCE ---
  { 
    icon: Clipboard, 
    label: 'Student Attendance', 
    path: '/student-attendance', 
    category: 'Attendance', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', '10', 'student'],
    allowedDesignationNames: ['instructor', 'teacher', 'faculty', 'trainer', 'student']
  },

  // --- ASSIGNMENTS ---
  { 
    icon: CheckCircle2, 
    label: 'Assignments & Grading', 
    path: '/assignments', 
    category: 'Assignments', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', '10', 'student'],
    allowedDesignationNames: ['instructor', 'teacher', 'faculty', 'trainer', 'student']
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

  // --- LIVE CLASSES ---
  { 
    icon: Video, 
    label: 'Live Classrooms', 
    path: '/live-classes', 
    category: 'Live Classes', 
    allowedRoles: ['0', '1', '2', 'admin', 'superadmin', 'instructor', 'faculty', 'teacher', '10', 'student'],
    allowedDesignationNames: ['instructor', 'teacher', 'faculty', 'trainer', 'student']
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

  // --- SETTINGS ---
  { 
    icon: Settings, 
    label: 'Settings', 
    path: '/settings', 
    category: 'Settings' 
  }
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
        return menuItems.filter(item => item.path === '/academy/learning' || item.path === '/settings');
      }

      const currentUserRole = String(userObj.role_id || userObj.roleId || userObj.role || '').toLowerCase().trim();
      const currentDesigName = String(userObj.designation || userObj.designationId?.name || '').toLowerCase().trim();
      const isStudent = currentUserRole === '10' || currentUserRole === 'student' || currentDesigName === 'student';
      
      const isSuperAdminUser = 
        userObj.isSuperAdmin === true ||
        userObj.is_super_admin === true ||
        currentUserRole === 'superadmin' || 
        currentUserRole === 'super_admin' || 
        currentUserRole === '0' || 
        String(userObj.role || '').toLowerCase() === 'superadmin' ||
        String(userObj.role || '').toLowerCase() === '0';

      const isAdminUser = isSuperAdminUser || ['1', '2', 'admin'].includes(currentUserRole) || currentDesigName.includes('admin');

      // 1. Admin & SuperAdmin: Full access to all EdTech tools
      if (isAdminUser) {
        return menuItems;
      }

      // 2. Student: Strictly allowed only Student modules
      if (isStudent) {
        const studentAllowedPaths = [
          '/academy/learning',
          '/live-classes',
          '/assignments',
          '/student-attendance',
          '/accounts',
          '/certificates',
          '/notifications',
          '/settings'
        ];
        return menuItems.filter(item => studentAllowedPaths.includes(item.path));
      }

      // 3. Custom permissions if defined
      if (Array.isArray(userObj.permissions) && userObj.permissions.length > 0) {
        const allowedSet = userObj.permissions.map(p => String(p).toLowerCase().trim());
        const customVisible = menuItems.filter(item => {
          const itemLabelLower = item.label.toLowerCase().trim();
          const itemPathLower = item.path ? item.path.toLowerCase().trim() : '';
          return (
            item.path === '/notifications' ||
            item.path === '/settings' ||
            allowedSet.includes(itemLabelLower) ||
            allowedSet.includes(itemPathLower)
          );
        });
        if (customVisible.length > 0) return customVisible;
      }

      // 4. Role / Designation Based Matching for Counselor, Instructor, etc.
      const isCounselor = currentUserRole === 'counselor' || currentDesigName.includes('counselor') || currentDesigName.includes('tele');
      const isInstructor = currentUserRole === 'instructor' || currentDesigName.includes('instructor') || currentDesigName.includes('faculty') || currentDesigName.includes('teacher') || currentDesigName.includes('trainer');

      const visible = menuItems.filter(item => {
        // If item has no role restrictions, allow it
        if (!item.allowedRoles && !item.allowedDesignationNames) {
          return true;
        }

        const roleMatch = item.allowedRoles && (
          item.allowedRoles.includes(currentUserRole) ||
          (isCounselor && item.allowedRoles.includes('counselor')) ||
          (isInstructor && item.allowedRoles.includes('instructor'))
        );

        const desigMatch = item.allowedDesignationNames && item.allowedDesignationNames.some(name =>
          currentDesigName.includes(name) || name.includes(currentDesigName)
        );

        return roleMatch || desigMatch;
      });

      // Place user's primary dashboard at top if resolved
      const userDashboardPath = resolveUserDashboardPath(userObj);
      let primaryDash = visible.find(item => item.path === userDashboardPath);
      let finalVisible = [...visible];
      if (primaryDash && primaryDash.path !== '/dashboard') {
        finalVisible = finalVisible.filter(item => item.path !== primaryDash.path);
        finalVisible.unshift({ ...primaryDash, category: 'Overview' });
      }

      return finalVisible;
    } catch (e) {
      console.error("Error reading operator authorization layout paths:", e);
      return menuItems.filter(item => item.path === '/academy/learning' || item.path === '/settings');
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

        {/* User profile / Logout bottom container */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/50 shrink-0">
          <Link
            to="/login"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              localStorage.removeItem('user_id');
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-medium ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Logout"
          >
            <LogOut size={18} className="shrink-0" />
            {!isCollapsed && <span className="text-xs font-semibold">Sign Out</span>}
          </Link>
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
            to="/login"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              localStorage.removeItem('user_id');
              setIsMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-medium"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="text-sm font-medium">Sign Out</span>
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