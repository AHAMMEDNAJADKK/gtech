import cron from 'node-cron';
import redis from '../config/redis.js';
import logger from '../utils/logger.util.js';

const activeJobs = [];

export const schedulerService = {
  /**
   * Registers and starts all node-cron jobs for EdTech CRM
   */
  start: () => {
    logger.info('⏰ SchedulerService: Initializing background cron automation processes...');

    // Every 15 minutes: Refresh dashboard stats cache in Redis if connected
    const cacheRefreshJob = cron.schedule('*/15 * * * *', async () => {
      try {
        if (redis && redis.status === 'ready') {
          await redis.del('dashboard_overview_cache');
          logger.info('🧹 Evicted old Redis dashboard overview cache.');
        }
      } catch (err) {
        // Silently skip if redis is unavailable
      }
    }, { scheduled: true });
    activeJobs.push(cacheRefreshJob);

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
