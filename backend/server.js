import app from './app.js';
import mongoose from 'mongoose';
import { schedulerService } from './src/services/scheduler.service.js';
import { execSync } from 'child_process';

const PORT = process.env.PORT || 5000;

function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(
        `netstat -ano | findstr :${port}`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      const lines = result.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0' && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        } catch (_) {}
      }
    } else {
      execSync(`fuser -k ${port}/tcp 2>/dev/null || true`);
    }
  } catch (_) {}
}

process.on('uncaughtException', (err) => {
  console.error('🚨 Non-fatal Uncaught Exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('🚨 Non-fatal Unhandled Promise Rejection:', reason);
});

let isListening = false;
let server = null;

const startServer = () => {
  if (isListening) return;
  isListening = true;

  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ WARNING: JWT_SECRET environment variable is not defined in environment. Using default secure key fallback.');
  }

  server = app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  🚀 Staff Management & CRM Server is active!`);
    console.log(`  Port: ${PORT}`);
    console.log(`==================================================`);

    // Initialize scheduler only once after server starts
    if (!global.schedulerStarted) {
      global.schedulerStarted = true;
      try {
        schedulerService.start();
      } catch (err) {
        console.error('❌ Failed to start scheduler:', err.message);
      }
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${PORT} is in use. Auto-releasing port ${PORT}...`);
      freePort(PORT);
      isListening = false;
      setTimeout(() => {
        startServer();
      }, 1000);
    } else {
      console.error('🚨 HTTP Server Error:', err.message);
    }
  });
};

// Graceful shutdown on nodemon restart (SIGUSR2) or process exit (SIGINT, SIGTERM)
const handleGracefulShutdown = (signal) => {
  if (server) {
    server.close(() => {
      if (signal === 'SIGUSR2') {
        process.kill(process.pid, 'SIGUSR2');
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
  }
};

process.once('SIGUSR2', () => handleGracefulShutdown('SIGUSR2'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

if (mongoose.connection.readyState === 1) {
  startServer();
} else {
  mongoose.connection.once('open', startServer);
  setTimeout(startServer, 1500);
}
