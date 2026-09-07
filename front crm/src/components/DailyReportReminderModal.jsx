import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, ArrowRight, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from './ToastProvider';
import { playNotificationBeep } from '../utils/soundUtils';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const getReportConfig = (user) => {
  const role = String(user?.role || user?.role_id || '').toLowerCase().trim();
  const designation = String(user?.designation || '').toLowerCase().trim();
  const department = String(user?.department || user?.departmentId?.name || '').toLowerCase().trim();

  if (designation.includes('graphic') || role.includes('graphic')) {
    return { route: '/graphic-designer-report', apiPrefix: 'graphic-designer-reports', name: 'Graphic Designer Daily Report' };
  }
  if (designation.includes('video') || role.includes('video')) {
    return { route: '/videographer-report', apiPrefix: 'videographer-reports', name: 'Videographer Daily Report' };
  }
  if (
    designation.includes('developer') ||
    
    role.includes('developer') ||
    role.includes('dev') ||
    role.includes('junior') ||
    department.includes('development') ||
    department.includes('software') ||
    department.includes('engineering') ||
    department.includes('it')
  ) {
    return { route: '/developer-report', apiPrefix: 'developer-reports', name: 'Developer Daily Report' };
  }
  if (designation.includes('hod') && (department.includes('market') || designation.includes('market'))) {
    return { route: '/hod-marketing-report', apiPrefix: 'hod-marketing-reports', name: 'HOD Marketing Daily Report' };
  }
  if (department.includes('market') || designation.includes('market') || role === '4' || role.includes('digital')) {
    return { route: '/marketing-report', apiPrefix: 'marketing-reports', name: 'Marketing Daily Report' };
  }
  if (department.includes('account') || designation.includes('account') || role.includes('account')) {
    return { route: '/accountant-report', apiPrefix: 'accountant-reports', name: 'Accountant Daily Report' };
  }
  if (department.includes('r&d') || designation.includes('hod') || role.includes('hod')) {
    return { route: '/hod-rd-report', apiPrefix: 'hod-rd-reports', name: 'HOD R&D Daily Report' };
  }
  if (department.includes('ops') || designation.includes('ops') || role.includes('ops')) {
    return { route: '/ops-report', apiPrefix: 'ops-reports', name: 'Ops Daily Report' };
  }
  if (department.includes('counsel') || designation.includes('counsel')) {
    return { route: '/academic-counselor-report', apiPrefix: 'academic-counselor-reports', name: 'Academic Counselor Daily Report' };
  }
  if (department.includes('hr') || designation.includes('hr') || role === '1' || role === 'hr') {
    return { route: '/hr-report', apiPrefix: 'hr-reports', name: 'HR Daily Report' };
  }
  return { route: '/basic-report', apiPrefix: 'basic-report', name: 'Daily Work Report' };
};

const DailyReportReminderModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isReportSaved, setIsReportSaved] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isPastReminderTime = () => {
    const d = new Date();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    // Operational time: 4:45 PM (16:45)
    return hours > 16 || (hours === 16 && minutes >= 45);
  };

  const dispatchInAppAndPushNotification = useCallback(async (currentUser, config) => {
    const todayStr = getTodayStr();
    const notifDispatchedKey = `report_notif_sent_${todayStr}_${currentUser._id || currentUser.id}`;
    if (sessionStorage.getItem(notifDispatchedKey)) return;

    sessionStorage.setItem(notifDispatchedKey, 'true');

    // 1. Dispatch Web Browser Native Push Notification
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('⚠️ Daily Report Reminder', {
            body: `It is past 4:45 PM. Please save your ${config.name} for today.`,
            icon: '/logo2.png',
            tag: `report_reminder_${todayStr}`
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('⚠️ Daily Report Reminder', {
                body: `It is past 4:45 PM. Please save your ${config.name} for today.`,
                icon: '/logo2.png',
                tag: `report_reminder_${todayStr}`
              });
            }
          });
        }
      }
    } catch (pushErr) {
      console.warn("Browser push notification warning:", pushErr.message);
    }

    // 2. Dispatch In-App DB Notification
    try {
      const rawToken = localStorage.getItem('token') || '';
      const cleanToken = rawToken.replace(/"/g, '').trim();
      const authHeader = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;

      const rawBase = API_BASE.replace(/\/+$/, '');
      const url = rawBase.endsWith('/v1') ? `${rawBase}/notifications` : `${rawBase}/v1/notifications`;

      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '⚠️ Daily Report Reminder',
          description: `It is past 4:45 PM and your ${config.name} for today (${todayStr}) has not been saved yet.`,
          assignedTo: [currentUser._id || currentUser.id],
          type: 'warning'
        })
      });
    } catch (inAppErr) {
      console.warn("In-app notification dispatch warning:", inAppErr.message);
    }
  }, []);

  const checkReportSavedStatus = useCallback(async () => {
    try {
      const savedUserStr = localStorage.getItem('user');
      const rawToken = localStorage.getItem('token');
      if (!savedUserStr || !rawToken) return;

      const currentUser = JSON.parse(savedUserStr);
      setUser(currentUser);
      const userId = currentUser._id || currentUser.id;
      if (!userId) return;

      // SuperAdmins don't need daily report reminders
      if (currentUser.isSuperAdmin || currentUser.role === 'superadmin' || currentUser.role_id === '0') {
        return;
      }

      const todayStr = getTodayStr();

      // Check if snoozed
      const snoozeUntil = sessionStorage.getItem(`report_reminder_snooze_${todayStr}`);
      if (snoozeUntil && Date.now() < parseInt(snoozeUntil, 10)) {
        setIsOpen(false);
        return;
      }

      // Only run reminder logic if it's 4:45 PM or later
      if (!isPastReminderTime()) {
        setIsOpen(false);
        return;
      }

      const config = getReportConfig(currentUser);

      // If user is currently on their report page, don't obstruct with popup
      if (location.pathname === config.route) {
        setIsOpen(false);
        return;
      }

      if (config.apiPrefix === 'basic-report') {
        const basicSaved = localStorage.getItem(`basic_report_saved_${userId}_${todayStr}`) || localStorage.getItem(`basic_report_draft_${userId}_${todayStr}`);
        if (basicSaved) {
          setIsReportSaved(true);
          setIsOpen(false);
          return;
        }
      } else {
        const cleanToken = rawToken.replace(/"/g, '').trim();
        const authHeader = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;

        const rawBase = API_BASE.replace(/\/+$/, '');
        const endpoint = rawBase.endsWith('/v1') 
          ? `${rawBase}/${config.apiPrefix}/by-date?dateString=${todayStr}&userId=${userId}` 
          : `${rawBase}/v1/${config.apiPrefix}/by-date?dateString=${todayStr}&userId=${userId}`;

        const res = await fetch(endpoint, {
          headers: { 'Authorization': authHeader }
        });

        if (res.ok) {
          const result = await res.json();
          if (result.data) {
            setIsReportSaved(true);
            setIsOpen(false);
            return;
          }
        }
      }

      // Report not saved for today + past 4:45 PM -> Show popup modal & send notifications
      setIsReportSaved(false);
      if (!isOpen) {
        playNotificationBeep();
      }
      setIsOpen(true);
      dispatchInAppAndPushNotification(currentUser, config);

    } catch (err) {
      console.warn("Daily report check error:", err.message);
    }
  }, [location.pathname, dispatchInAppAndPushNotification]);

  useEffect(() => {
    checkReportSavedStatus();
    // Check every 60 seconds
    const interval = setInterval(checkReportSavedStatus, 60000);
    return () => clearInterval(interval);
  }, [checkReportSavedStatus]);

  const handleFillReportNow = () => {
    if (!user) return;
    const config = getReportConfig(user);
    setIsOpen(false);
    navigate(config.route);
  };

  const handleSnooze = () => {
    const todayStr = getTodayStr();
    // Snooze for 30 minutes (30 * 60 * 1000)
    const snoozeTime = Date.now() + 30 * 60 * 1000;
    sessionStorage.setItem(`report_reminder_snooze_${todayStr}`, String(snoozeTime));
    setIsOpen(false);
    showToast("Reminder snoozed for 30 minutes.", "info");
  };

  if (!isOpen || isReportSaved) return null;

  const config = getReportConfig(user);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-3xl p-6 shadow-2xl overflow-hidden"
        >
          {/* Decorative Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Close / Dismiss Button */}
          <button
            onClick={handleSnooze}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Snooze"
          >
            <X size={18} />
          </button>

          {/* Content */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-inner">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-2 pr-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                <Clock size={12} />
                <span>4:45 PM Daily Reminder</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                Daily Report Not Saved Yet
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                It is past 4:45 PM and your <strong className="text-amber-700 dark:text-amber-400">{config.name}</strong> for today has not been saved yet. Please fill out your report before end of shift.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSnooze}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-center cursor-pointer"
            >
              Remind Later
            </button>

            <button
              onClick={handleFillReportNow}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Fill Report Now</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DailyReportReminderModal;
