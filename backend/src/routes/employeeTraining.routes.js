import { Router } from 'express';
import protectRoute, { requireAdminOrStaff } from '../middleware/auth.middleware.js';
import employeeTrainingController from '../controllers/employeeTraining.controller.js';

const router = Router();

// Protect all employee training routes
router.use(protectRoute);

// GET  /api/v1/employee-training/my-training → list courses assigned to current user
router.get('/my-training', employeeTrainingController.getMyAssignedTraining);

// GET  /api/v1/employee-training → list all courses (with filters + stats)
router.get('/', employeeTrainingController.getAll);

// POST /api/v1/employee-training → create new training course
router.post('/', requireAdminOrStaff, employeeTrainingController.create);

// PUT  /api/v1/employee-training/:id → update full course (edit modal)
router.put('/:id', requireAdminOrStaff, employeeTrainingController.update);

// PATCH /api/v1/employee-training/:id/progress → update employee individual progress / score / remarks
router.patch('/:id/progress', employeeTrainingController.updateEmployeeProgress);

// PATCH /api/v1/employee-training/:id/status → quick inline status update for catalog
router.patch('/:id/status', requireAdminOrStaff, employeeTrainingController.updateStatus);

// DELETE /api/v1/employee-training/:id → delete course
router.delete('/:id', requireAdminOrStaff, employeeTrainingController.remove);

export default router;
