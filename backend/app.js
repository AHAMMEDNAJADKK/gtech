import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

// Fix querySrv ECONNREFUSED issues on local ISP/router DNS resolvers
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
  // Fallback to system default DNS if setting servers fails
}

// Route Imports
import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import attendanceRoutes from './src/routes/attendance.routes.js';
import taskRoutes from './src/routes/task.routes.js';
import studentRoutes from './src/routes/student.routes.js';
import crmRoutes from './src/routes/index.js';
import apiRoutes from './src/routes/api.js';
import aiRoutes from './src/routes/ai.routes.js';
import mdDashboardRoutes from './src/routes/mdDashboard.routes.js';
import accountRoutes from './src/routes/account.routes.js';
import academyRoutes from './src/routes/academy.routes.js';
import notificationRoutes from './src/routes/notification.routes.js';
import leaveRoutes from './src/routes/leave.routes.js';
import recruitmentRoutes from './src/routes/recruitment.routes.js';
import { servePublicPdf } from './src/controllers/account.controller.js';
import Designation from './src/models/designation.model.js';
import Department from './src/modules/departments/department.model.js';
const app = express();

const cloudinaryEnvWarnings = [];
if (!process.env.CLOUDINARY_CLOUD_NAME) cloudinaryEnvWarnings.push('CLOUDINARY_CLOUD_NAME');
if (!process.env.CLOUDINARY_API_KEY) cloudinaryEnvWarnings.push('CLOUDINARY_API_KEY');
if (!process.env.CLOUDINARY_API_SECRET) cloudinaryEnvWarnings.push('CLOUDINARY_API_SECRET');

if (cloudinaryEnvWarnings.length > 0) {
  console.warn(`Cloudinary configuration is incomplete: missing ${cloudinaryEnvWarnings.join(', ')}`);
} else {
  console.info('Cloudinary configuration loaded successfully.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['https://crm-test.vercel.app', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.options('*', cors());

// 2. Parsers Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Public PDF Download Route (Unauthenticated for WhatsApp Link Customers & Rich Cards)
app.get('/api/v1/public/pdf/:token/raw', servePublicPdf);
app.get('/api/v1/public/pdf/:token', servePublicPdf);
app.get('/api/public/pdf/:token/raw', servePublicPdf);
app.get('/api/public/pdf/:token', servePublicPdf);
app.get('/public/pdf/:token/raw', servePublicPdf);
app.get('/public/pdf/:token', servePublicPdf);

// 4. Specific/Dedicated API Routers
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes); 
app.use('/api/v1/attendance', attendanceRoutes); 
app.use('/api/user', userRoutes); 
app.use('/api/v1/user', userRoutes); 
app.use('/api/tasks', taskRoutes);
app.use('/api/v1/tasks', taskRoutes);
// app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/md-dashboard', mdDashboardRoutes);
app.use('/api/md-dashboard', mdDashboardRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/v1/academy', academyRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/v1/notifications', notificationRoutes);
app.use('/notifications', notificationRoutes);
app.use('/api/v1/recruitment', recruitmentRoutes);
app.use('/api/recruitment', recruitmentRoutes);

// 4. Broad, Versioned, & Catch-all Fallbacks (Broadest matching paths go lower)
app.use('/api/v1', studentRoutes);
app.use('/api/v1', crmRoutes);
app.use('/api', studentRoutes); 
app.use('/api', crmRoutes);
app.use('/v1', studentRoutes);
app.use('/v1', crmRoutes);
app.use('/api', apiRoutes);      // Legacy base fallback route handler

// Welcome / Root Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: "CRM Backend Server is running successfully."
  });
});

// 5. Global 404 Route Catch-All
// Prevents missing endpoints from crashing headers or responding with standard Express HTML
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route Not Found: ${req.method} ${req.originalUrl}`
  });
});

import logger from './src/utils/logger.util.js';

// 6. Global 500 Error Catch-All
// Intercepts unhandled synchronous crashes, preserving correct headers and standard JSON feedback
app.use((err, req, res, next) => {
  console.error('🚨 Global Server Exception Error:', err.message);
  if (logger && typeof logger.error === 'function') {
    logger.error('Global Server Exception Error', { errorStack: err.stack, message: err.message });
  }

  // Handle Multer file size errors specifically
  if (err.code === 'LIMIT_FILE_SIZE' || (err.name === 'MulterError' && err.message === 'File too large')) {
    return res.status(413).json({
      success: false,
      message: `File too large. Maximum allowed size is 50MB. Please reduce the file size and try again.`
    });
  }

  const statusCode = (typeof err.statusCode === 'number' && err.statusCode >= 100 && err.statusCode < 600)
    ? err.statusCode
    : ((typeof err.status === 'number' && err.status >= 100 && err.status < 600) ? err.status : 500);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error Fallback',
    message: err.message || 'Internal Server Error Fallback'
  });
});

// 7. Database Connection Section
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb+srv://shabeeba:9995982324@cluster0.i23tzbf.mongodb.net/crm?appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log(' ✅ Successfully connected to MongoDB.');
    try {
      const count = await Designation.countDocuments();
      if (count === 0) {
        const defaultDesignations = [
          "HR Manager",
          "Graphic Designer",
          "Digital Marketer",
          "React Developer",
          "Node Developer",
          "Flutter Developer",
          "Fullstack",
          "Admin",
          "Manager"
        ];
        await Designation.insertMany(defaultDesignations.map(name => ({ name, isActive: true })));
        console.log(' 🌱 Successfully seeded default designations.');
      }
    } catch (seedErr) {
      console.error(' ❌ Failed to seed default designations:', seedErr.message);
    }

    try {
      const deptCount = await Department.countDocuments();
      if (deptCount === 0) {
        const defaultDepartments = [
          { name: "HR & Admin", code: "HR" },
          { name: "Marketing", code: "MKT" },
          { name: "Development", code: "DEV" },
          { name: "Designing", code: "DSN" }
        ];
        await Department.insertMany(defaultDepartments.map(d => ({ 
          name: d.name, 
          code: d.code, 
          status: true 
        })));
        console.log(' 🌱 Successfully seeded default departments.');
      }
    } catch (seedErr) {
      console.error(' ❌ Failed to seed default departments:', seedErr.message);
    }
  })
  .catch((error) => {
    console.error(' ❌ CRITICAL DATABASE CONNECTION ERROR:', error.message);
    process.exit(1); 
  });

export default app;
