import React from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import AiChatWidget from '../components/AiChatWidget';
import DailyReportReminderModal from '../components/DailyReportReminderModal';
import TaskDueReminderModal from '../components/TaskDueReminderModal';
import { useUser } from '../contexts/UserContext';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const { refetchUser } = useUser();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  // --- Inactivity sliding session timeout tracker (30 minutes) ---
  React.useEffect(() => {
    let timeoutId;
    const timeoutDuration = 30 * 60 * 1000; // 30 minutes in milliseconds

    const handleLogout = () => {
      console.log("🕒 Session expired due to inactivity. Logging out.");
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('user_id');
      window.location.href = '/login?timeout=true';
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, timeoutDuration);
    };

    // User interaction events to reset timer
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Register listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  // Keep the live profile and sidebar permissions synchronized through UserContext.
  React.useEffect(() => {
    refetchUser();
  }, [location.pathname, refetchUser]);

  // Polished, micro-movements for ambient monochrome contrast fields

  const blobVariants = {
    animateDark: {
      scale: [1, 1.15, 1.05, 1],
      x: [0, 40, -20, 0],
      y: [0, -30, 30, 0],
      transition: { duration: 22, repeat: Infinity, ease: "easeInOut" }
    },
    animateLight: {
      scale: [1, 1.2, 0.95, 1],
      x: [0, -40, 30, 0],
      y: [0, 30, -40, 0],
      transition: { duration: 26, repeat: Infinity, ease: "easeInOut" }
    },
    animateCore: {
      scale: [1, 1.1, 1.15, 1],
      x: [0, 20, -30, 0],
      y: [0, 40, -20, 0],
      transition: { duration: 18, repeat: Infinity, ease: "easeInOut" }
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0b0c10] text-slate-900 dark:text-slate-100 overflow-x-hidden selection:bg-slate-900/10 dark:selection:bg-white/10 transition-colors duration-500">

      {/* 1. Monochromatic Technical Ambient Backdrop */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden opacity-60 transition-opacity duration-500">
        {/* Soft Charcoal Shadow Core (Adds deep ambient weight) */}
        <motion.div
          variants={blobVariants}
          animate="animateDark"
          className="absolute top-[-10%] left-[-5%] w-[55%] h-[55%] rounded-full bg-slate-900/[0.04] dark:bg-slate-400/[0.02] blur-[100px] transition-colors duration-500"
        />

        {/* Stark Pure White / Deep Velvet Core */}
        <motion.div
          variants={blobVariants}
          animate="animateLight"
          className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[60%] rounded-full bg-white dark:bg-slate-950/40 blur-[120px] transition-colors duration-500"
        />

        {/* Mid-Tone Slate Mist Bridge */}
        <motion.div
          variants={blobVariants}
          animate="animateCore"
          className="absolute top-[25%] right-[15%] w-[45%] h-[45%] rounded-full bg-slate-300/[0.15] dark:bg-slate-800/[0.12] blur-[110px] transition-colors duration-500"
        />
      </div>

      {/* 2. Global Structural Elements */}
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        setIsCollapsed={setSidebarCollapsed} 
        isMobileOpen={mobileSidebarOpen} 
        setIsMobileOpen={setMobileSidebarOpen} 
      />

      {/* Dynamic Laser Scan Top Progress Rule */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-slate-400 to-transparent dark:via-slate-700 z-50 overflow-hidden opacity-40">
        <motion.div
          className="w-1/3 h-full bg-gradient-to-r from-transparent via-slate-900 dark:via-white to-transparent"
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <Navbar 
        isSidebarCollapsed={sidebarCollapsed} 
        toggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)} 
      />

      {/* 3. Main Content Section with Fluid Transitions */}
      <main className={`transition-all duration-300 pt-18 pb-20 px-4 lg:pr-6 max-w-[1920px] mx-auto ${sidebarCollapsed ? 'lg:pl-24' : 'lg:pl-68'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{
              duration: 0.25,
              ease: [0.25, 1, 0.5, 1]
            }}
            className="relative"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. Textured Blueprint Grid & Flowing Line Signals */}
      <div className="fixed inset-0 -z-20 pointer-events-none overflow-hidden">

        {/* Crisp Matrix Grid (Hardcoded colors to prevent transparency failure) */}
        <div
          className="absolute inset-0 opacity-[0.45] dark:opacity-[0.15] transition-opacity duration-500"
          style={{
            backgroundImage: `
              linear-gradient(to right, #cbd5e1 1px, transparent 1px),
              linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Vector Schematic Lines with Animated Gradients */}
        <svg className="absolute inset-0 w-full h-full stroke-slate-300/70 dark:stroke-slate-800/50 transition-colors duration-500" strokeWidth="1.2" fill="none">
          <defs>
            {/* Real-time moving pulse gradient definition */}
            <linearGradient id="pulse-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Background Structural Matrix Traces */}
          <g>
            <path d="M -50 200 L 300 200 L 400 300 L 900 300 L 980 220 L 1500 220" />
            <path d="M 200 -50 L 200 400 L 100 500 L 100 900" />
            <path d="M 800 1200 L 800 750 L 950 600 L 1600 600" />
          </g>

          {/* Animated Line Gradients (Flowing laser tracking effect) */}
          <g className="text-slate-400 dark:text-slate-600" stroke="url(#pulse-grad-1)" strokeWidth="1.5">
            <motion.path
              d="M -50 200 L 300 200 L 400 300 L 900 300 L 980 220 L 1500 220"
              initial={{ strokeDasharray: "100 300", strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: -400 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
            <motion.path
              d="M 800 1200 L 800 750 L 950 600 L 1600 600"
              initial={{ strokeDasharray: "80 200", strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: 280 }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />
          </g>

          {/* Active Status Data Node 01 (Deep Charcoal / Light Silver Pulse) */}
          <motion.circle
            cx="400" cy="300" r={3.5}
            initial={{ r: 3.5 }}
            className="fill-slate-800 dark:fill-slate-200 transition-colors duration-500"
            animate={{ opacity: [0.3, 1, 0.3], r: [3.5, 5, 3.5] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Active Status Data Node 02 (Clean Slate Pulse) */}
          <motion.circle
            cx="900" cy="300" r={3}
            initial={{ r: 3 }}
            className="fill-slate-500 dark:fill-slate-400 transition-colors duration-500"
            animate={{ opacity: [0.2, 0.8, 0.2], r: [3, 4.5, 3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          {/* Active Status Data Node 03 (System Echo) */}
          <motion.circle
            cx="950" cy="600" r={2.5}
            initial={{ r: 2.5 }}
            className="fill-slate-300 dark:fill-slate-600 transition-colors duration-500"
            animate={{ opacity: [0.1, 0.6, 0.1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
        </svg>

        {/* System Microdot Terminals */}
        <div className="absolute top-[22%] left-[18%] flex gap-1 flex-wrap w-12 opacity-30 dark:opacity-[0.15]">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 transition-colors duration-500" />
          ))}
        </div>
        <div className="absolute bottom-[35%] right-[25%] flex gap-1 flex-wrap w-16 opacity-40 dark:opacity-[0.2]">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-slate-600 dark:bg-slate-300 transition-colors duration-500" />
          ))}
        </div>
      </div>

      {location.pathname !== '/ai-report' && <AiChatWidget />}
      <DailyReportReminderModal />
      <TaskDueReminderModal />
    </div>
  );
};

export default MainLayout;
