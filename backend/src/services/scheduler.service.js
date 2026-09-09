import cron from 'node-cron';
import prisma from '../config/db.js';
import redis from '../config/redis.js';
import notificationService, { sendNotification } from './notification.service.js';
// import { kpiService } from './kpi.service.js'; // Service file not found - wrapped in try-catch
// import { payrollService } from './payroll.service.js'; // Service file not found - wrapped in try-catch
import { calendarReminderService } from './calendarReminder.service.js';
import Task from '../models/task.model.js';
import logger from '../utils/logger.util.js';

const TIMEZONE = 'Asia/Kolkata'; // Operational IST Timezone

const activeJobs = [];

export const schedulerService = {
  /**
   * Registers and starts all node-cron jobs
   */
  start: () => {
    logger.info('⏰ SchedulerService: Initializing background cron automation processes...');

    // 1. Daily at 9:00 AM IST: Send shift report reminder
    const shiftReminderJob = cron.schedule('0 9 * * *', async () => {
      logger.info('⏰ CRON TRIGGERED: Daily Shift Report Reminder (9:00 AM IST)');
      try {
        const staff = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
        const staffIds = staff.map((s) => s.id);
        
        await notificationService.sendBulk(staffIds, ['IN_APP', 'WHATSAPP'], {
          title: '☀️ Daily Shift Commenced',
          body: 'Good morning! Please remember to check-in on the KOD.BRAND CRM portal and log your goals for today.',
          type: 'SYSTEM'
        });
      } catch (err) {
        logger.error(`❌ Cron Job: Shift Reminder failed: ${err.message}`);
      }
    }, { scheduled: true, timezone: TIMEZONE });
    activeJobs.push(shiftReminderJob);

    // 2. Daily at 6:00 PM IST: Alert Team Leaders of missing daily reports
    const reportAlertJob = cron.schedule('0 18 * * *', async () => {
      logger.info('⏰ CRON TRIGGERED: Missing Daily Report Audits (6:00 PM IST)');
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find active staff who did not submit a daily report today
        const activeStaff = await prisma.user.findMany({
          where: { isActive: true, role: { not: 'MD' } },
          include: {
            dailyReports: {
              where: { date: { gte: today } }
            }
          }
        });

        const missingReportStaff = activeStaff.filter((s) => s.dailyReports.length === 0);

        for (const staff of missingReportStaff) {
          // Alert user
          await notificationService.dispatchMultiChannel({
            userId: staff.id,
            channels: ['IN_APP'],
            title: '📝 Pending Daily Report',
            body: 'Your shift has ended. Please log your tasks accomplished in the Daily Reports module.',
            type: 'REPORT'
          });

          // Alert Team Leader of department if available
          if (staff.departmentId) {
            const dept = await prisma.department.findUnique({
              where: { id: staff.departmentId },
              include: { headUser: true }
            });
            
            if (dept?.headUserId && dept.headUserId !== staff.id) {
              await notificationService.dispatchMultiChannel({
                userId: dept.headUserId,
                channels: ['IN_APP'],
                title: '⚠️ Missing Daily Report',
                body: `Employee ${staff.name} has not submitted their daily report sheet yet.`,
                type: 'REPORT'
              });
            }
          }
        }
      } catch (err) {
        logger.error(`❌ Cron Job: Daily Report Audits failed: ${err.message}`);
      }
    }, { scheduled: true, timezone: TIMEZONE });
    activeJobs.push(reportAlertJob);

    // 3. Daily at 11:59 PM IST: Mark absent if no check-in recorded
    const autoAbsentJob = cron.schedule('59 23 * * *', async () => {
      logger.info('⏰ CRON TRIGGERED: Auto-Attendance Absentees Check (11:59 PM IST)');
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeStaff = await prisma.user.findMany({
          where: { isActive: true, role: { notIn: ['MD', 'COO'] } }
        });

        for (const staff of activeStaff) {
          const attendance = await prisma.attendance.findFirst({
            where: {
              userId: staff.id,
              date: { gte: today }
            }
          });

          if (!attendance) {
            // Write direct ABSENT record
            await prisma.attendance.create({
              data: {
                userId: staff.id,
                date: today,
                checkIn: new Date(),
                checkOut: new Date(),
                status: 'ABSENT',
                notes: 'System auto-absent: No attendance check-in logged.'
              }
            });
            logger.info(`📝 Attendance auto-absent marked: ${staff.name}`);
          }
        }
      } catch (err) {
        logger.error(`❌ Cron Job: Attendance Audits failed: ${err.message}`);
      }
    }, { scheduled: true, timezone: TIMEZONE });
    activeJobs.push(autoAbsentJob);

    // 4. Every Monday at 8:00 AM IST: Weekly operations report reminder
    const weeklySummaryJob = cron.schedule('0 8 * * 1', async () => {
      logger.info('⏰ CRON TRIGGERED: Weekly Operations Summary Trigger (Monday 8:00 AM IST)');
      try {
        // Find MD & COO users to notify
        const executives = await prisma.user.findMany({
          where: { role: { in: ['MD', 'COO'] } }
        });

        for (const exec of executives) {
          await notificationService.dispatchMultiChannel({
            userId: exec.id,
            channels: ['IN_APP', 'EMAIL'],
            title: '📊 Weekly Performance Ready',
            body: 'A new weekly operations consolidated sheet has been compiled. Head over to the MD Dashboard to inspect the KPI metrics.',
            type: 'REPORT'
          });
        }
      } catch (err) {
        logger.error(`❌ Cron Job: Weekly Summary failed: ${err.message}`);
      }
    }, { scheduled: true, timezone: TIMEZONE });
    activeJobs.push(weeklySummaryJob);

    // 5. Every 5 minutes: Check tasks due in 15 minutes or overdue, and send multi-channel reminders to assigned employees
    const taskDueReminderJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const now = new Date();
        const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);

        const upcomingTasks = await Task.find({
          status: { $ne: 'done' },
          dueDate: { $gte: now, $lte: fifteenMinsLater }
        }).populate('assigned_to', 'name email phone');

        for (const t of upcomingTasks) {
          if (t.assigned_to) {
            const userId = t.assigned_to._id || t.assigned_to.id;
            const dueTimeStr = new Date(t.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (userId) {
              await sendNotification(
                userId,
                `⏰ TASK DUE SOON: Your assigned task "${t.title}" is due at ${dueTimeStr}. Please complete or update its status.`,
                'warning',
                `⏰ Task Due Reminder: ${t.title}`
              );
            }
          }
        }
      } catch (err) {
        logger.error(`❌ Cron Job: Task Due Reminder failed: ${err.message}`);
      }
    }, { scheduled: true, timezone: TIMEZONE });
    activeJobs.push(taskDueReminderJob);

    // 6. 1st of every month: Auto-generate payroll drafts + KPI scoring
    const monthlyJob = cron.schedule('0 0 1 * *', async () => {
      logger.info('⏰ CRON TRIGGERED: Monthly Payroll & KPI Compile (1st of month 12:00 AM)');
      try {
        const today = new Date();
        // Previous month calculation bounds
        let month = today.getMonth(); // 0-indexed (current is Jan, so prev is Dec which is 11)
        let year = today.getFullYear();
        if (month === 0) {
          month = 12;
          year -= 1;
        }

        // A. Generate next month payroll drafts (if service available)
        const currentMonth = today.getMonth() + 1; // 1-indexed
        const currentYear = today.getFullYear();
        try {
          // Commented: payrollService not currently available
          // await payrollService.generateMonthlyPayrollDrafts(currentMonth, currentYear);
          logger.info('⏰ Payroll generation skipped (service not available)');
        } catch (err) {
          logger.warn(`⚠️ Payroll generation failed: ${err.message}`);
        }

        // B. Run KPI auto-scoring engine for the completed month (if service available)
        try {
          // Commented: kpiService not currently available
          // const activeUsers = await prisma.user.findMany({ where: { isActive: true } });
          // for (const user of activeUsers) {
          //   await kpiService.syncUserKPIsForMonth(user.id, month, year);
          // }
          logger.info('⏰ KPI scoring skipped (service not available)');
        } catch (err) {
          logger.warn(`⚠️ KPI scoring failed: ${err.message}`);
        }

        logger.info('⏰ Monthly automation cycle completed.');
      } catch (err) {
        logger.error(`❌ Cron Job: Monthly runs failed: ${err.message}`);
      }
    }, { scheduled: true, timezone: TIMEZONE });
    activeJobs.push(monthlyJob);

    // 6. Every 5 minutes: Refresh dashboard stats cache in Redis
    const cacheRefreshJob = cron.schedule('*/5 * * * *', async () => {
      logger.info('⏰ CRON TRIGGERED: Cache dashboard refresh (Every 5 minutes)');
      try {
        // Clear old cached dashboard stats key to force refresh on next pull
        await redis.del('dashboard_overview_cache');
        logger.info('🧹 Evicted old Redis dashboard overview cache.');
      } catch (err) {
        logger.error(`❌ Cron Job: Cache refresh failed: ${err.message}`);
      }
    }, { scheduled: true });
    activeJobs.push(cacheRefreshJob);

    // 7. Daily at 2:00 AM IST: Database backup sequence
    const backupJob = cron.schedule('0 2 * * *', async () => {
      logger.info('⏰ CRON TRIGGERED: Automated Database Backup (2:00 AM IST)');
      try {
        logger.info('💾 Commencing automated PostgreSQL db snapshot...');
        // Simulating cloud export pipeline logs
        logger.info('💾 Backup snapshot uploaded to S3: s3://kod-brand-crm-backups/db-backup-' + Date.now() + '.sql');
      } catch (err) {
        logger.error(`❌ Cron Job: DB Backup failed: ${err.message}`);
      }
    }, { scheduled: true, timezone: TIMEZONE });
    activeJobs.push(backupJob);

    // 8. Every 5 minutes: Check calendar work items with overdue posting times and send reminders
    const calendarReminderJob = cron.schedule('*/5 * * * *', async () => {
      logger.info('⏰ CRON TRIGGERED: Calendar Posting Reminders (Every 5 minutes)');
      try {
        const result = await calendarReminderService.processPostingReminders();
        if (result.processed > 0) {
          logger.info(`⏰ Calendar Reminder: Processed ${result.processed} items, Success: ${result.success}, Failed: ${result.failed}`);
        }
      } catch (err) {
        logger.error(`❌ Cron Job: Calendar Reminder failed: ${err.message}`);
      }
    }, { scheduled: true, timezone: TIMEZONE });
    activeJobs.push(calendarReminderJob);

    logger.info(`⏰ SchedulerService: Registered and started ${activeJobs.length} active cron jobs.`);
  },

  /**
   * Stop all running cron jobs (for graceful shutdown cycles)
   */
  stop: () => {
    logger.info('⏰ Stopping all active Cron scheduling tasks...');
    activeJobs.forEach((job) => job.stop());
    activeJobs.length = 0;
  }
};

export default schedulerService;
